import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, { extractJsonObject, type AiBinding, type Env } from "../src/index";

const canonicalRequest = {
  model: "@cf/meta/llama-3.1-8b-instruct",
  repositories: [
    {
      id: "repo_123",
      name: "widgets",
      fullName: "acme/widgets",
      description: "A useful developer CLI",
      language: "TypeScript",
      topics: ["cli", "developer-tools"],
      stars: 42,
      readmeExcerpt: "Install this command line tool.",
    },
  ],
  existingCategories: ["Developer Tools", "AI & ML"],
  includeReadme: true,
};

const validModelResponse = {
  response: JSON.stringify({
    suggestions: [
      {
        repoId: "repo_123",
        category: "developer tools",
        confidence: 0.92,
        reasoning: "The repository provides a command-line tool for developers.",
        isNewCategory: false,
      },
    ],
  }),
  usage: { prompt_tokens: 80, completion_tokens: 24 },
};

function makeEnv(response: unknown = validModelResponse): Env & { AI: AiBinding & { run: ReturnType<typeof vi.fn> } } {
  return {
    AI: { run: vi.fn().mockResolvedValue(response) },
    ALLOWED_ORIGINS: "https://app.example.test",
  };
}

function request(body: unknown, init?: RequestInit): Request {
  return new Request("https://api.example.test/v1/categorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
    ...init,
  });
}

const ctx = { waitUntil: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("caches", {
    default: {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe("POST /v1/categorize", () => {
  it("implements the canonical Convex contract and prefers an exact existing category", async () => {
    const env = makeEnv();
    const response = await worker.fetch(request(canonicalRequest), env, ctx);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      suggestions: [
        {
          repoId: "repo_123",
          category: "Developer Tools",
          confidence: 0.92,
          reasoning: "The repository provides a command-line tool for developers.",
          isNewCategory: false,
        },
      ],
      usage: { inputTokens: 80, outputTokens: 24 },
      requestId: expect.any(String),
    });
    expect(env.AI.run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct",
      expect.objectContaining({ temperature: 0, top_p: 1, response_format: expect.any(Object) }),
    );
    expect(ctx.waitUntil).toHaveBeenCalledOnce();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("allows a concise new category and preserves valid presentation hints", async () => {
    const env = makeEnv({
      response: JSON.stringify({
        suggestions: [
          {
            repoId: "repo_123",
            category: "Terminal UX",
            confidence: 0.81,
            reasoning: "The project focuses on terminal interaction design.",
            isNewCategory: true,
            suggestedColor: "#3366FF",
            suggestedIcon: "terminal",
          },
        ],
      }),
    });
    const response = await worker.fetch(request(canonicalRequest), env, ctx);
    expect(await response.json()).toMatchObject({
      suggestions: [
        {
          category: "Terminal UX",
          isNewCategory: true,
          suggestedColor: "#3366FF",
          suggestedIcon: "terminal",
        },
      ],
    });
  });

  it("uses test:true with an empty batch for a real minimal model check", async () => {
    const env = makeEnv({ response: '{"ok":true}', usage: { input_tokens: 7, output_tokens: 3 } });
    const response = await worker.fetch(
      request({ repositories: [], existingCategories: [], includeReadme: false, test: true }),
      env,
      ctx,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      suggestions: [],
      usage: { inputTokens: 7, outputTokens: 3 },
      requestId: expect.any(String),
    });
    expect(env.AI.run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      expect.objectContaining({ max_tokens: 20, temperature: 0 }),
    );
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(response.headers.get("X-Cache")).toBe("BYPASS");
  });

  it("rejects the previous snake_case contract before inference", async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      request({ repositories: [{ full_name: "acme/widgets" }], existingCategories: [], includeReadme: false }),
      env,
      ctx,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it("maps upstream AI rate limiting to a clear retriable response", async () => {
    const env = makeEnv();
    env.AI.run.mockRejectedValue(new Error("7505 rate limit"));
    const response = await worker.fetch(request(canonicalRequest), env, ctx);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect((await response.json()).error.code).toBe("rate_limited");
  });
});

describe("optional service authentication", () => {
  it("requires the configured bearer token and accepts the matching token", async () => {
    const env = { ...makeEnv(), SERVICE_TOKEN: "correct-token" };
    const denied = await worker.fetch(request(canonicalRequest), env, ctx);
    expect(denied.status).toBe(401);
    expect(denied.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(env.AI.run).not.toHaveBeenCalled();

    const allowed = await worker.fetch(
      request(canonicalRequest, { headers: { "Content-Type": "application/json", Authorization: "Bearer correct-token" } }),
      env,
      ctx,
    );
    expect(allowed.status).toBe(200);
    expect(env.AI.run).toHaveBeenCalledOnce();
  });

  it("allows Authorization in CORS preflights without requiring the token on OPTIONS", async () => {
    const env = { ...makeEnv(), SERVICE_TOKEN: "correct-token" };
    const response = await worker.fetch(
      new Request("https://api.example.test/v1/categorize", {
        method: "OPTIONS",
        headers: { Origin: "https://app.example.test" },
      }),
      env,
      ctx,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});

describe("API helpers and public endpoints", () => {
  it("extracts a JSON object safely from a fenced model response", () => {
    expect(extractJsonObject('Here is JSON: {"message":"a } brace", "ok":true} trailing')).toBe(
      '{"message":"a } brace", "ok":true}',
    );
  });

  it("serves health/info and allows only configured browser origins", async () => {
    const env = makeEnv();
    const allowed = await worker.fetch(
      new Request("https://api.example.test/healthz", { headers: { Origin: "https://app.example.test" } }),
      env,
      ctx,
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");

    const info = await worker.fetch(new Request("https://api.example.test/v1/info"), env, ctx);
    expect(await info.json()).toMatchObject({
      contractVersion: "convex-categorize-v1",
      endpoint: { path: "/v1/categorize" },
    });

    const denied = await worker.fetch(
      new Request("https://api.example.test/healthz", { headers: { Origin: "https://evil.example" } }),
      env,
      ctx,
    );
    expect(denied.status).toBe(403);
  });
});
