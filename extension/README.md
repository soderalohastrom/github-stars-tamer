# Star Shelf for GitHub

A self-contained Chrome Manifest V3 companion extension for organizing GitHub stars. It imports a user's starred repositories on demand, categorizes them locally with deterministic keyword rules, and adds a subtle category hint to GitHub repository pages.

## Install locally

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this `extension/` directory.
3. Open the extension, select the settings cog, add a GitHub personal access token, and choose **Save & sync**.

Use a fine-grained personal access token with the minimum **Starring: read-only** permission. Add repository metadata access only if your private stars require it. Classic tokens are supported by GitHub but are broader than necessary. Create tokens only from GitHub's official settings page and revoke them there when no longer needed.

## Privacy and permissions

- `storage` is used solely for the GitHub token, synced repository metadata, and sync status in `chrome.storage.local`.
- `https://api.github.com/*` is used only for GitHub REST calls that import the signed-in token owner's stars.
- The GitHub content script runs on `https://github.com/*` so it can show a locally generated category chip on repository pages. It does not make network requests or read/send credentials.
- There is no backend, analytics, tracking, or telemetry. Nothing is sent anywhere other than GitHub's API when the user explicitly syncs.

## Architecture

- `service-worker.js`: GitHub REST pagination, ETag revalidation, status/error handling, and message API.
- `categorizer.js`: deterministic, offline category rules shared by the popup, worker, and GitHub page hint.
- `popup.*`: compact searchable dashboard for imported repositories.
- `options.*`: token entry, local-data controls, and privacy disclosure.
- `content.js`: adds `Star Shelf · <category>` to GitHub repository headers and opens settings on click.

## Limitations

The categorizer is intentionally heuristic: it infers a category from a repository's name, description, language, and topics. GitHub's starred-repository API does not always return topics for every repository, so classification should be treated as an assistive label, not a source of truth. A sync needs an active network connection and is subject to GitHub's API rate limits; the extension surfaces token, API, and rate-limit errors in the UI.
