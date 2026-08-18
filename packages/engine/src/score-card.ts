/**
 * scoreCard — the "show the math" receipt for one card against one spending
 * profile. Pure and deterministic: no I/O.
 *
 * Pipeline (all commented inline below):
 *   1. Match the user's spend categories to the card's reward categories.
 *   2. Apply the normalized rate per category, respecting its UNIT.
 *   3. Enforce monthly caps, then annual caps (in reward-currency units).
 *   4. Unmatched spend earns the base rate.
 *   5. Convert reward-currency earnings to AED via the valuation table.
 *   6. Annualize, subtract the annual fee (year-1 vs ongoing), and report a full
 *      breakdown plus any inherited low-confidence flags.
 *
 * Unresolved (tier-3) rates are scored as a RANGE (min/max net value), never a
 * single fabricated number.
 */

import type { Card, RewardCategory } from "./card";
import { normalizeRate, type NormalizedRate } from "./normalize-rate";
import { normalizeMerchantName } from "./merchant-map";
import {
  sanitizeMerchantShares,
  shareFor,
  type MerchantShares,
  type ResolvedMerchantShares,
} from "./merchant-share";
import {
  DEFAULT_VALUATIONS,
  resolveValuation,
  type ValuationEntry,
  type ValuationTable,
} from "./valuations";
// Expiry policy is shared with Engine 2's burn engine. Engine 1 only FLAGS it —
// it never discounts value for expiry. See expiry-policy.ts for why.
import { PROGRAM_EXPIRY_DEFAULTS } from "./expiry-policy";

/** AED per USD. Fixed peg used to convert "per USD" reward rates to AED spend. */
export const AED_PER_USD = 3.6725;

/**
 * Canonical spending categories the user reports (AED/month each). Deliberately
 * broad — the card data uses ~30 messy category names that we fold into these.
 * `international` is treated as its own category (foreign-currency / overseas
 * spend), orthogonal to merchant type, because that's how the card data models it.
 */
export type SpendCategory =
  | "groceries"
  | "dining"
  | "fuel"
  | "utilities"
  | "education"
  | "travel"
  | "transport"
  | "entertainment"
  | "international"
  | "other";

/** AED/month per category. Missing categories are treated as 0. */
export type SpendingProfile = Partial<Record<SpendCategory, number>>;

/**
 * The canonical spend categories as a RUNTIME list, for validating input at a
 * boundary (the union type erases at compile time and can't be iterated). The
 * `satisfies` clause rejects any entry that isn't a SpendCategory, and the
 * exhaustiveness check below fails the build if a category is missing — so this
 * list and the union can never silently drift apart.
 */
export const SPEND_CATEGORIES = [
  "groceries",
  "dining",
  "fuel",
  "utilities",
  "education",
  "travel",
  "transport",
  "entertainment",
  "international",
  "other",
] as const satisfies readonly SpendCategory[];

// Compile-time guard: every SpendCategory must appear in SPEND_CATEGORIES.
type _MissingCategory = Exclude<SpendCategory, (typeof SPEND_CATEGORIES)[number]>;
const _allCategoriesCovered: _MissingCategory extends never ? true : never = true;
void _allCategoriesCovered;

/**
 * How a card reward-category name maps to canonical spend categories.
 *  - `categories`: matches those specific spend categories. `merchant` marks an
 *    optimistic assumption (the bonus only applies at a specific merchant we
 *    can't see in a generic profile) — it lowers confidence rather than being
 *    dropped, so the card isn't unfairly zeroed.
 *  - `catchall`: eligible for ANY spend as a fallback (all_spend / all_other_spend).
 *  - `unmatched`: cannot be scored from a generic profile; earns nothing, flagged.
 */
type MatchRule =
  | { kind: "categories"; categories: SpendCategory[]; merchant?: string }
  | { kind: "catchall"; excludes?: SpendCategory[] }
  | { kind: "unmatched"; reason: string };

// why an explicit table (not fuzzy string parsing): the 30 category names are a
// small, closed set in the data. Enumerating them means every match is a
// reviewable decision, and a NEW/unknown category is caught (routed to
// "unmatched" + flagged) instead of being silently mis-parsed.
// why this table grew a lot in 2026-07: the hand-verified dataset replaced a small
// set of tidy category keys with a much richer, messier vocabulary (~100 names,
// many compound like "fuel_school_fees_utilities_government"). Each compound maps
// to EVERY canonical component it names. Mappings are deliberately explicit (not
// fuzzy string-splitting) so each one is a reviewable decision and a genuinely new
// name still routes to "unmatched" + a flag instead of being silently mis-scored.
// JUDGMENT CALLS worth a human's eye are marked `// review:`.
const MATCH_TABLE: Record<string, MatchRule> = {
  // ── Single canonical categories ──────────────────────────────────────────────
  international_spend: { kind: "categories", categories: ["international"] },
  eligible_international_spend: { kind: "categories", categories: ["international"] },
  eligible_foreign_currency_spend: { kind: "categories", categories: ["international"] },
  foreign_currency_spend: { kind: "categories", categories: ["international"] },
  non_aed_spend: { kind: "categories", categories: ["international"] },
  eea_and_uk_spend: { kind: "categories", categories: ["international"] },
  eu_and_uk_spend: { kind: "categories", categories: ["international"] },
  uk_and_eea_spend: { kind: "categories", categories: ["international"] },
  eu_spend: { kind: "categories", categories: ["international"] },
  dining: { kind: "categories", categories: ["dining"] },
  dining_and_restaurants: { kind: "categories", categories: ["dining"] },
  dining_including_online: { kind: "categories", categories: ["dining"] },
  local_and_international_dining: { kind: "categories", categories: ["dining"] },
  lifestyle_dining: { kind: "categories", categories: ["dining"] },
  groceries: { kind: "categories", categories: ["groceries"] },
  supermarket: { kind: "categories", categories: ["groceries"] },
  supermarkets: { kind: "categories", categories: ["groceries"] },
  groceries_supermarket: { kind: "categories", categories: ["groceries"] },
  groceries_and_supermarkets: { kind: "categories", categories: ["groceries"] },
  grocery_and_supermarket: { kind: "categories", categories: ["groceries"] },
  groceries_other: { kind: "categories", categories: ["groceries"] },
  lifestyle_supermarkets: { kind: "categories", categories: ["groceries"] },
  fuel: { kind: "categories", categories: ["fuel"] },
  fuel_and_automotive: { kind: "categories", categories: ["fuel"] },
  lifestyle_fuel: { kind: "categories", categories: ["fuel"] },
  education: { kind: "categories", categories: ["education"] },
  school_fees: { kind: "categories", categories: ["education"] },
  school_and_education: { kind: "categories", categories: ["education"] },
  lifestyle_education: { kind: "categories", categories: ["education"] },
  utilities: { kind: "categories", categories: ["utilities"] },
  utility_bills: { kind: "categories", categories: ["utilities"] },
  bills: { kind: "categories", categories: ["utilities"] },
  etisalat_and_du: { kind: "categories", categories: ["utilities"] }, // telecom
  government_utilities_charity: { kind: "categories", categories: ["utilities"] },
  transport: { kind: "categories", categories: ["transport"] },
  salik_and_nol: { kind: "categories", categories: ["transport"] },
  travel_spend: { kind: "categories", categories: ["travel"] },
  travel_airlines: { kind: "categories", categories: ["travel"] },
  airline_spend: { kind: "categories", categories: ["travel"] },
  hotel_spend: { kind: "categories", categories: ["travel"] },
  travel_and_hotels: { kind: "categories", categories: ["travel"] },
  travel_hotels: { kind: "categories", categories: ["travel"] },
  travel_flights_hotels: { kind: "categories", categories: ["travel"] },
  cinemas: { kind: "categories", categories: ["entertainment"] },
  online_cinema: { kind: "categories", categories: ["entertainment"] },
  video_streaming: { kind: "categories", categories: ["entertainment"] },
  home_digital_entertainment: { kind: "categories", categories: ["entertainment"] },
  // review: "other" bucket — retail/shopping/electronics have no canonical bonus
  // category, so they earn base-rate-equivalent via "other" (matches merchant-map).
  fashion: { kind: "categories", categories: ["other"] },
  electronics: { kind: "categories", categories: ["other"] },
  other_retail: { kind: "categories", categories: ["other"] },
  online_spend: { kind: "categories", categories: ["other"] },
  aed_online_spend: { kind: "categories", categories: ["other"] },
  aed_mobile_wallet_pos: { kind: "categories", categories: ["other"] },
  automotive_servicing: { kind: "categories", categories: ["other"] },
  ai_subscriptions: { kind: "categories", categories: ["other"] },
  selected_digital_lifestyle_merchants: { kind: "categories", categories: ["other"] },

  // ── Compound categories → every component they name ──────────────────────────
  groceries_dining: { kind: "categories", categories: ["groceries", "dining"] },
  groceries_education_utilities: { kind: "categories", categories: ["groceries", "education", "utilities"] },
  dining_international: { kind: "categories", categories: ["dining", "international"] },
  grocery_and_non_aed_spend: { kind: "categories", categories: ["groceries", "international"] },
  fuel_utilities: { kind: "categories", categories: ["fuel", "utilities"] },
  fuel_and_salik: { kind: "categories", categories: ["fuel", "transport"] },
  dining_entertainment: { kind: "categories", categories: ["dining", "entertainment"] },
  dining_entertainment_groceries: { kind: "categories", categories: ["dining", "entertainment", "groceries"] },
  groceries_and_entertainment_combined: { kind: "categories", categories: ["groceries", "entertainment"] },
  groceries_dining_fuel: { kind: "categories", categories: ["groceries", "dining", "fuel"] },
  supermarkets_fuel_dining: { kind: "categories", categories: ["groceries", "fuel", "dining"] },
  dining_travel: { kind: "categories", categories: ["dining", "travel"] },
  travel_dining: { kind: "categories", categories: ["travel", "dining"] },
  local_dining_and_hotels: { kind: "categories", categories: ["dining", "travel"] },
  education_telecom: { kind: "categories", categories: ["education", "utilities"] },
  international_and_direct_airline_spend: { kind: "categories", categories: ["international", "travel"] },
  utilities_school_fees_fuel: { kind: "categories", categories: ["utilities", "education", "fuel"] },
  fuel_school_fees_utilities_government: { kind: "categories", categories: ["fuel", "education", "utilities"] },
  fuel_utilities_real_estate_education: { kind: "categories", categories: ["fuel", "utilities", "education"] },
  school_fees_government_utilities_real_estate_fuel: { kind: "categories", categories: ["education", "utilities", "fuel"] },
  government_utilities_education_charity_rental_telecom: { kind: "categories", categories: ["utilities", "education"] },
  government_utilities_education_charity_fuel_rental_telecom: { kind: "categories", categories: ["utilities", "education", "fuel"] },
  specified_low_interchange_categories: { kind: "categories", categories: ["utilities", "education"] },
  fuel_transit_government_utilities_real_estate_education_telecom: { kind: "categories", categories: ["fuel", "transport", "utilities", "education"] },
  fuel_education_government_real_estate_telecom_charity_transport: { kind: "categories", categories: ["fuel", "education", "utilities", "transport"] },
  real_estate_education_fuel_government_ride_hailing_food_delivery_utilities_telecom: { kind: "categories", categories: ["education", "fuel", "utilities", "transport", "dining"] },
  // review: broad government/insurance/auto compounds — "other" carries the
  // insurance/auto/real-estate legs that have no canonical category of their own.
  government_insurance_rental_housing_auto_dealers: { kind: "categories", categories: ["utilities", "other"] },
  grocery_supermarket_insurance_auto_fast_food: { kind: "categories", categories: ["groceries", "dining", "other"] },
  grocery_supermarkets_fast_food_insurance_car_dealers: { kind: "categories", categories: ["groceries", "dining", "other"] },
  supermarkets_auto_dealers_insurance_fast_food: { kind: "categories", categories: ["groceries", "dining", "other"] },
  supermarkets_grocery_insurance_car_dealers: { kind: "categories", categories: ["groceries", "other"] },
  grocery_electronics_utilities_education_fuel: { kind: "categories", categories: ["groceries", "utilities", "education", "fuel", "other"] },
  supermarkets_telecom_education_fuel_government_takaful_auto_transport_real_estate: { kind: "categories", categories: ["groceries", "utilities", "education", "fuel", "transport", "other"] },
  government_transit_utilities_telecom_education_real_estate_fuel_grocery_insurance_auto: { kind: "categories", categories: ["utilities", "transport", "education", "fuel", "groceries", "other"] },
  selected_categories_and_eu_spend: { kind: "categories", categories: ["international", "other"] },

  // ── Catch-all / base categories ──────────────────────────────────────────────
  all_spend: { kind: "catchall" },
  all_other_spend: { kind: "catchall" },

  // ── Merchant-locked bonuses ──────────────────────────────────────────────────
  // Matched to their nearest canonical category but flagged, because a generic
  // spending profile can't confirm the spend is at that merchant. which-card.ts,
  // which DOES know the merchant, uses these locks to keep/drop the bonus exactly.
  emirates_purchases: { kind: "categories", categories: ["travel"], merchant: "Emirates" },
  emirates_spend: { kind: "categories", categories: ["travel"], merchant: "Emirates" },
  emirates_and_flydubai_aed_spend: { kind: "categories", categories: ["travel"], merchant: "Emirates" },
  direct_emirates_and_flydubai_aed_bookings: { kind: "categories", categories: ["travel"], merchant: "Emirates" },
  etihad_purchases: { kind: "categories", categories: ["travel"], merchant: "Etihad" },
  etihad_and_selected_partners: { kind: "categories", categories: ["travel"], merchant: "Etihad" },
  air_arabia_direct_spend: { kind: "categories", categories: ["travel"], merchant: "Air Arabia" },
  dnata_travel: { kind: "categories", categories: ["travel"], merchant: "dnata" },
  dnata_costa_city_sightseeing_emirates_leisure_retail: { kind: "categories", categories: ["travel"], merchant: "dnata" },
  marriott_hotels: { kind: "categories", categories: ["travel"], merchant: "Marriott" },
  marriott_bonvoy_hotels: { kind: "categories", categories: ["travel"], merchant: "Marriott" },
  booking_com: { kind: "categories", categories: ["travel"], merchant: "Booking.com" },
  mmi_al_hamra_arabian_adventures_le_clos: { kind: "categories", categories: ["travel"], merchant: "Emirates Leisure" },
  lulu_supermarket: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  lulu_purchases: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  lulu_stores: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  lulu_in_store_and_online: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  etisalat_smiles_app_elgrocer: { kind: "categories", categories: ["groceries"], merchant: "elGrocer" }, // review: grocery via Smiles app
  first_10_talabat_orders: { kind: "categories", categories: ["dining"], merchant: "Talabat" },
  // review: noon spans marketplace (other) + noon food (dining) + nownow (groceries).
  noon_noon_food_noon_minutes_noon_supermall_nownow_namshi: { kind: "categories", categories: ["other", "dining", "groceries"], merchant: "noon" },
  amazon_ae_prime_members: { kind: "categories", categories: ["other"], merchant: "Amazon" },
  amazon_ae_non_prime_members: { kind: "categories", categories: ["other"], merchant: "Amazon" },
  emaar_properties: { kind: "categories", categories: ["other"], merchant: "Emaar" },
  emaar_malls: { kind: "categories", categories: ["other"], merchant: "Emaar" },
  emaar_hospitality: { kind: "categories", categories: ["travel"], merchant: "Emaar" },
  emaar_entertainment: { kind: "categories", categories: ["entertainment"], merchant: "Emaar" },
  dubai_duty_free: { kind: "categories", categories: ["other"], merchant: "Dubai Duty Free" },
  rta_transport: { kind: "categories", categories: ["transport"], merchant: "RTA" },
  rta_and_nol_spend: { kind: "categories", categories: ["transport"], merchant: "RTA" },
  smiles_partners: { kind: "categories", categories: ["other"], merchant: "Smiles partners" },

  // ── Deliberately UNMATCHED (flagged, never silently modeled) ──────────────────
  // These are spend-THRESHOLD lump bonuses or time/opt-in conditions that a steady
  // per-category profile cannot express. Scoring them would require inventing a
  // realization assumption, so we flag them instead. review: revisit if the product
  // decides to model threshold bonuses.
  monthly_spend_bonus: { kind: "unmatched", reason: "Threshold lump bonus (reach AED X/mo) - not modeled from a steady profile" },
  quarterly_spend_bonus: { kind: "unmatched", reason: "Threshold lump bonus (cumulative quarter) - not modeled from a steady profile" },
  optional_miles_accelerator: { kind: "unmatched", reason: "Opt-in paid accelerator - depends on an unmodeled enrollment choice" },
  weekend_spend: { kind: "unmatched", reason: "Time-of-week bonus - a category profile can't say which spend fell on a weekend" },
};

