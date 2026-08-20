/**
 * Integration tests for the user data-access layer — these hit the REAL database,
 * so they need DATABASE_URL and the `users` table (i.e. migrations applied).
 *
 * ⚠ THESE TESTS WRITE ROWS. This project currently points local dev and production
 * at the same Neon database, so every row they create uses the unmistakably
 * synthetic `user_vitest_synthetic_` prefix and is deleted before and after each
 * run. Nothing here can touch a real user's row — deletes are always scoped to that
 * prefix, never a bare deleteMany().
 *
 * What these prove that the mocked apps/web tests cannot: that a Clerk signup
 * really does land in Postgres, that re-syncing the same user does not duplicate
 * them, and that the count metric reflects reality.
 */

import "dotenv/config";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPrisma } from "./index";
import {
  deleteUserByClerkId,
  getRegisteredUserCount,
  getSavedState,
  getUserByClerkId,
  saveSavedState,
  upsertUser,
} from "./users";

const TEST_PREFIX = "user_vitest_synthetic_";
const clerkId = (suffix: string): string => `${TEST_PREFIX}${suffix}`;

/** Scoped to the synthetic prefix — never a blanket delete. */
async function cleanupSyntheticUsers(): Promise<void> {
  await getPrisma().user.deleteMany({ where: { clerkUserId: { startsWith: TEST_PREFIX } } });
}

beforeEach(cleanupSyntheticUsers);

afterAll(async () => {
  await cleanupSyntheticUsers();
  await getPrisma().$disconnect();
});

