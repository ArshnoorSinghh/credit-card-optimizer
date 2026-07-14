import cardsData from "../data/cards.json";
import type { Card } from "./card";

/**
 * Placeholder export proving the engine package is wired into the app.
 * Real domain models, normalizer, and optimizers replace this later.
 */
export function hello(): string {
  return "Hello from @fils/engine";
}

/**
 * The canonical UAE card dataset, imported at BUILD time (a bundled JSON import,
 * not a runtime `fs` read) so it works in a serverless bundle and keeps the engine
 * pure — no I/O. Consumers (e.g. the web API) get the cards from here rather than
 * reading the file themselves.
 */
export const CARDS: Card[] = cardsData as Card[];

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
export { scoreCard, AED_PER_USD, SPEND_CATEGORIES } from "./score-card";
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