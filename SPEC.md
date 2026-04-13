# Star Graph — Technical Specification

Companion to `PRD.md`. This document is written so that a future LLM session
can read it and implement the feature without additional context.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Native UI                       │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  Graph    │──▶│  Document    │──▶│  Document      │  │
│  │  View (B) │   │  Reader (C)  │   │  Reader (C)    │  │
│  │           │   │  [[wikilink]]│──▶│  (traversal)   │  │
│  └──────────┘   └──────────────┘   └────────────────┘  │
│       ▲                ▲                                │
│       │                │                                │
│       │         Convex reactive queries                 │
│       │                │                                │
├───────┼────────────────┼────────────────────────────────┤
│       │          Convex Backend                         │
│       │                │                                │
│  ┌────┴────────────────┴───────────────────────────┐    │
│  │              repoKnowledge table                 │    │
│  │  (markdown content + structured cross-refs)      │    │
│  └──────────────────────▲──────────────────────────┘    │
│                         │                               │
│  ┌──────────────────────┴──────────────────────────┐    │
│  │         Knowledge Processing Pipeline (A)        │    │
│  │                                                  │    │
│  │  1. Gather repos from `repositories` table       │    │
│  │  2. Fetch full README via GitHub API             │    │
│  │  3. LLM distillation (Claude/OpenAI/Ollama)     │    │
│  │  4. Store in repoKnowledge                       │    │
│  │  5. Cross-reference pass                         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  Existing infrastructure reused:                        │
│  - convex/readme.ts (README fetching, cleaning)         │
│  - convex/claudeAi.ts, openaiAi.ts (LLM providers)     │
│  - convex/ai.ts (settings, job tracking, usage)         │
│  - aiProcessingJobs table (progress tracking)           │
│  - aiSettings table (provider/model selection)           │
│  - aiUsage table (token/cost tracking)                  │
└─────────────────────────────────────────────────────────┘
```

---

## Component A — LLM Processing & Storage

### New Convex Table: `repoKnowledge`

Add to `convex/schema.ts`:

```typescript
repoKnowledge: defineTable({
  userId: v.id("users"),
  repositoryId: v.id("repositories"),

  // The distilled wiki page (markdown string)
  markdownContent: v.string(),

  // Structured fields (extracted from LLM response for querying/display)
  summary: v.string(),           // 2-4 sentence overview
  keyFeatures: v.array(v.string()), // 3-7 bullet points
  stack: v.object({
    languages: v.array(v.string()),
    keyDeps: v.array(v.string()),
    runtime: v.optional(v.string()),
  }),
  whyNotable: v.array(v.string()), // 1-3 bullets on why this repo matters

  // Cross-references (structured for graph edges)
  crossReferences: v.array(v.object({
    targetRepositoryId: v.id("repositories"),
    reason: v.string(),           // e.g. "both implement OAuth 2.0 PKCE flows"
    edgeType: v.union(
      v.literal("llm_discovered"),  // LLM found a conceptual connection
      v.literal("shared_topic"),    // repos share a GitHub topic
      v.literal("shared_language"), // repos share primary language
      v.literal("same_owner"),      // same GitHub owner/org
    ),
  })),

  // Processing metadata
  processedAt: v.number(),
  readmeSha: v.optional(v.string()), // For delta detection
  readmeLength: v.optional(v.number()),
  processingModel: v.string(),    // e.g. "claude-haiku-4-5"
  processingTokens: v.optional(v.object({
    input: v.number(),
    output: v.number(),
  })),
  processingTimeMs: v.optional(v.number()),

  // Status
  status: v.union(
    v.literal("processed"),
    v.literal("failed"),
    v.literal("no_readme"),       // repo had no README to fetch
  ),
  errorMessage: v.optional(v.string()),
})
  .index("by_user_id", ["userId"])
  .index("by_repository_id", ["repositoryId"])
  .index("by_user_and_repository", ["userId", "repositoryId"])
  .index("by_user_and_status", ["userId", "status"])
  .index("by_user_and_processed_at", ["userId", "processedAt"])
  .searchIndex("search_knowledge", {
    searchField: "markdownContent",
    filterFields: ["userId", "status"],
  }),