/**
 * Narrow a catch-all so it can no longer claim `categories`, preserving its
 * `kind: "catchall"`.
 *
 * why not rewrite it into a `categories` rule (which is what this used to do):
 * downstream code keys off `kind === "catchall"` — most importantly the min-spend
 * gate, which keeps ONLY catch-all options when a card degrades. Converting the
 * rule silently deleted the card's base rate in that path, so a degraded card with
 * any exclusion earned nothing instead of its base rate. Carrying an `excludes`
 * list keeps the option's identity intact and makes the narrowing composable —
 * both `excluded_spend` and the suppressed-category lock append to it.
 */
function narrowCatchall(rule: MatchRule, categories: Iterable<SpendCategory>): MatchRule {
  if (rule.kind !== "catchall") return rule;
  const merged = new Set<SpendCategory>(rule.excludes ?? []);
  for (const c of categories) merged.add(c);
  return { kind: "catchall", excludes: SPEND_CATEGORIES.filter((c) => merged.has(c)) };
}

/**
 * The merchant a card reward category's bonus is LOCKED to, if any
 * (e.g. "lulu_supermarket" -> "LuLu"), else undefined.
 *
 * Exposed so a caller who KNOWS the merchant can act on the lock. `scoreCard` itself
 * can only flag it as an optimistic assumption — from a generic spending profile it
 * can't tell whether your groceries spend happened at LuLu. `which-card.ts` does
 * know the merchant, and uses this to drop bonuses locked to a different one.
 *
 * MATCH_TABLE stays private: this returns only the one fact a caller needs.
 */
export function merchantLockFor(cardCategory: string): string | undefined {
  const rule = MATCH_TABLE[cardCategory];
  return rule?.kind === "categories" ? rule.merchant : undefined;
}

/** A pair of AED values bounding an uncertain quantity (min===max when certain). */
export interface AedRange {
  min: number;
  max: number;
}

export interface CategoryEarning {
  /** The card reward category that earned this spend ("base_rate" for the base fallback). */
  cardCategory: string;
  /** Canonical spend categories routed here. */
  spendCategories: SpendCategory[];
  monthlySpendAed: number;
  /** The normalized rate applied (carries its own confidence). */
  rate: NormalizedRate;
  /** Reward-currency units earned per YEAR, before AED conversion (e.g. 120000 miles). */
  annualUnits: { min: number; max: number | null };
  /** AED value of those units after valuation. */
  annualValueAed: AedRange;
  /** Set when a cap limited earnings. */
  capBound?: "monthly" | "annual";
  /** Set when this used an optimistic merchant assumption. */
  merchantAssumption?: string;
}

export interface FeeBreakdown {
  annualFeeAed: number;
  /** Fee actually charged in year 1 (0 if first-year-free / free-for-life). */
  year1FeeAed: number;
  /** Fee charged in steady state (year 2+). */
  ongoingFeeAed: number;
  /** Description of the waiver applied, if any. */
  waiverApplied?: string;
}

export interface ScoreFlag {
  level: "low" | "unknown";
  message: string;
}

export interface CardScore {
  cardId: string;
  rewardCurrency: string;
  /** The valuation entry used for this card's currency. */
  valuation: ValuationEntry;
  /** Ranking number: ongoing (year 2+) net annual AED value; midpoint if uncertain. */
  netAnnualValue: number;
  /** Ongoing net annual value as a range (min===max when fully resolved). */
  netAnnualValueRange: AedRange;
  /** Net annual value in year 1 (applies any first-year fee waiver); midpoint if uncertain. */
  netAnnualValueYear1: number;
  /** Gross annual AED value before fees. */
  grossAnnualValue: AedRange;
  fees: FeeBreakdown;
  /** Per-category "receipt". */
  breakdown: CategoryEarning[];
  /** Inherited low/unknown-confidence flags from rates, valuation, merchants, caps. */
  flags: ScoreFlag[];
  /** True if anything (range rate, low/unknown confidence) makes this estimate soft. */
  uncertain: boolean;
  /**
   * True when the card is excluded from scoring pending data verification (see
   * Card.excluded_from_scoring). Benched cards return a zeroed score with an
   * explanatory flag — they are visible but must not be ranked.
   */
  benched: boolean;
}

