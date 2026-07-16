import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card, RewardType } from "./card";
import type { SpendingProfile } from "./score-card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";

const realCards = cardsData as Card[];

// A resident earning enough to pass most eligibility gates (used by synthetic cases,
// where the synthetic cards themselves set no requirements).
const OPEN_PROFILE: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };

/**
 * Minimal synthetic-card factory. Defaults make an AED cashback card (valuation
 * 1.0, high confidence) with no fee, no eligibility gates — so hand math stays
 * transparent: a percent rate on cashback is AED returned directly, and unit caps
 * are AED caps. Callers override only what a case needs.
 */
function mkCard(
  id: string,
  overrides: {
    categories?: { category: string; rate: string; monthly_cap?: number | null; annual_cap?: number | null }[];
    base_rate?: string;
    annual_fee?: number;
    waiver?: string | null;
    min_salary?: number;
    resident_required?: boolean;
    salary_transfer?: boolean;
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
      min_monthly_salary_aed: overrides.min_salary ?? 0,
      uae_resident_required: overrides.resident_required ?? false,
      min_age: 0,
      salary_transfer_required: overrides.salary_transfer ?? false,
      employer_restrictions: null,
    },
    fees: {
      annual_fee_aed: overrides.annual_fee ?? 0,
      waiver_conditions: overrides.waiver ?? null,
      joining_fee_aed: 0,
    },
    rewards: {
      type: overrides.type ?? "cashback",
      currency: overrides.currency ?? "AED",
      base_rate: overrides.base_rate ?? "0% on all spend",
      categories: (overrides.categories ?? []).map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthly_cap ?? null,
        annual_cap: c.annual_cap ?? null,
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
 * Case 1 — complementary beats individually-stronger overlap.
 *   X: groceries 10% (nothing else).   Y: dining 10% (nothing else).
 *   Z: groceries 6% + dining 6% (the strongest SINGLE card).
 *   Spend: groceries 1000, dining 1000 (AED/mo).
 *
 * Best 1-card = Z: 6% on both = 60 + 60 = 120/mo = 1440/yr.
 * Best 2-card = {X,Y}: 10% + 10% = 100 + 100 = 200/mo = 2400/yr — the complementary
 * pair beats any pair containing Z, and beats Z alone.
 */
describe("optimizePortfolio — complementary pair beats the strongest single card", () => {
  const cards = [
    mkCard("X", { categories: [{ category: "groceries", rate: "10%" }] }),
    mkCard("Y", { categories: [{ category: "dining", rate: "10%" }] }),
    mkCard("Z", { categories: [{ category: "groceries", rate: "6%" }, { category: "dining", rate: "6%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("picks Z as the best single card (1440/yr)", () => {
    expect(result.best1?.cardIds).toEqual(["Z"]);
    expect(result.best1?.netAnnualValue).toBe(1440);
    expect(result.best1?.grossAnnualValue).toEqual({ min: 1440, max: 1440 });
    expect(result.best1?.uncertain).toBe(false);
  });

  it("picks the complementary {X,Y} pair as the best two-card (2400/yr)", () => {
    expect(result.best2?.cardIds).toEqual(["X", "Y"]);
    expect(result.best2?.grossAnnualValue).toEqual({ min: 2400, max: 2400 });
    expect(result.best2?.netAnnualValue).toBe(2400);
  });

  it("assigns each category to the 10% card in the winning pair", () => {
    const alloc = result.best2!.allocations;
    const g = alloc.find((a) => a.spendCategory === "groceries");
    const d = alloc.find((a) => a.spendCategory === "dining");
    expect(g).toMatchObject({ cardId: "X", cardCategory: "groceries", monthlySpendAed: 1000 });
    expect(g?.annualValueAed).toEqual({ min: 1200, max: 1200 });
    expect(d).toMatchObject({ cardId: "Y", cardCategory: "dining", monthlySpendAed: 1000 });
  });

  it("recommends the 2-card pair overall; the 3rd card (Z) only ties, so fewer cards wins", () => {
    // {X,Y,Z} also earns 2400 (Z goes unused), so overallBest prefers the 2-card set.
    expect(result.best3?.grossAnnualValue.min).toBe(2400);
    expect(result.overallBest?.cardIds).toEqual(["X", "Y"]);
  });
});

/**
 * Case 2 — ADVERSARIAL: naive per-category greedy gives the wrong answer.
 *   A: groceries_dining 10%, monthly_cap 100 AED reward  (so cap binds at 1000 AED/mo spend).
 *   B: dining 8% (dining only).
 *   Spend: groceries 1000, dining 1000.
 *
 * Naive greedy routes BOTH categories to A's 10% option (it's each category's best
 * rate). Their combined 2000 AED/mo hits A's 100 AED cap; overflow is dropped →
 * only ~1200/yr.
 * The exact optimum instead reserves A entirely for groceries (fills the cap for
 * 1200/yr) and sends dining to B's 8% (960/yr) → 2160/yr. We assert the optimum.
 */
describe("optimizePortfolio — exact assignment beats greedy under a binding cap", () => {
  const cards = [
    mkCard("A", { categories: [{ category: "groceries_dining", rate: "10%", monthly_cap: 100 }] }),
    mkCard("B", { categories: [{ category: "dining", rate: "8%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("returns the hand-computed optimum (2160/yr), not the greedy 1200/yr", () => {
    expect(result.best2?.grossAnnualValue).toEqual({ min: 2160, max: 2160 });
  });

  it("reserves the capped 10% card for groceries and routes dining to the 8% card", () => {
    const alloc = result.best2!.allocations;
    const g = alloc.find((a) => a.spendCategory === "groceries");
    const d = alloc.find((a) => a.spendCategory === "dining");
    expect(g).toMatchObject({ cardId: "A", cardCategory: "groceries_dining", capBound: "monthly" });
    expect(g?.annualValueAed).toEqual({ min: 1200, max: 1200 });
    expect(d).toMatchObject({ cardId: "B", cardCategory: "dining" });
    expect(d?.annualValueAed).toEqual({ min: 960, max: 960 });
  });
});

/**
 * Case 3 — cap overflow routes to the next-best card (spend never vanishes).
 *   A: groceries 10%, monthly_cap 100 AED  (cap binds at 1000 AED/mo spend).
 *   B: groceries 5% (uncapped).
 *   Spend: groceries 1500/mo.
 *
 * A absorbs 1000 (→ 1200/yr, cap bound); the 500 overflow flows to B at 5%
 * (→ 300/yr). Total 1500/yr.
 */
describe("optimizePortfolio — cap overflow reroutes to the next-best card", () => {
  const cards = [
    mkCard("A", { categories: [{ category: "groceries", rate: "10%", monthly_cap: 100 }] }),
    mkCard("B", { categories: [{ category: "groceries", rate: "5%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1500 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("splits groceries across both cards and matches hand math (1500/yr)", () => {
    expect(result.best2?.grossAnnualValue).toEqual({ min: 1500, max: 1500 });
    const alloc = result.best2!.allocations.filter((a) => a.spendCategory === "groceries");
    const onA = alloc.find((a) => a.cardId === "A");
    const onB = alloc.find((a) => a.cardId === "B");
    expect(onA).toMatchObject({ monthlySpendAed: 1000, capBound: "monthly" });
    expect(onA?.annualValueAed).toEqual({ min: 1200, max: 1200 });
    expect(onB).toMatchObject({ monthlySpendAed: 500 });
    expect(onB?.annualValueAed).toEqual({ min: 300, max: 300 });
  });

  it("flags the bound cap and the overflow reroute", () => {
    expect(result.best2?.flags.some((f) => /cap reached.*overflow routed/i.test(f.message))).toBe(true);
  });
});

/**
 * Case 4 — a high-fee card wins gross but loses net; the optimizer picks the
 * cheaper portfolio.
 *   H: groceries 12%, annual fee 5000 (no waiver).  L: groceries 5%, no fee.
 *   Spend: groceries 1000/mo.
 *
 * H gross = 1440/yr but net = 1440 − 5000 = −3560. L gross = 5% × 1000 × 12 = 600/yr, net = 600.
 */
describe("optimizePortfolio — nets out fees, not just gross rewards", () => {
  const cards = [
    mkCard("H", { categories: [{ category: "groceries", rate: "12%" }], annual_fee: 5000 }),
    mkCard("L", { categories: [{ category: "groceries", rate: "5%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("prefers the cheaper card despite the pricier card's higher gross", () => {
    expect(result.best1?.cardIds).toEqual(["L"]);
    expect(result.best1?.netAnnualValue).toBe(600);
    expect(result.overallBest?.cardIds).toEqual(["L"]);
  });

  it("still reports the high-fee card's negative net when it's the only 2-card option", () => {
    expect(result.best2?.cardIds).toEqual(["H", "L"]);
    expect(result.best2?.netAnnualValue).toBe(-3560); // 1440 gross − 5000 fee
  });
});

/**
 * Case 5 — eligibility filter drops cards the user can't get.
 *   P: min salary 25000.   R: min salary 5000.   User earns 10000.
 */
describe("optimizePortfolio — eligibility filter excludes unaffordable cards", () => {
  const cards = [
    mkCard("P", { categories: [{ category: "groceries", rate: "10%" }], min_salary: 25000 }),
    mkCard("R", { categories: [{ category: "groceries", rate: "5%" }], min_salary: 5000 }),
  ];
  const spending: SpendingProfile = { groceries: 1000 };
  const result = optimizePortfolio(spending, { monthlySalaryAed: 10000, uaeResident: true }, cards);

  it("reports survivor counts and never returns the excluded premium card", () => {
    expect(result.eligibleCardCount).toBe(1);
    expect(result.excludedForEligibility).toBe(1);
    expect(result.best1?.cardIds).toEqual(["R"]);
    expect(result.best2).toBeNull(); // only one card survives, so no 2-card portfolio
    expect(result.best1?.cardIds).not.toContain("P");
  });
});

/**
 * Case 6 — portfolio-level rule: a salary can only be transferred to ONE bank, so
 * no portfolio may contain two salary_transfer_required cards.
 */
describe("optimizePortfolio — never returns two salary-transfer cards together", () => {
  const cards = [
    mkCard("S1", { categories: [{ category: "groceries", rate: "10%" }], salary_transfer: true }),
    mkCard("S2", { categories: [{ category: "dining", rate: "10%" }], salary_transfer: true }),
    mkCard("N", { categories: [{ category: "groceries", rate: "3%" }, { category: "dining", rate: "3%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  const hasBothTransfers = (ids: string[] | undefined): boolean =>
    !!ids && ids.includes("S1") && ids.includes("S2");

  it("excludes the two-transfer pair at every size", () => {
    expect(hasBothTransfers(result.best1?.cardIds)).toBe(false);
    expect(hasBothTransfers(result.best2?.cardIds)).toBe(false);
    expect(hasBothTransfers(result.best3?.cardIds)).toBe(false);
    // The only 3-card set is {S1,S2,N} — invalid — so there's no valid 3-card portfolio.
    expect(result.best3).toBeNull();
  });
});

/**
 * Case 7 — full-data smoke test: all real cards, a realistic profile. Must run
 * fast and return sane, flagged output.
 */
describe("optimizePortfolio — full 51-card smoke test", () => {
  const spending: SpendingProfile = {
    groceries: 3000,
    dining: 2000,
    fuel: 1200,
    utilities: 800,
    travel: 2500,
    international: 1500,
    other: 4000,
  };
  const profile: UserProfile = { monthlySalaryAed: 20000, uaeResident: true };

  it("completes quickly and returns a sane best portfolio per size", () => {
    const start = Date.now();
    const result = optimizePortfolio(spending, profile, realCards);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000); // exhaustive search over ~27k subsets, still fast

    expect(result.totalCardCount).toBe(realCards.length);
    expect(result.eligibleCardCount).toBeGreaterThan(0);

    for (const p of [result.best1, result.best2, result.best3]) {
      expect(p).not.toBeNull();
      expect(Number.isFinite(p!.netAnnualValue)).toBe(true);
      expect(p!.allocations.length).toBeGreaterThan(0);
    }

    // More cards should never REDUCE the achievable gross (a superset can always
    // ignore the extra card), a good invariant sanity check.
    expect(result.best2!.grossAnnualValue.min).toBeGreaterThanOrEqual(
      result.best1!.grossAnnualValue.min - 1e-6,
    );
    expect(result.best3!.grossAnnualValue.min).toBeGreaterThanOrEqual(
      result.best2!.grossAnnualValue.min - 1e-6,
    );

    // The overall recommendation is one of the three per-size winners.
    expect([result.best1, result.best2, result.best3]).toContain(result.overallBest);
  });
});
