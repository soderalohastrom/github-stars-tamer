import schema from "../../convex/schema";
import { convexTest } from "convex-test";

// Use require patterns for Node.js test environment (not Convex server)
const modules: Record<string, () => Promise<any>> = {
  "../schema.ts": () => import("../schema"),
  "../users.ts": () => import("../users"),
  "../lists.ts": () => import("../lists"),
  "../repositories.ts": () => import("../repositories"),
  "../categories.ts": () => import("../categories"),
  "../search.ts": () => import("../search"),
  "../sync.ts": () => import("../sync"),
  "../syncHistory.ts": () => import("../syncHistory"),
  "../savedFilters.ts": () => import("../savedFilters"),
  "../ai.ts": () => import("../ai"),
  "../claudeAi.ts": () => import("../claudeAi"),
  "../openaiAi.ts": () => import("../openaiAi"),
  "../github.ts": () => import("../github"),
  "../readme.ts": () => import("../readme"),
  "../export.ts": () => import("../export"),
  "../auth.config.ts": () => import("../auth.config"),
  "../staticHosting.ts": () => import("../staticHosting"),
};

export function createTestConvex() {
  return convexTest(schema, modules);
}
