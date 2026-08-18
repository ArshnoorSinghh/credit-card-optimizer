/**
 * Statement check — the first thing in this engine that compares a prediction to
 * something that actually happened.
 *
 * Everything else here is modelled. The gap study runs synthetic profiles, the
 * valuations are researched rather than observed, and the tier checksum proves the
 * rate strings parse — not that the answer is right. This module takes ONE real
 * credit-card statement and asks the only question none of that can answer: **did
 * the engine predict what the bank actually paid?**
 *
 * ── Rule zero ───────────────────────────────────────────────────────────────────
 * Nothing here may be tuned to make the answer come out well. If a check shows the
 * engine overstating, that is the finding, and the fix belongs in the rate data or
 * the model — never in this file. A validation harness that can be adjusted until it
 * agrees is a harness that measures nothing.
 *
 * ── Why the comparison is in UNITS, not AED ─────────────────────────────────────
 * The obvious comparison is "we said AED 84, the statement says AED 71". That number
 * confounds TWO independent models: the earn model (how many points the spend earns)
 * and the valuation table (what a point is worth). Skywards is valued at 0.037 AED;
 * if the true redemption came out at 0.030, an AED comparison reports a 19% error in
 * a rate model that was perfectly correct.
 *
 * So the primary comparison is in reward-currency UNITS — points, miles, or AED for
 * a genuine cashback card where the unit IS the dirham. That isolates the earn model,
 * which is the thing `cards.json` and `normalize-rate.ts` actually claim to get
 * right. An AED comparison is still produced when the statement gives one, and is
 * flagged as testing both models at once.
 *
 * ── Why RANGE CONTAINMENT is the headline metric ────────────────────────────────
 * This engine's whole thesis is that an uncertain rate propagates as a range instead
 * of a fabricated point estimate. The test of that claim is not "was the midpoint
 * close" — it is **did the range contain reality**. A range that misses is a bound
 * that was wrong, which is far more serious than a midpoint that was off, because
 * the product presents the range as something it stands behind.
 *
 * A range that contains the truth but is enormous is not a success either, so the
 * width is reported alongside.
 *
 * ── The single-cycle approximation, stated ──────────────────────────────────────
 * `scoreCard` takes a MONTHLY spend profile and returns ANNUAL figures. A statement
 * is one cycle, so the cycle's real spend is fed in as the monthly profile and the
 * output divided by 12. Monthly caps then apply exactly as they should. An ANNUAL
 * cap gets 1/12 of its room, which is the right approximation for a typical cycle
 * and wrong for a user who front-loads the year — so when an annual cap binds, the
 * check says so rather than quietly absorbing it.
 *
 * Pure functions. No I/O.
 */

import type { Card } from "./card";
import {
  scoreCard,
  type AedRange,
  type SpendCategory,
  type SpendingProfile,
} from "./score-card";
import { DEFAULT_VALUATIONS, type ValuationTable } from "./valuations";

/** One line of real spend, as a human read it off the statement. */
export interface StatementLine {
  /** Verbatim from the statement. Kept so a reviewer can challenge the mapping. */
  description: string;
  amountAed: number;
  /**
   * The canonical category a HUMAN assigned to this line.
   *
   * `null` means "deliberately not mapped" — an unrecognisable merchant, a fee, a
   * refund, a cash advance. Unmapped spend is excluded from the prediction and
   * REPORTED, because the alternative (guessing a category to make the totals tie)
   * is the one thing that would quietly invalidate the whole exercise.
   */
  category: SpendCategory | null;
  /** Why this line was mapped that way, when it isn't obvious. */
  note?: string;
}

export interface Statement {
  cardId: string;
  /** Billing cycle label, e.g. "2026-07". Free-form; only used for reporting. */
  cycle: string;
  lines: StatementLine[];
  /**
   * Reward units the bank actually credited for this cycle — points, miles, or AED
   * for a cashback card. This is the ground truth the whole module exists to compare
   * against, and it should be read off the statement, never inferred.
   */
  actualRewardUnits?: number;
  /**
   * Cashback/rewards actually credited expressed in AED, where the statement states
   * it that way. Compared separately, and flagged as testing the valuation too.
   */
  actualRewardAed?: number;
}

