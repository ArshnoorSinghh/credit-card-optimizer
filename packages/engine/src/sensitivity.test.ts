import { describe, it, expect } from "vitest";
import type { Card, RewardType } from "./card";
import type { SpendingProfile } from "./score-card";
import { withValuations } from "./valuations";
import type { UserProfile } from "./optimize-portfolio";
import {
  assessValuationFragility,
  spendingSensitivity,
  valuationSensitivity,
  withFragilityFlags,
} from "./sensitivity";
import { optimizePortfolio } from "./optimize-portfolio";

const OPEN_PROFILE: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };

/** Same minimal synthetic-card factory the optimizer tests use, so hand math stays transparent. */
function mkCard(
  id: string,
  overrides: {
    categories?: { category: string; rate: string; monthly_cap?: number | null }[];
    base_rate?: string;
    annual_fee?: number;
    currency?: string;
    type?: RewardType;
  } = {},
): Card {
  return {
    id,
    name: id,
    bank: "TestBank",
    network: "TestNet",
    tier: "Test",
    eligibility: {
      min_monthly_salary_aed: 0,
      uae_resident_required: false,
      min_age: 0,
      salary_transfer_required: false,
      employer_restrictions: null,
    },
    fees: { annual_fee_aed: overrides.annual_fee ?? 0, waiver_conditions: null, joining_fee_aed: 0 },
    rewards: {
      type: overrides.type ?? "cashback",
      currency: overrides.currency ?? "AED",
      base_rate: overrides.base_rate ?? "0% on all spend",
      categories: (overrides.categories ?? []).map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthly_cap ?? null,
        annual_cap: null,
      })),
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: overrides.currency ?? "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };
}

/**
 * VALUATION SENSITIVITY — hand-computed flip.
 *
 *   cash_card:   1% cashback on all spend, no fee.  AED is valued 1.0 by definition.
 *   points_card: 1 TestPts per AED 1, no fee.       TestPts is what we sweep.
 *   Spend: 1,000 AED/mo, all "other".
 *
 * cash_card   = 1% x 1,000 x 12                       = AED 120/yr, flat in v.
 * points_card = 1 pt/AED x 1,000 x 12 = 12,000 pts/yr = AED 12,000v/yr, linear in v.
 *
 * Break-even: 12,000v = 120  ->  v = 0.01 AED/point exactly.
 * Below 0.01 cashback wins; above it the points card wins. At exactly 0.01 they
 * tie on value, size and fees, so the optimizer's final tie-break (lexicographic
 * card id) hands it to "cash_card" — which is why the flip sits AT 0.01, not below.
 */
describe("valuationSensitivity — flips at the hand-computed break-even", () => {
  const cards = [
    mkCard("cash_card", { base_rate: "1% on all spend" }),
    mkCard("points_card", { base_rate: "1 point per AED 1", type: "points", currency: "TestPts" }),
  ];
  const spending: SpendingProfile = { other: 1000 };
  const table = withValuations({ TestPts: { aedPerUnit: 0.008, confidence: "low" } });

  const curve = valuationSensitivity(spending, OPEN_PROFILE, cards, {
    currency: "TestPts",
    range: { from: 0.005, to: 0.015 },
    steps: 11,
    optimize: { maxCards: 1 },
    valuations: table,
  });

  it("finds exactly one flip, at v = 0.01", () => {
    expect(curve.flips).toHaveLength(1);
    const flip = curve.flips[0]!;
    expect(flip.x).toBeCloseTo(0.01, 6);
    expect(flip.from).toEqual(["cash_card"]);
    expect(flip.to).toEqual(["points_card"]);
    // The reported bracket must actually contain the true break-even.
    expect(flip.bracket.lo).toBeLessThanOrEqual(0.01);
    expect(flip.bracket.hi).toBeGreaterThanOrEqual(0.01);
    expect(flip.precision).toBeLessThan(1e-5);
  });

  it("traces the upper envelope: flat at 120 below the flip, rising above it", () => {
    const at = (x: number) => curve.samples.find((s) => Math.abs(s.x - x) < 1e-9)!;
    // Below break-even the cashback card wins at its constant 120/yr.
    expect(at(0.006).cardIds).toEqual(["cash_card"]);
    expect(at(0.006).netAnnualValue).toBeCloseTo(120, 6);
    // Above it the points card wins, worth 12,000v.
    expect(at(0.012).cardIds).toEqual(["points_card"]);
    expect(at(0.012).netAnnualValue).toBeCloseTo(144, 6);
    expect(at(0.015).netAnnualValue).toBeCloseTo(180, 6);
  });

  it("reports the baseline recommendation and its headroom", () => {
    // Baseline 0.008 < 0.01, so today's answer is the cashback card...
    expect(curve.baseline.x).toBeCloseTo(0.008, 9);
    expect(curve.baseline.cardIds).toEqual(["cash_card"]);
    // ...and TestPts would have to be worth 25% more than we think to change it.
    expect(curve.distanceToNearestFlip).toBeCloseTo(0.002, 5);
  });

  it("names the swept variable for the chart axis", () => {
    expect(curve.variable).toEqual({
      kind: "valuation",
      currency: "TestPts",
      baselineAedPerUnit: 0.008,
    });
  });
});

