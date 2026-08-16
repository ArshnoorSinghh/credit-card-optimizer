/**
 * The invite-only access gate.
 *
 * ── Why this inverts proxy.ts's original design, deliberately ───────────────────
 * `proxy.ts` used to protect NOTHING, and its comment explained why: Fils was
 * usable without an account, so an allowlist-the-exceptions model was "one
 * forgotten matcher entry away from breaking the demo". That reasoning was correct
 * for an open product.
 *
 * The requirement has inverted. Fils is now invite-only, and the failure that costs
 * something is the opposite one: a route that quietly serves the full personalised
 * product to someone who was never let in. So the gate FAILS CLOSED — anything not
 * named public here is gated, and a route added tomorrow is gated by default until
 * someone deliberately opens it.
 *
 * The public surface is intentionally not empty. Marketing pages and the read-only
 * card browser stay open: they cost nothing to serve, carry no per-user analysis,
 * and are the reason anyone finds the waitlist form at all.
 *
 * ── What is NOT public ─────────────────────────────────────────────────────────
 * Everything that produces a personalised answer: the optimizer, results, the
 * points engine, the assistant, suggestions, dashboard, hub, onboarding, and the
 * API routes behind them. That is the product, and giving it away is the thing
 * this gate exists to stop.
 *
 * ── Why not `createRouteMatcher` ────────────────────────────────────────────────
 * It is deprecated, and api/optimize/route.test.ts asserts the codebase does not
 * reintroduce it. Plain prefix matching is enough here and is trivially testable as
 * a pure function, which is why the matching lives in this module rather than
 * inline in the middleware.
 */

/**
 * Paths served to anyone, no invite required.
 *
 * An entry matches the path EXACTLY or as a `/`-delimited prefix, so "/cards"
 * covers "/cards" and "/cards/adcb_365_cashback" but never "/cards-admin".
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/", // landing + the waitlist form itself
  "/about",
  "/contact",
  "/legal",
  "/cards", // read-only browser: card list + detail
  "/sign-in", // Clerk needs these reachable even while gated, or an
  "/sign-up", // invited user can never get through the door
];

/**
 * API routes served to anyone. Deliberately a SHORT list, and deliberately
 * separate from `PUBLIC_PATHS` so opening a page never silently opens an endpoint.
 *
 * `/api/waitlist` must be public — it is how someone gets on the list.
 * `/api/health` must be public — uptime checks are unauthenticated by nature.
 * `/api/webhooks/*` must be public — Clerk calls them server-to-server and they
 * carry their own signature verification, which is a stronger check than this gate.
 */
export const PUBLIC_API_PATHS: readonly string[] = [
  "/api/waitlist",
  "/api/health",
  "/api/webhooks",
];

/** True when `path` equals `base` or sits beneath it as a `/`-delimited segment. */
function matches(path: string, base: string): boolean {
  if (base === "/") return path === "/";
  return path === base || path.startsWith(`${base}/`);
}

/**
 * Whether a request path is reachable without an invite.
 *
 * Pure and total: every path resolves to true or false, and anything unrecognised
 * resolves to FALSE. That last property is the whole design — see the header.
 */
export function isPublicPath(pathname: string): boolean {
  // Normalise a trailing slash so "/about/" and "/about" cannot diverge.
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  if (path.startsWith("/api")) {
    return PUBLIC_API_PATHS.some((base) => matches(path, base));
  }
  return PUBLIC_PATHS.some((base) => matches(path, base));
}

/**
 * Whether the gate is armed at all.
 *
 * why an env flag rather than a hardcoded `true`: the gate must be switchable
 * without a code change on the day access opens, and local development needs a way
 * to work on gated pages. It defaults to ARMED — an unset or misspelled variable
 * leaves the product closed, which is the safe direction for a flag whose failure
 * mode is "we gave the product away".
 *
 * Set FILS_ACCESS_OPEN=1 to disarm.
 */
export function isGateArmed(): boolean {
  return process.env.FILS_ACCESS_OPEN !== "1";
}