// ---------------------------------------------------------------------------
// Unit-aware earning helpers. A rate's NUMBER means nothing without its UNIT, so
// every conversion routes through here. Returns reward-currency UNITS per month.
// ---------------------------------------------------------------------------

/** Reward-currency units earned in a month for `spendAed` at a resolved rate. */
export function monthlyUnits(
  value: number,
  unit: NormalizedRate["unit"],
  spendAed: number,
  aedPerUnit: number,
): number {
  switch (unit) {
    case "percent":
      // A percent is a fraction of AED spend returned AS VALUE. Convert that AED
      // value back into units so caps (which are in units) apply uniformly.
      // For cashback (aedPerUnit=1) this is just spend*value.
      return aedPerUnit > 0 ? (spendAed * value) / aedPerUnit : 0;
    case "points_per_aed":
      return value * spendAed;
    case "miles_per_usd":
      // Convert AED spend to USD first — "per USD" and "per AED" are different units.
      return value * (spendAed / AED_PER_USD);
    case "miles_per_aed":
      return value * spendAed;
    case null:
      return 0; // no unit → cannot compute; caller handles via range/flags
  }
}

/** AED earned per 1 AED spent at a resolved rate — used to pick the best category. */
export function yieldPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  if (rate.value === null || rate.unit === null) return 0; // unresolved → deprioritize
  return monthlyUnits(rate.value, rate.unit, 1, aedPerUnit) * aedPerUnit;
}

// ---------------------------------------------------------------------------
// Fee waivers.
// ---------------------------------------------------------------------------

/** Detect first-year-free / free-for-life from the free-text waiver string. */
export function computeFees(card: Card): FeeBreakdown {
  const fee = card.fees.annual_fee_aed;
  const waiver = card.fees.waiver_conditions ?? "";
  const freeForLife = /free for life|lifetime free|no annual fee/i.test(waiver) || fee === 0;
  const firstYearFree = /first year free|first year waived|1st year free|free for the first year/i.test(waiver);

  if (freeForLife) {
    return { annualFeeAed: fee, year1FeeAed: 0, ongoingFeeAed: 0, waiverApplied: "Free for life" };
  }
  if (firstYearFree) {
    return { annualFeeAed: fee, year1FeeAed: 0, ongoingFeeAed: fee, waiverApplied: "First year free" };
  }
  return { annualFeeAed: fee, year1FeeAed: fee, ongoingFeeAed: fee };
}

// ---------------------------------------------------------------------------
// Category matching.
// ---------------------------------------------------------------------------

export interface EarnOption {
  cardCategory: string;
  rate: NormalizedRate;
  /**
   * Reward caps as they appear in the data. THEIR UNIT DEPENDS ON THE CARD:
   *  - cashback cards (`rewards.type === "cashback"`) quote caps in AED ("max
   *    AED 150/mo") — `capsInAed` is true, and the cap math divides by aedPerUnit
   *    to compare against reward-currency units.
   *  - points/miles cards quote caps in reward-currency UNITS ("3,000 points/cycle")
   *    — `capsInAed` is false and the cap is already in units.
   * This distinction is load-bearing: a cashback card whose currency is valued below
   * 1.0 (e.g. fab_cashback's "FAB Rewards" @ 0.007) would otherwise read a "150" AED
   * cap as 150 points ≈ AED 1 and wrongly zero the bonus. See `resolveCapUnits`.
   */
  monthlyCap: number | null;
  annualCap: number | null;
  /** True when this card's caps are denominated in AED (cashback), not reward units. */
  capsInAed: boolean;
  rule: MatchRule;
}

/**
 * Resolve a stored cap into reward-currency UNITS, the unit the cap math works in.
 * For a cashback card the stored cap is AED, so we divide by the AED/unit value;
 * for a points/miles card it is already in units. null stays null (uncapped).
 */
function resolveCapUnits(rawCap: number | null, capsInAed: boolean, aedPerUnit: number): number | null {
  if (rawCap === null) return null;
  return capsInAed && aedPerUnit > 0 ? rawCap / aedPerUnit : rawCap;
}

/** Build the list of ways this card can earn, incl. a virtual base-rate fallback. */
export function buildEarnOptions(card: Card): { options: EarnOption[]; flags: ScoreFlag[] } {
  const flags: ScoreFlag[] = [];
  // Cashback cards quote their caps in AED; points/miles cards in reward units.
  const capsInAed = card.rewards.type === "cashback";
  const options: EarnOption[] = card.rewards.categories.map((cat: RewardCategory) => {
    const rule = MATCH_TABLE[cat.category] ?? {
      kind: "unmatched" as const,
      reason: `Unknown category "${label(cat.category)}" - not scored`,
    };
    if (!MATCH_TABLE[cat.category]) {
      flags.push({ level: "unknown", message: `Unrecognized reward category "${label(cat.category)}"` });
    }
    return {
      cardCategory: cat.category,
      // rewardCurrency lets the normalizer tell "6.25% back in UPoints" (which only
      // restates rewards.currency) from a real scope, so it isn't flagged for saying
      // what currency it pays in.
      rate: normalizeRate(cat.rate, {
        monthlyCap: cat.monthly_cap,
        annualCap: cat.annual_cap,
        rewardCurrency: card.rewards.currency,
      }),
      monthlyCap: cat.monthly_cap,
      annualCap: cat.annual_cap,
      capsInAed,
      rule,
    };
  });

  // why only add a virtual base if there's no catch-all category: cards with
  // all_other_spend already express the base (with its cap); adding an uncapped
  // virtual base would let spend dodge that cap. Cards without a catch-all need
  // the base_rate as the fallback for spend that matches no bonus category.
  const hasCatchall = options.some((o) => o.rule.kind === "catchall");
  if (!hasCatchall) {
    options.push({
      cardCategory: "base_rate",
      rate: normalizeRate(card.rewards.base_rate, { rewardCurrency: card.rewards.currency }),
      monthlyCap: null,
      annualCap: null,
      capsInAed,
      rule: { kind: "catchall" },
    });
  }
  return { options, flags };
}

/** Candidate earn-options for a given spend category. */
export function candidatesFor(cat: SpendCategory, options: EarnOption[]): EarnOption[] {
  return options.filter((o) => {
    if (o.rule.kind === "categories") return o.rule.categories.includes(cat);
    // A catch-all claims everything EXCEPT what has been narrowed away from it
    // (spend the card excludes outright, or spend it suppresses below its base rate).
    if (o.rule.kind === "catchall") return !(o.rule.excludes ?? []).includes(cat);
    return false; // unmatched never claims spend
  });
}

// ---------------------------------------------------------------------------
// Earning + caps for ONE option — the single source of truth for the cap math.
// Both scoreCard and the portfolio optimizer route through here so caps behave
// identically everywhere. Given a monthly AED spend already routed to an option,
// it returns the annual reward (as a min/max range, since a tier-3 rate has no
// single value) plus which cap (if any) bound.
// ---------------------------------------------------------------------------

export interface OptionEarning {
  /** Reward-currency units earned per YEAR (max null when the rate is unbounded). */
  annualUnits: { min: number; max: number | null };
  /** AED value of those units after valuation. */
  annualValueAed: AedRange;
  /** Set when a cap limited earnings at this spend level. */
  capBound?: "monthly" | "annual";
  /** True when the rate has no stated ceiling, so the upside can't be bounded. */
  unbounded: boolean;
}

export function earnOnOption(
  option: EarnOption,
  monthlySpendAed: number,
  aedPerUnit: number,
): OptionEarning {
  const rate = option.rate;
  // Resolve the rate into a min/max value pair in the rate's unit.
  // - resolved rate: min===max===value.
  // - range rate ("Up to X%"): min=range.min, max=range.max (may be null = unbounded).
  const lo = rate.value ?? rate.range?.min ?? 0;
  const hi = rate.value ?? rate.range?.max ?? null; // null => unbounded upper

  // Caps in reward-currency UNITS (converted from AED for cashback cards).
  const monthlyCap = resolveCapUnits(option.monthlyCap, option.capsInAed, aedPerUnit);
  const annualCap = resolveCapUnits(option.annualCap, option.capsInAed, aedPerUnit);

  const earn = (v: number): { units: number; aed: number; cap?: "monthly" | "annual" } => {
    const rawMonthly = monthlyUnits(v, rate.unit, monthlySpendAed, aedPerUnit);
    let cap: "monthly" | "annual" | undefined;
    let capped = rawMonthly;
    if (monthlyCap !== null && capped > monthlyCap) {
      capped = monthlyCap; // monthly first
      cap = "monthly";
    }
    let annual = capped * 12;
    if (annualCap !== null && annual > annualCap) {
      annual = annualCap;
      cap = "annual";
    }
    return { units: annual, aed: annual * aedPerUnit, cap };
  };

  const low = earn(lo);
  // For an unbounded upper rate we cannot invent a ceiling — max mirrors min and we flag it.
  const high = hi === null ? low : earn(hi);
  const unbounded = hi === null && rate.value === null;

  return {
    annualUnits: { min: low.units, max: unbounded ? null : high.units },
    annualValueAed: { min: low.aed, max: high.aed },
    capBound: low.cap ?? high.cap,
    unbounded,
  };
}

// ===========================================================================
// Shared scoring core: assign spend across ONE OR MORE cards, exactly.
//
// This is the single source of truth both scoreCard and optimizePortfolio use.
// scoreCard(card) is just earnAcrossCards([card]); the portfolio optimizer runs
// earnAcrossCards on each candidate subset. Because it's literally the same
// function, a single card scored on its own and the best-1-card portfolio return
// identical numbers by construction.
//
// The assignment rule (unified): each AED of spend earns on the best-yielding
// option AVAILABLE IN CONTEXT; when an option's reward cap is full, the overflow
// flows to the next-best option — another card in a portfolio, or the SAME card's
// base rate for a lone card. This matches how the cards actually work: a bonus cap
// means "no more BONUS," not "no more earning" — spend past the cap still earns
// the base rate. Spend only earns nothing if every eligible option's cap is full.
//
// We solve the assignment EXACTLY (not greedily) as a min-cost max-flow, because
// caps make naive per-category greedy wrong: filling a shared/capped bonus with
// one category can starve another that had no other good home. At <=3 cards /
// ~10 categories this is cheap, so correctness is free.
// ===========================================================================

/** Float tolerance for flow arithmetic and value comparisons (AED are continuous). */
const EPS = 1e-9;

/**
 * Per-card data that doesn't depend on the portfolio (options, valuation, fees).
 * Precomputed once so the optimizer can reuse it across every candidate subset.
 */
