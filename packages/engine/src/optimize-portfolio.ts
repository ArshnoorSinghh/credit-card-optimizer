/**
 * optimizePortfolio — the quant centerpiece.
 *
 * Given a user's monthly spend by category, their eligibility profile, and the
 * card universe, it returns the best 1-, 2-, and 3-card portfolios. For each it
 * reports the net annual value (year-1 and ongoing), a per-category "swipe THIS
 * card" assignment, each card's individual contribution, total fees, and any
 * inherited uncertainty flags — the receipt, portfolio edition.
 *
 * Pure and deterministic: no I/O (no DB, no fetch, no fs). Everything recomputes
 * from the caller's inputs, so caps bind or don't bind based on what the user
 * actually types — nothing about spend levels is hardcoded.
 *
 * ---------------------------------------------------------------------------
 * This file owns only TWO things: (1) enumerating which card subsets to try, and
 * (2) shaping the winner into a Portfolio receipt. The actual earning math — how
 * spend is split across cards, how caps bind, how overflow reroutes — lives in
 * score-card.ts's `earnAcrossCards`, THE single source of truth. scoreCard(card)
 * is `earnAcrossCards([card])`; a 1-card portfolio here is the same call, so a
 * lone card and the best-1-card portfolio return identical numbers by construction.
 *
 * Why enumerate exhaustively: at <=51 cards, C(51,1)+C(51,2)+C(51,3) ~= 22,000
 * subsets — trivially fast. Value is non-additive across cards (two cards can be
 * complementary or redundant), so only checking every subset is guaranteed to find
 * the optimum, and at this scale that is free.
 * ---------------------------------------------------------------------------
 */

import type { Card } from "./card";
import {
  earnAcrossCards,
  precomputeCardData,
  type AedRange,
  type CardData,
  type EarnResult,
  type FeeBreakdown,
  type ScoreFlag,
  type SpendCategory,
  type SpendingProfile,
} from "./score-card";
import { DEFAULT_VALUATIONS, type ValuationEntry, type ValuationTable } from "./valuations";

/** Eligibility inputs that gate which cards a user can actually get. */
export interface UserProfile {
  /** Gross monthly salary in AED — compared against each card's minimum. */
  monthlySalaryAed: number;
  /** UAE residency — some cards require it. */
  uaeResident: boolean;
}

export interface OptimizeOptions {
  /** Largest portfolio size to consider (1–3). Default 3. */
  maxCards?: 1 | 2 | 3;
}

/** One "swipe THIS card for THIS spend" instruction in the portfolio receipt. */
export interface CategoryAllocation {
  spendCategory: SpendCategory;
  cardId: string;
  /** The card's earn-option that claims this spend ("base_rate" for the fallback). */
  cardCategory: string;
  monthlySpendAed: number;
  /** AED value earned per year on this slice (min===max when certain). */
  annualValueAed: AedRange;
  /** Set when this slice sits against a bound cap (its overflow went to the next-best option). */
  capBound?: "monthly" | "annual";
  /** Set when the option relies on an optimistic merchant assumption. */
  merchantAssumption?: string;
}

/** What one card contributes to the portfolio it's part of. */
export interface CardContribution {
  cardId: string;
  rewardCurrency: string;
  valuation: ValuationEntry;
  /** Gross AED/year this card earns given its slice of the spend. */
  grossAnnualValue: AedRange;
  fees: FeeBreakdown;
}

export interface Portfolio {
  cardIds: string[];
  size: 1 | 2 | 3;
  /** Gross AED/year across all cards before fees (min===max when certain). */
  grossAnnualValue: AedRange;
  totalFees: { year1: number; ongoing: number };
  /** Ranking number: ongoing (year 2+) net annual AED value; midpoint if uncertain. */
  netAnnualValue: number;
  netAnnualValueRange: AedRange;
  /** Net annual value in year 1 (applies first-year fee waivers); midpoint if uncertain. */
  netAnnualValueYear1: number;
  netAnnualValueYear1Range: AedRange;
  /** Per-category "swipe THIS card" instructions (a category may split across cards). */
  allocations: CategoryAllocation[];
  /** Each card's individual contribution. */
  contributions: CardContribution[];
  /** Monthly AED that earns nothing because every eligible option's cap is full. Normally 0. */
  unearnedMonthlyAed: number;
  /** Inherited low/unknown-confidence flags. */
  flags: ScoreFlag[];
  /** True if any range rate / soft valuation / merchant assumption makes this estimate soft. */
  uncertain: boolean;
}

export interface PortfolioResult {
  /** Cards in the input universe. */
  totalCardCount: number;
  /** Cards that passed the eligibility filter (salary + residency) and aren't benched. */
  eligibleCardCount: number;
  /** Cards dropped because salary/residency requirements weren't met. */
  excludedForEligibility: number;
  /** Cards dropped because they're benched (excluded_from_scoring, pending verification). */
  benchedCount: number;
  best1: Portfolio | null;
  best2: Portfolio | null;
  best3: Portfolio | null;
  /**
   * The single portfolio we'd actually recommend across all sizes, applying the
   * tie-break rule: highest net, then FEWER cards, then lower total fees. This is
   * where "prefer fewer cards" bites — a 3rd card whose fee eats its own rewards
   * shouldn't be recommended just because it ties.
   */
  overallBest: Portfolio | null;
}

