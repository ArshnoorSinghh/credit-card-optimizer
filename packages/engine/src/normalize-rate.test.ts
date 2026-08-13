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

  it("does not lower confidence for a phrase that only names the reward currency", () => {
    // "back in UPoints" restates rewards.currency; it is not a condition on earning,
    // so the rate stays a clean tier-1 parse.
    expect(normalizeRate("6.25% back in UPoints", { rewardCurrency: "UPoints" })).toMatchObject({
      value: 0.0625,
      unit: "percent",
      confidence: "high",
    });
    // "back as X" is the same construction, and the label need only name the currency
    // — dib_shams_infinite writes "Wala'a Rewards" where its currency is "DIB Wala'a Rewards".
    expect(
      normalizeRate("5% back as Wala’a Rewards", { rewardCurrency: "DIB Wala’a Rewards" }),
    ).toMatchObject({ value: 0.05, unit: "percent", confidence: "high" });
  });

  it("ignores a parenthetical that only defines the currency's exchange rate", () => {
    expect(
      normalizeRate("1.5% back in Plus Points on general eligible spend (1 Plus Point = AED 1)", {
        rewardCurrency: "Plus Points",
      }),
    ).toMatchObject({ value: 0.015, unit: "percent", confidence: "high" });
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

  it("still flags 'back in X' when X is NOT this card's reward currency", () => {
    // The exemption is narrow: it only covers a phrase that names the card's OWN
    // payout currency. Anything else is a real scope and must keep flagging low —
    // otherwise the exemption would launder arbitrary conditions into tier 1.
    expect(normalizeRate("5% back in Skywards Miles", { rewardCurrency: "Plus Points" })).toMatchObject({
      confidence: "low",
    });
    // ...and with no currency context at all, the conservative old behaviour holds.
    expect(normalizeRate("5% back in Plus Points")).toMatchObject({ confidence: "low" });
  });

  it("keeps flagging a parenthetical that states a real condition", () => {
    // Only "<N> <currency> = AED <M>" definitions are exempt. An enumeration of
    // categories, or a promotional qualifier, still marks the rate as scoped.
    expect(
      normalizeRate(
        "0.15% on select low-interchange categories (utilities, government, education)",
      ),
    ).toMatchObject({ confidence: "low" });
    expect(
      normalizeRate("0.3 AirRewards Points per AED 1 on eligible local spend (1.5 points per AED 5)"),
    ).toMatchObject({ confidence: "low" });
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

  it("bounds 'up to X%' as 0..X EVEN WHEN a cap models the constraint", () => {
    // Regression lock for the rate-ceiling selection bias. This used to return
    // { value: 0.05, confidence: "high" } on the reasoning that the cap expresses
    // the constraint — sound per card, but unsound once optimizePortfolio picks the
    // best of ~53 cards on these numbers, which makes the winner a maximum-of-maxima.
    // The ceiling must stay a range so the uncertainty reaches the ranking.
    const r = normalizeRate("Up to 5%", { monthlyCap: 200 });
    expect(r).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
    // The cap context still shapes the explanation, so the review list can tell the
    // two cases apart even though they now share a tier.
    expect(r.note).toContain("cap bounds the payout");
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
    // Mirrors score-card.ts's buildEarnOptions exactly (caps + reward currency), so
    // the tiers counted here are the tiers the scorer actually sees.
    const base = normalizeRate(card.rewards.base_rate, { rewardCurrency: card.rewards.currency });
    rows.push({ tier: rateTier(base), rate: base, where: `${card.id} base_rate` });
    for (const cat of card.rewards.categories) {
      const r = normalizeRate(cat.rate, {
        monthlyCap: cat.monthly_cap,
        annualCap: cat.annual_cap,
        rewardCurrency: card.rewards.currency,
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
    // Locked to the 2026-08 rate-ceiling-bias pass (53 cards, 197 rate strings).
    // Update deliberately if the data changes — a diff here means a rate changed tier.
    //   tier 1 (clean/high):  139
    //   tier 2 (verify/low):   29  — scoped/conditional rates that parse to a number
    //   tier 3 (unresolved):   29  — unpublished rates, threshold/quarter lump bonuses,
    //                                "up to" ceilings, and the DIB Prime "0 Wala'a" EEA line
    //
    // How this moved from the previous 126 / 46 / 21 over 193 strings:
    //   -8 t1 / +8 t3  the 8 capped "Up to X%" rates (rakbank_titanium x4,
    //                  rakbank_world x4) now bound as 0..X instead of resolving to
    //                  their ceiling — the rate-ceiling selection-bias fix.
    //  +11 t1 / -11 t2 two normalizer false positives retired: a phrase naming the
    //                  card's own reward currency ("back in UPoints") and a
    //                  parenthetical defining it ("(10 UPoints = AED 1)") are no
    //                  longer read as unmodelled scopes.
    //  +10 t1 / -6 t2  six compound "X/AED local; Y/AED international" base rates
    //                  split or de-compounded (+4 new international_spend strings,
    //                  which is why the total rises 193 -> 197).
    expect(byTier(1).length).toBe(139);
    expect(byTier(2).length).toBe(29);
    expect(byTier(3).length).toBe(29);
    expect(rows.length).toBe(197);
  });

  it("never assigns a numeric value to a tier-3 rate", () => {
    for (const r of byTier(3)) {
      expect(r.rate.value).toBeNull();
    }
  });
});
