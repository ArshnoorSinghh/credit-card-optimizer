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
    for (const cur of ["AED (Nol points)", "ThankYou Points", "Multiple programs (customizable)"]) {
      expect(DEFAULT_VALUATIONS[cur]?.note).toContain("NOT researched");
    }
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
