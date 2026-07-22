/**
 * Sensitivity analysis — how the recommendation moves when an input moves.
 *
 * A single "best portfolio" answer hides how *fragile* it is. Two questions this
 * answers:
 *
 *   1. Valuation sensitivity — we value 1 Skywards Mile at 0.037 AED. That number
 *      is researched, not certain. How wrong would it have to be before the
 *      recommendation changes? If a mile has to be worth half what we think for
 *      the answer to flip, the recommendation is robust. If a 5% error flips it,
 *      the recommendation is really a coin toss and should be presented as one.
 *
 *   2. Spending sensitivity — at what monthly grocery spend does one card overtake
 *      another? Fee-carrying cards need volume to pay for themselves, so the
 *      answer changes with spend, and the crossover is the useful number.
 *
 * ---------------------------------------------------------------------------
 * NO NEW SCORING OR OPTIMIZATION MATH LIVES HERE. Every number comes from
 * `optimizePortfolio`, called repeatedly with one perturbed input. This module
 * only (a) builds the perturbed inputs, (b) samples, (c) brackets and bisects
 * where the winner changes. If a value looks wrong, the bug is upstream in the
 * scorer, not here.
 * ---------------------------------------------------------------------------
 *
 * The math, stated plainly. For a FIXED portfolio, net annual value is a smooth
 * (mostly linear) function of either swept input. The recommendation is the
 * pointwise MAXIMUM over all candidate portfolios — an upper envelope. An
 * envelope of curves is continuous but kinked: the kinks are exactly where the
 * winning card set changes. So `samples` traces the envelope, and `flips` locates
 * its kinks. We find them by sampling on a grid, detecting adjacent samples with
 * different winners, then bisecting inside that bracket.
 *
 * Cost, because it is not free: each sample and each bisection step is one full
 * `optimizePortfolio` run — measured at ~1s over the 53-card set (~23k subsets).
 * A default sweep is therefore ~25 runs (~25s). That is fine for a precomputed
 * or server-side analysis and too slow for a keystroke-interactive UI; step
 * counts are caller-controlled so the cost is explicit. `optimizerRuns` reports
 * exactly what a call spent.
 *
 * Pure and deterministic. No I/O.
 */

import type { Card } from "./card";
import {
  optimizePortfolio,
  type OptimizeOptions,
  type Portfolio,
  type UserProfile,
} from "./optimize-portfolio";
import type { AedRange, ScoreFlag, SpendCategory, SpendingProfile } from "./score-card";
import {
  DEFAULT_VALUATIONS,
  withValuations,
  type ValuationConfidence,
  type ValuationTable,
} from "./valuations";

// ===========================================================================
// Output shapes — structured for charting.
// ===========================================================================

/** What was swept. Lets a chart label its x-axis without the caller re-deriving it. */
export type SensitivityVariable =
  | {
      kind: "valuation";
      /** The reward currency whose AED-per-unit value was perturbed. */
      currency: string;
      /** The un-perturbed value from the caller's table — the "you are here" x. */
      baselineAedPerUnit: number;
    }
  | {
      kind: "spend";
      category: SpendCategory;
      /** The caller's actual monthly spend in this category — the "you are here" x. */
      baselineMonthlyAed: number;
    };

/** The recommendation at one sampled input value: one point on the chart. */
export interface SensitivitySample {
  /** The swept input value — AED/unit (valuation) or AED/month (spend). */
  x: number;
  /**
   * Recommended portfolio's card ids, SORTED. Sorting matters: it makes the id
   * list a stable identity for "the same recommendation", so we compare answers
   * rather than incidental orderings.
   */
  cardIds: string[];
  /** Ongoing (year 2+) net annual AED — the same number the optimizer ranks on. */
  netAnnualValue: number;
  netAnnualValueRange: AedRange;
  /** Card count of the winner, or 0 when none could be formed. */
  size: 0 | 1 | 2 | 3;
  /** True when no portfolio exists at this x (e.g. nothing passes eligibility). */
  empty: boolean;
}

