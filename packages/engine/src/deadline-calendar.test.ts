import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import type { PointsInventory } from "./points-inventory";
import { burnPriority } from "./burn-priority";
import { deadlineCalendar, type HeldCard } from "./deadline-calendar";
import {
  DEVALUATIONS,
  DEVALUATIONS_REVIEWED_ON,
  devaluationReviewIsStale,
  upcomingDevaluations,
  type Devaluation,
} from "./devaluations";
import type { SpendingProfile } from "./score-card";

const realCards = cardsData as Card[];
const byId = (id: string): Card => {
  const c = realCards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

const ASOF = "2026-07-15";

describe("deadlineCalendar — points expiry mirrors burnPriority, never recomputes it", () => {
  /*
    The drift guard. The calendar's whole design rests on it COMPOSING the burn
    engine rather than reimplementing "when do these expire". A second
    implementation would drift, and the drift would be invisible because both
    would keep returning plausible dates. So: every dated expiry event must appear,
    to the day, in burnPriority's own output for the same inventory.
  */
  const inventory: PointsInventory = [
    { currency: "Skywards Miles", balance: 40000, expiryDate: "2026-09-01" },
    { currency: "Etihad Guest Miles", balance: 12000, earnedDate: "2025-06-01" },
    { currency: "Smiles Points", balance: 5000 },
  ];

  it("uses burnPriority's dates exactly", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    const burn = burnPriority(inventory, ASOF);
    const burnDates = new Map(burn.items.filter((i) => i.expiryDate).map((i) => [i.currency, i.expiryDate]));

    const expiryEvents = cal.events.filter((e) => e.kind === "points_expiry");
    expect(expiryEvents.length).toBeGreaterThan(0);
    for (const e of expiryEvents) {
      const currency = [...burnDates.keys()].find((c) => e.title.includes(c));
      expect(currency, `event "${e.title}" names no known currency`).toBeDefined();
      expect(e.date).toBe(burnDates.get(currency!));
    }
  });

  it("maps expirySource onto certainty and never invents a tier", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    const sky = cal.events.find((e) => e.title.includes("Skywards"))!;
    const eti = cal.events.find((e) => e.title.includes("Etihad"))!;
    // Explicit user date -> dated. Projected from program policy -> projected.
    expect(sky.certainty).toBe("dated");
    expect(eti.certainty).toBe("projected");
    // The projected one must SAY it is projected, in the detail the user reads.
    expect(eti.detail).toMatch(/not confirmed/i);
  });

  it("carries burnPriority's own flags rather than restating them", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    const burn = burnPriority(inventory, ASOF);
    const eti = cal.events.find((e) => e.title.includes("Etihad"))!;
    const burnEti = burn.items.find((i) => i.currency === "Etihad Guest Miles")!;
    expect(eti.flags).toEqual(burnEti.flags);
  });

  it("prices value-at-risk straight from burnPriority", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    const burn = burnPriority(inventory, ASOF);
    const sky = cal.events.find((e) => e.title.includes("Skywards"))!;
    const burnSky = burn.items.find((i) => i.currency === "Skywards Miles")!;
    expect(sky.valueAtRiskAed).toBe(burnSky.valueAtRiskAed);
  });
});

describe("deadlineCalendar — undateable deadlines are shown, never dropped", () => {
  /*
    The defect this whole module is shaped around. A holding whose expiry cannot be
    dated must not vanish: an empty calendar reads as "nothing is coming up", which
    is a false statement made by omission. Smiles Points here have no expiryDate and
    no earnedDate, so burnPriority correctly refuses to date them.
  */
  const inventory: PointsInventory = [{ currency: "Smiles Points", balance: 5000 }];

  it("moves an undateable holding to `undated` instead of dropping it", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    expect(cal.events).toHaveLength(0);
    expect(cal.undated).toHaveLength(1);
    expect(cal.undated[0]!.kind).toBe("points_expiry");
    expect(cal.undated[0]!.title).toContain("Smiles Points");
  });

  it("gives every undated deadline a question that would date it", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    for (const u of cal.undated) {
      expect(u.prompt.length).toBeGreaterThan(0);
      expect(u.prompt).toMatch(/\?$/); // it is literally a question
      expect(u.reason.length).toBeGreaterThan(0);
    }
  });

  it("accounts for every holding as either an event or an undated entry", () => {
    // The arithmetic that makes omission impossible: nothing may fall between the
    // two lists. This is the assertion a future refactor has to keep true.
    const mixed: PointsInventory = [
      { currency: "Skywards Miles", balance: 1000, expiryDate: "2026-09-01" },
      { currency: "Smiles Points", balance: 5000 },
      { currency: "Marriott Bonvoy Points", balance: 9000 },
    ];
    const cal = deadlineCalendar({ inventory: mixed }, ASOF, { horizonDays: 100000 });
    const expiryEvents = cal.events.filter((e) => e.kind === "points_expiry").length;
    expect(expiryEvents + cal.undated.length).toBe(mixed.length);
  });
});

