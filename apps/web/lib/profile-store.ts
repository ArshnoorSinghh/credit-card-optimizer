"use client";

import { useEffect, useState } from "react";
import type { SpendCategory, SpendingProfile, UserProfile } from "@fils/engine";
import { DEFAULT_PROFILE, DEFAULT_SPEND } from "@/lib/optimizer";

/*
  Tiny sessionStorage-backed store so the onboarding screen can hand the user's
  spend + profile (and selected bank) to the results screen without a backend.
  Deliberately minimal — real persistence lands with user accounts later.
*/

// v2: added heldCardIds. Bumped so a stale v1 blob doesn't hydrate the new field
// as undefined — a missing key just falls back to defaults instead.
const KEY = "fils.profile.v2";

export interface StoredProfile {
  spending: Record<SpendCategory, number>;
  profile: UserProfile;
  bank: string | null;
  /** Cards the user currently holds — anchors the "what you already earn" baseline. */
  heldCardIds: string[];
}

const DEFAULTS: StoredProfile = {
  spending: { ...DEFAULT_SPEND },
  profile: { ...DEFAULT_PROFILE },
  bank: null,
  heldCardIds: [],
};

export function saveProfile(p: StoredProfile): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(p));
}

export function loadProfile(): StoredProfile {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    return {
      spending: { ...DEFAULTS.spending, ...(parsed.spending ?? {}) },
      profile: { ...DEFAULTS.profile, ...(parsed.profile ?? {}) },
      bank: parsed.bank ?? null,
      heldCardIds: parsed.heldCardIds ?? [],
    };
  } catch {
    return DEFAULTS;
  }
}

/** Hook that reads the stored profile on mount (client-only, SSR-safe). */
export function useStoredProfile(): [StoredProfile, boolean] {
  const [profile, setProfile] = useState<StoredProfile>(DEFAULTS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);
  return [profile, ready];
}

export { DEFAULTS as DEFAULT_STORED_PROFILE };
