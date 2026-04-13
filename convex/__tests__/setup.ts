import schema from "../schema";
import { convexTest } from "convex-test";

const modules = import.meta.glob("../**/*.ts");

export function createTestConvex() {
  return convexTest(schema, modules);
}