```

### New Convex File: `convex/knowledge.ts`

Contains all functions for the knowledge pipeline.

#### Queries

```typescript
// Get all processed knowledge pages for a user
getKnowledgePages: query({ userId })
  → returns repoKnowledge[] joined with repository name/language/stars

// Get a single knowledge page by repository ID
getKnowledgePage: query({ userId, repositoryId })
  → returns repoKnowledge with full markdown + cross-refs

// Get graph data (nodes + edges) for visualization
getGraphData: query({ userId })
  → returns { nodes: Node[], edges: Edge[] }
  → Node = { id, repoName, language, stars, status, summary }
  → Edge = { source, target, reason, edgeType }

// Get processing status
getKnowledgeStatus: query({ userId })
  → returns { total, processed, failed, noReadme, unprocessed }

// Search knowledge pages
searchKnowledge: query({ userId, searchText })
  → uses search index on markdownContent
```

#### Actions (external API calls)

```typescript
// Fetch full README content for a repository
// EXTENDS existing readme.ts — reuse cleanMarkdown(), but return full
// content instead of truncated excerpt
fetchFullReadme: action({ repositoryId })
  → GET https://api.github.com/repos/{owner}/{repo}/readme
  → decode base64, return { content, sha, size }
  → uses user's GitHub OAuth token from Clerk

// Process a single repository through the LLM
processRepository: action({ userId, repositoryId })
  → 1. Fetch full README
  → 2. Build distillation prompt (see Prompt Template below)
  → 3. Call configured LLM provider
  → 4. Parse structured JSON response
  → 5. Store in repoKnowledge via internal mutation
  → 6. Record usage in aiUsage table

// Batch process repositories
processBatch: action({ userId, repositoryIds, batchId })
  → processes repos sequentially with rate limiting
  → updates aiProcessingJobs progress after each repo
  → resilient: catches per-repo errors, continues batch

// Cross-reference pass (runs after individual processing)
buildCrossReferences: action({ userId })
  → 1. Load all repoKnowledge for user
  → 2. For each repo, find related repos by:
  →    a. Shared GitHub topics (deterministic, no LLM)
  →    b. Shared primary language (deterministic)
  →    c. Same owner (deterministic)
  →    d. LLM-discovered connections (batch prompt with repo summaries)
  → 3. Update crossReferences array on each repoKnowledge doc
```

#### Mutations

```typescript
// Start a knowledge build job
startKnowledgeBuild: mutation({ userId })
  → creates aiProcessingJobs entry with jobType "knowledge_build"
  → gathers unprocessed repository IDs
  → kicks off processBatch action
  → returns { jobId, totalToProcess }

// Update knowledge build (incremental)
startKnowledgeUpdate: mutation({ userId })
  → finds repos where starredAt > lastProcessedAt or readmeSha changed
  → same flow as startKnowledgeBuild but filtered set

// Store a processed knowledge page (internal)
storeKnowledgePage: internalMutation({ ... })
  → upserts into repoKnowledge table
```

### LLM Prompt Template

Adapted from the craft-wiki starred-repos template. The prompt asks for
structured JSON output rather than markdown — the markdown page is assembled
from the structured fields so we get both queryable data and readable content.

```
You are distilling a GitHub repository into a structured knowledge page for a
developer's personal knowledge base. The developer starred this repo because
they found it interesting or useful. Your job is to extract the essential
information so they can understand the repo at a glance months later.

## Repository Metadata
- **Name:** {fullName}
- **Description:** {description}
- **Language:** {language}
- **Topics:** {topics}
- **Stars:** {stargazersCount}
- **Owner:** {owner.login}
- **Last pushed:** {pushedAt}
- **Archived:** {archived}

## README Content
{readmeContent}

## Instructions

Analyze the repository and return a JSON object with these fields:

1. **summary** (string): 2-4 sentences explaining what this repo does and
   its approach. Written for a developer who will read this months later.
   Be specific — tool names, algorithms, protocols, not marketing language.

