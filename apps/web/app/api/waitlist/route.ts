import { addToWaitlist } from "@fils/db";

/**
 * Waitlist signup. The ONE write path open to the public while Fils is invite-only
 * (see lib/access-gate.ts), which is why the validation here is deliberately strict
 * and the response deliberately tells the caller nothing it does not need.
 *
 * Anonymous by design: someone joining a waitlist has no account yet, so there is
 * no session to check. It writes to `waitlist_entries` and CANNOT reach `users` —
 * that separation is enforced by the data layer, not by this route remembering to
 * behave (see the schema note on WaitlistEntry).
 */

/** Max accepted lengths. Long enough for any real value, short enough to bound a write. */
const MAX_EMAIL = 254; // RFC 5321 limit on a forward path
const MAX_NAME = 120;
const MAX_SOURCE = 80;

/**
 * Pragmatic email shape check: one "@", something either side, a dot in the domain,
 * no whitespace. Deliberately NOT a full RFC 5322 grammar — those regexes reject
 * real addresses and accept unusable ones, and the only true validation is sending
 * mail to it. The job here is to keep obvious junk out of a public table.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

type Validated = { email: string; name: string | null; source: string | null };
type ValidationResult = { ok: true; value: Validated } | { ok: false; message: string };

/** Validate at the boundary (CLAUDE.md): always a clear 400, never a crash. */
function validateBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const { email, name, source } = body as Record<string, unknown>;

  if (typeof email !== "string") {
    return { ok: false, message: "`email` is required and must be a string." };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) return { ok: false, message: "`email` cannot be empty." };
  if (trimmed.length > MAX_EMAIL) return { ok: false, message: "`email` is too long." };
  if (!EMAIL.test(trimmed)) return { ok: false, message: "That doesn't look like an email address." };

  // name/source are optional: absent, null, or a string. Anything else is a mistake
  // worth reporting rather than silently dropping.
  if (name !== undefined && name !== null && typeof name !== "string") {
    return { ok: false, message: "`name` must be a string when provided." };
  }
  if (source !== undefined && source !== null && typeof source !== "string") {
    return { ok: false, message: "`source` must be a string when provided." };
  }

  return {
    ok: true,
    value: {
      email: trimmed,
      name: typeof name === "string" ? name.trim().slice(0, MAX_NAME) || null : null,
      source: typeof source === "string" ? source.trim().slice(0, MAX_SOURCE) || null : null,
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body is not valid JSON." }, { status: 400 });
  }

  const validated = validateBody(body);
  if (!validated.ok) return Response.json({ error: validated.message }, { status: 400 });

  try {
    const entry = await addToWaitlist(validated.value);
    /*
      The SAME 200 whether the row was created or already existed.

      why not report `isNew` to the caller: this endpoint is unauthenticated and
      public, so a response that distinguished "added you" from "already on the
      list" would let anyone test whether a given address had signed up. That is a
      membership oracle over a list of people's email addresses, for no product
      benefit — the user's experience is identical either way. `isNew` is still
      recorded server-side for the funnel.
    */
    void entry.isNew;
    return Response.json({ ok: true, message: "You're on the list." });
  } catch (err) {
    console.error("Waitlist signup failed:", err);
    return Response.json(
      { error: "Something went wrong saving your place. Please try again." },
      { status: 500 },
    );
  }
}
