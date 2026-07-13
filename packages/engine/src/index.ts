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