/** A break-even: the input value where the recommendation changes. */
export interface FlipPoint {
  /**
   * Best estimate of the break-even — the midpoint of `bracket`. Treat it as
   * `x ± precision`, not an exact root.
   */
  x: number;
  /** Bisection bracket. `from` wins at `lo`, `to` wins at `hi`; the change is inside. */
  bracket: { lo: number; hi: number };
  /** Half-width of the bracket: the honest uncertainty on `x`. */
  precision: number;
  /** Winning card ids just below the flip. */
  from: string[];
  /** Winning card ids just above the flip. */
  to: string[];
}

export interface SensitivityCurve {
  variable: SensitivityVariable;
  /** Sampled points, ascending in x. */
  samples: SensitivitySample[];
  /** Recommendation changes across the swept range, ascending in x. Empty = robust. */
  flips: FlipPoint[];
  /** The recommendation at the caller's un-perturbed input — the "you are here" point. */
  baseline: SensitivitySample;
  /**
   * How far the input can move from baseline before the answer changes, as an
   * absolute distance in x. `null` when nothing flips inside the swept range —
   * meaning "robust at least across this range", NOT "robust everywhere".
   */
  distanceToNearestFlip: number | null;
  /** Optimizer runs this call consumed. Cost transparency; see the header. */
  optimizerRuns: number;
}

// ===========================================================================
// Options.
// ===========================================================================

export interface SweepOptions {
  /** Evenly spaced samples across the range, endpoints included. Default 13, min 2. */
  steps?: number;
  /**
   * Bisection iterations per detected flip. Each halves the bracket and costs one
   * optimizer run, so precision improves exponentially and cost only linearly:
   * 12 iterations narrows a bracket to 1/4096 of one grid step. Default 12; 0 to
   * skip refinement and just report the grid bracket.
   */
  refineIterations?: number;
  /** Forwarded verbatim to optimizePortfolio (e.g. `{ maxCards: 1 }`). */
  optimize?: OptimizeOptions;
}

export interface ValuationSensitivityOptions extends SweepOptions {
  /** Reward currency to perturb — must exist in the valuation table (see below). */
  currency: string;
  /**
   * Sweep ±this fraction around the table's current value. Default 0.5 (±50%).
   * Ignored when `range` is given.
   */
  relativeRange?: number;
  /** Explicit absolute AED-per-unit bounds. Overrides `relativeRange`. */
  range?: { from: number; to: number };
  /** Base table to perturb. Defaults to DEFAULT_VALUATIONS. */
  valuations?: ValuationTable;
}

export interface SpendingSensitivityOptions extends SweepOptions {
  /** Spend category to sweep. Other categories hold at the caller's values. */
  category: SpendCategory;
  /** Lower bound, AED/month. Default 0. */
  from?: number;
  /** Upper bound, AED/month. Default max(10000, 2x the baseline spend). */
  to?: number;
  /** Valuation table held fixed across the sweep. Defaults to DEFAULT_VALUATIONS. */
  valuations?: ValuationTable;
}

// ===========================================================================
// Public entry points.
// ===========================================================================

/**
 * Sweep one reward currency's AED-per-unit valuation and report where the
 * recommendation flips.
 *
 * why this is the interesting sensitivity: the valuation table is the softest
 * input in the whole model. Rates and fees are published facts; "what a mile is
 * worth" is a judgment call carrying an explicit confidence. Perturbing it
 * re-prices every card earning that currency at once, which is exactly the real
 * correlated risk — if we're wrong about Skywards Miles, we're wrong about every
 * Skywards card simultaneously.
 */
