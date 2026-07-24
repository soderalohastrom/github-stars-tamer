/* global chrome, StarShelfCategorizer, StarShelfStorage */
import "./categorizer.js";
import "./storage.js";

const API_URL = "https://api.github.com/user/starred";

function publicState(data) {
  return { repositories: data.repositories, sync: data.sync, tokenConfigured: Boolean(data.settings.githubToken) };
}

function normalizeRepository(item) {
  const repo = item.repo || item;
  const normalized = {
    id: String(repo.id), name: repo.name || "Untitled repository", fullName: repo.full_name || repo.name || "Unknown repository",
    description: repo.description || "", language: repo.language || "", topics: Array.isArray(repo.topics) ? repo.topics : [],
    url: repo.html_url, owner: repo.owner?.login || "", stars: Number(repo.stargazers_count) || 0, forks: Number(repo.forks_count) || 0,
    updatedAt: repo.updated_at || null, starredAt: item.starred_at || repo.pushed_at || repo.updated_at || null
  };
  return { ...normalized, category: StarShelfCategorizer.categorize(normalized) };
}

function readableApiError(response, payload) {
  const reset = response.headers.get("x-ratelimit-reset");
  if (response.status === 401) return "GitHub rejected this token. Check it in Settings and try again.";
  if (response.status === 403 || response.status === 429) {
    const when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "later";
    return `GitHub rate limit reached. Try again ${reset ? `after ${when}` : when}.`;
  }
  return payload?.message ? `GitHub: ${payload.message}` : `GitHub request failed (${response.status}).`;
}

async function importStarredRepositories() {
  const current = await StarShelfStorage.getAll();
  const token = current.settings.githubToken.trim();
  if (!token) {
    const message = "Add a GitHub personal access token in Settings before importing.";
    await StarShelfStorage.setSync({ state: "error", message, error: message });
    throw new Error(message);
  }
  await StarShelfStorage.setSync({ state: "syncing", message: "Connecting to GitHub…", error: null });
  const repositories = [];
  let page = 1;
  let etag = null;
  try {
    while (true) {
      await StarShelfStorage.setSync({ state: "syncing", message: `Importing starred repositories (page ${page})…`, error: null });
      const headers = { Accept: "application/vnd.github.star+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" };
      // An ETag represents only the first page; applying it to later pages would be incorrect.
      if (page === 1 && current.sync.etag) headers["If-None-Match"] = current.sync.etag;
      const response = await fetch(`${API_URL}?per_page=100&page=${page}`, { headers });
      if (response.status === 304) {
        await StarShelfStorage.setSync({ state: "success", lastSyncedAt: new Date().toISOString(), message: "Everything is already up to date.", error: null });
        return { count: current.repositories.length, unchanged: true };
      }
      if (!response.ok) {
        let payload = null;
        try { payload = await response.json(); } catch (_) { /* no JSON body */ }
        throw new Error(readableApiError(response, payload));
      }
      if (page === 1) etag = response.headers.get("etag");
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error("GitHub returned an unexpected response. Please try again.");
      repositories.push(...items.map(normalizeRepository));
      if (items.length < 100) break;
      page += 1;
    }
    await chrome.storage.local.set({
      repositories,
      sync: { state: "success", lastSyncedAt: new Date().toISOString(), etag, message: `Imported ${repositories.length} starred ${repositories.length === 1 ? "repository" : "repositories"}.`, error: null }
    });
    return { count: repositories.length, unchanged: false };
  } catch (error) {
    await StarShelfStorage.setSync({ state: "error", message: error.message || "Import failed.", error: error.message || "Import failed." });
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "getState") return publicState(await StarShelfStorage.getAll());
    if (message?.type === "importStarred") return importStarredRepositories();
    if (message?.type === "openOptions") { await chrome.runtime.openOptionsPage(); return { opened: true }; }
    if (message?.type === "clearLocalData") {
      const current = await StarShelfStorage.getAll();
      await chrome.storage.local.set({ repositories: [], sync: { ...StarShelfStorage.defaults.sync, message: "Local repository data cleared." }, settings: current.settings });
      return { cleared: true };
    }
    throw new Error("Unknown request.");
  })().then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({ ok: false, error: error.message || "Something went wrong." }));
  return true;
});
