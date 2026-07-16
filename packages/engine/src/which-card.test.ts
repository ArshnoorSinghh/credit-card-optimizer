import { describe, it, expect } from "vitest";
import type { Card } from "./card";
import { askWhichCard, bestCardForCategory, bestCardOverall } from "./which-card";
import { scoreCard } from "./score-card";

/** Minimal synthetic card; override only what a test cares about. */
function makeCard(over: Partial<Card> & { id: string; name: string }): Card {
  return {
    bank: "Test Bank",
    network: "Visa",
    tier: "Test",
    eligibility: {
      min_monthly_salary_aed: 0,
      uae_resident_required: false,
      min_age: 21,
      salary_transfer_required: false,
      employer_restrictions: null,
    },
    fees: { annual_fee_aed: 0, waiver_conditions: null, joining_fee_aed: 0 },
    rewards: {
      type: "cashback",
      currency: "AED", // valued 1.0 high -> clean, uncertainty-free numbers
      base_rate: "1% on all spend",
      categories: [],
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
    ...over,
  };
}

// 5% on groceries, 1% base, free.
const grocerHero = makeCard({
  id: "grocer_hero",
  name: "Grocer Hero",
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "1% on all spend",
    categories: [{ category: "groceries", rate: "5%", monthly_cap: null, annual_cap: null }],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

// No bonus categories at all — earns purely on its base rate.
const flatTwo = makeCard({
  id: "flat_two",
  name: "Flat Two",
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "2% on all spend",
    categories: [],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

// Same 5% groceries as grocerHero, but a hefty annual fee.
const premiumGrocer = makeCard({
  id: "premium_grocer",
  name: "Premium Grocer",
  fees: { annual_fee_aed: 4200, waiver_conditions: null, joining_fee_aed: 0 },
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "1% on all spend",
    categories: [{ category: "groceries", rate: "5%", monthly_cap: null, annual_cap: null }],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

// 5% groceries but capped at AED 100/month; overflow falls to the 1% base.
const cappedGrocer = makeCard({
  id: "capped_grocer",
  name: "Capped Grocer",
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "1% on all spend",
    categories: [{ category: "groceries", rate: "5%", monthly_cap: 100, annual_cap: null }],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

// Earns nothing, ever.
const deadCard = makeCard({
  id: "dead_card",
  name: "Dead Card",
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "0% on all spend",
    categories: [],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

const SPEND = 3000;

// A bonus that only pays at LuLu (MATCH_TABLE locks "lulu_supermarket" -> "LuLu").
const luluCard = makeCard({
  id: "lulu_card",
  name: "LuLu Card",
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "1% on all spend",
    categories: [{ category: "lulu_supermarket", rate: "5%", monthly_cap: null, annual_cap: null }],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

// A bonus that only pays at Emirates ("emirates_purchases" -> "Emirates").
const emiratesCard = makeCard({
  id: "emirates_card",
  name: "Emirates Card",
  rewards: {
    type: "cashback",
    currency: "AED",
    base_rate: "1% on all spend",
    categories: [{ category: "emirates_purchases", rate: "5%", monthly_cap: null, annual_cap: null }],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
});

describe("askWhichCard — merchant vs category: equal EXCEPT merchant-locked bonuses", () => {
  // The honest rule. Naming a merchant is strictly MORE information than naming a
  // category, and the extra information is the merchant locks: a category can't say
  // where you shopped, a merchant can. Everywhere no lock is involved, they agree.
  it("agree exactly when no merchant-locked bonus is involved", () => {
    const base = { monthlySpend: SPEND, userCards: [grocerHero, flatTwo], includeUnowned: false };
    const viaMerchant = askWhichCard({ ...base, merchantOrCategory: "Carrefour" });
    const viaCategory = askWhichCard({ ...base, merchantOrCategory: "groceries" });

    expect(viaMerchant.status).toBe("ok");
    expect(viaCategory.status).toBe("ok");
    if (viaMerchant.status !== "ok" || viaCategory.status !== "ok") return;

    expect(viaMerchant.resolvedCategory).toBe("groceries");
    expect(viaCategory.resolvedCategory).toBe("groceries");
    expect(viaMerchant.bestOwnedCard?.cardId).toBe(viaCategory.bestOwnedCard?.cardId);
    // Not just the same card — the same numbers.
    expect(viaMerchant.bestOwnedCard?.annualEarningsAed).toBe(viaCategory.bestOwnedCard?.annualEarningsAed);
  });

  it("DIVERGE where a bonus is locked to another merchant: no LuLu card for Carrefour", () => {
    const base = { monthlySpend: SPEND, userCards: [luluCard], includeUnowned: false };

    // Generic "groceries" can't know where you shopped, so the LuLu bonus is credited
    // (and flagged as an assumption) — 5% = 1800/yr.
    const generic = askWhichCard({ ...base, merchantOrCategory: "groceries" });
    if (generic.status !== "ok") throw new Error("expected ok");
    expect(generic.bestOwnedCard?.annualEarningsAed).toBe(1800);
    expect(generic.bestOwnedCard?.viaCardCategory).toBe("lulu_supermarket");

    // Naming Carrefour proves the LuLu bonus does NOT apply, so it's dropped and the
    // spend falls to the 1% base — exactly what happens at the till. 360/yr.
    const atCarrefour = askWhichCard({ ...base, merchantOrCategory: "Carrefour" });
    if (atCarrefour.status !== "ok") throw new Error("expected ok");
    expect(atCarrefour.bestOwnedCard?.annualEarningsAed).toBe(360);
    expect(atCarrefour.bestOwnedCard?.viaCardCategory).toBe("base_rate");
  });

  it("credits a merchant-locked bonus at ITS OWN merchant", () => {
    const base = { monthlySpend: SPEND, userCards: [luluCard], includeUnowned: false };
    const atLulu = askWhichCard({ ...base, merchantOrCategory: "Lulu" });
    if (atLulu.status !== "ok") throw new Error("expected ok");
    expect(atLulu.bestOwnedCard?.annualEarningsAed).toBe(1800);
    expect(atLulu.bestOwnedCard?.viaCardCategory).toBe("lulu_supermarket");
  });

  it("cuts both ways for airlines: Emirates keeps its bonus, Etihad drops it", () => {
    const base = { monthlySpend: SPEND, userCards: [emiratesCard], includeUnowned: false };

    const atEmirates = askWhichCard({ ...base, merchantOrCategory: "Emirates" });
    if (atEmirates.status !== "ok") throw new Error("expected ok");
    expect(atEmirates.bestOwnedCard?.annualEarningsAed).toBe(1800);
    expect(atEmirates.bestOwnedCard?.viaCardCategory).toBe("emirates_purchases");

    // Same travel category, different airline: the Emirates-locked bonus can't pay.
    const atEtihad = askWhichCard({ ...base, merchantOrCategory: "Etihad" });
    if (atEtihad.status !== "ok") throw new Error("expected ok");
    expect(atEtihad.bestOwnedCard?.annualEarningsAed).toBe(360);
    expect(atEtihad.bestOwnedCard?.viaCardCategory).toBe("base_rate");
  });

  it("does not upsell a merchant-locked card at the wrong merchant", () => {
    // The bug this fix exists for: "which card for Carrefour" must never answer
    // "get the LuLu card". flatTwo's honest 2% base beats luluCard's dropped bonus.
    const r = askWhichCard({
      merchantOrCategory: "Carrefour",
      monthlySpend: SPEND,
      userCards: [flatTwo],
      includeUnowned: true,
      allCards: [flatTwo, luluCard],
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard?.cardId).toBe("flat_two"); // 720/yr
    expect(r.bestUnownedCard).toBeUndefined(); // luluCard only manages 360/yr here
  });
});

describe("askWhichCard — how the input was resolved", () => {
  it("records whether it came from a merchant or a category, without changing the outcome", () => {
    const base = { monthlySpend: SPEND, userCards: [grocerHero, flatTwo], includeUnowned: false };
    const m = askWhichCard({ ...base, merchantOrCategory: "Carrefour" });
    const c = askWhichCard({ ...base, merchantOrCategory: "groceries" });
    if (m.status !== "ok" || c.status !== "ok") throw new Error("expected ok");

    expect(m.resolvedVia).toBe("merchant");
    expect(m.merchant).toBe("carrefour");
    expect(c.resolvedVia).toBe("category");
    expect(c.merchant).toBeUndefined();
  });
});

describe("askWhichCard — picking the winner", () => {
  it("picks the clear bonus winner", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [grocerHero, flatTwo],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    // 3000 * 5% = 150/mo -> 1800/yr, vs flatTwo's 2% = 60/mo -> 720/yr.
    expect(r.bestOwnedCard?.cardId).toBe("grocer_hero");
    expect(r.bestOwnedCard?.annualEarningsAed).toBe(1800);
    expect(r.bestOwnedCard?.monthlyEarningsAed).toBe(150);
    expect(r.bestOwnedCard?.viaCardCategory).toBe("groceries");
  });

  it("lets a base-rate-only card win when it out-earns a card with no matching bonus", () => {
    // On fuel, grocerHero has no bonus and drops to its 1% base (30/mo); flatTwo's
    // flat 2% base (60/mo) wins. The winner earns purely via its base rate.
    const r = askWhichCard({
      merchantOrCategory: "fuel",
      monthlySpend: SPEND,
      userCards: [grocerHero, flatTwo],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard?.cardId).toBe("flat_two");
    expect(r.bestOwnedCard?.annualEarningsAed).toBe(720); // 3000 * 2% * 12
    expect(r.bestOwnedCard?.viaCardCategory).toBe("base_rate");
  });

  it("ranks on EARNINGS, not net-of-fee — the fee on a card you hold is sunk", () => {
    // premiumGrocer earns the same 1800/yr but costs 4200/yr, so it is net-NEGATIVE
    // and optimizePortfolio would never hold it. For "which card do I swipe", it is
    // still the right answer: the fee is already paid either way.
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [premiumGrocer, flatTwo],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard?.cardId).toBe("premium_grocer");
    expect(r.bestOwnedCard?.annualEarningsAed).toBe(1800);
    // The fee is surfaced, not silently folded in.
    expect(r.bestOwnedCard?.annualFeeAed).toBe(4200);
  });

  it("breaks an exact tie deterministically (equal earnings -> lower fee)", () => {
    const r1 = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [premiumGrocer, grocerHero],
      includeUnowned: false,
    });
    const r2 = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [grocerHero, premiumGrocer], // reversed input order
      includeUnowned: false,
    });
    if (r1.status !== "ok" || r2.status !== "ok") throw new Error("expected ok");
    // Identical earnings (1800); the free card wins, regardless of input order.
    expect(r1.bestOwnedCard?.cardId).toBe("grocer_hero");
    expect(r2.bestOwnedCard?.cardId).toBe("grocer_hero");
  });
});

describe("askWhichCard — reuses the scorer's cap logic rather than reimplementing it", () => {
  it("applies the monthly cap and reroutes the overflow to the base rate", () => {
    // 5% of 3000 = 150/mo, capped to 100/mo -> 1200/yr. The productive 2000/mo is
    // capped out, so the remaining 1000/mo earns the 1% base = 10/mo -> 120/yr.
    // Total 1320/yr. None of that arithmetic lives in which-card.ts.
    const r = askWhichCard({
      merchantOrCategory: "Carrefour",
      monthlySpend: SPEND,
      userCards: [cappedGrocer],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard?.annualEarningsAed).toBe(1320);
  });

  it("returns exactly what scoreCard returns for the same single-category profile", () => {
    // The behavioural proof of reuse: identical numbers, including the capped card.
    for (const card of [grocerHero, flatTwo, cappedGrocer, premiumGrocer]) {
      const viaFeature = bestCardForCategory([card], "groceries", SPEND);
      const viaScorer = scoreCard({ groceries: SPEND }, card);
      const expected = (viaScorer.grossAnnualValue.min + viaScorer.grossAnnualValue.max) / 2;
      expect(viaFeature?.annualEarningsAed, card.id).toBe(expected);
    }
  });
});

describe("askWhichCard — multi-category merchants", () => {
  it("answers for the primary category and surfaces the ambiguity instead of guessing", () => {
    const r = askWhichCard({
      merchantOrCategory: "Talabat",
      monthlySpend: SPEND,
      userCards: [grocerHero, flatTwo],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.resolvedCategory).toBe("dining"); // the primary is what we score
    expect(r.multiCategory).toBe(true);
    expect(r.alsoCovers).toEqual(["groceries"]);
    // Scored as dining: grocerHero's groceries bonus does NOT apply, so both cards
    // fall to base and flatTwo's 2% wins. The UI can offer "ordering groceries?".
    expect(r.bestOwnedCard?.cardId).toBe("flat_two");
  });

  it("marks a single-category merchant as unambiguous", () => {
    const r = askWhichCard({
      merchantOrCategory: "Carrefour",
      monthlySpend: SPEND,
      userCards: [grocerHero],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.multiCategory).toBe(false);
    expect(r.alsoCovers).toBeUndefined();
  });
});

describe("askWhichCard — no cards, and nothing that earns", () => {
  it("handles owning zero cards without crashing", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard).toBeNull();
    expect(r.noOwnedCardReason).toContain("haven't added any cards");
  });

  it("says so when the cards owned earn nothing here", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [deadCard],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard).toBeNull();
    expect(r.noOwnedCardReason).toContain("None of your cards earns anything");
  });

  it("handles a zero-spend question without crashing", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: 0,
      userCards: [grocerHero],
      includeUnowned: false,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard).toBeNull(); // nothing spent, nothing earned
  });
});

describe("askWhichCard — unrecognized input", () => {
  it("returns a structured prompt, not a crash or a guess", () => {
    const r = askWhichCard({
      merchantOrCategory: "Whole Foods",
      monthlySpend: SPEND,
      userCards: [grocerHero],
      includeUnowned: false,
    });
    expect(r.status).toBe("unrecognized");
    if (r.status !== "unrecognized") return;
    expect(r.input).toBe("Whole Foods");
    expect(r.message).toContain("pick a category");
    expect(r.validCategories).toContain("groceries");
    expect(r.validCategories).toContain("dining");
  });

  it("treats empty input as unrecognized", () => {
    const r = askWhichCard({
      merchantOrCategory: "   ",
      monthlySpend: SPEND,
      userCards: [grocerHero],
      includeUnowned: false,
    });
    expect(r.status).toBe("unrecognized");
  });
});

describe("askWhichCard — the unowned-card upsell", () => {
  const allCards = [flatTwo, grocerHero, premiumGrocer];

  it("surfaces a better unowned card with the correct positive delta", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [flatTwo], // owns only the 2% flat card -> 720/yr
      includeUnowned: true,
      allCards,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard?.annualEarningsAed).toBe(720);
    expect(r.bestUnownedCard?.cardId).toBe("grocer_hero"); // 1800/yr, free
    expect(r.bestUnownedCard?.improvementAed).toBe(1080); // 1800 - 720
  });

  it("omits the upsell entirely when includeUnowned is false", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [flatTwo],
      includeUnowned: false,
      allCards,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestUnownedCard).toBeUndefined();
  });

  it("does not upsell when the user already holds the best card", () => {
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [grocerHero, flatTwo], // already holds the winner
      includeUnowned: true,
      allCards,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard?.cardId).toBe("grocer_hero");
    expect(r.bestUnownedCard).toBeUndefined();
  });

  it("never suggests a sideways move (improvement must be strictly positive)", () => {
    // premiumGrocer earns exactly what grocerHero earns (1800) — no improvement.
    const r = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: SPEND,
      userCards: [grocerHero],
      includeUnowned: true,
      allCards: [grocerHero, premiumGrocer],
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestUnownedCard).toBeUndefined();
  });

  it("still upsells when the user owns nothing at all", () => {
    const r = askWhichCard({
      merchantOrCategory: "Carrefour",
      monthlySpend: SPEND,
      userCards: [],
      includeUnowned: true,
      allCards,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.bestOwnedCard).toBeNull();
    expect(r.bestUnownedCard?.cardId).toBe("grocer_hero");
    expect(r.bestUnownedCard?.improvementAed).toBe(1800); // 1800 - 0
  });
});

describe("bestCardForCategory / bestCardOverall", () => {
  it("bestCardForCategory returns null for an empty wallet", () => {
    expect(bestCardForCategory([], "groceries", SPEND)).toBeNull();
  });

  it("bestCardOverall searches every card, owned or not", () => {
    const best = bestCardOverall([flatTwo, grocerHero], "groceries", SPEND);
    expect(best?.cardId).toBe("grocer_hero");
    expect(best?.annualEarningsAed).toBe(1800);
  });
});
