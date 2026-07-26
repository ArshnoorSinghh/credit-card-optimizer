/**
 * /api/suggestions is PUBLIC — feedback from a guest is the feedback most worth
 * having — so the things worth pinning are what it accepts, and how it describes
 * the sender once it does.
 *
 * The identity tests are the point of this file. The route must never present a
 * self-reported address as if it were verified: a signed-in sender is resolved
 * from the session server-side, and anything typed into the form is labelled as
 * unverified no matter what it contains.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMailMock = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

const getCurrentUserMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

import { POST } from "./route";

/** A fresh IP per test, so one test's requests never spend another's rate limit. */
let ipCounter = 0;
function post(body: unknown): Promise<Response> {
  ipCounter += 1;
  return POST(
    new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${ipCounter}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

const VALID = { category: "General feedback", message: "The dining rate looks wrong." };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(null);
  sendMailMock.mockResolvedValue({});
  process.env.SUGGESTIONS_SMTP_USER = "bot@example.com";
  process.env.SUGGESTIONS_SMTP_PASS = "app-password";
});

describe("POST /api/suggestions — validation", () => {
  it("rejects an unknown category", async () => {
    const res = await post({ ...VALID, category: "Nonsense" });
    expect(res.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects a message that is only whitespace", async () => {
    const res = await post({ ...VALID, message: "   " });
    expect(res.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects a message over the length cap", async () => {
    const res = await post({ ...VALID, message: "x".repeat(4001) });
    expect(res.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed reply address", async () => {
    const res = await post({ ...VALID, replyTo: "not-an-email" });
    expect(res.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("accepts a valid message and sends it", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/suggestions — who sent it", () => {
  it("marks a signed-in sender as verified, from the session", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "usr_1", email: "real@user.com" });

    await post(VALID);

    const { text, replyTo } = sendMailMock.mock.calls[0][0];
    expect(text).toContain("real@user.com (signed in — verified)");
    expect(replyTo).toBe("real@user.com");
  });

  it("marks a typed address as NOT verified", async () => {
    await post({ ...VALID, replyTo: "someone@example.com" });

    const { text, replyTo } = sendMailMock.mock.calls[0][0];
    expect(text).toContain("someone@example.com (typed into the form — NOT verified)");
    // the label that would imply the session vouched for it must not appear
    expect(text).not.toContain("signed in — verified");
    expect(replyTo).toBe("someone@example.com");
  });

  it("says so when an anonymous sender leaves no address", async () => {
    await post(VALID);

    const { text, replyTo } = sendMailMock.mock.calls[0][0];
    expect(text).toContain("anonymous, no reply address given");
    expect(replyTo).toBeUndefined();
  });

  it("never lets the request body claim a verified identity", async () => {
    // A client trying to pass itself off as signed in. The route reads identity
    // from the session only, so this can at most populate the unverified line.
    await post({ ...VALID, user: { email: "admin@fils.ae" }, verified: true });

    const { text } = sendMailMock.mock.calls[0][0];
    expect(text).toContain("anonymous, no reply address given");
    expect(text).not.toContain("admin@fils.ae");
  });

  it("replies to the session address, not one typed over it", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "usr_1", email: "real@user.com" });

    await post({ ...VALID, replyTo: "someone-else@example.com" });

    expect(sendMailMock.mock.calls[0][0].replyTo).toBe("real@user.com");
  });
});

describe("POST /api/suggestions — abuse and failure", () => {
  it("swallows a honeypot submission without sending", async () => {
    const res = await post({ ...VALID, website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rate limits a burst from one IP", async () => {
    const headers = {
      "Content-Type": "application/json",
      "x-forwarded-for": "198.51.100.7",
    };
    const send = () =>
      POST(
        new Request("http://localhost/api/suggestions", {
          method: "POST",
          headers,
          body: JSON.stringify(VALID),
        }),
      );

    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) codes.push((await send()).status);

    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[5]).toBe(429);
  });

  it("returns 503, not 500, when the mailbox is not configured", async () => {
    delete process.env.SUGGESTIONS_SMTP_USER;

    const res = await post(VALID);
    expect(res.status).toBe(503);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the SMTP send itself fails", async () => {
    sendMailMock.mockRejectedValue(new Error("connection refused"));

    const res = await post(VALID);
    expect(res.status).toBe(502);
  });
});
