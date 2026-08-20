/**
 * /api/profile is a PROTECTED route that reads and writes the signed-in user's saved
 * wallet + spending. These tests pin: guests are rejected, a signed-in GET returns
 * the stored state, and PUT validates input and drops unknown card ids before it
 * ever reaches the database layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CARDS } from "@fils/engine";

const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

const getUserByClerkIdMock = vi.fn();
const upsertUserMock = vi.fn();
const getSavedStateMock = vi.fn();
const saveSavedStateMock = vi.fn();
vi.mock("@fils/db", () => ({
  getUserByClerkId: (id: string) => getUserByClerkIdMock(id),
  upsertUser: (input: unknown) => upsertUserMock(input),
  getSavedState: (userId: string) => getSavedStateMock(userId),
  saveSavedState: (userId: string, patch: unknown) => saveSavedStateMock(userId, patch),
}));

import { GET, PUT } from "./route";

const KNOWN_ID = CARDS[0]!.id;

function putReq(body: unknown): Request {
  return new Request("http://localhost/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReturnValue({ userId: "user_abc" });
  getUserByClerkIdMock.mockResolvedValue({ id: "usr_1", clerkUserId: "user_abc", email: "a@x.com" });
});

describe("GET /api/profile", () => {
  it("401s for a guest", async () => {
    authMock.mockReturnValue({ userId: null });
    expect((await GET()).status).toBe(401);
  });

  it("returns the saved state for a signed-in user", async () => {
    getSavedStateMock.mockResolvedValue({
      cardIds: [KNOWN_ID],
      spending: { groceries: 2000 },
      salaryAed: 25000,
      bank: "ADCB",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      cardIds: [KNOWN_ID],
      spending: { groceries: 2000 },
      salaryAed: 25000,
      bank: "ADCB",
    });
  });

  it("returns an empty state when the user has saved nothing yet", async () => {
    getSavedStateMock.mockResolvedValue(null);
    const json = await (await GET()).json();
    // The two calendar fields come back EMPTY, not absent: "you have told us nothing"
    // is the state the calendar renders as a question rather than a blank timeline.
    expect(json).toEqual({
      cardIds: [],
      spending: null,
      salaryAed: null,
      bank: null,
      pointsHoldings: [],
      cardOpenedOn: {},
    });
  });
});

describe("PUT /api/profile", () => {
  it("401s for a guest", async () => {
    authMock.mockReturnValue({ userId: null });
    expect((await PUT(putReq({ cardIds: [] }))).status).toBe(401);
    expect(saveSavedStateMock).not.toHaveBeenCalled();
  });

  it("persists a valid patch and drops unknown card ids", async () => {
    getSavedStateMock.mockResolvedValue({ cardIds: [KNOWN_ID], spending: null, salaryAed: null, bank: null });
    const res = await PUT(putReq({ cardIds: [KNOWN_ID, "not_a_real_card"], salaryAed: 25000 }));
    expect(res.status).toBe(200);
    expect(saveSavedStateMock).toHaveBeenCalledWith("usr_1", {
      cardIds: [KNOWN_ID], // the bogus id was filtered out
      salaryAed: 25000,
    });
  });

  it("400s on an unknown spending category, without touching the DB", async () => {
    const res = await PUT(putReq({ spending: { banana: 5 } }));
    expect(res.status).toBe(400);
    expect(saveSavedStateMock).not.toHaveBeenCalled();
  });

  it("400s on a negative salary", async () => {
    expect((await PUT(putReq({ salaryAed: -5 }))).status).toBe(400);
  });

  it("accepts a null spending (clears the profile) and a null bank", async () => {
    getSavedStateMock.mockResolvedValue({ cardIds: [], spending: null, salaryAed: null, bank: null });
    const res = await PUT(putReq({ spending: null, bank: null }));
    expect(res.status).toBe(200);
    expect(saveSavedStateMock).toHaveBeenCalledWith("usr_1", { spending: null, bank: null });
  });

  it("persists points holdings, keeping an absent expiry absent", async () => {
    getSavedStateMock.mockResolvedValue({ cardIds: [], spending: null, salaryAed: null, bank: null });
    const res = await PUT(
      putReq({
        pointsHoldings: [
          { currency: "Skywards Miles", balance: 60000, expiryDate: "2027-03-01" },
          { currency: "FAB Rewards", balance: 4000 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(saveSavedStateMock).toHaveBeenCalledWith("usr_1", {
      pointsHoldings: [
        { currency: "Skywards Miles", balance: 60000, expiryDate: "2027-03-01" },
        { currency: "FAB Rewards", balance: 4000 },
      ],
    });
  });

  it("400s on a negative or non-finite balance, without touching the DB", async () => {
    expect((await PUT(putReq({ pointsHoldings: [{ currency: "X", balance: -1 }] }))).status).toBe(400);
    // JSON has no NaN literal, so the realistic bad value from a client is a string.
    expect((await PUT(putReq({ pointsHoldings: [{ currency: "X", balance: "lots" }] }))).status).toBe(400);
    expect(saveSavedStateMock).not.toHaveBeenCalled();
  });

  /*
    The date trap this validation exists for.

    `Date.parse("2024-02-31")` SUCCEEDS and silently rolls forward to 2 March. A bare
    parse check would accept a typo and store a confident date two days from where the
    user meant, which then renders as a real deadline on the calendar with nothing
    showing it had moved. Only the round-trip catches it.
  */
  it("400s on a date that parses but is not a real day", async () => {
    expect((await PUT(putReq({ cardOpenedOn: { [KNOWN_ID]: "2024-02-31" } }))).status).toBe(400);
    expect(
      (await PUT(putReq({ pointsHoldings: [{ currency: "X", balance: 1, expiryDate: "2024-02-31" }] })))
        .status,
    ).toBe(400);
    // Rejected for shape as well as for existence.
    expect((await PUT(putReq({ cardOpenedOn: { [KNOWN_ID]: "12/09/2024" } }))).status).toBe(400);
    expect(saveSavedStateMock).not.toHaveBeenCalled();
  });

  it("persists opening dates and drops ones for unknown cards", async () => {
    getSavedStateMock.mockResolvedValue({ cardIds: [], spending: null, salaryAed: null, bank: null });
    const res = await PUT(
      putReq({ cardOpenedOn: { [KNOWN_ID]: "2024-09-12", not_a_real_card: "2024-09-12" } }),
    );
    expect(res.status).toBe(200);
    // Same rule as cardIds: an unrecognised id is dropped, not a 400, so a stale
    // client cannot fail the user's whole save.
    expect(saveSavedStateMock).toHaveBeenCalledWith("usr_1", {
      cardOpenedOn: { [KNOWN_ID]: "2024-09-12" },
    });
  });
});
