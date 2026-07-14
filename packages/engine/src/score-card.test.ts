import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { scoreCard, AED_PER_USD, type SpendingProfile } from "./score-card";

const cards = cardsData as Card[];
const byId = (id: string): Card => {
  const c = cards.find((x) => x.id === id);
  if (!c) throw new Error(`test fixture card not found: ${id}`);
  return c;
};

// One fixed spending profile used for every hand-computed case (AED/month).
const PROFILE: SpendingProfile = {
  groceries: 5000,
  dining: 2000,
  fuel: 1000,
  travel: 4000,
  other: 3000,
  international: 1500,
};

/**
 * Case 1 — CASHBACK with a cap binding (fab_cashback, currency AED @ 1.0).
 *
 * Hand math (percent = AED cashback directly; caps are in AED):
 *   groceries 5000  -> groceries_education_utilities 5% = 250/mo, capped to 200/mo
 *                      -> 200*12 = 2400/yr (annual cap 2400, not exceeded)      = 2400 AED
 *   dining 2000 + international 1500 = 3500 -> dining_international 3% = 105/mo
 *                      -> 105*12 = 1260/yr (under both caps)                    = 1260 AED
 *   fuel 1000 + travel 4000 + other 3000 = 8000 -> all_other_spend 1% (no bonus
 *                      category matches these) = 80/mo -> 960/yr                =  960 AED
 *   Gross = 2400 + 1260 + 960 = 4620. Fee: first year free, then AED 300.
 */
describe("scoreCard — cashback with a binding cap (fab_cashback)", () => {
  const score = scoreCard(PROFILE, byId("fab_cashback"));

  it("routes groceries to the 5% category and binds the monthly cap", () => {
    const groceries = score.breakdown.find((b) => b.cardCategory === "groceries_education_utilities");
    expect(groceries?.annualValueAed.min).toBe(2400); // 200/mo cap * 12
    expect(groceries?.capBound).toBe("monthly");
  });

  it("matches the hand-computed net value", () => {
    // all_other_spend bucket = fuel 1000 + travel 4000 + other 3000 = 8000/mo
    //   -> 1% = 80/mo -> 960/yr. Gross = 2400 + 1260 + 960 = 4620.
    const allOther = score.breakdown.find((b) => b.cardCategory === "all_other_spend");
    expect(allOther?.monthlySpendAed).toBe(8000);
    expect(allOther?.annualValueAed.min).toBe(960);

    expect(score.grossAnnualValue).toEqual({ min: 4620, max: 4620 });
    // First year free (waiver), AED 300 from year 2.
    expect(score.fees).toMatchObject({ annualFeeAed: 300, year1FeeAed: 0, ongoingFeeAed: 300 });
    expect(score.netAnnualValue).toBe(4320); // 4620 - 300 ongoing
    expect(score.netAnnualValueYear1).toBe(4620); // 4620 - 0
  });

  it("is otherwise certain, but flags the reached cap", () => {
    expect(score.uncertain).toBe(false);
    expect(score.flags.some((f) => /cap reached/i.test(f.message))).toBe(true);
  });
});

/**
 * Case 2 — MILES with per-USD conversion + merchant assumption
 * (enbd_skywards_signature, currency Skywards Miles @ 0.035).
 *
 * Hand math (convert AED->USD at 3.6725 first, since rates are "per USD"):
 *   travel 4000 -> emirates_purchases 2 miles/USD = 2*(4000/3.6725)*12 miles/yr
 *   international 1500 -> international_spend 1.5 miles/USD
 *   groceries+dining+fuel+other = 11000 -> base 1 mile/USD
 * Miles -> AED at 0.035. Fee 735, first year free.
 */