describe("deadlineCalendar — devaluations", () => {
  const future: Devaluation[] = [
    {
      currency: "Skywards Miles",
      effectiveDate: "2026-11-01",
      affects: ["flight_premium"],
      note: "test devaluation",
    },
  ];

  it("only warns about currencies the user actually holds", () => {
    const holds: PointsInventory = [{ currency: "Etihad Guest Miles", balance: 1000, expiryDate: "2026-08-01" }];
    const cal = deadlineCalendar({ inventory: holds }, ASOF, { devaluations: future });
    expect(cal.events.some((e) => e.kind === "devaluation")).toBe(false);
  });

  it("warns when the user does hold it", () => {
    const holds: PointsInventory = [{ currency: "Skywards Miles", balance: 1000, expiryDate: "2026-08-01" }];
    const cal = deadlineCalendar({ inventory: holds }, ASOF, { devaluations: future });
    const deval = cal.events.find((e) => e.kind === "devaluation")!;
    expect(deval.date).toBe("2026-11-01");
    expect(deval.certainty).toBe("dated");
  });

  it("does NOT price a devaluation", () => {
    /*
      redemption-valuations.ts models Skywards premium as a user multiplier BECAUSE
      no single premium number is reliable after the May 2026 change. Multiplying
      that unreliable number by a percentage would manufacture a confident AED
      figure from two estimates. The date is the fact; the cost is not ours.
    */
    const holds: PointsInventory = [{ currency: "Skywards Miles", balance: 1000, expiryDate: "2026-08-01" }];
    const cal = deadlineCalendar({ inventory: holds }, ASOF, { devaluations: future });
    const deval = cal.events.find((e) => e.kind === "devaluation")!;
    expect(deval.valueAtRiskAed).toBeUndefined();
  });

  it("ignores a devaluation that has already taken effect", () => {
    const holds: PointsInventory = [{ currency: "Skywards Miles", balance: 1000, expiryDate: "2026-08-01" }];
    const past: Devaluation[] = [{ ...future[0]!, effectiveDate: "2026-05-20" }];
    const cal = deadlineCalendar({ inventory: holds }, ASOF, { devaluations: past });
    expect(cal.events.some((e) => e.kind === "devaluation")).toBe(false);
  });
});

