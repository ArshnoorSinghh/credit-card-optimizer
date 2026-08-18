/**
 * The universe filters the gap study measures with — extracted so there is exactly
 * ONE definition of each.
 *
 * ── Why this file exists ────────────────────────────────────────────────────────
 * Every serious defect this project has found survived because a filter silently
 * matched NOTHING, and nothing asserted otherwise. Twice:
 *
 *   1. The SOUND filter tested for the contiguous substring "assumes spend occurs",
 *      but the emitted message is `<cat>: assumes <a>/<b> spend occurs at <merchant>`
 *      — the category list sits INSIDE the phrase, so the merchant leg of the filter
 *      was dead for its entire life. Every merchant-accelerator card was scored as
 *      SOUND, which is how `emaar_malls` (6.25%, canonical `other`) credited a user's
 *      whole `other` spend as if every dirham were spent inside an Emaar mall.
 *   2. An earlier revision guessed the tier-3 wording as "Unknown rate". The engine
 *      says "Unresolved rate on". That clause matched nothing either.
 *
 * Both bugs INFLATED the headline, both were invisible (a filter that matches
 * nothing looks exactly like a filter with nothing to reject), and both were found
 * by accident. So the clauses are declared as DATA here, each with a name, and
 * study-filters.test.ts asserts that every one of them still matches at least one
 * real flag produced by the real card data. A reworded engine message now fails a
 * test instead of quietly widening the universe.
 *
 * The second failure mode this closes: gap-study.test.ts and gap-diag.test.ts used
 * to carry their own copies of these predicates and had to be kept "in lockstep" by
 * a comment. They now both import from here, so they cannot drift.
 *
 * Pure predicates over strings and cards. No I/O.
 */

import type { Card } from "./card";
import type { ScoreFlag } from "./score-card";

/**
 * One reason to reject a card from the SOUND universe. Named so a test can report
 * WHICH clause went dead, and so the diagnostic can attribute a rejection.
 *
 * The distinction the SOUND universe draws:
 *   REJECT — rate defects. A low-confidence rate is usually a promo string ("first
 *            10 orders, 35% back") the normalizer could not resolve to a steady
 *            state; an unstated merchant assumption means the rate only holds at one
 *            retailer. Both INFLATE.
 *   ALLOW  — valuation softness (a points currency not yet researched) and cap
 *            notices. These move the number a few percent either way; they do not
 *            manufacture a 35% return.
 */
export interface RateDefectClause {
  name: string;
  /** What the engine has to emit for this clause to be live. */
  test: (message: string) => boolean;
  /** Why a card matching this must not back a published figure. */
  why: string;
}

export const RATE_DEFECT_CLAUSES: readonly RateDefectClause[] = [
  {
    name: "unstated-merchant-assumption",
    // NOT "assumes spend occurs" — see the header. The category list splits that
    // phrase. A card whose merchant share the user HAS stated emits a different
    // message ("counts the 30% of your ... spend you told us happens at ...") and is
    // deliberately NOT caught here: that is a stated input, not our assumption.
    test: (m) => m.includes("spend occurs at"),
    why: "the bonus only holds at one retailer and nobody has said how much spend lands there",
  },
  {
    name: "low-confidence-rate",
    test: (m) => m.startsWith("Low-confidence rate"),
    why: "the rate string could not be resolved to a steady-state rate (usually a promo)",
  },
  {
    name: "unresolved-rate",
    // The engine's tier-3 wording. An earlier revision guessed "Unknown rate".
    test: (m) => m.startsWith("Unresolved rate on"),
    why: "the rate is a ceiling or an unrecognized pattern, scored only as a range",
  },
] as const;

/** True when a single flag message is a rate defect (any clause matches). */
export function isRateDefect(message: string): boolean {
  return RATE_DEFECT_CLAUSES.some((c) => c.test(message));
}

/** The names of every clause matched by a set of flags — for attribution in tests. */
export function rateDefectsIn(flags: readonly ScoreFlag[]): Set<string> {
  const hit = new Set<string>();
  for (const f of flags) {
    for (const c of RATE_DEFECT_CLAUSES) if (c.test(f.message)) hit.add(c.name);
  }
  return hit;
}

/** A card is SOUND for this profile when none of its flags is a rate defect. */
export function isSoundScore(flags: readonly ScoreFlag[]): boolean {
  return !flags.some((f) => isRateDefect(f.message));
}

/**
 * The editorial "we do not stand behind this figure" marker recorded in the data.
 *
 * GOTCHA this encodes: the check is a substring match on the caveat text, so a
 * caveat that SAYS the publication block was lifted ("... do not publish block
 * released") keeps the card excluded. That bit us once. Reword the caveat; don't
 * loosen this.
 */
export function hasDoNotPublishCaveat(card: Card): boolean {
  return (card.data_caveat ?? "").toLowerCase().includes("do not publish");
}

/**
 * The plausibility bar the study states in its own output: a UAE credit card
 * returning more than this share of total spend does not exist, so a median above it
 * is a DATA defect, not a product result.
 *
 * It was a printed console note with a `<-- plausibility check` arrow next to it,
 * which is to say it was a thing a human had to notice. study-filters.test.ts now
 * asserts it.
 */
export const IMPLAUSIBLE_RETURN_PCT = 8;