// Float tolerance for value comparisons (AED are continuous).
const EPS = 1e-9;

// Deterministic, human-scannable ordering for the allocation receipt.
const CATEGORY_ORDER: SpendCategory[] = [
  "groceries", "dining", "fuel", "utilities", "education",
  "travel", "transport", "entertainment", "international", "other",
];

// ===========================================================================
// Scoring a fixed portfolio: run the shared core, then shape the receipt.
// ===========================================================================

function scorePortfolio(portfolio: CardData[], spending: SpendingProfile): Portfolio {
  const result = earnAcrossCards(spending, portfolio);

  // Per-category "swipe THIS card" slices, in a stable, readable order.
  const allocations: CategoryAllocation[] = result.slices.map((s) => ({
    spendCategory: s.spendCategory,
    cardId: portfolio[s.cardIndex]!.card.id,
    cardCategory: s.option.cardCategory,
    monthlySpendAed: s.monthlySpendAed,
    annualValueAed: s.annualValueAed,
    capBound: s.capBound,
    merchantAssumption: s.merchantAssumption,
  }));
  allocations.sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.spendCategory) - CATEGORY_ORDER.indexOf(b.spendCategory) ||
      a.cardId.localeCompare(b.cardId),
  );

  const contributions: CardContribution[] = portfolio.map((cd, i) => ({
    cardId: cd.card.id,
    rewardCurrency: cd.card.rewards.currency,
    valuation: cd.valuation,
    grossAnnualValue: result.perCardGross[i]!,
    fees: cd.fees,
  }));

  const grossMin = result.grossAnnualValue.min;
  const grossMax = result.grossAnnualValue.max;
  const year1Fees = contributions.reduce((s, c) => s + c.fees.year1FeeAed, 0);
  const ongoingFees = contributions.reduce((s, c) => s + c.fees.ongoingFeeAed, 0);

  const { flags, uncertain } = collectFlags(portfolio, result);

  const netMinOngoing = grossMin - ongoingFees;
  const netMaxOngoing = grossMax - ongoingFees;
  const netMinYear1 = grossMin - year1Fees;
  const netMaxYear1 = grossMax - year1Fees;

  return {
    cardIds: portfolio.map((cd) => cd.card.id),
    size: portfolio.length as 1 | 2 | 3,
    grossAnnualValue: { min: grossMin, max: grossMax },
    totalFees: { year1: year1Fees, ongoing: ongoingFees },
    // why midpoint for the single ranking number: a neutral expected value across
    // the uncertainty band (same convention as scoreCard). Full range exposed too.
    netAnnualValue: (netMinOngoing + netMaxOngoing) / 2,
    netAnnualValueRange: { min: netMinOngoing, max: netMaxOngoing },
    netAnnualValueYear1: (netMinYear1 + netMaxYear1) / 2,
    netAnnualValueYear1Range: { min: netMinYear1, max: netMaxYear1 },
    allocations,
    contributions,
    unearnedMonthlyAed: result.unearnedMonthlyAed,
    flags,
    uncertain,
  };
}

/**
 * Collect the receipt's flags, mirroring scoreCard's messages but qualified by
 * card so a multi-card portfolio is still auditable. We only flag options that
 * actually received spend, plus one valuation flag per contributing currency and
 * an over-capacity flag if any spend went unearned.
 */
function collectFlags(portfolio: CardData[], result: EarnResult): { flags: ScoreFlag[]; uncertain: boolean } {
  const flags: ScoreFlag[] = [];
  let uncertain = false;

  // Structural flags from option-building (e.g. an unrecognized reward category).
  for (const cd of portfolio) {
    for (const f of cd.buildFlags) {
      flags.push({ level: f.level, message: `${cd.card.id}: ${f.message}` });
      if (f.level === "unknown") uncertain = true;
    }
  }

  for (const o of result.optionOutcomes) {
    const cd = portfolio[o.cardIndex]!;
    const rate = o.option.rate;
    const label = `${o.option.cardCategory} on ${cd.card.id}`;

    if (rate.confidence === "unknown") {
      uncertain = true;
      flags.push({ level: "unknown", message: `Unresolved rate on ${label} ("${rate.raw}") — scored as a range` });
    } else if (rate.confidence === "low") {
      uncertain = true;
      flags.push({ level: "low", message: `Low-confidence rate on ${label} ("${rate.raw}")` });
    }
    if (o.earning.unbounded) {
      flags.push({ level: "unknown", message: `${label} has an unbounded variable rate — upside not scored` });
    }
    if (o.capBound) {
      flags.push({
        level: "low",
        message: `${o.capBound} cap reached on ${label} — overflow routed to the next-best option`,
      });
    }
    if (o.merchantAssumption) {
      uncertain = true;
      flags.push({ level: "low", message: `${label}: assumes spend occurs at ${o.merchantAssumption}` });
    }
  }

  // One valuation flag per contributing currency (dedup).
  const seenCurrency = new Set<string>();
  for (const cd of portfolio) {
    if (cd.valuation.confidence === "high") continue;
    if (seenCurrency.has(cd.card.rewards.currency)) continue;
    seenCurrency.add(cd.card.rewards.currency);
    uncertain = true;
    flags.push({
      level: "low",
      message: `Valuation of "${cd.card.rewards.currency}" is ${cd.valuation.confidence} confidence${
        cd.valuation.note ? ` (${cd.valuation.note})` : ""
      }`,
    });
  }

  if (result.unearnedMonthlyAed > EPS) {
    flags.push({
      level: "low",
      message: `${result.unearnedMonthlyAed.toFixed(0)} AED/mo of spend exceeds every card's caps in this portfolio and earns nothing`,
    });
  }

  if (result.grossAnnualValue.max - result.grossAnnualValue.min > EPS) uncertain = true;

  return { flags, uncertain };
}

