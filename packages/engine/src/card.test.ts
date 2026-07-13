import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card, RewardType } from "./card";

// The Card shape as TypeScript actually infers it from the JSON import: identical
// to Card, except `rewards.type` is widened to `string`. TS drops string-literal
// types when inferring large JSON arrays, so it can't see that every value is one
// of RewardType's three members — a compiler limitation, not a data mismatch.
type JsonCard = Omit<Card, "rewards"> & {
  rewards: Omit<Card["rewards"], "type"> & { type: string };
};

// Compile-time proof (no `as` cast, which would mask a mismatch): this forces
// `tsc` to check all 55 cards structurally against Card — every field, every
// nested block, nullability — with `rewards.type` relaxed to string per above.
// It fails `pnpm --filter @fils/engine typecheck` if any card deviates.
const cards = cardsData satisfies readonly JsonCard[];

const REWARD_TYPES = [
  "cashback",
  "points",
  "miles",
] as const satisfies readonly RewardType[];

describe("cards.json conforms to the Card type", () => {
  it("has all 55 cards", () => {
    expect(cards).toHaveLength(55);
  });

  it("gives every card the required nested blocks", () => {
    for (const card of cards) {
      expect(card.eligibility).toBeTypeOf("object");
      expect(card.fees).toBeTypeOf("object");
      expect(card.rewards).toBeTypeOf("object");
      expect(card.redemption).toBeTypeOf("object");
      expect(Array.isArray(card.benefits)).toBe(true);
    }
  });

  it("gives every card 1-3 reward categories", () => {
    for (const card of cards) {
      expect(card.rewards.categories.length).toBeGreaterThanOrEqual(1);
      expect(card.rewards.categories.length).toBeLessThanOrEqual(3);
    }
  });

  // Runtime half of the type check: verify the one field the compiler couldn't.
  it("uses only known reward types", () => {
    for (const card of cards) {
      expect(REWARD_TYPES).toContain(card.rewards.type);
    }
  });
});
