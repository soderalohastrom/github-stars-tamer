# GitHub Stars Organizer Production-Ready Implementation Plan

## 1. Executive Summary - High-level overview of changes
This plan upgrades the existing Expo Router + Convex + Clerk app to production readiness while preserving the current schema and category hierarchy. The work focuses on five pillars: GitHub OAuth via Clerk (replacing PATs), cloud AI categorization via Claude, advanced search and filters, shareable lists with export, and web-first deployment optimizations. Mobile compatibility, existing undo/redo behavior, and the current Convex tables remain intact.

## 2. Phase 1: GitHub OAuth Integration (foundation)
- Configure Clerk to use GitHub OAuth as the primary sign-in with `repo` and `user:email` scopes, plus dev/prod redirect URLs.
- Update frontend sign-in and `UserInitializer` to read `user.externalAccounts` and send the GitHub external account ID to Convex.
- Add Convex server action to fetch GitHub access tokens via Clerk Backend API and store token + expiry in `users`.
- Update GitHub sync to use stored OAuth tokens; refresh on 401 or nearing expiry.
- Remove manual PAT entry UI (`GitHubConnectionCard`) and any token storage in `src/utils/storage.ts`.
- Add reconnection UX for revoked or missing GitHub external accounts.

## 3. Phase 2: Cloud AI Categorization (core feature)
- Replace Ollama logic in `convex/ai.ts` with Claude API calls via Convex HTTP actions using `ANTHROPIC_API_KEY`.
- Build prompts that include repo name, description, topics, language, stars, and optional README excerpt.
- Fetch README content from GitHub with caching (`readmeSha` or ETag); store a truncated `readmeExcerpt`.
- Batch categorize 5-10 repos per call; queue jobs in `aiProcessingJobs` and persist results to `aiCategorizationSuggestions`.
- Add confidence scoring and reasoning per suggestion; auto-apply above threshold in `aiSettings`.
- Record usage metrics per request in `aiUsage` for cost monitoring.
- UI updates: suggestions list with confidence + reasoning, batch progress, and settings for model/batch/threshold.

## 4. Phase 3: Advanced Search & Filters (discoverability)
- Add Convex search index on `repositories.searchText` (name, description, topics, owner, readmeExcerpt).
- Create `search.searchRepositories` query supporting filters: language, category, star range, fork, archived.
- Add sort options (stars, recently starred, recently updated, name) with supporting indexes.
- Store `savedFilters` for smart collections; expose CRUD and pinning.
- Update search history with query + filters for autocomplete and recent searches.
- Implement debounced search UI with filter chips and quick-apply saved filters.

## 5. Phase 4: Lists & Export (sharing/portability)
- Create `lists` and `listRepositories` tables for user-defined lists and many-to-many membership.
- Add list management UI: create/edit/delete list, add/remove repos, list detail view.
- Export lists to Markdown (GitHub README style) and JSON for backup/import.
- Public sharing: unique `shareId` URL with read-only list view.
- Optional import from GitHub Lists API if available; map to internal lists and track in sync history.

## 6. Phase 5: Web Deployment (release)
- Audit layouts for desktop responsiveness and keyboard navigation.
- Ensure web-safe components and avoid native-only APIs in shared screens.
- Add meta tags and OpenGraph data via `expo-router` `Head` and `app.json` web config.
- Add Vercel/Netlify deployment config (build command, output dir, SPA rewrites).
- Validate OAuth redirect URLs and production domains in Clerk.

## 7. Database Schema Changes - New tables and modifications
### New tables
- `savedFilters`: userId, name, query, filters, sort, isPinned, lastUsedAt, createdAt.
- `lists`: ownerId, name, description, visibility, shareId, createdAt, updatedAt.
- `listRepositories`: listId, repositoryId, addedAt, addedBy.
- `aiUsage`: userId, jobId, model, inputTokens, outputTokens, costUsd, createdAt, providerRequestId.

### Modified tables
- `users`: add `githubExternalAccountId`, `githubAccessToken`, `githubTokenExpiresAt`, `githubScopes`, `githubLogin`, `githubEmail`, `githubTokenLastFetchedAt`.
- `repositories`: add `searchText`, `readmeExcerpt`, `readmeSha`, `readmeFetchedAt`, `starredAt`, `lastPushedAt` as needed.
- `aiCategorizationSuggestions`: add `confidence`, `reasoning`, `model`, `promptVersion`, `batchId`, `autoAppliedAt`.
- `aiSettings`: add `autoApplyConfidenceThreshold`, `batchSize`, `includeReadme`, `model`.
- `aiProcessingJobs`: add `status`, `repoIds`, `startedAt`, `completedAt`, `error`, `usageId`.
- `searchHistory`: add `filters`, `sort`, `resultsCount`, `lastUsedAt`.

