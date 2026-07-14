import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import { DEFAULT_VALUATIONS, withValuations, resolveValuation } from "./valuations";

describe("DEFAULT_VALUATIONS", () => {
  // The build-failing cross-check: every reward currency in cards.json must have
  // a valuation entry. A new card with a new currency breaks this test until
  // someone assigns a value (rather than the scorer silently valuing it at 0).
  it("has an entry for every currency in cards.json", () => {
    const currencies = new Set(cardsData.map((c) => c.rewards.currency));
    const missing = [...currencies].filter((cur) => !(cur in DEFAULT_VALUATIONS));
    expect(missing).toEqual([]);
  });

  it("values cashback at face value", () => {
    expect(DEFAULT_VALUATIONS["AED"]).toMatchObject({ aedPerUnit: 1.0, confidence: "high" });
  });

  it("flags the currencies that aren't in the researched set", () => {
    // Only the user-customizable multi-program currency remains genuinely
    // unresearched; Nol and ThankYou have since been given researched values.
    expect(DEFAULT_VALUATIONS["Multiple programs (customizable)"]?.note).toContain("NOT researched");
  });

  it("values Nol fare credit at face value (medium confidence)", () => {
    expect(DEFAULT_VALUATIONS["AED (Nol points)"]).toMatchObject({ aedPerUnit: 1.0, confidence: "medium" });
  });

  it("prices ThankYou Points at the realistic mid-range floor (medium confidence)", () => {
    expect(DEFAULT_VALUATIONS["ThankYou Points"]).toMatchObject({ aedPerUnit: 0.05, confidence: "medium" });
  });

  it("treats the Salaam-convertible cashback currency at face value", () => {
    // Functionally cashback (type cashback, percent rates, AED caps), unlike the
    // pure-points "Salaam Points" currency which stays at its low placeholder.
    expect(DEFAULT_VALUATIONS["AED (Salaam Points convertible)"]).toMatchObject({ aedPerUnit: 1.0 });
    expect(DEFAULT_VALUATIONS["Salaam Points"]).toMatchObject({ aedPerUnit: 0.0075 });
  });

  it("keeps Booking.com credit as a flagged 0.85 placeholder pending re-verification", () => {
    const booking = DEFAULT_VALUATIONS["AED (Booking.com credit)"];
    expect(booking).toMatchObject({ aedPerUnit: 0.85, confidence: "low" });
    expect(booking?.note).toContain("re-verification");
  });
});

describe("withValuations", () => {
  it("overrides one currency without disturbing the rest", () => {
    const custom = withValuations({ "Skywards Miles": { aedPerUnit: 0.05, confidence: "high" } });
    expect(custom["Skywards Miles"]?.aedPerUnit).toBe(0.05);
    expect(custom["Etihad Guest Miles"]).toEqual(DEFAULT_VALUATIONS["Etihad Guest Miles"]);
  });
});

describe("resolveValuation", () => {
  it("returns a flagged 0-value entry for an unknown currency instead of throwing", () => {
    const v = resolveValuation("Imaginary Coins", {});
    expect(v.aedPerUnit).toBe(0);
    expect(v.note).toContain("No valuation");
  });
});
