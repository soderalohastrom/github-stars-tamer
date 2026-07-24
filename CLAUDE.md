# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Workflow

This project uses specialized AI agents in `.claude/agents/`. For any feature, bug fix, or significant change, **delegate to `@orchestrator`** — it manages the full workflow and returns a concise summary.

### How it works

`@orchestrator` runs the pipeline internally:
1. `@architect` — plans the implementation
2. `@coder` — writes code (no tests, no screenshots)
3. `@tester` — writes/runs tests (loops with coder if failures)
4. `@reviewer` — reviews the final diff for consistency
5. `@design-qa` — screenshots affected pages (UI changes only)

All verbose agent output stays inside the orchestrator's context. You get back a structured summary with: changes made, test results, review findings, and any issues.

### Direct agent access

| Agent | Purpose | Invoke |
|-------|---------|--------|
| **orchestrator** | Full workflow — plan, code, test, review, QA | `@orchestrator` |
| **architect** | Plan only — scope, trade-offs, risks | `@architect` |
| **coder** | Implement only — code + self-review | `@coder` |
| **tester** | Test only — write/run affected tests | `@tester` |
| **reviewer** | Review only — check diff for consistency | `@reviewer` |
| **design-qa** | Visual QA — Playwright screenshots at 375x812 + 1440x900 | `@design-qa` |
| **graph-viz** | Graph visualization — force-directed graph rendering | `@graph-viz` |
| **prompt-engineer** | LLM prompt optimization for distillation pipeline | `@prompt-engineer` |

### When NOT to delegate

- Quick questions about the codebase (just answer directly)
- Reading/explaining code (just read and explain)
- Git operations, deployments, or config changes (handle directly)

## Development Commands

```bash
# Install dependencies
npm install

# Start development (requires two terminals)
npx convex dev     # Terminal 1: Convex backend with hot reload
npm start          # Terminal 2: Expo development server

# Platform-specific
npm run ios        # iOS Simulator
npm run android    # Android Emulator
npm run web        # Web (limited functionality)

# Production
npm run build:ios         # EAS iOS build
npm run build:android     # EAS Android build
npm run build:all         # Both platforms
npm run submit:ios        # App Store submission
npm run submit:android    # Play Store submission
npm run convex:deploy     # Deploy Convex to production
```

## Architecture

React Native Expo Router app with Convex backend and Clerk authentication for organizing GitHub starred repositories.

### Provider Stack (app/_layout.tsx)
```
SafeAreaProvider > GestureHandlerRootView > ClerkProvider > ConvexProviderWithClerk
```
The `UserInitializer` component syncs Clerk user data to Convex on auth changes.

### Route Groups
- `(auth)/` - Welcome, sign-in, sign-up screens
- `(tabs)/` - Main tab navigation (repositories, categories, search, sync, profile)
- `repository/[id]` - Dynamic repository detail screen
- `ai-settings` - AI/Ollama configuration

### Convex Backend (convex/)
- `schema.ts` - Database schema with 9 tables
- `users.ts` - User management, GitHub token storage
- `repositories.ts` - Repository CRUD, search, filtering
- `categories.ts` - Hierarchical category system
- `sync.ts` - GitHub API integration with rate limiting
- `ai.ts` - Ollama-based AI categorization

### Key Data Relationships
- `users` → `repositories` (1:many)
- `users` → `categories` (1:many, supports nesting via `parentCategoryId`)
- `repositories` ↔ `categories` (many:many via `repositoryCategories` join table)
- AI suggestions stored in `aiCategorizationSuggestions`, undo history in `categorizationHistory`

### Path Aliases (tsconfig.json)
```typescript
import { Component } from '@/components/Component';  // → src/components/
import { storage } from '@/utils/storage';           // → src/utils/
```
Available: `@/*`, `@/components/*`, `@/screens/*`, `@/services/*`, `@/types/*`, `@/store/*`, `@/utils/*`

## Environment Variables

```env
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-key
```

Clerk requires:
- JWT template named "convex" in Clerk dashboard
- `CLERK_JWT_ISSUER_DOMAIN` set in Convex dashboard environment variables
- OAuth redirect URLs matching app.json scheme

## Development Gotchas

### Convex
- Use `api.*` references when calling Convex functions within mutations (not direct imports)
- Internal functions use `internalMutation`/`internalQuery`, not public `mutation`/`query`
- Functions auto-deploy on save during `npx convex dev`
- All database queries need null checks - Convex returns `null` for missing records

### Clerk + Convex Integration
- Token sync uses `CrossPlatformStorage` (src/utils/storage.ts) for web compatibility
- `UserInitializer` component handles creating/updating Convex user records from Clerk data
- OAuth scopes required: `public_repo`, `read:user`

### React Native
- Use RN components only (`View`, `Text`) - no web elements
- `GestureHandlerRootView` wrapper required for gesture-based interactions
- Platform-specific code via `Platform.OS` checks

### AI Features
- Ollama endpoint configurable per-user in `aiSettings` table
- AI processing jobs track progress for batch operations
- Undo/redo state stored in `categorizationHistory`

## Tests

- **Framework:** Vitest + convex-test
- **Location:** `convex/__tests__/*.test.ts`
- **Run:** `npm run test` (all) or `npx vitest run convex/__tests__/<file>.test.ts` (specific)
- **Verify script:** `scripts/verify.sh` — finds affected tests via codegraph, runs only those

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
