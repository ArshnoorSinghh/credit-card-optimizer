/**
 * MERCHANT SHARE — the model that lets a co-brand card be scored instead of excluded.
 *
 * WHY THIS FILE EXISTS
 * Fourteen UAE cards bonus one named retailer (`lulu_supermarket`, `emaar_malls`,
 * `noon_...`, the Emirates/Etihad/Marriott co-brands). The card data is correct; the
 * spend model had no notion of "share of category X spent at merchant Y", so the
 * engine credited the merchant rate to EVERY dirham of the canonical category the
 * bonus maps to. `emaar_malls` pays 6.25% and maps to canonical `other`, so a user's
 * entire `other` spend was scored as if every dirham were spent inside an Emaar mall.
 * That is 15 of the gap study's 21 card rejections, and it was the largest single
 * source of overstatement left in the engine.
 *
 * The product now asks the user for the share. This file pins what that share MEANS.
 *
 * THE FOUR RULES BEING PINNED
 *  1. A stated share caps how much of a category can reach the merchant bonus.
 *  2. The remainder is NOT destroyed — it flows to the next-best option (the card's
 *     base rate, or another card). A rate haircut would have silently kept that
 *     spend parked on a bonus it never earned.
 *  3. Two cards bonusing the SAME merchant draw from ONE pool. Holding a second LuLu
 *     card does not double how much of your groceries happen at LuLu.
 *  4. A share of 1 is exactly the old behaviour, and an INVALID share falls back to
 *     the old behaviour rather than being clamped into the optimistic end.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { earnAcrossCards, precomputeCardData, scoreCard } from "./score-card";
import { sanitizeMerchantShares, shareFor } from "./merchant-share";
import { merchantShareQuestions } from "./merchant-share-questions";

const realCards = cardsData as Card[];

/** Minimal cashback card; `lulu_supermarket` is a real merchant-locked category. */
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

// A LuLu card: 10% at LuLu (canonical `groceries`), 1% on everything else.
const luluCard = mkCard("LULU_A", {
  base_rate: "1% on all spend",
  categories: [{ category: "lulu_supermarket", rate: "10%" }],
});

describe("rule 1 + 2 — a share caps the bonus, and the rest falls to the base rate", () => {
  const spending = { groceries: 1000 };

  it("credits the WHOLE category when no share is stated (the old behaviour)", () => {
    // 1,000 x 10% x 12 = 1,200/yr.
    expect(scoreCard(spending, luluCard).grossAnnualValue).toEqual({ min: 1200, max: 1200 });
  });

  it("credits only the stated share, and pays the base rate on the remainder", () => {
    // 250 at 10% = 25/mo; the other 750 is NOT lost — it earns the 1% base = 7.50/mo.
    // (25 + 7.5) x 12 = 390/yr. A rate haircut would have given 10% x 25% x 1,000 =
    // 25/mo and silently dropped the remaining 750's base-rate earning entirely.
    const s = scoreCard(spending, luluCard, undefined, { LuLu: 0.25 });
    expect(s.grossAnnualValue).toEqual({ min: 390, max: 390 });
  });

  it("routes exactly the share to the merchant option and the rest to base_rate", () => {
    const { shares } = sanitizeMerchantShares({ LuLu: 0.25 });
    const res = earnAcrossCards(spending, [precomputeCardData(luluCard)], shares);
    const bonus = res.optionOutcomes.find((o) => o.option.cardCategory === "lulu_supermarket");
    const base = res.optionOutcomes.find((o) => o.option.cardCategory === "base_rate");
    expect(bonus?.monthlySpendAed).toBeCloseTo(250, 6);
    expect(base?.monthlySpendAed).toBeCloseTo(750, 6);
  });

  it("a share of 0 disables the bonus entirely — all spend earns the base rate", () => {
    // Someone who never shops at LuLu gets no LuLu bonus. 1,000 x 1% x 12 = 120/yr.
    const s = scoreCard(spending, luluCard, undefined, { LuLu: 0 });
    expect(s.grossAnnualValue).toEqual({ min: 120, max: 120 });
  });

  it("a share of 1 reproduces the no-share answer exactly", () => {
    const withShare = scoreCard(spending, luluCard, undefined, { LuLu: 1 });
    expect(withShare.grossAnnualValue).toEqual(scoreCard(spending, luluCard).grossAnnualValue);
  });
});

