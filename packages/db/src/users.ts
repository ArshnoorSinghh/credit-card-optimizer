/**
 * Typed data-access for registered users.
 *
 * ── What this layer knows about auth: NOTHING ───────────────────────────────────
 * These functions take a plain `{ clerkUserId, email }` and never import Clerk.
 * The caller (apps/web) is the only place that knows an auth provider exists, so
 * this package stays a database layer rather than a Clerk adapter — and swapping
 * providers later means changing the caller, not this file.
 *
 * The engine never sees any of this: users are an app concern, and packages/engine
 * remains a pure calculator that knows only about cards and spending.
 *
 * ── Credentials ─────────────────────────────────────────────────────────────────
 * Nothing here reads, writes, or accepts a password. Clerk holds credentials; we
 * hold an opaque id and an email.
 */

import { getPrisma } from "./index";

/** The identity fields we mirror from the auth provider. */
export type UserSyncInput = {
  /** Clerk's stable user id, e.g. "user_3Gb…". */
  clerkUserId: string;
  /** The user's PRIMARY email — resolved by the caller, never guessed here. */
  email: string;
};

/** A user row as the app consumes it (DB timestamps stripped). */
export type AppUser = {
  id: string;
  clerkUserId: string;
  email: string;
};

/**
 * Create-or-update the row for a Clerk user.
 *
 * IDEMPOTENT by design, because both callers can fire for the same user and we
 * cannot control the order: the `user.created` webhook and the just-in-time sync
 * on first authenticated request race by nature. Upserting on the unique
 * `clerkUserId` makes a duplicate delivery a no-op instead of a constraint error,
 * which is also what makes webhook retries safe.
 *
 * why `update: { email }` and not a full overwrite: `id` and `createdAt` must
 * survive re-sync — child rows (saved cards, later) will point at `id`, and a
 * regenerated key would orphan them.
 */
export async function upsertUser(input: UserSyncInput): Promise<AppUser> {
  const row = await getPrisma().user.upsert({
    where: { clerkUserId: input.clerkUserId },
    create: { clerkUserId: input.clerkUserId, email: input.email },
    update: { email: input.email },
    select: { id: true, clerkUserId: true, email: true },
  });
  return row;
}

/** The user for a Clerk id, or null when we have not synced them yet. */
export async function getUserByClerkId(clerkUserId: string): Promise<AppUser | null> {
  return getPrisma().user.findUnique({
    where: { clerkUserId },
    select: { id: true, clerkUserId: true, email: true },
  });
}

/**
 * Remove a user, for the `user.deleted` webhook.
 *
 * why deleteMany and not delete: `delete` throws when the row is absent, and
 * absence is the expected case for a user who signed up and vanished before any
 * sync ever ran. A deletion webhook must not 500 over an already-absent row —
 * that would make Clerk retry forever.
 */
export async function deleteUserByClerkId(clerkUserId: string): Promise<void> {
  await getPrisma().user.deleteMany({ where: { clerkUserId } });
}

// ── Saved profile: the user's wallet + spending, persisted across sessions ─────────

/** The user's persisted preferences. `spending`/`salaryAed` are null until set. */
export type SavedState = {
  cardIds: string[];
  spending: Record<string, number> | null;
  salaryAed: number | null;
  bank: string | null;
};

/**
 * Read a user's saved wallet + spending profile by our INTERNAL user id (the caller
 * resolves the Clerk id to a row via getCurrentUser first). Card ids come back in a
 * stable order (oldest-added first) so the wallet renders deterministically.
 */
export async function getSavedState(userId: string): Promise<SavedState | null> {
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    select: {
      savedSpending: true,
      savedSalaryAed: true,
      savedBank: true,
      savedCards: { select: { cardId: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  return {
    cardIds: row.savedCards.map((c) => c.cardId),
    // The column is JSON; the app is the only writer and always writes an object.
    spending: (row.savedSpending as Record<string, number> | null) ?? null,
    salaryAed: row.savedSalaryAed,
    bank: row.savedBank,
  };
}

/**
 * Persist any subset of a user's saved state. Only the fields present in `patch` are
 * written, so the dashboard can save spending without touching the wallet and vice
 * versa. Card ids, when given, REPLACE the whole set inside a transaction (the same
 * delete-then-recreate pattern the card seed uses) so the stored wallet always
 * converges exactly on what the client sent.
 */
export async function saveSavedState(
  userId: string,
  patch: Partial<SavedState>,
): Promise<void> {
  const prisma = getPrisma();
  const userData: {
    savedSpending?: Record<string, number>;
    savedSalaryAed?: number;
    savedBank?: string | null;
  } = {};
  if (patch.spending !== undefined && patch.spending !== null) userData.savedSpending = patch.spending;
  if (patch.salaryAed !== undefined && patch.salaryAed !== null) userData.savedSalaryAed = patch.salaryAed;
  if (patch.bank !== undefined) userData.savedBank = patch.bank;

  const writeCards = patch.cardIds !== undefined;
  // Dedupe defensively; the unique (userId, cardId) constraint would reject dupes.
  const ids = writeCards ? [...new Set(patch.cardIds)] : [];

  // Interactive form with generous timeouts: Neon's serverless endpoint can go cold
  // between requests, and the array form's fixed 2s maxWait surfaces as an
  // intermittent P2028 there (same reason the seed uses this form).
  await prisma.$transaction(
    async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }
      if (writeCards) {
        await tx.savedCard.deleteMany({ where: { userId } });
        if (ids.length > 0) {
          await tx.savedCard.createMany({ data: ids.map((cardId) => ({ userId, cardId })) });
        }
      }
    },
    { maxWait: 15_000, timeout: 30_000 },
  );
}

/**
 * How many users have registered — the metric.
 *
 * CAVEAT worth knowing when you read this number: it counts rows in OUR table,
 * which is Clerk's user list minus anyone who signed up but never triggered a
 * sync. With the webhook configured the two agree; with only the just-in-time
 * path, this undercounts signups that never returned to the app. Clerk's
 * /v1/users/count is the authority on raw signups.
 */
export async function getRegisteredUserCount(): Promise<number> {
  return getPrisma().user.count();
}
