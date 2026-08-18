/**
 * Deadline calendar — the dated things a cardholder loses money by forgetting.
 *
 * Three sources, one timeline: points that expire, programs that devalue, and annual
 * fees that renew. See CALENDAR_SPEC.md for the product reasoning; this header covers
 * the two constraints that shape the code.
 *
 * ── 1. This module COMPOSES. It ESTIMATES nothing ───────────────────────────────
 * Expiry dates come from `burnPriority`, devaluation dates from
 * `upcomingDevaluations`, fee amounts from `computeFees`. The calendar reshapes and
 * merges them; it never re-derives a date another engine already owns.
 *
 * The one date computed here is the next fee anniversary, and it is arithmetic on a
 * date the USER supplied (`openedOn` plus whole years), not an estimate — there is
 * no model in it and nothing to be wrong about beyond the leap-year note on
 * `nextAnniversary`. That is the line: composing is fine, and deriving a certain
 * date from a certain input is fine; producing a NEW estimate is not.
 *
 * That constraint is not tidiness. A second implementation of "when do these miles
 * expire" would drift from the first, and the drift would be invisible — both would
 * keep returning plausible dates. `points_expiry` events are asserted against
 * `burnPriority`'s own output in the tests for exactly this reason.
 *
 * ── 2. A calendar makes omission look like good news ────────────────────────────
 * `burn-priority.ts` refuses to invent an expiry: no date, no urgency. Correct — and
 * a calendar inverts the pressure on it. Everything ON a calendar reads as equally
 * certain, and everything the calendar cannot date simply is not drawn, which the
 * user reads as "nothing is coming up". That is a false statement produced by
 * omission rather than by fabrication, and it is the third time this shape has come
 * up here (two study filters matched nothing and looked exactly like filters with
 * nothing to reject).
 *
 * So the model has two halves that must BOTH be rendered:
 *   - `events`  — things we can date, each carrying `certainty`.
 *   - `undated` — things we know exist and cannot date, each carrying the exact
 *                 question that would date it. Never dropped, never inferred.
 *
 * The undated list is not a consolation prize. "We know your Etihad miles expire,
 * tell us when you earned them" is the highest-intent question in the product.
 *
 * ── What is deliberately NOT here: cap crossings ────────────────────────────────
 * Dating a monthly-cap crossing needs `cap / monthly_spend * days_in_month`, which
 * assumes spend arrives uniformly through the month. That is false in general and
 * specifically false in the UAE, where school fees, rent and DEWA are lumpy and
 * salary lands near the 25th. The assumption would be invisible in the output.
 *
 * The same fact stated as a THRESHOLD needs no assumption and is more actionable:
 * "after AED 6,000 of groceries this month, switch to X". That belongs beside the
 * calendar, not on it — which is why `DeadlineCertainty` has no third "estimated"
 * tier for it to hide in.
 *
 * Pure functions. No I/O — `asOf` is passed in, as everywhere else in this engine.
 */

import type { Card } from "./card";
import type { PointsInventory } from "./points-inventory";
import { burnPriority, type BurnItem, type BurnPlan } from "./burn-priority";
import {
  DEVALUATIONS,
  devaluationReviewAgeMonths,
  devaluationReviewIsStale,
  upcomingDevaluations,
  type Devaluation,
} from "./devaluations";
import { computeFees, scoreCard, type SpendingProfile } from "./score-card";
import { DEFAULT_VALUATIONS, type ValuationTable } from "./valuations";

export type DeadlineKind = "points_expiry" | "devaluation" | "fee_renewal";

/**
 * How firmly the DATE is known. Only two tiers, and that is the point — nothing on
 * this calendar rests on an assumption about user behaviour.
 */
export type DeadlineCertainty =
  /** A date the user gave us, or one the program published. */
  | "dated"
  /** Program policy applied to a user-supplied anchor date. An estimate, and says so. */
  | "projected";

export interface DeadlineEvent {
  kind: DeadlineKind;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Days from `asOf`. NEGATIVE for a deadline that has already passed. */
  daysAway: number;
  certainty: DeadlineCertainty;
  title: string;
  detail: string;
  /**
   * AED at stake. Present ONLY where it can be computed without an assumption —
   * absent is meaningful, not missing data. See the devaluation builder for the
   * clearest case of a deadline whose cost genuinely cannot be priced.
   */
  valueAtRiskAed?: number;
  /** What to do about it. A deadline with no action is just anxiety. */
  action?: string;
  flags: string[];
}

