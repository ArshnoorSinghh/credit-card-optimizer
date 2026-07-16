import { describe, it, expect } from "vitest";
import { DEFAULT_VALUATIONS } from "./valuations";
import {
  REDEMPTION_VALUATIONS,
  resolveRedemptionProfile,
  withRedemptionValuations,
  primaryRoute,
  bestRouteAmongClasses,
  bestRoute,
  supportedClasses,
  isCashCapable,
  premiumFlightRoute,
  worstConfidence,
  deriveFlatValuationTable,
  reconcileWithFlat,
} from "./redemption-valuations";

// Convenience: find a route by its exact program name.
function r(currency: string, type: string) {
  return REDEMPTION_VALUATIONS[currency]!.routes.find((x) => x.type === type);
}

describe("REDEMPTION_VALUATIONS — sourced values", () => {
  it("Skywards: economy 0.037 high, mall trap 0.011 low, blended 0.028; premium is a multiplier, not a fixed number", () => {
    expect(r("Skywards Miles", "economy_flight")).toMatchObject({ aedPerUnit: 0.037, confidence: "high", class: "flight_economy" });
    expect(r("Skywards Miles", "mall_non_flight")).toMatchObject({ aedPerUnit: 0.011, confidence: "low" });
    expect(REDEMPTION_VALUATIONS["Skywards Miles"]!.blendedReference).toMatchObject({ aedPerUnit: 0.028, source: "WalletHub" });
    // No fixed premium/business route — premium is modeled as a user multiplier.
    expect(REDEMPTION_VALUATIONS["Skywards Miles"]!.routes.some((x) => x.class === "flight_premium")).toBe(false);
    expect(REDEMPTION_VALUATIONS["Skywards Miles"]!.premiumCabin).toBeDefined();
  });

  it("Etihad: economy 0.037 high, business 0.048 medium, shop/voucher 0.018 low; flight-activity expiry note", () => {
    expect(r("Etihad Guest Miles", "economy_flight")).toMatchObject({ aedPerUnit: 0.037, confidence: "high" });
    expect(r("Etihad Guest Miles", "business_flight")).toMatchObject({ aedPerUnit: 0.048, confidence: "medium", class: "flight_premium" });
    expect(r("Etihad Guest Miles", "shop_voucher")).toMatchObject({ aedPerUnit: 0.018, confidence: "low" });
    expect(REDEMPTION_VALUATIONS["Etihad Guest Miles"]!.note).toContain("flight activity");
  });

  it("TouchPoints: models merchant-tier variance (0.006 Max vs 0.004 voucher); primary instore_instant 0.005", () => {
    expect(r("TouchPoints (convertible to miles)", "touchpoints_max_partner")).toMatchObject({ aedPerUnit: 0.006, confidence: "high" });
    expect(r("TouchPoints (convertible to miles)", "voucher")).toMatchObject({ aedPerUnit: 0.004, confidence: "high" });
    expect(r("TouchPoints (convertible to miles)", "bill_payment")).toMatchObject({ aedPerUnit: 0.004348, class: "external_bill" });
    expect(REDEMPTION_VALUATIONS["TouchPoints (convertible to miles)"]!.primary).toBe("instore_instant");
    expect(primaryRoute("TouchPoints (convertible to miles)").aedPerUnit).toBe(0.005);
  });

  it("Smiles: every route at 0.01; note that cashback is not permitted", () => {
    expect(r("Smiles Points", "voucher")).toMatchObject({ aedPerUnit: 0.01, confidence: "high" });
    expect(REDEMPTION_VALUATIONS["Smiles Points"]!.note).toContain("cashback not permitted");
  });

  it("Plus Points: fixed_use 1.0 high, card_bill 0.75 high; primary is the realistic card-bill 0.75 (not the 1.0 fixed use)", () => {
    expect(r("Plus Points", "fixed_use")).toMatchObject({ aedPerUnit: 1.0, class: "fixed_use" });
    expect(r("Plus Points", "card_bill_cashback")).toMatchObject({ aedPerUnit: 0.75, class: "card_bill" });
    expect(primaryRoute("Plus Points").aedPerUnit).toBe(0.75);
  });

  it("FAB: card-bill 0.007 high with the sourced 0.004 conflict flagged", () => {
    expect(r("FAB Rewards", "cashback")).toMatchObject({ aedPerUnit: 0.007, confidence: "high", class: "card_bill" });
    expect(r("FAB Rewards", "cashback")!.note).toContain("0.004");
  });

  it("ADIB Exceed anchors everything to 1 pt = AED 2.00", () => {
    expect(primaryRoute("ADIB Exceed Points").aedPerUnit).toBe(2.0);
    expect(REDEMPTION_VALUATIONS["ADIB Exceed Points"]!.routes.every((x) => x.aedPerUnit === 2.0)).toBe(true);
  });

  it("Mashreq/Citi/StanChart primaries match the researched figures", () => {
    expect(primaryRoute("Salaam Points").aedPerUnit).toBe(0.00263); // Mashreq cashback
    expect(primaryRoute("ThankYou Points").aedPerUnit).toBe(0.03); // Citi pay-with-points
    expect(primaryRoute("360 Rewards Points").aedPerUnit).toBe(0.02); // StanChart cashback
  });

  it("low-confidence currencies are seeded at 0.0075 and flagged for verification", () => {
    for (const cur of ["HSBC Reward Points", "RAKrewards Points", "CBD Reward Points"]) {
      const p = primaryRoute(cur);
      expect(p.aedPerUnit).toBe(0.0075);
      expect(p.confidence).toBe("low");
      expect(p.note).toContain("verify");
    }
  });
});

