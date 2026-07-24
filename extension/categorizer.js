/* global globalThis */
// Deliberately dependency-free so the same rules work offline in every extension context.
(function attachCategorizer() {
  const CATEGORY_RULES = [
    { name: "AI & Data", terms: ["ai", "llm", "machine learning", "deep learning", "neural", "model", "dataset", "data science", "computer vision", "nlp", "pytorch", "tensorflow", "jupyter", "analytics"] },
    { name: "Web", terms: ["web", "react", "next", "vue", "angular", "frontend", "css", "javascript", "typescript", "html", "browser", "node", "api"] },
    { name: "Mobile", terms: ["mobile", "ios", "android", "swift", "swiftui", "kotlin", "react native", "flutter"] },
    { name: "Developer Tools", terms: ["developer tool", "devtool", "cli", "terminal", "editor", "ide", "testing", "test", "lint", "formatter", "sdk", "automation"] },
    { name: "Cloud & Infra", terms: ["cloud", "kubernetes", "docker", "container", "terraform", "devops", "serverless", "database", "redis", "postgres", "deploy", "ci/cd"] },
    { name: "Security", terms: ["security", "auth", "authentication", "encryption", "privacy", "crypto", "password", "vulnerability"] },
    { name: "Design", terms: ["design", "ui", "ux", "figma", "icon", "animation", "illustration", "typography"] },
    { name: "Learning", terms: ["tutorial", "course", "learning", "awesome", "roadmap", "example", "education", "book"] }
  ];

  function repositoryText(repository) {
    const fields = [
      repository.name,
      repository.fullName,
      repository.description,
      repository.language,
      ...(repository.topics || [])
    ];
    return fields.filter(Boolean).join(" ").toLowerCase();
  }

  function categorize(repository) {
    const haystack = repositoryText(repository);
    let best = { name: "Other", score: 0 };
    for (const rule of CATEGORY_RULES) {
      const score = rule.terms.reduce((total, term) => total + (haystack.includes(term) ? term.split(" ").length : 0), 0);
      if (score > best.score) best = { name: rule.name, score };
    }
    return best.name;
  }

  globalThis.StarShelfCategorizer = { categories: CATEGORY_RULES.map((rule) => rule.name).concat("Other"), categorize };
})();
