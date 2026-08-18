import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { capThresholds } from "./cap-thresholds";
import { optionSpendThresholds, precomputeCardData, type SpendingProfile } from "./score-card";

const realCards = cardsData as Card[];
const byId = (id: string): Card => {
  const c = realCards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

/** A cashback card whose caps are quoted in AED, so the arithmetic is checkable by hand. */
function mkCard(o: {
  id?: string;
  base?: string;
  categories: { category: string; rate: string; monthly_cap?: number | null; annual_cap?: number | null }[];
}): Card {
  return {
    id: o.id ?? "TEST",
    name: o.id ?? "TEST",
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
      base_rate: o.base ?? "1% on all spend",
      categories: o.categories.map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthly_cap ?? null,
        annual_cap: c.annual_cap ?? null,
      })),
      overall_cap: null,
      min_monthly_spend_required_aed: 0,
    },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };
}

describe("optionSpendThresholds - each cap in its OWN period, never converted", () => {
  /*
    The honesty point of the whole module. `optionCapacityAnnualAed` deliberately
    collapses both caps into one annual number for the flow solver, carrying the
    engine's even-monthly-spend assumption. Telling a USER "after AED X this month"
    must not carry it: a monthly cap is a fact about a month.
  */
  it("converts a monthly AED cap into an exact monthly spend threshold", () => {
    // 5% cashback, AED 300/month cap -> the bonus stops after 300/0.05 = AED 6,000.
    const card = mkCard({ categories: [{ category: "supermarkets", rate: "5%", monthly_cap: 300 }] });
    const cd = precomputeCardData(card);
    const option = cd.options.find((o) => o.cardCategory === "supermarkets")!;
    const t = optionSpendThresholds(option, cd.aedPerUnit);
    expect(t).toEqual([{ period: "monthly", spendAed: 6000 }]);
  });

  it("reports a monthly and an annual cap separately, never blending them", () => {
    const card = mkCard({
      categories: [{ category: "supermarkets", rate: "5%", monthly_cap: 300, annual_cap: 2400 }],
    });
    const cd = precomputeCardData(card);
    const option = cd.options.find((o) => o.cardCategory === "supermarkets")!;
    const t = optionSpendThresholds(option, cd.aedPerUnit);
    // 300/0.05 = 6,000 monthly; 2,400/0.05 = 48,000 annual. NOT min(300*12, 2400).
    expect(t).toEqual([
      { period: "monthly", spendAed: 6000 },
      { period: "annual", spendAed: 48000 },
    ]);
  });

  it("returns nothing for an uncapped option", () => {
    const card = mkCard({ categories: [{ category: "supermarkets", rate: "5%" }] });
    const cd = precomputeCardData(card);
    const option = cd.options.find((o) => o.cardCategory === "supermarkets")!;
    expect(optionSpendThresholds(option, cd.aedPerUnit)).toEqual([]);
  });
});

describe("capThresholds - the switch target", () => {
  const capped = mkCard({
    id: "CAPPED",
    base: "0.5% on all spend",
    categories: [{ category: "supermarkets", rate: "5%", monthly_cap: 300 }],
  });
  const flat = mkCard({ id: "FLAT", base: "2% on all spend", categories: [] });
  const spending: SpendingProfile = { groceries: 8000 };

  it("names the best of the user's OTHER cards, never the capped one", () => {
    /*
      Once the cap binds, the capped card is not a candidate for the marginal dirham
      at all. Leaving it in the pool could return the very card the user is being
      told to stop using — which would read as advice to keep swiping it.
    */
    const report = capThresholds([capped, flat], spending);
    const t = report.thresholds.find((x) => x.cardId === "CAPPED")!;
    expect(t.switchTo).toHaveLength(1);
    expect(t.switchTo[0]!.cardId).toBe("FLAT");
    expect(t.switchTo[0]!.spendCategory).toBe("groceries");
  });

  it("returns an empty switch list when the user holds nothing else", () => {
    // Worth saying out loud rather than omitting: "there is nowhere better to put it"
    // is a real answer, and an absent field would read as a missing computation.
    const report = capThresholds([capped], spending);
    const t = report.thresholds.find((x) => x.cardId === "CAPPED")!;
    expect(t.switchTo).toEqual([]);
  });

  it("does not offer a switch for a category the user does not spend in", () => {
    const multi = mkCard({
      id: "MULTI",
      categories: [{ category: "supermarkets_fuel_dining", rate: "5%", monthly_cap: 300 }],
    });
    // Groceries only; no fuel, no dining.
    const report = capThresholds([multi, flat], { groceries: 8000 });
    const t = report.thresholds.find((x) => x.cardId === "MULTI")!;
    expect(t.switchTo.map((s) => s.spendCategory)).toEqual(["groceries"]);
  });
});

