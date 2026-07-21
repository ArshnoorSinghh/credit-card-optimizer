import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CARDS } from "@fils/engine";

// Same rationale as /api/optimize's test: mock the DB so the route runs with no
// DATABASE_URL, feeding the real canonical card array the engine scores against.
vi.mock("@fils/db", () => ({
  getAllCards: vi.fn(async () => CARDS),
}));

import { POST } from "./route";
import type { RafiqRequest, RafiqResponse } from "@/lib/rafiq/contract";

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/rafiq", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// The route reads GEMINI_API_KEY from the environment. We control it per-test.
const ORIGINAL_KEY = process.env.GEMINI_API_KEY;
beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
});

describe("POST /api/rafiq — validation", () => {
  it("400s on a non-JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/rafiq", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
  });

  it("400s when message is missing or empty", async () => {
    expect((await POST(postReq({ context: {} }))).status).toBe(400);
    expect((await POST(postReq({ message: "   " }))).status).toBe(400);
  });

  it("400s on malformed context (bad spending category, bad points)", async () => {
    const bad1: unknown = { message: "hi", context: { spending: { banana: 5 } } };
    expect((await POST(postReq(bad1))).status).toBe(400);
    const bad2: unknown = { message: "hi", context: { points: [{ currency: "", balance: -1 }] } };
    expect((await POST(postReq(bad2))).status).toBe(400);
  });
});

describe("POST /api/rafiq — degrades gracefully with no API key", () => {
  it("returns 200 and degraded=true when GEMINI_API_KEY is missing", async () => {
    const body: RafiqRequest = { message: "which card for groceries?" };
    const res = await POST(postReq(body));
    expect(res.status).toBe(200);
    const json = (await res.json()) as RafiqResponse;
    expect(json.degraded).toBe(true);
    expect(json.tool).toBeNull();
    expect(json.reply.length).toBeGreaterThan(0);
  });

  it("still validates the body before degrading (bad input is 400, not a fallback)", async () => {
    const res = await POST(postReq({ message: 123 }));
    expect(res.status).toBe(400);
  });

  it("accepts valid context (owned cards / profile) even while degraded", async () => {
    const body: RafiqRequest = {
      message: "hi",
      context: {
        ownedCardIds: [CARDS[0]!.id, "does_not_exist"],
        profile: { monthlySalaryAed: 20000, uaeResident: true },
      },
    };
    const res = await POST(postReq(body));
    expect(res.status).toBe(200); // unknown ids are dropped, not an error
  });
});

/**
 * Architecture guard: the ENGINE must never gain a Gemini/network dependency. Rafiq
 * lives entirely in apps/web. If someone imports an LLM or fetch into packages/engine,
 * this fails the build. (CLAUDE.md: the engine is a pure, portable calculator.)
 */
describe("the engine has no Gemini / network dependency", () => {
  const ENGINE_SRC = fileURLToPath(new URL("../../../../../packages/engine/src/", import.meta.url));

  function engineSourceFiles(): string[] {
    return readdirSync(ENGINE_SRC).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  }
  function importsOf(file: string): string[] {
    const src = readFileSync(ENGINE_SRC + file, "utf8");
    return [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
  }

  it("no engine source file imports a Gemini SDK or a network client", () => {
    const forbidden = [
      "@google/genai",
      "@google/generative-ai",
      "google-auth-library",
      "openai",
      "axios",
      "node-fetch",
      "undici",
    ];
    const offenders: string[] = [];
    for (const file of engineSourceFiles()) {
      for (const spec of importsOf(file)) {
        if (forbidden.some((f) => spec === f || spec.startsWith(`${f}/`))) offenders.push(`${file} -> ${spec}`);
        if (/gemini/i.test(spec)) offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the engine package.json declares no Gemini/network dependency", () => {
    const pkgPath = fileURLToPath(new URL("../../../../../packages/engine/package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /gemini|genai|generative-ai|openai/i.test(d))).toEqual([]);
  });
});
