/* global chrome, StarShelfCategorizer */
const state = { repositories: [], sync: {}, tokenConfigured: false };
const elements = {};

function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response?.ok) return reject(new Error(response?.error || "Request failed."));
      resolve(response.result);
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function relativeDate(dateString) {
  if (!dateString) return "Recently";
  const days = Math.max(0, Math.round((Date.now() - new Date(dateString).getTime()) / 86400000));
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
}

function selectedRepositories() {
  const query = elements.search.value.trim().toLowerCase();
  const category = elements.category.value;
  return state.repositories.filter((repo) => {
    const matchesCategory = category === "All" || repo.category === category;
    const text = `${repo.fullName} ${repo.description} ${repo.language} ${(repo.topics || []).join(" ")}`.toLowerCase();
    return matchesCategory && (!query || text.includes(query));
  });
}

function renderCategories() {
  const counts = state.repositories.reduce((result, repo) => {
    result[repo.category] = (result[repo.category] || 0) + 1;
    return result;
  }, {});
  elements.categorySummary.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([category, count]) => `<button class="category-stat" type="button" data-category="${escapeHtml(category)}"><strong>${count}</strong><span>${escapeHtml(category)}</span></button>`).join("") || "<p class=\"muted\">Categories appear after your first sync.</p>";
  elements.categorySummary.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => { elements.category.value = button.dataset.category; renderRepositories(); });
  });
}

function renderRepositories() {
  const repositories = selectedRepositories();
  elements.visibleCount.textContent = repositories.length === state.repositories.length ? "Your shelf" : `${repositories.length} matching`;
  elements.repositoryList.innerHTML = repositories.map((repo) => `
    <a class="repository-card" href="${escapeHtml(repo.url)}" target="_blank" rel="noreferrer">
      <div class="repo-topline"><span class="repo-name">${escapeHtml(repo.fullName)}</span><span class="repo-date">${relativeDate(repo.starredAt)}</span></div>
      <p>${escapeHtml(repo.description || "No description provided.")}</p>
      <div class="repo-meta"><span class="tag">${escapeHtml(repo.category)}</span>${repo.language ? `<span>${escapeHtml(repo.language)}</span>` : ""}<span>★ ${repo.stars.toLocaleString()}</span></div>
    </a>`).join("");
  const showEmpty = state.repositories.length === 0;
  elements.empty.hidden = !showEmpty;
  elements.repositoryList.hidden = showEmpty;
  if (!showEmpty && repositories.length === 0) elements.repositoryList.innerHTML = "<p class=\"no-results\">Nothing on this shelf matches that filter.</p>";
}

function render() {
  const previousCategory = elements.category.value || "All";
  elements.repositoryCount.textContent = state.repositories.length;
  elements.syncMessage.textContent = state.sync.message || "Ready.";
  elements.statusDot.className = `status-dot ${state.sync.state || "idle"}`;
  elements.importButton.disabled = state.sync.state === "syncing";
  elements.importButton.textContent = state.sync.state === "syncing" ? "Syncing…" : "Sync now";
  elements.category.innerHTML = `<option value="All">All categories</option>${StarShelfCategorizer.categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  elements.category.value = StarShelfCategorizer.categories.includes(previousCategory) || previousCategory === "All" ? previousCategory : "All";
  renderCategories();
  renderRepositories();
}

async function refresh() {
  Object.assign(state, await send({ type: "getState" }));
  render();
}

function openOptions() { send({ type: "openOptions" }).catch((error) => { elements.syncMessage.textContent = error.message; }); }

document.addEventListener("DOMContentLoaded", async () => {
  Object.assign(elements, {
    statusDot: document.getElementById("status-dot"), syncMessage: document.getElementById("sync-message"), importButton: document.getElementById("import-button"),
    repositoryCount: document.getElementById("repository-count"), categorySummary: document.getElementById("category-summary"), search: document.getElementById("search-input"),
    category: document.getElementById("category-filter"), visibleCount: document.getElementById("visible-count"), repositoryList: document.getElementById("repository-list"), empty: document.getElementById("empty-state")
  });
  elements.importButton.addEventListener("click", async () => { try { await send({ type: "importStarred" }); } catch (_) { /* state has a useful error */ } await refresh(); });
  document.getElementById("settings-button").addEventListener("click", openOptions);
  document.getElementById("empty-settings-button").addEventListener("click", openOptions);
  document.getElementById("privacy-button").addEventListener("click", openOptions);
  elements.search.addEventListener("input", renderRepositories);
  elements.category.addEventListener("change", renderRepositories);
  chrome.storage.onChanged.addListener(() => refresh().catch(() => {}));
  try { await refresh(); } catch (error) { elements.syncMessage.textContent = error.message; }
});
