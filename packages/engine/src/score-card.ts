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
import {
  DEFAULT_VALUATIONS,
  resolveValuation,
  type ValuationEntry,
  type ValuationTable,
} from "./valuations";

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
 * How a card reward-category name maps to canonical spend categories.
 *  - `categories`: matches those specific spend categories. `merchant` marks an
 *    optimistic assumption (the bonus only applies at a specific merchant we
 *    can't see in a generic profile) — it lowers confidence rather than being
 *    dropped, so the card isn't unfairly zeroed.
 *  - `catchall`: eligible for ANY spend as a fallback (all_spend / all_other_spend).
 *  - `user_chosen`: a "flexi" bonus the holder points at ONE category of their
 *    choosing. We model the rational choice — their single largest spend category
 *    — and apply the rate as a point estimate (see resolveChosenBonusRate).
 *  - `unmatched`: cannot be scored from a generic profile; earns nothing, flagged.
 */
type MatchRule =
  | { kind: "categories"; categories: SpendCategory[]; merchant?: string }
  | { kind: "catchall" }
  | { kind: "user_chosen" }
  | { kind: "unmatched"; reason: string };

// why an explicit table (not fuzzy string parsing): the 30 category names are a
// small, closed set in the data. Enumerating them means every match is a
// reviewable decision, and a NEW/unknown category is caught (routed to
// "unmatched" + flagged) instead of being silently mis-parsed.
const MATCH_TABLE: Record<string, MatchRule> = {
  // Generic categories.
  international_spend: { kind: "categories", categories: ["international"] },
  dining: { kind: "categories", categories: ["dining"] },
  groceries: { kind: "categories", categories: ["groceries"] },
  supermarket: { kind: "categories", categories: ["groceries"] },
  groceries_supermarket: { kind: "categories", categories: ["groceries"] },
  groceries_other: { kind: "categories", categories: ["groceries"] },
  fuel: { kind: "categories", categories: ["fuel"] },
  travel_spend: { kind: "categories", categories: ["travel"] },
  // Compound categories match every component.
  groceries_dining: { kind: "categories", categories: ["groceries", "dining"] },
  groceries_education_utilities: { kind: "categories", categories: ["groceries", "education", "utilities"] },
  dining_international: { kind: "categories", categories: ["dining", "international"] },
  fuel_utilities: { kind: "categories", categories: ["fuel", "utilities"] },
  dining_entertainment: { kind: "categories", categories: ["dining", "entertainment"] },
  dining_entertainment_groceries: { kind: "categories", categories: ["dining", "entertainment", "groceries"] },
  groceries_dining_fuel: { kind: "categories", categories: ["groceries", "dining", "fuel"] },
  dining_travel: { kind: "categories", categories: ["dining", "travel"] },
  // Catch-all / base categories.
  all_spend: { kind: "catchall" },
  all_other_spend: { kind: "catchall" },
  // Merchant-locked bonuses: matched to their nearest canonical category, but
  // flagged because a generic profile can't confirm the spend is at that merchant.
  emirates_purchases: { kind: "categories", categories: ["travel"], merchant: "Emirates" },
  etihad_purchases: { kind: "categories", categories: ["travel"], merchant: "Etihad" },
  dnata_travel: { kind: "categories", categories: ["travel"], merchant: "dnata" },
  marriott_hotels: { kind: "categories", categories: ["travel"], merchant: "Marriott" },
  booking_com: { kind: "categories", categories: ["travel"], merchant: "Booking.com" },
  lulu_supermarket: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  lulu_purchases: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  emaar_properties: { kind: "categories", categories: ["other"], merchant: "Emaar" },
  dubai_duty_free: { kind: "categories", categories: ["other"], merchant: "Dubai Duty Free" },
  rta_transport: { kind: "categories", categories: ["transport"], merchant: "RTA" },
  smiles_partners: { kind: "categories", categories: ["other"], merchant: "Smiles partners" },
  // Flexi bonus: holder chooses which category earns it. Modeled as applying to
  // their single largest spend category (rational-user assumption), at the rate's
  // ceiling as a point estimate. why not "unmatched": a rational holder always
  // picks a category they actually spend on, so scoring it at 0 understated these
  // cards. See resolveChosenBonusRate + largestSpendCategory.
  user_chosen_category: { kind: "user_chosen" },
};

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
}

