import { exposeDeploymentQuery } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

// Public query for live reload notifications (used by UpdateBanner in React)
export const { getCurrentDeployment } = exposeDeploymentQuery(
  components.staticHosting
);