2. **keyFeatures** (string[]): 3-7 concrete features or capabilities. Each
   bullet should be specific enough to differentiate this repo from similar
   tools. Include version numbers, performance claims, or notable technical
   details when present in the README.

3. **stack** (object):
   - **languages** (string[]): Programming languages used
   - **keyDeps** (string[]): Notable dependencies, frameworks, or libraries
   - **runtime** (string, optional): Runtime environment if relevant
     (e.g., "Node.js 18+", "Python 3.10+", "Rust nightly")

4. **whyNotable** (string[]): 1-3 bullets on what makes this repo worth
   remembering. What problem does it solve? What approach is distinctive?
   What decision does it inform? Be specific to this repo, not generic.

5. **suggestedRelatedTopics** (string[]): 3-5 topic keywords that could
   connect this repo to other repos in a knowledge graph. Use specific
   technical terms (e.g., "force-directed-graph", "oauth-pkce",
   "convex-backend") rather than generic ones (e.g., "web", "tool").

Return ONLY valid JSON. No markdown fencing, no explanation outside the JSON.

{
  "summary": "...",
  "keyFeatures": ["...", "..."],
  "stack": { "languages": [...], "keyDeps": [...], "runtime": "..." },
  "whyNotable": ["...", "..."],
  "suggestedRelatedTopics": ["...", "..."]
}
```

### Markdown Page Assembly

After the LLM returns structured JSON, the `markdownContent` field is assembled
from the structured fields:

```typescript
function assembleMarkdown(
  repo: Repository,
  knowledge: LLMResponse
): string {
  const lines: string[] = [];
  lines.push(`# ${repo.fullName}`);
  lines.push('');
  lines.push(knowledge.summary);
  lines.push('');
  lines.push(`**Language:** ${repo.language || 'Unknown'} | **Stars:** ${repo.stargazersCount} | **Source:** [GitHub](${repo.htmlUrl})`);
  lines.push('');
  lines.push('## Key Features');
  lines.push('');
  for (const feature of knowledge.keyFeatures) {
    lines.push(`- ${feature}`);
  }
  lines.push('');
  lines.push('## Stack');
  lines.push('');
  lines.push(`- **Languages:** ${knowledge.stack.languages.join(', ')}`);
  lines.push(`- **Key deps:** ${knowledge.stack.keyDeps.join(', ')}`);
  if (knowledge.stack.runtime) {
    lines.push(`- **Runtime:** ${knowledge.stack.runtime}`);
  }
  lines.push('');
  lines.push('## Why Notable');
  lines.push('');
  for (const point of knowledge.whyNotable) {
    lines.push(`- ${point}`);
  }
  lines.push('');
  lines.push('## Related Repos');
  lines.push('');
  // Cross-references are added after the cross-reference pass
  // Each becomes a [[wikilink]] like: - [[owner/repo]] — reason
  lines.push('*Cross-references populated after graph build.*');
  return lines.join('\n');
}
```

After the cross-reference pass, the "Related Repos" section is rewritten:

```typescript
// For each cross-reference:
`- [[${targetRepo.fullName}]] — ${crossRef.reason}`
```

### Delta Processing

**When to re-process a repo:**
1. `starredAt` is newer than the repo's `repoKnowledge.processedAt` (new star)
2. No `repoKnowledge` entry exists for this repo (never processed)
3. `readmeSha` from GitHub API differs from stored `readmeSha` (README changed)

**When NOT to re-process:**
- Repo exists in `repoKnowledge` with status "processed" and SHA matches.
- Repo has status "no_readme" — skip unless user forces re-check.

### Rate Limiting & Performance

- **GitHub API:** 5,000 requests/hour with OAuth token. README fetch = 1
  request per repo. For 500 repos, that's well within limits.
- **LLM calls:** Governed by batch size in `aiSettings` (default 10). Each
  repo is one LLM call. At ~3s/call, 500 repos ≈ 25 minutes.
- **Batching:** Process in waves of `batchSize` repos. Update progress after
  each wave. Allow cancellation between waves.
- **Cost estimate (Claude Haiku):** ~500 input tokens + ~300 output tokens per
  repo. At $1/$5 per million tokens: ~$0.002 per repo. 500 repos ≈ $1.00.

---

## Component B — Graph Visualization

### Data Shape

The `getGraphData` query returns:

```typescript
interface GraphNode {
  id: string;                    // repository._id
  label: string;                 // repo fullName (e.g., "owner/repo")
  language: string | null;       // primary language for color coding
  stars: number;                 // for node size scaling
  status: "processed" | "failed" | "no_readme" | "unprocessed";
  summary: string;               // first sentence for tooltip
  categoryNames: string[];       // from repositoryCategories join
}

