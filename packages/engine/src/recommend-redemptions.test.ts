import { describe, it, expect } from "vitest";
import { recommendRedemptions } from "./recommend-redemptions";
import type { PointsInventory } from "./points-inventory";

// Hand-computed from REDEMPTION_VALUATIONS + CONVERSIONS:
//   Skywards:    economy 0.037, mall 0.011 (no cash route)
//   TouchPoints: max 0.006, instore 0.005, voucher 0.004, bill_payment 0.004348 (NO card bill)
//   Plus Points: fixed_use 1.0, card_bill 0.75 (cash-capable)
//   Smiles:      all 0.01 (NO card bill)
const INVENTORY: PointsInventory = [
  { currency: "Skywards Miles", balance: 10000 },
  { currency: "TouchPoints (convertible to miles)", balance: 22000 },
  { currency: "Plus Points", balance: 1000 },
  { currency: "Smiles Points", balance: 5000 },
];

const pick = (plan: ReturnType<typeof recommendRedemptions>, cur: string) =>
  plan.suggestions.find((s) => s.currency === cur)!;

describe("recommendRedemptions — never says 'cash'; phrasing follows cash-capability", () => {
  const plan = recommendRedemptions(INVENTORY, "cash_equivalent");

  it("no generated receipt contains the word 'cash' (inherited source notes like Smiles' 'cashback not permitted' are data, not our phrasing)", () => {
    for (const s of plan.suggestions) {
      expect(s.receipt.toLowerCase()).not.toContain("cash");
    }
  });

  it("TouchPoints (no card bill): 'pay AED X of a utility bill / redeem as vouchers — no card-bill payment available'", () => {
    const s = pick(plan, "TouchPoints (convertible to miles)");
    expect(s.best?.type).toBe("bill_payment");
    expect(s.best?.aedValue).toBeCloseTo(95.656, 6); // 22000 × 0.004348
    expect(s.receipt).toContain("no card-bill payment available");
  });

  it("Smiles (no card bill): same no-card-bill caveat", () => {
    const s = pick(plan, "Smiles Points");
    expect(s.best?.aedValue).toBeCloseTo(50, 10);
    expect(s.receipt).toContain("no card-bill payment available");
  });

  it("Plus Points (cash-capable): best is the 1.0 fixed use, phrased normally (no caveat)", () => {
    const s = pick(plan, "Plus Points");
    expect(s.best?.type).toBe("fixed_use");
    expect(s.best?.aedValue).toBeCloseTo(1000, 10);
    expect(s.receipt).toContain("fixed use");
    expect(s.receipt).not.toContain("no card-bill");
  });

  it("Skywards has no liquid route, so it reports no redemption toward statement credit", () => {
    expect(pick(plan, "Skywards Miles").best).toBeNull();
  });
});

describe("recommendRedemptions — card-bill phrasing for a statement-credit currency", () => {
  it("FAB card-bill redemption reads 'off your card bill (statement credit)'", () => {
    const plan = recommendRedemptions([{ currency: "FAB Rewards", balance: 10000 }], "cash_equivalent");
    const s = plan.suggestions[0]!;
    expect(s.best?.class).toBe("card_bill");
    expect(s.receipt).toContain("off your card bill (statement credit)");
    expect(s.receipt.toLowerCase()).not.toContain("cash");
  });
});

describe("recommendRedemptions — conversions only when they beat direct", () => {
  it("max_value: TouchPoints keeps its 0.006 partner spend; conversion is rejected and the finding is flagged", () => {
    const plan = recommendRedemptions(INVENTORY, "max_value");
    const s = pick(plan, "TouchPoints (convertible to miles)");
    expect(["touchpoints_max_partner", "ecommerce_partner"]).toContain(s.best?.type);
    expect(s.best?.aedValue).toBeCloseTo(132, 10); // 22000 × 0.006
    expect(s.best?.viaConversion).toBeUndefined();
    expect(s.flags.some((f) => f.includes("baseline economy mile value"))).toBe(true);
  });

  it("flights: TouchPoints can't fly directly, so it converts to Etihad business", () => {
    const plan = recommendRedemptions(INVENTORY, "flights");
    const s = pick(plan, "TouchPoints (convertible to miles)");
    expect(s.best?.viaConversion?.toCurrency).toBe("Etihad Guest Miles");
    expect(s.best?.type).toBe("business_flight");
    expect(s.best?.viaConversion?.resultingUnits).toBe(1571); // floor(22000/14)
    expect(s.best?.aedValue).toBeCloseTo(75.408, 6);
  });
});

describe("recommendRedemptions — premium multiplier", () => {
  it("values Skywards premium seats at economy × multiplier when supplied", () => {
    const plan = recommendRedemptions([{ currency: "Skywards Miles", balance: 10000 }], "flights", undefined, undefined, {
      premiumMultiplier: 2,
    });
    const s = plan.suggestions[0]!;
    expect(s.best?.class).toBe("flight_premium");
    expect(s.best?.aedValue).toBeCloseTo(740, 10); // 10000 × (0.037 × 2)
    expect(s.receipt).toContain("premium-cabin");
  });

  it("without a multiplier, Skywards is valued at economy only", () => {
    const plan = recommendRedemptions([{ currency: "Skywards Miles", balance: 10000 }], "flights");
    expect(plan.suggestions[0]!.best?.class).toBe("flight_economy");
    expect(plan.suggestions[0]!.best?.aedValue).toBeCloseTo(370, 10);
  });
});

describe("recommendRedemptions — goal filtering & ranking", () => {
  it("hotels: only a hotel currency qualifies", () => {
    const plan = recommendRedemptions(
      [
        { currency: "Marriott Bonvoy Points", balance: 20000 },
        { currency: "Skywards Miles", balance: 10000 },
      ],
      "hotels",
    );
    expect(pick(plan, "Marriott Bonvoy Points").best?.aedValue).toBeCloseTo(560, 10); // 20000 × 0.028
    expect(pick(plan, "Skywards Miles").best).toBeNull();
  });

  it("ranks by realized AED and totals correctly (max_value)", () => {
    const plan = recommendRedemptions(INVENTORY, "max_value");
    expect(plan.suggestions.map((s) => s.currency)).toEqual([
      "Plus Points", // 1000
      "Skywards Miles", // 370
      "TouchPoints (convertible to miles)", // 132
      "Smiles Points", // 50
    ]);
    expect(plan.totalAed).toBeCloseTo(1552, 10);
  });
});

describe("recommendRedemptions — constraints", () => {
  it("Smiles is never routed to a card bill (it has none)", () => {
    for (const goal of ["cash_equivalent", "max_value"] as const) {
      const s = recommendRedemptions([{ currency: "Smiles Points", balance: 5000 }], goal).suggestions[0]!;
      expect(s.best?.class).not.toBe("card_bill");
    }
  });

  it("unknown currency: loud flag, no crash, no fabricated flight value", () => {
    const inv: PointsInventory = [{ currency: "Zorp Coins", balance: 1000 }];
    const mv = recommendRedemptions(inv, "max_value");
    expect(mv.flags.join(" ")).toContain("unknown currency");
    expect(mv.suggestions[0]!.best?.aedValue).toBeCloseTo(7.5, 10); // 1000 × 0.0075
    expect(recommendRedemptions(inv, "flights").suggestions[0]!.best).toBeNull();
  });
});
