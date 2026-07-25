import { describe, it, expect } from "vitest";
import { optimizePortfolio, type UserProfile } from "@fils/engine";
import { ALL_CARDS } from "./cards";
import { DEFAULT_SPEND } from "./optimizer";
import { runBaseline, annualDelta, MAX_HELD_CARDS } from "./baseline";

/*
  The baseline reuses the engine verbatim — these tests pin the app-layer
  composition (permissive eligibility, held-set selection, fail-soft) rather than
  the scoring math, which the engine's own suite owns.
*/

const LOW_SALARY: UserProfile = { monthlySalaryAed: 4000, uaeResident: true };

describe("runBaseline", () => {
  it("returns null when no cards are held", () => {
    expect(runBaseline([], DEFAULT_SPEND)).toBeNull();
  });

  it("returns null for ids not in the dataset", () => {
    expect(runBaseline(["not-a-real-card"], DEFAULT_SPEND)).toBeNull();
  });

  it("scores a single held card and reports its size", () => {
    const id = ALL_CARDS.find((c) => !c.excluded_from_scoring)!.id;
    const p = runBaseline([id], DEFAULT_SPEND);
    expect(p).not.toBeNull();
    expect(p!.cardIds).toEqual([id]);
    expect(p!.size).toBe(1);
  });

  it("scores held cards even when the user wouldn't be eligible under a real salary", () => {
    // A card gated behind a high salary should still score in the baseline,
    // because the user already holds it. Pick the highest-salary eligible card.
    const gated = [...ALL_CARDS]
      .filter((c) => !c.excluded_from_scoring)
      .sort((a, b) => b.eligibility.min_monthly_salary_aed - a.eligibility.min_monthly_salary_aed)[0]!;

    // Sanity: a normal run at a low salary would exclude it.
    const normal = optimizePortfolio(DEFAULT_SPEND, LOW_SALARY, [gated]);
    expect(normal.best1).toBeNull();

    // The baseline still scores it.
    const p = runBaseline([gated.id], DEFAULT_SPEND, LOW_SALARY);
    expect(p).not.toBeNull();
    expect(p!.cardIds).toEqual([gated.id]);
  });

  it("caps the held set at MAX_HELD_CARDS", () => {
    const ids = ALL_CARDS.filter((c) => !c.excluded_from_scoring)
      .slice(0, MAX_HELD_CARDS + 2)
      .map((c) => c.id);
    const p = runBaseline(ids, DEFAULT_SPEND);
    expect(p).not.toBeNull();
    expect(p!.size).toBeLessThanOrEqual(MAX_HELD_CARDS);
  });
});

describe("annualDelta", () => {
  it("is the positive difference when the optimum beats the baseline", () => {
    expect(annualDelta(5000, 3000)).toBe(2000);
  });

  it("clamps to zero when the baseline already meets the optimum", () => {
    expect(annualDelta(3000, 3200)).toBe(0);
  });

  it("is zero when there is no baseline", () => {
    expect(annualDelta(5000, null)).toBe(0);
    expect(annualDelta(5000, undefined)).toBe(0);
  });
});
