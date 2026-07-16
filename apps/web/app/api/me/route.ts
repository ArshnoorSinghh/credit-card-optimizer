import { getCurrentUser, unauthorized } from "@/lib/auth";

/**
 * The signed-in user — a PROTECTED route, and the reference example for how
 * anything user-specific (saved cards, saved points) should gate itself.
 *
 * Contrast with /api/optimize, which is public: nothing here is special-cased in
 * middleware. This route is protected purely because it asks for a user and bails
 * when there isn't one. Adding a public route requires no allowlist edit; adding a
 * protected one requires exactly these two lines.
 *
 * Side effect worth knowing: getCurrentUser() performs the just-in-time sync, so
 * the first authenticated hit to any protected route is what creates the Postgres
 * row when the webhook has not (or is not configured).
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) return unauthorized();

  // Only our own fields — never proxy Clerk's full profile blob to the client.
  return Response.json({ id: user.id, email: user.email });
}
