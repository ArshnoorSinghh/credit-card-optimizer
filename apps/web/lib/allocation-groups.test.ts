import { describe, it, expect } from "vitest";
import { optimizePortfolio, type Card, type CategoryAllocation, type UserProfile } from "@fils/engine";
import { groupAllocationsByCategory } from "@/lib/allocation-groups";

function alloc(over: Partial<CategoryAllocation> & Pick<CategoryAllocation, "spendCategory" | "cardId">): CategoryAllocation {
  return {
    cardCategory: "base_rate",
    monthlySpendAed: 0,
    annualValueAed: { min: 0, max: 0 },
    ...over,
  };
}

describe("groupAllocationsByCategory", () => {
  it("collapses a category split across two cards into one row whose total is the sum of its parts", () => {
    const onA = alloc({
      spendCategory: "groceries",
      cardId: "A",
      monthlySpendAed: 1000,
      annualValueAed: { min: 1200, max: 1200 },
      capBound: "monthly",
    });
    const onB = alloc({
      spendCategory: "groceries",
      cardId: "B",
      monthlySpendAed: 500,
      annualValueAed: { min: 300, max: 300 },
    });

    const groups = groupAllocationsByCategory([onA, onB]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.monthlySpendAed).toBe(1500);
    expect(groups[0]!.annualValueAed).toEqual({ min: 1500, max: 1500 });
    // The summary equals the sum of the breakdown it hides.
    expect(groups[0]!.monthlySpendAed).toBe(onA.monthlySpendAed + onB.monthlySpendAed);
    expect(groups[0]!.annualValueAed.min).toBe(onA.annualValueAed.min + onB.annualValueAed.min);
    expect(groups[0]!.parts).toEqual([onA, onB]);
  });

  it("preserves the cap flag on the part that was capped", () => {
    const groups = groupAllocationsByCategory([
      alloc({ spendCategory: "groceries", cardId: "A", capBound: "monthly" }),
      alloc({ spendCategory: "groceries", cardId: "B" }),
    ]);
    expect(groups[0]!.parts.map((p) => p.capBound)).toEqual(["monthly", undefined]);
  });

  it("keeps distinct categories separate, in the engine's order", () => {
    const groups = groupAllocationsByCategory([
      alloc({ spendCategory: "groceries", cardId: "A", monthlySpendAed: 100 }),
      alloc({ spendCategory: "dining", cardId: "A", monthlySpendAed: 200 }),
      alloc({ spendCategory: "groceries", cardId: "B", monthlySpendAed: 50 }),
    ]);
    expect(groups.map((g) => g.spendCategory)).toEqual(["groceries", "dining"]);
    expect(groups[0]!.monthlySpendAed).toBe(150);
    expect(groups[1]!.parts).toHaveLength(1);
  });

  it("handles an empty receipt", () => {
    expect(groupAllocationsByCategory([])).toEqual([]);
  });

  it("carries a range through without collapsing it", () => {
    const groups = groupAllocationsByCategory([
      alloc({ spendCategory: "travel", cardId: "A", annualValueAed: { min: 100, max: 200 } }),
      alloc({ spendCategory: "travel", cardId: "B", annualValueAed: { min: 10, max: 40 } }),
    ]);
    expect(groups[0]!.annualValueAed).toEqual({ min: 110, max: 240 });
  });
});

/*
 * End-to-end: the engine really does emit two rows when a cap overflows, and the
 * UI grouping folds them into one whose totals match the portfolio's own numbers.
 * Mirrors "cap overflow reroutes to the next-best card" in the engine's tests:
 * A takes 1000/mo at 10% (cap 100 AED/mo, → 1200/yr), B takes the 500 overflow at
 * 5% (→ 300/yr).
 */
describe("groupAllocationsByCategory — against real engine output", () => {
  function mkCard(id: string, category: { category: string; rate: string; monthly_cap?: number }): Card {
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
      fees: { annual_fee_aed: 0, waiver_conditions: null, joining_fee_aed: 0 },
      rewards: {
        type: "cashback",
        currency: "AED",
        base_rate: "0% on all spend",
        categories: [
          {
            category: category.category,
            rate: category.rate,
            monthly_cap: category.monthly_cap ?? null,
            annual_cap: null,
          },
        ],
        overall_cap: null,
        min_monthly_spend_required_aed: 0,
      },
      redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
      benefits: [],
      source_url: "",
    };
  }

  const profile: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };
  const result = optimizePortfolio(
    { groceries: 1500 },
    profile,
    [
      mkCard("A", { category: "groceries", rate: "10%", monthly_cap: 100 }),
      mkCard("B", { category: "groceries", rate: "5%" }),
    ],
  );
  const portfolio = result.best2!;

  it("the engine emits groceries twice", () => {
    expect(portfolio.allocations.filter((a) => a.spendCategory === "groceries")).toHaveLength(2);
  });

  it("the UI renders it as one summary row totalling 1500/mo and 1500/yr", () => {
    const groups = groupAllocationsByCategory(portfolio.allocations);
    const groceries = groups.filter((g) => g.spendCategory === "groceries");
    expect(groceries).toHaveLength(1);
    expect(groceries[0]!.monthlySpendAed).toBe(1500);
    expect(groceries[0]!.annualValueAed).toEqual({ min: 1500, max: 1500 });
    // Same gross the engine reported — the grouping invents nothing.
    expect(groceries[0]!.annualValueAed).toEqual(portfolio.grossAnnualValue);
  });

  it("the expanded breakdown keeps both cards and the monthly cap flag", () => {
    const [groceries] = groupAllocationsByCategory(portfolio.allocations);
    expect(groceries!.parts.map((p) => p.cardId)).toEqual(["A", "B"]);
    expect(groceries!.parts.find((p) => p.cardId === "A")?.capBound).toBe("monthly");
    // Sum of the breakdown === the summary, for every group.
    for (const g of groupAllocationsByCategory(portfolio.allocations)) {
      expect(g.parts.reduce((s, p) => s + p.monthlySpendAed, 0)).toBe(g.monthlySpendAed);
      expect(g.parts.reduce((s, p) => s + p.annualValueAed.min, 0)).toBe(g.annualValueAed.min);
      expect(g.parts.reduce((s, p) => s + p.annualValueAed.max, 0)).toBe(g.annualValueAed.max);
    }
  });
});