describe("upsertUser — the Clerk signup -> Postgres row requirement", () => {
  it("creates a row for a user we have never seen", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("new"), email: "new@example.com" });

    expect(user.clerkUserId).toBe(clerkId("new"));
    expect(user.email).toBe("new@example.com");
    expect(typeof user.id).toBe("string");
    expect(user.id.length).toBeGreaterThan(0);

    // And it is really persisted, not just returned.
    await expect(getUserByClerkId(clerkId("new"))).resolves.toMatchObject({
      clerkUserId: clerkId("new"),
      email: "new@example.com",
    });
  });

  it("is idempotent: syncing the same user twice does not duplicate them", async () => {
    // This is what makes the webhook and the just-in-time path safe to race, and
    // what makes Clerk's webhook retries harmless.
    const first = await upsertUser({ clerkUserId: clerkId("dup"), email: "dup@example.com" });
    const second = await upsertUser({ clerkUserId: clerkId("dup"), email: "dup@example.com" });

    expect(second.id).toBe(first.id);
    const count = await getPrisma().user.count({ where: { clerkUserId: clerkId("dup") } });
    expect(count).toBe(1);
  });

  it("updates the email on re-sync but keeps the surrogate id stable", async () => {
    // The id must survive: future saved-cards rows will reference it, and a
    // regenerated key would orphan them.
    const before = await upsertUser({ clerkUserId: clerkId("chg"), email: "old@example.com" });
    const after = await upsertUser({ clerkUserId: clerkId("chg"), email: "new@example.com" });

    expect(after.id).toBe(before.id);
    expect(after.email).toBe("new@example.com");
  });

  it("stores no credential material — only an opaque id and an email", async () => {
    // Clerk owns credentials. If this row ever gains a password-shaped column, that
    // is a design breach and this fails.
    await upsertUser({ clerkUserId: clerkId("shape"), email: "shape@example.com" });
    const row = await getPrisma().user.findUnique({ where: { clerkUserId: clerkId("shape") } });

    const keys = Object.keys(row!);
    // Identity columns plus the saved-preference columns (spending/salary/bank). None
    // is credential material; the forbidden-list check below is the real guard.
    expect(keys.sort()).toEqual(
      ["clerkUserId", "createdAt", "email", "id", "savedBank", "savedSalaryAed", "savedSpending", "updatedAt"].sort(),
    );
    for (const forbidden of ["password", "passwordHash", "hash", "salt", "resetToken"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("getUserByClerkId", () => {
  it("returns null for a user we have not synced (a miss is not an error)", async () => {
    await expect(getUserByClerkId(clerkId("absent"))).resolves.toBeNull();
  });

  it("does not throw on adversarial input — Prisma parameterizes the query", async () => {
    await expect(getUserByClerkId("'; DROP TABLE users; --")).resolves.toBeNull();
    // The table survived.
    await expect(getPrisma().user.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});

describe("deleteUserByClerkId — the user.deleted webhook", () => {
  it("removes the row", async () => {
    await upsertUser({ clerkUserId: clerkId("del"), email: "del@example.com" });
    await deleteUserByClerkId(clerkId("del"));
    await expect(getUserByClerkId(clerkId("del"))).resolves.toBeNull();
  });

  it("is a no-op for a user who was never synced, rather than throwing", async () => {
    // A deletion webhook for a user we never saw must not 500, or Clerk retries forever.
    await expect(deleteUserByClerkId(clerkId("never"))).resolves.toBeUndefined();
  });
});

describe("saved wallet + spending — the dashboard persistence requirement", () => {
  it("round-trips a saved profile and wallet", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("save"), email: "save@example.com" });
    await saveSavedState(user.id, {
      cardIds: ["card_a", "card_b"],
      spending: { groceries: 2500, dining: 1800 },
      salaryAed: 25000,
      bank: "ADCB",
    });

    const state = await getSavedState(user.id);
    expect(state).toEqual({
      cardIds: ["card_a", "card_b"], // insertion order preserved
      spending: { groceries: 2500, dining: 1800 },
      salaryAed: 25000,
      bank: "ADCB",
      // Nothing was saved for either, and both come back EMPTY rather than absent.
      // "The user has told us nothing" is the state the calendar renders as a question.
      pointsHoldings: [],
      cardOpenedOn: {},
    });
  });

  it("replaces the whole card set on save, leaving spending untouched", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("cards"), email: "c@example.com" });
    await saveSavedState(user.id, {
      cardIds: ["card_a", "card_b"],
      spending: { groceries: 1000 },
      salaryAed: 15000,
    });
    // A wallet-only save must not wipe the spending profile.
    await saveSavedState(user.id, { cardIds: ["card_b", "card_c"] });

    const state = await getSavedState(user.id);
    expect(state?.cardIds).toEqual(["card_b", "card_c"]);
    expect(state?.spending).toEqual({ groceries: 1000 });
    expect(state?.salaryAed).toBe(15000);
  });

  it("clears the wallet when saved with an empty card list", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("empty"), email: "e@example.com" });
    await saveSavedState(user.id, { cardIds: ["card_a"] });
    await saveSavedState(user.id, { cardIds: [] });
    expect((await getSavedState(user.id))?.cardIds).toEqual([]);
  });

  it("returns null for a user id that does not exist", async () => {
    await expect(getSavedState("usr_does_not_exist")).resolves.toBeNull();
  });

  it("cascades: deleting the user removes their saved cards", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("cascade"), email: "cascade@example.com" });
    await saveSavedState(user.id, { cardIds: ["card_a", "card_b"] });
    await deleteUserByClerkId(clerkId("cascade"));
    const orphans = await getPrisma().savedCard.count({ where: { userId: user.id } });
    expect(orphans).toBe(0);
  });
});