describe("rule 3 — cards bonusing the same merchant share ONE pool", () => {
  // Second LuLu card, deliberately WORSE (5%), so the allocator has a reason to
  // prefer the first and the test can tell "split the pool" from "each gets its own".
  const luluB = mkCard("LULU_B", {
    base_rate: "0.5% on all spend",
    categories: [{ category: "lulu_purchases", rate: "5%" }],
  });

  it("does not let a second LuLu card double the LuLu spend", () => {
    const { shares } = sanitizeMerchantShares({ LuLu: 0.3 });
    const res = earnAcrossCards(
      { groceries: 1000 },
      [precomputeCardData(luluCard), precomputeCardData(luluB)],
      shares,
    );
    const atLulu = res.optionOutcomes
      .filter((o) => o.merchantAssumption === "LuLu")
      .reduce((sum, o) => sum + o.monthlySpendAed, 0);
    // 30% of 1,000 — NOT 600, which is what a per-card cap would have allowed.
    expect(atLulu).toBeCloseTo(300, 6);
  });

  it("gives the shared pool to the better-paying card", () => {
    const { shares } = sanitizeMerchantShares({ LuLu: 0.3 });
    const res = earnAcrossCards(
      { groceries: 1000 },
      [precomputeCardData(luluCard), precomputeCardData(luluB)],
      shares,
    );
    const onA = res.optionOutcomes.find((o) => o.option.cardCategory === "lulu_supermarket");
    const onB = res.optionOutcomes.find((o) => o.option.cardCategory === "lulu_purchases");
    expect(onA?.monthlySpendAed).toBeCloseTo(300, 6); // the 10% card takes the pool
    expect(onB?.monthlySpendAed ?? 0).toBeCloseTo(0, 6);
  });
});

