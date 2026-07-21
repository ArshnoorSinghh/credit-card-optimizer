import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { scoreCard, AED_PER_USD, type SpendingProfile } from "./score-card";
import { withValuations } from "./valuations";

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
 * Case 1 — fab_cashback after the 2026-07 data (currency FAB Rewards @ 0.007,
 * min-spend gate AED 3,000, category caps in POINTS, overall_cap 1000 unmodeled).
 *
 * NOTE on the tiny 5% bonuses: the supermarkets/fashion/dining categories quote
 * "5%" but their monthly_cap is 150 in FAB Rewards UNITS — worth only ~1 AED/mo at
 * 0.007 — so each bonus binds almost immediately and the over-cap spend reroutes to
 * the base rate. That is a data-shape question (is the 150 an AED cap or a points
 * cap?) flagged in the review notes, not a scorer bug: the scorer honours the cap
 * as the data states it, in the currency's units.
 *
 * Above the gate (PROFILE totals 16,500/mo >= 3,000) the bonuses are active:
 *   supermarkets/fashion/dining each: 5% capped to 150 units/mo -> 1800/yr
 *                                     -> *0.007 = 12.6 AED each  (cap binds monthly)
 *   non_aed_spend (international 1500): 3% -> 77,142.857 units/yr -> 540 AED
 *   base_rate 1% on the remaining ~14,937/mo -> 256,062.857 units/yr -> 1,792.44 AED
 *   Gross = 12.6*3 + 540 + 1792.44 = 2,370.24. Fee 300, no waiver.
 */
describe("scoreCard — points cashback with unit caps + min-spend gate (fab_cashback)", () => {
  const score = scoreCard(PROFILE, byId("fab_cashback"));

  it("binds the (points) monthly cap on the 5% supermarket bonus", () => {
    const supermarkets = score.breakdown.find((b) => b.cardCategory === "supermarkets");
    expect(supermarkets?.annualUnits.min).toBe(1800); // 150 units/mo cap * 12
    expect(supermarkets?.annualValueAed.min).toBeCloseTo(12.6, 6); // 1800 * 0.007
    expect(supermarkets?.capBound).toBe("monthly");
  });

  it("matches the hand-computed gross/net above the gate", () => {
    expect(score.grossAnnualValue.min).toBeCloseTo(2370.24, 2);
    expect(score.fees).toMatchObject({ annualFeeAed: 300, year1FeeAed: 300, ongoingFeeAed: 300 });
    expect(score.netAnnualValue).toBeCloseTo(2070.24, 2); // 2370.24 - 300
    expect(score.netAnnualValueYear1).toBeCloseTo(2070.24, 2); // no waiver
    expect(score.flags.some((f) => /cap reached/i.test(f.message))).toBe(true);
  });

  it("disables bonus rates below the AED 3,000 min-spend gate (earns base only)", () => {
    // At 1,000/mo total the gate is not met: the 5% bonuses switch off and all spend
    // earns the base 1% -> 1000 * 0.01 * 12 = 120 AED, with an explanatory flag.
    const gated = scoreCard({ groceries: 1000 }, byId("fab_cashback"));
    expect(gated.grossAnnualValue.min).toBeCloseTo(120, 6);
    expect(gated.breakdown.every((b) => b.cardCategory === "base_rate")).toBe(true);
    expect(gated.flags.some((f) => /minimum spend.*bonus rates disabled/i.test(f.message))).toBe(true);
  });
});

/**
 * Case 2 — MILES with per-USD conversion (enbd_skywards_signature, currency
 * Emirates Skywards Miles @ 0.037). After the 2026-07 data: base "0.75 mile/USD",
 * one bonus category international_spend "1.0 mile/USD", no merchant-locked category,
 * fee 735 with NO waiver, and a data_caveat (AED 50k/cycle accrual cap).
 *
 * Hand math (convert AED->USD at 3.6725 first, since rates are "per USD"):
 *   international 1500 -> 1.0 mile/USD = 1*(1500/3.6725)*12 = 4901.2934 miles/yr
 *   everything else 15000 -> base 0.75 mile/USD = 0.75*(15000/3.6725)*12 = 36759.700 miles/yr
 *   miles * 0.037: intl 181.3479 + base 1360.1089 = 1541.4568 gross.
 */