describe("capThresholds - reached, proximity and ordering", () => {
  const capped = mkCard({
    id: "CAPPED",
    categories: [{ category: "supermarkets", rate: "5%", monthly_cap: 300 }],
  });

  it("marks a threshold the user's spend exceeds as reached", () => {
    const report = capThresholds([capped], { groceries: 8000 });
    const t = report.thresholds[0]!;
    expect(t.thresholdAed).toBe(6000);
    expect(t.yourSpendAed).toBe(8000);
    expect(t.reached).toBe(true);
    expect(t.detail).toMatch(/stops paying after AED 6,000/);
  });

  it("reports an unreachable threshold as such rather than hiding it", () => {
    const report = capThresholds([capped], { groceries: 1000 });
    const t = report.thresholds[0]!;
    expect(t.reached).toBe(false);
    expect(t.detail).toMatch(/would not reach it/);
  });

  it("does not call an EXACT tie 'reached' - the float-chain regression", () => {
    /*
      Found by rendering the real screen. fab_cashback pays 5% capped at AED 150/mo,
      which is exactly AED 3,000 of spend — but the cap travels a float chain (AED cap
      -> reward units -> AED of spend) and lands on 2999.9999999999995. A user
      spending precisely AED 3,000 therefore "exceeded" it by 4.5e-13, and the page
      printed REACHED next to two numbers both rounded to "AED 3,000".

      Ties resolve to NOT reached, which is also the conservative direction: it never
      tells someone to stop using a card whose bonus is still paying.
    */
    const real = byId("fab_cashback");
    const report = capThresholds([real], { groceries: 3000 });
    const grocery = report.thresholds.find((t) => t.spendCategories.includes("groceries"))!;
    expect(grocery).toBeDefined();
    // The float error is still there — this test pins the COMPARISON, not the arithmetic.
    expect(grocery.thresholdAed).toBeCloseTo(3000, 6);
    expect(grocery.yourSpendAed).toBe(3000);
    expect(grocery.reached).toBe(false);
  });

  it("still reports reached one dirham over the line", () => {
    // The other side of the tolerance: it must not be so wide that it swallows a
    // genuine crossing.
    const report = capThresholds([byId("fab_cashback")], { groceries: 3001 });
    const grocery = report.thresholds.find((t) => t.spendCategories.includes("groceries"))!;
    expect(grocery.reached).toBe(true);
  });

  it("does not tell a user at the cap that they 'would not reach it'", () => {
    /*
      The wording half of the tie regression above. `reached` was already correct, but
      the sentence it produced printed "AED 3,000" twice and then denied they were the
      same: "stops paying after AED 3,000 ... on your stated spend of AED 3,000 you
      would not reach it." Spend sitting exactly on the cap earns the bonus on all of
      it, which is what the copy now says.
    */
    const report = capThresholds([byId("fab_cashback")], { groceries: 3000 });
    const grocery = report.thresholds.find((t) => t.spendCategories.includes("groceries"))!;
    expect(grocery.reached).toBe(false);
    expect(grocery.detail).toMatch(/reaches that exactly/);
    expect(grocery.detail).not.toMatch(/would not reach it/);
  });

  it("does not print two identical figures and assert a difference", () => {
    // A genuine near-miss, not a float artefact: AED 2,999.60 of spend against a
    // AED 3,000 threshold. Both round to "AED 3,000" for display, so the sentence
    // must not claim an ordering the reader cannot see.
    const report = capThresholds([byId("fab_cashback")], { groceries: 2999.6 });
    const grocery = report.thresholds.find((t) => t.spendCategories.includes("groceries"))!;
    expect(grocery.reached).toBe(false);
    expect(grocery.detail).toMatch(/just under that/);
  });

  it("names a category so it reads as English inside the sentence", () => {
    // "AED 3,000 of other this month" is the storage key leaking into prose. Every
    // other category is already a noun and is left alone.
    const otherCapped = mkCard({
      id: "OTHERCAP",
      categories: [{ category: "fashion", rate: "5%", monthly_cap: 300 }],
    });
    const report = capThresholds([otherCapped], { other: 1000 });
    const t = report.thresholds[0]!;
    expect(t.spendCategories).toContain("other");
    expect(t.detail).toMatch(/of other spending this month/);
    expect(t.detail).not.toMatch(/of other this month/);
  });

  it("compares an ANNUAL cap against annualised spend", () => {
    const annual = mkCard({
      id: "ANNUAL",
      categories: [{ category: "supermarkets", rate: "5%", annual_cap: 3000 }],
    });
    // 3,000 / 0.05 = AED 60,000 of annual grocery spend. 6,000/mo x 12 = 72,000 > that.
    const report = capThresholds([annual], { groceries: 6000 });
    const t = report.thresholds[0]!;
    expect(t.period).toBe("annual");
    expect(t.thresholdAed).toBe(60000);
    expect(t.yourSpendAed).toBe(72000);
    expect(t.reached).toBe(true);
  });

  it("orders by proximity, not by cap size", () => {
    /*
      A small cap on a card the user leans on matters more than a huge cap they never
      approach. Sorting on the raw AED would invert that.
    */
    const near = mkCard({ id: "NEAR", categories: [{ category: "supermarkets", rate: "5%", monthly_cap: 300 }] });
    const far = mkCard({ id: "FAR", categories: [{ category: "dining", rate: "5%", monthly_cap: 5000 }] });
    const report = capThresholds([near, far], { groceries: 5800, dining: 1000 });
    expect(report.thresholds.every((t) => !t.reached)).toBe(true);
    expect(report.thresholds[0]!.cardId).toBe("NEAR"); // 5800/6000 vs 1000/100000
  });

  it("puts reached thresholds first", () => {
    const near = mkCard({ id: "NEAR", categories: [{ category: "supermarkets", rate: "5%", monthly_cap: 300 }] });
    const far = mkCard({ id: "FAR", categories: [{ category: "dining", rate: "5%", monthly_cap: 5000 }] });
    const report = capThresholds([near, far], { groceries: 9000, dining: 1000 });
    expect(report.thresholds[0]!.reached).toBe(true);
    expect(report.thresholds[0]!.cardId).toBe("NEAR");
  });
});

