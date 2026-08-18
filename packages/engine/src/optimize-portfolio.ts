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

import { isRecommendable, isUnpublishable, type Card } from "./card";
import {
  earnAcrossCards,
  label,
  precomputeCardData,
  type AedRange,
  type CardData,
  type EarnResult,
  type FeeBreakdown,
  type ScoreFlag,
  type SpendCategory,
  type SpendingProfile,
} from "./score-card";
import {
  sanitizeMerchantShares,
  shareFor,
  type MerchantShares,
  type ResolvedMerchantShares,
} from "./merchant-share";
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
  /**
   * Score cards whose `data_caveat` forbids publication instead of dropping them.
   * Default false, which is the right behaviour for a RECOMMENDATION.
   *
   * why the escape hatch exists: the rule is "never tell someone to acquire a card
   * whose figures we don't stand behind", not "pretend the card does not exist".
   * When the universe is the cards a user ALREADY HOLDS — the app's baseline, which
   * anchors "here is what your current wallet earns" — dropping one understates the
   * wallet they have and therefore INFLATES the gain we claim they'd get by
   * switching. That is the precise harm the exclusion is meant to prevent, so the
   * baseline path sets this true.
   */
  includeUnpublishable?: boolean;
  /**
   * What fraction of the relevant categories' spend actually happens at each
   * merchant a co-brand card bonuses ("LuLu" -> 0.3). See merchant-share.ts.
   *
   * A merchant with NO share here is not assumed away and not credited in full:
   * its bonus is bounded 0..full by the scorer, because "we didn't ask" is not
   * evidence either way. Supplying a share replaces that bound with the user's own
   * number, enforced as a flow capacity — which is both tighter and the only form
   * that gets the two hard cases right (the remainder reallocates, and two cards
   * bonusing one merchant share a single pool). See merchant-share.ts.
   */
  merchantShares?: MerchantShares;
}

/**
 * One "swipe THIS card for THIS spend" instruction in the portfolio receipt.
 *
 * Exactly ONE row per (spendCategory, card): a category may split across different
 * CARDS (two rows, different cardId), but never appears twice for the SAME card.
 * When a card has two reward sub-categories mapping to the same canonical category
 * (e.g. cinemas + video_streaming both → entertainment, each with its own cap), the
 * underlying earning slices are merged here into one instruction — their spend and
 * value summed, `cardCategory` set to the sub-category that earned the most.
 */
