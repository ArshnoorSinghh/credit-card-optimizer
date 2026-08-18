import { describe, it, expect } from "vitest";
import {
  adoptionPatch,
  hasLocalWork,
  isUnwrittenServerState,
  DEFAULT_STORED_PROFILE,
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