/**
 * SPENDING SENSITIVITY — hand-computed threshold where a fee-carrying card
 * overtakes a free one.
 *
 *   flat_2pct:     2% on all spend, no annual fee.
 *   grocery_5pct:  5% on groceries, AED 600/yr fee.
 *   Spend: groceries x AED/mo, nothing else.
 *
 * flat_2pct    = 0.02x x 12          = 0.24x
 * grocery_5pct = 0.05x x 12 - 600    = 0.60x - 600
 *
 * Equal when 0.60x - 600 = 0.24x  ->  0.36x = 600  ->  x = 1,666.67 AED/mo.
 * Below that the fee outweighs the better rate; above it the 5% card wins. This
 * is the whole "is the annual fee worth it" question as one number.
 */
describe("spendingSensitivity — finds the threshold where a fee-carrying card overtakes", () => {
  const cards = [
    mkCard("flat_2pct", { base_rate: "2% on all spend" }),
    mkCard("grocery_5pct", {
      categories: [{ category: "groceries", rate: "5%" }],
      annual_fee: 600,
    }),
  ];

  const curve = spendingSensitivity({ groceries: 1000 }, OPEN_PROFILE, cards, {
    category: "groceries",
    from: 0,
    to: 4000,
    steps: 11,
    optimize: { maxCards: 1 },
  });

  const TRUE_THRESHOLD = 600 / 0.36; // 1,666.666... — stated as the algebra, not a rounded literal.

  it("flips once, at 1,666.67 AED/mo", () => {
    expect(curve.flips).toHaveLength(1);
    const flip = curve.flips[0]!;
    expect(flip.from).toEqual(["flat_2pct"]);
    expect(flip.to).toEqual(["grocery_5pct"]);
    // The bracket must actually contain the true break-even...
    expect(flip.bracket.lo).toBeLessThanOrEqual(TRUE_THRESHOLD);
    expect(flip.bracket.hi).toBeGreaterThanOrEqual(TRUE_THRESHOLD);
    // ...and `precision` must be an honest error bar on `x`, not decoration.
    expect(Math.abs(flip.x - TRUE_THRESHOLD)).toBeLessThanOrEqual(flip.precision);
    // 12 halvings of a 400-wide grid step: 400/2^12 ≈ 0.098 wide, so ±0.049.
    expect(flip.precision).toBeLessThan(0.05);
  });

  it("matches hand math on both sides of the threshold", () => {
    const at = (x: number) => curve.samples.find((s) => Math.abs(s.x - x) < 1e-9)!;
    // x = 800:  flat = 192,  grocery = 480 - 600 = -120  -> flat wins at 192.
    expect(at(800).cardIds).toEqual(["flat_2pct"]);
    expect(at(800).netAnnualValue).toBeCloseTo(192, 6);
    // x = 2,400: flat = 576,  grocery = 1,440 - 600 = 840 -> grocery wins at 840.
    expect(at(2400).cardIds).toEqual(["grocery_5pct"]);
    expect(at(2400).netAnnualValue).toBeCloseTo(840, 6);
  });

  it("puts the user's current 1,000/mo below the threshold", () => {
    expect(curve.baseline.cardIds).toEqual(["flat_2pct"]);
    // They'd need ~667 AED/mo more groceries to justify the fee — same error bar.
    expect(Math.abs(curve.distanceToNearestFlip! - (TRUE_THRESHOLD - 1000))).toBeLessThanOrEqual(
      curve.flips[0]!.precision,
    );
  });

  it("keeps the swept category at zero without breaking (nobody earns anything)", () => {
    const at0 = curve.samples[0]!;
    expect(at0.x).toBe(0);
    // Both cards earn 0; grocery_5pct nets -600, so the free card wins at 0.
    expect(at0.cardIds).toEqual(["flat_2pct"]);
    expect(at0.netAnnualValue).toBeCloseTo(0, 6);
  });
});

