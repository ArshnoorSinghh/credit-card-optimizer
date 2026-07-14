import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { GET } from "../health/route";
import type { OptimizeRequest } from "@/lib/optimize-contract";

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

describe("GET /api/health", () => {
  it("reports liveness and the bundled card count", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.cards).toBeGreaterThan(0);
  });
});