// ===========================================================================
// Enumeration + selection.
// ===========================================================================

/** All k-card subsets of `items`, in input order. */
function combinations<T>(items: T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const recurse = (start: number): void => {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]!);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

/** Portfolio-level eligibility: a salary can only be routed to ONE bank. */
function salaryTransferOk(portfolio: CardData[]): boolean {
  const n = portfolio.filter((cd) => cd.card.eligibility.salary_transfer_required).length;
  return n <= 1;
}

/**
 * Tie-break comparator. Returns true when `a` is the better portfolio:
 *   1. higher ongoing net annual value (the primary objective),
 *   2. then FEWER cards (simplicity — a card that only ties isn't worth carrying),
 *   3. then lower total ongoing fees,
 *   4. then lexicographic card ids (fully deterministic output).
 */
function isBetter(a: Portfolio, b: Portfolio): boolean {
  if (Math.abs(a.netAnnualValue - b.netAnnualValue) > EPS) {
    return a.netAnnualValue > b.netAnnualValue;
  }
  if (a.size !== b.size) return a.size < b.size;
  if (Math.abs(a.totalFees.ongoing - b.totalFees.ongoing) > EPS) {
    return a.totalFees.ongoing < b.totalFees.ongoing;
  }
  return a.cardIds.join(",").localeCompare(b.cardIds.join(",")) < 0;
}

export function optimizePortfolio(
  spending: SpendingProfile,
  userProfile: UserProfile,
  cards: Card[],
  valuations: ValuationTable = DEFAULT_VALUATIONS,
  options: OptimizeOptions = {},
): PortfolioResult {
  const maxCards = options.maxCards ?? 3;

  // --- Eligibility filter (first). Drop cards the user can't get, and benched
  // cards (excluded_from_scoring) which have no trustworthy reward structure to
  // rank. Both counts are reported so the UI can say "42 of 51 cards apply." ---
  let benchedCount = 0;
  let excludedForEligibility = 0;
  const eligible: CardData[] = [];
  for (const card of cards) {
    if (card.excluded_from_scoring) {
      benchedCount++;
      continue;
    }
    const e = card.eligibility;
    const salaryOk = userProfile.monthlySalaryAed >= e.min_monthly_salary_aed;
    const residencyOk = !e.uae_resident_required || userProfile.uaeResident;
    if (!salaryOk || !residencyOk) {
      excludedForEligibility++;
      continue;
    }
    eligible.push(precomputeCardData(card, valuations));
  }

  // --- Enumerate every subset of each size, EXHAUSTIVELY (justified up top),
  // enforcing the salary-transfer rule during enumeration, and keep the best. ---
  const bestBySize: (Portfolio | null)[] = [null, null, null]; // index 0->size1, etc.
  for (let size = 1; size <= Math.min(maxCards, 3); size++) {
    let best: Portfolio | null = null;
    for (const subset of combinations(eligible, size)) {
      if (!salaryTransferOk(subset)) continue; // two salary transfers is impossible
      const scored = scorePortfolio(subset, spending);
      if (best === null || isBetter(scored, best)) best = scored;
    }
    bestBySize[size - 1] = best;
  }

  const best1 = bestBySize[0] ?? null;
  const best2 = bestBySize[1] ?? null;
  const best3 = bestBySize[2] ?? null;

  // Overall recommendation: best across sizes, applying the fewer-cards tie-break.
  let overallBest: Portfolio | null = null;
  for (const p of [best1, best2, best3]) {
    if (p && (overallBest === null || isBetter(p, overallBest))) overallBest = p;
  }

  return {
    totalCardCount: cards.length,
    eligibleCardCount: eligible.length,
    excludedForEligibility,
    benchedCount,
    best1,
    best2,
    best3,
    overallBest,
  };
}