export function valuationSensitivity(
  spending: SpendingProfile,
  userProfile: UserProfile,
  cards: Card[],
  options: ValuationSensitivityOptions,
): SensitivityCurve {
  const table = options.valuations ?? DEFAULT_VALUATIONS;
  const entry = table[options.currency];

  // why throw instead of degrading: resolveValuation() would hand back a flagged
  // 0-AED entry for an unknown currency, and sweeping that produces a perfectly
  // flat, flip-free curve — which reads as "this input doesn't matter" when the
  // truth is "you named a currency nothing earns". A silent misleading answer is
  // worse than a loud failure.
  if (!entry) {
    throw new Error(
      `valuationSensitivity: no valuation entry for currency "${options.currency}". ` +
        `Known currencies: ${Object.keys(table).sort().join(", ")}`,
    );
  }

  const baselineX = entry.aedPerUnit;
  const relative = options.relativeRange ?? 0.5;
  if (!options.range && relative <= 0) {
    throw new Error(`valuationSensitivity: relativeRange must be > 0, got ${relative}`);
  }
  const range = options.range ?? {
    from: baselineX * (1 - relative),
    to: baselineX * (1 + relative),
  };

  // why the entry is spread rather than replaced: confidence and note describe the
  // currency, not the number. Keeping them means a perturbed run still carries the
  // right uncertainty flags into the portfolio receipt.
  const evaluate = (x: number): Portfolio | null =>
    optimizePortfolio(
      spending,
      userProfile,
      cards,
      withValuations({ [options.currency]: { ...entry, aedPerUnit: x } }, table),
      options.optimize ?? {},
    ).overallBest;

  return runSweep(
    evaluate,
    range,
    baselineX,
    { kind: "valuation", currency: options.currency, baselineAedPerUnit: baselineX },
    options,
  );
}

/**
 * Sweep monthly spend in one category and report where the recommendation flips.
 *
 * Every other category holds at the caller's values — this is a one-at-a-time
 * sensitivity, so it answers "how does the answer depend on THIS category",
 * not "what happens if my whole spending pattern shifts". Joint moves are not
 * modeled; two inputs can interact in ways no single sweep reveals.
 */
export function spendingSensitivity(
  spending: SpendingProfile,
  userProfile: UserProfile,
  cards: Card[],
  options: SpendingSensitivityOptions,
): SensitivityCurve {
  const table = options.valuations ?? DEFAULT_VALUATIONS;
  const baselineX = spending[options.category] ?? 0;
  const from = options.from ?? 0;
  // why this default ceiling: sweeping to 2x the user's own spend keeps their
  // operating point mid-chart, and the 10,000 floor keeps the range meaningful
  // for someone who currently spends 0 in the category.
  const to = options.to ?? Math.max(10_000, baselineX * 2);

  const evaluate = (x: number): Portfolio | null =>
    optimizePortfolio(
      { ...spending, [options.category]: x },
      userProfile,
      cards,
      table,
      options.optimize ?? {},
    ).overallBest;

  return runSweep(
    evaluate,
    { from, to },
    baselineX,
    { kind: "spend", category: options.category, baselineMonthlyAed: baselineX },
    options,
  );
}

// ===========================================================================
// The sweep itself — shared by both entry points.
// ===========================================================================

/**
 * Identity of a recommendation, for equality comparisons. Sorted ids joined; ""
 * means "no portfolio". Two samples with the same key ARE the same answer.
 */
function keyOf(sample: SensitivitySample): string {
  return sample.cardIds.join(",");
}

function toSample(x: number, portfolio: Portfolio | null): SensitivitySample {
  if (!portfolio) {
    return {
      x,
      cardIds: [],
      netAnnualValue: 0,
      netAnnualValueRange: { min: 0, max: 0 },
      size: 0,
      empty: true,
    };
  }
  return {
    x,
    cardIds: [...portfolio.cardIds].sort(),
    netAnnualValue: portfolio.netAnnualValue,
    netAnnualValueRange: portfolio.netAnnualValueRange,
    size: portfolio.size,
    empty: false,
  };
}

