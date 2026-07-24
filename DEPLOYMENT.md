# Deployment runbook

## 1. Clerk and Convex

1. Create a Clerk application and enable GitHub OAuth.
2. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex to the Clerk issuer domain.
3. Deploy Convex with `npx convex deploy`.
4. Set `CLERK_SECRET_KEY` and `EXPO_PUBLIC_CONVEX_URL` in the appropriate environments.

The Convex functions require an authenticated Clerk identity. Public list sharing is the only intentionally anonymous read path.

## 2. Cloudflare Worker

From `worker/`, authenticate Wrangler and deploy:

```bash
npm install
npm test
npx wrangler secret put SERVICE_TOKEN
npm run deploy
```

Set these Convex environment variables:

```text
CLOUDFLARE_AI_WORKER_URL=https://your-worker.your-subdomain.workers.dev
CLOUDFLARE_AI_SERVICE_TOKEN=the-same-token
```

The token is optional for a private deployment but recommended for a public Worker. Keep the Worker URL and service token out of client bundles.

## 3. Web export

Build with the same public variables used by the deployed Convex and Clerk environments:

```bash
EXPO_PUBLIC_CONVEX_URL=https://... \
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
npm run web:build
```

Deploy `dist/` to Cloudflare Pages (or another static host). The included `public/_redirects` keeps Expo Router deep links working and `public/_headers` supplies baseline browser security headers.

## 4. GitHub Actions

Configure repository secrets for Pages and Worker deployment before enabling those workflows. CI does not require production credentials; it runs `npm ci`, typecheck, tests, and a web export. Dependabot covers both the root app and `worker/`.

## 5. Chrome Web Store

The extension can be loaded unpacked immediately. For publishing, review the permissions and data disclosure in `extension/README.md`, replace the placeholder web app URL, create production icons, and submit the privacy policy URL. Use a fine-grained GitHub token with only the Starring read permission for the current manual-token flow.

## Release checks

```bash
npm run verify
cd worker && npm test
```

Do not deploy a Worker without setting a rate limit and service token. Cloudflare's free AI allocation is shared and bounded; a failed AI request must leave manual categorization available.
