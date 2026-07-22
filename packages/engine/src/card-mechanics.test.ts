/**
 * The three card mechanics that were previously only noted in `data_caveat`:
 * forfeiture gating, overall_cap enforcement, and segment-level zero-earn.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card, RewardType } from "./card";
import { scoreCard, type SpendingProfile } from "./score-card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";
import { withValuations } from "./valuations";

const realCards = cardsData as Card[];
const OPEN_PROFILE: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };

function mkCard(
  id: string,
  overrides: {
    categories?: { category: string; rate: string; monthly_cap?: number | null }[];
    base_rate?: string;
    annual_fee?: number;
    currency?: string;
    type?: RewardType;
    overall_cap?: number | null;
    min_monthly_spend?: number;
    gate_mode?: "degrade" | "forfeit";
    excluded_spend?: { category: string; reason: string }[];
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
      overall_cap: overrides.overall_cap ?? null,
      min_monthly_spend_required_aed: overrides.min_monthly_spend ?? 0,
      ...(overrides.gate_mode ? { gate_mode: overrides.gate_mode } : {}),
    },
    redemption: { currency: overrides.currency ?? "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
    ...(overrides.excluded_spend ? { excluded_spend: overrides.excluded_spend } : {}),
  };
}

// ===========================================================================
// 1. Forfeiture gating.
// ===========================================================================

/**
 * Both gate modes, same card shape, hand-computed.
 *
 *   5% on groceries, 1% base, minimum spend AED 4,000/mo.
 *
 * Spend 3,000/mo groceries (BELOW threshold):
 *   degrade -> bonus off, base still pays: 1% x 3,000 x 12 = AED 360/yr.
 *   forfeit -> the cycle's rewards are lost entirely:      AED 0/yr.
 *
 * Spend 5,000/mo groceries (threshold MET) — identical in both modes:
 *   5% x 5,000 x 12 = AED 3,000/yr.
 */
describe("gate_mode — forfeiture vs degradation below the minimum spend", () => {
  const shape = {
    categories: [{ category: "groceries", rate: "5%" }],
    base_rate: "1% on all spend",
    min_monthly_spend: 4000,
  };
  const degrading = mkCard("degrading", shape);
  const forfeiting = mkCard("forfeiting", { ...shape, gate_mode: "forfeit" });

  it("degrade (the default) drops to the base rate: AED 360/yr", () => {
    const score = scoreCard({ groceries: 3000 }, degrading);
    expect(score.grossAnnualValue.min).toBeCloseTo(360, 6);
    expect(score.flags.some((f) => /bonus rates disabled/.test(f.message))).toBe(true);
  });

  it("forfeit earns absolutely nothing below the threshold", () => {
    const score = scoreCard({ groceries: 3000 }, forfeiting);
    expect(score.grossAnnualValue).toEqual({ min: 0, max: 0 });
    expect(score.netAnnualValue).toBeCloseTo(0, 6);
    expect(score.flags.some((f) => /FORFEITS all rewards/.test(f.message))).toBe(true);
  });

  it("both modes agree once the threshold is met: AED 3,000/yr", () => {
    const spending: SpendingProfile = { groceries: 5000 };
    expect(scoreCard(spending, degrading).grossAnnualValue.min).toBeCloseTo(3000, 6);
    expect(scoreCard(spending, forfeiting).grossAnnualValue.min).toBeCloseTo(3000, 6);
    // No gate flag on either card when the threshold is cleared.
    expect(scoreCard(spending, forfeiting).flags.some((f) => /FORFEIT/i.test(f.message))).toBe(false);
  });

  it("absent gate_mode keeps the old behaviour — every existing card is unaffected", () => {
    // The default card has no gate_mode field at all.
    expect(degrading.rewards.gate_mode).toBeUndefined();
    expect(scoreCard({ groceries: 3000 }, degrading).grossAnnualValue.min).toBeCloseTo(360, 6);
  });

  it("in a portfolio, a forfeiting card's spend routes to a card that can earn on it", () => {
    // Below the 4,000 threshold, `forfeiting` earns nothing, so all 3,000/mo of
    // groceries should land on the 2% card: 2% x 3,000 x 12 = AED 720/yr.
    const other = mkCard("other", { base_rate: "2% on all spend" });
    const result = optimizePortfolio({ groceries: 3000 }, OPEN_PROFILE, [forfeiting, other], undefined, {
      maxCards: 2,
    });
    expect(result.best2!.grossAnnualValue.min).toBeCloseTo(720, 6);
    const onForfeiting = result.best2!.allocations.filter((a) => a.cardId === "forfeiting");
    expect(onForfeiting).toEqual([]);
  });

  it("the two DIB consumer cards carry the forfeiture rule from their data_caveat", () => {
    for (const id of ["dib_consumer_platinum", "dib_consumer_reward"]) {
      const card = realCards.find((c) => c.id === id)!;
      expect(card.rewards.gate_mode).toBe("forfeit");
      // Below its own threshold the real card must earn nothing.
      const belowThreshold = card.rewards.min_monthly_spend_required_aed - 500;
      const score = scoreCard({ groceries: belowThreshold }, card);
      expect(score.grossAnnualValue).toEqual({ min: 0, max: 0 });
    }
  });
});

