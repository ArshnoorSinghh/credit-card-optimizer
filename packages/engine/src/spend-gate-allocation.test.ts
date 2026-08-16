/**
 * REGRESSION: a card's minimum-spend gate must be judged on the spend the
 * allocator actually routes TO THAT CARD, not on the user's total profile spend.
 *
 * WHY THIS FILE EXISTS
 * `min_monthly_spend_required_aed` is a threshold on ONE card's own monthly spend.
 * The engine used to evaluate it against TOTAL profile spend, which is an upper
 * bound — so every gated card was scored with its bonus rates switched ON even when
 * the portfolio the optimizer recommended would split spend and leave that card far
 * below its threshold.
 *
 * The failure is self-referential, which is what made it dangerous: the optimizer's
 * own recommended split destroyed the assumption used to score the split. Measured
 * on the real dataset before the fix, all four spending archetypes recommended a
 * 3-card portfolio whose cards ALL fell under their thresholds, and in every case
 * the engine's own best SINGLE card beat the recommended portfolio in reality. On a
 * mid-range profile the claimed AED 9,859/yr was actually worth AED 127/yr.
 *
 * 15 of 53 scoreable cards carry such a threshold, and they skew toward the
 * high-value cashback cards — so they win the enumeration and then break.
 *
 * These cases use synthetic cards so the hand math is checkable by eye.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";
import { earnAcrossCards, precomputeCardData, scoreCard, type SpendingProfile } from "./score-card";

const realCards = cardsData as Card[];
const OPEN: UserProfile = { monthlySalaryAed: 100000, uaeResident: true };

function mkCard(
  id: string,
  o: {
    categories?: { category: string; rate: string; monthly_cap?: number | null }[];
    base_rate?: string;
    minSpend?: number;
    gateMode?: "degrade" | "forfeit";
    fee?: number;
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
    fees: { annual_fee_aed: o.fee ?? 0, waiver_conditions: null, joining_fee_aed: 0 },
    rewards: {
      type: "cashback",
      currency: "AED",
      base_rate: o.base_rate ?? "0% on all spend",
      categories: (o.categories ?? []).map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthly_cap ?? null,
        annual_cap: null,
      })),
      overall_cap: null,
      min_monthly_spend_required_aed: o.minSpend ?? 0,
      ...(o.gateMode ? { gate_mode: o.gateMode } : {}),
    },
    redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
    benefits: [],
    source_url: "",
  };
}

/**
 * Case 1 — THE CORE DEFECT.
 *
 *   GATED: needs AED 2,000/mo on the card. groceries 10%, base 1%.
 *   PLAIN: dining 5%, base 0%.
 *   Spend: groceries 1,500 + dining 1,000 = 2,500/mo total.
 *
 * Total spend (2,500) clears GATED's threshold, so the OLD engine scored GATED
 * with its bonus ON inside the pair. But the allocator sends dining to PLAIN (5%
 * beats GATED's 1% base), so GATED actually receives only groceries = 1,500/mo,
 * which is BELOW its 2,000 threshold. Its 10% must therefore switch off.
 *
 * Hand math for the PAIR, with the gate honoured (GATED degraded to base only):
 *   groceries 1,500 -> GATED base 1%  =  15/mo    (PLAIN's base is 0%, so GATED wins)
 *   dining     1,000 -> PLAIN 5%       =  50/mo
 *   total 65/mo = AED 780/yr.
 * The old, wrong answer was 1,500x10% + 1,000x5% = 200/mo = AED 2,400/yr.
 *
 * Hand math for GATED ALONE: it sees all 2,500/mo, so the gate is genuinely met:
 *   groceries 1,500 x 10% = 150/mo;  dining 1,000 x base 1% = 10/mo
 *   total 160/mo = AED 1,920/yr.
 *
 * So the single card genuinely beats the pair — and the optimizer must say so.
 */
