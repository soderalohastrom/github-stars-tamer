# Privacy notes

Star Shelf stores your library and GitHub connection metadata in its Convex deployment. GitHub access tokens are kept server-side and are used only to read and update the GitHub account actions you explicitly request. They are not included in profile responses or sent to the browser.

When AI organization is enabled, Star Shelf sends repository metadata (name, description, language, topics, and optionally a bounded README excerpt) to the configured AI provider. Cloudflare Workers AI is the default provider. Suggestions are returned for your review and are not applied automatically.

The Chrome extension is separate: it stores the GitHub token you provide in Chrome's local extension storage and calls GitHub directly. The extension's local categorizer does not upload repository data. Review every permission and token scope before installing an unpacked or store build.

To revoke access, disconnect GitHub in Star Shelf and revoke the GitHub authorization or token in GitHub settings. Operators should publish a retention policy for their Convex and Cloudflare accounts before inviting other users.
