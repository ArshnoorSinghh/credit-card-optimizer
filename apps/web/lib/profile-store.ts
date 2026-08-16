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

// v2: added the held-card list. Bumped so a stale v1 blob doesn't hydrate the new
// field as undefined — a missing key just falls back to defaults instead.
const KEY = "fils.profile.v2";

export interface StoredProfile {
  spending: Record<SpendCategory, number>;
  profile: UserProfile;
  bank: string | null;
  /**
   * Card ids the user says they hold. Also anchors the "what you already earn"
   * baseline on the entry flow.
   */
  cardIds: string[];
  /**
   * Which co-brand retailers the user says they shop at, as bucket ids keyed by
   * merchant ("LuLu" -> "often"). An absent merchant means UNANSWERED, which the
   * engine treats as the old full-category assumption — so this map must never be
   * filled with defaults. See lib/merchant-shares.ts.
   *
   * LOCAL ONLY for now: /api/profile has no column for it, so it lives in
   * sessionStorage and is merged back over server-hydrated state below. Persisting
   * it properly needs a Prisma migration.
   */
  merchantShares: Record<string, string>;
  /** True once the user has set a real spending profile (not just the defaults). */
  onboarded: boolean;
}

const DEFAULTS: StoredProfile = {
  spending: { ...DEFAULT_SPEND },
  profile: { ...DEFAULT_PROFILE },
  bank: null,
  cardIds: [],
  merchantShares: {},
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
      merchantShares:
        typeof parsed.merchantShares === "object" && parsed.merchantShares !== null
          ? (parsed.merchantShares as Record<string, string>)
          : {},
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

/**
 * True when the account has never persisted anything — i.e. a brand-new sign-up.
 * Distinguishing this from "saved, but empty" is the whole point: only a fresh
 * account may have its state replaced by whatever the guest built locally.
 */
export function isUnwrittenServerState(s: ServerState): boolean {
  return s.spending === null && s.cardIds.length === 0 && s.salaryAed === null && s.bank === null;
}

/** True when the local (guest) profile holds work worth carrying into the account. */
export function hasLocalWork(p: StoredProfile): boolean {
  return p.onboarded || p.cardIds.length > 0;
}

/**
 * The PUT body that carries a guest profile into a fresh account.
 *
 * `spending` is only sent when the guest actually completed onboarding: the
 * server derives `onboarded` from `spending !== null`, so posting the default
 * sliders for someone who only picked a few held cards would mark them set up
 * and suppress the dashboard's "finish setting up" prompt.
 */
export function adoptionPatch(p: StoredProfile): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (p.onboarded) {
    body.spending = p.spending;
    body.salaryAed = p.profile.monthlySalaryAed;
  }
  if (p.cardIds.length > 0) body.cardIds = p.cardIds;
  if (p.bank) body.bank = p.bank;
  return body;
}

/**
 * `local` carries the fields the server does not store yet. Right now that is only
 * `merchantShares` — without this merge, a signed-in user's answers would be wiped
 * by every hydration, silently returning their co-brand cards to the held-back
 * state they had just answered their way out of.
 */
function serverToStored(s: ServerState, local: StoredProfile): StoredProfile {
  return {
    spending: { ...DEFAULTS.spending, ...(s.spending ?? {}) },
    profile: {
      monthlySalaryAed: s.salaryAed ?? DEFAULTS.profile.monthlySalaryAed,
      uaeResident: true,
    },
    bank: s.bank,
    cardIds: s.cardIds,
    merchantShares: local.merchantShares,
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
      const local = loadProfile();
      setState(local);
      fetch("/api/profile")
        .then((r) => (r.ok ? (r.json() as Promise<ServerState>) : null))
        .then((s) => {
          if (cancelled || !s) return;

          // The guest -> sign-up handover. The landing page's funnel is "try the
          // demo, then sign up", so by the time we get here the person has often
          // just spent a minute on the entry flow — and a fresh account returns
          // an empty state, which used to overwrite all of it with defaults (in
          // React state AND in the sessionStorage cache below). They landed on a
          // dashboard asking them to "finish setting up" work they had finished.
          //
          // Guarded on the account being genuinely unwritten, so this can only
          // ever fill a vacuum: an existing account's saved state always wins,
          // and a stale guest blob in a shared browser can never clobber it.
          if (isUnwrittenServerState(s) && hasLocalWork(local)) {
            saveProfile(local);
            const body = adoptionPatch(local);
            if (Object.keys(body).length > 0) {
              void fetch("/api/profile", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }).catch(() => {
                /* the local cache still holds it; the next save() retries */
              });
            }
            return;
          }

          const merged = serverToStored(s, local);
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
          // REPLACED, not merged: clearing an answer removes its key, and a merge
          // would resurrect it. The picker always sends the complete answer set.
          merchantShares: patch.merchantShares ?? prev.merchantShares,
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
