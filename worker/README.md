# GitHub Stars Categorizer Worker

A small Cloudflare Worker that categorizes batches of public GitHub repository metadata for the app's Convex backend. It uses the native Workers AI binding and has no provider API token, database, or deprecated `@cloudflare/ai` dependency.

## Canonical API contract

`POST /v1/categorize` accepts one to ten repositories. The request must be JSON and no more than 48 KiB.

```json
{
  "model": "@cf/meta/llama-3.1-8b-instruct-fast",
  "repositories": [
    {
      "id": "repo_123",
      "name": "workers-sdk",
      "fullName": "cloudflare/workers-sdk",
      "description": "Tools for building Cloudflare Workers",
      "language": "TypeScript",
      "topics": ["cloudflare", "workers"],
      "stars": 3400,
      "readmeExcerpt": "Build and deploy Workers..."
    }
  ],
  "existingCategories": ["Developer Tools", "Cloud Infrastructure"],
  "includeReadme": true
}
```

The top-level fields are `model?`, `repositories`, `existingCategories`, `includeReadme`, and `test?`. Repository fields are exactly `id`, `name`, `fullName`, `description`, `language`, `topics`, `stars`, and optional `readmeExcerpt`. Unknown fields, duplicate repository IDs/names, malformed GitHub full names, invalid counts, oversized strings, or missing required fields receive a `400` before inference.

The response contains exactly one suggestion per requested repository:

```json
{
  "suggestions": [
    {
      "repoId": "repo_123",
      "category": "Developer Tools",
      "confidence": 0.94,
      "reasoning": "The repository provides tooling for building and deploying software.",
      "isNewCategory": false
    }
  ],
  "usage": {
    "inputTokens": 80,
    "outputTokens": 24
  },
  "requestId": "..."
}
```

The model is explicitly instructed to prefer an appropriate `existingCategories` value byte-for-byte. The Worker also normalizes a unique case-insensitive match back to the exact existing category. When no category fits, the model may propose a concise new category and optional `#RRGGBB` color/icon hints.

For a connection test, send `test:true` with empty `repositories`, empty `existingCategories`, and `includeReadme:false`. This performs a minimal deterministic Workers AI JSON health check and returns a valid empty `suggestions` array.

`GET /healthz` reports service configuration health. `GET /v1/info` exposes the canonical contract version, limits, model, authentication mode, and test instructions. Neither endpoint consumes AI inference.

## Run and deploy

```bash
cd worker
npm install
npm run typecheck
npm test
npm run dev       # Uses --remote because inference runs on Cloudflare
npm run deploy
```

Authenticate Wrangler with `npx wrangler login` before remote development or deployment. The `AI` binding is declared in `wrangler.jsonc`; do not add Cloudflare credentials to this repository. The default model is `@cf/meta/llama-3.1-8b-instruct-fast`. A valid `model` request field overrides it.

## Optional service authentication

Production deployments should protect categorization with the same secret configured as `CLOUDFLARE_AI_SERVICE_TOKEN` in Convex:

```bash
cd worker
npx wrangler secret put SERVICE_TOKEN
```

When `SERVICE_TOKEN` is configured, `POST /v1/categorize` requires `Authorization: Bearer <token>`. Token comparison hashes both values before comparing all digest bytes. The public health/info endpoints remain unauthenticated and reveal only whether bearer authentication is enabled. Never put the token in `wrangler.jsonc`, `.dev.vars`, logs, URLs, or source control.

## Browser access and CORS

By default no browser origin is granted cross-origin access. Set these non-secret Wrangler variables per deployment:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://app.example.com,https://staging.example.com",
  "ALLOWED_EXTENSION_ORIGINS": "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"
}
```

Exact Chrome extension origins are required. Preflights allow `Authorization` and `Content-Type`; credentials/cookies are not used.

## Caching, reliability, and fair use

Successful classifications are cached internally for 24 hours under a SHA-256 key covering the complete normalized semantic payload: contract version, resolved model, repositories, existing categories, `includeReadme`, and test mode. The service token is intentionally never part of the key or cached data. Test requests and all errors bypass caching. Endpoint responses use `Cache-Control: no-store` because ordinary caches cannot safely distinguish POST bodies; only the synthetic hashed Cache API entry is cacheable. A fresh `requestId` is added after every cache lookup.

The Worker requests JSON Schema output at temperature `0`, extracts JSON defensively, and validates repository coverage, duplicate IDs, field lengths, confidence bounds, exact category semantics, colors, and icons before returning it. Upstream Workers AI throttling becomes `429 rate_limited` with `Retry-After: 30`; malformed output and transient AI failures use retry-safe `502`/`503` responses.

This is a fair-use service, not a no-limit inference proxy. Strict batches/body limits and caching reduce consumption, but the Worker does not claim a durable per-client quota. Add a Cloudflare WAF Rate Limiting rule before broad public exposure. Workers AI free allocation, model pricing, availability, and throttling are account/model dependent; verify the current [Workers AI pricing documentation](https://developers.cloudflare.com/workers-ai/platform/pricing/) before production traffic.

## Error shape

```json
{
  "error": {
    "code": "invalid_request",
    "message": "repositories[0] does not match the canonical repository schema.",
    "requestId": "..."
  }
}
```

Common statuses are `400` invalid schema/JSON, `401` invalid service token, `403` disallowed browser origin, `413` over 48 KiB, `415` wrong content type, `429` upstream throttle, `502` invalid/unavailable model response, and `503` temporary Workers AI rejection.
