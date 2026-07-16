/**
 * Clerk -> Postgres user sync.
 *
 * This is the authoritative half of the sync: Clerk POSTs here the moment a user
 * is created, updated, or deleted, so a row appears even for someone who signs up
 * and never loads the app. The just-in-time path in lib/auth.ts is the safety net
 * for when this is not configured (e.g. local dev, where Clerk cannot reach
 * localhost without a tunnel).
 *
 * ── This route is intentionally PUBLIC ──────────────────────────────────────────
 * The caller is Clerk's server, not a logged-in user — there is no session to
 * check. Authenticity comes from the SIGNATURE, not from a cookie: verifyWebhook()
 * validates the Svix headers against CLERK_WEBHOOK_SIGNING_SECRET and throws on
 * anything unsigned, mis-signed, or replayed. That check is the only thing
 * standing between this endpoint and an attacker forging user rows, which is why
 * it runs before we look at the body.
 *
 * ── Setup required before this does anything ────────────────────────────────────
 * 1. Clerk Dashboard -> Configure -> Webhooks -> Add Endpoint
 * 2. URL: https://<your-domain>/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, user.deleted
 * 4. Copy the Signing Secret -> CLERK_WEBHOOK_SIGNING_SECRET (server-only, gitignored)
 * Until then this route simply rejects everything, and JIT carries the sync.
 */

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { deleteUserByClerkId, upsertUser } from "@fils/db";
import type { NextRequest } from "next/server";

/**
 * Webhook payloads are RAW API JSON — snake_case — unlike the SDK's camelCase user
 * object. Same concept, different shape, so this resolver is deliberately separate
 * from primaryEmailOf() in lib/auth.ts rather than "shared" via a cast that would
 * quietly read undefined.
 */
type UserJSONLike = {
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{ id: string; email_address: string }>;
};

/** Primary email from a webhook payload. Same rule as lib/auth.ts: id, not index. */
function primaryEmailOfPayload(data: UserJSONLike): string | null {
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? null;
}

export async function POST(request: NextRequest): Promise<Response> {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    // Unsigned, wrong secret, tampered, or replayed. Never log the raw body here —
    // it is unverified attacker-controlled input.
    return new Response("Invalid webhook signature.", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const data = event.data as unknown as UserJSONLike & { id: string };
      const email = primaryEmailOfPayload(data);
      if (email === null) {
        // 200, not 4xx: a retry would fail identically, so asking Clerk to redeliver
        // forever helps nobody. Swallow it visibly instead.
        console.error(`Clerk webhook: user ${data.id} has no email address — skipping sync.`);
        return new Response("No email address on user; skipped.", { status: 200 });
      }
      await upsertUser({ clerkUserId: data.id, email });
      break;
    }

    case "user.deleted": {
      // `id` is optional on the deleted payload, so guard it.
      const { id } = event.data;
      if (typeof id === "string") await deleteUserByClerkId(id);
      break;
    }

    default:
      // Subscribing to more events later should not 500 this endpoint.
      break;
  }

  // 2xx tells Clerk the event landed; anything else schedules a retry.
  return new Response("ok", { status: 200 });
}