/** A recommendation that nothing in range can dislodge must report no flips. */
describe("sensitivity — a robust recommendation reports no flips", () => {
  const cards = [
    mkCard("dominant", { base_rate: "5% on all spend" }),
    mkCard("weak", { base_rate: "1% on all spend" }),
  ];

  it("valuation sweep of an unrelated currency leaves the winner unchanged", () => {
    const curve = valuationSensitivity({ other: 1000 }, OPEN_PROFILE, cards, {
      currency: "Skywards Miles", // no card here earns it
      relativeRange: 0.9,
      steps: 5,
      refineIterations: 0,
      optimize: { maxCards: 1 },
    });
    expect(curve.flips).toEqual([]);
    expect(curve.distanceToNearestFlip).toBeNull();
    expect(curve.samples.every((s) => s.cardIds[0] === "dominant")).toBe(true);
  });

  it("spend sweep never lets the weaker card overtake", () => {
    const curve = spendingSensitivity({ other: 500 }, OPEN_PROFILE, cards, {
      category: "other",
      from: 0,
      to: 20000,
      steps: 5,
      optimize: { maxCards: 1 },
    });
    expect(curve.flips).toEqual([]);
    expect(curve.distanceToNearestFlip).toBeNull();
  });
});

/**
 * FRAGILITY FLAG — the honesty model applied to the recommendation itself.
 *
 *   cash_card:   1% on all spend  -> AED 120/yr, flat.       Currency AED, confidence HIGH.
 *   points_card: 1 TestPts per AED -> AED 12,000v/yr.        Currency TestPts, confidence LOW.
 *   Spend: 1,000 AED/mo. Break-even v = 0.01 (as computed above).
 *
 * Valued at 0.011, points_card wins — but only by 10%. The break-even sits
 * (0.011 - 0.01)/0.011 = 9.1% BELOW baseline, so a 9% error in a number we admit
 * we never researched changes the answer. That must be flagged.
 */
describe("assessValuationFragility — flags a recommendation resting on an unverified valuation", () => {
  const cards = [
    mkCard("cash_card", { base_rate: "1% on all spend" }),
    mkCard("points_card", { base_rate: "1 point per AED 1", type: "points", currency: "TestPts" }),
  ];
  const spending: SpendingProfile = { other: 1000 };

  const fragileTable = withValuations({
    TestPts: { aedPerUnit: 0.011, confidence: "low", note: "NOT researched — placeholder" },
  });

  const assessment = assessValuationFragility(spending, OPEN_PROFILE, cards, {
    valuations: fragileTable,
    steps: 9,
    optimize: { maxCards: 1 },
  });

  it("checks only the currencies the recommended card actually earns", () => {
    // The winner is points_card, so TestPts is checked; cash_card's AED is not in
    // the recommendation at all, and is high-confidence besides.
    expect(assessment.findings.map((f) => f.currency)).toEqual(["TestPts"]);
    expect(assessment.findings[0]!.cardIds).toEqual(["points_card"]);
  });

  it("measures the stable band asymmetrically and calls it fragile", () => {
    const f = assessment.findings[0]!;
    expect(f.confidence).toBe("low");
    expect(f.baselineAedPerUnit).toBeCloseTo(0.011, 9);
    // Downside break-even at 0.01; no upside flip (points_card only extends its lead).
    expect(f.stableBand.from).toBeCloseTo(0.01, 5);
    expect(f.stableBand.to).toBeNull();
    expect(f.relativeHeadroom).toBeCloseTo(0.0909, 3);
    expect(f.fragile).toBe(true);
  });

  it("emits a receipt flag naming the currency, the card and the band", () => {
    expect(assessment.flags).toHaveLength(1);
    const flag = assessment.flags[0]!;
    // Low confidence -> "unknown", the level the receipt already uses for
    // "we could not establish this".
    expect(flag.level).toBe("unknown");
    expect(flag.message).toContain("TestPts");
    expect(flag.message).toContain("points_card");
    expect(flag.message).toContain("unverified");
    expect(flag.message).toContain("9% less");
    expect(flag.message).toContain("±9%");
  });

  it("appends the flag to a portfolio receipt without mutating the original", () => {
    const best = optimizePortfolio(spending, OPEN_PROFILE, cards, fragileTable, { maxCards: 1 })
      .overallBest!;
    const flagCountBefore = best.flags.length;
    const flagged = withFragilityFlags(best, assessment.flags);

    expect(flagged.flags).toHaveLength(flagCountBefore + 1);
    expect(flagged.flags.at(-1)!.message).toContain("sensitive to an unverified valuation");
    // A recommendation a small valuation error can overturn IS uncertain.
    expect(flagged.uncertain).toBe(true);
    // Original untouched — the engine stays pure.
    expect(best.flags).toHaveLength(flagCountBefore);
    expect(flagged.netAnnualValue).toBe(best.netAnnualValue);
  });

  it("is a no-op when there is nothing to flag", () => {
    const best = optimizePortfolio(spending, OPEN_PROFILE, cards, fragileTable, { maxCards: 1 })
      .overallBest!;
    expect(withFragilityFlags(best, [])).toBe(best);
  });
});

