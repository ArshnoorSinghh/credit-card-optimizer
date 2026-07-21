import { describe, it, expect } from "vitest";
import { ALL_CARDS, BANKS } from "./cards";
import { CARD_COUNT, BANK_COUNT, PORTFOLIO_COUNT } from "./marketing-stats";

/*
  Guards the numbers we publish against the dataset we actually ship.

  These aren't testing logic — they're testing that a marketing claim is true.
  Card data changes often, and when it does these figures go stale in silence:
  the page still renders, the build still passes, and the site quietly advertises
  a card count it no longer has.
*/

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

describe("published marketing numbers match the card dataset", () => {
  it("card count is what we ship", () => {
    expect(ALL_CARDS.length).toBe(CARD_COUNT);
  });

  it("bank count is what we ship", () => {
    expect(BANKS.length).toBe(BANK_COUNT);
  });

  it("portfolio count is the real 1-to-3-card search space", () => {
    const n = ALL_CARDS.length;
    const total = choose(n, 1) + choose(n, 2) + choose(n, 3);
    expect(total).toBe(PORTFOLIO_COUNT);
  });
});
