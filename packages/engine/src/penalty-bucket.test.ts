/**
 * REGRESSION: spend must not escape a card's LOW-earning category into that same
 * card's base rate.
 *
 * WHY THIS FILE EXISTS
 * The allocator models routing as min-cost max-flow, which assumes each dirham can
 * CHOOSE its earn-option. That is true across cards — you pick which card to swipe —
 * and false within one card: the issuer's merchant category code decides which
 * bucket a purchase lands in. You cannot elect to have petrol treated as general
 * retail.
 *
 * So wherever a card names a category at a rate BELOW its own base rate, the old
 * flow routed that spend around the penalty and into the (uncapped, virtual) base
 * option. 16 such rates exist across 12 real cards, concentrated on exactly the
 * categories UAE issuers suppress: fuel, government, utilities, school fees.
 *
 * Measured before the fix, on a family-with-school-fees profile:
 *   ei_switch_cashback  overstated by AED 2,250/yr (59.8%)
 *   enbd_dnata_world    overstated by AED 1,004/yr (52.3%)
 *   enbd_visa_flexi     overstated by AED   905/yr (52.0%)
 * On rakbank_world the 0.25% bucket received AED 0/mo — every dirham of it was
 * paid the 1% base rate instead. A data fix that ADDED that bucket (changelog D15,
 * to correct "a 4x overstatement") therefore changed nothing: the allocator simply
 * routed around it.
 *
 * THE RULE BEING PINNED
 * A canonical spend category is a PENALTY category on a card when every one of that
 * card's reward categories naming it yields LESS than the card's catch-all. Such a
 * category may not be claimed by the catch-all.
 *
 * The converse must keep working: where a named category yields MORE than the base
 * (an ordinary bonus), spend past its cap still overflows to the base rate. That is
 * the deliberate "over-cap spend earns the base rate" rule and is pinned below.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { earnAcrossCards, precomputeCardData, scoreCard, type SpendingProfile } from "./score-card";

const realCards = cardsData as Card[];

function mkCard(
  id: string,
  o: {
    categories?: { category: string; rate: string; monthly_cap?: number | null }[];
    base_rate?: string;
  } = {},
): Card {
  return {
    id,
    name: id,
    bank: "TestBank",
    network: "TestNet",
    tier: "Test",
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
      base_rate: o.base_rate ?? "1% on all spend",
      categories: (o.categories ?? []).map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthly_cap ?? null,
        annual_cap: null,
      })),
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };
}

/**
 * Case 1 — THE CORE DEFECT. base 1%, `fuel_utilities` 0.25%.
 * Spend: fuel 1,000 + groceries 1,000.
 *
 *   fuel      1,000 -> the 0.25% bucket (it cannot escape) =  2.50/mo
 *   groceries 1,000 -> base 1% (not named anywhere)        = 10.00/mo
 *   total 12.50/mo = AED 150/yr.
 * The old answer routed fuel to the base rate too: 20/mo = AED 240/yr.
 */
describe("penalty bucket - spend below the base rate cannot escape to the base rate", () => {
  const card = mkCard("PENALTY", {
    base_rate: "1% on all spend",
    categories: [{ category: "fuel_utilities", rate: "0.25%" }],
  });

  it("pays the suppressed rate on the suppressed category", () => {
    const s = scoreCard({ fuel: 1000, groceries: 1000 }, card);
    expect(s.grossAnnualValue).toEqual({ min: 150, max: 150 });
  });

  it("routes the fuel spend to the 0.25% option, not to base_rate", () => {
    const res = earnAcrossCards({ fuel: 1000, groceries: 1000 }, [precomputeCardData(card)]);
    const penalty = res.optionOutcomes.find((o) => o.option.cardCategory === "fuel_utilities");
    const base = res.optionOutcomes.find((o) => o.option.cardCategory === "base_rate");
    expect(penalty?.monthlySpendAed).toBe(1000);
    expect(base?.spendCategories).not.toContain("fuel");
  });
});

