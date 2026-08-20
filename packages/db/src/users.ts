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

/**
 * One points balance as the app exchanges it. `expiryDate` is an ISO YYYY-MM-DD
 * STRING, not a Date: this type crosses a JSON boundary in both directions
 * (/api/profile -> the browser's profile store), and a Date would arrive back as
 * whatever JSON.parse made of it. The mapping to/from Prisma's DateTime happens in
 * this file, which is the only place that knows the column is a date.
 */
export type SavedHolding = {
  currency: string;
  balance: number;
  /** ISO YYYY-MM-DD. Absent means the user has not told us — never a guess. */
  expiryDate?: string;
};

/** The user's persisted preferences. `spending`/`salaryAed` are null until set. */
export type SavedState = {
  cardIds: string[];
  spending: Record<string, number> | null;
  salaryAed: number | null;
  bank: string | null;
  /**
   * The points balances the user says they hold. An empty list means "told us nothing",
   * which the calendar reports as a question rather than as an empty timeline.
   */
  pointsHoldings: SavedHolding[];
  /**
   * ISO YYYY-MM-DD the user opened each held card WITH THE BANK, keyed by card id.
   * A card absent from this map is unknown, and stays unknown — see the comment on
   * `SavedCard.openedOn` for why this must never fall back to when it was added to Fils.
   */
  cardOpenedOn: Record<string, string>;
};

/** A Prisma @db.Date column as the ISO day it represents. UTC, so no offset can shift it. */
function toIsoDay(d: Date | null): string | undefined {
  if (d === null) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * An ISO day as the UTC midnight Prisma writes to a @db.Date column.
 *
 * why the explicit "T00:00:00Z": `new Date("2026-09-12")` is already UTC midnight, but
 * `new Date("2026-09-12T00:00:00")` is LOCAL midnight, and the two differ by a day for
 * any negative-offset environment. Being explicit means the stored day is the typed day
 * regardless of where the server runs. Validation of the string itself happens in the
 * route, before it ever reaches here.
 */
function fromIsoDay(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

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
      savedCards: { select: { cardId: true, openedOn: true }, orderBy: { createdAt: "asc" } },
      // Ordered by currency (not insertion) so the points screen renders the same list
      // every time — createdAt ties are possible when a whole set is written at once.
      pointsHoldings: {
        select: { currency: true, balance: true, expiryDate: true },
        orderBy: { currency: "asc" },
      },
    },
  });
  if (!row) return null;

  // Only cards with a known opening date appear in the map. An absent key is the
  // "unknown" the calendar turns into a question; a null would have to be filtered
  // again by every reader.
  const cardOpenedOn: Record<string, string> = {};
  for (const c of row.savedCards) {
    const iso = toIsoDay(c.openedOn);
    if (iso !== undefined) cardOpenedOn[c.cardId] = iso;
  }

  return {
    cardIds: row.savedCards.map((c) => c.cardId),
    // The column is JSON; the app is the only writer and always writes an object.
    spending: (row.savedSpending as Record<string, number> | null) ?? null,
    salaryAed: row.savedSalaryAed,
    bank: row.savedBank,
    pointsHoldings: row.pointsHoldings.map((h) => {
      const holding: SavedHolding = { currency: h.currency, balance: h.balance };
      const iso = toIsoDay(h.expiryDate);
      // Set the key only when known, so the JSON the client receives distinguishes
      // "no expiry date" from "expiry date is null".
      if (iso !== undefined) holding.expiryDate = iso;
      return holding;
    }),
    cardOpenedOn,
  };
}

/**
 * Persist any subset of a user's saved state. Only the fields present in `patch` are
 * written, so the dashboard can save spending without touching the wallet and vice
 * versa. Card ids, when given, REPLACE the whole set inside a transaction (the same
 * delete-then-recreate pattern the card seed uses) so the stored wallet always
 * converges exactly on what the client sent. `pointsHoldings` replaces the same way and
 * for the same reason.
 *
 * ── One trap the delete-then-recreate pattern sets, and how this avoids it ─────────
 * `openedOn` lives ON the SavedCard row, so recreating the wallet would DESTROY every
 * anniversary the user had entered — saving an unrelated card toggle would silently
 * empty their calendar. So when cards are rewritten, the existing opening dates are read
 * first and carried onto the new rows, with anything in `patch.cardOpenedOn` layered on
 * top. Points holdings have no such problem: every field of one is user-supplied and
 * arrives together.
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

  const writeOpenedOn = patch.cardOpenedOn !== undefined;
  const openedOnPatch = patch.cardOpenedOn ?? {};

  const writeHoldings = patch.pointsHoldings !== undefined;
  // Last entry wins on a duplicate currency; the unique (userId, currency) constraint
  // would otherwise reject the whole batch. Same defensive dedupe as the card ids.
  const holdings = writeHoldings
    ? [...new Map((patch.pointsHoldings ?? []).map((h) => [h.currency, h])).values()]
    : [];

  // Interactive form with generous timeouts: Neon's serverless endpoint can go cold
  // between requests, and the array form's fixed 2s maxWait surfaces as an
  // intermittent P2028 there (same reason the seed uses this form).
  await prisma.$transaction(
    async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }

      if (writeCards) {
        // Read the dates BEFORE the delete, so rewriting the wallet preserves them.
        const existing = await tx.savedCard.findMany({
          where: { userId },
          select: { cardId: true, openedOn: true },
        });
        const kept = new Map(existing.map((c) => [c.cardId, c.openedOn]));

        await tx.savedCard.deleteMany({ where: { userId } });
        if (ids.length > 0) {
          await tx.savedCard.createMany({
            data: ids.map((cardId) => {
              // An explicit date in this patch wins; otherwise carry forward what the
              // user had already told us. `writeOpenedOn` makes the map authoritative,
              // so a card the client omitted goes back to unknown rather than keeping a
              // date the user just cleared.
              const patched = openedOnPatch[cardId];
              const openedOn =
                patched !== undefined
                  ? fromIsoDay(patched)
                  : writeOpenedOn
                    ? null
                    : (kept.get(cardId) ?? null);
              return { userId, cardId, openedOn };
            }),
          });
        }
      } else if (writeOpenedOn) {
        // Cards are untouched, so update the dates in place. The map is authoritative:
        // a held card missing from it has had its date cleared.
        const existing = await tx.savedCard.findMany({
          where: { userId },
          select: { id: true, cardId: true, openedOn: true },
        });
        for (const card of existing) {
          const patched = openedOnPatch[card.cardId];
          const next = patched !== undefined ? fromIsoDay(patched) : null;
          // Skip the write when nothing changed, so a save that only touched spending
          // does not churn every wallet row.
          const current = card.openedOn === null ? null : card.openedOn.getTime();
          if (current === (next === null ? null : next.getTime())) continue;
          await tx.savedCard.update({ where: { id: card.id }, data: { openedOn: next } });
        }
      }

      if (writeHoldings) {
        await tx.pointsHolding.deleteMany({ where: { userId } });
        if (holdings.length > 0) {
          await tx.pointsHolding.createMany({
            data: holdings.map((h) => ({
              userId,
              currency: h.currency,
              balance: h.balance,
              // Absent stays absent. The engine treats an unknown expiry as a question,
              // so there is nothing to default this to.
              expiryDate: h.expiryDate === undefined ? null : fromIsoDay(h.expiryDate),
            })),
          });
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