describe("spend gate — judged on allocated spend, not total profile spend", () => {
  const cards = [
    mkCard("GATED", {
      categories: [{ category: "groceries", rate: "10%" }],
      base_rate: "1% on all spend",
      minSpend: 2000,
    }),
    mkCard("PLAIN", { categories: [{ category: "dining", rate: "5%" }] }),
  ];
  const spending: SpendingProfile = { groceries: 1500, dining: 1000 };
  const result = optimizePortfolio(spending, OPEN, cards);

  it("scores the lone gated card with its bonus ON — it really does see all the spend", () => {
    expect(result.best1?.cardIds).toEqual(["GATED"]);
    expect(result.best1?.grossAnnualValue).toEqual({ min: 1920, max: 1920 });
  });

  it("switches the bonus OFF in the pair, where the split starves the threshold", () => {
    expect(result.best2?.cardIds).toEqual(["GATED", "PLAIN"]);
    // 780, NOT the old 2400 — the 10% cannot be earned on 1,500/mo of card spend.
    expect(result.best2?.grossAnnualValue).toEqual({ min: 780, max: 780 });
  });

  it("therefore recommends the single card over the pair", () => {
    expect(result.overallBest?.cardIds).toEqual(["GATED"]);
    expect(result.overallBest?.netAnnualValue).toBe(1920);
  });

  it("explains the gate in the receipt, quoting what the card actually receives", () => {
    const msg = result.best2?.flags.map((f) => f.message).join(" | ") ?? "";
    expect(msg).toMatch(/minimum spend/i);
    expect(msg).toMatch(/1,?500/); // the ALLOCATED figure, not the 2,500 profile total
  });
});

/**
 * Case 2 — "forfeit" mode: falling short zeroes the cycle, it does not fall back
 * to base. Same shape as case 1, but GATED forfeits.
 *
 * In the pair GATED receives 1,500 < 3,000 and so earns NOTHING at all; groceries
 * has nowhere else to go (PLAIN's base is 0%), so only dining earns:
 *   dining 1,000 x 5% = 50/mo = AED 600/yr.
 */
describe("spend gate — forfeit mode zeroes the card when the allocation starves it", () => {
  const cards = [
    mkCard("FORFEIT", {
      categories: [{ category: "groceries", rate: "10%" }],
      base_rate: "1% on all spend",
      minSpend: 3000,
      gateMode: "forfeit",
    }),
    mkCard("PLAIN", { categories: [{ category: "dining", rate: "5%" }] }),
  ];
  const result = optimizePortfolio({ groceries: 1500, dining: 1000 }, OPEN, cards);

  it("earns nothing on the forfeiting card", () => {
    expect(result.best2?.grossAnnualValue).toEqual({ min: 600, max: 600 });
  });
});

/**
 * Case 3 — a gate that IS satisfied by the allocation must still pay out. The fix
 * must not simply switch every gated card off.
 *
 *   GATED: needs 1,000/mo. groceries 10%, base 1%.  PLAIN: dining 5%.
 *   Spend: groceries 2,000 + dining 1,000.
 * GATED receives 2,000 >= 1,000, so its 10% stands:
 *   2,000 x 10% = 200/mo, dining 1,000 x 5% = 50/mo -> 250/mo = AED 3,000/yr.
 */
describe("spend gate — a satisfied threshold still pays the bonus", () => {
  const cards = [
    mkCard("GATED", {
      categories: [{ category: "groceries", rate: "10%" }],
      base_rate: "1% on all spend",
      minSpend: 1000,
    }),
    mkCard("PLAIN", { categories: [{ category: "dining", rate: "5%" }] }),
  ];
  const result = optimizePortfolio({ groceries: 2000, dining: 1000 }, OPEN, cards);

  it("keeps the bonus on and matches hand math", () => {
    expect(result.best2?.grossAnnualValue).toEqual({ min: 3000, max: 3000 });
    expect(result.best2?.flags.some((f) => /minimum spend/i.test(f.message))).toBe(false);
  });
});

