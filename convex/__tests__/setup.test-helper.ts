import schema from "../schema";
import { convexTest } from "convex-test";

const modules = (import.meta as ImportMeta & {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("../**/*.ts");

export function createTestConvex() {
  return convexTest(schema, modules);
}
