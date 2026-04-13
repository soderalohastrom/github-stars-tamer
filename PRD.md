# Star Graph — Product Requirements Document

> Browse your GitHub stars like an Obsidian vault — every repo distilled into a
> wiki page, all pages cross-linked, visualized as an interactive graph.

---

## Problem

Developers star hundreds to thousands of GitHub repositories over time. The
starring gesture captures a moment of admiration or intent ("this looks useful"),
but the context decays fast. Six months later, a list of 800 starred repos is
effectively unsearchable — the repo names are cryptic, the descriptions are
marketing copy, and there's no record of *why* you starred it or how it relates
to anything else you care about.

The GitHub Stars Organizer already solves half of this: it syncs stars, lets you
categorize them, and adds AI-powered suggestions. **Star Graph** solves the
other half: it distills each repo into a structured, readable wiki page and
connects all pages into a browsable knowledge graph — so you can *understand*
your stars, not just *organize* them.

---

## Vision

A single "Build Knowledge Graph" action triggers an LLM-powered pipeline that:

1. Fetches the full README and metadata for every starred repo.
2. Distills each into a concise, structured wiki page (what it does, key
   features, stack, why it's notable).
3. Discovers cross-references between repos (shared topics, complementary
   tools, related problem domains).
4. Renders the result as an interactive force-directed graph — Obsidian-style —
   where nodes are repos, edges are relationships, and clicking a node opens
   the distilled document.
5. Supports incremental updates: new stars get processed on demand; existing
   pages persist.

The user ends up with a **personal technical knowledge base** built from their
own starring history — browsable, searchable, and visually navigable.

---

## User Persona

**Primary:** A developer (solo or small team) who has starred 100–2000+ GitHub
repos over several years. They use stars as bookmarks but have lost track of
what they starred and why. They want to rediscover their collection and see
patterns they didn't know were there.

**Secondary:** A technical lead who curates starred repos as a team resource
and wants a shareable, browsable view of "tools we've evaluated."

---

## User Stories

### US-1: Build Knowledge Graph (initial batch)
**As a** user with synced starred repos,
**I want to** trigger a one-time batch processing of all my stars,
**So that** each repo gets a distilled wiki page with cross-references.

**Acceptance criteria:**
- A "Build Knowledge Graph" button is visible after repos are synced.
- Tapping it starts a background job with a progress indicator (N/total).
- Each repo's README is fetched, cleaned, and sent to the user's configured
  LLM provider (Claude, OpenAI, or Ollama).
- The LLM returns a structured response: summary, key features, stack, "why
  notable", and related repos from the user's own starred set.
- Results persist in a `repoKnowledge` table in Convex.
- Processing is resumable — if interrupted, it picks up where it left off.

### US-2: Browse Graph
**As a** user with a built knowledge graph,
**I want to** see an interactive force-directed graph of my starred repos,
**So that** I can visually explore clusters and relationships.

**Acceptance criteria:**
- Nodes are labeled by repo name, colored by primary language (or category).
- Edges represent LLM-discovered cross-references and shared topic/language
  relationships.
- Graph supports zoom, pan, and tap-to-select.
- Tapping a node navigates to the document reader for that repo.
- Clusters of related repos are visually apparent (force-directed layout).

### US-3: Read Document
**As a** user viewing a repo's wiki page,
**I want to** read a clean, well-formatted summary of the repo,
**So that** I can quickly understand what it does and why I starred it.

**Acceptance criteria:**
- Document renders as styled markdown with headers, bullets, and code
  formatting.
- Sections: What It Does, Key Features, Stack, Why Notable, Related Repos.
- Dark/light theme support (matches app theme).
- Source link to the original GitHub repo is prominent.

### US-4: Traverse Links
**As a** user reading a repo's wiki page,
**I want to** tap on `[[wikilinks]]` to navigate to related repo pages,
**So that** I can explore connections without returning to the graph.

**Acceptance criteria:**
- Cross-references render as tappable links (styled distinctly from external
  URLs).
- Tapping a wikilink navigates to the linked repo's document page.
- "Back to Graph" and standard back navigation are always available.
- Links that point to repos not yet processed show a "not yet processed"
  state rather than failing silently.

### US-5: Incremental Update
**As a** user who has starred new repos since the last processing run,
**I want to** update the knowledge graph with only the new additions,
**So that** I don't re-process my entire collection.

**Acceptance criteria:**
- An "Update Graph" action processes only repos where `starredAt` is newer
  than `lastProcessedAt`, or where the README SHA has changed.
- New cross-references are discovered between new and existing repos.
- Existing wiki pages are not re-generated unless the README changed.
- Progress indicator shows "N new repos to process."

---

## Components

### Component A — LLM Processing & Storage (Foundation)
The batch pipeline that transforms raw GitHub data into structured wiki pages.
This is the foundation — Components B and C depend on it.

**Priority:** Phase 1 (must ship first)

**Key decisions:**
- Reuses the existing multi-provider AI infrastructure (`convex/ai.ts`,
  `convex/claudeAi.ts`, `convex/openaiAi.ts`).
- Extends existing README fetching (`convex/readme.ts`) to fetch full content
  rather than truncated excerpts.
- LLM prompt is adapted from the craft-wiki starred-repos template (proven
  structure for distilling GitHub repos into wiki pages).
- Cross-references are extracted in a second pass after all individual pages
  are generated — the LLM sees the full list of processed repos and suggests
  connections.

### Component B — Graph Visualization
The Obsidian-style interactive graph.

**Priority:** Phase 2 (build after A is working)

**Key decisions:**
- Library choice deferred to implementation time. Candidates: Reagraph,
  vis.js, react-force-graph, d3-force. Evaluation criteria: React Native
  compatibility, performance with 500–2000 nodes, touch interaction support.
- Force-directed layout as default; optional clustering by language or
  category.
- Nodes can be filtered by language, category, or processing status.

### Component C — Markdown Reader
The document view with wikilink traversal.

**Priority:** Phase 1 (ships alongside A — the graph is nice-to-have, but the
documents must be readable immediately)

**Key decisions:**
- Markdown rendering with custom `[[wikilink]]` handling — links resolve to
  in-app navigation, not external URLs.
- Clean, readable typography. Not trying to be a full Obsidian clone — just
  a good reading experience with traversable links.
- Library candidates: react-native-markdown-display, or a lightweight custom
  renderer (the output format is controlled and predictable).

---

## Phased Rollout

| Phase | Components | What ships |
|-------|-----------|------------|
| **1** | A + C | LLM processing pipeline + document reader. User can build the knowledge base and browse individual pages with wikilinks. No graph yet — but the knowledge is there and navigable. |
| **2** | B | Graph visualization added. The "Star Graph" view becomes the primary entry point, with click-through to documents. |
| **3** | Polish | Delta updates, README change detection, performance tuning for large collections (1000+ repos), search within knowledge pages. |

---

## Non-Goals (v1)

- **Collaborative sharing** of knowledge graphs between users.
- **Export to Obsidian** (.md vault export). Could be a v2 feature.
- **Real-time re-processing** — the LLM pipeline runs on-demand, not
  continuously.
- **Custom prompt editing** by end users. The prompt is optimized once and
  baked in.
- **Graph editing** — users don't manually add/remove edges. The graph
  reflects what the LLM discovered.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Processing throughput | ≤ 3 seconds per repo (including README fetch + LLM call) |
| Graph render time | < 2 seconds for 500 nodes, < 5 seconds for 2000 nodes |
| Cross-references per repo | 2–5 average (discovered by LLM) |
| User engagement | > 50% of users who build the graph return to browse it within 7 days |

---

## Design Ancestor

This feature's LLM pipeline is directly adapted from the **craft-wiki
starred-repos sub-pipeline** (`~/.claude/skills/wiki-raw/SKILL.md`), which
processes GitHub repo clippings into structured wiki pages with cross-references.
The prompt template, output structure, and distillation philosophy are inherited
from that system. See the SPEC for the exact prompt adaptation.

---

*Built for developers who star with intention and forget with enthusiasm.*
