/**
 * The gate's whole value is that it FAILS CLOSED, and that property is invisible
 * until something asserts it. These tests are the assertion.
 *
 * The prior middleware protected nothing and said so in a comment; a comment cannot
 * fail a build when someone adds a route. The last case in this file does.
 */

import { describe, it, expect } from "vitest";
import { isPublicPath, PUBLIC_PATHS, PUBLIC_API_PATHS } from "./access-gate";

describe("access gate — public surface", () => {
  it("serves the landing page and the waitlist form", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("serves the marketing pages", () => {
    for (const p of ["/about", "/contact", "/legal", "/legal/privacy"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("serves the read-only card browser, list and detail", () => {
    expect(isPublicPath("/cards")).toBe(true);
    expect(isPublicPath("/cards/rakbank_world")).toBe(true);
  });

  it("serves the auth pages, or an invited user could never get in", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-up")).toBe(true);
    expect(isPublicPath("/sign-in/factor-one")).toBe(true);
  });

  it("serves the waitlist, health and webhook endpoints", () => {
    expect(isPublicPath("/api/waitlist")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/webhooks/clerk")).toBe(true);
  });

  it("ignores a trailing slash", () => {
    expect(isPublicPath("/about/")).toBe(true);
    expect(isPublicPath("/")).toBe(true);
  });
});

describe("access gate — the product is gated", () => {
  it("blocks every personalised page", () => {
    for (const p of [
      "/optimizer",
      "/results",
      "/dashboard",
      "/hub",
      "/points",
      "/ask",
      "/suggestions",
      "/onboarding",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("blocks the API routes that produce a personalised answer", () => {
    for (const p of ["/api/optimize", "/api/rafiq", "/api/suggestions", "/api/profile", "/api/me"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("does not let a prefix match leak a sibling route", () => {
    // "/cards" is public; a route that merely STARTS with those characters is not.
    expect(isPublicPath("/cards-admin")).toBe(false);
    expect(isPublicPath("/legal-hold")).toBe(false);
    expect(isPublicPath("/api/waitlist-export")).toBe(false);
  });

  it("does not treat the root entry as a prefix for everything", () => {
    // "/" is in PUBLIC_PATHS. If it were matched as a prefix the gate would be
    // open to the entire site — the single worst way this could fail.
    expect(isPublicPath("/optimizer")).toBe(false);
    expect(isPublicPath("/anything")).toBe(false);
  });
});

describe("access gate — fails closed", () => {
  it("blocks a route nobody has thought about yet", () => {
    // The property that matters: a page added tomorrow is gated until someone
    // deliberately opens it. If this ever fails, the gate has become an allowlist
    // of BLOCKED routes, which is the design that leaks.
    for (const p of ["/some-future-feature", "/api/some-future-endpoint", "/admin", "/internal"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("keeps the public lists short and deliberate", () => {
    // Not a style rule — a tripwire. If these grow, someone should have to look at
    // why, because every entry is a surface served to the whole internet.
    expect(PUBLIC_PATHS.length).toBeLessThanOrEqual(8);
    expect(PUBLIC_API_PATHS.length).toBeLessThanOrEqual(4);
  });

  it("never puts a personalised API route on the public list", () => {
    for (const entry of PUBLIC_API_PATHS) {
      expect(["/api/optimize", "/api/rafiq", "/api/suggestions", "/api/profile", "/api/me"]).not.toContain(
        entry,
      );
    }
  });
});
