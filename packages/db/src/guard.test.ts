import { afterEach, describe, expect, it } from "vitest";
import { assertDatabaseSafe, PROD_DB_HOST } from "./guard";

/**
 * Unit tests for the production-database guard. Pure — no real DB needed. These are
 * the regression lock for "local/tests must never hit production".
 */

const PROD_URL = `postgresql://user:pass@${PROD_DB_HOST}-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require`;
const DEV_URL = "postgresql://user:pass@ep-dev-branch-99999-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

const origNodeEnv = process.env.NODE_ENV;
const origOptIn = process.env.FILS_ALLOW_PROD_DB;
afterEach(() => {
  // vitest sets NODE_ENV=test; restore whatever it was.
  (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
  if (origOptIn === undefined) delete process.env.FILS_ALLOW_PROD_DB;
  else process.env.FILS_ALLOW_PROD_DB = origOptIn;
});

describe("assertDatabaseSafe", () => {
  it("allows a dev/non-prod host in any context", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    expect(() => assertDatabaseSafe(DEV_URL)).not.toThrow();
  });

  it("THROWS on the production host from a test/dev context (the guard's whole point)", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    delete process.env.FILS_ALLOW_PROD_DB;
    expect(() => assertDatabaseSafe(PROD_URL)).toThrow(/PRODUCTION database/i);
  });

  it("allows the production host in a genuine production runtime", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(() => assertDatabaseSafe(PROD_URL)).not.toThrow();
  });

  it("allows the production host with the explicit FILS_ALLOW_PROD_DB opt-in", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.FILS_ALLOW_PROD_DB = "1";
    expect(() => assertDatabaseSafe(PROD_URL)).not.toThrow();
  });

  it("does not leak the password in its error message", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    delete process.env.FILS_ALLOW_PROD_DB;
    try {
      assertDatabaseSafe(PROD_URL);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain("pass");
      expect((e as Error).message).toContain(PROD_DB_HOST);
    }
  });
});
