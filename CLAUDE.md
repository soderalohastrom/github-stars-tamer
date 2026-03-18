# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## No Tests

This project currently has no test files. Consider adding tests if modifying critical functionality.