describe("points holdings + card anniversaries — what the deadline calendar reads", () => {
  it("round-trips holdings, keeping an absent expiry absent", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("hold"), email: "h@example.com" });
    await saveSavedState(user.id, {
      pointsHoldings: [
        { currency: "Skywards Miles", balance: 60000, expiryDate: "2027-03-01" },
        // No expiry: the user has not told us, and that must survive the round trip
        // as ABSENT. A null or a default date here would hand the calendar a deadline
        // the user never stated.
        { currency: "ADCB TouchPoints", balance: 12500 },
      ],
    });

    const state = await getSavedState(user.id);
    expect(state?.pointsHoldings).toEqual([
      // Ordered by currency, not insertion.
      { currency: "ADCB TouchPoints", balance: 12500 },
      { currency: "Skywards Miles", balance: 60000, expiryDate: "2027-03-01" },
    ]);
    expect(state?.pointsHoldings[0]).not.toHaveProperty("expiryDate");
  });

  it("stores the expiry as the day that was typed, with no timezone drift", async () => {
    // A @db.Date read back through a UTC-negative offset is the classic place a date
    // slips a day. The day out must equal the day in, exactly.
    const user = await upsertUser({ clerkUserId: clerkId("tz"), email: "tz@example.com" });
    await saveSavedState(user.id, {
      pointsHoldings: [{ currency: "Etihad Guest Miles", balance: 1, expiryDate: "2027-01-01" }],
    });
    expect((await getSavedState(user.id))?.pointsHoldings[0]?.expiryDate).toBe("2027-01-01");
  });

  it("replaces the whole holding set, so a deleted balance stays deleted", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("holdrep"), email: "hr@example.com" });
    await saveSavedState(user.id, {
      pointsHoldings: [
        { currency: "Skywards Miles", balance: 60000 },
        { currency: "ADCB TouchPoints", balance: 100 },
      ],
    });
    await saveSavedState(user.id, { pointsHoldings: [{ currency: "Skywards Miles", balance: 5 }] });

    const state = await getSavedState(user.id);
    expect(state?.pointsHoldings).toEqual([{ currency: "Skywards Miles", balance: 5 }]);
  });

  it("round-trips a card opening date, and omits cards that have none", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("open"), email: "o@example.com" });
    await saveSavedState(user.id, {
      cardIds: ["card_a", "card_b"],
      cardOpenedOn: { card_a: "2024-09-12" },
    });

    const state = await getSavedState(user.id);
    // card_b is held but undated, and is simply ABSENT from the map — the calendar
    // turns that absence into "When did you open your card_b?".
    expect(state?.cardOpenedOn).toEqual({ card_a: "2024-09-12" });
  });

  /*
    The regression this whole preservation branch exists for.

    `openedOn` lives on the SavedCard row, and saving cardIds deletes and recreates
    every one of those rows. Without carrying the dates across that rewrite, adding a
    single card on the wallet screen would silently empty the user's calendar of every
    fee renewal they had dated — a data loss with no error and no visible cause.
  */
  it("preserves opening dates when the wallet is rewritten without them", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("preserve"), email: "p@example.com" });
    await saveSavedState(user.id, {
      cardIds: ["card_a", "card_b"],
      cardOpenedOn: { card_a: "2024-09-12", card_b: "2023-01-31" },
    });

    // A wallet-only save: the user added a third card and said nothing about dates.
    await saveSavedState(user.id, { cardIds: ["card_a", "card_b", "card_c"] });

    const state = await getSavedState(user.id);
    expect(state?.cardOpenedOn).toEqual({ card_a: "2024-09-12", card_b: "2023-01-31" });
  });

  it("drops the date of a card the user no longer holds", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("drop"), email: "d@example.com" });
    await saveSavedState(user.id, {
      cardIds: ["card_a", "card_b"],
      cardOpenedOn: { card_a: "2024-09-12", card_b: "2023-01-31" },
    });
    await saveSavedState(user.id, { cardIds: ["card_a"] });

    const state = await getSavedState(user.id);
    expect(state?.cardOpenedOn).toEqual({ card_a: "2024-09-12" });
  });

  it("clears a date the user removed, when the map is sent without it", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("clear"), email: "cl@example.com" });
    await saveSavedState(user.id, { cardIds: ["card_a"], cardOpenedOn: { card_a: "2024-09-12" } });
    // The client sends the complete map, so an omitted card means "cleared", not
    // "unchanged". Otherwise a date could be entered but never taken back.
    await saveSavedState(user.id, { cardOpenedOn: {} });

    expect((await getSavedState(user.id))?.cardOpenedOn).toEqual({});
  });

  it("cascades: deleting the user removes their points holdings", async () => {
    const user = await upsertUser({ clerkUserId: clerkId("hcascade"), email: "hc@example.com" });
    await saveSavedState(user.id, { pointsHoldings: [{ currency: "Skywards Miles", balance: 1 }] });
    await deleteUserByClerkId(clerkId("hcascade"));
    const orphans = await getPrisma().pointsHolding.count({ where: { userId: user.id } });
    expect(orphans).toBe(0);
  });
});

describe("getRegisteredUserCount — the metric", () => {
  it("counts registered users", async () => {
    // Asserted as a DELTA, not an absolute: this database holds real rows too, and a
    // hardcoded number would break the moment anyone signs up.
    const before = await getRegisteredUserCount();
    await upsertUser({ clerkUserId: clerkId("count_a"), email: "a@example.com" });
    await upsertUser({ clerkUserId: clerkId("count_b"), email: "b@example.com" });
    expect(await getRegisteredUserCount()).toBe(before + 2);

    // Re-syncing an existing user must not inflate the metric.
    await upsertUser({ clerkUserId: clerkId("count_a"), email: "a@example.com" });
    expect(await getRegisteredUserCount()).toBe(before + 2);
  });
});
