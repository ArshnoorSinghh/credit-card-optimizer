import type {
  MerchantShares,
  PortfolioResult,
  SpendingProfile,
  UserProfile,
} from "@fils/engine";

/**
 * The HTTP contract for /api/optimize, typed from the engine's own exports so the
 * boundary can't drift from the engine. Shared by the route handler and the page.
 */

/** POST /api/optimize request body. */
export interface OptimizeRequest {
  spending: SpendingProfile;
  profile: UserProfile;
  /**
   * Optional. Fraction (0..1) of the relevant categories' spend that happens at each
   * co-brand retailer ("LuLu": 0.35). Omitted, the engine keeps its conservative
   * default: assume the whole category, flag it, and hold those cards back from the
   * recommendation. A merchant the caller doesn't mention is UNANSWERED, which is
   * not the same as 0 — see packages/engine/src/merchant-share.ts.
   */
  merchantShares?: MerchantShares;
}

/** Success response — the engine's PortfolioResult, verbatim. */
export type OptimizeResponse = PortfolioResult;

/** Error response shape (any 4xx). */
export interface OptimizeError {
  error: string;
}
