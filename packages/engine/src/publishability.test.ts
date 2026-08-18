/**
 * REGRESSION: a card whose own data record says its figures cannot be published
 * must never be RECOMMENDED.
 *
 * WHY THIS FILE EXISTS
 * `data_caveat` is where a reviewer records that a card's numbers are not trustworthy
 * enough to show a customer — the strongest form being "DO NOT PUBLISH pending
 * verification". Seven real cards carry it. `scoreCard` surfaced it as a flag, but
 * `optimizePortfolio` never read the field, and neither does the web layer.
 *
 * The result, measured before the fix, on a mid-range profile:
 *   best1: rakbank_world                               <- DO NOT PUBLISH
 *   best2: rakbank_titanium + rakbank_world             <- both DO NOT PUBLISH
 *   best3: adcb_365 + rakbank_titanium + rakbank_world  <- two DO NOT PUBLISH
 *   best3.uncertain === false
 * The product's top three answers were built on cards whose caveat text says their
 * implied return (12.5% of spend) exceeds anything a UAE card pays, and the receipt
 * did not mention it. The gap study already filters these into its "PUBLISHABLE"
 * universe; the product path did not.
 *
 * THE RULE BEING PINNED
 * A card marked "do not publish" is excluded from portfolio ranking and from
 * unowned-card suggestions — the two places the engine tells someone to ACQUIRE a
 * card. It is still scored on request (a user who already holds it deserves an
 * honest number) and still carries its loud flag.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";
import { scoreCard, type SpendingProfile } from "./score-card";
import { askWhichCard } from "./which-card";

const realCards = cardsData as Card[];
const isDoNotPublish = (c: Card) => (c.data_caveat ?? "").toLowerCase().includes("do not publish");

const PROFILE: SpendingProfile = {
  groceries: 2200, dining: 1800, fuel: 700, utilities: 700, education: 0,
  travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400,
};
const USER: UserProfile = { monthlySalaryAed: 30000, uaeResident: true };

function mkCard(id: string, caveat?: string, rate = "5%"): Card {
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
      base_rate: "0% on all spend",
      categories: [{ category: "groceries", rate, monthly_cap: null, annual_cap: null }],
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
    ...(caveat ? { data_caveat: caveat } : {}),
  };
}

describe("publishability - do-not-publish cards are never recommended", () => {
  it("drops the caveated card even when it is comfortably the best", () => {
    const cards = [
      mkCard("LOUD", "DO NOT PUBLISH pending verification of the cap schedule.", "20%"),
      mkCard("QUIET", undefined, "3%"),
    ];
    const r = optimizePortfolio({ groceries: 1000 }, USER, cards);
    expect(r.best1?.cardIds).toEqual(["QUIET"]);
    expect(r.overallBest?.cardIds).toEqual(["QUIET"]);
    expect(r.best2).toBeNull(); // only one publishable card survives
  });

  it("reports the exclusion in the result counts, separately from benching", () => {
    const cards = [
      mkCard("LOUD", "DO NOT PUBLISH pending verification.", "20%"),
      mkCard("QUIET"),
    ];
    const r = optimizePortfolio({ groceries: 1000 }, USER, cards);
    expect(r.excludedForDataCaveat).toBe(1);
    expect(r.eligibleCardCount).toBe(1);
    expect(r.benchedCount).toBe(0);
  });

  /**
   * The escape hatch, and why it must exist. The app's baseline ("what your current
   * wallet already earns") scores the user's HELD cards through this same function.
   * Dropping a held card there would understate their wallet and therefore inflate
   * the gain we advertise from switching — the exact harm the exclusion prevents.
   */
  it("scores a caveated card when the caller opts in (the held-cards baseline)", () => {
    const cards = [
      mkCard("LOUD", "DO NOT PUBLISH pending verification.", "20%"),
      mkCard("QUIET", undefined, "3%"),
    ];
    const r = optimizePortfolio({ groceries: 1000 }, USER, cards, undefined, {
      includeUnpublishable: true,
    });
    expect(r.eligibleCardCount).toBe(2);
    expect(r.excludedForDataCaveat).toBe(0);
    expect(r.best1?.cardIds).toEqual(["LOUD"]); // 20% x 1000 x 12 = 2,400/yr
    expect(r.best1?.netAnnualValue).toBe(2400);
  });

  it("keeps an ordinary (non-publication-blocking) data_caveat in the ranking", () => {
    // Only the explicit "do not publish" wording blocks recommendation; a softer
    // caveat stays rankable and merely flags, so we don't silently shrink the market.
    const cards = [
      mkCard("SOFT", "Earn rate looks high; verify against the issuer table.", "20%"),
      mkCard("QUIET", undefined, "3%"),
    ];
    const r = optimizePortfolio({ groceries: 1000 }, USER, cards);
    expect(r.best1?.cardIds).toEqual(["SOFT"]);
    expect(r.excludedForDataCaveat).toBe(0);
  });
});