describe("cash-capability is per-currency, not universal", () => {
  it("TouchPoints and Smiles expose NO card-bill route", () => {
    for (const cur of ["TouchPoints (convertible to miles)", "Smiles Points"]) {
      expect(isCashCapable(cur)).toBe(false);
      expect(bestRouteAmongClasses(cur, ["card_bill"])).toBeNull();
      expect(REDEMPTION_VALUATIONS[cur]!.routes.some((x) => x.class === "card_bill")).toBe(false);
    }
  });

  it("most bank currencies DO expose a card-bill route", () => {
    for (const cur of ["Plus Points", "FAB Rewards", "DIB Points", "Salaam Points", "ThankYou Points", "ADIB Exceed Points"]) {
      expect(isCashCapable(cur)).toBe(true);
      expect(bestRouteAmongClasses(cur, ["card_bill"])).not.toBeNull();
    }
  });

  it("miles are not cash-capable", () => {
    expect(isCashCapable("Skywards Miles")).toBe(false);
    expect(isCashCapable("Etihad Guest Miles")).toBe(false);
  });
});

describe("premiumFlightRoute", () => {
  it("materializes premium as economy × user multiplier, and only when a multiplier is supplied", () => {
    expect(premiumFlightRoute("Skywards Miles", undefined)).toBeUndefined();
    const prem = premiumFlightRoute("Skywards Miles", 2);
    expect(prem).toMatchObject({ class: "flight_premium", aedPerUnit: 0.074 }); // 0.037 × 2
    // Etihad has no premiumCabin marker (it uses a fixed business number instead).
    expect(premiumFlightRoute("Etihad Guest Miles", 2)).toBeUndefined();
  });
});

describe("resolveRedemptionProfile — unknown currency", () => {
  it("returns a loudly-flagged, non-cash placeholder instead of crashing", () => {
    const p = resolveRedemptionProfile("Imaginary Coins");
    expect(p.cashCapable).toBe(false);
    expect(p.routes[0]).toMatchObject({ aedPerUnit: 0.0075, confidence: "low" });
    expect(p.note).toContain("unknown currency");
  });
});