interface GraphEdge {
  source: string;                // source repository._id
  target: string;                // target repository._id
  reason: string;                // human-readable connection reason
  edgeType: "llm_discovered" | "shared_topic" | "shared_language" | "same_owner";
}
```

### Visual Encoding

| Property | Maps to |
|----------|---------|
| Node color | Primary language (standard GitHub language colors) |
| Node size | Star count (log scale) |
| Node opacity | 1.0 for processed, 0.4 for unprocessed |
| Edge color | By type: LLM=blue, topic=green, language=gray, owner=orange |
| Edge thickness | LLM edges thicker (more meaningful) than deterministic edges |

### Library Evaluation Criteria

Decide at implementation time. Requirements:

1. **React Native compatible** — must render in iOS/Android, not just web.
2. **Handles 500–2000 nodes** without jank.
3. **Force-directed layout** as default.
4. **Touch interactions:** pinch-to-zoom, pan, tap node.
5. **Node click callback** for navigation.

Candidates to evaluate:

| Library | RN support | Notes |
|---------|-----------|-------|
| react-force-graph (2D) | Via WebView | Web-based, wrap in WebView for RN |
| Reagraph | Web-native | Used in HuiHui; would need WebView wrapper |
| vis-network | Via WebView | Mature, Obsidian itself uses it |
| react-native-graph | Native | Purpose-built for RN, less mature |
| d3-force + SVG | Via react-native-svg | Full control, more work |

**Recommendation:** Start with a WebView-wrapped solution (vis-network or
react-force-graph) for fastest path to Obsidian-like UX. Migrate to a native
renderer if WebView performance is insufficient.

### Interaction Flow

```
Graph View
  ├── Initial render: force-directed layout, all nodes visible
  ├── Pinch to zoom, drag to pan
  ├── Tap node → highlight node + connected edges
  ├── Tap highlighted node again (or tap "View" button) → navigate to Document Reader
  ├── Filter controls: by language, category, edge type
  └── "Build Graph" / "Update Graph" button (triggers Component A pipeline)
```

---

## Component C — Markdown Reader

### Route Structure

```
app/
  graph/
    index.tsx          — Graph view (or tab entry point)
    [repoId].tsx       — Document reader for a single repo
```

Or, if implemented as a tab:

```
app/
  (tabs)/
    graph.tsx          — Graph view tab
  graph/
    [repoId].tsx       — Document reader (pushed from tab)
```

### Wikilink Resolution

The markdown contains `[[owner/repo]]` wikilinks. The renderer must:

1. Detect `[[...]]` patterns in the markdown.
2. Look up the referenced repo by `fullName` in the user's `repositories`
   table.
3. If found and has a `repoKnowledge` entry → render as a tappable link
   that navigates to `graph/[repoId]`.
4. If found but no knowledge entry → render as a dimmed link with
   "(not yet processed)" tooltip.
5. If not found (user unstarred it) → render as plain text with strikethrough.

### Markdown Rendering

The output format is controlled (we assemble it), so the renderer only needs
to handle:

- `#`, `##` headers
- `-` unordered lists
- `**bold**` and `*italic*`
- `[text](url)` external links (open in browser)
- `[[owner/repo]]` wikilinks (in-app navigation)
- `` `inline code` ``
- Basic paragraphs

No need for: tables, images, code blocks, blockquotes, task lists. Keep the
renderer minimal — if using a library, configure it to handle only the above.

### Navigation