describe("assessValuationFragility — stays quiet when the recommendation is robust", () => {
  const cards = [
    mkCard("cash_card", { base_rate: "1% on all spend" }),
    mkCard("points_card", { base_rate: "1 point per AED 1", type: "points", currency: "TestPts" }),
  ];
  const spending: SpendingProfile = { other: 1000 };

  it("does not flag when the break-even is far outside the plausible error band", () => {
    // Valued at 0.05, break-even 0.01 is 80% below — a ±50% sweep never reaches it.
    const assessment = assessValuationFragility(spending, OPEN_PROFILE, cards, {
      valuations: withValuations({ TestPts: { aedPerUnit: 0.05, confidence: "low" } }),
      steps: 9,
      optimize: { maxCards: 1 },
    });
    const f = assessment.findings[0]!;
    expect(f.stableBand).toEqual({ from: null, to: null });
    expect(f.relativeHeadroom).toBeNull();
    expect(f.fragile).toBe(false);
    expect(assessment.flags).toEqual([]);
  });

  it("does not flag a high-confidence valuation, however narrow the band", () => {
    // Same knife-edge 0.011 as the fragile case, but the value is researched.
    const assessment = assessValuationFragility(spending, OPEN_PROFILE, cards, {
      valuations: withValuations({ TestPts: { aedPerUnit: 0.011, confidence: "high" } }),
      steps: 9,
      optimize: { maxCards: 1 },
    });
    // Not even checked — the flag is about unverified inputs, not close calls.
    expect(assessment.findings).toEqual([]);
    expect(assessment.flags).toEqual([]);
  });

  it("checks a high-confidence currency when the caller opts in", () => {
    const assessment = assessValuationFragility(spending, OPEN_PROFILE, cards, {
      valuations: withValuations({ TestPts: { aedPerUnit: 0.011, confidence: "high" } }),
      steps: 9,
      confidences: ["low", "medium", "high"],
      optimize: { maxCards: 1 },
    });
    expect(assessment.findings[0]!.fragile).toBe(true);
    // Softer level, and worded as a close call — claiming a researched value is
    // "unverified" would be a false statement about our own data.
    expect(assessment.flags[0]!.level).toBe("low");
    expect(assessment.flags[0]!.message).toContain("close call");
    expect(assessment.flags[0]!.message).not.toContain("unverified");
  });
});

/** Cost accounting and input validation. */
describe("sensitivity — cost accounting and guardrails", () => {
  const cards = [
    mkCard("a", { base_rate: "1% on all spend" }),
    mkCard("b", { categories: [{ category: "groceries", rate: "5%" }], annual_fee: 600 }),
  ];

  it("reports one optimizer run per sample, plus refinement, plus baseline when off-grid", () => {
    const curve = spendingSensitivity({ groceries: 1234 }, OPEN_PROFILE, cards, {
      category: "groceries",
      from: 0,
      to: 4000,
      steps: 5,
      refineIterations: 3,
      optimize: { maxCards: 1 },
    });
    // 5 grid samples + 3 bisection steps for the single flip + 1 off-grid baseline.
    expect(curve.flips).toHaveLength(1);
    expect(curve.optimizerRuns).toBe(5 + 3 + 1);
    // Coarse refinement -> a wide bracket, and `precision` must admit it.
    expect(curve.flips[0]!.precision).toBeGreaterThan(0);
    expect(curve.flips[0]!.bracket.hi - curve.flips[0]!.bracket.lo).toBeCloseTo(1000 / 2 ** 3, 6);
  });

  it("does not spend an extra run when the baseline lands on the grid", () => {
    const curve = spendingSensitivity({ groceries: 2000 }, OPEN_PROFILE, cards, {
      category: "groceries",
      from: 0,
      to: 4000,
      steps: 5, // samples at 0, 1000, 2000, 3000, 4000 — baseline is one of them
      refineIterations: 0,
      optimize: { maxCards: 1 },
    });
    expect(curve.optimizerRuns).toBe(5);
    expect(curve.baseline.x).toBe(2000);
  });

  it("throws on a currency the valuation table doesn't know", () => {
    expect(() =>
      valuationSensitivity({ other: 1000 }, OPEN_PROFILE, cards, { currency: "Nonexistent Points" }),
    ).toThrow(/no valuation entry for currency "Nonexistent Points"/);
  });

  it("throws on an inverted or degenerate range", () => {
    expect(() =>
      spendingSensitivity({ groceries: 1000 }, OPEN_PROFILE, cards, {
        category: "groceries",
        from: 500,
        to: 500,
      }),
    ).toThrow(/must exceed/);
    expect(() =>
      spendingSensitivity({ groceries: 1000 }, OPEN_PROFILE, cards, {
        category: "groceries",
        from: 0,
        to: 100,
        steps: 1,
      }),
    ).toThrow(/steps must be >= 2/);
  });
});
