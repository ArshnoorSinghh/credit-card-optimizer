import { describe, it, expect } from "vitest";
import {
  adoptionPatch,
  hasLocalWork,
  isUnwrittenServerState,
  DEFAULT_STORED_PROFILE,
  parseHoldings,
  parseOpenedOn,
  type StoredProfile,
} from "./profile-store";

/*
  The guest -> sign-up handover.

  The landing page funnel is "try the demo, then sign up", so a new account is
  usually created by someone who has just filled in the entry flow as a guest.
  A fresh account returns an empty profile, and adopting the local one is what
  stops that empty response from wiping their work. These are the three pure
  decisions behind it; the effect that calls them lives in useProfileStore.
*/

const local = (patch: Partial<StoredProfile> = {}): StoredProfile => ({
  ...DEFAULT_STORED_PROFILE,
  ...patch,
});

describe("isUnwrittenServerState", () => {
  it("is true for a brand-new account", () => {
    expect(
      isUnwrittenServerState({ cardIds: [], spending: null, salaryAed: null, bank: null }),
    ).toBe(true);
  });

  it("is false once ANY field has been persisted", () => {
    // Each of these on its own must protect the account from adoption —
    // otherwise a stale guest blob could overwrite a real saved profile.
    expect(
      isUnwrittenServerState({ cardIds: ["x"], spending: null, salaryAed: null, bank: null }),
    ).toBe(false);
    expect(
      isUnwrittenServerState({ cardIds: [], spending: {}, salaryAed: null, bank: null }),
    ).toBe(false);
    expect(
      isUnwrittenServerState({ cardIds: [], spending: null, salaryAed: 20000, bank: null }),
    ).toBe(false);
    expect(
      isUnwrittenServerState({ cardIds: [], spending: null, salaryAed: null, bank: "ADCB" }),
    ).toBe(false);
  });
});

describe("hasLocalWork", () => {
  it("is false for an untouched guest - nothing to carry over", () => {
    expect(hasLocalWork(local())).toBe(false);
  });

  it("is true once the guest completed onboarding", () => {
    expect(hasLocalWork(local({ onboarded: true }))).toBe(true);
  });

  it("is true when the guest only picked held cards", () => {
    expect(hasLocalWork(local({ cardIds: ["adcb-365"] }))).toBe(true);
  });
});

describe("adoptionPatch", () => {
  it("carries spending and salary once onboarded", () => {
    const p = local({
      onboarded: true,
      spending: { ...DEFAULT_STORED_PROFILE.spending, groceries: 3000 },
      profile: { monthlySalaryAed: 42000, uaeResident: true },
    });
    const body = adoptionPatch(p);
    expect(body.salaryAed).toBe(42000);
    expect((body.spending as Record<string, number>).groceries).toBe(3000);
  });

  it("withholds spending when the guest never onboarded", () => {
    // The server derives `onboarded` from `spending !== null`. Posting default
    // sliders here would mark a half-finished guest as set up and suppress the
    // dashboard's "finish setting up" prompt.
    const body = adoptionPatch(local({ cardIds: ["adcb-365"] }));
    expect(body.spending).toBeUndefined();
    expect(body.salaryAed).toBeUndefined();
    expect(body.cardIds).toEqual(["adcb-365"]);
  });

  it("is empty for an untouched guest, so no needless PUT is sent", () => {
    expect(Object.keys(adoptionPatch(local()))).toHaveLength(0);
  });

  it("omits a null bank rather than persisting it", () => {
    const body = adoptionPatch(local({ onboarded: true, bank: null }));
    expect("bank" in body).toBe(false);
  });
});

/*
  The calendar's two inputs. Both come back out of sessionStorage as untyped JSON, so
  the parsers are the boundary that decides what the deadline engine is allowed to
  see. The rule they enforce: drop anything we cannot trust, never repair it. A
  repaired balance drives a value-at-risk figure and a repaired date lands on a
  calendar, which is the one thing this screen exists not to do.
*/
describe("parseHoldings", () => {
  it("keeps a well-formed holding, with and without an expiry", () => {
    expect(parseHoldings([{ currency: "Skywards Miles", balance: 60000 }])).toEqual([
      { currency: "Skywards Miles", balance: 60000 },
    ]);
    expect(
      parseHoldings([{ currency: "FAB Rewards", balance: 40000, expiryDate: "2027-01-18" }]),
    ).toEqual([{ currency: "FAB Rewards", balance: 40000, expiryDate: "2027-01-18" }]);
  });

  it("drops a malformed expiry but keeps the balance", () => {
    // The balance is still true; only the date is unusable. Dropping the whole
    // holding would silently lose points the user told us about.
    const out = parseHoldings([{ currency: "X", balance: 100, expiryDate: "not-a-date" }]);
    expect(out).toEqual([{ currency: "X", balance: 100 }]);
    expect(out[0]).not.toHaveProperty("expiryDate");
  });

  it("rejects a date that matches the shape but is not a real day", () => {
    expect(parseHoldings([{ currency: "X", balance: 1, expiryDate: "2026-13-45" }])).toEqual([
      { currency: "X", balance: 1 },
    ]);
  });

  it("drops entries with an untrustworthy balance", () => {
    expect(parseHoldings([{ currency: "X", balance: -5 }])).toEqual([]);
    expect(parseHoldings([{ currency: "X", balance: Number.NaN }])).toEqual([]);
    expect(parseHoldings([{ currency: "X", balance: "60000" }])).toEqual([]);
    expect(parseHoldings([{ currency: "", balance: 10 }])).toEqual([]);
  });

  it("survives junk instead of a list", () => {
    expect(parseHoldings(undefined)).toEqual([]);
    expect(parseHoldings("nope")).toEqual([]);
    expect(parseHoldings([null, 7, "x"])).toEqual([]);
  });
});

describe("parseOpenedOn", () => {
  it("keeps real ISO dates keyed by card id", () => {
    expect(parseOpenedOn({ fab_cashback: "2024-09-12" })).toEqual({ fab_cashback: "2024-09-12" });
  });

  it("drops anything that is not a real date", () => {
    // An empty string is the one that matters: it is what an emptied date input
    // sends, and storing it would leave a card looking answered while its deadline
    // stayed undated.
    expect(parseOpenedOn({ a: "", b: "12/09/2024", c: "2024-02-31", d: 20240912 })).toEqual({});
  });

  it("survives junk instead of a map", () => {
    expect(parseOpenedOn(null)).toEqual({});
    expect(parseOpenedOn(["2024-09-12"])).toEqual({});
  });
});

describe("the calendar inputs start empty", () => {
  it("defaults to no holdings and no opening dates", () => {
    // Both must default to "we have not been told", never to a sample or a guess -
    // the calendar branches on emptiness to decide what it may claim.
    expect(DEFAULT_STORED_PROFILE.pointsHoldings).toEqual([]);
    expect(DEFAULT_STORED_PROFILE.cardOpenedOn).toEqual({});
  });
});
