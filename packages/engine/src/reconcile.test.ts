import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { scoreCard, type SpendingProfile } from "./score-card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";

const cards = cardsData as Card[];

// A profile with several categories so caps can bind (the interesting case).
const PROFILE: SpendingProfile = {
  groceries: 5000,
  dining: 2000,
  fuel: 1000,
  travel: 4000,
  other: 3000,
  international: 1500,
};

// High salary + resident so eligibility never drops a card in the 1-card run.
const OPEN: UserProfile = { monthlySalaryAed: 1_000_000, uaeResident: true };

/**
 * The reconciliation guarantee: scoreCard(card) and the best 1-card portfolio for
 * that same card are THE SAME COMPUTATION (both call earnAcrossCards([card])), so
 * they must return identical financial numbers for all 51 cards. If a user sees a
 * card on the single-card screen and again as a 1-card portfolio, the numbers agree.
 */
describe("reconciliation — scoreCard === best-1-card portfolio for every card", () => {
  for (const card of cards) {
    it(`agrees for ${card.id}`, () => {
      const s = scoreCard(PROFILE, card);
      const best1 = optimizePortfolio(PROFILE, OPEN, [card], undefined, { maxCards: 1 }).best1;

      if (s.benched) {
        // Benched cards are excluded from portfolios entirely (nothing to rank).
        expect(best1).toBeNull();
        return;
      }

      expect(best1).not.toBeNull();
      expect(best1!.grossAnnualValue).toEqual(s.grossAnnualValue);
      expect(best1!.netAnnualValue).toBe(s.netAnnualValue);
      expect(best1!.netAnnualValueRange).toEqual(s.netAnnualValueRange);
      expect(best1!.netAnnualValueYear1).toBe(s.netAnnualValueYear1);
      expect(best1!.totalFees.ongoing).toBe(s.fees.ongoingFeeAed);
      expect(best1!.totalFees.year1).toBe(s.fees.year1FeeAed);
    });
  }
});