describe("withRedemptionValuations", () => {
  it("overrides one route by name without disturbing the rest", () => {
    const custom = withRedemptionValuations({
      "Skywards Miles": { routes: [{ type: "economy_flight", class: "flight_economy", aedPerUnit: 0.04, confidence: "high" }] },
    });
    expect(custom["Skywards Miles"]!.routes.find((x) => x.type === "economy_flight")!.aedPerUnit).toBe(0.04);
    // Other routes and other currencies untouched.
    expect(custom["Skywards Miles"]!.routes.find((x) => x.type === "mall_non_flight")!.aedPerUnit).toBe(0.011);
    expect(custom["Etihad Guest Miles"]).toEqual(REDEMPTION_VALUATIONS["Etihad Guest Miles"]);
  });
});

describe("helpers", () => {
  it("bestRoute picks the highest-value route across all classes", () => {
    expect(bestRoute("TouchPoints (convertible to miles)").aedPerUnit).toBe(0.006); // Max partner
  });

  it("supportedClasses counts distinct redemption classes (versatility)", () => {
    // TouchPoints: partner_spend, voucher, external_bill = 3 classes.
    expect(supportedClasses("TouchPoints (convertible to miles)").sort()).toEqual(["external_bill", "partner_spend", "voucher"]);
  });

  it("worstConfidence returns the weakest link", () => {
    expect(worstConfidence("high", "low", "medium")).toBe("low");
    expect(worstConfidence("high", "medium")).toBe("medium");
  });
});

describe("reconciliation with Engine 1's flat table", () => {
  it("derives Engine 1's value from each currency's primary route", () => {
    const flat = deriveFlatValuationTable();
    expect(flat["Smiles Points"]!.aedPerUnit).toBe(0.01);
    expect(flat["FAB Rewards"]!.aedPerUnit).toBe(0.007);
    expect(flat["Plus Points"]!.aedPerUnit).toBe(0.75);
    expect(flat["Smiles Points"]!.note).toContain("primary route: voucher");
  });

  it("agrees with Engine 1 now that the sourced primaries are adopted", () => {
    const rec = reconcileWithFlat(DEFAULT_VALUATIONS);
    const byCur = Object.fromEntries(rec.map((x) => [x.currency, x]));
    // Engine 1 adopted these in 2026-07, so the two engines now line up.
    for (const cur of [
      "Smiles Points",
      "FAB Rewards",
      "Skywards Miles",
      "Etihad Guest Miles",
      "TouchPoints (convertible to miles)",
      "ThankYou Points",
      "DIB Points",
      "Marriott Bonvoy Points",
    ]) {
      expect(byCur[cur]!.agrees).toBe(true);
    }
  });

  it("skips currencies Engine 1 no longer values (e.g. Salaam Points)", () => {
    // Engine 2 still carries the Mashreq research + transfer ratios, but no card
    // earns Salaam Points after the Amex cleanup, so Engine 1 dropped it. Reconcile
    // must simply skip it rather than report a phantom divergence.
    const byCur = Object.fromEntries(reconcileWithFlat(DEFAULT_VALUATIONS).map((x) => [x.currency, x]));
    expect(byCur["Salaam Points"]).toBeUndefined();
    expect(primaryRoute("Salaam Points").aedPerUnit).toBe(0.00263); // research retained
  });

  it("keeps Plus Points as the one deliberate divergence (held pending verification)", () => {
    // Engine 2 research says 0.75; Engine 1 deliberately holds 0.01 because adopting
    // 0.75 implies an implausible >75% return on enbd_visa_flexi. This divergence is
    // intentional and must stay visible until the earn rate is verified.
    const byCur = Object.fromEntries(reconcileWithFlat(DEFAULT_VALUATIONS).map((x) => [x.currency, x]));
    expect(byCur["Plus Points"]!.agrees).toBe(false);
    expect(byCur["Plus Points"]!.derived).toBe(0.75);
    expect(byCur["Plus Points"]!.flat).toBe(0.01);
  });
});