export interface CategoryAllocation {
  spendCategory: SpendCategory;
  cardId: string;
  /** The card earn-option that earned the MOST here ("base_rate" for the fallback). */
  cardCategory: string;
  monthlySpendAed: number;
  /** AED value earned per year on this (category, card) instruction (min===max when certain). */
  annualValueAed: AedRange;
  /** Set when any merged slice sat against a bound cap (overflow went to the next-best option). */
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
  /**
   * Cards dropped because their `data_caveat` says their figures must not be
   * published. Reported separately from benching: a benched card has no usable
   * reward structure at all, whereas these score fine but are not yet trustworthy
   * enough to put in front of a customer as a recommendation.
   */
  excludedForDataCaveat: number;
  /**
   * Cards dropped because the issuer no longer accepts new applications. Scored
   * fine and possibly excellent — but nobody can get one, so recommending it is
   * useless advice rather than wrong advice.
   */
  excludedForClosedProduct: number;
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

function scorePortfolio(
  portfolio: CardData[],
  spending: SpendingProfile,
  shares: ResolvedMerchantShares | undefined,
): Portfolio {
  const result = earnAcrossCards(spending, portfolio, shares);

  // Per-category "swipe THIS card" instructions. Merge slices that share the same
  // (spendCategory, card): one card can earn a category through two reward
  // sub-categories (e.g. cinemas + video_streaming → entertainment), which the flow
  // reports as separate slices — but for the receipt that's a single "swipe this
  // card" row. Sum spend + value; keep the highest-earning sub-category as the label.
  const byCategoryCard = new Map<string, CategoryAllocation & { _topValue: number }>();
  for (const s of result.slices) {
    const cardId = portfolio[s.cardIndex]!.card.id;
    // why the \0 ESCAPE and not a literal NUL byte: a separator that cannot occur in
    // either a category name or a card id is what makes this key unambiguous, but
    // writing the raw byte into the source made git classify this file as BINARY —
    // it refused to merge it textually. The escape keeps the impossible separator
    // and keeps the file diffable.
    const key = `${s.spendCategory}\0${cardId}`;
    const sliceValue = (s.annualValueAed.min + s.annualValueAed.max) / 2;
    const existing = byCategoryCard.get(key);
    if (!existing) {
      byCategoryCard.set(key, {
        spendCategory: s.spendCategory,
        cardId,
        cardCategory: s.option.cardCategory,
        monthlySpendAed: s.monthlySpendAed,
        annualValueAed: { ...s.annualValueAed },
        capBound: s.capBound,
        merchantAssumption: s.merchantAssumption,
        _topValue: sliceValue,
      });
    } else {
      existing.monthlySpendAed += s.monthlySpendAed;
      existing.annualValueAed.min += s.annualValueAed.min;
      existing.annualValueAed.max += s.annualValueAed.max;
      if (sliceValue > existing._topValue) {
        existing.cardCategory = s.option.cardCategory;
        existing._topValue = sliceValue;
      }
      existing.capBound ??= s.capBound;
      existing.merchantAssumption ??= s.merchantAssumption;
    }
  }
  const allocations: CategoryAllocation[] = [...byCategoryCard.values()].map(
    ({ _topValue, ...a }) => a,
  );
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

  const { flags, uncertain } = collectFlags(portfolio, result, shares);

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
function collectFlags(
  portfolio: CardData[],
  result: EarnResult,
  shares: ResolvedMerchantShares | undefined,
): { flags: ScoreFlag[]; uncertain: boolean } {
  const flags: ScoreFlag[] = [];
  let uncertain = false;

  // Structural flags from option-building (e.g. an unrecognized reward category) and
  // min-spend gating. Read from result.cards — earnAcrossCards returns the GATED
  // cards there, so a disabled-bonus flag surfaces in the portfolio receipt too.
  for (const cd of result.cards) {
    for (const f of cd.buildFlags) {
      flags.push({ level: f.level, message: `${cd.card.name}: ${f.message}` });
      if (f.level === "unknown") uncertain = true;
    }
  }

  for (const o of result.optionOutcomes) {
    const cd = portfolio[o.cardIndex]!;
    const rate = o.option.rate;
    // Names the user recognises, not storage keys: the card's marketing name and
    // a title-cased category, never "supermarkets on rakbank_titanium".
    const where = `${label(o.option.cardCategory)} on ${cd.card.name}`;

    if (rate.confidence === "unknown") {
      uncertain = true;
      flags.push({ level: "unknown", message: `Unresolved rate on ${where} ("${rate.raw}") - scored as a range` });
    } else if (rate.confidence === "low") {
      uncertain = true;
      flags.push({ level: "low", message: `Low-confidence rate on ${where} ("${rate.raw}")` });
    }
    if (o.earning.unbounded) {
      flags.push({ level: "unknown", message: `${where} has an unbounded variable rate - upside not scored` });
    }
    if (o.capBound) {
      flags.push({
        level: "low",
        message: `${o.capBound} cap reached on ${where} - overflow routed to the next-best option`,
      });
    }
    // Mirrors scoreCard exactly: a share the user STATED is an input, not an
    // assumption of ours, so it neither sets `uncertain` nor carries the
    // "spend occurs at" phrase the study's SOUND filter rejects on. An unstated
    // merchant keeps the loud flag AND has had its rate bounded 0..full by
    // precomputeCardData. See score-card.ts for the full reasoning; the two must
    // stay worded alike, since both feed the same study filters.
    if (o.merchantAssumption) {
      const stated = shareFor(shares, o.merchantAssumption);
      if (stated === undefined) {
        uncertain = true;
        flags.push({
          level: "low",
          message:
            `${where}: bounded 0-to-full, because nobody has said what share of ` +
            `that spend occurs at ${o.merchantAssumption}`,
        });
      } else {
        flags.push({
          level: "low",
          message: `${where}: counts the ${(stated * 100).toFixed(0)}% of that spend you told us happens at ${o.merchantAssumption}`,
        });
      }
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

  // Overall reward cap bound on any contributing card (its gross was truncated).
  result.overallCapBoundByCard.forEach((bound, i) => {
    if (bound) {
      flags.push({
        level: "low",
        message: `${result.cards[i]!.card.name}: overall reward cap reached - that card's total earnings were capped`,
      });
    }
  });

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
 *   1. higher ongoing net annual value AT ITS LOWER BOUND (the primary objective),
 *   2. then higher midpoint (upside breaks a tie on the floor),
 *   3. then FEWER cards (simplicity — a card that only ties isn't worth carrying),
 *   4. then lower total ongoing fees,
 *   5. then lexicographic card ids (fully deterministic output).
 *
 * why the LOWER BOUND and not the midpoint: the engine's principle is that an
 * uncertain rate propagates as a range instead of a fabricated point estimate.
 * Reporting honoured that; ranking did not. An "Up to 6%" rate normalizes to a
 * 0..6% band, and ranking it at its midpoint asserts the user earns 3% — a figure
 * that appears nowhere in the card's terms. That is the same bias removed from rate
 * CONFIDENCE in 4343c53, re-entering through selection, and it is invisible per-card
 * because each card's range is still reported faithfully.
 *
 * Ranking on the floor means a card is never recommended on the strength of value we
 * cannot demonstrate. Upside is not ignored — it breaks ties at step 2, and the full
 * range and midpoint stay on the Portfolio for display.
 */
function isBetter(a: Portfolio, b: Portfolio): boolean {
  if (Math.abs(a.netAnnualValueRange.min - b.netAnnualValueRange.min) > EPS) {
    return a.netAnnualValueRange.min > b.netAnnualValueRange.min;
  }
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
  const includeUnpublishable = options.includeUnpublishable ?? false;
  // Validated once here, then reused across every candidate subset — the enumeration
  // scores thousands of portfolios and none of them should re-check the same input.
  const { shares } = sanitizeMerchantShares(options.merchantShares);

  // --- Eligibility filter (first). Drop cards the user can't get, benched cards
  // (excluded_from_scoring) which have no trustworthy reward structure to rank, and
  // cards whose data_caveat forbids publication — recommending one would put a
  // number in front of a customer that our own data record says is not defensible.
  // Every count is reported so the UI can say "42 of 51 cards apply." ---
  let benchedCount = 0;
  let excludedForDataCaveat = 0;
  let excludedForClosedProduct = 0;
  let excludedForEligibility = 0;
  const eligible: CardData[] = [];
  for (const card of cards) {
    if (card.excluded_from_scoring) {
      benchedCount++;
      continue;
    }
    if (!includeUnpublishable && !isRecommendable(card)) {
      // Both reasons a scoreable card must not be RECOMMENDED — untrustworthy
      // figures, or a product nobody can apply for. Counted apart so the UI can
      // say which, since "we're checking the data" and "the bank stopped
      // offering it" are different facts about a card.
      if (isUnpublishable(card)) excludedForDataCaveat++;
      else excludedForClosedProduct++;
      continue;
    }
    const e = card.eligibility;
    const salaryOk = userProfile.monthlySalaryAed >= e.min_monthly_salary_aed;
    const residencyOk = !e.uae_resident_required || userProfile.uaeResident;
    if (!salaryOk || !residencyOk) {
      excludedForEligibility++;
      continue;
    }
    // The shares are handed to the scorer as well as to the flow. The flow uses them
    // as capacities; the scorer uses them to decide which merchant locks are still
    // UNACCOUNTED FOR and must be bounded 0..full. This is the load-bearing call for
    // the maximum-of-maxima defect: the enumeration below picks the best of ~53
    // cards, so an unbounded merchant lock here is exactly what let the optimizer
    // stack three different unverified merchant assumptions into one portfolio.
    eligible.push(precomputeCardData(card, valuations, { merchantShares: options.merchantShares }));
  }

  // --- Enumerate every subset of each size, EXHAUSTIVELY (justified up top),
  // enforcing the salary-transfer rule during enumeration, and keep the best. ---
  const bestBySize: (Portfolio | null)[] = [null, null, null]; // index 0->size1, etc.
  for (let size = 1; size <= Math.min(maxCards, 3); size++) {
    let best: Portfolio | null = null;
    for (const subset of combinations(eligible, size)) {
      if (!salaryTransferOk(subset)) continue; // two salary transfers is impossible
      const scored = scorePortfolio(subset, spending, shares);
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
    excludedForDataCaveat,
    excludedForClosedProduct,
    best1,
    best2,
    best3,
    overallBest,
  };
}
