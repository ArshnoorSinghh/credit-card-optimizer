"use client";

import { useEffect, useState } from "react";
import type { SpendCategory, SpendingProfile, UserProfile } from "@fils/engine";
import { DEFAULT_PROFILE, DEFAULT_SPEND } from "@/lib/optimizer";

/*
  Tiny sessionStorage-backed store so the onboarding screen can hand the user's
  spend + profile (and selected bank) to the results screen without a backend.
  Deliberately minimal — real persistence lands with user accounts later.
*/

const KEY = "fils.profile.v1";

export interface StoredProfile {
  spending: Record<SpendCategory, number>;
  profile: UserProfile;
  bank: string | null;
  /**
   * Card ids the user says they ALREADY HOLD — not a recommendation, and not
   * derived from the bank. Before this existed the dashboard had no way to know,
   * so it showed the first few cards of the chosen bank as if they were yours.
   */
  ownedCardIds: string[];
}

const DEFAULTS: StoredProfile = {
  spending: { ...DEFAULT_SPEND },
  profile: { ...DEFAULT_PROFILE },
  bank: null,
  ownedCardIds: [],
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
      // why: no version bump for adding this field. A payload written before
      // ownedCardIds existed is still perfectly valid — it just has no cards —
      // so defaulting is enough, and bumping KEY would silently discard a
      // returning user's spending profile to gain nothing.
      ownedCardIds: Array.isArray(parsed.ownedCardIds) ? parsed.ownedCardIds : [],
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Replace just the owned-card list, leaving the rest of the profile alone.
 *
 * why: the dashboard lets you remove a card without touching spending, salary or
 * bank. Writing a whole StoredProfile from there would mean reconstructing
 * fields that screen never edits — the same mistake that would have let the
 * optimizer's slider wipe this list.
 */
export function saveOwnedCards(ids: string[]): void {
  if (typeof window === "undefined") return;
  saveProfile({ ...loadProfile(), ownedCardIds: ids });
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
