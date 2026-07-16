/**
 * Server-side auth helpers.
 *
 * This is the ONLY place the app asks "who is making this request?". Clerk is
 * confined to apps/web — packages/engine stays a pure calculator that has never
 * heard of a user, and packages/db takes plain `{ clerkUserId, email }` without
 * importing Clerk. (Both rules are enforced by the guards in
 * packages/db/src/architecture.test.ts.)
 *
 * ── Protection model ────────────────────────────────────────────────────────────
 * Nothing is protected by middleware. proxy.ts only attaches session context, so
 * every route is PUBLIC until it asks for a user. That is deliberate: Fils has a
 * guest/demo mode and /api/optimize must answer anonymous requests. Protection is
 * opt-in, at the resource:
 *
 *     const user = await getCurrentUser();
 *     if (!user) return unauthorized();
 *
 * ── Credentials ─────────────────────────────────────────────────────────────────
 * No password ever reaches this code. Clerk verifies credentials and hands us a
 * session; we only ever see an opaque user id and an email.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserByClerkId, upsertUser, type AppUser } from "@fils/db";

/**
 * The SDK's camelCase user shape, narrowed to just what we read.
 *
 * why a local structural type instead of importing Clerk's `User`: this is all we
 * depend on, and it lets the resolver be unit-tested with a plain object rather
 * than a full Clerk resource.
 */
type ClerkUserLike = {
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
};

/**
 * Resolve a user's PRIMARY email from the SDK's camelCase shape.
 *
 * why not `emailAddresses[0]`: Clerk allows several addresses per user, and the
 * array order carries no meaning. The primary is identified by id. Grabbing [0]
 * happens to work with one address and silently stores the wrong one the moment a
 * second is added.
 *
 * Falls back to the first address when `primaryEmailAddressId` is null — that only
 * happens in odd states, and having an email beats storing none.
 */
export function primaryEmailOf(user: ClerkUserLike): string | null {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

/** The signed-in user's Clerk id, or null. Reads the session cookie only — no network. */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * The signed-in user as a row in OUR database, creating it on first sight.
 * Returns null when the request is anonymous.
 *
 * This is the just-in-time half of the sync. The `user.created` webhook is the
 * other half; either can win and the upsert makes that safe.
 *
 * why the read-before-write fast path: this runs on every authenticated request.
 * Upserting each time would mean a database WRITE per request, and calling
 * currentUser() each time would spend a Clerk Backend API call against the rate
 * limit — both to re-learn something that changes almost never. So: cheap indexed
 * read on the common path; the profile fetch and write happen once per user.
 *
 * Consequence worth knowing: because the fast path never refetches the profile, an
 * email CHANGE does not propagate through this path. The `user.updated` webhook is
 * what keeps email current — without it configured, a changed email goes stale here.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const userId = await getClerkUserId();
  if (userId === null) return null;

  const existing = await getUserByClerkId(userId);
  if (existing !== null) return existing;

  // First sight of this user: fetch the profile and create the row.
  const user = await currentUser();
  if (user === null) return null; // session vanished between the two calls

  const email = primaryEmailOf(user);
  if (email === null) {
    // why throw instead of returning null: this user IS authenticated. Reporting
    // "signed out" would hide a real invariant break behind a plausible-looking
    // 401. Fils authenticates with email+password, so a Clerk user with no email
    // should be impossible — if it happens, we want a loud failure.
    throw new Error(`Clerk user ${user.id} has no email address — cannot sync to Postgres.`);
  }

  return upsertUser({ clerkUserId: user.id, email });
}

/** The 401 for routes that require a session. Shape matches the app's error contract. */
export function unauthorized(): Response {
  return Response.json({ error: "Authentication required." }, { status: 401 });
}