export interface CardData {
  card: Card;
  options: EarnOption[];
  aedPerUnit: number;
  valuation: ValuationEntry;
  fees: FeeBreakdown;
  /** Structural flags from option-building (e.g. an unrecognized reward category). */
  buildFlags: ScoreFlag[];
  /** Parallel to `options`: expected AED/AED yield used for routing decisions. */
  yields: number[];
  /** Parallel to `options`: annual AED-spend capacity before the reward cap binds (null = uncapped). */
  capacities: (number | null)[];
}

/**
 * Expected reward-currency units per 1 AED spent, using the rate's MIDPOINT when
 * it's a bounded range (so a genuinely-valuable "up to X%" option isn't ignored)
 * and its lower bound when unbounded (we refuse to invent a ceiling). For a
 * resolved rate this equals the exact yield — so for the real cards (none of which
 * has a range rate among scored cards) routing is identical to a point estimate.
 *
 * why expected value for routing: the assignment is a decision under uncertainty.
 * Routing on the expected rate is the neutral choice; realized value is then
 * reported as a min/max range around it.
 */
function expectedUnitsPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  if (rate.unit === null) return 0;
  const v =
    rate.value ??
    (rate.range
      ? rate.range.max === null
        ? rate.range.min
        : (rate.range.min + rate.range.max) / 2
      : 0);
  return monthlyUnits(v, rate.unit, 1, aedPerUnit);
}

/** Expected AED earned per 1 AED spent — the routing weight for an option. */
function expectedYieldPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  return expectedUnitsPerAed(rate, aedPerUnit) * aedPerUnit;
}

/**
 * Effective ANNUAL AED-spend capacity of an option: the amount of spend past
 * which its reward cap binds and additional spend here earns nothing (so the
 * overflow must route to the next-best option). null = uncapped.
 *
 * Derivation: max annual reward units = min(monthlyCap*12, annualCap). Dividing
 * by units-per-AED converts that unit ceiling into an AED-spend ceiling. Assumes
 * even monthly spend — the same steady-state assumption the rest of the engine makes.
 */
function optionCapacityAnnualAed(option: EarnOption, aedPerUnit: number): number | null {
  if (option.monthlyCap === null && option.annualCap === null) return null;
  const unitsPerAed = expectedUnitsPerAed(option.rate, aedPerUnit);
  // A zero-yield option (unresolved/0% rate) earns nothing regardless, so its cap
  // is immaterial — leave it uncapped for the flow and let earnOnOption report 0.
  if (unitsPerAed <= 0) return null;
  // Caps in reward-currency UNITS (converted from AED for cashback cards).
  const mCap = resolveCapUnits(option.monthlyCap, option.capsInAed, aedPerUnit);
  const aCap = resolveCapUnits(option.annualCap, option.capsInAed, aedPerUnit);
  const capUnits = Math.min(
    mCap !== null ? mCap * 12 : Infinity,
    aCap !== null ? aCap : Infinity,
  );
  return capUnits / unitsPerAed;
}

/** How much spend an option absorbs before its cap binds, in the CAP'S OWN period. */
export interface SpendThreshold {
  period: "monthly" | "annual";
  /** AED of spend in this option's categories past which the bonus stops paying. */
  spendAed: number;
}

/**
 * The spend thresholds at which an option's caps bind, each stated in the period
 * the cap is actually written in.
 *
 * why this exists ALONGSIDE `optionCapacityAnnualAed` rather than being derived from
 * it: that function deliberately collapses both caps into ONE annual number via
 * `min(monthlyCap * 12, annualCap)`, which is the right input for the flow solver and
 * carries the engine's usual even-monthly-spend assumption. For telling a USER "after
 * AED 6,000 of groceries this month the bonus stops", that assumption is exactly what
 * must not be there — a monthly cap is a fact about a month, and annualising it (or
 * de-annualising an annual cap) invents a spending pattern.
 *
 * So each cap is reported in its own period and never converted between them. Both
 * numbers are exact. They share `expectedUnitsPerAed` and `resolveCapUnits` with the
 * capacity function above, so the two cannot drift on how a cap becomes AED.
 *
 * Returns [] for an uncapped or zero-yield option. Callers must handle a RANGE rate
 * themselves — see `cap-thresholds.ts`, which refuses to state a threshold off a
 * midpoint.
 */
export function optionSpendThresholds(option: EarnOption, aedPerUnit: number): SpendThreshold[] {
  const unitsPerAed = expectedUnitsPerAed(option.rate, aedPerUnit);
  if (unitsPerAed <= 0) return [];
  const out: SpendThreshold[] = [];
  const mCap = resolveCapUnits(option.monthlyCap, option.capsInAed, aedPerUnit);
  const aCap = resolveCapUnits(option.annualCap, option.capsInAed, aedPerUnit);
  if (mCap !== null) out.push({ period: "monthly", spendAed: mCap / unitsPerAed });
  if (aCap !== null) out.push({ period: "annual", spendAed: aCap / unitsPerAed });
  return out;
}

/** Precompute the portfolio-independent data for one card. */
/**
 * Apply a card's `excluded_spend` list: spend in an excluded category earns
 * NOTHING on this card.
 *
 * Implemented by narrowing each option's match rule so no option can claim the
 * excluded category — a catchall becomes an explicit list of every category
 * EXCEPT the excluded ones, and a categories rule that ends up empty becomes
 * "unmatched".
 *
 * why narrow the rules instead of zeroing the rate: a 0-rate option is still an
 * edge the min-cost flow may route spend down. Spend parked on a zero-yield edge
 * is spend another card in the portfolio could have earned on. Removing the card's
 * claim to that category makes the allocator route around it, which is the real
 * behaviour — the issuer doesn't pay, and the user would simply use another card.
 *
 * Runs BEFORE scoring (in precomputeCardData), so every consumer — scoreCard,
 * which-card, the portfolio optimizer — sees the same narrowed options.
 */
function applyExcludedSpend(
  card: Card,
  options: EarnOption[],
): { options: EarnOption[]; flags: ScoreFlag[] } {
  const excluded = card.excluded_spend;
  if (!excluded || excluded.length === 0) return { options, flags: [] };

  const flags: ScoreFlag[] = [];
  const known = new Set<SpendCategory>();
  for (const e of excluded) {
    // why flag instead of ignore: a typo'd category would silently disable the
    // exclusion and quietly overstate the card — the exact failure this models away.
    // Matching against the canonical list (rather than testing then casting) is what
    // narrows the raw string to a SpendCategory without an assertion.
    const canonical = SPEND_CATEGORIES.find((c) => c === e.category);
    if (!canonical) {
      flags.push({
        level: "unknown",
        message: `Unknown excluded spend category "${label(e.category)}" on ${card.name} - exclusion NOT applied`,
      });
      continue;
    }
    known.add(canonical);
    flags.push({ level: "low", message: `${label(canonical)} earns nothing on this card: ${e.reason}` });
  }
  if (known.size === 0) return { options, flags };

  const narrowed = options.map((o): EarnOption => {
    if (o.rule.kind === "catchall") {
      return { ...o, rule: narrowCatchall(o.rule, known) };
    }
    if (o.rule.kind === "categories") {
      const kept = o.rule.categories.filter((c) => !known.has(c));
      return kept.length === 0
        ? { ...o, rule: { kind: "unmatched", reason: `all categories excluded on ${card.name}` } }
        : { ...o, rule: { kind: "categories", categories: kept } };
    }
    return o; // already unmatched
  });

  return { options: narrowed, flags };
}

/**
 * Title-case a category key for a human-readable flag ("international" ->
 * "International", "video_streaming" -> "Video Streaming").
 *
 * Every flag message that names a category runs through this. The keys are
 * snake_case because that is how the source data spells them, and a receipt the
 * user reads should not leak the storage format.
 */
