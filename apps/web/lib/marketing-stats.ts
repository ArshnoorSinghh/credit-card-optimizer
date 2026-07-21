/*
  Numbers quoted in marketing copy that are DERIVED from the card dataset.

  They are constants rather than computed at render time so the landing page
  doesn't pull the entire card dataset into its client bundle just to print a
  count. `marketing-stats.test.ts` asserts every one of them against the real
  data, so they cannot drift silently.

  why this file exists: the card-data verification pass added three cards, and
  every number below went stale in the same commit — including two claims on the
  hero. A figure that lives only inside a sentence has no way to fail loudly, so
  it stays wrong until a human happens to re-count. Now the test breaks instead.
*/

export const CARD_COUNT = 53;

export const BANK_COUNT = 12;

/*
  Distinct 1-, 2- and 3-card portfolios over CARD_COUNT cards:
  C(53,1) + C(53,2) + C(53,3) = 53 + 1,378 + 23,426 = 24,857.

  Note this is the size of the SEARCH SPACE, not a measure of work done — it is
  the card count restated. It grows cubically, so adding a handful of cards moves
  it a long way (54 cards gave 26,289; 51 cards gave 22,151).
*/
export const PORTFOLIO_COUNT = 24_857;

/** "26k+" — the rounded form used in the stat row. */
export const PORTFOLIO_COUNT_K = Math.floor(PORTFOLIO_COUNT / 1000);

/** "26,000+" — the rounded form used in prose. */
export const PORTFOLIO_COUNT_ROUNDED = (
  Math.floor(PORTFOLIO_COUNT / 1000) * 1000
).toLocaleString("en-US");
