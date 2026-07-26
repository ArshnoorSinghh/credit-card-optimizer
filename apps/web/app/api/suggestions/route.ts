import nodemailer from "nodemailer";
import { getCurrentUser } from "@/lib/auth";
import { SUGGESTIONS_EMAIL } from "@/lib/legal";

/**
 * POST /api/suggestions — delivers a feedback message to the suggestions inbox.
 *
 * why this route exists at all: the form used to compose a `mailto:` and hand the
 * draft to the reader's own mail client. That needed no infrastructure, but it
 * also meant the message only arrived if the reader had a mail client configured
 * and then pressed send themselves. This sends it directly.
 *
 * ── Who sent it ─────────────────────────────────────────────────────────────────
 * Two different things, and the email keeps them apart on purpose:
 *
 *   - A SIGNED-IN sender is identified from the Clerk session, server-side, via
 *     getCurrentUser(). That address is verified — Clerk owns it and the browser
 *     cannot forge it.
 *   - An ANONYMOUS sender is whoever they typed into the optional reply field.
 *     That is unverified and is labelled as such in the message body. Anyone can
 *     type anyone's address there.
 *
 * The client never gets to assert who it is. A `replyTo` in the body is treated
 * as self-reported text, never as identity — which is why the authed address is
 * read here rather than accepted from the request.
 *
 * The route stays PUBLIC, like /api/optimize and /api/rafiq: feedback from a
 * guest is the feedback most worth having.
 *
 * ── Abuse ───────────────────────────────────────────────────────────────────────
 * The recipient is hardcoded, so this can't be used as an open relay — the worst
 * case is someone flooding our own inbox. A honeypot field, length caps and a
 * best-effort per-IP rate limit are proportionate to that. The limiter is
 * in-memory and therefore per-instance; on serverless it resets with the
 * instance. It raises the cost of casual abuse, and is not a security boundary.
 */

// why nodejs and not edge: nodemailer opens a TCP socket to an SMTP server,
// which the edge runtime has no way to do.
export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 200;
const MAX_EMAIL_CHARS = 254; // RFC 5321 maximum length of a forward path
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const CATEGORIES = new Set([
  "A card's rates or fees look wrong",
  "Something is broken",
  "The result confused me",
  "An idea for what to build next",
  "General feedback",
  "Something else",
]);

const hits = new Map<string, number[]>();

/** True when this IP has already sent RATE_LIMIT_MAX messages in the window. */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

/*
  Deliberately permissive: one @, no spaces, a dot in the domain. This decides
  whether to put the string in a Reply-To header, not whether to trust it. A
  stricter pattern would reject valid unusual addresses for no gain, and no
  pattern can tell us the address belongs to the sender.
*/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Request body must be JSON.");
  }
  if (typeof body !== "object" || body === null) {
    return bad("Request body must be a JSON object.");
  }

  const { category, message, context, replyTo, website } = body as Record<string, unknown>;

  // Honeypot: a field hidden from humans, irresistible to form bots. Answer 200
  // so the bot records a success and doesn't retry with the field cleared.
  if (typeof website === "string" && website.trim() !== "") {
    return Response.json({ ok: true });
  }

  if (typeof category !== "string" || !CATEGORIES.has(category)) {
    return bad("Unknown category.");
  }
  if (typeof message !== "string" || message.trim() === "") {
    return bad("Tell us what happened — the message can't be empty.");
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return bad(`Message is too long (max ${MAX_MESSAGE_CHARS} characters).`);
  }
  if (context != null && (typeof context !== "string" || context.length > MAX_CONTEXT_CHARS)) {
    return bad(`Page or card is too long (max ${MAX_CONTEXT_CHARS} characters).`);
  }

  const selfReported =
    typeof replyTo === "string" && replyTo.trim() !== "" ? replyTo.trim() : null;
  if (selfReported !== null) {
    if (selfReported.length > MAX_EMAIL_CHARS || !EMAIL_RE.test(selfReported)) {
      return bad("That doesn't look like an email address. Leave it blank if you'd rather not say.");
    }
  }

  // why x-forwarded-for's first entry: Vercel appends the real client IP at the
  // head of the chain. Falls back to a shared bucket, which is strict rather than
  // permissive — better to throttle an unknown sender than to exempt them.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return bad("That's a lot of feedback in a short time. Try again in a few minutes.", 429);
  }

  const user = await getCurrentUser().catch(() => null);

  const smtpUser = process.env.SUGGESTIONS_SMTP_USER;
  const smtpPass = process.env.SUGGESTIONS_SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    // why 503 and not 500: nothing is broken, the mailbox is simply not
    // configured in this environment. The log line is for us; the response is
    // for a reader who should not lose what they typed.
    console.error(
      "[suggestions] SUGGESTIONS_SMTP_USER / SUGGESTIONS_SMTP_PASS are not set — cannot send.",
    );
    return bad("Sending isn't set up yet. Please email us directly instead.", 503);
  }

  const sender = user
    ? `${user.email} (signed in — verified)`
    : selfReported
      ? `${selfReported} (typed into the form — NOT verified)`
      : "anonymous, no reply address given";

  /*
    The address a reply would go to, if any. The verified one wins: if a
    signed-in user types someone else's address into the form, hitting reply
    should still reach the account that actually sent this.
  */
  const replyAddress = user?.email ?? selfReported ?? null;

  const lines = [
    `Category: ${category}`,
    `From: ${sender}`,
    context ? `Where: ${context}` : null,
    "",
    message.trim(),
  ].filter((l): l is string => l !== null);

  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transport.sendMail({
      from: `"Fils feedback" <${smtpUser}>`,
      to: SUGGESTIONS_EMAIL,
      // why the tag: every one of these arrives from our own address, so the
      // inbox list gives no clue which can be answered. Marking the dead ends in
      // the subject means they can be told apart, and filtered, without opening
      // them. It goes on the anonymous ones because those are the exception.
      subject: replyAddress
        ? `Fils feedback — ${category}`
        : `Fils feedback [no reply] — ${category}`,
      text: lines.join("\n"),
      // Only set Reply-To when there is somewhere for a reply to land. Setting
      // it to our own address would make the Reply button look functional while
      // sending mail to ourselves.
      ...(replyAddress ? { replyTo: replyAddress } : {}),
    });
  } catch (error) {
    console.error("[suggestions] SMTP send failed:", error);
    return bad("We couldn't send that just now. Please try again, or email us directly.", 502);
  }

  return Response.json({ ok: true });
}
