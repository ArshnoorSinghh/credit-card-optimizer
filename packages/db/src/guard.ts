/**
 * Production-database guard.
 *
 * Fils runs TWO Postgres databases:
 *   - PRODUCTION — live cards + real users, served by the deployed site on Vercel.
 *   - DEVELOPMENT — a separate database for local dev, tests, and reseeds, safe to
 *     wipe and experiment on.
 *
 * They MUST stay separate. This guard fails loudly the moment a non-production
 * context (local `pnpm dev`, a test run, a local `seed`) is pointed at the
 * production database, so the old "everything shares one DB" footgun can't silently
 * come back. See CLAUDE.md > Databases.
 *
 * why match on the host (not the whole URL): the host uniquely identifies the Neon
 * endpoint and is not a credential, so it's safe to name in an error message —
 * unlike the full connection string, which carries the password.
 */

/**
 * The PRODUCTION Neon endpoint id. The dev database lives on a DIFFERENT endpoint
 * (its own Neon branch/project), so its host will not contain this string.
 */
export const PROD_DB_HOST = "ep-twilight-voice-at5pi2e5";

/** Extract the host from a postgres connection string, best-effort (no throw). */
function hostOf(connectionString: string): string {
  const m = /@([^/:?]+)/.exec(connectionString);
  return m?.[1] ?? "";
}

/**
 * Throw unless it is safe to connect to `connectionString` from the current context.
 *
 * The production database is permitted ONLY when:
 *   - we are in a genuine production runtime (`NODE_ENV === "production"`, which
 *     Next.js sets on Vercel for both Production and Preview deployments), or
 *   - an operator has explicitly opted in via `FILS_ALLOW_PROD_DB=1` for a
 *     deliberate production operation (e.g. a reviewed prod migration/seed).
 *
 * Any other context (local dev, `vitest`, a local `seed`) pointed at the prod host
 * throws. A dev/other host is always allowed.
 */
export function assertDatabaseSafe(connectionString: string): void {
  if (!connectionString.includes(PROD_DB_HOST)) return; // not prod → always fine

  const isProductionRuntime = process.env.NODE_ENV === "production";
  const explicitOptIn = process.env.FILS_ALLOW_PROD_DB === "1";
  if (isProductionRuntime || explicitOptIn) return;

  throw new Error(
    `Refusing to connect to the PRODUCTION database (host ${hostOf(connectionString)}) ` +
      `from a non-production context (NODE_ENV=${process.env.NODE_ENV ?? "undefined"}). ` +
      `Local dev, tests, and seeds must point at the DEVELOPMENT database — update ` +
      `DATABASE_URL/DIRECT_URL in your local .env files. If this is an intentional, ` +
      `reviewed production operation, set FILS_ALLOW_PROD_DB=1. See CLAUDE.md > Databases.`,
  );
}