/**
 * Case 2 — the same rule for an EXPLICIT catch-all (`all_other_spend`), not just
 * the virtual base-rate option. Same numbers as case 1.
 */
describe("penalty bucket - an explicit all_other_spend catch-all is narrowed too", () => {
  const card = mkCard("EXPLICIT", {
    base_rate: "0% on all spend",
    categories: [
      { category: "all_other_spend", rate: "1%" },
      { category: "fuel_utilities", rate: "0.25%" },
    ],
  });

  it("keeps suppressed spend out of the catch-all", () => {
    expect(scoreCard({ fuel: 1000, groceries: 1000 }, card).grossAnnualValue).toEqual({
      min: 150,
      max: 150,
    });
  });
});

/**
 * Case 3 — GUARD: an ordinary bonus above the base rate must still overflow to the
 * base rate once its cap binds. This is the deliberate reroute rule and must not be
 * collateral damage.
 *
 *   groceries 10% capped at AED 100/mo, base 1%. Spend groceries 2,000/mo.
 *   1,000 fills the 10% cap (100/mo); the other 1,000 earns base 1% (10/mo).
 *   total 110/mo = AED 1,320/yr.
 */
describe("penalty bucket - over-cap spend on a real bonus still reaches the base rate", () => {
  const card = mkCard("BONUS", {
    base_rate: "1% on all spend",
    categories: [{ category: "groceries", rate: "10%", monthly_cap: 100 }],
  });

  it("still reroutes over-cap spend to base (unchanged behaviour)", () => {
    expect(scoreCard({ groceries: 2000 }, card).grossAnnualValue).toEqual({
      min: 1320,
      max: 1320,
    });
  });
});

/**
 * Case 4 — a category named at BOTH a good and a suppressed rate is not a penalty
 * category: the better bucket exists, so the flow may use it.
 *
 *   base 1%; `fuel` 3%; `fuel_utilities` 0.25%.  Spend fuel 1,000 + utilities 1,000.
 *   fuel      -> 3%    (best option naming it beats base) = 30.0/mo
 *   utilities -> 0.25% (only ever named suppressed)       =  2.5/mo
 *   total 32.5/mo = AED 390/yr.
 */
describe("penalty bucket - only categories suppressed EVERYWHERE are locked down", () => {
  const card = mkCard("MIXED", {
    base_rate: "1% on all spend",
    categories: [
      { category: "fuel", rate: "3%" },
      { category: "fuel_utilities", rate: "0.25%" },
    ],
  });

  it("lets fuel take its good rate while utilities stays suppressed", () => {
    expect(scoreCard({ fuel: 1000, utilities: 1000 }, card).grossAnnualValue).toEqual({
      min: 390,
      max: 390,
    });
  });
});

/**
 * Case 5 — REAL DATA. rakbank_world's 0.25% bucket covers fuel, transit,
 * government, utilities, real estate, education and telecom. On a mid-range profile
 * it must receive that spend instead of ceding it to the 1% base rate.
 *
 * Hand math (profile below, AED/mo -> AED/yr):
 *   groceries 2,200 -> supermarkets 10%, cap 300/mo   -> 220/mo
 *   dining    1,800 -> dining 10%, cap 300/mo         -> 180/mo
 *   travel    1,500 -> travel_and_hotels 10%, cap 400 -> 150/mo
 *   other     1,400 -> other_retail 1%, cap 100/mo    ->  14/mo
 *   fuel 700 + utilities 700 + transport 400 = 1,800 -> 0.25% -> 4.5/mo
 *   entertainment 900 + international 900 = 1,800 -> base 1%  ->  18/mo
 *   total 586.5/mo = AED 7,038/yr  (overall cap 1,250/mo does not bind)
 * The old answer paid the 1,800 of suppressed spend at 1%: AED 7,200/yr.
 */