```
Document Reader
  ├── Header: repo name + language badge + star count
  ├── "View on GitHub" button → opens htmlUrl in browser
  ├── Markdown body with tappable [[wikilinks]]
  ├── "Related Repos" section at bottom (from crossReferences)
  ├── Back button → returns to previous screen (graph or other doc)
  └── "Back to Graph" floating button → returns to graph view
```

---

## Existing Code to Reuse

| File | What to reuse | How |
|------|--------------|-----|
| `convex/readme.ts` | `cleanMarkdown()`, `truncateReadme()`, GitHub API auth headers | Extend with `fetchFullReadme()` that returns full content + SHA |
| `convex/claudeAi.ts` | `calculateCost()`, Claude API call pattern, `MODEL_PRICING` | Adapt for knowledge distillation prompt (different from categorization prompt) |
| `convex/openaiAi.ts` | OpenAI API call pattern | Same adaptation |
| `convex/ai.ts` | `getAiSettings`, `MODEL_OPTIONS`, `DEFAULT_AI_SETTINGS`, job creation pattern | Extend with "knowledge_build" and "knowledge_update" job types |
| `convex/schema.ts` | `aiProcessingJobs` table shape | Add new `jobType` literals; reuse progress tracking pattern |
| `convex/schema.ts` | `aiUsage` table | Add "knowledge_distillation" to `requestType` union |
| `src/components/AIOrganizeButton.tsx` | Button + progress modal pattern | Adapt for "Build Knowledge Graph" button |
| `src/components/AISuggestionsReview.tsx` | Batch progress UI pattern | Adapt for knowledge build progress |

---

## Schema Modifications to Existing Tables

### `aiProcessingJobs` — add job types

```typescript
// Extend the jobType union:
jobType: v.union(
  v.literal("single_categorize"),
  v.literal("batch_categorize"),
  v.literal("update_primer"),
  v.literal("fetch_readmes"),
  v.literal("knowledge_build"),     // NEW
  v.literal("knowledge_update"),    // NEW
  v.literal("knowledge_crossref"),  // NEW
),
```

### `aiUsage` — add request type

```typescript
// Extend the requestType union:
requestType: v.union(
  v.literal("categorization"),
  v.literal("primer_update"),
  v.literal("readme_summary"),
  v.literal("knowledge_distillation"),  // NEW
  v.literal("knowledge_crossref"),      // NEW
),
```

No other existing tables need modification.

---

## Open Questions (for implementation time)

1. **Graph library choice** — evaluate candidates above against actual RN
   performance. Start with WebView wrapper if unsure.
2. **Cross-reference quality** — the LLM pass for cross-references may
   produce low-quality connections for large collections. Consider a
   confidence threshold and only render edges above it.
3. **Tab vs. button** — whether Star Graph is a permanent 6th tab or a
   feature accessed via button on the repos tab. Depends on how central it
   feels after Phase 1. Start with a button; promote to tab if usage warrants.
4. **Offline access** — should knowledge pages be cached for offline
   reading? Convex offline support is evolving; revisit after Phase 1.
5. **Token budget for large collections** — 2000 repos × ~800 tokens each =
   ~1.6M tokens. At Haiku pricing that's ~$2-3. Document the expected cost
   in the UI before the user triggers the build.

---

## Verification Plan

After implementation, verify:

1. **Processing pipeline:** Star 3 test repos → trigger Build → confirm
   `repoKnowledge` entries appear with correct markdown content.
2. **Delta processing:** Star 1 new repo → trigger Update → confirm only the
   new repo is processed; existing pages unchanged.
3. **Cross-references:** Verify that repos sharing topics/languages get
   deterministic edges, and the LLM pass adds conceptual connections.
4. **Document reader:** Navigate to a knowledge page → confirm markdown
   renders correctly → tap a [[wikilink]] → confirm navigation to linked page.
5. **Graph visualization:** Load graph with 50+ nodes → confirm zoom/pan/tap
   work → tap a node → confirm navigation to document reader.
6. **Cost tracking:** Check `aiUsage` entries after a build → confirm token
   counts and cost estimates are recorded.
7. **Error handling:** Process a repo with no README → confirm it gets
   status "no_readme" and doesn't block the batch.
