/**
 * Cap thresholds — "after AED X of groceries this month, switch to your other card".
 *
 * ── Why this is NOT part of the deadline calendar ───────────────────────────────
 * A monthly cap is the one recurring, per-purchase reason a cardholder needs the
 * product more than once a year, so the obvious move is to put it on the calendar.
 * Doing that requires a crossing DATE, and the only way to get one is
 *
 *     crossing_day ≈ cap_aed / monthly_spend × days_in_month
 *
 * which assumes spend arrives uniformly through the month. That is false in general
 * and specifically false in the UAE, where school fees, rent and DEWA are lumpy and
 * salary lands near the 25th. The assumption would be invisible in the output and
 * indefensible in diligence — the same shape as scoring an "Up to 10%" ceiling as a
 * certain rate, which is the defect this engine already had once.
 *
 * The same fact expressed as a THRESHOLD needs no assumption at all and is more
 * actionable, because the user controls spend directly and the calendar date only
 * ever approximated it:
 *
 *     "After AED 6,000 of grocery spend this month, ADCB stops paying 5% —
 *      switch to Emirates NBD."
 *
 * That statement is exactly true for any spending pattern whatsoever. So thresholds
 * live here, beside the calendar rather than on it, and `DeadlineCertainty` has no
 * "estimated" tier for a crossing date to hide in.
 *
 * ── The second refusal: never state a threshold off a midpoint ──────────────────
 * A merchant-locked bonus with no stated share is bounded 0..full, and the scorer
 * routes it on the midpoint. Dividing a cap by that midpoint would produce a
 * confident-looking threshold that is roughly double the real one. Those options are
 * therefore NOT given a threshold — they go to `unstated`, with the reason, on the
 * same principle as the calendar's `undated` list: the uncertain case is shown, not
 * dropped.
 *
 * Pure functions. No I/O.
 */

import type { Card } from "./card";
import {
  label,
  optionSpendThresholds,
  precomputeCardData,
  type CardData,
  type EarnOption,
  type SpendCategory,
  type SpendingProfile,
} from "./score-card";
import { bestCardForCategory } from "./which-card";
import { DEFAULT_VALUATIONS, type ValuationTable } from "./valuations";

/** Where to put this category's spend once the bonus above stops paying. */
export interface SwitchTarget {
  spendCategory: SpendCategory;
  cardId: string;
  cardName: string;
  /** What that card earns on this category alone, annualised. */
  annualEarningsAed: number;
}

export interface CapThreshold {
  cardId: string;
  cardName: string;
  /** The card's own reward-category name, e.g. "supermarkets_fuel_dining". */
  cardCategory: string;
  /** Canonical spend categories this bonus covers. The cap is SHARED across them. */
  spendCategories: SpendCategory[];
  period: "monthly" | "annual";
  /** AED of spend across `spendCategories` past which the bonus stops paying. Exact. */
  thresholdAed: number;
  /** The user's stated spend across those categories, over the same period. */
  yourSpendAed: number;
  /** True when their stated spend already exceeds the threshold. */
  reached: boolean;
  /**
   * Best alternative among the OTHER cards the user holds, per covered category.
   * Empty when they hold nothing else that earns here — which is itself worth
   * saying, and is why this is an empty array rather than an omitted field.
   */
  switchTo: SwitchTarget[];
  detail: string;
}

/** A capped bonus we deliberately did NOT put a number on, and why. */
export interface UnstatedThreshold {
  cardId: string;
  cardName: string;
  cardCategory: string;
  reason: string;
}

export interface CapThresholdReport {
  /** Reached thresholds first, then by how close the user is to reaching them. */
  thresholds: CapThreshold[];
  unstated: UnstatedThreshold[];
}

function coveredCategories(option: EarnOption): SpendCategory[] {
  return option.rule.kind === "categories" ? option.rule.categories : [];
}

function spendAcross(spending: SpendingProfile, categories: readonly SpendCategory[]): number {
  return categories.reduce((sum, c) => sum + (spending[c] ?? 0), 0);
}

// Same 1e-9 the scorer and the optimizer use, applied RELATIVE to the threshold so it
// holds at any magnitude.
const EPS = 1e-9;

/**
 * Has the user's spend actually passed the threshold?
 *
 * why this is not a bare `>`: the threshold arrives through a float chain — a cap in
 * AED, divided by `aedPerUnit`, divided by units-per-AED — and exact figures do not
 * survive it. FAB Cashback's 5% capped at AED 150/month is exactly AED 3,000 of
 * spend, but the chain yields 2999.9999999999995. A user spending precisely AED
 * 3,000 then "exceeded" it by 4.5e-13, and the screen said REACHED beside two
 * numbers both rounded to "AED 3,000" — which reads as a bug to anyone looking at it,
 * because it is one.
 *
 * Landing exactly ON the cap is not passing it, so the tolerance resolves ties to
 * NOT reached. That is also the conservative direction: it never tells someone to
 * stop using a card whose bonus is still paying.
 */
function hasReached(spendAed: number, thresholdAed: number): boolean {
  return spendAed > thresholdAed * (1 + EPS) + EPS;
}

/**
 * Best card among the user's OTHER holdings for one category.
 *
 * why the capped card is excluded rather than merely out-ranked: once its cap binds,
 * that card is not a candidate at all for the marginal dirham, so leaving it in the
 * pool could return the very card the user is being told to stop using.
 */