describe("penalty bucket - real card: rakbank_world honours its 0.25% bucket", () => {
  const profile: SpendingProfile = {
    groceries: 2200, dining: 1800, fuel: 700, utilities: 700, education: 0,
    travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400,
  };
  const card = realCards.find((c) => c.id === "rakbank_world")!;

  it("routes the suppressed 1,800/mo to the 0.25% bucket", () => {
    const res = earnAcrossCards(profile, [precomputeCardData(card)]);
    const penalty = res.optionOutcomes.find((o) =>
      o.option.cardCategory.startsWith("fuel_transit"),
    );
    expect(penalty?.monthlySpendAed).toBeCloseTo(1800, 6);
  });

  it("matches the hand-computed 7,038/yr, not the old 7,200", () => {
    expect(scoreCard(profile, card).grossAnnualValue.max).toBeCloseTo(7038, 6);
  });
});

/**
 * Case 6 — INVARIANT across the whole dataset: no card may pay its base rate on a
 * category that all of its own reward categories suppress below that base rate.
 * Written as a sweep so a future data edit that reintroduces the shape is caught.
 */
describe("penalty bucket - dataset-wide invariant", () => {
  const profile: SpendingProfile = {
    groceries: 2000, dining: 1500, fuel: 1000, utilities: 900, education: 2000,
    travel: 1200, transport: 500, entertainment: 700, international: 800, other: 1200,
  };

  it("no catch-all option ever claims a fully-suppressed category", () => {
    const offenders: string[] = [];
    for (const card of realCards) {
      if (card.excluded_from_scoring) continue;
      const cd = precomputeCardData(card);
      const res = earnAcrossCards(profile, [cd]);
      /*
        SUPPRESSION IS JUDGED ON THE UNBOUNDED YIELDS — `basis`, not `cd`.

        A suppressed ("penalty") bucket is a fact about the ISSUER'S SCHEDULE: this
        card deliberately pays less for petrol than for general retail, so petrol must
        not escape into the base rate. `applySuppressedCategoryLock` decides that from
        the unbounded yields, BEFORE merchant bounding, precisely so the answer does
        not change with what we happen to know about the user's merchants. This test
        has to ask the question on the same basis or it is testing a different rule.

        `merchantLocksResolved` is what reproduces that basis: it is the only flag that
        leaves every merchant rate at its real value. Scored normally, a bounded
        merchant bonus reads as a low yield and this invariant reports things like
        `rakbank_air_arabia_platinum: "travel" suppressed to 0.00206 but paid catch-all
        0.00225` — which describes the bound, not a penalty bucket.

        Excluding merchant options from `bestNamed` instead is NOT equivalent, and gets
        `enbd_dnata_world` wrong: canonical `other` there is named both by a 0.375%
        insurance/car-dealer bucket AND by a 10% Duty Free bonus. The lock rightly
        declines to suppress `other` — most of it really does earn the 1.5% base — and
        a test that ignored the 10% option would call that a leak.
      */
      const basis = precomputeCardData(card, undefined, { merchantLocksResolved: true });
      const catchallYield = Math.max(
        0,
        ...basis.options.map((o, i) => (o.rule.kind === "catchall" ? basis.yields[i]! : 0)),
      );
      const bestNamed = new Map<string, number>();
      basis.options.forEach((o, i) => {
        if (o.rule.kind !== "categories") return;
        for (const c of o.rule.categories) {
          bestNamed.set(c, Math.max(bestNamed.get(c) ?? 0, basis.yields[i]!));
        }
      });
      for (const outcome of res.optionOutcomes) {
        if (outcome.option.rule.kind !== "catchall") continue;
        for (const cat of outcome.spendCategories) {
          const best = bestNamed.get(cat);
          if (best !== undefined && best < catchallYield - 1e-12) {
            offenders.push(`${card.id}: "${cat}" suppressed to ${best} but paid catch-all ${catchallYield}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
