import { describe, it, expect } from "vitest";
import { burnPriority } from "./burn-priority";
import type { PointsInventory } from "./points-inventory";

const ASOF = "2026-07-15";

describe("burnPriority — expiry boundaries", () => {
  it("classifies 89 days as urgent and 91 days as soon", () => {
    const inv: PointsInventory = [
      { currency: "Skywards Miles", balance: 1000, expiryDate: "2026-10-12" }, // asOf + 89 days
      { currency: "Etihad Guest Miles", balance: 1000, expiryDate: "2026-10-14" }, // asOf + 91 days
    ];
    const plan = burnPriority(inv, ASOF);
    const sky = plan.items.find((i) => i.currency === "Skywards Miles")!;
    const eti = plan.items.find((i) => i.currency === "Etihad Guest Miles")!;
    expect(sky.daysToExpiry).toBe(89);
    expect(sky.urgency).toBe("urgent");
    expect(eti.daysToExpiry).toBe(91);
    expect(eti.urgency).toBe("soon");
    expect(sky.expirySource).toBe("explicit");
  });

  it("flags an already-expired balance as urgent", () => {
    const inv: PointsInventory = [{ currency: "Skywards Miles", balance: 1000, expiryDate: "2026-06-01" }];
    const item = burnPriority(inv, ASOF).items[0]!;
    expect(item.urgency).toBe("urgent");
    expect(item.flags.join(" ")).toContain("already expired");
  });
});

describe("burnPriority — honest handling of missing expiry", () => {
  it("no explicit date and no known default => 'expiry unknown', no false urgency", () => {
    // FAB Rewards has no program-expiry default and no date here.
    const inv: PointsInventory = [{ currency: "FAB Rewards", balance: 1000 }];
    const item = burnPriority(inv, ASOF).items[0]!;
    expect(item.urgency).toBe("unknown");
    expect(item.expirySource).toBe("unknown");
    expect(item.flags.join(" ")).toContain("expiry unknown");
  });

  it("known program default but no earned date => surfaces the policy, still no urgency", () => {
    const inv: PointsInventory = [{ currency: "Etihad Guest Miles", balance: 1000 }];
    const item = burnPriority(inv, ASOF).items[0]!;
    expect(item.urgency).toBe("unknown");
    expect(item.flags.join(" ")).toContain("18 months");
    expect(item.flags.join(" ")).toContain("estimated from program policy");
  });

  it("known default + earned date => projects a flagged expiry and dates the urgency", () => {
    const inv: PointsInventory = [
      { currency: "Etihad Guest Miles", balance: 1000, earnedDate: "2025-06-01" }, // +18mo = 2026-12-01
    ];
    const item = burnPriority(inv, ASOF).items[0]!;
    expect(item.expirySource).toBe("projected_default");
    expect(item.expiryDate).toBe("2026-12-01");
    expect(item.urgency).toBe("soon"); // 139 days out
    expect(item.flags.join(" ")).toContain("projected");
  });
});

describe("burnPriority — devaluation warning", () => {
  it("flags the upcoming Skywards premium devaluation when asOf precedes it", () => {
    const inv: PointsInventory = [{ currency: "Skywards Miles", balance: 1000 }];
    const item = burnPriority(inv, "2026-03-01").items[0]!;
    expect(item.devaluationWarning).toContain("premium");
    expect(item.devaluationWarning).toContain("2026-05-20");
  });

  it("does not warn once the devaluation date has passed", () => {
    const inv: PointsInventory = [{ currency: "Skywards Miles", balance: 1000 }];
    const item = burnPriority(inv, "2026-07-15").items[0]!;
    expect(item.devaluationWarning).toBeUndefined();
  });
});

describe("burnPriority — ordering", () => {
  it("urgency dominates value-at-risk", () => {
    const inv: PointsInventory = [
      { currency: "Skywards Miles", balance: 10000, expiryDate: "2027-07-15" }, // later, VAR 550
      { currency: "Smiles Points", balance: 10000, expiryDate: "2026-08-01" }, // urgent, VAR 100
    ];
    const plan = burnPriority(inv, ASOF);
    expect(plan.items[0]!.currency).toBe("Smiles Points"); // urgent wins despite lower value
    expect(plan.items[0]!.urgency).toBe("urgent");
  });

  it("within the same urgency, higher value-at-risk comes first", () => {
    const inv: PointsInventory = [
      { currency: "Smiles Points", balance: 10000, expiryDate: "2026-08-01" }, // urgent, VAR 100
      { currency: "Skywards Miles", balance: 10000, expiryDate: "2026-08-01" }, // urgent, VAR 550
    ];
    const plan = burnPriority(inv, ASOF);
    expect(plan.items.map((i) => i.currency)).toEqual(["Skywards Miles", "Smiles Points"]);
  });

  it("ties broken by versatility — the least-flexible currency burns first", () => {
    // Both urgency unknown (no dates), both value-at-risk = 75 AED.
    // LuLu supports 1 class (voucher); Smiles supports 3 (voucher/external_bill/
    // partner_spend) -> LuLu is the more trapped currency, so it burns first.
    const inv: PointsInventory = [
      { currency: "Smiles Points", balance: 7500 }, // 7500 x 0.01 = 75, versatility 3
      { currency: "LuLu Points", balance: 10000 }, // 10000 x 0.0075 = 75, versatility 1
    ];
    const plan = burnPriority(inv, ASOF);
    expect(plan.items[0]!.valueAtRiskAed).toBeCloseTo(75, 10);
    expect(plan.items[1]!.valueAtRiskAed).toBeCloseTo(75, 10);
    expect(plan.items[0]!.currency).toBe("LuLu Points"); // lower versatility burns first
    expect(plan.items[0]!.versatility).toBe(1);
  });
});

describe("burnPriority — unknown currency", () => {
  it("does not crash and flags the placeholder value-at-risk", () => {
    const inv: PointsInventory = [{ currency: "Zorp Coins", balance: 1000 }];
    const plan = burnPriority(inv, ASOF);
    expect(plan.items[0]!.urgency).toBe("unknown");
    expect(plan.items[0]!.valueAtRiskAed).toBeCloseTo(7.5, 10); // 1000 x 0.0075 placeholder
    expect(plan.flags.join(" ")).toContain("unknown currency");
  });
});