function runSweep(
  evaluate: (x: number) => Portfolio | null,
  range: { from: number; to: number },
  baselineX: number,
  variable: SensitivityVariable,
  options: SweepOptions,
): SensitivityCurve {
  const steps = options.steps ?? 13;
  const refineIterations = options.refineIterations ?? 12;
  if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    throw new Error(`sensitivity: range must be finite, got [${range.from}, ${range.to}]`);
  }
  if (range.to <= range.from) {
    throw new Error(`sensitivity: range.to (${range.to}) must exceed range.from (${range.from})`);
  }
  if (steps < 2) throw new Error(`sensitivity: steps must be >= 2, got ${steps}`);
  if (refineIterations < 0) {
    throw new Error(`sensitivity: refineIterations must be >= 0, got ${refineIterations}`);
  }

  let optimizerRuns = 0;
  const run = (x: number): SensitivitySample => {
    optimizerRuns++;
    return toSample(x, evaluate(x));
  };

  // --- 1. Sample the grid, endpoints inclusive. ---
  const samples: SensitivitySample[] = [];
  const width = range.to - range.from;
  for (let i = 0; i < steps; i++) {
    // why compute x from the fraction rather than accumulating a step: repeated
    // addition drifts in floating point, and the last sample must land exactly on
    // range.to so the chart's axis ends where the caller asked.
    samples.push(run(range.from + (width * i) / (steps - 1)));
  }

  // --- 2. Between adjacent samples that disagree, bisect to localize the flip. ---
  const flips: FlipPoint[] = [];
  for (let i = 0; i + 1 < samples.length; i++) {
    const left = samples[i]!;
    const right = samples[i + 1]!;
    if (keyOf(left) === keyOf(right)) continue;

    let lo = left.x;
    let hi = right.x;
    let loSample = left;
    let hiSample = right;
    const loKey = keyOf(left);

    for (let n = 0; n < refineIterations; n++) {
      const mid = (lo + hi) / 2;
      // Guard against a bracket collapsed to the floating-point floor.
      if (mid <= lo || mid >= hi) break;
      const midSample = run(mid);
      if (keyOf(midSample) === loKey) {
        lo = mid;
        loSample = midSample;
      } else {
        // why any non-lo winner moves `hi` down (even a THIRD portfolio, not
        // `right`'s): we're locating the FIRST change as x rises. If a third
        // answer wins in between, the first boundary is still below mid, and
        // `to` correctly reports whoever holds just above the boundary.
        hi = mid;
        hiSample = midSample;
      }
    }

    flips.push({
      x: (lo + hi) / 2,
      bracket: { lo, hi },
      precision: (hi - lo) / 2,
      from: loSample.cardIds,
      to: hiSample.cardIds,
    });
  }

  // --- 3. The caller's own operating point, reusing a sample when one lands on it. ---
  // why reuse: at ~1s per optimizer run, a redundant evaluation is a real cost.
  const onGrid = samples.find((s) => Math.abs(s.x - baselineX) <= Math.abs(baselineX) * 1e-12);
  const baseline = onGrid ?? run(baselineX);

  // --- 4. How much headroom before the answer changes. ---
  // why absolute distance rather than signed: the useful question is "how far can
  // this input be wrong", and direction is already recoverable from bracket vs
  // baseline. null means no flip in range — robust ACROSS THIS RANGE only.
  const distanceToNearestFlip = flips.length
    ? Math.min(...flips.map((f) => Math.abs(f.x - baselineX)))
    : null;

  return { variable, samples, flips, baseline, distanceToNearestFlip, optimizerRuns };
}

// ===========================================================================
// Fragility: connecting sensitivity to the honesty model.
// ===========================================================================

/**
 * How stable the recommendation is with respect to ONE currency's valuation.
 *
 * The band is asymmetric on purpose — a recommendation can tolerate a currency
 * being worth 40% more but break if it's worth 8% less, and averaging those into
 * a single "±" would hide the fragile side.
 */
export interface ValuationFragility {
  currency: string;
  /** The valuation table's own confidence in this number. */
  confidence: ValuationConfidence;
  baselineAedPerUnit: number;
  /** Recommended cards that earn this currency — who the flag is actually about. */
  cardIds: string[];
  /**
   * The band around baseline within which the recommendation does NOT change.
   * `null` on a side means no flip was found out to the edge of the swept range,
   * i.e. stable at least that far — not stable forever.
   */
  stableBand: { from: number | null; to: number | null };
  /** Smallest RELATIVE move that changes the recommendation (0.08 = 8%). Null if none in range. */
  relativeHeadroom: number | null;
  /** True when relativeHeadroom is at or inside the caller's fragility threshold. */
  fragile: boolean;
  optimizerRuns: number;
}

