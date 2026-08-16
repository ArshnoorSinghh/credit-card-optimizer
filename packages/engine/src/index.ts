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
  ScoringOptions,
  FeeBreakdown,
  ScoreFlag,
  SpendCategory,
  SpendingProfile,
  AedRange,
} from "./score-card";

// Merchant -> spend-category mapping (UAE-specific, extendable data table).
export { MERCHANT_MAP, resolveMerchant, normalizeMerchantName } from "./merchant-map";
export type { MerchantEntry, ResolvedMerchant } from "./merchant-map";

// Merchant share: what fraction of a category's spend lands at one retailer. The
// input that lets co-brand cards be scored instead of excluded.
export { sanitizeMerchantShares, shareFor } from "./merchant-share";
export type {
  MerchantShares,
  ResolvedMerchantShares,
  MerchantShareIssue,
} from "./merchant-share";
export { merchantShareQuestions } from "./merchant-share-questions";
export type { MerchantShareQuestion } from "./merchant-share-questions";

// Study filters: the universe predicates the gap study measures with, shared so the
// study and its diagnostic cannot drift, and regression-tested for liveness.
export {
  RATE_DEFECT_CLAUSES,
  isRateDefect,
  isSoundScore,
  rateDefectsIn,
  hasDoNotPublishCaveat,
  IMPLAUSIBLE_RETURN_PCT,
} from "./study-filters";
export type { RateDefectClause } from "./study-filters";

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

// Devaluations: the dated table plus its freshness check. Exported from its own
// module (not just via the burn engine) because "has anyone swept this lately" is a
// question about the DATA, and the calendar surfaces the answer as a flag.
export {
  DEVALUATIONS_REVIEWED_ON,
  DEVALUATION_REVIEW_MAX_AGE_MONTHS,
  devaluationReviewAgeMonths,
  devaluationReviewIsStale,
  upcomingDevaluations,
} from "./devaluations";

// Cap thresholds: "after AED X of groceries this month, switch to your other card".
// Deliberately NOT on the calendar — dating a cap crossing needs a uniform-spend
// assumption, while the threshold form is exact for any spending pattern.
export { capThresholds } from "./cap-thresholds";
export type {
  CapThreshold,
  CapThresholdReport,
  UnstatedThreshold,
  SwitchTarget,
} from "./cap-thresholds";
export { optionSpendThresholds } from "./score-card";
export type { SpendThreshold } from "./score-card";

// Deadline calendar: expiry + devaluations + fee renewals on one timeline. Composes
// the engines above and computes no deadline of its own; `undated` carries the ones
// that cannot be dated, so an empty calendar never reads as "nothing is coming up".
export { deadlineCalendar } from "./deadline-calendar";
export type {
  DeadlineKind,
  DeadlineCertainty,
  DeadlineEvent,
  UndatedDeadline,
  DeadlineCalendar,
  HeldCard,
  CalendarInput,
  CalendarOptions,
} from "./deadline-calendar";