function switchTargetFor(
  category: SpendCategory,
  monthlySpend: number,
  cards: readonly Card[],
  excludeCardId: string,
  valuations: ValuationTable,
): SwitchTarget | null {
  const others = cards.filter((c) => c.id !== excludeCardId);
  if (others.length === 0) return null;
  const best = bestCardForCategory(others, category, monthlySpend, valuations);
  if (!best) return null;
  return {
    spendCategory: category,
    cardId: best.cardId,
    cardName: best.cardName,
    annualEarningsAed: best.annualEarningsAed,
  };
}

function describe(
  cardName: string,
  categories: readonly SpendCategory[],
  period: "monthly" | "annual",
  thresholdAed: number,
  reached: boolean,
  yourSpendAed: number,
): string {
  const cats = categories.map(label).join(" / ").toLowerCase();
  const when = period === "monthly" ? "this month" : "this year";
  const amount = `AED ${Math.round(thresholdAed).toLocaleString("en-US")}`;
  if (reached) {
    return `You spend about AED ${Math.round(yourSpendAed).toLocaleString("en-US")} on ${cats} ${when}, so ${cardName}'s bonus stops paying after ${amount} of it.`;
  }
  return `${cardName}'s bonus stops paying after ${amount} of ${cats} ${when}. On your stated spend of AED ${Math.round(yourSpendAed).toLocaleString("en-US")} you would not reach it.`;
}

/**
 * Every capped bonus on the cards a user holds, expressed as the spend threshold at
 * which it stops paying, with somewhere to send the spend next.
 *
 * `spending` is the user's MONTHLY profile, as everywhere else in the engine; annual
 * thresholds compare against it × 12.
 */
export function capThresholds(
  heldCards: readonly Card[],
  spending: SpendingProfile,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
): CapThresholdReport {
  const thresholds: CapThreshold[] = [];
  const unstated: UnstatedThreshold[] = [];

  for (const card of heldCards) {
    // Uses precomputeCardData, not buildEarnOptions, so the options here are the SAME
    // narrowed ones the scorer uses — excluded spend removed, suppressed categories
    // locked, merchant locks bounded. A threshold computed off un-narrowed options
    // could name a category the card does not actually pay on.
    const cd: CardData = precomputeCardData(card, valuations);

    cd.options.forEach((option) => {
      // Narrowed once here so the merchant lock below is visible to the compiler;
      // `coveredCategories` answers the same question but erases the narrowing.
      if (option.rule.kind !== "categories") return; // catch-all / unmatched: no bonus to lose
      const rule = option.rule;
      const categories = coveredCategories(option);
      if (categories.length === 0) return;
      if (option.monthlyCap === null && option.annualCap === null) return; // uncapped

      /*
        A range rate has no exact threshold. `expectedUnitsPerAed` would hand back the
        midpoint and the division would produce a confident number roughly double the
        truth for a 0..full merchant bound. Stated as unstated instead of guessed.
      */
      if (option.rate.value === null) {
        unstated.push({
          cardId: card.id,
          cardName: card.name,
          cardCategory: option.cardCategory,
          reason:
            rule.merchant !== undefined
              ? `The bonus pays only at ${rule.merchant} and nobody has said what share of this spend goes there, so the rate - and therefore the threshold - is a range, not a number.`
              : "This rate is a range rather than a fixed figure, so the spend it covers before the cap binds is a range too.",
        });
        return;
      }

      for (const t of optionSpendThresholds(option, cd.aedPerUnit)) {
        const monthlySpend = spendAcross(spending, categories);
        const yourSpendAed = t.period === "monthly" ? monthlySpend : monthlySpend * 12;
        const reached = hasReached(yourSpendAed, t.spendAed);

        const switchTo: SwitchTarget[] = [];
        for (const c of categories) {
          if ((spending[c] ?? 0) <= 0) continue; // no spend here, nothing to redirect
          const target = switchTargetFor(c, spending[c] ?? 0, heldCards, card.id, valuations);
          if (target) switchTo.push(target);
        }

        thresholds.push({
          cardId: card.id,
          cardName: card.name,
          cardCategory: option.cardCategory,
          spendCategories: categories,
          period: t.period,
          thresholdAed: t.spendAed,
          yourSpendAed,
          reached,
          switchTo,
          detail: describe(card.name, categories, t.period, t.spendAed, reached, yourSpendAed),
        });
      }
    });
  }

  /*
    Reached first, then by proximity — the fraction of the threshold the user's spend
    already covers. A threshold they are at 95% of is the next thing that will bite;
    one they are at 4% of is trivia. Sorting on the ratio rather than on the raw AED
    keeps a small cap on a card they use heavily above a huge cap they never approach.
  */
  const proximity = (t: CapThreshold) => (t.thresholdAed > 0 ? t.yourSpendAed / t.thresholdAed : 0);
  thresholds.sort((a, b) => {
    if (a.reached !== b.reached) return a.reached ? -1 : 1;
    const byProximity = proximity(b) - proximity(a);
    if (byProximity !== 0) return byProximity;
    return a.cardName.localeCompare(b.cardName);
  });

  return { thresholds, unstated };
}