### Indexes
- `repositories` search index on `searchText`; indexes on `language`, `archived`, `fork`, `stargazersCount`, `starredAt`, `updatedAt`.
- `repositoryCategories` index on `(categoryId, repositoryId)` for filter joins.
- `listRepositories` indexes on `(listId, repositoryId)` and `(repositoryId, listId)`.
- `savedFilters` index on `(userId, lastUsedAt)`.

## 8. API/Backend Changes - New Convex functions
- Auth/token
  - `users.linkGithubExternalAccount` (mutation) to store external account data.
  - `users.refreshGithubAccessToken` (action) to fetch token from Clerk Backend API.
  - `users.ensureGithubToken` (internal action) for sync-time refresh.
- Sync
  - Update `sync.syncStarredRepositories` to use OAuth token; retry on 401 with refresh.
  - `sync.fetchReadmeIfNeeded` (action) to cache README excerpts.
- AI
  - `ai.requestCategorizationJob` (mutation) and `ai.processCategorizationJob` (action).
  - `ai.applySuggestions` (mutation) to apply or auto-apply with history.
  - `aiUsage.record` (internal mutation) for cost tracking.
- Search
  - `search.searchRepositories` (query) and `search.saveFilter`/`search.listFilters`/`search.deleteFilter`.
  - `searchHistory.record` (mutation) to support autocomplete.
- Lists/export
  - `lists.create`/`lists.update`/`lists.delete`/`lists.addRepository`/`lists.removeRepository`.
  - `lists.getPublicByShareId` (query) for read-only share views.
  - `lists.exportMarkdown`/`lists.exportJson` (actions) for exports.
  - `lists.importFromGithubLists` (action) gated behind feature flag.

## 9. Frontend Changes - Component updates and new screens
- Auth
  - Replace `GitHubConnectionCard` with GitHub OAuth status card and reconnect CTA.
  - Update `UserInitializer` to link external account and trigger token refresh.
- AI
  - Suggestions panel with confidence and reasoning; batch progress UI.
  - Settings UI for model/batch size/auto-apply threshold.
- Search
  - Search bar with debounce, filter modal, sort menu, saved filters list.
  - Autocomplete dropdown from search history.
- Lists
  - Lists index screen and list detail screen with share/export actions.
  - Public list route for `shareId` with read-only UI.
- Web
  - Desktop spacing and multi-column layout tweaks.
  - Meta tags via `Head`, plus web-specific share cards.

## 10. Environment & Configuration - Clerk, Convex, deployment
- Clerk Dashboard
  - Enable GitHub OAuth, set `repo` + `user:email` scopes.
  - Configure redirect URLs for dev and prod; set allowed origins.
- Convex Environment
  - Add `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CLERK_SECRET_KEY`, and `PUBLIC_WEB_URL`.
- Expo/App
  - Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
  - Configure `app.json` `scheme`, `web` metadata, and favicon.
- Deployment (Vercel/Netlify)
  - Add config for SPA rewrites and static export output.
  - Verify Clerk redirect URLs after deployment.

## 11. Testing Strategy - Key test scenarios
- OAuth: sign-in, token storage, token refresh, revoked token recovery.
- Sync: initial sync, incremental sync, README caching, rate limit handling.
- AI: batch processing, prompt parsing, confidence threshold auto-apply, undo/redo.
- Search: full-text relevance, filters intersection, sorting, saved filters CRUD.
- Lists/export: create/edit/delete, share link access control, Markdown/JSON export.
- Web: responsive layout, SEO tags, OAuth redirect on production domain.

## 12. Parallelization Map - What can be built concurrently
- Stream A: OAuth integration (Clerk config, token flow, sync updates, UI changes).
- Stream B: AI migration (Claude actions, prompt design, settings UI, usage tracking).
- Stream C: Search & filters (schema/indexes, backend search, UI filters).
- Stream D: Lists & export (schema, CRUD, public route, export/import).
- Stream E: Web deployment (meta tags, responsive design, deployment config).
- Dependencies: Stream A needed before reliable sync/AI; Streams B/C/D can build after schema updates; Stream E can run in parallel but finalize after A-D.

## 13. Risks & Mitigations
- OAuth token expiry or revoked access: refresh on-demand via Clerk, surface reconnect CTA.
- GitHub rate limits: keep throttling, cache README with ETags, limit parallel requests.
- AI cost spikes: enforce batch size, truncate README input, track cost per job, feature flag.
- Search performance: use Convex search indexes and pagination, avoid heavy joins.
- Data backfill delays: run incremental backfills for `searchText` and `readmeExcerpt`.
- Public list privacy: validate `visibility` server-side and avoid exposing user IDs or private data.
