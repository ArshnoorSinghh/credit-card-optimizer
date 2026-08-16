import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card, RewardType } from "./card";
import { scoreCard, type SpendingProfile } from "./score-card";
import { normalizeRate } from "./normalize-rate";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";

const realCards = cardsData as Card[];

// A resident earning enough to pass most eligibility gates (used by synthetic cases,
// where the synthetic cards themselves set no requirements).
const OPEN_PROFILE: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };

/**
 * Minimal synthetic-card factory. Defaults make an AED cashback card (valuation
 * 1.0, high confidence) with no fee, no eligibility gates — so hand math stays
 * transparent: a percent rate on cashback is AED returned directly, and unit caps
 * are AED caps. Callers override only what a case needs.
 */
function mkCard(
  id: string,
  overrides: {
    categories?: { category: string; rate: string; monthly_cap?: number | null; annual_cap?: number | null }[];
    base_rate?: string;
    annual_fee?: number;
    waiver?: string | null;
    min_salary?: number;
    resident_required?: boolean;
    salary_transfer?: boolean;
    currency?: string;
    type?: RewardType;
  } = {},
): Card {
  return {
    id,
    name: id,
    bank: "TestBank",
    network: "TestNet",
    tier: "Test",
    eligibility: {
      min_monthly_salary_aed: overrides.min_salary ?? 0,
      uae_resident_required: overrides.resident_required ?? false,
      min_age: 0,
      salary_transfer_required: overrides.salary_transfer ?? false,
      employer_restrictions: null,
    },
    fees: {
      annual_fee_aed: overrides.annual_fee ?? 0,
      waiver_conditions: overrides.waiver ?? null,
      joining_fee_aed: 0,
    },
    rewards: {
      type: overrides.type ?? "cashback",
      currency: overrides.currency ?? "AED",
      base_rate: overrides.base_rate ?? "0% on all spend",
      categories: (overrides.categories ?? []).map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthly_cap ?? null,
        annual_cap: c.annual_cap ?? null,
      })),
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: overrides.currency ?? "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };
}

/**
 * Case 1 — complementary beats individually-stronger overlap.
 *   X: groceries 10% (nothing else).   Y: dining 10% (nothing else).
 *   Z: groceries 6% + dining 6% (the strongest SINGLE card).
 *   Spend: groceries 1000, dining 1000 (AED/mo).
 *
 * Best 1-card = Z: 6% on both = 60 + 60 = 120/mo = 1440/yr.
 * Best 2-card = {X,Y}: 10% + 10% = 100 + 100 = 200/mo = 2400/yr — the complementary
 * pair beats any pair containing Z, and beats Z alone.
 */