export interface UnitRange {
  min: number;
  /** null when the model leaves the upper end unbounded. */
  max: number | null;
}

export interface StatementCheck {
  cardId: string;
  cardName: string;
  cycle: string;
  rewardCurrency: string;

  /** Total mapped spend, unmapped spend, and the profile actually fed to the engine. */
  mappedSpendAed: number;
  unmappedSpendAed: number;
  unmappedSharePct: number;
  profile: SpendingProfile;

  /** What the engine says this cycle should have earned. */
  predictedUnits: UnitRange;
  predictedAed: AedRange;

  actualUnits?: number;
  actualAed?: number;

  /**
   * THE headline. Did the engine's range contain what the bank actually paid?
   * `undefined` when the statement gave no ground truth to compare against.
   */
  unitsWithinRange?: boolean;
  aedWithinRange?: boolean;

  /** Signed gap against the range MIDPOINT. Positive = the engine OVERSTATED. */
  unitsGap?: number;
  unitsGapPct?: number;
  aedGap?: number;
  aedGapPct?: number;

  /** Range width as a share of the midpoint — a contained-but-useless range shows here. */
  unitsRangeWidthPct?: number;

  flags: string[];
}

function midpoint(r: UnitRange): number {
  return r.max === null ? r.min : (r.min + r.max) / 2;
}

function pctDiff(predicted: number, actual: number): number {
  if (actual === 0) return predicted === 0 ? 0 : Infinity;
  return ((predicted - actual) / actual) * 100;
}

/**
 * Compare one statement against what the engine predicts for the same spend.
 *
 * `card` is passed in rather than looked up so the caller can check a statement
 * against a MODIFIED card — which is how you test a proposed data fix against
 * reality before committing it.
 */