describe("scoreCard — miles card with USD conversion (enbd_skywards_signature)", () => {
  const score = scoreCard(PROFILE, byId("enbd_skywards_signature"));

  it("uses the fixed USD peg", () => {
    expect(AED_PER_USD).toBe(3.6725);
  });

  it("shows reward-currency (miles) amounts before conversion", () => {
    const emirates = score.breakdown.find((b) => b.cardCategory === "emirates_purchases");
    // 2 * (4000 / 3.6725) * 12 = 26140.2314 miles/yr
    expect(emirates?.annualUnits.min).toBeCloseTo(26140.2314, 3);
    expect(emirates?.merchantAssumption).toBe("Emirates");
  });

  it("matches the hand-computed net value", () => {
    // emirates 914.9081 + intl 257.3179 + base 1257.9986 = 2430.2246 gross
    expect(score.grossAnnualValue.min).toBeCloseTo(2430.2246, 2);
    expect(score.netAnnualValue).toBeCloseTo(1695.2246, 2); // - 735 ongoing
    expect(score.netAnnualValueYear1).toBeCloseTo(2430.2246, 2); // first year free
    expect(score.fees).toMatchObject({ year1FeeAed: 0, ongoingFeeAed: 735 });
  });

  it("flags the merchant assumption as uncertain", () => {
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => /at Emirates/i.test(f.message))).toBe(true);
  });
});

/**
 * Case 3 — FREE-FOR-LIFE points card (fab_rewards_indulge, FAB Rewards @ 0.007).
 *
 * Hand math (points per AED; no caps; no fee ever):
 *   dining 2000 -> 5 pts/AED = 10000/mo -> 120000/yr -> *0.007 = 840 AED
 *   international 1500 -> 3 pts/AED = 4500/mo -> 54000/yr -> 378 AED
 *   groceries+fuel+travel+other = 13000 -> base 1 pt/AED = 156000/yr -> 1092 AED
 *   Gross = 2310. Fee 0 (free for life). Net = 2310.
 */
describe("scoreCard — free-for-life points card (fab_rewards_indulge)", () => {
  const score = scoreCard(PROFILE, byId("fab_rewards_indulge"));

  it("shows points earned per category before conversion", () => {
    const dining = score.breakdown.find((b) => b.cardCategory === "dining");
    expect(dining?.annualUnits.min).toBe(120000); // 2000 * 5 * 12
    expect(dining?.annualValueAed.min).toBeCloseTo(840, 6);

    const base = score.breakdown.find((b) => b.cardCategory === "base_rate");
    expect(base?.monthlySpendAed).toBe(13000);
    expect(base?.annualUnits.min).toBe(156000);
  });

  it("matches the hand-computed net value with no fee in either year", () => {
    expect(score.grossAnnualValue.min).toBeCloseTo(2310, 6);
    expect(score.netAnnualValue).toBeCloseTo(2310, 6);
    expect(score.netAnnualValueYear1).toBeCloseTo(2310, 6);
    expect(score.fees).toMatchObject({ year1FeeAed: 0, ongoingFeeAed: 0, waiverApplied: "Free for life" });
  });

  it("flags the medium-confidence valuation as uncertain", () => {
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => /Valuation of "FAB Rewards"/.test(f.message))).toBe(true);
  });
});

