/**
 * Placeholder export proving the engine package is wired into the app.
 * Real domain models, normalizer, and optimizers replace this later.
 */
export function hello(): string {
  return "Hello from @fils/engine";
}

// Domain model for a raw UAE credit card (matches data/cards.json).
export type {
  Card,
  Eligibility,
  Fees,
  Rewards,
  RewardCategory,
  RewardType,
  Redemption,
} from "./card";

// Rate normalizer: messy rate strings -> structured numeric rates with confidence.
export { normalizeRate, rateTier } from "./normalize-rate";
export type {
  NormalizedRate,
  RateUnit,
  RateConfidence,
  RateRange,
  RateContext,
} from "./normalize-rate";

// Valuation model: reward currency -> AED/unit, with per-entry confidence.
export {
  DEFAULT_VALUATIONS,
  withValuations,
  resolveValuation,
} from "./valuations";
export type {
  ValuationEntry,
  ValuationTable,
  ValuationConfidence,
} from "./valuations";

// Card scorer: net expected annual value of a card for a spending profile.
export { scoreCard, AED_PER_USD } from "./score-card";
export type {
  CardScore,
  CategoryEarning,
  FeeBreakdown,
  ScoreFlag,
  SpendCategory,
  SpendingProfile,
  AedRange,
} from "./score-card";

// Portfolio optimizer: best 1/2/3-card portfolio for a spending + eligibility profile.
export { optimizePortfolio } from "./optimize-portfolio";
export type {
  UserProfile,
  OptimizeOptions,
  Portfolio,
  PortfolioResult,
  CategoryAllocation,
  CardContribution,
} from "./optimize-portfolio";