// ===========================================================================
// 2. overall_cap enforcement — confirming the earlier fix holds.
// ===========================================================================

/**
 * The cap is a MONTHLY ceiling on a card's TOTAL rewards, annualised x12.
 *
 * Corroborated by rakbank_world, whose overall_cap (1,100) is exactly the sum of
 * its four category monthly caps (300 + 300 + 400 + 100) — a figure that only
 * makes sense per month.
 */
describe("overall_cap — enforced on every capped card", () => {
  it("caps a synthetic card's total at overall_cap x 12", () => {
    // 10% on groceries AND dining, no category caps, overall cap AED 200/mo.
    // Uncapped: 10% x (3,000 + 3,000) x 12 = AED 7,200/yr.
    // Capped:   200 x 12 = AED 2,400/yr.
    const card = mkCard("capped", {
      categories: [
        { category: "groceries", rate: "10%" },
        { category: "dining", rate: "10%" },
      ],
      overall_cap: 200,
    });
    const score = scoreCard({ groceries: 3000, dining: 3000 }, card);
    expect(score.grossAnnualValue.min).toBeCloseTo(2400, 6);
    expect(score.flags.some((f) => /Overall reward cap reached/.test(f.message))).toBe(true);
  });

  it("treats a points card's overall_cap as reward UNITS, not AED", () => {
    // 1 pt/AED valued 0.5, cap 100 units/mo. Spend 1,000/mo -> 12,000 pts = AED 6,000
    // uncapped; capped = 100 x 0.5 x 12 = AED 600/yr.
    const card = mkCard("pts", {
      base_rate: "1 point per AED 1",
      type: "points",
      currency: "SynthPts",
      overall_cap: 100,
    });
    const vals = withValuations({ SynthPts: { aedPerUnit: 0.5, confidence: "low" } });
    expect(scoreCard({ other: 1000 }, card, vals).grossAnnualValue.min).toBeCloseTo(600, 6);
  });

  it("no real capped card can be scored above its own cap, at any spend level", () => {
    const capped = realCards.filter((c) => !c.excluded_from_scoring && c.rewards.overall_cap !== null);
    // Guard: if the dataset ever loses its capped cards this test is silently vacuous.
    expect(capped.length).toBeGreaterThan(0);

    for (const card of capped) {
      const cap = card.rewards.overall_cap!;
      // Cashback caps are AED; points/miles caps are reward units -> value them.
      const aedPerUnit =
        card.rewards.type === "cashback"
          ? 1
          : scoreCard({ other: 1 }, card).valuation.aedPerUnit;
      const annualCapAed = (card.rewards.type === "cashback" ? cap : cap * aedPerUnit) * 12;

      // Deliberately absurd spend, far past where any cap binds.
      const score = scoreCard(
        {
          groceries: 50000, dining: 50000, fuel: 50000, utilities: 50000, education: 50000,
          travel: 50000, transport: 50000, entertainment: 50000, international: 50000, other: 50000,
        },
        card,
      );
      expect(
        score.grossAnnualValue.max,
        `${card.id} gross ${score.grossAnnualValue.max.toFixed(0)} exceeds its overall cap ${annualCapAed.toFixed(0)}`,
      ).toBeLessThanOrEqual(annualCapAed + 1e-6);
    }
  });
});