describe("optimizePortfolio — complementary pair beats the strongest single card", () => {
  const cards = [
    mkCard("X", { categories: [{ category: "groceries", rate: "10%" }] }),
    mkCard("Y", { categories: [{ category: "dining", rate: "10%" }] }),
    mkCard("Z", { categories: [{ category: "groceries", rate: "6%" }, { category: "dining", rate: "6%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("picks Z as the best single card (1440/yr)", () => {
    expect(result.best1?.cardIds).toEqual(["Z"]);
    expect(result.best1?.netAnnualValue).toBe(1440);
    expect(result.best1?.grossAnnualValue).toEqual({ min: 1440, max: 1440 });
    expect(result.best1?.uncertain).toBe(false);
  });

  it("picks the complementary {X,Y} pair as the best two-card (2400/yr)", () => {
    expect(result.best2?.cardIds).toEqual(["X", "Y"]);
    expect(result.best2?.grossAnnualValue).toEqual({ min: 2400, max: 2400 });
    expect(result.best2?.netAnnualValue).toBe(2400);
  });

  it("assigns each category to the 10% card in the winning pair", () => {
    const alloc = result.best2!.allocations;
    const g = alloc.find((a) => a.spendCategory === "groceries");
    const d = alloc.find((a) => a.spendCategory === "dining");
    expect(g).toMatchObject({ cardId: "X", cardCategory: "groceries", monthlySpendAed: 1000 });
    expect(g?.annualValueAed).toEqual({ min: 1200, max: 1200 });
    expect(d).toMatchObject({ cardId: "Y", cardCategory: "dining", monthlySpendAed: 1000 });
  });

  it("recommends the 2-card pair overall; the 3rd card (Z) only ties, so fewer cards wins", () => {
    // {X,Y,Z} also earns 2400 (Z goes unused), so overallBest prefers the 2-card set.
    expect(result.best3?.grossAnnualValue.min).toBe(2400);
    expect(result.overallBest?.cardIds).toEqual(["X", "Y"]);
  });
});

/**
 * Case 2 — ADVERSARIAL: naive per-category greedy gives the wrong answer.
 *   A: groceries_dining 10%, monthly_cap 100 AED reward  (so cap binds at 1000 AED/mo spend).
 *   B: dining 8% (dining only).
 *   Spend: groceries 1000, dining 1000.
 *
 * Naive greedy routes BOTH categories to A's 10% option (it's each category's best
 * rate). Their combined 2000 AED/mo hits A's 100 AED cap; overflow is dropped →
 * only ~1200/yr.
 * The exact optimum instead reserves A entirely for groceries (fills the cap for
 * 1200/yr) and sends dining to B's 8% (960/yr) → 2160/yr. We assert the optimum.
 */
describe("optimizePortfolio — exact assignment beats greedy under a binding cap", () => {
  const cards = [
    mkCard("A", { categories: [{ category: "groceries_dining", rate: "10%", monthly_cap: 100 }] }),
    mkCard("B", { categories: [{ category: "dining", rate: "8%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("returns the hand-computed optimum (2160/yr), not the greedy 1200/yr", () => {
    expect(result.best2?.grossAnnualValue).toEqual({ min: 2160, max: 2160 });
  });

  it("reserves the capped 10% card for groceries and routes dining to the 8% card", () => {
    const alloc = result.best2!.allocations;
    const g = alloc.find((a) => a.spendCategory === "groceries");
    const d = alloc.find((a) => a.spendCategory === "dining");
    expect(g).toMatchObject({ cardId: "A", cardCategory: "groceries_dining", capBound: "monthly" });
    expect(g?.annualValueAed).toEqual({ min: 1200, max: 1200 });
    expect(d).toMatchObject({ cardId: "B", cardCategory: "dining" });
    expect(d?.annualValueAed).toEqual({ min: 960, max: 960 });
  });
});

/**
 * Case 3 — cap overflow routes to the next-best card (spend never vanishes).
 *   A: groceries 10%, monthly_cap 100 AED  (cap binds at 1000 AED/mo spend).
 *   B: groceries 5% (uncapped).
 *   Spend: groceries 1500/mo.
 *
 * A absorbs 1000 (→ 1200/yr, cap bound); the 500 overflow flows to B at 5%
 * (→ 300/yr). Total 1500/yr.
 */
describe("optimizePortfolio — cap overflow reroutes to the next-best card", () => {
  const cards = [
    mkCard("A", { categories: [{ category: "groceries", rate: "10%", monthly_cap: 100 }] }),
    mkCard("B", { categories: [{ category: "groceries", rate: "5%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1500 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("splits groceries across both cards and matches hand math (1500/yr)", () => {
    expect(result.best2?.grossAnnualValue).toEqual({ min: 1500, max: 1500 });
    const alloc = result.best2!.allocations.filter((a) => a.spendCategory === "groceries");
    const onA = alloc.find((a) => a.cardId === "A");
    const onB = alloc.find((a) => a.cardId === "B");
    expect(onA).toMatchObject({ monthlySpendAed: 1000, capBound: "monthly" });
    expect(onA?.annualValueAed).toEqual({ min: 1200, max: 1200 });
    expect(onB).toMatchObject({ monthlySpendAed: 500 });
    expect(onB?.annualValueAed).toEqual({ min: 300, max: 300 });
  });

  it("flags the bound cap and the overflow reroute", () => {
    expect(result.best2?.flags.some((f) => /cap reached.*overflow routed/i.test(f.message))).toBe(true);
  });
});

/**
 * Regression: a card with TWO reward sub-categories that map to the same canonical
 * category (cinemas + video_streaming → entertainment) must produce ONE allocation
 * row for that (category, card), not two. The flow fills both caps (two slices);
 * the receipt merges them so the results page doesn't render "Entertainment" twice.
 *   cinemas 5% cap AED 100/mo -> 2000 AED/mo productive -> 1200/yr
 *   video_streaming 5% cap AED 100/mo -> 2000 AED/mo productive -> 1200/yr
 *   entertainment 4000/mo fills both -> ONE row: 4000/mo spend, 2400/yr value.
 */
describe("optimizePortfolio — merges same-category slices on one card into a single row", () => {
  const card = mkCard("E", {
    categories: [
      { category: "cinemas", rate: "5%", monthly_cap: 100 },
      { category: "video_streaming", rate: "5%", monthly_cap: 100 },
    ],
  });
  const result = optimizePortfolio({ entertainment: 4000 }, OPEN_PROFILE, [card], undefined, {
    maxCards: 1,
  });

  it("shows entertainment ONCE for the card, with spend and value summed", () => {
    const ent = result.best1!.allocations.filter((a) => a.spendCategory === "entertainment");
    expect(ent).toHaveLength(1);
    expect(ent[0]).toMatchObject({ cardId: "E", monthlySpendAed: 4000 });
    expect(ent[0]!.annualValueAed).toEqual({ min: 2400, max: 2400 });
  });
});

/**
 * Case 4 — a high-fee card wins gross but loses net; the optimizer picks the
 * cheaper portfolio.
 *   H: groceries 12%, annual fee 5000 (no waiver).  L: groceries 5%, no fee.
 *   Spend: groceries 1000/mo.
 *
 * H gross = 1440/yr but net = 1440 − 5000 = −3560. L gross = 5% × 1000 × 12 = 600/yr, net = 600.
 */
describe("optimizePortfolio — nets out fees, not just gross rewards", () => {
  const cards = [
    mkCard("H", { categories: [{ category: "groceries", rate: "12%" }], annual_fee: 5000 }),
    mkCard("L", { categories: [{ category: "groceries", rate: "5%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  it("prefers the cheaper card despite the pricier card's higher gross", () => {
    expect(result.best1?.cardIds).toEqual(["L"]);
    expect(result.best1?.netAnnualValue).toBe(600);
    expect(result.overallBest?.cardIds).toEqual(["L"]);
  });

  it("still reports the high-fee card's negative net when it's the only 2-card option", () => {
    expect(result.best2?.cardIds).toEqual(["H", "L"]);
    expect(result.best2?.netAnnualValue).toBe(-3560); // 1440 gross − 5000 fee
  });
});

/**
 * Case 5 — eligibility filter drops cards the user can't get.
 *   P: min salary 25000.   R: min salary 5000.   User earns 10000.
 */
describe("optimizePortfolio — eligibility filter excludes unaffordable cards", () => {
  const cards = [
    mkCard("P", { categories: [{ category: "groceries", rate: "10%" }], min_salary: 25000 }),
    mkCard("R", { categories: [{ category: "groceries", rate: "5%" }], min_salary: 5000 }),
  ];
  const spending: SpendingProfile = { groceries: 1000 };
  const result = optimizePortfolio(spending, { monthlySalaryAed: 10000, uaeResident: true }, cards);

  it("reports survivor counts and never returns the excluded premium card", () => {
    expect(result.eligibleCardCount).toBe(1);
    expect(result.excludedForEligibility).toBe(1);
    expect(result.best1?.cardIds).toEqual(["R"]);
    expect(result.best2).toBeNull(); // only one card survives, so no 2-card portfolio
    expect(result.best1?.cardIds).not.toContain("P");
  });
});

/**
 * Case 6 — portfolio-level rule: a salary can only be transferred to ONE bank, so
 * no portfolio may contain two salary_transfer_required cards.
 */
describe("optimizePortfolio — never returns two salary-transfer cards together", () => {
  const cards = [
    mkCard("S1", { categories: [{ category: "groceries", rate: "10%" }], salary_transfer: true }),
    mkCard("S2", { categories: [{ category: "dining", rate: "10%" }], salary_transfer: true }),
    mkCard("N", { categories: [{ category: "groceries", rate: "3%" }, { category: "dining", rate: "3%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1000, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN_PROFILE, cards);

  const hasBothTransfers = (ids: string[] | undefined): boolean =>
    !!ids && ids.includes("S1") && ids.includes("S2");

  it("excludes the two-transfer pair at every size", () => {
    expect(hasBothTransfers(result.best1?.cardIds)).toBe(false);
    expect(hasBothTransfers(result.best2?.cardIds)).toBe(false);
    expect(hasBothTransfers(result.best3?.cardIds)).toBe(false);
    // The only 3-card set is {S1,S2,N} — invalid — so there's no valid 3-card portfolio.
    expect(result.best3).toBeNull();
  });
});

/**
 * Case 7 — full-data smoke test: all real cards, a realistic profile. Must run
 * fast and return sane, flagged output.
 */
describe("optimizePortfolio — full 51-card smoke test", () => {
  const spending: SpendingProfile = {
    groceries: 3000,
    dining: 2000,
    fuel: 1200,
    utilities: 800,
    travel: 2500,
    international: 1500,
    other: 4000,
  };
  const profile: UserProfile = { monthlySalaryAed: 20000, uaeResident: true };

  it("completes quickly and returns a sane best portfolio per size", () => {
    const start = Date.now();
    const result = optimizePortfolio(spending, profile, realCards);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000); // exhaustive search over ~27k subsets, still fast

    expect(result.totalCardCount).toBe(realCards.length);
    expect(result.eligibleCardCount).toBeGreaterThan(0);

    for (const p of [result.best1, result.best2, result.best3]) {
      expect(p).not.toBeNull();
      expect(Number.isFinite(p!.netAnnualValue)).toBe(true);
      expect(p!.allocations.length).toBeGreaterThan(0);
    }

    // More cards should never REDUCE the achievable gross (a superset can always
    // ignore the extra card), a good invariant sanity check.
    expect(result.best2!.grossAnnualValue.min).toBeGreaterThanOrEqual(
      result.best1!.grossAnnualValue.min - 1e-6,
    );
    expect(result.best3!.grossAnnualValue.min).toBeGreaterThanOrEqual(
      result.best2!.grossAnnualValue.min - 1e-6,
    );

    // The overall recommendation is one of the three per-size winners.
    expect([result.best1, result.best2, result.best3]).toContain(result.overallBest);
  });

  /**
   * Case 8 — regression lock for the rate-ceiling SELECTION bias.
   *
   * Individually, reading "Up to 10%" as a flat 10% because the card carries a cap
   * field is a defensible reading of ONE card. But optimizePortfolio scores every
   * eligible card on those numbers and keeps the best, so resolving each ceiling to
   * its headline made the winner a maximum-of-maxima — an estimator biased upward by
   * the spread of the ceilings, and biased more the more cards are considered.
   *
   * rakbank_world is the clearest case: four "Up to 10%"/"Up to 3%" categories, an
   * AED 1,100 overall cap and (until this pass) no minimum-spend gate. On the
   * grocery/dining/travel profile below it used to rank as the single BEST card in
   * the dataset, claiming a fully certain AED 10,410/yr — 8.67% of annual spend,
   * reported with a zero-width range as if it were a known fact.
   *
   * This test pins the two things the fix must guarantee. It deliberately does NOT
   * assert a global plausibility bound on `overallBest`: that number is still
   * inflated on some profiles by the SEPARATE, pre-existing merchant-lock optimism
   * (emaar_* / talabat bonuses assumed to apply to all generic spend), which is
   * flagged-by-design and out of scope here. See CARD_DATA_CHANGELOG.md.
   */
  it("never resolves an 'up to' ceiling into a certain rate when ranking", () => {
    const ceilingProfile: SpendingProfile = {
      groceries: 3000, dining: 3000, travel: 3000, other: 1000,
    };
    const richEnough: UserProfile = { monthlySalaryAed: 30000, uaeResident: true };

    /*
      This used to name `rakbank_world` as the example. D15/D16 resolved that card's
      ceilings into certain rates from RAKBANK's own schedule, so it no longer has a
      band and the assertion started failing for the RIGHT reason — the data got
      better. Naming a card was the mistake: the property belongs to every card that
      still carries a ceiling, so the example is now selected from the data.

      The `toBeGreaterThan(0)` on the selection is the liveness guard. If the dataset
      ever has no "up to" rates left, this test would otherwise pass vacuously while
      asserting nothing — the exact failure mode study-filters.ts exists to prevent.
    */
    const ceilingCards = realCards.filter((c) =>
      [c.rewards.base_rate, ...c.rewards.categories.map((x) => x.rate)].some((s) =>
        /^\s*up\s+to\b/i.test(s),
      ),
    );
    expect(ceilingCards.length, "no 'up to' rates left — this test now asserts nothing").toBeGreaterThan(0);

    // 1. Every ceiling must reach the ranking as a genuine BAND, not a point estimate.
    for (const card of ceilingCards) {
      const score = scoreCard(ceilingProfile, card);
      expect(
        score.netAnnualValueRange.max,
        `${card.id} scored its ceiling as a certain value`,
      ).toBeGreaterThan(score.netAnnualValueRange.min);
      expect(score.uncertain, `${card.id} did not mark itself uncertain`).toBe(true);
    }

    // 2. A card built entirely on unverified ceilings must no longer outrank every
    //    card with a known flat rate purely on the strength of its marketing.
    const best1 = optimizePortfolio(ceilingProfile, richEnough, realCards).best1!;
    for (const card of ceilingCards) {
      expect(best1.cardIds).not.toContain(card.id);
    }

    // 3. Structural: no "Up to X%" rate anywhere in the dataset carries a numeric
    //    value. This is what makes (1) hold for every such card, not just these.
    for (const card of realCards) {
      for (const cat of card.rewards.categories) {
        if (!/^up\s+to\s+[\d.]+\s*%/i.test(cat.rate)) continue;
        const r = normalizeRate(cat.rate, {
          monthlyCap: cat.monthly_cap,
          annualCap: cat.annual_cap,
          rewardCurrency: card.rewards.currency,
        });
        expect(r.value, `${card.id}/${cat.category} resolved "${cat.rate}" to a certain value`).toBeNull();
        expect(r.range?.max).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Case 9 — regression lock for MERCHANT-LOCK optimism.
   *
   * Structurally identical to case 8, in the merchant dimension. MATCH_TABLE maps a
   * merchant-locked bonus onto its nearest canonical category (emaar_malls -> other,
   * lulu_supermarket -> groceries, first_10_talabat_orders -> dining), and the scorer
   * used to credit it against ALL of that category's spend. Under selection that made
   * the optimizer pick whichever card carried the most optimistic merchant assumption
   * — and stack several at once, simultaneously assuming all your general retail is at
   * Emaar, all your groceries at LuLu and all your dining through Talabat.
   *
   * The fix bounds each such bonus 0..full for a generic profile. It must NOT zero the
   * card, and it must NOT touch the path where the merchant is actually known.
   */
  it("bounds merchant-locked bonuses rather than assuming or zeroing them", () => {
    const merchantCard = mkCard("merchant-locked", {
      // 10% but only at LuLu; mapped to groceries, which the profile spends on.
      categories: [{ category: "lulu_supermarket", rate: "10%" }],
      base_rate: "0% on all spend",
    });
    const flatCard = mkCard("flat", { base_rate: "2% on all spend" });
    const spend: SpendingProfile = { groceries: 1000 };

    const locked = scoreCard(spend, merchantCard);
    // Bounded, not assumed: 0..10% on 12,000/yr -> range [0, 1200], midpoint 600.
    expect(locked.netAnnualValueRange.min).toBeCloseTo(0, 6);
    expect(locked.netAnnualValueRange.max).toBeCloseTo(1200, 6);
    expect(locked.netAnnualValue).toBeCloseTo(600, 6);
    expect(locked.uncertain).toBe(true);

    // Bounded, not zeroed: it still beats a flat 2% (240/yr) on expected value, so a
    // genuinely strong merchant card is not driven out of the recommendation.
    expect(locked.netAnnualValue).toBeGreaterThan(scoreCard(spend, flatCard).netAnnualValue);

    // The escape hatch still works: a caller that KNOWS the merchant gets the exact
    // full rate back, with no range. This is the which-card path.
    const confirmed = scoreCard(spend, merchantCard, undefined, { merchantLocksResolved: true });
    expect(confirmed.netAnnualValue).toBeCloseTo(1200, 6);
    expect(confirmed.netAnnualValueRange.min).toBeCloseTo(1200, 6);
  });
});
