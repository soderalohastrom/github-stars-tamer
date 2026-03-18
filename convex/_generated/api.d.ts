/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai from "../ai.js";
import type * as categories from "../categories.js";
import type * as claudeAi from "../claudeAi.js";
import type * as export_ from "../export.js";
import type * as github from "../github.js";
import type * as lists from "../lists.js";
import type * as readme from "../readme.js";
import type * as repositories from "../repositories.js";
import type * as savedFilters from "../savedFilters.js";
import type * as search from "../search.js";
import type * as sync from "../sync.js";
import type * as syncHistory from "../syncHistory.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  categories: typeof categories;
  claudeAi: typeof claudeAi;
  export: typeof export_;
  github: typeof github;
  lists: typeof lists;
  readme: typeof readme;
  repositories: typeof repositories;
  savedFilters: typeof savedFilters;
  search: typeof search;
  sync: typeof sync;
  syncHistory: typeof syncHistory;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