describe("publishability - real dataset", () => {
  it("has do-not-publish cards to exclude (guards the test's own premise)", () => {
    expect(realCards.filter(isDoNotPublish).length).toBeGreaterThan(0);
  });

  it("returns no do-not-publish card at any portfolio size", () => {
    const banned = new Set(realCards.filter(isDoNotPublish).map((c) => c.id));
    const r = optimizePortfolio(PROFILE, USER, realCards);
    for (const p of [r.best1, r.best2, r.best3, r.overallBest]) {
      if (!p) continue;
      expect(p.cardIds.filter((id) => banned.has(id))).toEqual([]);
    }
  });

  it("still scores a caveated card on request, with a loud flag", () => {
    // Chosen by PROPERTY, not by id: any do-not-publish card that is scoreable.
    // An earlier revision named rakbank_world, and when its hold was lifted (D16)
    // this test started asserting against a card that no longer had the caveat.
    // Deriving the fixture keeps the test measuring the rule rather than the roster.
    const caveated = realCards.find((c) => isDoNotPublish(c) && !c.excluded_from_scoring)!;
    expect(caveated, "no scoreable do-not-publish card left to test with").toBeDefined();
    const s = scoreCard(PROFILE, caveated);
    expect(s.benched).toBe(false);
    expect(s.uncertain).toBe(true);
    expect(s.flags.some((f) => f.level === "unknown" && /data caveat/i.test(f.message))).toBe(true);
  });
});

describe("publishability - which-card never suggests acquiring a caveated card", () => {
  const owned = realCards.filter((c) => c.id === "hsbc_live_plus");

  it("excludes do-not-publish cards from the unowned suggestion", () => {
    const banned = new Set(realCards.filter(isDoNotPublish).map((c) => c.id));
    for (const category of ["groceries", "dining", "travel", "entertainment"] as const) {
      const a = askWhichCard({
        merchantOrCategory: category,
        monthlySpend: 2000,
        userCards: owned,
        includeUnowned: true,
        allCards: realCards,
      });
      if (a.status !== "ok" || !a.bestUnownedCard) continue;
      expect(banned.has(a.bestUnownedCard.cardId), `${category} suggested ${a.bestUnownedCard.cardId}`).toBe(false);
    }
  });

  it("still answers honestly about a caveated card the user already owns", () => {
    // Derived, for the same reason as above: the first scoreable do-not-publish card
    // that actually earns something on groceries, so a null answer means the rule
    // broke rather than the fixture being a card with no grocery rate.
    const caveated = realCards.find(
      (c) =>
        isDoNotPublish(c) &&
        !c.excluded_from_scoring &&
        scoreCard({ groceries: 2000 }, c).grossAnnualValue.max > 0,
    )!;
    expect(caveated, "no scoreable do-not-publish card earns on groceries").toBeDefined();
    const a = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: 2000,
      userCards: [caveated],
      includeUnowned: false,
    });
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    expect(a.bestOwnedCard?.cardId).toBe(caveated.id);
  });
});