describe("rule 4 — invalid input falls back to 'unstated', never to the optimistic end", () => {
  it("rejects a percentage entered where a fraction belongs", () => {
    const { shares, issues } = sanitizeMerchantShares({ LuLu: 30 });
    expect(shares.size).toBe(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toContain("outside 0..1");
  });

  it("rejects a negative share and a non-finite one", () => {
    const { shares, issues } = sanitizeMerchantShares({ LuLu: -0.2, Emaar: NaN });
    expect(shares.size).toBe(0);
    expect(issues).toHaveLength(2);
  });

  it("scores a rejected share exactly as if it had never been given", () => {
    // 30 must NOT be read as "all of it". It falls back to the unstated behaviour,
    // which still carries the loud merchant flag — the user is not silently given
    // the maximally optimistic reading of their own typo.
    const bad = scoreCard({ groceries: 1000 }, luluCard, undefined, { LuLu: 30 });
    const none = scoreCard({ groceries: 1000 }, luluCard);
    expect(bad.grossAnnualValue).toEqual(none.grossAnnualValue);
    expect(bad.flags.some((f) => f.message.includes("spend occurs at"))).toBe(true);
  });

  it("matches merchant keys regardless of case and spacing", () => {
    const { shares } = sanitizeMerchantShares({ "  lulu ": 0.4 });
    expect(shareFor(shares, "LuLu")).toBe(0.4);
  });
});

describe("flags — a stated share is an INPUT, not an assumption we made", () => {
  it("flags an unstated merchant as an assumption, and marks the score uncertain", () => {
    const s = scoreCard({ groceries: 1000 }, luluCard);
    const flag = s.flags.find((f) => f.message.includes("spend occurs at"));
    expect(flag).toBeDefined();
    expect(s.uncertain).toBe(true);
  });

  it("states a supplied share without the 'spend occurs at' phrase or uncertainty", () => {
    const s = scoreCard({ groceries: 1000 }, luluCard, undefined, { LuLu: 0.25 });
    // The phrase is what the gap study's SOUND filter rejects on, so dropping it is
    // precisely the mechanism that moves a co-brand card into the publishable
    // universe. If this assertion ever fails, that mechanism has broken.
    expect(s.flags.some((f) => f.message.includes("spend occurs at"))).toBe(false);
    expect(s.flags.some((f) => f.message.includes("25% of your Groceries spend"))).toBe(true);
    expect(s.uncertain).toBe(false);
  });
});

describe("merchantShareQuestions — derived from the real card data", () => {
  const questions = merchantShareQuestions(realCards);

  it("asks about the merchants the real co-brand cards are locked to", () => {
    const names = questions.map((q) => q.merchant);
    for (const expected of ["LuLu", "Emaar", "noon", "Emirates", "Amazon"]) {
      expect(names).toContain(expected);
    }
  });

  it("names the canonical categories a share would affect", () => {
    const lulu = questions.find((q) => q.merchant === "LuLu");
    expect(lulu?.categories).toEqual(["groceries"]);
    // Emaar spans malls (other), hospitality (travel) and entertainment.
    const emaar = questions.find((q) => q.merchant === "Emaar");
    expect(emaar?.categories).toEqual(["travel", "entertainment", "other"]);
  });

  it("counts each affected card once and orders by that count", () => {
    for (const q of questions) {
      expect(q.cardCount).toBe(q.cardIds.length);
      expect(new Set(q.cardIds).size).toBe(q.cardIds.length);
    }
    const counts = questions.map((q) => q.cardCount);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("covers every merchant that can affect a real card's score", () => {
    // The question list drives the UI. A merchant that can change a score but is
    // never asked about would silently keep the old full-category assumption, which
    // is the failure this whole module exists to remove.
    const asked = new Set(questions.map((q) => q.merchant));
    for (const card of realCards) {
      if (card.excluded_from_scoring) continue;
      const s = scoreCard({ groceries: 2000, dining: 1500, travel: 1500, other: 1500 }, card);
      for (const f of s.flags) {
        const m = /spend occurs at (.+)$/.exec(f.message);
        if (m) expect(asked).toContain(m[1]!);
      }
    }
  });
});

describe("the real dataset — shares can only remove value, never add it", () => {
  /*
    The safety property. A share is a CAP on how much spend reaches a merchant
    bonus, so for any card and any profile, scoring with a share in [0,1] can never
    beat scoring without one. If this ever fails, the gate has stopped being a
    constraint and has started being a subsidy — which is how a modelling change
    turns into an overstatement.
  */
  const profile = {
    groceries: 2200, dining: 1800, fuel: 700, utilities: 700,
    travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400,
  };
  const shares = {
    LuLu: 0.3, Emaar: 0.15, noon: 0.1, Amazon: 0.15, Emirates: 0.3, Etihad: 0.1,
    "Air Arabia": 0.05, "Booking.com": 0.15, dnata: 0.1, Marriott: 0.1, RTA: 0.35,
    Talabat: 0.2, elGrocer: 0.05, "Dubai Duty Free": 0.05, "Smiles partners": 0.05,
    "Emirates Leisure": 0.03,
  };

  it("never scores a card higher with shares than without", () => {
    for (const card of realCards) {
      if (card.excluded_from_scoring) continue;
      const withShares = scoreCard(profile, card, undefined, shares);
      const without = scoreCard(profile, card);
      expect(withShares.grossAnnualValue.max).toBeLessThanOrEqual(
        without.grossAnnualValue.max + 1e-6,
      );
    }
  });

  it("actually bites — some real card scores lower once shares are applied", () => {
    // Guards against the inverse failure: a share model that is wired in but has no
    // effect would pass every assertion above and measure nothing. Same class of
    // bug as the dead study filters this project has hit twice.
    const moved = realCards.filter((card) => {
      if (card.excluded_from_scoring) return false;
      const a = scoreCard(profile, card, undefined, shares).grossAnnualValue.max;
      const b = scoreCard(profile, card).grossAnnualValue.max;
      return b - a > 1;
    });
    expect(moved.length).toBeGreaterThan(5);
  });
});
