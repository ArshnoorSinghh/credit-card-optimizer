import {
  capThresholds,
  deadlineCalendar,
  type CapThresholdReport,
  type DeadlineCalendar,
  type DeadlineEvent,
  type HeldCard,
  type PointsHolding,
  type SpendingProfile,
  type UndatedDeadline,
} from "@fils/engine";
import { cardById } from "./cards";

/*
  Client-side runner for the deadline calendar.

  Same pattern as lib/redemptions.ts and lib/optimizer.ts: the engine is pure and
  framework-free, so the browser calls it directly and there is nothing to fetch —
  the calendar reasons over the user's own holdings, their saved cards (already
  bundled with the engine), and the engine's researched tables.

  We do NOT modify the engine (ownership rule) and we compute NOTHING here. Every
  date, AED figure and caveat on the screen originates from a value returned below.
  In particular this file must never fill in a missing date: the engine's `undated`
  and `unstated` lists are the honest answer and the UI renders them as such.
*/

export type { DeadlineCalendar, DeadlineEvent, UndatedDeadline, CapThresholdReport, HeldCard };

/** Today as ISO YYYY-MM-DD — the `asOf` every engine call reasons from. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface CalendarViewInput {
  /** Points the user entered on the points screen. */
  holdings: PointsHolding[];
  /** Card ids from the profile store. */
  cardIds: string[];
  /** Monthly spend by category from the profile store. */
  spending: SpendingProfile;
  /**
   * ISO date each card was OPENED WITH THE BANK, keyed by card id.
   *
   * Persisted on `saved_cards.opened_on` for signed-in users. A card missing from this
   * map produces an `undated` fee-renewal entry with the question that would fix it,
   * which is exactly what should happen. It must never fall back to when the card was
   * added to Fils.
   */
  openedOn?: Record<string, string>;
}

export interface CalendarView {
  calendar: DeadlineCalendar;
  thresholds: CapThresholdReport;
  /** Cards resolved from the profile's ids — the engine works on Card objects. */
  heldCards: HeldCard[];
}

export function runCalendar(input: CalendarViewInput): CalendarView {
  const asOf = todayIso();

  const heldCards: HeldCard[] = input.cardIds
    .map((id) => {
      const card = cardById(id);
      if (!card) return null;
      const openedOn = input.openedOn?.[id];
      return openedOn ? { card, openedOn } : { card };
    })
    .filter((c): c is HeldCard => c !== null);

  const calendar = deadlineCalendar(
    { inventory: input.holdings, heldCards, spending: input.spending },
    asOf,
  );

  const thresholds = capThresholds(
    heldCards.map((h) => h.card),
    input.spending,
  );

  return { calendar, thresholds, heldCards };
}

/** Month grouping for the timeline, preserving the engine's ordering within a month. */
export interface EventGroup {
  key: string;
  label: string;
  events: DeadlineEvent[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Group events by calendar month. Purely presentational — it reorders nothing and
 * drops nothing, so the count in equals the count out.
 */
export function groupByMonth(events: DeadlineEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const e of events) {
    const key = e.date.slice(0, 7);
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.events.push(e);
      continue;
    }
    const [y, m] = [Number(key.slice(0, 4)), Number(key.slice(5, 7))];
    groups.push({ key, label: `${MONTHS[m - 1] ?? key} ${y}`, events: [e] });
  }
  return groups;
}

/** Formats a day for a timeline row: "12 Sep". */
export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${(MONTHS[d.getUTCMonth()] ?? "").slice(0, 3)}`;
}

/** "in 34 days" / "today" / "31 days ago" — never a fabricated urgency word. */
export function relativeDays(daysAway: number): string {
  if (daysAway === 0) return "today";
  if (daysAway > 0) return `in ${daysAway} day${daysAway === 1 ? "" : "s"}`;
  const past = -daysAway;
  return `${past} day${past === 1 ? "" : "s"} ago`;
}
