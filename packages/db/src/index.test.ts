/**
 * Integration tests for the data-access layer — these hit the REAL database, so
 * they need DATABASE_URL and an up-to-date seed (`pnpm --filter @fils/db seed`).
 *
 * The point of these tests is the round-trip: what goes into Postgres from
 * cards.json must come back out as exactly the engine's `Card` shape. If the
 * schema, the mapper, and the source JSON ever disagree, this fails loudly.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterAll } from "vitest";
import type { Card } from "@fils/engine";
import { getAllCards, getCardById, getPrisma } from "./index";

const CARDS_JSON = fileURLToPath(new URL("../../engine/data/cards.json", import.meta.url));
const sourceCards = JSON.parse(readFileSync(CARDS_JSON, "utf8")) as Card[];

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("getAllCards", () => {
  it("returns exactly the number of cards in cards.json", async () => {
    const cards = await getAllCards();
    expect(cards).toHaveLength(sourceCards.length);
    expect(cards).toHaveLength(51);
  });

  it("round-trips cards.json exactly — same order, same shape, no DB artifacts", async () => {
    // The strongest guarantee available: the seeded DB reproduces the source byte
    // for byte through the mapper. This simultaneously proves source ordering is
    // preserved, optional fields are omitted (not null), the relational reward
    // categories reassemble in order, and no createdAt/updatedAt/sortOrder leaks.
    const cards = await getAllCards();
    expect(cards).toEqual(sourceCards);
  });

  it("returns objects matching the engine's Card type", async () => {
    const cards = await getAllCards();
    // Compile-time proof: assigning to Card[] fails typecheck on any shape drift.
    const typed: Card[] = cards;
    const card = typed[0]!;

    expect(typeof card.id).toBe("string");
    expect(typeof card.name).toBe("string");
    expect(["cashback", "points", "miles"]).toContain(card.rewards.type);
    expect(typeof card.eligibility.min_monthly_salary_aed).toBe("number");
    expect(typeof card.fees.annual_fee_aed).toBe("number");
    expect(Array.isArray(card.rewards.categories)).toBe(true);
    expect(Array.isArray(card.benefits)).toBe(true);
    expect(Array.isArray(card.redemption.primary_uses)).toBe(true);
    // DB bookkeeping must never reach the engine.
    expect(card).not.toHaveProperty("sortOrder");
    expect(card).not.toHaveProperty("createdAt");
    expect(card).not.toHaveProperty("updatedAt");
  });

  it("preserves the fractional fee that forced Float over Int", async () => {
    const cards = await getAllCards();
    const hsbc = cards.find((c) => c.id === "hsbc_liveplus");
    expect(hsbc?.fees.annual_fee_aed).toBe(313.95);
  });

  it("preserves raw, unparsed rate strings (the normalizer's job, not the DB's)", async () => {
    const cards = await getAllCards();
    const withCategories = cards.find((c) => c.rewards.categories.length > 0)!;
    expect(typeof withCategories.rewards.categories[0]!.rate).toBe("string");
  });
});

describe("getCardById", () => {
  it("returns the right card", async () => {
    const card = await getCardById("fab_cashback");
    expect(card).not.toBeNull();
    expect(card!.id).toBe("fab_cashback");
    expect(card).toEqual(sourceCards.find((c) => c.id === "fab_cashback"));
  });

  it("returns null for a missing id rather than throwing", async () => {
    await expect(getCardById("no_such_card")).resolves.toBeNull();
  });

  it("does not throw on adversarial input (queries are parameterized by Prisma)", async () => {
    // Not a real injection test, but it proves the id is bound as a value, never
    // concatenated into SQL: this returns a clean miss instead of executing.
    await expect(getCardById("'; DROP TABLE cards; --")).resolves.toBeNull();
    // The table is still there.
    expect(await getPrisma().card.count()).toBe(sourceCards.length);
  });
});