/** Range scoring: a card with an unresolved (tier-3) rate must produce a range. */
describe("scoreCard — unresolved rate scores as a range", () => {
  it("does not fabricate a point value for an unbounded variable-rate card", () => {
    // ei_flex_elite has "Variable" category rates (tier 3, no ceiling) — the upside
    // can't be bounded, so we flag it and don't invent a max.
    const score = scoreCard(PROFILE, byId("ei_flex_elite"));
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => f.level === "unknown")).toBe(true);
  });

  it("propagates a BOUNDED tier-3 range (min < max) end to end", () => {
    // No real card propagates a bounded "up to X%" range: the one "up to X%" card
    // (enbd_visa_flexi's user_chosen_category) is now collapsed to a POINT estimate,
    // not a range. So we exercise the range mechanism with a minimal synthetic
    // card: groceries at "Up to 4%", no cap => range 0..4%.
    const synthetic: Card = {
      id: "synthetic_up_to",
      name: "Synthetic",
      bank: "",
      network: "",
      tier: "",
      eligibility: {
        min_monthly_salary_aed: 0,
        uae_resident_required: false,
        min_age: 0,
        salary_transfer_required: false,
        employer_restrictions: null,
      },
      fees: { annual_fee_aed: 0, waiver_conditions: null, joining_fee_aed: 0 },
      rewards: {
        type: "cashback",
        currency: "AED",
        base_rate: "0% on all spend",
        categories: [{ category: "groceries", rate: "Up to 4%", monthly_cap: null, annual_cap: null }],
        overall_cap: null,
        min_monthly_spend_required_aed: 0,
      },
      redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
      benefits: [],
      source_url: "",
    };
    // groceries 5000/mo: min 0, max 4% -> 200/mo -> 2400/yr AED. Everything else
    // routes to the 0% base and contributes nothing.
    const score = scoreCard(PROFILE, synthetic);
    expect(score.grossAnnualValue).toEqual({ min: 0, max: 2400 });
    expect(score.netAnnualValueRange).toEqual({ min: 0, max: 2400 });
    expect(score.netAnnualValue).toBe(1200); // midpoint
    expect(score.uncertain).toBe(true);
  });
});

/**
 * Flexi user-chosen bonus (enbd_visa_flexi, "Up to 5%" on user_chosen_category).
 * Scored as a POINT estimate on the holder's largest spend category, with
 * standard cap-clamping that engages automatically if a cap is added to the data.
 */
describe("scoreCard — flexi user-chosen bonus (enbd_visa_flexi)", () => {
  it("applies the ceiling rate to the single largest spend category, uncapped", () => {
    const score = scoreCard(PROFILE, byId("enbd_visa_flexi"));
    // Largest category in PROFILE is groceries (5000/mo). 5% -> 250/mo -> 3000/yr,
    // as a point estimate (min === max), NOT a 0..5% range.
    const bonus = score.breakdown.find((b) => b.cardCategory === "user_chosen_category");
    expect(bonus?.spendCategories).toEqual(["groceries"]);
    expect(bonus?.annualValueAed).toEqual({ min: 3000, max: 3000 });
    expect(bonus?.capBound).toBeUndefined(); // no bonus cap in the data today
    expect(
      score.flags.some((f) =>
        /assumes groceries as chosen bonus category; bonus cap not in data — verify/.test(f.message),
      ),
    ).toBe(true);
  });

  it("clamps automatically when a cap is later added to the card data (zero code changes)", () => {
    // Synthetic: same card, but the flexi category now carries a 100 AED/mo cap.
    // No engine change — normalizeRate resolves "Up to 5%" to 5% once a cap exists,
    // and the standard clamp binds it. Proves the cap path is already wired.
    const base = byId("enbd_visa_flexi");
    const capped: Card = {
      ...base,
      rewards: {
        ...base.rewards,
        categories: base.rewards.categories.map((c) =>
          c.category === "user_chosen_category" ? { ...c, monthly_cap: 100, annual_cap: 1200 } : c,
        ),
      },
    };
    const score = scoreCard(PROFILE, capped);
    const bonus = score.breakdown.find((b) => b.cardCategory === "user_chosen_category");
    // groceries 5000 * 5% = 250/mo, clamped to the new 100/mo cap -> 1200/yr.
    expect(bonus?.capBound).toBe("monthly");
    expect(bonus?.annualValueAed).toEqual({ min: 1200, max: 1200 });
  });
});

/** Every card must score without throwing (smoke test across all 55). */
describe("scoreCard — runs on all cards", () => {
  it("produces a finite ranking number for every card", () => {
    for (const card of cards) {
      const score = scoreCard(PROFILE, card);
      expect(Number.isFinite(score.netAnnualValue)).toBe(true);
    }
  });
});
