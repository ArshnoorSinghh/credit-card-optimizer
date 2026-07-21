import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import { normalizeRate, rateTier, type NormalizedRate } from "./normalize-rate";

// The engine tsconfig has no DOM/Node libs (types: []). Declare just the console
// surface the sweep uses so this stays type-clean without pulling in @types/node.
declare const console: { log(...args: unknown[]): void };

describe("normalizeRate — tier 1 (clean, high confidence)", () => {
  it("parses percent cashback", () => {
    expect(normalizeRate("5%")).toMatchObject({
      value: 0.05,
      unit: "percent",
      confidence: "high",
    });
    expect(normalizeRate("1.5%")).toMatchObject({ value: 0.015, unit: "percent" });
  });

  it("treats an all-spend scope as a clean blanket rate", () => {
    expect(normalizeRate("1% on all spend")).toMatchObject({
      value: 0.01,
      unit: "percent",
      confidence: "high",
    });
  });

  it("parses points-per-AED, including branded TouchPoints", () => {
    expect(normalizeRate("3 points per AED 1")).toMatchObject({
      value: 3,
      unit: "points_per_aed",
      confidence: "high",
    });
    expect(normalizeRate("2 TouchPoints per AED 1")).toMatchObject({
      value: 2,
      unit: "points_per_aed",
      confidence: "high",
    });
  });

  it("keeps miles-per-USD and miles-per-AED as distinct units", () => {
    expect(normalizeRate("1.5 miles per USD 1")).toMatchObject({
      value: 1.5,
      unit: "miles_per_usd",
      confidence: "high",
    });
    expect(normalizeRate("1 mile per AED 1")).toMatchObject({
      value: 1,
      unit: "miles_per_aed",
      confidence: "high",
    });
  });

  it("strips a trailing FX annotation without lowering confidence", () => {
    expect(normalizeRate("1 mile per USD 1 (approx AED 3.67)")).toMatchObject({
      value: 1,
      unit: "miles_per_usd",
      confidence: "high",
    });
  });

  it("parses 'up to X%' as X% when a cap models the constraint", () => {
    expect(normalizeRate("Up to 5%", { monthlyCap: 200 })).toMatchObject({
      value: 0.05,
      unit: "percent",
      confidence: "high",
    });
  });
});

describe("normalizeRate — tier 2 (parses but condition missing, low confidence)", () => {
  it("flags a merchant-scoped base rate", () => {
    const r = normalizeRate("10% on Emaar purchases");
    expect(r).toMatchObject({ value: 0.1, unit: "percent", confidence: "low" });
    expect(r.note).toBeTruthy();
  });

  it("flags another scoped base rate", () => {
    expect(normalizeRate("5% on dnata travel")).toMatchObject({
      value: 0.05,
      unit: "percent",
      confidence: "low",
    });
  });
});

describe("normalizeRate — tier 3 (unresolvable, unknown confidence)", () => {
  it("bounds 'up to X%' as 0..X when no cap models it", () => {
    const r = normalizeRate("Up to 5%"); // no context => no cap
    expect(r).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
  });

  it("emits an unbounded range for explicitly variable rates", () => {
    expect(normalizeRate("Variable")).toMatchObject({
      value: null,
      confidence: "unknown",
      range: { min: 0, max: null },
    });
    expect(normalizeRate("Customizable based on chosen category")).toMatchObject({
      value: null,
      confidence: "unknown",
      range: { min: 0, max: null },
    });
  });

  it("routes an unrecognized string to tier 3 loudly, never guessing a number", () => {
    const r = normalizeRate("some rate we've never seen");
    expect(r.value).toBeNull();
    expect(r.confidence).toBe("unknown");
    expect(r.note).toContain("Unrecognized");
  });
});

/**
 * Full-dataset sweep. Runs the real normalizer over every rate string in
 * cards.json, tallies the tiers, and prints every tier-2/3 string for human
 * review. The assertions lock in today's counts so a regression (or a new card
 * with a novel string) shows up as a failed test, not a silent reclassification.
 */
describe("normalizeRate — cards.json sweep", () => {
  interface Row {
    tier: 1 | 2 | 3;
    rate: NormalizedRate;
    where: string;
  }

  const rows: Row[] = [];
  for (const card of cardsData) {
    const base = normalizeRate(card.rewards.base_rate);
    rows.push({ tier: rateTier(base), rate: base, where: `${card.id} base_rate` });
    for (const cat of card.rewards.categories) {
      const r = normalizeRate(cat.rate, {
        monthlyCap: cat.monthly_cap,
        annualCap: cat.annual_cap,
      });
      rows.push({ tier: rateTier(r), rate: r, where: `${card.id} ${cat.category}` });
    }
  }

  const byTier = (t: 1 | 2 | 3) => rows.filter((r) => r.tier === t);

  it("prints a tier summary and the tier-2/3 review list", () => {
    const counts = { 1: byTier(1).length, 2: byTier(2).length, 3: byTier(3).length };
    // eslint-disable-next-line no-console
    console.log(
      `\nRate normalizer sweep over ${rows.length} strings:\n` +
        `  tier 1 (clean/high):    ${counts[1]}\n` +
        `  tier 2 (verify/low):    ${counts[2]}\n` +
        `  tier 3 (unresolved):    ${counts[3]}\n` +
        `\n  --- TIER 2 (parses, condition missing) ---\n` +
        byTier(2)
          .map((r) => `  [${r.where}] "${r.rate.raw}" -> ${r.rate.note}`)
          .join("\n") +
        `\n\n  --- TIER 3 (unresolved) ---\n` +
        byTier(3)
          .map((r) => `  [${r.where}] "${r.rate.raw}" -> ${r.rate.note}`)
          .join("\n") +
        "\n",
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("matches the reviewed tier counts", () => {
    // Locked to the 2026-07 hand-verified dataset (53 cards, 193 rate strings), after
    // the normalizer was extended for branded currencies ("5 FAB Rewards per AED 1"),
    // per-AED-N denominators ("3.5 miles per AED 10") and bounded "up to" ceilings.
    // Update deliberately if the data changes — a diff here means a rate changed tier.
    //   tier 1 (clean/high):  126
    //   tier 2 (verify/low):   46  — scoped/conditional rates that parse to a number
    //   tier 3 (unresolved):   21  — unpublished rates, threshold/quarter lump bonuses,
    //                                "up to" ceilings, and the DIB Prime "0 Wala'a" EEA line
    expect(byTier(1).length).toBe(126);
    expect(byTier(2).length).toBe(46);
    expect(byTier(3).length).toBe(21);
  });

  it("never assigns a numeric value to a tier-3 rate", () => {
    for (const r of byTier(3)) {
      expect(r.rate.value).toBeNull();
    }
  });
});
