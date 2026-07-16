/**
 * Unit tests for the auth layer.
 *
 * why mock both Clerk and @fils/db: these test OUR logic — who counts as signed
 * in, which email we pick, and when we write — not Clerk's session handling or
 * Postgres. Mocking keeps them fast and runnable with no DATABASE_URL and no live
 * session. That the DB half really writes a row is proven separately by
 * packages/db's integration tests against Postgres.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

const getUserByClerkIdMock = vi.fn();
const upsertUserMock = vi.fn();
vi.mock("@fils/db", () => ({
  getUserByClerkId: (id: string) => getUserByClerkIdMock(id),
  upsertUser: (input: unknown) => upsertUserMock(input),
}));

import { getCurrentUser, primaryEmailOf, unauthorized } from "./auth";

const ROW = { id: "usr_local_1", clerkUserId: "user_abc", email: "a@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("primaryEmailOf", () => {
  it("picks the PRIMARY address, not the first in the array", () => {
    // The regression this guards: `emailAddresses[0]` passes with one address and
    // silently stores the wrong one as soon as a user adds a second.
    const email = primaryEmailOf({
      primaryEmailAddressId: "idn_2",
      emailAddresses: [
        { id: "idn_1", emailAddress: "old@example.com" },
        { id: "idn_2", emailAddress: "primary@example.com" },
      ],
    });
    expect(email).toBe("primary@example.com");
  });

  it("falls back to the first address when there is no primary id", () => {
    const email = primaryEmailOf({
      primaryEmailAddressId: null,
      emailAddresses: [{ id: "idn_1", emailAddress: "only@example.com" }],
    });
    expect(email).toBe("only@example.com");
  });

  it("returns null when the user has no email addresses at all", () => {
    expect(primaryEmailOf({ primaryEmailAddressId: null, emailAddresses: [] })).toBeNull();
  });
});

describe("getCurrentUser", () => {
  it("returns null for an anonymous request", async () => {
    authMock.mockReturnValue({ userId: null });
    await expect(getCurrentUser()).resolves.toBeNull();
    // Anonymous requests must not touch the database or Clerk's Backend API.
    expect(getUserByClerkIdMock).not.toHaveBeenCalled();
    expect(currentUserMock).not.toHaveBeenCalled();
  });

  it("returns the existing row without re-fetching the profile or writing", async () => {
    // The fast path. This runs on every authenticated request, so a profile fetch
    // (rate-limited) or a write here would be a per-request cost for data that
    // almost never changes.
    authMock.mockReturnValue({ userId: "user_abc" });
    getUserByClerkIdMock.mockResolvedValue(ROW);

    await expect(getCurrentUser()).resolves.toEqual(ROW);
    expect(currentUserMock).not.toHaveBeenCalled();
    expect(upsertUserMock).not.toHaveBeenCalled();
  });

  it("just-in-time syncs a brand-new user into Postgres with their primary email", async () => {
    // The core requirement: a Clerk signup becomes a row in our Users table.
    authMock.mockReturnValue({ userId: "user_abc" });
    getUserByClerkIdMock.mockResolvedValue(null); // never seen before
    currentUserMock.mockResolvedValue({
      id: "user_abc",
      primaryEmailAddressId: "idn_2",
      emailAddresses: [
        { id: "idn_1", emailAddress: "secondary@example.com" },
        { id: "idn_2", emailAddress: "a@example.com" },
      ],
    });
    upsertUserMock.mockResolvedValue(ROW);

    await expect(getCurrentUser()).resolves.toEqual(ROW);
    expect(upsertUserMock).toHaveBeenCalledWith({ clerkUserId: "user_abc", email: "a@example.com" });
  });

  it("throws rather than reporting 'signed out' when an authenticated user has no email", async () => {
    // A 401 here would disguise a broken invariant as a routine auth failure.
    authMock.mockReturnValue({ userId: "user_abc" });
    getUserByClerkIdMock.mockResolvedValue(null);
    currentUserMock.mockResolvedValue({
      id: "user_abc",
      primaryEmailAddressId: null,
      emailAddresses: [],
    });

    await expect(getCurrentUser()).rejects.toThrow(/no email address/i);
    expect(upsertUserMock).not.toHaveBeenCalled();
  });

  it("returns null if the session disappears between the auth check and the profile fetch", async () => {
    authMock.mockReturnValue({ userId: "user_abc" });
    getUserByClerkIdMock.mockResolvedValue(null);
    currentUserMock.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("unauthorized", () => {
  it("is a 401 carrying the app's error shape", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required." });
  });
});