// ===========================================================================
// 3. excluded_spend — segment-level zero-earn.
// ===========================================================================

describe("excluded_spend — spend in an excluded segment earns nothing", () => {
  it("zeroes a category even when a bonus rate explicitly covers it", () => {
    // 5% on international, but international is excluded -> earns nothing at all.
    const card = mkCard("excluder", {
      categories: [{ category: "international_spend", rate: "5%" }],
      base_rate: "1% on all spend",
      excluded_spend: [{ category: "international", reason: "test exclusion" }],
    });
    expect(scoreCard({ international: 2000 }, card).grossAnnualValue).toEqual({ min: 0, max: 0 });
  });

  it("does not leak the excluded spend into the base rate via the catchall", () => {
    // The catchall must be narrowed too, or excluded spend would quietly earn 1%.
    const card = mkCard("excluder", {
      base_rate: "1% on all spend",
      excluded_spend: [{ category: "international", reason: "test exclusion" }],
    });
    expect(scoreCard({ international: 2000 }, card).grossAnnualValue).toEqual({ min: 0, max: 0 });
    // Non-excluded spend is untouched: 1% x 2,000 x 12 = AED 240/yr.
    expect(scoreCard({ groceries: 2000 }, card).grossAnnualValue.min).toBeCloseTo(240, 6);
  });

  it("leaves other categories fully earning and flags the exclusion", () => {
    const card = mkCard("excluder", {
      categories: [
        { category: "international_spend", rate: "5%" },
        { category: "groceries", rate: "3%" },
      ],
      base_rate: "1% on all spend",
      excluded_spend: [{ category: "international", reason: "test exclusion" }],
    });
    // groceries 3% x 1,000 x 12 = 360; international earns 0. Total 360.
    const score = scoreCard({ groceries: 1000, international: 1000 }, card);
    expect(score.grossAnnualValue.min).toBeCloseTo(360, 6);
    expect(score.flags.some((f) => /International earns nothing on this card/.test(f.message))).toBe(true);
  });

  it("routes excluded spend to another card in a portfolio", () => {
    const excluder = mkCard("excluder", {
      categories: [{ category: "international_spend", rate: "5%" }],
      excluded_spend: [{ category: "international", reason: "test exclusion" }],
    });
    const plain = mkCard("plain", { base_rate: "2% on all spend" });
    // International must land on `plain`: 2% x 1,000 x 12 = AED 240/yr.
    const result = optimizePortfolio({ international: 1000 }, OPEN_PROFILE, [excluder, plain], undefined, {
      maxCards: 2,
    });
    expect(result.best2!.grossAnnualValue.min).toBeCloseTo(240, 6);
    expect(result.best2!.allocations.every((a) => a.cardId === "plain")).toBe(true);
  });

  it("flags an unknown excluded category instead of silently ignoring it", () => {
    const card = mkCard("typo", {
      base_rate: "1% on all spend",
      excluded_spend: [{ category: "internationl", reason: "typo" }],
    });
    const score = scoreCard({ international: 1000 }, card);
    expect(score.flags.some((f) => /Unknown excluded_spend category "internationl"/.test(f.message))).toBe(true);
    // Exclusion NOT applied, so the spend still earns — loudly, not silently.
    expect(score.grossAnnualValue.min).toBeCloseTo(120, 6);
  });

  it("applies the EEA rule to the real DIB Prime Infinite card", () => {
    const card = realCards.find((c) => c.id === "dib_prime_infinite")!;
    expect(card.excluded_spend?.[0]?.category).toBe("international");
    // International spend now earns nothing on this card...
    expect(scoreCard({ international: 5000 }, card).grossAnnualValue).toEqual({ min: 0, max: 0 });
    // ...while domestic spend is untouched: 3 Wala'a/AED on 5,000/mo.
    expect(scoreCard({ other: 5000 }, card).grossAnnualValue.min).toBeGreaterThan(0);
  });
});