export function label(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Lock spend into a card's SUPPRESSED categories — the fix for the "penalty bucket"
 * defect.
 *
 * The min-cost flow treats every eligible option as a genuine choice, which is right
 * ACROSS cards (you decide which card to swipe) and wrong WITHIN one card: the
 * issuer's merchant category code decides which bucket a purchase falls into. You
 * cannot elect to have petrol scored as general retail.
 *
 * So where a card names a category at a rate BELOW its own catch-all — a suppressed
 * or "penalty" bucket, which UAE issuers use heavily for fuel, government, utilities
 * and school fees — the flow would route that spend into the (uncapped) base rate
 * and pay it the higher figure. On the real dataset that was 16 rates across 12
 * cards; rakbank_world's 0.25% bucket received exactly AED 0 of the spend it governs.
 *
 * A category is suppressed when EVERY option naming it yields less than the
 * catch-all. If any named option beats the catch-all, the good bucket genuinely
 * exists and the flow may use it — and over-cap spend must still be free to fall
 * back to the base rate, which is the deliberate reroute rule this must not break.
 *
 * why compare YIELDS rather than rate strings: a card can quote a percent in one
 * category and points-per-AED in another, so only the AED-per-AED yield is comparable.
 */
function applySuppressedCategoryLock(
  card: Card,
  options: EarnOption[],
  yields: number[],
): { options: EarnOption[]; flags: ScoreFlag[] } {
  // The best a catch-all pays, and the best any NAMED category pays, per category.
  let catchallYield = 0;
  options.forEach((o, i) => {
    if (o.rule.kind === "catchall") catchallYield = Math.max(catchallYield, yields[i]!);
  });
  if (catchallYield <= 0) return { options, flags: [] }; // nothing to escape to

  const bestNamed = new Map<SpendCategory, number>();
  options.forEach((o, i) => {
    if (o.rule.kind !== "categories") return;
    for (const c of o.rule.categories) {
      bestNamed.set(c, Math.max(bestNamed.get(c) ?? 0, yields[i]!));
    }
  });

  const suppressed = SPEND_CATEGORIES.filter((c) => {
    const best = bestNamed.get(c);
    return best !== undefined && best < catchallYield - EPS;
  });
  if (suppressed.length === 0) return { options, flags: [] };

  return {
    options: options.map((o): EarnOption =>
      o.rule.kind === "catchall" ? { ...o, rule: narrowCatchall(o.rule, suppressed) } : o,
    ),
    // Stated, not silent: this is a real and often surprising product term, and it
    // is the difference between a headline rate and what a UAE household actually
    // earns on school fees and petrol. Level "low" (a caveat, not an uncertainty) —
    // the number is exact, it is simply lower than the card's advertised base.
    flags: [
      {
        level: "low",
        message: `${suppressed.map(label).join(", ")} earn ${card.name}'s reduced rate, not its base rate - that spend cannot fall back to the base`,
      },
    ],
  };
}

/**
 * Options describing what the caller KNOWS about where spend happens. Everything
 * here narrows what the scorer is allowed to assume; none of it is card data.
 *
 * The two fields are the two ways a merchant lock can stop being an assumption —
 * the user told us the share, or the caller already resolved the merchant. A lock
 * covered by neither is bounded rather than credited; see `boundMerchantLockedRates`.
 */
export interface ScoringOptions {
  /**
   * What fraction of the relevant categories' spend actually happens at each
   * bonused merchant ("LuLu" -> 0.3). See merchant-share.ts: enforced in the
   * allocator as a flow CAPACITY, so the remainder flows on to the next-best
   * option and two cards bonusing one merchant share a single pool.
   */
  merchantShares?: MerchantShares;
  /**
   * Set ONLY by a caller that knows which merchant the spend is at — today that is
   * `which-card.ts`, which resolves a merchant name and drops every bonus locked to
   * a different one before scoring. Any merchant-locked bonus that survives that
   * filter genuinely applies, so it is scored at its full rate.
   */
  merchantLocksResolved?: boolean;
}

/**
 * Bound a merchant-locked bonus by the thing a generic spending profile cannot
 * know: WHERE the spend happened.
 *
 * why this exists: `MATCH_TABLE` maps a merchant-locked bonus to its nearest
 * canonical category — "emaar_malls" -> other, "lulu_supermarket" -> groceries,
 * "first_10_talabat_orders" -> dining — and the scorer then applied the bonus to ALL
 * of that category's spend, flagging it as an optimistic assumption but still
 * crediting it in full. Read one card at a time that is defensible: a LuLu shopper
 * really does earn 8 points/AED at LuLu.
 *
 * It is not defensible under SELECTION, and it is the same maximum-of-maxima defect
 * the "Up to X%" ceiling fork had. `optimizePortfolio` scores ~53 cards and keeps
 * the best 1-3, so it will pick whichever card carries the most optimistic merchant
 * assumption — and worse, it can pick THREE cards exploiting three DIFFERENT
 * merchant assumptions at once, simultaneously assuming the user does all their
 * general retail at Emaar malls, all their groceries at LuLu, and all their dining
 * through Talabat. Measured over a weighted UAE population these assumptions were
 * worth ~2.34 percentage points of the reported optimal return.
 *
 * The honest bound is 0..full: absent any statement, the user spends 0% to 100% of
 * the category there and we cannot narrow it. So the rate becomes a range, exactly
 * as an unqualified "up to" ceiling does — no realization share is invented, and
 * the card is not zeroed either: its upside is still the max of the range.
 *
 * why this is a FALLBACK and not the model: a bound is what you emit when you did
 * not ask. Asking is better, and `merchantShares` is the answer — a stated share is
 * enforced as a flow capacity, which a rate haircut gets wrong in two ways (the
 * remainder would be destroyed rather than reallocated, and two cards bonusing one
 * merchant would each get the full share). So a lock is bounded ONLY when no share
 * was stated for it and the caller has not resolved the merchant. The two mechanisms
 * never both act on the same option.
 */
function boundMerchantLockedRates(
  options: EarnOption[],
  shares: ResolvedMerchantShares | undefined,
  merchantLocksResolved: boolean,
): EarnOption[] {
  if (merchantLocksResolved) return options;
  return options.map((o): EarnOption => {
    if (o.rule.kind !== "categories" || o.rule.merchant === undefined) return o;
    // A share the user STATED is an input; the allocator enforces it as a capacity,
    // so the rate must stay exactly what the card pays at that merchant.
    if (shareFor(shares, o.rule.merchant) !== undefined) return o;
    const rate = o.rate;
    // Already unresolved (e.g. a merchant-locked "Up to X%"): its range already
    // starts at 0, so there is nothing further to bound.
    if (rate.value === null) return o;
    return {
      ...o,
      rate: {
        ...rate,
        value: null,
        confidence: "unknown",
        range: { min: 0, max: rate.value },
        note: `Bonus pays only at ${o.rule.merchant}; nobody has said what share of this category is spent there, so it is bounded 0..${rate.raw}`,
      },
    };
  });
}

export function precomputeCardData(
  card: Card,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
  scoringOptions: ScoringOptions = {},
): CardData {
  const { shares } = sanitizeMerchantShares(scoringOptions.merchantShares);
  const built = buildEarnOptions(card);
  const excludedResult = applyExcludedSpend(card, built.options);
  const valuation = resolveValuation(card.rewards.currency, valuations);

  /*
    ORDER MATTERS, and it is the merchant bound that has to come last.

    The suppressed-category lock asks a question about the CARD's own rate table —
    "does this card name a category at less than its own catch-all" — which is a
    structural fact about the product and must not change with what we happen to
    know about the user's merchants. So it is computed on the UNBOUNDED yields.
    Bounding first would push a merchant option's yield to its midpoint and could
    flip a bucket in or out of "suppressed" for reasons that have nothing to do
    with the issuer's category schedule.
  */
  const unboundedYields = excludedResult.options.map((o) =>
    expectedYieldPerAed(o.rate, valuation.aedPerUnit),
  );
  const suppressedResult = applySuppressedCategoryLock(
    card,
    excludedResult.options,
    unboundedYields,
  );
  const options = boundMerchantLockedRates(
    suppressedResult.options,
    shares,
    scoringOptions.merchantLocksResolved ?? false,
  );
  // Recomputed because bounding rewrites rates: the flow must route on the BOUNDED
  // yield, or the bound would be reported but not acted on.
  const yields = options.map((o) => expectedYieldPerAed(o.rate, valuation.aedPerUnit));
  const flags = [...built.flags, ...excludedResult.flags, ...suppressedResult.flags];
  return {
    card,
    options,
    aedPerUnit: valuation.aedPerUnit,
    valuation,
    fees: computeFees(card),
    buildFlags: flags,
    yields,
    capacities: options.map((o) => optionCapacityAnnualAed(o, valuation.aedPerUnit)),
  };
}


/**
 * Which cap direction (monthly vs annual) bounds an option — for the receipt when
 * the FLOW saturated the option's capacity (earnOnOption itself won't report a cap
 * when spend was pre-limited to exactly the cap).
 */
function bindingCapDirection(option: EarnOption): "monthly" | "annual" | undefined {
  if (option.monthlyCap === null && option.annualCap === null) return undefined;
  const monthlyAsAnnual = option.monthlyCap !== null ? option.monthlyCap * 12 : Infinity;
  const annual = option.annualCap !== null ? option.annualCap : Infinity;
  return monthlyAsAnnual <= annual ? "monthly" : "annual";
}

// ---------------------------------------------------------------------------
// Min-cost max-flow. We model routing spend as a transportation problem:
//
//     source ──[spend]──> category ──[eligible]──> option ──[cap]──> sink
//                              └──[share]──> merchant gate ──┘
//
//   • source -> category c : capacity = c's ANNUAL spend, cost 0
//   • category c -> option o: exists iff o can earn on c; capacity ∞;
//                             cost = MAXY - yield(o)   (>= 0 after the shift)
//   • option o -> sink      : capacity = o's annual AED-spend cap (∞ if uncapped)
//
// MERCHANT GATES. An option whose bonus is locked to a merchant the user has given
// a SHARE for does not hang off the category directly. It hangs off a per-(category,
// merchant) gate node whose inbound capacity is share x that category's annual
// spend. Everything else about the solve is unchanged — the cost still sits on the
// gate -> option edge, so path costs, and therefore optimality, are identical.
//
// why a node and not a per-edge capacity: the gate is what makes the share a POOL.
// Two cards bonusing LuLu draw from one 30%-of-groceries pool instead of 30% each,
// which is the real constraint — your LuLu spend does not double because you carry
// a second LuLu card. A per-edge cap would silently allow exactly that.
//
// Minimising total cost maximises total yield: every valid assignment routes the
// same total flow (all the spend), so sum((MAXY - y)*flow) is minimised exactly
// when sum(y*flow) is maximised. The MAXY shift keeps costs non-negative, so
// successive-shortest-path (SPFA) augmentation is provably optimal.
//
// A virtual zero-yield "unearned" option (uncapped, worst cost) keeps the flow
// feasible even when every real cap is full — spend that can't earn anywhere lands
// there and is reported, never crashing the solver or silently vanishing.
// ---------------------------------------------------------------------------

interface FlowEdge {
  to: number;
  cap: number;
  cost: number;
  flow: number;
}

class MinCostFlow {
  private edges: FlowEdge[] = [];
  private adj: number[][];

  constructor(private n: number) {
    this.adj = Array.from({ length: n }, () => []);
  }

  /** Add a directed edge u->v plus its (zero-capacity) residual reverse edge. */
  addEdge(u: number, v: number, cap: number, cost: number): number {
    const id = this.edges.length;
    this.adj[u]!.push(id);
    this.edges.push({ to: v, cap, cost, flow: 0 });
    this.adj[v]!.push(id + 1);
    this.edges.push({ to: u, cap: 0, cost: -cost, flow: 0 });
    return id;
  }

  /** Flow currently pushed through a forward edge (by the id addEdge returned). */
  flowOn(id: number): number {
    return this.edges[id]!.flow;
  }

  /** Saturate max flow from s to t at minimum total cost (SPFA shortest paths). */
  solve(s: number, t: number): void {
    for (;;) {
      const dist = new Array(this.n).fill(Infinity);
      const inQueue = new Array(this.n).fill(false);
      const prevEdge = new Array(this.n).fill(-1);
      dist[s] = 0;
      const queue: number[] = [s];
      inQueue[s] = true;
      while (queue.length > 0) {
        const u = queue.shift()!;
        inQueue[u] = false;
        for (const id of this.adj[u]!) {
          const e = this.edges[id]!;
          if (e.cap - e.flow > EPS && dist[u] + e.cost < dist[e.to] - EPS) {
            dist[e.to] = dist[u] + e.cost;
            prevEdge[e.to] = id;
            if (!inQueue[e.to]) {
              inQueue[e.to] = true;
              queue.push(e.to);
            }
          }
        }
      }
      if (dist[t] === Infinity) break; // no augmenting path left → max flow reached

      let push = Infinity;
      for (let v = t; v !== s; ) {
        const id = prevEdge[v]!;
        const e = this.edges[id]!;
        push = Math.min(push, e.cap - e.flow);
        v = this.edges[id ^ 1]!.to; // reverse edge's target = the predecessor node
      }
      for (let v = t; v !== s; ) {
        const id = prevEdge[v]!;
        this.edges[id]!.flow += push;
        this.edges[id ^ 1]!.flow -= push;
        v = this.edges[id ^ 1]!.to;
      }
    }
  }
}

/** A single option belonging to a specific card in the set being scored. */
interface FlatOption {
  cardIndex: number;
  option: EarnOption;
  yield: number;
  capAnnualAed: number | null;
  aedPerUnit: number;
}

/** Flatten every card's options into one indexed list (stable order). */
function flattenOptions(cards: CardData[]): FlatOption[] {
  const flat: FlatOption[] = [];
  cards.forEach((cd, cardIndex) => {
    cd.options.forEach((option, i) => {
      flat.push({
        cardIndex,
        option,
        yield: cd.yields[i]!,
        capAnnualAed: cd.capacities[i]!,
        aedPerUnit: cd.aedPerUnit,
      });
    });
  });
  return flat;
}

/** Raw flow solution: annual AED spend on each option, on each (category, option) edge. */
interface FlowSolution {
  optionSpend: number[];
  edgeSpend: { category: SpendCategory; optionIndex: number; annualAed: number }[];
  unearnedAnnualAed: number;
}

/** The merchant a flattened option's bonus is locked to, if any. */
function lockedMerchant(po: FlatOption): string | undefined {
  return po.option.rule.kind === "categories" ? po.option.rule.merchant : undefined;
}

function solveAssignment(
  spending: SpendingProfile,
  cards: CardData[],
  flat: FlatOption[],
  shares: ResolvedMerchantShares | undefined,
): FlowSolution {
  const categories = (Object.keys(spending) as SpendCategory[]).filter(
    (c) => (spending[c] ?? 0) > 0,
  );

  const maxYield = flat.reduce((m, o) => Math.max(m, o.yield), 0);

  /*
    Merchant gates, one per (category, merchant) pair for which the user stated a
    share AND some eligible option is locked to that merchant. Built first because
    the gates are nodes and the node count has to be known before the graph is.

    A merchant with NO stated share gets no gate, so its options keep their direct
    category edge and the old full-category assumption — that is what makes shares
    an additive change rather than a silent re-scoring for callers that don't ask.
  */
  interface Gate {
    categoryIndex: number;
    /** Annual AED of this category that may reach this merchant: share x spend. */
    capAnnualAed: number;
  }
  const gates: Gate[] = [];
  const gateOf = new Map<string, number>(); // `${categoryIndex}|${merchantKey}` -> gate index
  // Same normalization `shareFor` uses, so two spellings of one merchant across two
  // cards collapse into ONE gate — i.e. one shared pool, which is the whole point.
  const gateKey = (ci: number, merchant: string) => `${ci}|${normalizeMerchantName(merchant)}`;

  if (shares && shares.size > 0) {
    categories.forEach((c, ci) => {
      flat.forEach((po) => {
        const merchant = lockedMerchant(po);
        if (!merchant) return;
        const share = shareFor(shares, merchant);
        if (share === undefined) return;
        if (!candidatesFor(c, cards[po.cardIndex]!.options).includes(po.option)) return;
        const key = gateKey(ci, merchant);
        if (gateOf.has(key)) return; // one gate per (category, merchant), shared by all cards
        gateOf.set(key, gates.length);
        gates.push({ categoryIndex: ci, capAnnualAed: share * (spending[c] ?? 0) * 12 });
      });
    });
  }

  // Node layout: [source] [categories...] [options...] [gates...] [unearned] [sink].
  const C = categories.length;
  const O = flat.length;
  const SOURCE = 0;
  const CAT0 = 1;
  const OPT0 = CAT0 + C;
  const GATE0 = OPT0 + O;
  const UNEARNED = GATE0 + gates.length;
  const SINK = UNEARNED + 1;
  const flow = new MinCostFlow(SINK + 1);

  categories.forEach((c, ci) => {
    flow.addEdge(SOURCE, CAT0 + ci, (spending[c] ?? 0) * 12, 0);
  });

  // category -> gate: the share constraint. Cost 0 — the yield cost stays on the
  // gate -> option edge below, so a gated path costs exactly what it did before.
  gates.forEach((g, gi) => {
    flow.addEdge(CAT0 + g.categoryIndex, GATE0 + gi, g.capAnnualAed, 0);
  });

  const edgeIds: { category: SpendCategory; optionIndex: number; edgeId: number }[] = [];
  categories.forEach((c, ci) => {
    flat.forEach((po, oi) => {
      // Eligibility uses the same candidatesFor as scoreCard — one source of truth.
      const eligible = candidatesFor(c, cards[po.cardIndex]!.options).includes(po.option);
      if (!eligible) return;
      // A gated option is fed by its merchant's pool, not by the raw category. The
      // gate is per-category, so flow on this edge is still attributable to `c`.
      const merchant = lockedMerchant(po);
      const gi = merchant !== undefined ? gateOf.get(gateKey(ci, merchant)) : undefined;
      const from = gi !== undefined ? GATE0 + gi : CAT0 + ci;
      const id = flow.addEdge(from, OPT0 + oi, Infinity, maxYield - po.yield);
      edgeIds.push({ category: c, optionIndex: oi, edgeId: id });
    });
    // category -> unearned (worst cost): feasibility if every real cap fills.
    flow.addEdge(CAT0 + ci, UNEARNED, Infinity, maxYield - 0);
  });

  const optSinkIds = flat.map((po, oi) =>
    flow.addEdge(OPT0 + oi, SINK, po.capAnnualAed ?? Infinity, 0),
  );
  const unearnedSinkId = flow.addEdge(UNEARNED, SINK, Infinity, 0);

  flow.solve(SOURCE, SINK);

  return {
    optionSpend: flat.map((_, oi) => flow.flowOn(optSinkIds[oi]!)),
    edgeSpend: edgeIds
      .map((e) => ({ category: e.category, optionIndex: e.optionIndex, annualAed: flow.flowOn(e.edgeId) }))
      .filter((e) => e.annualAed > EPS),
    unearnedAnnualAed: flow.flowOn(unearnedSinkId),
  };
}

/** One option that received spend, with its aggregate earnings (the per-option receipt). */
export interface OptionOutcome {
  cardIndex: number;
  option: EarnOption;
  aedPerUnit: number;
  /** Aggregate monthly AED routed to this option (may come from several categories). */
  monthlySpendAed: number;
  /** Categories feeding this option, in the user's category order. */
  spendCategories: SpendCategory[];
  /** Full earn result (annual units + AED range + unbounded flag) from the shared cap math. */
  earning: OptionEarning;
  /** Set when the flow saturated this option's cap. */
  capBound?: "monthly" | "annual";
  /** Set when the option relies on an optimistic merchant assumption. */
  merchantAssumption?: string;
}

/** One (category, option) slice that received spend (the "swipe THIS card" receipt). */
export interface SliceOutcome {
  spendCategory: SpendCategory;
  cardIndex: number;
  option: EarnOption;
  monthlySpendAed: number;
  /** This slice's proportional share of its option's (possibly capped) value. */
  annualValueAed: AedRange;
  capBound?: "monthly" | "annual";
  merchantAssumption?: string;
}

/** The shared scoring result for a set of cards under one spending profile. */
export interface EarnResult {
  cards: CardData[];
  /** Only options that received spend. */
  optionOutcomes: OptionOutcome[];
  /** Only (category, option) slices that received spend. */
  slices: SliceOutcome[];
  /** Gross AED/year each card contributes (parallel to `cards`), AFTER any overall cap. */
  perCardGross: AedRange[];
  /** Gross AED/year across all cards, before fees. */
  grossAnnualValue: AedRange;
  /** Monthly AED that earns nothing because every eligible option's cap is full. */
  unearnedMonthlyAed: number;
  /**
   * Parallel to `cards`: true when the card's overall reward cap (rewards.overall_cap)
   * truncated its gross. Set so the receipt can flag "total capped" per card.
   */
  overallCapBoundByCard: boolean[];
}

/**
 * A card's overall reward cap (rewards.overall_cap) as an ANNUAL AED ceiling on its
 * total earnings, or null when uncapped.
 *
 * The cap is a MONTHLY figure (cbd_one's own rate string says "up to AED 135
 * monthly"), denominated like the card's category caps: AED for cashback cards,
 * reward-currency units otherwise. We convert to a monthly AED value, then annualize.
 */
function overallCapAnnualAed(card: Card, aedPerUnit: number): number | null {
  const cap = card.rewards.overall_cap;
  if (cap === null || cap === undefined) return null;
  const capsInAed = card.rewards.type === "cashback";
  const monthlyAed = capsInAed ? cap : cap * aedPerUnit;
  return monthlyAed * 12;
}

/**
 * Switch a card into its BELOW-THRESHOLD state (rewards.min_monthly_spend_required_aed).
 *
 *  - "forfeit": the whole cycle's rewards are lost. Drop EVERY option rather than
 *    zeroing the rates — a 0-rate option is still an edge the flow can route spend
 *    down, which would strand spend on a card earning nothing while another card in
 *    the portfolio could have earned on it. With no options the card cannot claim
 *    the spend at all, and for a lone forfeiting card the spend goes unearned,
 *    which is exactly the real outcome.
 *  - "degrade" (the default): bonus options go, catch-all options stay. The
 *    base_rate strings for these cards describe precisely the below-threshold
 *    behaviour ("... on all eligible spend when the AED 3,000 threshold is not met"),
 *    so the catch-all is the right fallback.
 */
function gateCardOff(cd: CardData): CardData {
  if ((cd.card.rewards.gate_mode ?? "degrade") === "forfeit") {
    return { ...cd, options: [], yields: [], capacities: [] };
  }
  const keep = cd.options
    .map((o, i) => (o.rule.kind === "catchall" ? i : -1))
    .filter((i) => i >= 0);
  return {
    ...cd,
    options: keep.map((i) => cd.options[i]!),
    yields: keep.map((i) => cd.yields[i]!),
    capacities: keep.map((i) => cd.capacities[i]!),
  };
}

/** Monthly AED the allocation routed to each card (parallel to `cards`). */
function allocatedMonthlyByCard(result: EarnResult, cardCount: number): number[] {
  const out = new Array<number>(cardCount).fill(0);
  for (const s of result.slices) out[s.cardIndex]! += s.monthlySpendAed;
  return out;
}

/** A card carrying a minimum-spend threshold, and what falling short costs it. */
interface GatedCard {
  index: number;
  threshold: number;
}

/**
 * Assign `spending` across `cards` optimally and report what each option/slice
 * earns. THE single source of truth for portfolio-aware earning — scoreCard and
 * optimizePortfolio both call it, so a lone card and a 1-card portfolio agree.
 *
 * ── Minimum-spend thresholds ────────────────────────────────────────────────────
 * `min_monthly_spend_required_aed` is a threshold on ONE card's own monthly spend.
 * This used to be evaluated against TOTAL profile spend, on the reasoning that for a
 * single card the two are identical (true) and that modelling it properly inside the
 * flow would make the gate non-linear (also true).
 *
 * It is non-linear, so it does NOT go inside the flow. But the shortcut was not a
 * small one: the optimizer's own recommended split routes only part of the spend to
 * each card, so it would score a card's bonus rates as active and then recommend an
 * allocation that switched them off. On all four spending archetypes the recommended
 * 3-card portfolio consisted entirely of cards below their thresholds, and the
 * engine's own best single card beat it in reality — on a mid-range profile the
 * claimed AED 9,859/yr was worth AED 127/yr.
 *
 * The gate is a DISJUNCTIVE constraint (each card is either above its threshold and
 * earning bonuses, or below it and degraded), which is what makes it non-linear. So
 * we enumerate the states instead of relaxing them: a portfolio holds at most 3
 * cards, hence at most 2^3 = 8 combinations, and typically 1–2 because most cards
 * carry no threshold at all. For each combination we solve the flow and then CHECK
 * the assumption against the resulting allocation, keeping only self-consistent
 * solutions — a card assumed to be earning bonuses must really receive its
 * threshold, and a card assumed degraded must really fall short. Among those we take
 * the best. That is exact at this scale, and it is the same "correctness is free
 * when the search space is small" argument the subset enumeration already rests on.
 */
export function earnAcrossCards(
  spending: SpendingProfile,
  inputCards: CardData[],
  shares?: ResolvedMerchantShares,
): EarnResult {
  const gated: GatedCard[] = inputCards
    .map((cd, index) => ({ index, threshold: cd.card.rewards.min_monthly_spend_required_aed ?? 0 }))
    .filter((g) => g.threshold > 0);

  if (gated.length === 0) return runAssignment(spending, inputCards, shares);

  // A card whose threshold exceeds the ENTIRE profile can never clear it, however
  // the spend is split, so it is forced off and needs no branch of its own.
  const totalMonthly = Object.values(spending).reduce((s, v) => s + (v ?? 0), 0);
  const switchable = gated.filter((g) => totalMonthly >= g.threshold - EPS);

  let best: EarnResult | null = null;
  let bestValue = -Infinity;
  let allOff: EarnResult | null = null;

  for (let mask = 0; mask < 1 << switchable.length; mask++) {
    // `on` = the cards this branch ASSUMES are above their threshold.
    const on = new Set<number>();
    switchable.forEach((g, bit) => {
      if (mask & (1 << bit)) on.add(g.index);
    });

    const cards = inputCards.map((cd, i) =>
      gated.some((g) => g.index === i) && !on.has(i) ? gateCardOff(cd) : cd,
    );
    const result = runAssignment(spending, cards, shares);
    const allocated = allocatedMonthlyByCard(result, cards.length);
    const annotated = annotateGateFlags(result, gated, allocated, on);

    // mask 0 switches every gated card off. That is always a SAFE answer — a card
    // we degrade but which really would have cleared its threshold is understated,
    // never overstated — so it is the fallback if nothing is self-consistent.
    if (mask === 0) allOff = annotated;

    // Self-consistency: a card we ASSUMED was earning bonuses must really receive
    // its threshold, and one we assumed degraded must really fall short. Both
    // directions matter — a card scored as degraded that actually clears its
    // threshold is not a real scenario either, since the issuer does not ask.
    const consistent = gated.every(
      (g) => on.has(g.index) === (allocated[g.index]! >= g.threshold - EPS),
    );
    if (!consistent) continue;

    // Rank branches on the demonstrable floor, then the midpoint — the same basis
    // the portfolio optimizer ranks on, so the two cannot disagree.
    const value = result.grossAnnualValue.min * 2 + result.grossAnnualValue.max;
    if (value > bestValue + EPS) {
      bestValue = value;
      best = annotated;
    }
  }

  // `allOff` is non-null: mask 0 always runs. The `?? runAssignment(...)` is only a
  // type-level fallback and is unreachable.
  return best ?? allOff ?? runAssignment(spending, inputCards, shares);
}

/**
 * Record, on the cards themselves, that a gate switched a card off — quoting the
 * spend it ACTUALLY receives in this portfolio, which is the number the user needs
 * in order to act ("consolidate onto this card and the bonus turns on").
 */
function annotateGateFlags(
  result: EarnResult,
  gated: GatedCard[],
  allocated: number[],
  on: Set<number>,
): EarnResult {
  if (gated.every((g) => on.has(g.index))) return result; // nothing was gated off
  return {
    ...result,
    cards: result.cards.map((cd, i) => {
      const g = gated.find((x) => x.index === i);
      if (!g || on.has(i)) return cd;
      const forfeits = (cd.card.rewards.gate_mode ?? "degrade") === "forfeit";
      return {
        ...cd,
        buildFlags: [
          ...cd.buildFlags,
          {
            level: "low",
            message:
              `This card receives AED ${allocated[i]!.toFixed(0)}/mo of your spend, below its ` +
              `AED ${g.threshold}/mo minimum spend - ${
                forfeits
                  ? "it FORFEITS all rewards for the cycle, earning nothing"
                  : "bonus rates disabled, earns the base rate only"
              }`,
          },
        ],
      };
    }),
  };
}

/** Solve the assignment for one fixed set of cards (gate states already applied). */
function runAssignment(
  spending: SpendingProfile,
  cards: CardData[],
  shares: ResolvedMerchantShares | undefined,
): EarnResult {
  const flat = flattenOptions(cards);
  const sol = solveAssignment(spending, cards, flat, shares);

  // Per-option aggregate earnings. Caps apply to the AGGREGATE on an option (several
  // categories can feed one option), so value is computed at the option level.
  const optionValue: AedRange[] = flat.map((po, oi) => {
    const monthlyAgg = sol.optionSpend[oi]! / 12;
    if (monthlyAgg <= EPS) return { min: 0, max: 0 };
    return earnOnOption(po.option, monthlyAgg, po.aedPerUnit).annualValueAed;
  });
  const optionCapBound: (("monthly" | "annual") | undefined)[] = flat.map((po, oi) => {
    const cap = po.capAnnualAed;
    if (cap === null) return undefined;
    return sol.optionSpend[oi]! >= cap - EPS ? bindingCapDirection(po.option) : undefined;
  });

  // Per-option outcome (for the single-card receipt). Categories feeding each option
  // are gathered from the slices, preserving the user's category order.
  const catsByOption = new Map<number, SpendCategory[]>();
  for (const e of sol.edgeSpend) {
    const list = catsByOption.get(e.optionIndex) ?? [];
    if (!list.includes(e.category)) list.push(e.category);
    catsByOption.set(e.optionIndex, list);
  }
  const optionOutcomes: OptionOutcome[] = [];
  flat.forEach((po, oi) => {
    const monthly = sol.optionSpend[oi]! / 12;
    if (monthly <= EPS) return;
    optionOutcomes.push({
      cardIndex: po.cardIndex,
      option: po.option,
      aedPerUnit: po.aedPerUnit,
      monthlySpendAed: monthly,
      spendCategories: catsByOption.get(oi) ?? [],
      earning: earnOnOption(po.option, monthly, po.aedPerUnit),
      capBound: optionCapBound[oi],
      merchantAssumption: po.option.rule.kind === "categories" ? po.option.rule.merchant : undefined,
    });
  });

  // Per-slice outcome (for the portfolio's "swipe THIS card" receipt). A slice takes
  // its option's value in proportion to its spend, so slices sum back to the option.
  const slices: SliceOutcome[] = sol.edgeSpend.map((e) => {
    const po = flat[e.optionIndex]!;
    const totalOnOption = sol.optionSpend[e.optionIndex]!;
    const share = totalOnOption > EPS ? e.annualAed / totalOnOption : 0;
    const optVal = optionValue[e.optionIndex]!;
    return {
      spendCategory: e.category,
      cardIndex: po.cardIndex,
      option: po.option,
      monthlySpendAed: e.annualAed / 12,
      annualValueAed: { min: optVal.min * share, max: optVal.max * share },
      capBound: optionCapBound[e.optionIndex],
      merchantAssumption: po.option.rule.kind === "categories" ? po.option.rule.merchant : undefined,
    };
  });

  // Per-card gross (pre-cap), summed from its options.
  const perCardGross: AedRange[] = cards.map(() => ({ min: 0, max: 0 }));
  flat.forEach((po, oi) => {
    perCardGross[po.cardIndex]!.min += optionValue[oi]!.min;
    perCardGross[po.cardIndex]!.max += optionValue[oi]!.max;
  });

  // Overall reward cap (rewards.overall_cap): applied AFTER per-category earning,
  // BEFORE fees, as a ceiling on each card's total gross. why post-hoc rather than
  // inside the flow: the cap constrains the SUM across categories, not any single
  // option, so it can't be expressed as an edge capacity; capping the aggregate is
  // the faithful model and, for a single card, exact. In a multi-card portfolio the
  // allocator doesn't re-route around a bound overall cap — a documented simplification.
  const overallCapBoundByCard: boolean[] = cards.map((cd, i) => {
    const capAed = overallCapAnnualAed(cd.card, cd.aedPerUnit);
    if (capAed === null) return false;
    const g = perCardGross[i]!;
    const bound = g.max > capAed + EPS || g.min > capAed + EPS;
    g.min = Math.min(g.min, capAed);
    g.max = Math.min(g.max, capAed);
    return bound;
  });

  const grossAnnualValue = perCardGross.reduce(
    (acc, g) => ({ min: acc.min + g.min, max: acc.max + g.max }),
    { min: 0, max: 0 },
  );

  return {
    cards,
    optionOutcomes,
    slices,
    perCardGross,
    grossAnnualValue,
    unearnedMonthlyAed: sol.unearnedAnnualAed / 12,
    overallCapBoundByCard,
  };
}

// ---------------------------------------------------------------------------
// scoreCard.
// ---------------------------------------------------------------------------

export function scoreCard(
  spending: SpendingProfile,
  card: Card,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
  scoringOptions: ScoringOptions = {},
): CardScore {
  const valuation = resolveValuation(card.rewards.currency, valuations);
  // Validate once, here at the public boundary — the allocator's inner loops then
  // work on an already-checked map. An invalid entry is DROPPED, not clamped, so it
  // falls back to "unstated" and keeps its loud flag (see sanitizeMerchantShares).
  const { shares } = sanitizeMerchantShares(scoringOptions.merchantShares);

  // --- Benched cards: excluded from scoring pending data verification. We return
  // a zeroed, clearly-flagged score rather than guessing a reward structure or
  // dropping the card, so it stays visible but is never ranked. ---
  if (card.excluded_from_scoring) {
    return {
      cardId: card.id,
      rewardCurrency: card.rewards.currency,
      valuation,
      netAnnualValue: 0,
      netAnnualValueRange: { min: 0, max: 0 },
      netAnnualValueYear1: 0,
      grossAnnualValue: { min: 0, max: 0 },
      fees: computeFees(card),
      breakdown: [],
      flags: [
        {
          level: "unknown",
          message: `Excluded from scoring - pending data verification${card.notes ? ` (${card.notes})` : ""}`,
        },
      ],
      uncertain: true,
      benched: true,
    };
  }

  // --- Assign + earn via the SHARED core. scoreCard(card) is exactly a 1-card
  // portfolio, so it delegates to earnAcrossCards([card]) — the same computation
  // the optimizer runs. This is what makes scoreCard and best-1-card agree. ---
  // Both merchant mechanisms are wired here, and they are disjoint by construction:
  // precomputeCardData BOUNDS the locks nobody has accounted for, and earnAcrossCards
  // enforces the STATED shares as flow capacities. An option is never both.
  const cd = precomputeCardData(card, valuations, scoringOptions);
  const result = earnAcrossCards(spending, [cd], shares);

  // Structural flags first, read from the GATED card so a min-spend gate surfaces.
  const flags: ScoreFlag[] = [...result.cards[0]!.buildFlags];
  let uncertain = false;

  // --- Build the per-option receipt + inherit flags from each earning option. ---
  const breakdown: CategoryEarning[] = [];
  for (const o of result.optionOutcomes) {
    const rate = o.option.rate;
    breakdown.push({
      cardCategory: o.option.cardCategory,
      spendCategories: o.spendCategories,
      monthlySpendAed: o.monthlySpendAed,
      rate,
      annualUnits: o.earning.annualUnits,
      annualValueAed: o.earning.annualValueAed,
      capBound: o.capBound,
      merchantAssumption: o.merchantAssumption,
    });

    const on = label(o.option.cardCategory);

    if (rate.confidence === "unknown") {
      uncertain = true;
      flags.push({
        level: "unknown",
        message: `Unresolved rate on ${on} ("${rate.raw}") - scored as a range`,
      });
    } else if (rate.confidence === "low") {
      uncertain = true;
      flags.push({ level: "low", message: `Low-confidence rate on ${on} ("${rate.raw}")` });
    }
    if (o.earning.unbounded) {
      flags.push({
        level: "unknown",
        message: `${on} has an unbounded variable rate - upside not scored`,
      });
    }
    if (o.capBound) {
      // why the message changed from "not modeled": over-cap spend is no longer
      // dropped — it earns the card's base rate (the unified reroute rule).
      flags.push({
        level: "low",
        message: `${o.capBound} cap reached on ${on} - over-cap spend earns the base rate`,
      });
    }
    /*
      why the `monthlySpendAed > 0` guard: this flag asserts that we CREDITED spend
      at a merchant-specific rate as though all of that category's spend happened at
      the merchant. When the flow routed nothing to this option, no such assumption
      entered the score, and flagging it anyway condemns a card for an accelerator
      the user never touched — e.g. an Emirates/flydubai option on a profile with no
      such spend.

      MEASURED: on the current 53-card dataset this guard changes NOTHING — merchant
      rejections are 1,826 of 7,851 (card,profile) pairs with or without it, because
      every merchant option that flags also happens to carry spend. It is kept as
      correctness insurance for data where that stops holding, not as a live fix, and
      it must not be cited as one. The same guard on the rate-confidence flags above
      is likewise a no-op (those are nearly all base_rate strings, which always carry
      spend), so it is not applied there.
    */
    if (o.merchantAssumption && o.monthlySpendAed > 0) {
      const stated = shareFor(shares, o.merchantAssumption);
      const cats = o.spendCategories.map(label).join("/");
      /*
        THREE cases, in order of how much we actually know. The first two are
        knowledge; only the third is a gap, and only the third is `uncertain`.
      */
      if (stated !== undefined) {
        /*
          A share the USER stated is an input, not an assumption of ours — the same
          standing as the spend figures themselves, which we also don't mark
          uncertain. So this does NOT set `uncertain` and deliberately avoids the
          "spend occurs at" phrase: that is the mechanism by which answering the
          question moves a co-brand card into the publishable universe.

          It is still flagged, at "low", because it is the one number in the receipt
          the user can revise and immediately change the answer — and a share of 0
          is worth saying out loud, since it explains why a card they may have heard
          good things about scores as if the bonus didn't exist.
        */
        flags.push({
          level: "low",
          message:
            `${on}: counts the ${(stated * 100).toFixed(0)}% of your ${cats} spend ` +
            `you told us happens at ${o.merchantAssumption}`,
        });
      } else if (scoringOptions.merchantLocksResolved) {
        /*
          The caller RESOLVED the merchant (which-card.ts answering "which card at
          LuLu?"), so every lock that survived its filter genuinely applies and was
          scored at its full rate. Not `uncertain`: nothing was assumed. Still
          reported, because the answer is only valid at that merchant.
        */
        flags.push({
          level: "low",
          message: `${on}: confirmed at ${o.merchantAssumption} for this ${cats} spend`,
        });
      } else {
        /*
          Nobody stated a share and no merchant was resolved. The bonus is no longer
          ASSUMED across the whole category — precomputeCardData bounded it 0..full —
          but a bound is not a figure we can stand behind, so this stays `uncertain`
          and the card stays out of the study's SOUND universe exactly as before.

          The substring "spend occurs at" below is LOAD-BEARING: study-filters.ts's
          `unstated-merchant-assumption` clause matches on it, and that clause has
          already gone silently dead once (see that file's header — the category list
          splits "assumes spend occurs"). The wording changed when bounding landed;
          the marker was kept deliberately so the filter would not die a second time,
          and study-filters.test.ts fails loudly if it ever does.
        */
        uncertain = true;
        flags.push({
          level: "low",
          message:
            `${on}: bounded 0-to-full, because nobody has said what share of your ` +
            `${cats} spend occurs at ${o.merchantAssumption}`,
        });
      }
    }
  }

  // Report unmatched (un-scoreable) categories once, as a flag.
  for (const o of cd.options) {
    if (o.rule.kind === "unmatched") {
      flags.push({ level: "low", message: `${label(o.cardCategory)}: ${o.rule.reason}` });
    }
  }
  // Spend that couldn't earn anywhere (every option's cap full) — rare for one card.
  if (result.unearnedMonthlyAed > EPS) {
    flags.push({
      level: "low",
      message: `${result.unearnedMonthlyAed.toFixed(0)} AED/mo of spend exceeds this card's caps and earns nothing`,
    });
  }

  // Overall reward cap truncated total earnings (category lines above are pre-cap).
  if (result.overallCapBoundByCard[0]) {
    const capAed = overallCapAnnualAed(card, valuation.aedPerUnit)!;
    flags.push({
      level: "low",
      message: `Overall reward cap reached - total earnings capped at AED ${(capAed / 12).toFixed(0)}/mo (AED ${capAed.toFixed(0)}/yr); the per-category lines above are before this cap`,
    });
  }

  const grossMin = result.grossAnnualValue.min;
  const grossMax = result.grossAnnualValue.max;

  // --- Fees + valuation-confidence flag. ---
  const fees = cd.fees;
  if (valuation.confidence !== "high") {
    uncertain = true;
    flags.push({
      level: valuation.confidence === "low" ? "low" : "low",
      message: `Valuation of "${card.rewards.currency}" is ${valuation.confidence} confidence${
        valuation.note ? ` (${valuation.note})` : ""
      }`,
    });
  }

  // --- Reward expiry: state the term, don't price it. ---
  // why this does NOT set `uncertain` and does NOT reduce the value: the expiry is a
  // CERTAIN product term, not a soft estimate — the value is exactly what we say it
  // is, provided the user redeems within the window. What we can't know is their
  // redemption cadence, so we surface the constraint and let Engine 2's burn engine
  // rank it against the user's real dates. Marking this "uncertain" would wrongly
  // dilute the uncertainty signal that flags genuinely unresearched numbers.
  const expiry = PROGRAM_EXPIRY_DEFAULTS.find((e) => e.currency === card.rewards.currency);
  if (expiry) {
    flags.push({
      level: "low",
      message: `Rewards expire ${expiry.months} months ${
        expiry.basis === "from_earning" ? "after being earned" : "after your last account activity"
      } - redeem within that window or the value is lost (${expiry.note})`,
    });
  }

  const netMinOngoing = grossMin - fees.ongoingFeeAed;
  const netMaxOngoing = grossMax - fees.ongoingFeeAed;
  const netMinYear1 = grossMin - fees.year1FeeAed;
  const netMaxYear1 = grossMax - fees.year1FeeAed;
  if (grossMax !== grossMin) uncertain = true;

  const netAnnualValue = (netMinOngoing + netMaxOngoing) / 2;

  // --- Data-quality caveat: a card kept in the ranking but flagged for a known
  // data problem (e.g. enbd_visa_flexi's suspect earn rate). Loud + uncertain. ---
  if (card.data_caveat) {
    uncertain = true;
    flags.push({ level: "unknown", message: `Data caveat: ${card.data_caveat}` });
  }

  // --- Implausibility guardrail (permanent sanity check): net annual value should
  // never exceed the user's total annual spend — that would be a >100% return,
  // which in this dataset always means a bad earn rate or valuation, not a real
  // card. We FLAG it (never crash, never drop the card) so it can't be trusted
  // silently. Guarded on positive spend to avoid firing on an empty profile. ---
  const totalAnnualSpendAed = Object.values(spending).reduce((s, v) => s + (v ?? 0), 0) * 12;
  if (totalAnnualSpendAed > 0 && netAnnualValue > totalAnnualSpendAed) {
    uncertain = true;
    flags.push({
      level: "unknown",
      message: `Implausible - net annual value (${netAnnualValue.toFixed(0)} AED) exceeds total annual spend (${totalAnnualSpendAed.toFixed(0)} AED); check earn rate/valuation`,
    });
  }

  return {
    cardId: card.id,
    rewardCurrency: card.rewards.currency,
    valuation,
    // why midpoint for the single ranking number: it's a neutral expected value
    // across the uncertainty band. The full range is exposed alongside it.
    netAnnualValue,
    netAnnualValueRange: { min: netMinOngoing, max: netMaxOngoing },
    netAnnualValueYear1: (netMinYear1 + netMaxYear1) / 2,
    grossAnnualValue: { min: grossMin, max: grossMax },
    fees,
    breakdown,
    flags,
    uncertain,
    benched: false,
  };
}
