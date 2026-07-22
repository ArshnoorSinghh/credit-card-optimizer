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

// Merchant -> spend-category mapping (UAE-specific, extendable data table).
export { MERCHANT_MAP, resolveMerchant } from "./merchant-map";
export type { MerchantEntry, ResolvedMerchant } from "./merchant-map";

// "Which card should I use?" — deterministic lookup over the scorer. No AI.
export { askWhichCard, bestCardForCategory, bestCardOverall } from "./which-card";
export type {
  AskWhichCardInput,
  CardRecommendation,
  UnownedSuggestion,
  WhichCardAnswer,
  UnrecognizedInput,
  WhichCardResult,
} from "./which-card";

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

// Sensitivity analysis: how the recommendation responds as one input is varied,
// and the break-even points where it changes. Built ON TOP of optimizePortfolio.
export {
  valuationSensitivity,
  spendingSensitivity,
  assessValuationFragility,
  withFragilityFlags,
} from "./sensitivity";
export type {
  SensitivityCurve,
  SensitivitySample,
  SensitivityVariable,
  FlipPoint,
  SweepOptions,
  ValuationSensitivityOptions,
  SpendingSensitivityOptions,
  ValuationFragility,
  FragilityOptions,
  FragilityAssessment,
} from "./sensitivity";

// ── Engine 2: Points & Redemption Optimizer ─────────────────────────────────

// Points inventory: the user's manually-entered holdings.
export type { PointsHolding, PointsInventory } from "./points-inventory";

// Redemption valuation model: per-currency named routes (currency x route) -> AED,
// with a semantic class, per-entry confidence, and an explicit cash-capability flag.
export {
  REDEMPTION_VALUATIONS,
  CARD_BILL_CLASSES,
  defaultRedemptionProfile,
  resolveRedemptionProfile,
  withRedemptionValuations,
  primaryRoute,
  routesForClasses,
  bestRouteAmongClasses,
  bestRoute,
  supportedClasses,
  isCashCapable,
  premiumFlightRoute,
  worstConfidence,
  deriveFlatValuationTable,
  reconcileWithFlat,
} from "./redemption-valuations";
export type {
  RedemptionClass,
  RedemptionConfidence,
  RedemptionValuationEntry,
  RedemptionRoute,
  PremiumCabinModel,
  CurrencyRedemptionProfile,
  RedemptionValuationTable,
  RedemptionProfileOverride,
  RedemptionOverrides,
  FlatReconciliation,
} from "./redemption-valuations";

// Conversion model: bank points -> airline miles, with break-even math.
export { CONVERSIONS, CONVERSION_FINDING, conversionsFrom, evaluateConversion } from "./conversions";
export type { Conversion, ConversionOutcome } from "./conversions";

// Redemption recommender: best redemption per holding for a goal, ranked by AED.
export { recommendRedemptions } from "./recommend-redemptions";
export type {
  RedemptionGoal,
  RecommendOptions,
  RedemptionCandidate,
  RedemptionSuggestion,
  RedemptionPlan,
} from "./recommend-redemptions";

// Reward-expiry policy: shared by Engine 1 (flags the term) and Engine 2 (dates it).
export { PROGRAM_EXPIRY_DEFAULTS as REWARD_EXPIRY_POLICY } from "./expiry-policy";
export type { ProgramExpiryDefault as RewardExpiryPolicy } from "./expiry-policy";

// Burn engine: expiry-driven burn priority with flagged program defaults.
export { burnPriority, PROGRAM_EXPIRY_DEFAULTS, DEVALUATIONS } from "./burn-priority";
export type {
  BurnUrgency,
  BurnItem,
  BurnPlan,
  ProgramExpiryDefault,
  Devaluation,
} from "./burn-priority";