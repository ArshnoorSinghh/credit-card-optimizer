/**
 * Architecture guard — the dependency arrow points ONE way.
 *
 * CLAUDE.md: `packages/engine` is a pure, framework-free calculator. It receives
 * plain card arrays; it never fetches them. So:
 *
 *     apps/web  ->  @fils/db  ->  @fils/engine (TYPES ONLY)
 *
 * `@fils/engine` must never depend on `@fils/db` — that would create a circular
 * dependency and put database access inside the engine.
 *
 * why this test lives in packages/db, not packages/engine: the engine's tsconfig
 * sets `"types": []`, which deliberately makes Node APIs untypeable in that package
 * (that's how "no I/O in the engine" is enforced at compile time). A guard that
 * reads files therefore cannot live there. It belongs here anyway: this is the
 * package that must stay downstream of the engine, so it asserts its own position.
 *
 * Without this, the rule is a comment — and one stray import in a hurry would
 * silently invert the graph. Here it fails the build instead.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const ENGINE_DIR = fileURLToPath(new URL("../../engine/", import.meta.url));
const ENGINE_SRC = `${ENGINE_DIR}src/`;

function json(path: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(path, "utf8"));
}

function engineSourceFiles(): string[] {
  return readdirSync(ENGINE_SRC)
    .filter((f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

function importsOf(file: string): string[] {
  const src = readFileSync(ENGINE_SRC + file, "utf8");
  // Matches `from "x"` and `import("x")` — enough to catch a real stray import.
  return [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
}

describe("engine stays pure and upstream of the database", () => {
  it("the engine declares no dependency on @fils/db (no circular dependency)", () => {
    const pkg = json(`${ENGINE_DIR}package.json`);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps)).not.toContain("@fils/db");
  });

  it("the engine declares no runtime dependencies at all — it is a pure calculator", () => {
    // If the engine ever needs a runtime dep, that's a deliberate decision worth
    // failing this test over and discussing, not something to slip in.
    expect(json(`${ENGINE_DIR}package.json`).dependencies ?? {}).toEqual({});
  });

  it("no engine source file imports the database, a framework, auth, or Node I/O", () => {
    // "@clerk" catches every @clerk/* package via the startsWith check below. The
    // engine must stay AUTH-UNAWARE: it scores cards against a spending profile and
    // has no concept of a logged-in user. Auth lives in apps/web only.
    const forbidden = ["@fils/db", "@prisma/client", "prisma", "next", "react", "@clerk"];
    const forbiddenBuiltins = ["node:fs", "node:path", "node:http", "node:child_process", "fs", "path"];

    const offenders: string[] = [];
    for (const file of engineSourceFiles()) {
      for (const spec of importsOf(file)) {
        const bad =
          forbidden.some((f) => spec === f || spec.startsWith(`${f}/`)) || forbiddenBuiltins.includes(spec);
        if (bad) offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no engine source file reaches outside the engine package except for its own data", () => {
    // A relative import climbing out of packages/engine would be a back door around
    // the rules above (e.g. importing db code by path).
    const offenders: string[] = [];
    for (const file of engineSourceFiles()) {
      for (const spec of importsOf(file)) {
        if (spec.startsWith("../") && !spec.startsWith("../data/")) offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("this package never imports an auth provider — it stays a database layer", () => {
    // packages/db is not a Clerk adapter: upsertUser() takes a plain
    // { clerkUserId, email } that the CALLER resolved. If Clerk types leak in here,
    // swapping auth provider stops being a change confined to apps/web, and this
    // package can no longer be tested without an auth SDK.
    const offenders: string[] = [];
    for (const file of readdirSync(fileURLToPath(new URL(".", import.meta.url)))) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        if (m[1]!.startsWith("@clerk")) offenders.push(`${file} -> ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("this package imports the engine for TYPES ONLY (erased at runtime)", () => {
    // A value import from @fils/engine would pull engine code into the data layer,
    // blurring the boundary. `import type` guarantees erasure.
    const offenders: string[] = [];
    for (const file of readdirSync(fileURLToPath(new URL(".", import.meta.url)))) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const m of src.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s*["']@fils\/engine["']/gm)) {
        if (!m[1]) offenders.push(`${file}: value import from @fils/engine`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
