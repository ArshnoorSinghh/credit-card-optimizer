"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { SpendCategory, SpendingProfile, UserProfile } from "@fils/engine";
import { DEFAULT_PROFILE, DEFAULT_SPEND } from "@/lib/optimizer";

/*
  The user's saved state: spending profile, salary, primary bank, and the cards they
  hold. Two backends, one shape:

    - GUESTS keep it in sessionStorage, so the demo works with no account.
    - SIGNED-IN users persist it to Postgres via /api/profile, so it survives across
      sessions and devices. sessionStorage is still written as a fast local cache.

  `useProfileStore` picks the backend from the Clerk auth state and exposes a single
  `save(patch)` that updates both. `onboarded` records whether the user has actually
  set a spending profile (vs. still showing the defaults), so the dashboard can prompt
  "finish setup" instead of a misleading AED 0.
*/

const KEY = "fils.profile.v2";

export interface StoredProfile {
  spending: Record<SpendCategory, number>;
  profile: UserProfile;
  bank: string | null;
  /** Card ids the user says they hold. */
  cardIds: string[];
  /** True once the user has set a real spending profile (not just the defaults). */
  onboarded: boolean;
}

const DEFAULTS: StoredProfile = {
  spending: { ...DEFAULT_SPEND },
  profile: { ...DEFAULT_PROFILE },
  bank: null,
  cardIds: [],
  onboarded: false,
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
      cardIds: Array.isArray(parsed.cardIds) ? parsed.cardIds : [],
      onboarded: parsed.onboarded ?? false,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Hook that reads the sessionStorage profile on mount (client-only, SSR-safe). */
export function useStoredProfile(): [StoredProfile, boolean] {
  const [profile, setProfile] = useState<StoredProfile>(DEFAULTS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);
  return [profile, ready];
}

// ── The signed-in-aware store ──────────────────────────────────────────────────────

/** Shape returned by GET /api/profile. */
interface ServerState {
  cardIds: string[];
  spending: Record<string, number> | null;
  salaryAed: number | null;
  bank: string | null;
}

function serverToStored(s: ServerState): StoredProfile {
  return {
    spending: { ...DEFAULTS.spending, ...(s.spending ?? {}) },
    profile: {
      monthlySalaryAed: s.salaryAed ?? DEFAULTS.profile.monthlySalaryAed,
      uaeResident: true,
    },
    bank: s.bank,
    cardIds: s.cardIds,
    onboarded: s.spending !== null,
  };
}

export interface ProfileStore {
  state: StoredProfile;
  ready: boolean;
  signedIn: boolean;
  /** Merge a patch into the profile and persist it (sessionStorage always; DB when signed in). */
  save: (patch: Partial<StoredProfile>) => void;
}

/**
 * The profile store the app screens use. Hydrates from Postgres for signed-in users
 * and from sessionStorage for guests, and `save` writes back to whichever applies.
 */
export function useProfileStore(): ProfileStore {
  const { isSignedIn, isLoaded } = useAuth();
  const [state, setState] = useState<StoredProfile>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const dbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate once auth is known.
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    if (isSignedIn) {
      // Show the local cache immediately, then reconcile with the server.
      setState(loadProfile());
      fetch("/api/profile")
        .then((r) => (r.ok ? (r.json() as Promise<ServerState>) : null))
        .then((s) => {
          if (cancelled || !s) return;
          const merged = serverToStored(s);
          setState(merged);
          saveProfile(merged);
        })
        .catch(() => {
          /* keep the cache on network failure */
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
    } else {
      setState(loadProfile());
      setReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const save = useCallback(
    (patch: Partial<StoredProfile>) => {
      setState((prev) => {
        const next: StoredProfile = {
          ...prev,
          ...patch,
          spending: patch.spending ? { ...prev.spending, ...patch.spending } : prev.spending,
          profile: patch.profile ? { ...prev.profile, ...patch.profile } : prev.profile,
        };
        saveProfile(next);

        if (isSignedIn) {
          // Debounce the DB write so dragging a slider doesn't fire a request per pixel.
          if (dbTimer.current) clearTimeout(dbTimer.current);
          dbTimer.current = setTimeout(() => {
            const body: Record<string, unknown> = {};
            if (patch.spending || patch.onboarded) body.spending = next.spending;
            if (patch.profile) body.salaryAed = next.profile.monthlySalaryAed;
            if (patch.bank !== undefined) body.bank = next.bank;
            if (patch.cardIds !== undefined) body.cardIds = next.cardIds;
            if (Object.keys(body).length === 0) return;
            void fetch("/api/profile", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }).catch(() => {
              /* the sessionStorage cache still holds the change */
            });
          }, 500);
        }
        return next;
      });
    },
    [isSignedIn],
  );

  return { state, ready, signedIn: Boolean(isSignedIn), save };
}

export { DEFAULTS as DEFAULT_STORED_PROFILE };