export interface FragilityOptions extends SweepOptions {
  /** Base valuation table. Defaults to DEFAULT_VALUATIONS. */
  valuations?: ValuationTable;
  /** How far around each baseline to look for a flip. Default 0.5 (±50%). */
  relativeRange?: number;
  /**
   * Flag when a valuation error of this size or smaller changes the answer.
   * Default 0.25 — a recommendation that a 25% valuation error can overturn is
   * not a recommendation we should state flatly.
   */
  fragileWithinRelative?: number;
  /**
   * Which valuation confidences are eligible to be flagged. Default ["low",
   * "medium"].
   *
   * why "high" is excluded by default: this flag is about UNVERIFIED inputs, per
   * the project's never-fabricate rule. A narrow stability band around a
   * researched, high-confidence value is a genuinely close call between two good
   * cards, not a data-quality problem, and labelling it "unverified" would be
   * false. Callers wanting the close-call signal can pass all three and read
   * `findings` directly.
   */
  confidences?: ValuationConfidence[];
}

export interface FragilityAssessment {
  /** One entry per checked currency, fragile or not — the audit trail. */
  findings: ValuationFragility[];
  /** Receipt-ready flags for the fragile ones. Empty when the recommendation is robust. */
  flags: ScoreFlag[];
  optimizerRuns: number;
}

/**
 * Assess whether the recommendation rests on valuations we haven't verified.
 *
 * This is the bridge between sensitivity analysis and the honesty model: the
 * engine already refuses to fabricate a rate it can't parse, and this extends the
 * same discipline to the recommendation as a whole. "Your best portfolio is X"
 * means something different when X only wins because we guessed a placeholder
 * right, and the user deserves to be told which of the two they're getting.
 *
 * SCOPE — deliberately limited to currencies the RECOMMENDED cards earn. Those
 * are the values whose error directly re-prices the answer, and there are only
 * one to three of them, so the check costs a handful of sweeps. A rival card's
 * *undervalued* currency could also flip the answer, but proving that needs a
 * sweep per unresearched currency in the whole universe (~20 sweeps, minutes of
 * compute) — worth doing offline as a data-quality audit, not on a user request.
 *
 * COST: one optimizer run to find the recommendation, plus one sweep per checked
 * currency. `optimizerRuns` reports the total.
 */
