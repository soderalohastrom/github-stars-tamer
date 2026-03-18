import { ConvexError, v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// OpenAI API configuration
const OPENAI_API_BASE = "https://api.openai.com/v1/chat/completions";

// Model pricing (per million tokens) — approximate
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.4-nano": { input: 0.10, output: 0.40 },
  "gpt-5.4-mini": { input: 0.40, output: 1.60 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.0 },
};

const DEFAULT_MODEL = "gpt-5.4-nano";

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  return (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;
}

// Build categorization prompt (same structure as Claude version)
function buildPrompt(
  repositories: any[],
  existingCategories: string[],
  includeReadme: boolean
): string {
  const categoryList =
    existingCategories.length > 0
      ? existingCategories.join(", ")
      : "No existing categories - suggest new ones as needed";

  const repoData = repositories.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description || "No description",
    language: repo.language || "Unknown",
    topics: repo.topics?.length > 0 ? repo.topics : ["none"],
    stars: repo.stargazersCount,
    ...(includeReadme && repo.readmeExcerpt ? { readmeExcerpt: repo.readmeExcerpt } : {}),
  }));

  return `You are an expert at organizing GitHub repositories into meaningful categories. Analyze each repository and suggest the most appropriate category.

Guidelines:
1. Prefer existing categories when they fit (80%+ confidence)
2. Suggest new categories only when needed
3. Consider: name, description, language, topics, stars, README
4. Confidence as decimal 0-1
5. Keep reasoning to 1-2 sentences
6. For new categories: include name, hex color, Feather icon name

Existing Categories: ${categoryList}

Repositories:
${JSON.stringify(repoData, null, 2)}

Respond ONLY with valid JSON array, no markdown:
[{"repoId":"id","category":"Name","confidence":0.85,"reasoning":"Brief","isNewCategory":false}]

For new categories add: "suggestedColor":"#hex","suggestedIcon":"icon-name"`;
}

// Main categorization action using OpenAI API
export const categorizeRepositories = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.array(v.id("repositories")),
    model: v.optional(v.string()),
    includeReadme: v.optional(v.boolean()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const model = args.model || DEFAULT_MODEL;
    const includeReadme = args.includeReadme ?? true;
    const batchId = args.batchId || `batch_${Date.now()}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConvexError("OPENAI_API_KEY not configured in Convex environment variables.");
    }

    const user = await ctx.runQuery(internal.users.getUserByClerkId, {
      clerkUserId: args.clerkUserId,
    });
    if (!user) throw new ConvexError("User not found");

    // Fetch repositories
    const repositories: any[] = [];
    for (const repoId of args.repositoryIds) {
      const repo = await ctx.runQuery(internal.claudeAi.getRepositoryById, {
        repositoryId: repoId,
      });
      if (repo && repo.userId === user._id) {
        repositories.push({
          id: repoId,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description || null,
          language: repo.language || null,
          topics: repo.topics || [],
          stargazersCount: repo.stargazersCount,
          readmeExcerpt: includeReadme ? repo.readmeExcerpt || null : null,
        });
      }
    }

    if (repositories.length === 0) {
      throw new ConvexError("No valid repositories found");
    }

    // Get existing categories
    const categories = await ctx.runQuery(
      internal.claudeAi.getUserCategoryNames,
      { userId: user._id }
    );

    const prompt = buildPrompt(repositories, categories, includeReadme);

    // Call OpenAI API
    const response = await fetch(OPENAI_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ConvexError(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const responseData = await response.json();
    const content = responseData.choices?.[0]?.message?.content || "";
    const inputTokens = responseData.usage?.prompt_tokens || 0;
    const outputTokens = responseData.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateCost(model, inputTokens, outputTokens);

    // Parse JSON response
    let jsonStr = content.trim();
    if (jsonStr.includes("```json")) {
      const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    } else if (jsonStr.includes("```")) {
      const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }

    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      throw new ConvexError("No JSON array found in OpenAI response");
    }

    const suggestions = JSON.parse(arrayMatch[0]);
    const processingTime = Date.now() - startTime;

    // Track usage
    await ctx.runMutation(internal.claudeAi.recordAiUsage, {
      userId: user._id,
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd: estimatedCost,
      requestType: "categorization",
      providerRequestId: responseData.id,
    });

    // Store suggestions
    const suggestionIds: Id<"aiCategorizationSuggestions">[] = [];
    let totalConfidence = 0;

    for (const suggestion of suggestions) {
      const matchingRepo = repositories.find(
        (r) => r.id === suggestion.repoId || r.name === suggestion.repoId
      );
      if (!matchingRepo) continue;

      const suggestionId = await ctx.runMutation(
        internal.claudeAi.createSuggestion,
        {
          userId: user._id,
          repositoryId: matchingRepo.id as Id<"repositories">,
          suggestedCategoryName: suggestion.category || "Uncategorized",
          suggestedCategoryColor: suggestion.suggestedColor,
          suggestedCategoryIcon: suggestion.suggestedIcon,
          confidence: Math.min(1, Math.max(0, Number(suggestion.confidence) || 0.5)),
          reasoning: suggestion.reasoning,
          metadata: {
            aiModel: model,
            processingTimeMs: processingTime,
            promptVersion: "openai-1.0",
            existingCategories: categories,
            batchId,
            inputTokens,
            outputTokens,
          },
        }
      );

      suggestionIds.push(suggestionId);
      totalConfidence += suggestion.confidence || 0.5;
    }

    return {
      success: true,
      suggestionIds,
      totalSuggestions: suggestionIds.length,
      averageConfidence: suggestionIds.length > 0 ? totalConfidence / suggestionIds.length : 0,
      processingTimeMs: processingTime,
      usage: { inputTokens, outputTokens, totalTokens, estimatedCostUsd: estimatedCost, model },
      batchId,
    };
  },
});