describe("devaluation table freshness", () => {
  /*
    The rot this replaced: the table held exactly one entry, effective 2026-05-20,
    and by August 2026 it was three months past. Consumers filter to future dates,
    so it warned about nothing — and an empty warning table looks EXACTLY like a
    table with nothing to warn about.

    Note what is NOT asserted here: that the table contains a future devaluation.
    "No devaluation is currently announced" is a legitimate state of the world, and
    a test demanding one would be a standing invitation to invent one to get CI
    green. The check is on the REVIEW, never on the findings.
  */
  it("treats a recent review as fresh and an old one as stale", () => {
    expect(devaluationReviewIsStale("2026-09-01", "2026-08-01", 6)).toBe(false);
    expect(devaluationReviewIsStale("2027-03-01", "2026-08-01", 6)).toBe(true);
    // Exactly at the boundary counts as stale — the sweep is due.
    expect(devaluationReviewIsStale("2027-02-01", "2026-08-01", 6)).toBe(true);
    // A partial month does not count: 5 months and 29 days is not 6 months.
    expect(devaluationReviewIsStale("2027-01-31", "2026-08-01", 6)).toBe(false);
  });

  it("surfaces staleness as a calendar FLAG, not an exception", () => {
    // Deliberately not a failing test when time passes: a stale review is a research
    // task, and a test that broke purely from the calendar turning over would be
    // silenced by bumping the date rather than by doing the sweep.
    const inventory: PointsInventory = [
      { currency: "Skywards Miles", balance: 1000, expiryDate: "2030-01-01" },
    ];
    const longAfterReview = "2030-01-01";
    const cal = deadlineCalendar({ inventory }, longAfterReview, { horizonDays: 100000 });
    expect(cal.flags.some((f) => /last reviewed/i.test(f))).toBe(true);
  });

  it("has a review date that is not in the future", () => {
    // The one thing about the review date that IS a hard error: a date later than
    // the entries it claims to have reviewed would make the freshness check lie.
    expect(Date.parse(DEVALUATIONS_REVIEWED_ON)).toBeLessThanOrEqual(Date.now());
  });

  it("shares one date filter with the burn engine", () => {
    // burn-priority used to inline this comparison. If the two ever diverge, a
    // devaluation could warn on the calendar and not in the burn plan.
    const asOf = "2026-06-01";
    const upcoming = upcomingDevaluations(asOf, DEVALUATIONS);
    for (const d of DEVALUATIONS) {
      const shouldBeUpcoming = Date.parse(d.effectiveDate) >= Date.parse(asOf);
      expect(upcoming.includes(d)).toBe(shouldBeUpcoming);
    }
  });
});

describe("deadlineCalendar — annual-fee renewal", () => {
  const feeCard = realCards.find((c) => c.fees.annual_fee_aed > 0 && !c.fees.waiver_conditions)!;

  it("dates the renewal from the anniversary the user gave us", () => {
    const held: HeldCard[] = [{ card: feeCard, openedOn: "2023-09-12" }];
    const cal = deadlineCalendar({ heldCards: held }, ASOF);
    const renewal = cal.events.find((e) => e.kind === "fee_renewal")!;
    expect(renewal.date).toBe("2026-09-12");
    expect(renewal.certainty).toBe("dated");
  });

  it("rolls to next year when the anniversary has already passed this year", () => {
    const held: HeldCard[] = [{ card: feeCard, openedOn: "2023-03-04" }];
    const cal = deadlineCalendar({ heldCards: held }, ASOF, { horizonDays: 400 });
    const renewal = cal.events.find((e) => e.kind === "fee_renewal")!;
    expect(renewal.date).toBe("2027-03-04");
  });

  it("treats an unknown anniversary as UNDATED, never guessing one", () => {
    /*
      The failure this forbids: falling back to SavedCard.createdAt, which records
      when the user added the card to Fils, not when they opened it with the bank.
      A plausible wrong date on a fee the user is about to be charged is the same
      class of error as scoring a marketing ceiling as a certain rate.
    */
    const held: HeldCard[] = [{ card: feeCard }];
    const cal = deadlineCalendar({ heldCards: held }, ASOF);
    expect(cal.events.some((e) => e.kind === "fee_renewal")).toBe(false);
    const undated = cal.undated.find((u) => u.kind === "fee_renewal")!;
    expect(undated).toBeDefined();
    expect(undated.prompt).toContain("When did you open");
  });

  it("raises no renewal deadline for a card with no ongoing fee", () => {
    const freeCard = realCards.find((c) => c.fees.annual_fee_aed === 0)!;
    const cal = deadlineCalendar({ heldCards: [{ card: freeCard, openedOn: "2023-09-12" }] }, ASOF);
    expect(cal.events.some((e) => e.kind === "fee_renewal")).toBe(false);
    expect(cal.undated.some((u) => u.kind === "fee_renewal")).toBe(false);
  });

  it("re-scores the card against its fee when spending is known", () => {
    const spending: SpendingProfile = { groceries: 3000, dining: 2000, fuel: 800, other: 2000 };
    const held: HeldCard[] = [{ card: feeCard, openedOn: "2023-09-12" }];
    const cal = deadlineCalendar({ heldCards: held, spending }, ASOF);
    const renewal = cal.events.find((e) => e.kind === "fee_renewal")!;
    // Both sides of the decision, stated, with no verdict attached.
    expect(renewal.action).toMatch(/earns AED/);
    expect(renewal.action).toMatch(/costs AED/);
    expect(renewal.valueAtRiskAed).toBe(feeCard.fees.annual_fee_aed);
  });

  it("states earning as a RANGE when the card's own score is uncertain", () => {
    /*
      A co-brand card with an unstated merchant share is bounded 0..full by the
      scorer. Collapsing that to a single figure here would reintroduce exactly the
      bias the ranking work removed — and it would do it at the moment the user is
      deciding whether to keep paying for the card.

      enbd_uemaar_signature is named rather than searched for. An earlier draft of
      this test picked the card with a `.find()` and then asserted only `if` a flag
      happened to be present, which is a test that quietly measures nothing — the
      failure mode this codebase has already been bitten by twice. If this card ever
      leaves the dataset the test throws on the lookup, which is the correct loud
      failure.
    */
    const merchantCard = byId("enbd_uemaar_signature");
    const spending: SpendingProfile = { groceries: 4000, dining: 2000, other: 4000 };
    const cal = deadlineCalendar(
      { heldCards: [{ card: merchantCard, openedOn: "2023-09-12" }], spending },
      ASOF,
      { horizonDays: 400 },
    );
    const renewal = cal.events.find((e) => e.kind === "fee_renewal")!;
    expect(renewal).toBeDefined();
    expect(renewal.action).toMatch(/earns AED [\d,]+–[\d,]+ a year/);
    expect(renewal.flags.length).toBeGreaterThan(0);
    expect(renewal.flags[0]).toMatch(/range/i);
  });
});

