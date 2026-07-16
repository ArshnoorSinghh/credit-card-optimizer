/**
 * /api/me is the reference PROTECTED route. These tests pin the two behaviours the
 * whole opt-in protection model rests on: an anonymous request is rejected, and a
 * signed-in one is served.
 *
 * See ../optimize/route.test.ts for the mirror-image guarantee — that the
 * optimizer stays PUBLIC. Together they prove protection is per-resource rather
 * than a blanket middleware rule.
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

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/me", () => {
  it("rejects an unauthenticated request with 401", async () => {
    authMock.mockReturnValue({ userId: null });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required." });
  });

  it("returns the signed-in user", async () => {
    authMock.mockReturnValue({ userId: "user_abc" });
    getUserByClerkIdMock.mockResolvedValue({
      id: "usr_local_1",
      clerkUserId: "user_abc",
      email: "a@example.com",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "usr_local_1", email: "a@example.com" });
  });

  it("never leaks Clerk's internal user id to the client", async () => {
    // The response is built from OUR columns only. Echoing Clerk's profile back
    // would couple the client to the auth provider's shape.
    authMock.mockReturnValue({ userId: "user_abc" });
    getUserByClerkIdMock.mockResolvedValue({
      id: "usr_local_1",
      clerkUserId: "user_abc",
      email: "a@example.com",
    });

    const json = await (await GET()).json();
    expect(json).not.toHaveProperty("clerkUserId");
  });
});
