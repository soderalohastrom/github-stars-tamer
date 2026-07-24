/* global chrome, StarShelfStorage */
const $ = (selector) => document.querySelector(selector);

function send(message) {
  return new Promise((resolve, reject) => chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
    response?.ok ? resolve(response.result) : reject(new Error(response?.error || "Request failed."));
  }));
}

function status(message, type = "") { const node = $("#status"); node.textContent = message; node.className = `status ${type}`; }

async function saveToken() {
  const token = $("#token").value.trim();
  await chrome.storage.local.set({ settings: { githubToken: token } });
  status(token ? "Token saved locally." : "Token removed. Star Shelf is disconnected.", "success");
}

document.addEventListener("DOMContentLoaded", async () => {
  const initial = await StarShelfStorage.getAll();
  $("#token").value = initial.settings.githubToken || "";
  if (initial.sync.lastSyncedAt) status(`Last sync: ${new Date(initial.sync.lastSyncedAt).toLocaleString()}.`, "success");
  $("#reveal-token").addEventListener("click", () => {
    const input = $("#token"); const revealing = input.type === "password";
    input.type = revealing ? "text" : "password";
    $("#reveal-token").textContent = revealing ? "Hide" : "Show";
    $("#reveal-token").setAttribute("aria-pressed", String(revealing));
  });
  $("#save-button").addEventListener("click", () => saveToken().catch((error) => status(error.message, "error")));
  $("#sync-button").addEventListener("click", async () => {
    const button = $("#sync-button"); button.disabled = true;
    try { await saveToken(); status("Syncing from GitHub…"); const result = await send({ type: "importStarred" }); status(result.unchanged ? "Everything is already up to date." : `Saved ${result.count} starred repositories.`, "success"); }
    catch (error) { status(error.message, "error"); }
    finally { button.disabled = false; }
  });
  $("#clear-button").addEventListener("click", async () => {
    if (!window.confirm("Clear all imported repository data from this browser? Your GitHub token will remain.")) return;
    try { await send({ type: "clearLocalData" }); status("Imported repository data cleared.", "success"); } catch (error) { status(error.message, "error"); }
  });
});