/**
 * A deadline we know EXISTS but cannot place on a date.
 *
 * Rendered, always. The alternative — leaving it out — is what makes an empty
 * calendar read as "nothing is coming up" when the truth is "we don't know".
 */
export interface UndatedDeadline {
  kind: DeadlineKind;
  title: string;
  /** Why it can't be dated. */
  reason: string;
  /** The question that would date it, ready to put in front of the user. */
  prompt: string;
}

export interface DeadlineCalendar {
  asOf: string;
  /** Dated deadlines, soonest first. Past-dated events sort first and are kept. */
  events: DeadlineEvent[];
  undated: UndatedDeadline[];
  /**
   * Dated deadlines further out than the horizon, omitted from `events`. Reported as
   * a COUNT rather than silently dropped — the user should know the calendar is
   * showing a window, not everything.
   */
  beyondHorizon: number;
  flags: string[];
}

/** A card the user holds, plus the one date the renewal deadline needs. */
export interface HeldCard {
  card: Card;
  /**
   * ISO date the card was OPENED WITH THE BANK. Undefined when unknown.
   *
   * why this cannot fall back to `SavedCard.createdAt`: that records when the user
   * added the card to Fils, which is a different fact. Substituting one for the
   * other would put a plausible wrong date on a fee the user is about to be charged
   * — the same class of error as scoring a marketing ceiling as a certain rate.
   */
  openedOn?: string;
}

export interface CalendarInput {
  inventory?: PointsInventory;
  heldCards?: readonly HeldCard[];
  /** Used only to re-score a card against its own fee at renewal. */
  spending?: SpendingProfile;
}

export interface CalendarOptions {
  /** How far ahead to draw. Default 365 days. */
  horizonDays?: number;
  valuations?: ValuationTable;
  devaluations?: readonly Devaluation[];
}

const DEFAULT_HORIZON_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / MS_PER_DAY);
}