// ---------------------------------------------------------------------------
// Unit-aware earning helpers. A rate's NUMBER means nothing without its UNIT, so
// every conversion routes through here. Returns reward-currency UNITS per month.
// ---------------------------------------------------------------------------

/** Reward-currency units earned in a month for `spendAed` at a resolved rate. */
function monthlyUnits(
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
function yieldPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  if (rate.value === null || rate.unit === null) return 0; // unresolved → deprioritize
  return monthlyUnits(rate.value, rate.unit, 1, aedPerUnit) * aedPerUnit;
}

// ---------------------------------------------------------------------------
// Fee waivers.
// ---------------------------------------------------------------------------

/** Detect first-year-free / free-for-life from the free-text waiver string. */
function computeFees(card: Card): FeeBreakdown {
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

interface EarnOption {
  cardCategory: string;
  rate: NormalizedRate;
  monthlyCap: number | null;
  annualCap: number | null;
  rule: MatchRule;
}

/**
 * Resolve a flexi "user-chosen" bonus rate to a single point estimate.
 *
 * why: a rational holder points the bonus at a category they use and earns its
 * headline rate, so "Up to 5%" is modeled as 5% — NOT a 0..5% range. Confidence
 * drops to low because which category they chose is an assumption on our side.
 *
 * why this needs no special-casing when a cap is added: with a cap present,
 * normalizeRate already returns "Up to X%" as a resolved high-confidence X%
 * (rate.value set), so the first branch returns it untouched and the standard
 * cap clamp in scoreCard takes over — zero code changes.
 */
function resolveChosenBonusRate(rate: NormalizedRate): NormalizedRate {
  if (rate.value !== null) return rate; // already resolved (e.g. cap-modeled "up to X%")
  const ceiling = rate.range?.max;
  if (ceiling == null) return rate; // no ceiling stated — genuinely unbounded, don't invent one
  return {
    raw: rate.raw,
    value: ceiling,
    unit: rate.unit ?? "percent",
    confidence: "low",
    note: "Flexi bonus modeled at its ceiling for the holder's chosen category",
  };
}

/**
 * The category a rational holder would point a flexi bonus at: their single
 * largest monthly spend. Ties break on object key order (deterministic); null
 * when the profile has no positive spend.
 */
function largestSpendCategory(spending: SpendingProfile): SpendCategory | null {
  let best: SpendCategory | null = null;
  let bestSpend = 0;
  for (const key of Object.keys(spending) as SpendCategory[]) {
    const monthly = spending[key] ?? 0;
    if (monthly > bestSpend) {
      best = key;
      bestSpend = monthly;
    }
  }
  return best;
}

/** Build the list of ways this card can earn, incl. a virtual base-rate fallback. */
function buildEarnOptions(card: Card): { options: EarnOption[]; flags: ScoreFlag[] } {
  const flags: ScoreFlag[] = [];
  const options: EarnOption[] = card.rewards.categories.map((cat: RewardCategory) => {
    const rule = MATCH_TABLE[cat.category] ?? {
      kind: "unmatched" as const,
      reason: `Unknown category "${cat.category}" — not scored`,
    };
    if (!MATCH_TABLE[cat.category]) {
      flags.push({ level: "unknown", message: `Unrecognized reward category "${cat.category}"` });
    }
    const rawRate = normalizeRate(cat.rate, { monthlyCap: cat.monthly_cap, annualCap: cat.annual_cap });
    return {
      cardCategory: cat.category,
      rate: rule.kind === "user_chosen" ? resolveChosenBonusRate(rawRate) : rawRate,
      monthlyCap: cat.monthly_cap,
      annualCap: cat.annual_cap,
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
      rate: normalizeRate(card.rewards.base_rate),
      monthlyCap: null,
      annualCap: null,
      rule: { kind: "catchall" },
    });
  }
  return { options, flags };
}

/**
 * Candidate earn-options for a given spend category. `chosen` is the holder's
 * flexi-bonus category (their largest spend); a user_chosen option only competes
 * for that one category.
 */
function candidatesFor(
  cat: SpendCategory,
  options: EarnOption[],
  chosen: SpendCategory | null,
): EarnOption[] {
  return options.filter((o) => {
    if (o.rule.kind === "categories") return o.rule.categories.includes(cat);
    if (o.rule.kind === "catchall") return true;
    if (o.rule.kind === "user_chosen") return cat === chosen;
    return false; // unmatched never claims spend
  });
}

// ---------------------------------------------------------------------------
// scoreCard.
// ---------------------------------------------------------------------------

export function scoreCard(
  spending: SpendingProfile,
  card: Card,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
): CardScore {
  const valuation = resolveValuation(card.rewards.currency, valuations);
  const { options, flags } = buildEarnOptions(card);
  // The category a flexi "user-chosen" bonus is assumed to target (largest spend).
  const chosen = largestSpendCategory(spending);

  // --- Step 1+2 (assignment): route each spend category to its best-yielding
  // option. We pick by UNCAPPED yield-per-AED — the category a rational user
  // would put this spend on. (Caps are applied after, on the aggregate.) ---
  const assignedSpend = new Map<EarnOption, number>();
  const assignedCats = new Map<EarnOption, SpendCategory[]>();

  for (const key of Object.keys(spending) as SpendCategory[]) {
    const monthly = spending[key] ?? 0;
    if (monthly <= 0) continue;
    const candidates = candidatesFor(key, options, chosen);
    if (candidates.length === 0) continue; // no way to earn (shouldn't happen: base is catch-all)

    let best = candidates[0]!;
    let bestYield = yieldPerAed(best.rate, valuation.aedPerUnit);
    for (const c of candidates.slice(1)) {
      const y = yieldPerAed(c.rate, valuation.aedPerUnit);
      if (y > bestYield) {
        best = c;
        bestYield = y;
      }
    }
    assignedSpend.set(best, (assignedSpend.get(best) ?? 0) + monthly);
    assignedCats.set(best, [...(assignedCats.get(best) ?? []), key]);
  }

  // --- Steps 3-5: earn, cap, convert, per option. ---
  const breakdown: CategoryEarning[] = [];
  let grossMin = 0;
  let grossMax = 0;
  let uncertain = false;

  for (const [option, monthlySpend] of assignedSpend) {
    const cats = assignedCats.get(option) ?? [];
    const rate = option.rate;
    const merchant = option.rule.kind === "categories" ? option.rule.merchant : undefined;

    // Resolve the rate into a min/max value pair in the rate's unit.
    // - resolved rate: min===max===value.
    // - range rate ("Up to X%"): min=range.min, max=range.max (may be null = unbounded).
    const lo = rate.value ?? rate.range?.min ?? 0;
    const hi = rate.value ?? rate.range?.max ?? null; // null => unbounded upper

    const earn = (v: number): { units: number; aed: number; cap?: "monthly" | "annual" } => {
      const rawMonthly = monthlyUnits(v, rate.unit, monthlySpend, valuation.aedPerUnit);
      let cap: "monthly" | "annual" | undefined;
      let capped = rawMonthly;
      if (option.monthlyCap !== null && capped > option.monthlyCap) {
        capped = option.monthlyCap; // why: caps are in reward-currency units; monthly first
        cap = "monthly";
      }
      let annual = capped * 12;
      if (option.annualCap !== null && annual > option.annualCap) {
        annual = option.annualCap;
        cap = "annual";
      }
      return { units: annual, aed: annual * valuation.aedPerUnit, cap };
    };

    const low = earn(lo);
    // For an unbounded upper rate we cannot invent a ceiling — max mirrors min and we flag it.
    const high = hi === null ? low : earn(hi);
    const unbounded = hi === null && rate.value === null;

    breakdown.push({
      cardCategory: option.cardCategory,
      spendCategories: cats,
      monthlySpendAed: monthlySpend,
      rate,
      annualUnits: { min: low.units, max: hi === null && rate.value === null ? null : high.units },
      annualValueAed: { min: low.aed, max: high.aed },
      capBound: low.cap ?? high.cap,
      merchantAssumption: merchant,
    });

    grossMin += low.aed;
    grossMax += high.aed;

    // Inherit flags for the receipt.
    if (rate.confidence === "unknown") {
      uncertain = true;
      flags.push({
        level: "unknown",
        message: `Unresolved rate on ${option.cardCategory} ("${rate.raw}") — scored as a range`,
      });
    } else if (rate.confidence === "low") {
      uncertain = true;
      flags.push({ level: "low", message: `Low-confidence rate on ${option.cardCategory} ("${rate.raw}")` });
    }
    if (unbounded) {
      flags.push({
        level: "unknown",
        message: `${option.cardCategory} has an unbounded variable rate — upside not scored`,
      });
    }
    if (low.cap ?? high.cap) {
      flags.push({
        level: "low",
        message: `${low.cap ?? high.cap} cap reached on ${option.cardCategory} — over-cap spend not modeled`,
      });
    }
    if (merchant) {
      uncertain = true;
      flags.push({
        level: "low",
        message: `${option.cardCategory}: assumes ${cats.join("/")} spend occurs at ${merchant}`,
      });
    }
    if (option.rule.kind === "user_chosen") {
      uncertain = true;
      // why the cap clause is conditional: it must stay truthful if a bonus cap
      // is later added to the data (see resolveChosenBonusRate) — we don't want a
      // "cap not in data" flag firing once a cap exists.
      const capClause =
        option.monthlyCap === null && option.annualCap === null
          ? "bonus cap not in data — verify"
          : "verify chosen category matches actual usage";
      flags.push({
        level: "low",
        message: `${option.cardCategory}: assumes ${cats.join("/")} as chosen bonus category; ${capClause}`,
      });
    }
  }

  // Report unmatched (un-scoreable) categories once, as a flag.
  for (const o of options) {
    if (o.rule.kind === "unmatched") {
      flags.push({ level: "low", message: `${o.cardCategory}: ${o.rule.reason}` });
    }
  }

  // --- Step 6: fees + valuation-confidence flag. ---
  const fees = computeFees(card);
  if (valuation.confidence !== "high") {
    uncertain = true;
    flags.push({
      level: valuation.confidence === "low" ? "low" : "low",
      message: `Valuation of "${card.rewards.currency}" is ${valuation.confidence} confidence${
        valuation.note ? ` (${valuation.note})` : ""
      }`,
    });
  }

  const netMinOngoing = grossMin - fees.ongoingFeeAed;
  const netMaxOngoing = grossMax - fees.ongoingFeeAed;
  const netMinYear1 = grossMin - fees.year1FeeAed;
  const netMaxYear1 = grossMax - fees.year1FeeAed;
  if (grossMax !== grossMin) uncertain = true;

  return {
    cardId: card.id,
    rewardCurrency: card.rewards.currency,
    valuation,
    // why midpoint for the single ranking number: it's a neutral expected value
    // across the uncertainty band. The full range is exposed alongside it.
    netAnnualValue: (netMinOngoing + netMaxOngoing) / 2,
    netAnnualValueRange: { min: netMinOngoing, max: netMaxOngoing },
    netAnnualValueYear1: (netMinYear1 + netMaxYear1) / 2,
    grossAnnualValue: { min: grossMin, max: grossMax },
    fees,
    breakdown,
    flags,
    uncertain,
  };
}
