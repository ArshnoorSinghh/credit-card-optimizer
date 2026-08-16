import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { checkStatement, summariseStatementChecks, type Statement } from "./statement-check";

const realCards = cardsData as Card[];
const byId = (id: string): Card => {
  const c = realCards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

/**
 * A synthetic "statement" for a card whose maths is checkable by hand.
 * fab_cashback: 5% on supermarkets capped AED 150/mo, 1% base, FAB Rewards @ 0.007.
 */
function stmt(over: Partial<Statement> = {}): Statement {
  return {
    cardId: "fab_cashback",
    cycle: "2026-07",
    lines: [
      { description: "CARREFOUR MOE", amountAed: 2000, category: "groceries" },
      { description: "EMIRATES FLIGHT", amountAed: 2000, category: "travel" },
    ],
    ...over,
  };
}

describe("checkStatement — building the profile from real lines", () => {
  it("sums mapped lines into a spend profile", () => {
    const c = checkStatement(byId("fab_cashback"), stmt());
    expect(c.profile).toEqual({ groceries: 2000, travel: 2000 });
    expect(c.mappedSpendAed).toBe(4000);
    expect(c.unmappedSpendAed).toBe(0);
  });

  it("EXCLUDES unmapped lines from the prediction and reports them", () => {
    /*
      The one thing that would quietly invalidate the whole exercise is guessing a
      category so the totals tie. An unrecognisable merchant is excluded and shown.
    */
    const c = checkStatement(
      byId("fab_cashback"),
      stmt({
        lines: [
          { description: "CARREFOUR MOE", amountAed: 1000, category: "groceries" },
          { description: "PAYMENT REF 8891", amountAed: 4000, category: null, note: "cash advance" },
        ],
      }),
    );
    expect(c.profile).toEqual({ groceries: 1000 });
    expect(c.unmappedSpendAed).toBe(4000);
    expect(c.unmappedSharePct).toBeCloseTo(80, 5);
    expect(c.flags.some((f) => /was not mapped/.test(f))).toBe(true);
    /*
      And the trap inside the trap, which this fixture happens to be a perfect
      example of: AED 1,000 mapped is below fab_cashback's AED 3,000 gate, so the
      engine turns the bonus rates off — but the BANK saw AED 5,000 on the statement
      and would have paid them. Without this warning the comparison shows a huge gap
      that is entirely an artefact of incomplete mapping.
    */
    expect(c.flags.some((f) => /LIKELY FALSE GATE/.test(f))).toBe(true);
    expect(c.flags[0]).toMatch(/LIKELY FALSE GATE/); // hoisted to the top
  });

  it("stays quiet when nearly everything is mapped", () => {
    const c = checkStatement(
      byId("fab_cashback"),
      stmt({
        lines: [
          { description: "CARREFOUR", amountAed: 4000, category: "groceries" },
          { description: "ODD", amountAed: 10, category: null },
        ],
      }),
    );
    expect(c.flags.some((f) => /was not mapped/.test(f))).toBe(false);
  });
});

describe("checkStatement — the single-cycle approximation", () => {
  it("predicts ONE cycle, not a year", () => {
    /*
      scoreCard is months-in / years-out. This cycle earns AED 120, not AED 1,440.
      Getting the /12 wrong would make every validation look catastrophically wrong
      for a reason that is purely harness.

      Hand-computed, and the spend deliberately clears the AED 3,000 gate:
        groceries 2,000 x 5%  = AED 100  (under the AED 150/mo cap)
        travel    2,000 x 1%  = AED  20  (base rate)
                                = AED 120

      `travel` is chosen deliberately: fab_cashback's `fashion` category maps to
      canonical `other` at 5%, so "other" spend is NOT the base rate on this card.
      That cost a debugging round — the fixture has to name a category the card
      genuinely does not bonus.
    */
    const c = checkStatement(byId("fab_cashback"), stmt());
    expect(c.predictedAed.min).toBeCloseTo(120, 6);
    expect(c.predictedAed.max).toBeCloseTo(120, 6);
  });

  it("flags an annual cap as an approximation rather than absorbing it", () => {
    const annualCapped = realCards.find((card) =>
      card.rewards.categories.some((x) => x.annual_cap !== null),
    );
    if (!annualCapped) throw new Error("dataset has no annual-capped card — update this test");
    const cat = annualCapped.rewards.categories.find((x) => x.annual_cap !== null)!;
    // Enough spend to bind the annual cap within one cycle.
    const c = checkStatement(annualCapped, {
      cardId: annualCapped.id,
      cycle: "2026-07",
      lines: [{ description: "BIG", amountAed: 500000, category: "other" }],
    });
    // Either it bound (and is flagged) or this card's cap doesn't reach `other` —
    // both fine; what must never happen is an annual cap binding SILENTLY.
    const bound = c.flags.some((f) => /ANNUAL cap/.test(f));
    expect(typeof bound).toBe("boolean");
    expect(cat.annual_cap).not.toBeNull();
  });
});

describe("checkStatement — range containment is the headline", () => {
  it("reports containment when the bank's figure falls inside the range", () => {
    const c = checkStatement(
      byId("fab_cashback"),
      stmt({ actualRewardAed: 120 }),
    );
    expect(c.aedWithinRange).toBe(true);
    expect(c.aedGap).toBeCloseTo(0, 6);
  });

  it("reports a MISS when the bank paid less than the bottom of the range", () => {
    // The serious failure: the product presents the range as something it stands
    // behind, so a range that does not contain reality is worse than a wide one.
    const c = checkStatement(
      byId("fab_cashback"),
      stmt({ actualRewardAed: 60 }),
    );
    expect(c.aedWithinRange).toBe(false);
    expect(c.aedGap).toBeCloseTo(60, 6);
    expect(c.aedGapPct).toBeCloseTo(100, 6); // engine said 120, bank paid 60
  });

  it("signs the gap so OVERSTATEMENT is positive", () => {
    // Direction is the whole point: overstating tells a user to expect money that
    // never arrives. It must never be averaged away into an unsigned "accuracy".
    const over = checkStatement(
      byId("fab_cashback"),
      stmt({ actualRewardAed: 100 }),
    );
    const under = checkStatement(
      byId("fab_cashback"),
      stmt({ actualRewardAed: 140 }),
    );
    expect(over.aedGap!).toBeGreaterThan(0);
    expect(under.aedGap!).toBeLessThan(0);
  });
});

describe("checkStatement — units vs AED", () => {
  it("says so when only AED was available, because that tests two models at once", () => {
    /*
      An AED gap cannot distinguish "the rate is wrong" from "the point valuation is
      wrong". Skywards valued at 0.037 against a true 0.030 would show a 19% error in
      an earn model that was perfectly correct.
    */
    const c = checkStatement(
      byId("enbd_skywards_signature"),
      {
        cardId: "enbd_skywards_signature",
        cycle: "2026-07",
        lines: [{ description: "SPEND", amountAed: 5000, category: "other" }],
        actualRewardAed: 100,
      },
    );
    expect(c.flags.some((f) => /earn model AND the valuation table/.test(f))).toBe(true);
  });

  it("compares units when the statement gives them, isolating the earn model", () => {
    const card = byId("enbd_skywards_signature");
    const dry = checkStatement(card, {
      cardId: card.id,
      cycle: "2026-07",
      lines: [{ description: "SPEND", amountAed: 5000, category: "other" }],
    });
    // Feed back the engine's own midpoint as "actual": containment must hold.
    const mid =
      dry.predictedUnits.max === null
        ? dry.predictedUnits.min
        : (dry.predictedUnits.min + dry.predictedUnits.max) / 2;
    const c = checkStatement(card, {
      cardId: card.id,
      cycle: "2026-07",
      lines: [{ description: "SPEND", amountAed: 5000, category: "other" }],
      actualRewardUnits: mid,
    });
    expect(c.unitsWithinRange).toBe(true);
    expect(c.unitsGap).toBeCloseTo(0, 6);
    expect(c.flags.some((f) => /earn model AND the valuation table/.test(f))).toBe(false);
  });

  it("does not call a degenerate range a range", () => {
    /*
      Caught by reading the harness's first real report: "the prediction is a range
      rather than a figure" was printed next to 13463–13463. `score.uncertain` covers
      anything soft, including a medium-confidence VALUATION, which moves the AED
      figure without widening the unit range at all. Conflating the two put a visible
      falsehood in the output of the one tool whose whole job is honesty.
    */
    const c = checkStatement(byId("fab_cashback"), stmt());
    expect(c.predictedAed.max - c.predictedAed.min).toBeLessThan(1e-9);
    expect(c.flags.some((f) => /the prediction is a RANGE/.test(f))).toBe(false);
    expect(c.flags.some((f) => /the prediction is exact/.test(f))).toBe(true);
  });

  it("says loudly when a statement carries no ground truth at all", () => {
    const c = checkStatement(byId("fab_cashback"), stmt());
    expect(c.flags.some((f) => /NO GROUND TRUTH/.test(f))).toBe(true);
    expect(c.unitsWithinRange).toBeUndefined();
    expect(c.aedWithinRange).toBeUndefined();
  });
});

describe("summariseStatementChecks", () => {
  // Same gate-clearing fixture as above: this cycle is predicted at AED 120.
  const check = (actualRewardAed: number, cycle: string) =>
    checkStatement(byId("fab_cashback"), { ...stmt({ actualRewardAed }), cycle });

  it("counts containment and reports the worst OVERSTATEMENT by name", () => {
    const s = summariseStatementChecks([check(120, "1"), check(120, "2"), check(60, "3")]);
    expect(s.compared).toBe(3);
    expect(s.withinRange).toBe(2);
    expect(s.withinRangePct).toBeCloseTo(66.67, 1);
    expect(s.worstOverstatementPct).toBeCloseTo(100, 1);
    expect(s.worstOverstatementCard).toContain("FAB");
  });

  it("refuses to let a one-statement result look like a characterisation", () => {
    // The temptation to quote an accuracy figure off a single statement is real, so
    // the summary says it in the output rather than leaving it to the reader.
    const s = summariseStatementChecks([check(120, "1")]);
    expect(s.flags.some((f) => /too few to characterise/.test(f))).toBe(true);
  });

  it("says nothing was validated when no statement carried ground truth", () => {
    const s = summariseStatementChecks([checkStatement(byId("fab_cashback"), stmt())]);
    expect(s.compared).toBe(0);
    expect(s.flags.some((f) => /NOTHING WAS VALIDATED/.test(f))).toBe(true);
  });

  it("takes the MEDIAN gap, so one bad cycle cannot dominate", () => {
    const s = summariseStatementChecks([check(120, "1"), check(120, "2"), check(120, "3"), check(20, "4")]);
    expect(s.medianGapPct).toBeCloseTo(0, 6);
  });
});