export function assessValuationFragility(
  spending: SpendingProfile,
  userProfile: UserProfile,
  cards: Card[],
  options: FragilityOptions = {},
): FragilityAssessment {
  const table = options.valuations ?? DEFAULT_VALUATIONS;
  const threshold = options.fragileWithinRelative ?? 0.25;
  const confidences = options.confidences ?? (["low", "medium"] as ValuationConfidence[]);
  const relativeRange = options.relativeRange ?? 0.5;

  let optimizerRuns = 1;
  const recommendation = optimizePortfolio(
    spending,
    userProfile,
    cards,
    table,
    options.optimize ?? {},
  ).overallBest;
  if (!recommendation) return { findings: [], flags: [], optimizerRuns };

  // Currencies the recommended cards actually earn, deduped, in a stable order.
  const byId = new Map(cards.map((c) => [c.id, c]));
  const currencyToCards = new Map<string, string[]>();
  for (const id of [...recommendation.cardIds].sort()) {
    const currency = byId.get(id)?.rewards.currency;
    if (!currency) continue;
    currencyToCards.set(currency, [...(currencyToCards.get(currency) ?? []), id]);
  }

  const findings: ValuationFragility[] = [];
  for (const [currency, cardIds] of currencyToCards) {
    const entry = table[currency];
    if (!entry || !confidences.includes(entry.confidence)) continue;
    // why skip a zero baseline: the sweep is defined relative to it, so there is
    // no meaningful "±X%" to report. A 0-valued currency is already flagged
    // upstream as unvaluable.
    if (entry.aedPerUnit <= 0) continue;

    const curve = valuationSensitivity(spending, userProfile, cards, {
      currency,
      relativeRange,
      steps: options.steps,
      refineIterations: options.refineIterations,
      optimize: options.optimize,
      valuations: table,
    });
    optimizerRuns += curve.optimizerRuns;

    const baseline = entry.aedPerUnit;
    // Nearest flip on each side. The recommendation holds strictly between them.
    const below = curve.flips.filter((f) => f.x < baseline).map((f) => f.x);
    const above = curve.flips.filter((f) => f.x >= baseline).map((f) => f.x);
    const from = below.length ? Math.max(...below) : null;
    const to = above.length ? Math.min(...above) : null;

    const gaps: number[] = [];
    if (from !== null) gaps.push((baseline - from) / baseline);
    if (to !== null) gaps.push((to - baseline) / baseline);
    const relativeHeadroom = gaps.length ? Math.min(...gaps) : null;

    findings.push({
      currency,
      confidence: entry.confidence,
      baselineAedPerUnit: baseline,
      cardIds,
      stableBand: { from, to },
      relativeHeadroom,
      fragile: relativeHeadroom !== null && relativeHeadroom <= threshold,
      optimizerRuns: curve.optimizerRuns,
    });
  }

  const flags: ScoreFlag[] = findings
    .filter((f) => f.fragile)
    .map((f) => ({
      // why "unknown" for low confidence: the receipt already uses that level for
      // "we could not establish this", which is exactly the situation — the answer
      // turns on a number we admit we don't know. Medium confidence is a softer
      // "low" because the value is defensible, just not firm.
      level: f.confidence === "low" ? ("unknown" as const) : ("low" as const),
      message: fragilityMessage(f),
    }));

  return { findings, flags, optimizerRuns };
}

/** The user-facing sentence. Reports the asymmetric band, not a misleading single ±. */
function fragilityMessage(f: ValuationFragility): string {
  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
  const cards = f.cardIds.join(", ");
  const sides: string[] = [];
  if (f.stableBand.from !== null) {
    sides.push(`${pct((f.baselineAedPerUnit - f.stableBand.from) / f.baselineAedPerUnit)} less`);
  }
  if (f.stableBand.to !== null) {
    sides.push(`${pct((f.stableBand.to - f.baselineAedPerUnit) / f.baselineAedPerUnit)} more`);
  }

  // why the lead-in changes with confidence: for an unresearched value the story
  // is "we might be wrong about this number", but for a researched one it's "these
  // two cards are genuinely near-tied". Same measurement, different meaning —
  // saying "unverified" about a high-confidence value would be a false claim.
  const lead =
    f.confidence === "high"
      ? `recommendation is a close call, sensitive to the valuation of`
      : `recommendation is sensitive to an ${
          f.confidence === "low" ? "unverified" : "not firmly established"
        } valuation:`;

  return (
    `${lead} "${f.currency}" (${cards}). We value it at ${f.baselineAedPerUnit} AED/unit; ` +
    `the recommended cards change if it is worth ${sides.join(" or ")} ` +
    `(stable only within ±${pct(f.relativeHeadroom ?? 0)}).`
  );
}

/**
 * Return a copy of the portfolio with fragility flags appended to its receipt.
 *
 * why a separate step rather than folding this into optimizePortfolio: the
 * assessment costs many optimizer runs and itself CALLS optimizePortfolio, so
 * building it in would be both recursive and a ~25x slowdown on every scoring
 * call. The caller decides when the honesty signal is worth the compute.
 */
export function withFragilityFlags(portfolio: Portfolio, flags: ScoreFlag[]): Portfolio {
  if (flags.length === 0) return portfolio;
  return {
    ...portfolio,
    flags: [...portfolio.flags, ...flags],
    // why uncertain flips true: a recommendation that a small valuation error can
    // overturn IS an uncertain recommendation, and the UI keys its soft-estimate
    // presentation off this field.
    uncertain: portfolio.uncertain || flags.length > 0,
  };
}
