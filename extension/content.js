/* global chrome, StarShelfCategorizer */
(function augmentGitHubRepositoryPage() {
  const markerId = "star-shelf-category";

  function repositoryFromPage() {
    const fullName = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')?.content;
    if (!fullName) return null;
    const description = document.querySelector('meta[name="description"]')?.content || "";
    const language = document.querySelector('[itemprop="programmingLanguage"]')?.textContent?.trim() || "";
    const topics = [...document.querySelectorAll('a[data-octo-click="topic_click"], a.topic-tag')].map((node) => node.textContent.trim());
    return { fullName, name: fullName.split("/").pop(), description, language, topics };
  }

  function insertBadge() {
    if (document.getElementById(markerId)) return;
    const repository = repositoryFromPage();
    if (!repository) return;
    const category = StarShelfCategorizer.categorize(repository);
    const target = document.querySelector("#repository-container-header ul, #repository-container-header .d-flex.flex-wrap") || document.querySelector("#repository-container-header");
    if (!target) return;
    const badge = document.createElement("button");
    badge.id = markerId;
    badge.type = "button";
    badge.title = "Category picked locally by Star Shelf. Open settings to sync your starred repositories.";
    badge.textContent = `Star Shelf · ${category}`;
    badge.style.cssText = "margin:8px 0 0 8px;padding:4px 8px;border:1px solid #2b6a55;border-radius:999px;background:#e5f1e7;color:#205645;font:600 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;cursor:pointer";
    badge.addEventListener("click", () => chrome.runtime.sendMessage({ type: "openOptions" }));
    target.append(badge);
  }

  insertBadge();
  // GitHub uses Turbo navigation, so a full extension reload is not guaranteed between repos.
  document.addEventListener("turbo:load", insertBadge);
})();