describe("capThresholds - refuses to state a threshold off a midpoint", () => {
  /*
    A merchant-locked bonus with no stated share is bounded 0..full and the scorer
    routes it on the midpoint. Dividing a cap by that midpoint yields a confident
    number roughly DOUBLE the real threshold. It must not be stated — and, on the
    same principle as the calendar's `undated` list, must not be silently dropped
    either.
  */
  it("moves a merchant-locked capped bonus to `unstated`, naming the merchant", () => {
    const lulu = mkCard({
      id: "LULU",
      categories: [{ category: "lulu_supermarket", rate: "8%", monthly_cap: 200 }],
    });
    const report = capThresholds([lulu], { groceries: 5000 });
    expect(report.thresholds).toHaveLength(0);
    expect(report.unstated).toHaveLength(1);
    expect(report.unstated[0]!.reason).toContain("LuLu");
    expect(report.unstated[0]!.reason).toMatch(/range, not a number/);
  });

  it("states it normally once the share is known - proving the bound is the reason", () => {
    /*
      The control for the test above. With `merchantLocksResolved` the rate is a real
      number again, so a threshold IS statable. If this ever failed while the test
      above passed, the exclusion would be about merchant-locks in general rather
      than about the rate being a range.
    */
    const lulu = mkCard({
      id: "LULU",
      categories: [{ category: "lulu_supermarket", rate: "8%", monthly_cap: 200 }],
    });
    const cd = precomputeCardData(lulu, undefined, { merchantLocksResolved: true });
    const option = cd.options.find((o) => o.cardCategory === "lulu_supermarket")!;
    expect(option.rate.value).not.toBeNull();
    // 200 / 0.08 = AED 2,500.
    expect(optionSpendThresholds(option, cd.aedPerUnit)).toEqual([
      { period: "monthly", spendAed: 2500 },
    ]);
  });

  it("accounts for every capped bonus as either stated or unstated", () => {
    // The arithmetic that makes silent omission impossible, mirroring the calendar.
    const mixed = mkCard({
      id: "MIXED",
      categories: [
        { category: "supermarkets", rate: "5%", monthly_cap: 300 },
        { category: "lulu_supermarket", rate: "8%", monthly_cap: 200 },
      ],
    });
    const report = capThresholds([mixed], { groceries: 5000 });
    expect(report.thresholds).toHaveLength(1);
    expect(report.unstated).toHaveLength(1);
  });
});

describe("capThresholds - against the real dataset", () => {
  const spending: SpendingProfile = {
    groceries: 3000, dining: 2000, fuel: 900, utilities: 700,
    travel: 1200, transport: 400, entertainment: 600, international: 700, other: 1500,
  };

  it("finds real capped bonuses and states them all exactly", () => {
    // Liveness: a threshold engine that found nothing would pass every assertion
    // above while measuring nothing — the failure mode this project keeps hitting.
    const held = [byId("adcb_365_cashback"), byId("fab_cashback"), byId("mashreq_cashback")];
    const report = capThresholds(held, spending);
    expect(report.thresholds.length).toBeGreaterThan(0);
    for (const t of report.thresholds) {
      expect(t.thresholdAed).toBeGreaterThan(0);
      expect(Number.isFinite(t.thresholdAed)).toBe(true);
      expect(t.spendCategories.length).toBeGreaterThan(0);
      expect(t.detail.length).toBeGreaterThan(0);
    }
  });

  it("never names the capped card as its own switch target", () => {
    const held = realCards.slice(0, 25);
    const report = capThresholds(held, spending);
    for (const t of report.thresholds) {
      for (const s of t.switchTo) expect(s.cardId).not.toBe(t.cardId);
    }
  });
});