describe("scoreCard — miles card with USD conversion (enbd_skywards_signature)", () => {
  const score = scoreCard(PROFILE, byId("enbd_skywards_signature"));

  it("uses the fixed USD peg", () => {
    expect(AED_PER_USD).toBe(3.6725);
  });

  it("shows reward-currency (miles) amounts before conversion", () => {
    const intl = score.breakdown.find((b) => b.cardCategory === "international_spend");
    expect(intl?.annualUnits.min).toBeCloseTo(4901.2934, 3); // 1 * (1500/3.6725) * 12
    const base = score.breakdown.find((b) => b.cardCategory === "base_rate");
    expect(base?.annualUnits.min).toBeCloseTo(36759.7005, 3); // 0.75 * (15000/3.6725) * 12
  });

  it("matches the hand-computed net value (fee not waived)", () => {
    expect(score.grossAnnualValue.min).toBeCloseTo(1541.4568, 2);
    expect(score.netAnnualValue).toBeCloseTo(806.4568, 2); // - 735 ongoing
    expect(score.netAnnualValueYear1).toBeCloseTo(806.4568, 2); // no first-year waiver
    expect(score.fees).toMatchObject({ year1FeeAed: 735, ongoingFeeAed: 735 });
  });

  it("surfaces the data caveat and stays uncertain", () => {
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => /Data caveat:.*50,000 per statement cycle/i.test(f.message))).toBe(true);
  });
});

/**
 * Case 3 — FREE-FOR-LIFE points card (fab_rewards_indulge, FAB Rewards @ 0.007).
 * After the 2026-07 data: online_spend "5 FAB Rewards per AED 1" (maps to `other`),
 * a monthly_spend_bonus threshold category (unmatched/flagged), base "1 per AED 1".
 *
 * Hand math (points per AED; no caps; no fee ever):
 *   other 3000 -> online_spend 5 pts/AED = 15000/mo -> 180000/yr -> *0.007 = 1260 AED
 *   remaining 13500 -> base 1 pt/AED = 162000/yr -> 1134 AED
 *   Gross = 2394. Fee 0 (free for life). Net = 2394.
 */
describe("scoreCard — free-for-life points card (fab_rewards_indulge)", () => {
  const score = scoreCard(PROFILE, byId("fab_rewards_indulge"));

  it("shows points earned per category before conversion", () => {
    const online = score.breakdown.find((b) => b.cardCategory === "online_spend");
    expect(online?.annualUnits.min).toBe(180000); // 3000 * 5 * 12
    expect(online?.annualValueAed.min).toBeCloseTo(1260, 6);

    const base = score.breakdown.find((b) => b.cardCategory === "base_rate");
    expect(base?.monthlySpendAed).toBe(13500);
    expect(base?.annualUnits.min).toBe(162000);
  });

  it("matches the hand-computed net value with no fee in either year", () => {
    expect(score.grossAnnualValue.min).toBeCloseTo(2394, 6);
    expect(score.netAnnualValue).toBeCloseTo(2394, 6);
    expect(score.netAnnualValueYear1).toBeCloseTo(2394, 6);
    expect(score.fees).toMatchObject({ year1FeeAed: 0, ongoingFeeAed: 0, waiverApplied: "Free for life" });
  });

  it("flags the unmodeled threshold bonus and the medium-confidence valuation", () => {
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => /Valuation of "FAB Rewards"/.test(f.message))).toBe(true);
    expect(score.flags.some((f) => /monthly_spend_bonus.*Threshold lump bonus/i.test(f.message))).toBe(true);
  });
});

