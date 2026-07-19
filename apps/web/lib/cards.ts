import { CARDS, type Card } from "@fils/engine";

/*
  Read-only helpers over the engine's bundled card dataset. The engine already
  ships the canonical Card[] (imported at build time), so the browser/detail/
  onboarding screens render REAL card data with no API round-trip. When the
  backend exposes a cards endpoint, these can swap to a fetch with no UI change.
*/

export type { Card };

export const ALL_CARDS: Card[] = CARDS;

export const BANKS: string[] = Array.from(new Set(CARDS.map((c) => c.bank))).sort();

export const REWARD_TYPES = ["cashback", "points", "miles"] as const;

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}

export function cardsByBank(bank: string): Card[] {
  return CARDS.filter((c) => c.bank === bank);
}

/** Short accent per reward type, for consistent color-coding of card art. */
export const REWARD_ACCENT: Record<string, string> = {
  cashback: "from-emerald-400/30 to-sky/20",
  points: "from-violet/30 to-indigo/20",
  miles: "from-sky/30 to-indigo/20",
};
