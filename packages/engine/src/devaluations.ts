/**
 * Known reward-program devaluations — dated facts about programs cutting what a
 * point or mile buys.
 *
 * ── Why this is its own module ──────────────────────────────────────────────────
 * It followed `expiry-policy.ts` out of `burn-priority.ts` for the same reason and
 * by the same precedent: more than one consumer needs the table, and none of them
 * should have to import the burn engine to read a list of dates. Engine 2 uses it to
 * warn "burn premium before this date"; the deadline calendar turns it into events.
 * `burn-priority.ts` re-exports it so its public surface is unchanged.
 *
 * ── The rot this module is built to prevent (found 2026-08-16) ──────────────────
 * This table had exactly ONE entry — Skywards, effective 2026-05-20 — and by August
 * 2026 that date was three months in the past. `burnPriority` filters devaluations to
 * `effectiveDate >= asOf`, so the table quietly warned about nothing at all, and
 * nothing anywhere said so. An empty warning table looks EXACTLY like a table with
 * nothing to warn about. That is the third time this project has been bitten by that
 * shape (two dead study filters were the first two), so the fix is the same one that
 * worked there: make the invisible state a value something can assert on.
 *
 * `DEVALUATIONS_REVIEWED_ON` is that value. It answers the question the entries
 * themselves cannot — "has anybody LOOKED for a new devaluation lately?" — which is
 * the actual failure. Per-entry dates would not have caught this: the Skywards entry
 * was correct on the day it was written and stayed correct; what went stale was the
 * sweep, not the fact.
 *
 * ── Why there is no "must contain a future devaluation" test ────────────────────
 * Because "no devaluation is currently announced" is a perfectly legitimate state of
 * the world, and a test demanding a future entry would be a standing invitation to
 * invent one to make CI green. The staleness check is on the REVIEW, never on the
 * findings — see `devaluationReviewIsStale`.
 *
 * Pure data + pure predicates. No I/O; `asOf` is always passed in.
 */

import type { RedemptionClass } from "./redemption-valuations";

export interface Devaluation {
  currency: string;
  /** ISO date the devaluation takes effect. */
  effectiveDate: string;
  /** Which redemption classes lose value. */
  affects: RedemptionClass[];
  note: string;
}

/**
 * When this table was last swept for new or changed program announcements.
 *
 * Update this whenever you CHECK, even if you change nothing — a sweep that finds
 * nothing is exactly as valuable as one that finds something, and is the only way
 * "no upcoming devaluations" can be distinguished from "nobody has looked".
 */
export const DEVALUATIONS_REVIEWED_ON = "2026-08-16";

/** How long a review stays fresh before the table should be swept again. */
export const DEVALUATION_REVIEW_MAX_AGE_MONTHS = 6;

// why one list: like conversion ratios, devaluation dates change and should live in
// a single editable place the burn engine reads.
export const DEVALUATIONS: Devaluation[] = [
  {
    currency: "Skywards Miles",
    effectiveDate: "2026-05-20",
    affects: ["flight_premium"],
    // why this entry is RETAINED after taking effect rather than deleted: it is the
    // reason `redemption-valuations.ts` models Skywards premium as a user multiplier
    // instead of a fixed number. Deleting it would leave that modelling decision
    // looking arbitrary to the next reader. Consumers filter by date, so a past
    // devaluation raises no warning — see `upcomingDevaluations`.
    note: "~15% premium-cabin devaluation — burn premium (business/first) redemptions before this date",
  },
];

/** Months from `fromISO` to `toISO`, rounded down. Negative if `toISO` is earlier. */
function monthsBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  // Partial month doesn't count: 5 months and 29 days is 5 months, not 6.
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

/** How long ago, in whole months, the table was last swept. */
export function devaluationReviewAgeMonths(
  asOf: string,
  reviewedOn: string = DEVALUATIONS_REVIEWED_ON,
): number {
  return monthsBetween(reviewedOn, asOf);
}

/**
 * True when nobody has swept the table recently enough to trust its silence.
 *
 * This is deliberately surfaced as a FLAG on the calendar rather than thrown or
 * asserted in CI. A stale review is a research task, not a broken build, and a test
 * that failed purely because time passed would be a time bomb that the next person
 * silences by bumping the date without doing the sweep — converting a real signal
 * into a ritual.
 */
export function devaluationReviewIsStale(
  asOf: string,
  reviewedOn: string = DEVALUATIONS_REVIEWED_ON,
  maxAgeMonths: number = DEVALUATION_REVIEW_MAX_AGE_MONTHS,
): boolean {
  return devaluationReviewAgeMonths(asOf, reviewedOn) >= maxAgeMonths;
}

/**
 * Devaluations that have NOT yet taken effect as of `asOf`.
 *
 * The single place this date filter lives, so the burn engine and the calendar can
 * never disagree about whether an entry is still a warning.
 */
export function upcomingDevaluations(
  asOf: string,
  devaluations: readonly Devaluation[] = DEVALUATIONS,
): Devaluation[] {
  return devaluations.filter((d) => Date.parse(d.effectiveDate) >= Date.parse(asOf));
}