describe("deadlineCalendar — shape and ordering", () => {
  const inventory: PointsInventory = [
    { currency: "Skywards Miles", balance: 40000, expiryDate: "2026-09-01" },
    { currency: "Etihad Guest Miles", balance: 12000, expiryDate: "2026-08-01" },
  ];

  it("orders events soonest first", () => {
    const cal = deadlineCalendar({ inventory }, ASOF);
    const dates = cal.events.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("keeps a deadline that has already passed", () => {
    // A missed deadline is the one the user most needs to see; dropping it would be
    // the same omission failure the undated list exists to prevent.
    const past: PointsInventory = [{ currency: "Skywards Miles", balance: 1000, expiryDate: "2026-06-01" }];
    const cal = deadlineCalendar({ inventory: past }, ASOF);
    const e = cal.events[0]!;
    expect(e.daysAway).toBeLessThan(0);
    expect(e.title).toContain("expired");
    expect(e.action).toMatch(/may already be gone/);
  });

  it("counts events beyond the horizon rather than hiding them", () => {
    const far: PointsInventory = [
      { currency: "Skywards Miles", balance: 1000, expiryDate: "2026-08-01" },
      { currency: "Etihad Guest Miles", balance: 1000, expiryDate: "2029-08-01" },
    ];
    const cal = deadlineCalendar({ inventory: far }, ASOF, { horizonDays: 365 });
    expect(cal.events).toHaveLength(1);
    expect(cal.beyondHorizon).toBe(1);
  });

  it("returns an empty calendar for an empty user without throwing", () => {
    const cal = deadlineCalendar({}, ASOF);
    expect(cal.events).toEqual([]);
    expect(cal.undated).toEqual([]);
    expect(cal.beyondHorizon).toBe(0);
    expect(cal.asOf).toBe(ASOF);
  });

  it("gives every dated event an action", () => {
    const cal = deadlineCalendar(
      { inventory, heldCards: [{ card: byId("adcb_touchpoints_platinum"), openedOn: "2023-09-12" }] },
      ASOF,
      { horizonDays: 400 },
    );
    for (const e of cal.events) {
      expect(e.action, `"${e.title}" has no action`).toBeTruthy();
    }
  });
});