/**
 * Case 4 — single-card scoring is unchanged: a lone card genuinely receives the
 * whole profile, so total spend IS its allocated spend. This pins the property
 * that made the old shortcut defensible for `scoreCard`, `which-card` and
 * comparison views, none of which split spend.
 */
describe("spend gate — single-card scoring is exact and unchanged", () => {
  const card = mkCard("SOLO", {
    categories: [{ category: "groceries", rate: "10%" }],
    base_rate: "1% on all spend",
    minSpend: 2000,
  });

  it("pays the bonus when the whole profile clears the threshold", () => {
    const s = scoreCard({ groceries: 1500, dining: 1000 }, card);
    expect(s.grossAnnualValue).toEqual({ min: 1920, max: 1920 });
  });

  it("degrades to base when the whole profile falls short", () => {
    const s = scoreCard({ groceries: 500, dining: 400 }, card);
    // below 2,000: base 1% on all 900/mo = 9/mo = 108/yr
    expect(s.grossAnnualValue).toEqual({ min: 108, max: 108 });
    expect(s.flags.some((f) => /minimum spend/i.test(f.message))).toBe(true);
  });
});

/**
 * Case 5 — SELF-CONSISTENCY on the real dataset. For every recommended portfolio,
 * each card that was scored with its bonus rates active must actually receive at
 * least its threshold. This is the invariant whose violation made the old
 * recommendations unachievable; it is checked across several archetypes.
 */
describe("spend gate — real-data recommendations are self-consistent", () => {
  const PROFILES: { name: string; salary: number; spend: SpendingProfile }[] = [
    { name: "early-career", salary: 12000,
      spend: { groceries: 900, dining: 700, fuel: 400, utilities: 350, travel: 200, transport: 250, entertainment: 250, international: 150, other: 500 } },
    { name: "family school fees", salary: 35000,
      spend: { groceries: 3000, dining: 1500, fuel: 900, utilities: 900, education: 4000, travel: 1200, transport: 400, entertainment: 600, international: 700, other: 1500 } },
    { name: "dual-income", salary: 30000,
      spend: { groceries: 2200, dining: 1800, fuel: 700, utilities: 700, travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400 } },
    { name: "frequent traveller", salary: 60000,
      spend: { groceries: 2000, dining: 3000, fuel: 800, utilities: 700, travel: 5000, transport: 600, entertainment: 1200, international: 4000, other: 2500 } },
  ];

  for (const p of PROFILES) {
    it(`${p.name}: every bonus-earning card clears its own threshold`, () => {
      const r = optimizePortfolio(p.spend, { monthlySalaryAed: p.salary, uaeResident: true }, realCards);
      for (const portfolio of [r.best1, r.best2, r.best3]) {
        if (!portfolio) continue;
        const cds = portfolio.cardIds.map((id) => precomputeCardData(realCards.find((c) => c.id === id)!));
        const res = earnAcrossCards(p.spend, cds);

        // Monthly spend the allocator actually routed to each card.
        const allocated = new Map<string, number>();
        for (const s of res.slices) {
          const id = cds[s.cardIndex]!.card.id;
          allocated.set(id, (allocated.get(id) ?? 0) + s.monthlySpendAed);
        }

        res.cards.forEach((cd, i) => {
          const threshold = cd.card.rewards.min_monthly_spend_required_aed ?? 0;
          if (threshold <= 0) return;
          // A card still holding a bonus (non-catchall) option was scored as ON.
          const bonusActive = cd.options.some((o) => o.rule.kind === "categories");
          if (!bonusActive) return;
          const got = allocated.get(cd.card.id) ?? 0;
          expect(
            got,
            `${portfolio.cardIds.join("+")}: ${cd.card.id} scored with bonuses on but receives ${got.toFixed(0)}/mo < ${threshold}`,
          ).toBeGreaterThanOrEqual(threshold - 1e-6);
          void i;
        });
      }
    });
  }
});
