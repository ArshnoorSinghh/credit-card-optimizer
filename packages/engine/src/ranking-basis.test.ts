/**
 * REGRESSION: recommendations are ranked on the LOWER BOUND of their value range,
 * never on the midpoint of an uncertainty band.
 *
 * WHY THIS FILE EXISTS
 * The engine's stated principle is that flagged rates propagate as ranges rather
 * than silent point estimates. Reporting honoured that; RANKING did not. A rate
 * like "Up to 6%" normalizes to a 0..6% band, and ranking on its midpoint asserts
 * the user earns 3% — a number that appears nowhere in the card's terms and that
 * nothing in the data supports.
 *
 * This is the same bias commit 4343c53 removed from rate CONFIDENCE, re-entering
 * through selection. It is invisible per-card, because the range is reported
 * faithfully; it only shows up in which card gets chosen. Consequence measured
 * before the fix: the gap study's "defensible floor" run returned the SAME optimal
 * as its midpoint run (6.89% of spend in both) and a HIGHER gap, because only the
 * baseline moved. It was not a floor.
 *
 * THE RULE BEING PINNED
 * Rank on `netAnnualValueRange.min` — the value we can actually demonstrate. Keep
 * reporting the midpoint and the full range for display. A card is never chosen on
 * the strength of value we cannot show.
 */

import { describe, it, expect } from "vitest";
import type { Card } from "./card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";
import { scoreCard } from "./score-card";
import { askWhichCard } from "./which-card";

const OPEN: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };

function mkCard(id: string, rate: string, fee = 0): Card {
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
    fees: { annual_fee_aed: fee, waiver_conditions: null, joining_fee_aed: 0 },
    rewards: {
      type: "cashback",
      currency: "AED",
      base_rate: "0% on all spend",
      categories: [{ category: "groceries", rate, monthly_cap: null, annual_cap: null }],
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };
}

/**
 * CERTAIN: groceries 2% -> 1,000/mo x 2% x 12 = AED 240/yr, range [240, 240].
 * CEILING: groceries "Up to 6%" -> band 0..6% -> range [0, 720], midpoint 360.
 *
 * Midpoint ranking prefers CEILING (360 > 240). Lower-bound ranking prefers
 * CERTAIN (240 > 0), which is the only one of the two we can stand behind.
 */
describe("ranking basis — a demonstrable rate beats an unproven ceiling", () => {
  const cards = [mkCard("CERTAIN", "2%"), mkCard("CEILING", "Up to 6%")];
  const result = optimizePortfolio({ groceries: 1000 }, OPEN, cards);

  it("still reports the ceiling card's band faithfully", () => {
    const s = scoreCard({ groceries: 1000 }, cards[1]!);
    expect(s.netAnnualValueRange).toEqual({ min: 0, max: 720 });
    expect(s.netAnnualValue).toBe(360); // midpoint preserved for display
    expect(s.uncertain).toBe(true);
  });

  it("ranks the certain card first despite its lower midpoint", () => {
    expect(result.best1?.cardIds).toEqual(["CERTAIN"]);
    expect(result.overallBest?.cardIds).toEqual(["CERTAIN"]);
  });

  it("keeps midpoint and range on the winning portfolio for display", () => {
    expect(result.best1?.netAnnualValue).toBe(240);
    expect(result.best1?.netAnnualValueRange).toEqual({ min: 240, max: 240 });
  });
});

/**
 * A wider band must not win on upside alone. WIDE's midpoint (600) beats TIGHT's
 * certain 480, but its floor (0) does not.
 */
describe("ranking basis — upside never outranks a demonstrable floor", () => {
  const cards = [mkCard("TIGHT", "4%"), mkCard("WIDE", "Up to 10%")];
  const result = optimizePortfolio({ groceries: 1000 }, OPEN, cards);

  it("prefers the tight card", () => {
    expect(result.best1?.cardIds).toEqual(["TIGHT"]);
  });

  it("breaks a tie on the lower bound by preferring more upside", () => {
    // Two cards with the SAME floor: the one with more headroom should win, so a
    // lower-bound rule doesn't make the engine blind to genuine upside.
    const tied = [mkCard("FLAT", "Up to 4%"), mkCard("UPSIDE", "Up to 10%")];
    const r = optimizePortfolio({ groceries: 1000 }, OPEN, tied);
    expect(r.best1?.cardIds).toEqual(["UPSIDE"]);
  });
});

/**
 * which-card answers the same question for a single purchase and must use the same
 * basis, or "which card should I hold" and "which card should I swipe" disagree
 * about what a ceiling rate is worth.
 */
describe("ranking basis — which-card ranks on the same floor", () => {
  it("recommends the certain card over the higher-midpoint ceiling card", () => {
    const cards = [mkCard("CERTAIN", "2%"), mkCard("CEILING", "Up to 6%")];
    const a = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: 1000,
      userCards: cards,
      includeUnowned: false,
    });
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    expect(a.bestOwnedCard?.cardId).toBe("CERTAIN");
  });
});