/** "1234.5" -> "1,235". Deterministic across environments, unlike toLocaleString. */
function aed(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * The next occurrence of `openedOn`'s month/day that is on or after `asOf`.
 *
 * why the Feb-29 case is left to roll into 1 March: a card opened on 29 February
 * renews on a date the bank picks in non-leap years, and we don't know which
 * convention they use. Rolling forward is the conservative direction — it never
 * warns AFTER the charge — and the one-day error is not worth a fabricated rule.
 */
function nextAnniversary(openedOn: string, asOf: string): string {
  const opened = new Date(openedOn + "T00:00:00Z");
  const asOfDate = new Date(asOf + "T00:00:00Z");
  const candidate = new Date(
    Date.UTC(asOfDate.getUTCFullYear(), opened.getUTCMonth(), opened.getUTCDate()),
  );
  if (candidate.getTime() < asOfDate.getTime()) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Source 1: points expiry — a reshaping of burnPriority, never a recomputation.
// ---------------------------------------------------------------------------

/**
 * `BurnItem.expirySource` maps ONTO `DeadlineCertainty` exactly, which is why this
 * function is a mapping and not a judgement. "explicit" is the user's own date;
 * "projected_default" is program policy applied to their earnedDate; "unknown" never
 * reaches here — it becomes an `UndatedDeadline` instead.
 */
function expiryEvent(item: BurnItem, asOf: string): DeadlineEvent | null {
  if (!item.expiryDate) return null;
  const certainty: DeadlineCertainty =
    item.expirySource === "explicit" ? "dated" : "projected";
  const daysAway = daysBetween(asOf, item.expiryDate);
  const past = daysAway < 0;

  return {
    kind: "points_expiry",
    date: item.expiryDate,
    daysAway,
    certainty,
    title: `${aed(item.balance)} ${item.currency} ${past ? "expired" : "expire"}`,
    detail:
      certainty === "projected"
        ? `Projected from program policy, not confirmed by the bank. Worth about AED ${aed(item.valueAtRiskAed)}.`
        : `Worth about AED ${aed(item.valueAtRiskAed)} at the best route available.`,
    // Straight from burnPriority — the AED it already computed for this holding.
    valueAtRiskAed: item.valueAtRiskAed,
    action: past
      ? "Check your balance - these may already be gone."
      : "Redeem or transfer before this date.",
    // burnPriority's own flags travel with the event, including the "estimated from
    // program policy, not user-confirmed" text. Restating them here in the calendar's
    // words would be a second copy that could drift.
    flags: item.flags,
  };
}

function expiryUndated(item: BurnItem): UndatedDeadline {
  return {
    kind: "points_expiry",
    title: `${aed(item.balance)} ${item.currency}`,
    // The reason is burnPriority's, verbatim: it already distinguishes "we know the
    // policy but not your dates" from "we don't know this program's policy at all",
    // and that distinction is exactly what the user needs to hear.
    reason:
      item.flags[0] ?? "expiry unknown - no explicit date and no known program default",
    prompt: `When do your ${item.currency} expire, or when did you earn them?`,
  };
}

// ---------------------------------------------------------------------------
// Source 2: devaluations — dated by the program, and deliberately unpriced.
// ---------------------------------------------------------------------------

function devaluationEvents(
  asOf: string,
  heldCurrencies: ReadonlySet<string>,
  devaluations: readonly Devaluation[],
): DeadlineEvent[] {
  return upcomingDevaluations(asOf, devaluations)
    // Only currencies the user actually holds. A devaluation of a program they are
    // not in is not their deadline.
    .filter((d) => heldCurrencies.has(d.currency))
    .map((d) => ({
      kind: "devaluation" as const,
      date: d.effectiveDate,
      daysAway: daysBetween(asOf, d.effectiveDate),
      certainty: "dated" as const,
      title: `${d.currency} devalues`,
      detail: d.note,
      /*
        valueAtRiskAed is deliberately ABSENT.

        Pricing this would need the user's premium-cabin value, and
        redemption-valuations.ts models Skywards premium as a USER MULTIPLIER
        precisely because no single premium number is reliable after this change.
        Multiplying an unreliable number by a percentage would manufacture a
        confident AED figure out of two estimates. The date is the fact; the cost
        is not ours to state.
      */
      action: "Book premium-cabin redemptions before this date.",
      flags: [],
    }));
}

// ---------------------------------------------------------------------------
// Source 3: annual-fee renewal — the entry that sends the user back to Engine 1.
// ---------------------------------------------------------------------------

function renewalEvent(
  held: HeldCard,
  asOf: string,
  spending: SpendingProfile | undefined,
  valuations: ValuationTable,
): DeadlineEvent | UndatedDeadline | null {
  const fees = computeFees(held.card);
  // A card with no ongoing fee has no renewal decision to make. Not a deadline.
  if (fees.ongoingFeeAed <= 0) return null;

  if (!held.openedOn) {
    return {
      kind: "fee_renewal",
      title: `${held.card.name} - AED ${aed(fees.ongoingFeeAed)} a year`,
      reason: "We don't know when this card renews.",
      prompt: `When did you open your ${held.card.name}?`,
    };
  }

  const date = nextAnniversary(held.openedOn, asOf);
  const detail = `AED ${aed(fees.ongoingFeeAed)} annual fee is charged on this date.`;

  /*
    The action is what makes this the strongest entry on the calendar: it is not
    "spend your points", it is "is this card still worth its fee" — which is Engine
    1's whole question, asked unprompted, once a year, about one card.

    It reports the card's GROSS earning against the fee rather than the net, because
    the two numbers are what the user is actually weighing. It states them and stops:
    whether AED 380 of earning justifies an AED 525 fee can depend on lounge access
    or a travel benefit the engine does not price, so the verdict is the user's.

    The range is reported honestly when it is wide — a co-brand card whose merchant
    share is unstated is bounded 0..full, and collapsing that to a midpoint here
    would reintroduce exactly the bias the ranking work removed.
  */
  let action = `Review whether it still earns its AED ${aed(fees.ongoingFeeAed)} fee.`;
  const flags: string[] = [];
  if (spending) {
    const score = scoreCard(spending, held.card, valuations);
    const g = score.grossAnnualValue;
    const earns =
      Math.abs(g.max - g.min) < 1
        ? `AED ${aed(g.min)}`
        : `AED ${aed(g.min)}–${aed(g.max)}`;
    action = `Review: earns ${earns} a year on your spending, costs AED ${aed(fees.ongoingFeeAed)}.`;
    if (score.uncertain) {
      flags.push(
        "earning is a range because this card carries an unconfirmed rate or merchant assumption - see the card's own flags",
      );
    }
  }

  return {
    kind: "fee_renewal",
    date,
    daysAway: daysBetween(asOf, date),
    // The DATE is certain: the user told us when they opened the card. The earning
    // figure in `action` may be a range, which is a different kind of uncertainty
    // and is carried by the flags rather than by this field.
    certainty: "dated",
    title: `${held.card.name} renews`,
    detail,
    valueAtRiskAed: fees.ongoingFeeAed,
    action,
    flags,
  };
}

function isUndated(x: DeadlineEvent | UndatedDeadline): x is UndatedDeadline {
  return !("date" in x);
}

// ---------------------------------------------------------------------------

/**
 * Build the calendar as of `asOf` (ISO date).
 *
 * Every input is optional: a user with no holdings and no saved cards gets an empty
 * calendar rather than an error, and the emptiness is honest because the undated
 * list and the flags say what is missing.
 */
export function deadlineCalendar(
  input: CalendarInput,
  asOf: string,
  options: CalendarOptions = {},
): DeadlineCalendar {
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const valuations = options.valuations ?? DEFAULT_VALUATIONS;
  const devaluations = options.devaluations ?? DEVALUATIONS;

  const events: DeadlineEvent[] = [];
  const undated: UndatedDeadline[] = [];
  const flags: string[] = [];

  // --- Points expiry + devaluations, both driven by the inventory. ---
  const inventory = input.inventory ?? [];
  let burn: BurnPlan | undefined;
  if (inventory.length > 0) {
    burn = burnPriority(inventory, asOf, undefined, undefined, devaluations);
    for (const item of burn.items) {
      const event = expiryEvent(item, asOf);
      if (event) events.push(event);
      else undated.push(expiryUndated(item));
    }
    // burnPriority's plan-level flags (e.g. an unknown currency priced at a
    // placeholder) are the calendar's flags too — the figures above rest on them.
    flags.push(...burn.flags);

    const heldCurrencies = new Set(inventory.map((h) => h.currency));
    events.push(...devaluationEvents(asOf, heldCurrencies, devaluations));
  }

  // --- Annual-fee renewals. ---
  for (const held of input.heldCards ?? []) {
    const result = renewalEvent(held, asOf, input.spending, valuations);
    if (!result) continue;
    if (isUndated(result)) undated.push(result);
    else events.push(result);
  }

  /*
    The devaluation table's silence is only trustworthy if someone has looked
    recently. Surfaced as a FLAG, not an exception and not a failing test: a stale
    review is a research task, and a test that failed purely because time passed
    would get silenced by bumping the date rather than by doing the sweep.
  */
  if (devaluations === DEVALUATIONS && devaluationReviewIsStale(asOf)) {
    flags.push(
      `devaluation table last reviewed ${devaluationReviewAgeMonths(asOf)} months ago - "no upcoming devaluations" is not trustworthy until it is swept again`,
    );
  }

  // Horizon: drop far-future events but COUNT them, so a short list never implies a
  // short future. Past-dated events are always kept — a missed deadline is the one
  // the user most needs to see.
  const withinHorizon = events.filter((e) => e.daysAway <= horizonDays);
  const beyondHorizon = events.length - withinHorizon.length;

  withinHorizon.sort((a, b) => {
    const byDate = Date.parse(a.date) - Date.parse(b.date);
    if (byDate !== 0) return byDate;
    // Same day: the one with more AED on it first, then a stable name order.
    const byValue = (b.valueAtRiskAed ?? 0) - (a.valueAtRiskAed ?? 0);
    if (byValue !== 0) return byValue;
    return a.title.localeCompare(b.title);
  });

  return { asOf, events: withinHorizon, undated, beyondHorizon, flags };
}
