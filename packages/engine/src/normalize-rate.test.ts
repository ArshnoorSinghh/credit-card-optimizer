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

});

describe("normalizeRate — 'up to X%' is a ceiling, capped or not", () => {
  /*
    This pair used to assert opposite things: a CAPPED "up to X%" was tier 1 at X,
    an UNCAPPED one was tier 3 bounded 0..X. The fork was removed — see the long
    comment in normalize-rate.ts. Scoring every capped ceiling AT the ceiling made
    optimizePortfolio, which SELECTS on that rate, return a maximum-of-maxima.
  */
  it("bounds a CAPPED ceiling 0..X rather than asserting X", () => {
    const r = normalizeRate("Up to 5%", { monthlyCap: 200 });
    expect(r).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
    // The note must distinguish it from the uncapped case — different review task.
    expect(r.note).toContain("cap bounds the AED outcome");
  });

  it("bounds an UNCAPPED ceiling 0..X the same way", () => {
    expect(normalizeRate("Up to 5%")).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
  });
});

describe("normalizeRate — naming the reward currency is not a condition", () => {
  /*
    "6.25% back in UPoints" is exactly as certain as "6.25%": the trailing text
    names the currency, which rewards.currency already carries and valuations.ts
    already prices. Treating it as a scope cost ~10 clean rate strings a tier.
  */
  it.each([
    "6.25% back in UPoints",
    "5% back as Wala’a Rewards",
    "1.5% back in Plus Points on general eligible spend (1 Plus Point = AED 1)",
    "1.25% back as talabat credit on other eligible retail purchases",
  ])("keeps %s at high confidence", (raw) => {
    expect(normalizeRate(raw).confidence).toBe("high");
  });

  it("still flags a REAL scope hiding behind the currency name", () => {
    // "non-Emaar" is a genuine condition the structured data does not model, so
    // stripping "back in UPoints" must not rescue this one.
    expect(
      normalizeRate("1.25% back in UPoints on eligible non-Emaar spend (10 UPoints = AED 1)")
        .confidence,
    ).toBe("low");
  });

  it("still flags a rate carrying a cap condition in prose", () => {
    expect(
      normalizeRate(
        "1.5% back in dnata Points on eligible domestic and international spend, capped at 3,000 dnata Points per statement cycle",
      ).confidence,
    ).toBe("low");
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
    //   tier 1 (clean/high):  129
    //   tier 2 (verify/low):   35  — scoped/conditional rates that parse to a number
    //   tier 3 (unresolved):   29  — unpublished rates, threshold/quarter lump bonuses,
    //                                "up to" ceilings, and the DIB Prime "0 Wala'a" EEA line
    //
    // 2026-08-04, two changes in sequence. Both are recorded because the net
    // (126 -> 129 tier 1) hides that they move in OPPOSITE directions:
    //
    //   126/46/21 -> 118/46/29  EXACTLY 8 strings tier 1 -> tier 3, all capped
    //     "Up to X%" ceilings (rakbank_world, rakbank_titanium et al) that the
    //     normalizer used to score AT the ceiling because a cap was modeled. That
    //     fork was removed — a ceiling is bounded 0..X capped or not. Section D5.
    //   118/46/29 -> 129/35/29  EXACTLY 11 strings tier 2 -> tier 1, all of them
    //     "N% back in <Currency>" / "back as <Currency>" forms whose only "scope"
    //     named the reward currency. Tier 3 is UNCHANGED, which is the check that
    //     this second fix touched nothing the first one did. Section D8.
    expect(byTier(1).length).toBe(129);
    expect(byTier(2).length).toBe(35);
    expect(byTier(3).length).toBe(29);
  });

  it("never assigns a numeric value to a tier-3 rate", () => {
    for (const r of byTier(3)) {
      expect(r.rate.value).toBeNull();
    }
  });
});
