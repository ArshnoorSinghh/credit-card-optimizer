import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveProfile, loadProfile, DEFAULT_STORED_PROFILE } from "./profile-store";
import { ALL_CARDS } from "./cards";
import { DEFAULT_SPEND, DEFAULT_PROFILE } from "./optimizer";

/*
  The store is the only thing standing between "cards I told you I have" and the
  dashboard rendering something fabricated, so the cases that matter are the
  round trip and — more importantly — what happens to a payload written before
  ownedCardIds existed.
*/

const KEY = "fils.profile.v1";

// jsdom isn't configured for this package, so stub the browser globals the store
// uses. `window` matters as much as the storage: profile-store short-circuits to
// defaults on `typeof window === "undefined"`, so without it every assertion here
// would pass against defaults and prove nothing.
beforeEach(() => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal("window", { sessionStorage: storage });
  vi.stubGlobal("sessionStorage", storage);
});

describe("profile store", () => {
  it("round-trips the cards a user says they hold", () => {
    const ids = ALL_CARDS.slice(0, 3).map((c) => c.id);
    saveProfile({
      spending: { ...DEFAULT_SPEND },
      profile: { ...DEFAULT_PROFILE },
      bank: "Emirates NBD",
      ownedCardIds: ids,
    });
    expect(loadProfile().ownedCardIds).toEqual(ids);
  });

  it("reads a pre-ownedCardIds payload without discarding the rest of it", () => {
    // Exactly what an existing user has in sessionStorage today: no such field.
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        spending: { ...DEFAULT_SPEND, groceries: 4321 },
        profile: { ...DEFAULT_PROFILE },
        bank: "Mashreq",
      }),
    );

    const loaded = loadProfile();
    expect(loaded.ownedCardIds).toEqual([]); // defaulted, not undefined
    expect(loaded.spending.groceries).toBe(4321); // and nothing else was lost
    expect(loaded.bank).toBe("Mashreq");
  });

  it("falls back to an empty list when the stored value isn't an array", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ ownedCardIds: "enbd_skywards" }));
    expect(loadProfile().ownedCardIds).toEqual([]);
  });

  it("returns defaults for absent or corrupt storage", () => {
    expect(loadProfile()).toEqual(DEFAULT_STORED_PROFILE);
    sessionStorage.setItem(KEY, "{ not json");
    expect(loadProfile()).toEqual(DEFAULT_STORED_PROFILE);
  });
});
