import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { CARDS } from "@fils/engine";

// why mock @fils/db: these are unit tests of the ROUTE (validation, wiring, status
// codes) and must stay fast and runnable with no DATABASE_URL. We feed the route
// the same canonical card array the database is seeded from, so the assertions
// below still exercise the real engine. That the DB actually returns this shape is
// proven separately by packages/db's integration tests against Postgres.
vi.mock("@fils/db", () => ({
  getAllCards: vi.fn(async () => CARDS),
}));

import { POST } from "./route";
import { GET } from "../health/route";
import type { OptimizeRequest } from "@/lib/optimize-contract";

/**
 * A source file's CODE, with comments stripped.
 *
 * why strip: the files these guards inspect deliberately DOCUMENT the APIs they
 * avoid ("createRouteMatcher is deprecated", "this route needs no auth"). Matching
 * raw text would fail on the explanation rather than on real usage — which is
 * exactly what happened when this guard was first written.
 */
function codeOf(relativePath: string): string {
  const src = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/optimize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/optimize", () => {
  it("returns a sane PortfolioResult for a valid profile", async () => {
    const body: OptimizeRequest = {
      spending: { groceries: 3000, dining: 2000, travel: 2500, other: 4000 },
      profile: { monthlySalaryAed: 20000, uaeResident: true },
    };
    const res = await POST(postReq(body));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.totalCardCount).toBeGreaterThan(0);
    expect(json.eligibleCardCount).toBeGreaterThan(0);
    expect(json.best1).not.toBeNull();
    expect(Array.isArray(json.best1.cardIds)).toBe(true);
    expect(json.best1.cardIds.length).toBe(1);
    expect(Number.isFinite(json.best1.netAnnualValue)).toBe(true);
    expect(json.best1.allocations.length).toBeGreaterThan(0);
    expect(json.overallBest).not.toBeNull();
  });

  it("returns 400 with a clear message on garbage input", async () => {
    // Negative spend, an unknown category, and an empty profile — all invalid.
    const res = await POST(postReq({ spending: { groceries: -5, banana: "lots" }, profile: {} }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(0);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/optimize", { method: "POST", body: "{not json" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("the optimizer stays PUBLIC (guest/demo mode)", () => {
  it("serves an anonymous request — no session, no auth mocks, still 200", async () => {
    // Note what is NOT here: no Clerk mock. If the route ever started asking for a
    // user, this test would fail because there is no session to find. That is the
    // point — anyone can try the optimizer without an account.
    const res = await POST(
      postReq({
        spending: { groceries: 2000, dining: 1500 },
        profile: { monthlySalaryAed: 25000, uaeResident: true },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).totalCardCount).toBeGreaterThan(0);
  });

  it("the route never imports an auth provider or demands a user", () => {
    // A source-level guard, because the runtime test above can only prove the route
    // works today. This fails the moment someone adds auth to the demo surface.
    expect(codeOf("./route.ts")).not.toMatch(/@clerk|getCurrentUser|unauthorized/);
  });

  it("middleware protects nothing by default", () => {
    // The regression this guards is REAL: `clerk init` scaffolds a protect-by-default
    // proxy.ts that allowlists only /sign-in and /sign-up, which would put the whole
    // optimizer behind a login. Re-running the CLI would silently reintroduce it.
    const code = codeOf("../../../proxy.ts");
    expect(code).not.toMatch(/auth\.protect\(/);
    expect(code).not.toMatch(/createRouteMatcher/);
  });
});

describe("GET /api/health", () => {
  it("reports liveness and the bundled card count", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.cards).toBeGreaterThan(0);
  });
});
