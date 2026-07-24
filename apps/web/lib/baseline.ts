import {
  optimizePortfolio,
  type Portfolio,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";
import { ALL_CARDS } from "@/lib/cards";
import { DEFAULT_PROFILE } from "@/lib/optimizer";

/*
  Baseline = "what your CURRENT cards already earn you."

  The entry flow anchors the optimizer's reveal against this number: we show the
  user what their existing wallet nets before showing the better one, so the
  upgrade has something to be measured against.

  We do NOT add any valuation/optimization logic to the human-owned engine. We
  reuse its public `optimizePortfolio` by handing it a PRIVATE universe made only
  of the user's held cards. The engine then scores exactly those cards for this
  spend — the same math the recommendation uses — with no special-casing.

  why (modeling choice, app-layer, flagged for review): the baseline assumes the
  user swipes their held cards OPTIMALLY (each category on whichever held card
  pays best). That's the best case for the current wallet, which makes the reveal
  delta CONSERVATIVE — it never overstates how much switching would gain. A naive
  "you probably misallocate" baseline would inflate the delta; we deliberately
  don't do that.
*/

// why: the user already HOLDS these cards, so eligibility (salary/residency) must
// never drop them. We score against a permissive profile so every held card
// survives the engine's eligibility filter — the profile only gates the reveal's
// card universe, never the baseline's.
const PERMISSIVE_PROFILE: UserProfile = {
  monthlySalaryAed: Number.MAX_SAFE_INTEGER,
  uaeResident: true,
};

/** Largest held-card baseline we can score via the 1/2/3 engine API. */
export const MAX_HELD_CARDS = 3;

/**
 * Net annual AED the user's held cards earn on this spend, allocated optimally.
 *
 * Returns null when nothing can be scored (no held cards, or every held card is
 * benched / unknown to the dataset) so the UI can simply omit the anchor rather
 * than show a misleading zero. Never throws — mirrors runOptimize's fail-soft.
 */
export function runBaseline(
  heldCardIds: string[],
  spending: SpendingProfile,
  _profile: UserProfile = DEFAULT_PROFILE,
): Portfolio | null {
  try {
    const held = ALL_CARDS.filter((c) => heldCardIds.includes(c.id)).slice(0, MAX_HELD_CARDS);
    if (held.length === 0) return null;

    // Score the held cards as their own universe. The portfolio whose size equals
    // the held-card count is the exact held set (there's only one subset of that
    // size), allocated optimally by the engine.
    const result = optimizePortfolio(spending, PERMISSIVE_PROFILE, held);
    const bySize: Record<number, Portfolio | null> = {
      1: result.best1,
      2: result.best2,
      3: result.best3,
    };
    // A benched held card lowers the effective count; fall back to the best the
    // engine could actually score across the held cards.
    return bySize[held.length] ?? result.overallBest;
  } catch (err) {
    console.error("Baseline failed:", err);
    return null;
  }
}

/**
 * How much more per year an optimized portfolio nets over the current baseline.
 * Clamped at 0 for display — we never show the upgrade as a loss, and a tiny
 * negative is just floating-point noise from two independent scorings.
 */
export function annualDelta(optimizedNet: number, baselineNet: number | null | undefined): number {
  if (baselineNet == null) return 0;
  return Math.max(0, optimizedNet - baselineNet);
}
