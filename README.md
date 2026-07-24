# Star Shelf

Star Shelf turns a long GitHub Stars list into a calm, searchable library. Sync starred repositories, sort them into user-controlled categories, and review LLM suggestions before anything changes.

The web app is free to use. Cloudflare Workers AI is the default categorization provider; paid model keys are optional. AI suggestions are never applied without review.

## What ships

- GitHub OAuth through Clerk and secure server-side token storage
- Incremental GitHub star sync with rate-limit and refresh handling
- Nested categories, search, saved filters, notes, and export
- Reviewable AI suggestions with undo support
- Responsive Expo web app plus a Manifest V3 Chrome companion
- Cloudflare Worker AI gateway with validation, caching, CORS, and fair-use controls

## Stack

Expo SDK 55 / React Native Web · Expo Router · Clerk · Convex · GitHub REST API · Cloudflare Workers AI.

## Local setup

Requirements: Node 20.19+, npm 11, a Clerk application, and a Convex deployment.

```bash
npm install
cp .env.example .env
npm run web
```

Set these public variables in `.env`:

```env
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Run Convex separately while developing:

```bash
npx convex dev
```

In Clerk, enable GitHub OAuth and configure the callback URLs for your web and native app schemes. Convex production variables are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

Useful commands:

```bash
npm run typecheck
npm test
npm run web:build
npm run verify
```

## Cloudflare AI gateway

The `worker/` package is the free edge AI gateway. It accepts repository metadata, calls `env.AI`, and returns strict, reviewable category suggestions. Deploy it with Wrangler after setting the Worker URL and optional service token in Convex:

```bash
cd worker
npm install
npm test
npm run deploy
```

Cloudflare's free allocation is shared and resets daily, so the app uses bounded batches, metadata-only prompts, and a fair-use limit. If the allocation is exhausted, manual organization continues to work.

## Chrome extension

The unpacked Manifest V3 extension is in [`extension/`](./extension/). It imports stars using GitHub's REST API, stores a fine-grained read-only token locally, and provides fast local categorization. Load it from `chrome://extensions` with Developer mode enabled. See [`extension/README.md`](./extension/README.md) for token scope and privacy details.

## Security and privacy

Tokens stay server-side in Convex for the web app and are never returned by profile queries. The extension uses a separate user-supplied GitHub token in `chrome.storage.local`; it does not send repository data anywhere unless you explicitly use an external integration. Read [PRIVACY.md](./PRIVACY.md) and [SECURITY.md](./.github/SECURITY.md) before deploying publicly.

## Deployment

The included GitHub Actions validate type safety, tests, web export, CodeQL, dependency review, and dependency updates. Add the required repository secrets, then use the Cloudflare Pages and Worker workflows. The complete runbook is [DEPLOYMENT.md](./DEPLOYMENT.md).

## Project layout

```text
app/          Expo Router screens and responsive web UI
convex/       Authenticated database functions, GitHub sync, AI orchestration
worker/       Cloudflare Workers AI gateway
extension/    Chrome Manifest V3 companion
src/          Shared UI components and client utilities
public/       SPA rewrites, headers, and robots.txt
```

Star Shelf is intentionally review-first: the model suggests structure, and the person who owns the stars decides what to keep.
