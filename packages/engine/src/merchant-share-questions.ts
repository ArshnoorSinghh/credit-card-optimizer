/**
 * Which merchants must the product ask about, for a given card universe?
 *
 * The shares themselves — validation and lookup — live in merchant-share.ts, which
 * score-card.ts imports to enforce them. This file sits one level ABOVE the scorer
 * (it reads a card's earn options to find the locks), so it is kept separate to
 * keep that import graph acyclic. See the header of merchant-share.ts.
 *
 * Pure. No I/O.
 */

import type { Card } from "./card";
import { normalizeMerchantName } from "./merchant-map";
import { buildEarnOptions, type SpendCategory } from "./score-card";

/** One question the product must ask before a merchant-locked card can be scored. */
export interface MerchantShareQuestion {
  /** Merchant name as the engine spells it — the key a `MerchantShares` entry uses. */
  merchant: string;
  /** Canonical spend categories this merchant's bonuses cover, in canonical order. */
  categories: SpendCategory[];
  /** How many cards in the universe carry a bonus locked to this merchant. */
  cardCount: number;
  /** Those cards' ids, for a UI that wants to name them. */
  cardIds: string[];
}

/** Canonical display order for categories in a question (mirrors the receipt's order). */
const CATEGORY_ORDER: SpendCategory[] = [
  "groceries",
  "dining",
  "fuel",
  "utilities",
  "education",
  "travel",
  "transport",
  "entertainment",
  "international",
  "other",
];

/**
 * Every merchant the given card universe bonuses, with the categories affected.
 *
 * DERIVED from the card data rather than hard-coded: adding a co-brand card to
 * cards.json adds its merchant to the question automatically, and a merchant that
 * stops appearing stops being asked about. Sorted by card count (most consequential
 * first), then name, so the order is deterministic and a UI can take the top N.
 *
 * Benched cards (`excluded_from_scoring`) are skipped — they have no usable reward
 * structure, so asking the user about their merchant buys nothing.
 */
export function merchantShareQuestions(cards: Card[]): MerchantShareQuestion[] {
  const byMerchant = new Map<
    string,
    { merchant: string; categories: Set<SpendCategory>; cardIds: string[] }
  >();

  for (const card of cards) {
    if (card.excluded_from_scoring) continue;
    // buildEarnOptions is the same construction the scorer uses, so the merchants we
    // ask about are exactly the ones that can affect a score — there is no second
    // table here to drift out of sync with the scorer's MATCH_TABLE.
    const { options } = buildEarnOptions(card);
    const seenOnThisCard = new Set<string>();
    for (const o of options) {
      if (o.rule.kind !== "categories" || !o.rule.merchant) continue;
      const merchant = o.rule.merchant;
      const key = normalizeMerchantName(merchant);
      const entry = byMerchant.get(key) ?? {
        merchant,
        categories: new Set<SpendCategory>(),
        cardIds: [],
      };
      for (const c of o.rule.categories) entry.categories.add(c);
      // A card with two options locked to the same merchant counts once.
      if (!seenOnThisCard.has(key)) {
        seenOnThisCard.add(key);
        entry.cardIds.push(card.id);
      }
      byMerchant.set(key, entry);
    }
  }

  return [...byMerchant.values()]
    .map((e) => ({
      merchant: e.merchant,
      categories: CATEGORY_ORDER.filter((c) => e.categories.has(c)),
      cardCount: e.cardIds.length,
      cardIds: e.cardIds,
    }))
    .sort((a, b) => b.cardCount - a.cardCount || a.merchant.localeCompare(b.merchant));
}