export function checkStatement(
  card: Card,
  statement: Statement,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
): StatementCheck {
  const flags: string[] = [];

  // --- Build the spend profile from the mapped lines only. ---
  const profile: SpendingProfile = {};
  let mappedSpendAed = 0;
  let unmappedSpendAed = 0;
  for (const line of statement.lines) {
    if (line.category === null) {
      unmappedSpendAed += line.amountAed;
      continue;
    }
    profile[line.category] = (profile[line.category] ?? 0) + line.amountAed;
    mappedSpendAed += line.amountAed;
  }

  const totalSpend = mappedSpendAed + unmappedSpendAed;
  const unmappedSharePct = totalSpend > 0 ? (unmappedSpendAed / totalSpend) * 100 : 0;
  if (unmappedSharePct >= 10) {
    // A comparison resting on two-thirds of the spend is not a validation of much.
    // The threshold is a reporting convention, not a pass/fail — the reader decides.
    flags.push(
      `${unmappedSharePct.toFixed(0)}% of this cycle's spend (AED ${Math.round(unmappedSpendAed)}) was not mapped to a category, so the prediction only covers the rest`,
    );
  }

  /*
    The single-cycle approximation. scoreCard reasons in months-in, years-out, so the
    cycle's real spend goes in as the monthly profile and everything comes back /12.
  */
  const score = scoreCard(profile, card, valuations);
  const predictedUnits: UnitRange = score.breakdown.reduce<UnitRange>(
    (acc, b) => ({
      min: acc.min + b.annualUnits.min / 12,
      // A null max anywhere makes the whole upper bound unbounded — it cannot be
      // summed away.
      max: acc.max === null || b.annualUnits.max === null ? null : acc.max + b.annualUnits.max / 12,
    }),
    { min: 0, max: 0 },
  );
  const predictedAed: AedRange = {
    min: score.grossAnnualValue.min / 12,
    max: score.grossAnnualValue.max / 12,
  };

  /*
    THE MIN-SPEND GATE, hoisted.

    Found the first time this harness was pointed at a real card: fab_cashback needs
    AED 3,000/month before its bonus rates switch on, so a light cycle earns the 1%
    base and the engine predicts a FIFTH of what a naive reading expects. That is the
    engine being right, and it looks exactly like the engine being badly wrong.

    Left buried among the other flags it would cost a reviewer an hour, and worse, it
    would look like evidence the model is broken when it is evidence the model is
    working. So it is stated first and in the terms the comparison needs.
  */
  const gate = card.rewards.min_monthly_spend_required_aed ?? 0;
  if (gate > 0 && mappedSpendAed < gate) {
    flags.unshift(
      `THIS CYCLE IS BELOW THE CARD'S GATE: AED ${Math.round(mappedSpendAed)} of mapped spend against an AED ${gate}/mo minimum, so bonus rates are off and only the base rate is predicted`,
    );
    /*
      And the trap inside the trap. The BANK counted the whole statement toward that
      threshold; we only counted what a human mapped. So unmapped spend can make the
      gate look failed here while it was comfortably met in reality — producing a
      large, entirely artificial gap.
    */
    if (mappedSpendAed + unmappedSpendAed >= gate) {
      flags.unshift(
        `LIKELY FALSE GATE: total spend on the statement (AED ${Math.round(totalSpend)}) DOES clear the AED ${gate}/mo minimum - it is the unmapped lines that pushed the mapped total below it. Map more lines before trusting this comparison`,
      );
    }
  }

  if (score.breakdown.some((b) => b.capBound === "annual")) {
    flags.push(
      "an ANNUAL cap bound this cycle's earning - the check gives it 1/12 of its yearly room, which is right for a typical cycle and wrong if spend is front-loaded",
    );
  }
  /*
    `score.uncertain` and "the prediction is a range" are NOT the same thing, and
    saying they are put a visible lie in the first report this harness ever printed:
    "the prediction is a range rather than a figure" appeared next to 13463–13463.

    A score is uncertain whenever anything soft touched it — including a
    medium-confidence VALUATION, which moves the AED figure without widening the unit
    range at all. So the two cases are reported separately, because they call for
    different reading: a wide range means containment is the test, while a degenerate
    range on an uncertain score means the number is exact but rests on a soft input.
  */
  const rangeIsWide = predictedAed.max - predictedAed.min > 1e-9;
  if (rangeIsWide) {
    flags.push(
      "the prediction is a RANGE, not a figure - whether the range contains what the bank paid is the meaningful test here, not the midpoint gap",
    );
  } else if (score.uncertain) {
    flags.push(
      "the prediction is exact, but the score carries confidence flags (typically the reward valuation) that do not widen the range - an AED gap may sit in the valuation rather than the earn model",
    );
  }
  // Rewards only. The fee is a separate line on the statement and is not what the
  // rate model claims to predict.
  if (score.fees.ongoingFeeAed > 0) {
    flags.push("compares REWARDS only - the annual fee is excluded from both sides");
  }

  const check: StatementCheck = {
    cardId: card.id,
    cardName: card.name,
    cycle: statement.cycle,
    rewardCurrency: card.rewards.currency,
    mappedSpendAed,
    unmappedSpendAed,
    unmappedSharePct,
    profile,
    predictedUnits,
    predictedAed,
    flags,
  };

  const mid = midpoint(predictedUnits);
  if (mid > 0) {
    check.unitsRangeWidthPct =
      predictedUnits.max === null ? Infinity : ((predictedUnits.max - predictedUnits.min) / mid) * 100;
  }

  // --- The comparison, in units first. ---
  if (statement.actualRewardUnits !== undefined) {
    const actual = statement.actualRewardUnits;
    check.actualUnits = actual;
    check.unitsWithinRange =
      actual >= predictedUnits.min && (predictedUnits.max === null || actual <= predictedUnits.max);
    check.unitsGap = mid - actual;
    check.unitsGapPct = pctDiff(mid, actual);
  } else {
    flags.push(
      "no actual reward UNITS on this statement - the units comparison, which isolates the earn model from the valuation table, could not be made",
    );
  }

  if (statement.actualRewardAed !== undefined) {
    const actual = statement.actualRewardAed;
    check.actualAed = actual;
    check.aedWithinRange = actual >= predictedAed.min && actual <= predictedAed.max;
    const midAed = (predictedAed.min + predictedAed.max) / 2;
    check.aedGap = midAed - actual;
    check.aedGapPct = pctDiff(midAed, actual);
    if (statement.actualRewardUnits === undefined) {
      flags.push(
        "the AED comparison tests the earn model AND the valuation table together - a gap here does not say which of the two is wrong",
      );
    }
  }

  if (statement.actualRewardUnits === undefined && statement.actualRewardAed === undefined) {
    flags.push("NO GROUND TRUTH on this statement - nothing was validated, only predicted");
  }

  return check;
}

