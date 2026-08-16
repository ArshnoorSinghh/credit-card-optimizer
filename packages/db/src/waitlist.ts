/**
 * Typed data-access for the invite-only waitlist.
 *
 * ── What this layer knows about auth: NOTHING ───────────────────────────────────
 * Waitlist entries are by definition UNauthenticated — the whole point is that the
 * person has no account yet. Nothing here imports Clerk, and nothing here can read
 * or write a `User`. Those are deliberately separate tables (see the schema note on
 * WaitlistEntry): an anonymous public POST must never be able to reach the table
 * that owns saved spending profiles.
 *
 * The engine never sees any of this. packages/engine stays a pure calculator that
 * knows only about cards and spending.
 *
 * ── Trust boundary ──────────────────────────────────────────────────────────────
 * `email` is normalised HERE (lowercased + trimmed) rather than at the caller, so
 * the unique constraint means what it says whatever route reaches this function.
 * Shape validation — is this even a plausible email — belongs at the API boundary,
 * which is where a bad request must become a 400 rather than an exception.
 */

import { getPrisma } from "./index";

/** What the public form can supply. Nothing else is accepted. */
export type WaitlistSignupInput = {
  /** Raw email as typed; normalised here. */
  email: string;
  /** Optional display name. Never inferred from the email. */
  name?: string | null;
  /** Which surface the request came from ("landing", "optimizer-wall", …). */
  source?: string | null;
};

/** A waitlist row as the app consumes it. */
export type WaitlistEntry = {
  id: string;
  email: string;
  createdAt: Date;
  /** True when this submission created the row, false when the email was already on the list. */
  isNew: boolean;
};

/** Lowercase + trim. The single definition of "the same email" for this table. */
export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Add someone to the waitlist, or return their existing entry.
 *
 * IDEMPOTENT by design. The form is public and unauthenticated, so it WILL be
 * submitted twice — by an impatient user, a double-click, or a retried request.
 * Upserting on the unique email makes the second submission a no-op instead of a
 * constraint error, which is what lets the route answer "you're on the list" both
 * times rather than showing a stranger a 500.
 *
 * why `update: {}` (an empty update): a resubmission must NOT move `createdAt`.
 * Queue position is the only thing the list is for, and letting a repeat submit
 * push someone to the back of their own queue would be a bug users could not see.
 * `name`/`source` are likewise left as first-supplied: the first answer is the one
 * we asked for, and a later blank form should not erase it.
 */
export async function addToWaitlist(input: WaitlistSignupInput): Promise<WaitlistEntry> {
  const email = normalizeWaitlistEmail(input.email);
  const existing = await getPrisma().waitlistEntry.findUnique({ where: { email } });
  if (existing) {
    return { id: existing.id, email: existing.email, createdAt: existing.createdAt, isNew: false };
  }
  const row = await getPrisma().waitlistEntry.create({
    data: {
      email,
      name: input.name?.trim() || null,
      source: input.source?.trim() || null,
    },
  });
  return { id: row.id, email: row.email, createdAt: row.createdAt, isNew: true };
}

/** How many people are waiting. For an admin view or a "N ahead of you" line. */
export async function getWaitlistCount(): Promise<number> {
  return getPrisma().waitlistEntry.count();
}

/**
 * Whether this email is already on the list.
 *
 * NOT used to gate access — being on the waitlist is precisely the state of NOT
 * having access. Exposed for the form to say "you're already on the list" without
 * writing.
 */
export async function isOnWaitlist(email: string): Promise<boolean> {
  const row = await getPrisma().waitlistEntry.findUnique({
    where: { email: normalizeWaitlistEmail(email) },
    select: { id: true },
  });
  return row !== null;
}
