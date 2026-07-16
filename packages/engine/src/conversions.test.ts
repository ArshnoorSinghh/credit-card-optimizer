import { describe, it, expect } from "vitest";
import { CONVERSIONS, CONVERSION_FINDING, conversionsFrom, evaluateConversion, type Conversion } from "./conversions";

describe("CONVERSIONS table", () => {
  it("encodes TouchPoints, Mashreq, and DIB ratios in one editable place", () => {
    const find = (from: string, to: string) => CONVERSIONS.find((c) => c.from === from && c.to === to)?.ratio;
    expect(find("TouchPoints (convertible to miles)", "Skywards Miles")).toBe(22);
    expect(find("TouchPoints (convertible to miles)", "Etihad Guest Miles")).toBe(14);
    expect(find("Salaam Points", "Skywards Miles")).toBe(32);
    expect(find("Salaam Points", "Etihad Guest Miles")).toBe(22);
    expect(find("DIB Points", "Etihad Guest Miles")).toBe(20);
  });

  it("documents that the ratios drift over time", () => {
    expect(conversionsFrom("TouchPoints (convertible to miles)").find((c) => c.to === "Skywards Miles")?.note).toContain("18:1");
  });
});

describe("the general finding: at baseline economy value, direct beats conversion", () => {
  const ECONOMY = 0.037;

  it("TouchPoints — direct partner spend (0.006) beats converting to Etihad economy", () => {
    const conv = CONVERSIONS.find((c) => c.from === "TouchPoints (convertible to miles)" && c.to === "Etihad Guest Miles")!;
    const o = evaluateConversion(14000, conv, 0.006, ECONOMY);
    expect(o.resultingUnits).toBe(1000);
    expect(o.worthwhile).toBe(false); // 84 direct vs 37 converted
    expect(o.breakEvenDestAedPerUnit).toBeCloseTo(0.084, 10); // 0.006 × 14
  });

  it("Mashreq — direct (0.00347) beats converting to Etihad economy", () => {
    const conv = CONVERSIONS.find((c) => c.from === "Salaam Points" && c.to === "Etihad Guest Miles")!;
    const o = evaluateConversion(22000, conv, 0.00347, ECONOMY);
    expect(o.worthwhile).toBe(false);
    expect(o.breakEvenDestAedPerUnit).toBeCloseTo(0.07634, 10); // 0.00347 × 22
  });

  it("DIB — direct (0.005) beats converting to Etihad economy", () => {
    const conv = CONVERSIONS.find((c) => c.from === "DIB Points" && c.to === "Etihad Guest Miles")!;
    const o = evaluateConversion(20000, conv, 0.005, ECONOMY);
    expect(o.worthwhile).toBe(false);
    expect(o.breakEvenDestAedPerUnit).toBeCloseTo(0.1, 10); // 0.005 × 20
  });

  it("CONVERSION_FINDING states the rule for the recommender/UI", () => {
    expect(CONVERSION_FINDING).toContain("premium");
  });
});

describe("conversion wins only above the premium break-even", () => {
  it("TouchPoints → Etihad turns worthwhile once the redeemed mile clears 0.084", () => {
    const conv = CONVERSIONS.find((c) => c.from === "TouchPoints (convertible to miles)" && c.to === "Etihad Guest Miles")!;
    // A premium-cabin redemption worth 0.10/mile (above the 0.084 break-even).
    const o = evaluateConversion(14000, conv, 0.006, 0.1);
    expect(o.convertedAed).toBeCloseTo(100, 10); // 1000 × 0.10
    expect(o.directAed).toBeCloseTo(84, 10);
    expect(o.worthwhile).toBe(true);
    expect(o.deltaAed).toBeCloseTo(16, 10);
  });

  it("floors fractional conversions", () => {
    const conv: Conversion = { from: "A", to: "B", ratio: 14, confidence: "high" };
    expect(evaluateConversion(22000, conv, 0.005, 0.037).resultingUnits).toBe(1571);
  });
});