export interface StatementSummary {
  cycles: number;
  /** Checks that had any ground truth at all. The rest validated nothing. */
  compared: number;
  /** How often the engine's range contained what the bank actually paid. */
  withinRange: number;
  withinRangePct: number;
  /** Median signed gap on the midpoint, in %. Positive = the engine OVERSTATES. */
  medianGapPct: number | null;
  /** The worst OVERSTATEMENT seen, which is the direction that matters for this product. */
  worstOverstatementPct: number | null;
  worstOverstatementCard: string | null;
  flags: string[];
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) / 2;
  return s.length % 2 ? s[i]! : (s[Math.floor(i)]! + s[Math.ceil(i)]!) / 2;
}

/**
 * Roll several statement checks into the numbers worth quoting.
 *
 * why overstatement is singled out rather than absolute error: understating tells a
 * user a card is worse than it is, which costs them a little value. Overstating tells
 * them to expect money that never arrives, which is the failure this whole engine has
 * been shaped around avoiding. The two are not symmetric and should not be averaged
 * into one "accuracy" number that hides the direction.
 */
export function summariseStatementChecks(checks: readonly StatementCheck[]): StatementSummary {
  const flags: string[] = [];
  // Prefer the units comparison; fall back to AED where that is all there was.
  const withTruth = checks.filter(
    (c) => c.unitsWithinRange !== undefined || c.aedWithinRange !== undefined,
  );
  const contained = withTruth.filter((c) => c.unitsWithinRange ?? c.aedWithinRange ?? false);
  const gaps = withTruth
    .map((c) => c.unitsGapPct ?? c.aedGapPct)
    .filter((g): g is number => g !== undefined && Number.isFinite(g));

  let worstOverstatementPct: number | null = null;
  let worstOverstatementCard: string | null = null;
  for (const c of withTruth) {
    const g = c.unitsGapPct ?? c.aedGapPct;
    if (g === undefined || !Number.isFinite(g) || g <= 0) continue;
    if (worstOverstatementPct === null || g > worstOverstatementPct) {
      worstOverstatementPct = g;
      worstOverstatementCard = `${c.cardName} (${c.cycle})`;
    }
  }

  if (withTruth.length === 0) {
    flags.push("NOTHING WAS VALIDATED - no statement carried an actual reward figure");
  } else if (withTruth.length < 3) {
    // Said plainly because the temptation to quote a number off one statement is real.
    flags.push(
      `only ${withTruth.length} statement${withTruth.length === 1 ? "" : "s"} carried ground truth - too few to characterise the engine, and not a figure to put on a slide`,
    );
  }

  return {
    cycles: checks.length,
    compared: withTruth.length,
    withinRange: contained.length,
    withinRangePct: withTruth.length > 0 ? (contained.length / withTruth.length) * 100 : 0,
    medianGapPct: median(gaps),
    worstOverstatementPct,
    worstOverstatementCard,
    flags,
  };
}
