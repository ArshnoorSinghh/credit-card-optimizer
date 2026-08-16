import { describe, it, expect } from "vitest";
import { deadlineCalendar, type PointsHolding } from "@fils/engine";
import { groupByMonth, relativeDays, runCalendar, shortDate, todayIso } from "./calendar";

/*
  These guard the WRAPPER, not the engine — the engine's own behaviour is pinned in
  packages/engine/src/deadline-calendar.test.ts. What matters here is that this layer
  stays a pass-through: it must not drop, reorder or invent anything on the way to the
  screen, because the honesty properties the engine works hard for are only worth
  anything if the presentation preserves them.
*/

const holdings: PointsHolding[] = [
  { currency: "Skywards Miles", balance: 60000, expiryDate: "2027-01-16" },
  { currency: "FAB Rewards", balance: 40000 },
];
const spending = { groceries: 3000, dining: 2000, other: 1500 };

describe("groupByMonth", () => {
  it("drops nothing — count in equals count out", () => {
    // The wrapper's one real risk: a grouping bug that quietly loses an event would
    // recreate, in the UI, exactly the omission failure the engine's `undated` list
    // exists to prevent.
    const cal = deadlineCalendar({ inventory: holdings }, "2026-07-15");
    const grouped = groupByMonth(cal.events);
    const total = grouped.reduce((n, g) => n + g.events.length, 0);
    expect(total).toBe(cal.events.length);
  });

  it("preserves the engine's ordering within a month", () => {
    const cal = deadlineCalendar({ inventory: holdings }, "2026-07-15");
    const flat = groupByMonth(cal.events).flatMap((g) => g.events);
    expect(flat.map((e) => e.date)).toEqual(cal.events.map((e) => e.date));
  });

  it("labels a month readably", () => {
    const groups = groupByMonth([
      { kind: "points_expiry", date: "2027-01-16", daysAway: 10, certainty: "dated", title: "t", detail: "d", flags: [] },
    ]);
    expect(groups[0]!.label).toBe("January 2027");
  });
});

describe("runCalendar", () => {
  it("resolves card ids and ignores ones that aren't real cards", () => {
    const view = runCalendar({
      holdings,
      cardIds: ["fab_cashback", "not_a_real_card"],
      spending,
    });
    expect(view.heldCards).toHaveLength(1);
    expect(view.heldCards[0]!.card.id).toBe("fab_cashback");
  });

  it("never invents an opening date for a card that has none", () => {
    /*
      The wrapper is the last place a plausible-but-wrong anniversary could sneak in
      (the tempting fallback is whenever the card was added to Fils). A card with no
      `openedOn` must arrive at the engine without one, so it lands in `undated`.
    */
    const view = runCalendar({ holdings, cardIds: ["fab_cashback"], spending });
    expect(view.heldCards[0]!.openedOn).toBeUndefined();
    expect(view.calendar.undated.some((u) => u.kind === "fee_renewal")).toBe(true);
  });

  it("passes an opening date through when it has one", () => {
    const view = runCalendar({
      holdings,
      cardIds: ["fab_cashback"],
      spending,
      openedOn: { fab_cashback: "2023-09-12" },
    });
    expect(view.heldCards[0]!.openedOn).toBe("2023-09-12");
    expect(view.calendar.events.some((e) => e.kind === "fee_renewal")).toBe(true);
  });

  it("produces thresholds for the cards it was given", () => {
    const view = runCalendar({ holdings, cardIds: ["fab_cashback"], spending });
    expect(view.thresholds.thresholds.length).toBeGreaterThan(0);
  });
});

describe("formatting helpers", () => {
  it("formats a day without a timezone shift", () => {
    // Parsed as UTC on purpose: `new Date("2027-01-16")` in a negative-offset zone
    // would render as the 15th.
    expect(shortDate("2027-01-16")).toBe("16 Jan");
  });

  it("states relative days without inventing an urgency word", () => {
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(1)).toBe("in 1 day");
    expect(relativeDays(34)).toBe("in 34 days");
    expect(relativeDays(-31)).toBe("31 days ago");
  });

  it("returns today as an ISO date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
