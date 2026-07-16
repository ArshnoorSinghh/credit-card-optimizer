/**
 * Reuse guard — "which card should I use" must go through the EXISTING scorer.
 *
 * The requirement is one source of truth: no second implementation of rate parsing,
 * category matching or cap arithmetic. A behavioural equality check lives in
 * which-card.test.ts; this file proves the call actually happens, so the property
 * can't be satisfied by a lookalike reimplementation that merely agrees today.
 *
 * The mock wraps the REAL scoreCard, so behaviour is unchanged — we only observe.
 * It lives in its own file because vi.mock is hoisted to the whole module graph.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { Card } from "./card";

vi.mock("./score-card", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./score-card")>();
  return { ...actual, scoreCard: vi.fn(actual.scoreCard) };
});

import { scoreCard } from "./score-card";
import { askWhichCard, bestCardForCategory } from "./which-card";

const card: Card = {
  id: "probe",
  name: "Probe",
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
    currency: "AED",
    base_rate: "1% on all spend",
    categories: [{ category: "groceries", rate: "5%", monthly_cap: null, annual_cap: null }],
    overall_cap: null,
    min_monthly_spend_required_aed: 0,
  },
  redemption: { currency: "AED", primary_uses: [], redemption_url: "" },
  benefits: [],
  source_url: "",
};

const scoreCardMock = scoreCard as unknown as Mock;

beforeEach(() => {
  scoreCardMock.mockClear();
});

describe("which-card routes through the existing scorer", () => {
  it("bestCardForCategory calls scoreCard once per card", () => {
    bestCardForCategory([card, { ...card, id: "probe_2" }], "groceries", 3000);
    expect(scoreCardMock).toHaveBeenCalledTimes(2);
  });

  it("hands scoreCard a single-category spending profile, not a hand-rolled calculation", () => {
    bestCardForCategory([card], "groceries", 3000);
    expect(scoreCardMock).toHaveBeenCalledTimes(1);

    const [spending, passedCard] = scoreCardMock.mock.calls[0]!;
    // The profile carries exactly the asked-about category and amount.
    expect(spending).toEqual({ groceries: 3000 });
    expect(passedCard.id).toBe("probe");
  });

  it("askWhichCard resolves a merchant and then scores through the same path", () => {
    askWhichCard({
      merchantOrCategory: "Carrefour",
      monthlySpend: 1500,
      userCards: [card],
      includeUnowned: false,
    });
    expect(scoreCardMock).toHaveBeenCalled();
    // Merchant resolution happens BEFORE scoring: the scorer only ever sees the
    // canonical category, never the merchant string. That's what makes
    // askWhichCard("Carrefour") and askWhichCard("groceries") provably agree.
    const [spending] = scoreCardMock.mock.calls[0]!;
    expect(spending).toEqual({ groceries: 1500 });
  });

  it("does not call the scorer at all when the input is unrecognized", () => {
    const r = askWhichCard({
      merchantOrCategory: "Whole Foods",
      monthlySpend: 1500,
      userCards: [card],
      includeUnowned: false,
    });
    expect(r.status).toBe("unrecognized");
    expect(scoreCardMock).not.toHaveBeenCalled();
  });

  it("scores owned and unowned cards through the same scorer when upselling", () => {
    askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: 3000,
      userCards: [card],
      includeUnowned: true,
      allCards: [card, { ...card, id: "other_card" }],
    });
    // 1 owned + 2 overall — every number in the answer came from scoreCard.
    expect(scoreCardMock).toHaveBeenCalledTimes(3);
  });
});
