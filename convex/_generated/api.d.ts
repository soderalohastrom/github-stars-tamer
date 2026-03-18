/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as categories from "../categories.js";
import type * as claudeAi from "../claudeAi.js";
import type * as export_ from "../export.js";
import type * as github from "../github.js";
import type * as lists from "../lists.js";
import type * as openaiAi from "../openaiAi.js";
import type * as readme from "../readme.js";
import type * as repositories from "../repositories.js";
import type * as savedFilters from "../savedFilters.js";
import type * as search from "../search.js";
import type * as sync from "../sync.js";
import type * as syncHistory from "../syncHistory.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  categories: typeof categories;
  claudeAi: typeof claudeAi;
  export: typeof export_;
  github: typeof github;
  lists: typeof lists;
  openaiAi: typeof openaiAi;
  readme: typeof readme;
  repositories: typeof repositories;
  savedFilters: typeof savedFilters;
  search: typeof search;
  sync: typeof sync;
  syncHistory: typeof syncHistory;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
