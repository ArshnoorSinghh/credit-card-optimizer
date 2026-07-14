import type { PortfolioResult, SpendingProfile, UserProfile } from "@fils/engine";

/**
 * The HTTP contract for /api/optimize, typed from the engine's own exports so the
 * boundary can't drift from the engine. Shared by the route handler and the page.
 */

/** POST /api/optimize request body. */
export interface OptimizeRequest {
  spending: SpendingProfile;
  profile: UserProfile;
}

/** Success response — the engine's PortfolioResult, verbatim. */
export type OptimizeResponse = PortfolioResult;

/** Error response shape (any 4xx). */
export interface OptimizeError {
  error: string;
}
