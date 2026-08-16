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

  // ── merchantShares ────────────────────────────────────────────────────────────
  // The engine's own sanitizer would DROP a bad share and fall back to "unanswered",
  // which is safe but silent. At an HTTP boundary a caller who sends 30 where 0.3 was
  // meant deserves to be told, not to receive a quietly different answer.

  const baseBody: OptimizeRequest = {
    spending: { groceries: 3000, dining: 2000, travel: 2500, other: 4000 },
    profile: { monthlySalaryAed: 20000, uaeResident: true },
  };

  it("accepts valid merchant shares", async () => {
    const res = await POST(postReq({ ...baseBody, merchantShares: { LuLu: 0.3, Emaar: 0 } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.overallBest).not.toBeNull();
  });

  it("rejects a percentage sent where a fraction belongs", async () => {
    const res = await POST(postReq({ ...baseBody, merchantShares: { LuLu: 30 } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("between 0 and 1");
  });

  it("rejects a non-numeric or negative share", async () => {
    for (const shares of [{ LuLu: "lots" }, { LuLu: -0.2 }]) {
      const res = await POST(postReq({ ...baseBody, merchantShares: shares }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects merchantShares that isn't an object", async () => {
    const res = await POST(postReq({ ...baseBody, merchantShares: [0.3] }));
    expect(res.status).toBe(400);
  });

  it("treats an omitted merchantShares as unanswered, and reaches the allocator", async () => {
    // Omitted and {} are the same statement — "nobody answered" — and must agree.
    const withOmitted = await (await POST(postReq(baseBody))).json();
    const withEmpty = await (await POST(postReq({ ...baseBody, merchantShares: {} }))).json();
    expect(withOmitted.overallBest.netAnnualValue).toBe(withEmpty.overallBest.netAnnualValue);

    /*
      The liveness half: the field must actually reach the allocator.

      This used to compare "all shares 0" against omitted and require them to DIFFER.
      That stopped holding once unanswered merchants became bounded 0..full and the
      optimizer began ranking on the lower bound — at the floor, an unanswered bonus
      contributes nothing, which is exactly what a stated 0 contributes, so the same
      portfolio wins with the same figure. The old assertion was reading a real (and
      intended) property as a wiring failure.

      Comparing the two ENDS of the stated range tests the wiring without depending
      on which portfolio wins: 0 and 1 are both answers, and they cannot legitimately
      produce the same number unless the field is being dropped somewhere between
      this request and the allocator.
    */
    const merchants = { LuLu: 0, Emaar: 0, noon: 0, Amazon: 0 };
    const none = await (await POST(postReq({ ...baseBody, merchantShares: merchants }))).json();
    const all = await (
      await POST(
        postReq({
          ...baseBody,
          merchantShares: Object.fromEntries(Object.keys(merchants).map((m) => [m, 1])),
        }),
      )
    ).json();
    expect(all.overallBest.netAnnualValue).not.toBe(none.overallBest.netAnnualValue);
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