/** Range scoring: a card with an unresolved (tier-3) rate must produce a range. */
describe("scoreCard — unresolved rate scores as a range", () => {
  it("does not fabricate a point value for an unbounded variable-rate card", () => {
    // The only real "Variable" card (ei_flex_elite) is now benched, so we exercise
    // the unbounded path with a synthetic card: groceries at "Variable" (tier 3, no
    // ceiling) — the upside can't be bounded, so we flag it and don't invent a max.
    const synthetic: Card = {
      id: "synthetic_variable",
      name: "Synthetic Variable",
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
        categories: [{ category: "groceries", rate: "Variable", monthly_cap: null, annual_cap: null }],
        overall_cap: null,
        min_monthly_spend_required_aed: 0,
      },
      redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
      benefits: [],
      source_url: "",
    };
    const score = scoreCard(PROFILE, synthetic);
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => /unbounded variable rate/.test(f.message))).toBe(true);
  });

  it("propagates a BOUNDED tier-3 range (min < max) end to end", () => {
    // No real card propagates a bounded "up to X%" range anymore, so we exercise
    // the range mechanism with a minimal synthetic card: groceries at "Up to 4%",
    // no cap => range 0..4%.
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
 * enbd_visa_flexi, after the 2026-07 data: a flat-rate points card quoting PERCENTS
 * (base "1.5% back in Plus Points", plus two smaller 0.4%/0.2% category rates that
 * never beat the base, so all spend routes to the base). Free for life; no caveat.
 */
describe("scoreCard — flat-rate points card (enbd_visa_flexi)", () => {
  const score = scoreCard(PROFILE, byId("enbd_visa_flexi"));

  it("earns the 1.5% base rate on all spend (bonus rates never beat it)", () => {
    // 16500 AED/mo at 1.5% back = 2970 AED value/yr (in Plus Points at 0.01 = 297000 pts).
    const base = score.breakdown.find((b) => b.cardCategory === "base_rate");
    expect(base?.monthlySpendAed).toBe(16500);
    expect(base?.annualValueAed.min).toBeCloseTo(2970, 6);
    expect(score.breakdown).toHaveLength(1); // only the base rate wins
    expect(score.grossAnnualValue.min).toBeCloseTo(2970, 6);
    expect(score.netAnnualValue).toBeCloseTo(2970, 6); // free for life
  });

  it("no longer references a user-chosen category", () => {
    expect(score.breakdown.some((b) => b.cardCategory === "user_chosen_category")).toBe(false);
    expect(score.flags.some((f) => /chosen bonus category/.test(f.message))).toBe(false);
  });

  it("carries no data caveat now, but stays uncertain from the low-confidence valuation", () => {
    expect(score.flags.some((f) => /Data caveat:/.test(f.message))).toBe(false);
    expect(score.uncertain).toBe(true); // Plus Points valuation is low confidence
    expect(score.benched).toBe(false);
  });
});

/**
 * Permanent sanity guardrail: a net annual value above the user's total annual
 * spend is a >100% return, which in this dataset always means a bad earn rate or
 * valuation — never a real card. It must be FLAGGED, not crashed, not dropped.
 */
describe("scoreCard — implausibility guardrail", () => {
  // why a synthetic card (2026-07): the real cards now quote most points bonuses as
  // PERCENTS, and a percent's AED value is invariant to the per-point valuation, so
  // the old "value the currency absurdly" trick no longer inflates the total. A
  // points-PER-AED card does still scale with valuation, so we build a minimal one:
  // 1 unit/AED valued at an absurd 2.0 AED/unit -> a 200% return on all spend.
  const absurdCard: Card = {
    id: "synthetic_absurd",
    name: "Synthetic Absurd",
    bank: "",
    network: "",
    tier: "",
    eligibility: { min_monthly_salary_aed: 0, uae_resident_required: false, min_age: 0, salary_transfer_required: false, employer_restrictions: null },
    fees: { annual_fee_aed: 0, waiver_conditions: null, joining_fee_aed: 0 },
    rewards: {
      type: "points",
      currency: "SyntheticUnit",
      base_rate: "1 point per AED 1",
      categories: [],
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: "SyntheticUnit", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };

  it("flags a card whose net annual value exceeds total annual spend", () => {
    const absurd = withValuations({ SyntheticUnit: { aedPerUnit: 2.0, confidence: "low" } });
    const score = scoreCard(PROFILE, absurdCard, absurd);
    expect(Number.isFinite(score.netAnnualValue)).toBe(true); // never crashes
    expect(score.flags.some((f) => /Implausible.*exceeds total annual spend/.test(f.message))).toBe(true);
    expect(score.uncertain).toBe(true);
  });

  it("stays silent for a normal card", () => {
    expect(scoreCard(PROFILE, byId("fab_cashback")).flags.some((f) => /Implausible/.test(f.message))).toBe(false);
  });
});

/**
 * Benching mechanism. As of the 2026-07 hand-verified data NO card is excluded from
 * scoring (the prior benched cards were resolved), so we exercise the mechanism with
 * a synthetic card carrying `excluded_from_scoring` — the behaviour must still hold
 * for when a future card needs benching.
 */
describe("scoreCard — benched card (synthetic excluded_from_scoring)", () => {
  const benchedCard: Card = {
    id: "synthetic_benched",
    name: "Synthetic Benched",
    bank: "",
    network: "",
    tier: "",
    eligibility: { min_monthly_salary_aed: 0, uae_resident_required: false, min_age: 0, salary_transfer_required: false, employer_restrictions: null },
    fees: { annual_fee_aed: 0, waiver_conditions: null, joining_fee_aed: 0 },
    rewards: { type: "cashback", currency: "AED", base_rate: "1% on all spend", categories: [], overall_cap: null, min_monthly_spend_required_aed: 0 },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
    excluded_from_scoring: true,
    notes: "synthetic — customizable structure can't be scored",
  };
  const score = scoreCard(PROFILE, benchedCard);

  it("is benched: zeroed, flagged, and marked excluded", () => {
    expect(score.benched).toBe(true);
    expect(score.netAnnualValue).toBe(0);
    expect(score.grossAnnualValue).toEqual({ min: 0, max: 0 });
    expect(score.breakdown).toHaveLength(0);
    expect(score.uncertain).toBe(true);
    expect(score.flags.some((f) => /Excluded from scoring — pending data verification/.test(f.message))).toBe(true);
  });

  it("leaves every real card scored normally (none benched in current data)", () => {
    expect(cards.every((c) => scoreCard(PROFILE, c).benched === false)).toBe(true);
  });
});

/** Every card must score without throwing (smoke test across all 51). */
describe("scoreCard — runs on all cards", () => {
  it("produces a finite ranking number for every card", () => {
    for (const card of cards) {
      const score = scoreCard(PROFILE, card);
      expect(Number.isFinite(score.netAnnualValue)).toBe(true);
    }
  });
});