// Generate taxonomy using OpenAI
export const generateCategoryTaxonomy = action({
  args: {
    clerkUserId: v.string(),
    categoryCount: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const model = args.model || DEFAULT_MODEL;
    const targetCount = args.categoryCount || 15;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ConvexError("OPENAI_API_KEY not configured");

    const user = await ctx.runQuery(internal.users.getUserByClerkId, {
      clerkUserId: args.clerkUserId,
    });
    if (!user) throw new ConvexError("User not found");

    const allRepos = await ctx.runQuery(internal.claudeAi.sampleRepositories, {
      userId: user._id,
      limit: 60,
    });

    if (allRepos.length === 0) throw new ConvexError("No repositories to analyze");

    const existingCategories = await ctx.runQuery(
      internal.claudeAi.getUserCategoryNames,
      { userId: user._id }
    );

    const repoSummaries = allRepos.map((r: any) => ({
      name: r.name,
      description: r.description || "No description",
      language: r.language || "Unknown",
      topics: r.topics?.slice(0, 5) || [],
      stars: r.stargazersCount,
    }));

    const prompt = `Analyze these ${repoSummaries.length} GitHub starred repos and propose a taxonomy of ${targetCount} categories.

Requirements:
1. Broad enough to cover most repos, specific enough to be useful
2. Consider: domain (AI/ML, Web Dev, DevOps, Data), purpose (tool, library, framework, learning)
3. Each needs: name, description, hex color, Feather icon name
4. Aim for ${targetCount} categories (8-25 range)
${existingCategories.length > 0 ? `5. Consider existing: ${existingCategories.join(", ")}` : ""}

Repositories:
${JSON.stringify(repoSummaries, null, 2)}

Respond ONLY with valid JSON:
{"categories":[{"name":"Name","description":"What belongs","color":"#hex","icon":"feather-icon","examples":["repo1","repo2"]}],"reasoning":"Brief approach"}`;

    const response = await fetch(OPENAI_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 4096,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ConvexError(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const responseData = await response.json();
    const content = responseData.choices?.[0]?.message?.content || "";
    const inputTokens = responseData.usage?.prompt_tokens || 0;
    const outputTokens = responseData.usage?.completion_tokens || 0;

    let jsonStr = content.trim();
    if (jsonStr.includes("```json")) {
      const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    } else if (jsonStr.includes("```")) {
      const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }

    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) throw new ConvexError("No JSON object in response");

    const parsed = JSON.parse(objectMatch[0]);

    await ctx.runMutation(internal.claudeAi.recordAiUsage, {
      userId: user._id,
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: calculateCost(model, inputTokens, outputTokens),
      requestType: "categorization",
    });

    return {
      categories: parsed.categories || [],
      reasoning: parsed.reasoning || "",
      usage: { inputTokens, outputTokens },
    };
  },
});

// Test OpenAI connection
export const testOpenAIConnection = action({
  args: { model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const model = args.model || DEFAULT_MODEL;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { success: false, message: "OPENAI_API_KEY not configured" };
    }

    try {
      const response = await fetch(OPENAI_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with only: Connection successful" }],
          max_completion_tokens: 50,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, message: `API error: ${response.status} - ${error}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      return {
        success: true,
        message: `Connected to ${model}`,
        response: content.trim(),
        usage: data.usage,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
