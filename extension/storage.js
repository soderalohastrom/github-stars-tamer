/* global chrome, globalThis */
(function attachStorage() {
  const KEYS = {
    repositories: "repositories",
    settings: "settings",
    sync: "sync"
  };

  const defaults = {
    settings: { githubToken: "" },
    repositories: [],
    sync: { state: "idle", lastSyncedAt: null, etag: null, message: "Not synced yet." }
  };

  async function getAll() {
    const stored = await chrome.storage.local.get(Object.values(KEYS));
    return {
      settings: { ...defaults.settings, ...(stored.settings || {}) },
      repositories: Array.isArray(stored.repositories) ? stored.repositories : [],
      sync: { ...defaults.sync, ...(stored.sync || {}) }
    };
  }

  async function setSync(sync) {
    const current = await getAll();
    await chrome.storage.local.set({ sync: { ...current.sync, ...sync } });
  }

  globalThis.StarShelfStorage = { KEYS, defaults, getAll, setSync };
})();
