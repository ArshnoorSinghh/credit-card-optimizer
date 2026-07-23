import {
  recommendRedemptions,
  burnPriority,
  REDEMPTION_VALUATIONS,
  type PointsHolding,
  type RedemptionGoal,
  type RedemptionPlan,
  type BurnPlan,
} from "@fils/engine";

/*
  Client-side runner for the Points & Redemption Optimizer (Engine 2).

  Same pattern as lib/optimizer.ts: the engine is pure and framework-free, so the
  browser calls it directly. Redemptions and burn timing need NO card data and NO
  database — they reason only over the user's holdings plus the engine's researched
  valuation/expiry tables — so there is nothing to fetch. The screen is genuinely
  functional with no API.

  We do NOT modify the engine (ownership rule) — we only call its exported
  functions. Every number the page shows originates from a value returned here.
*/

export type { PointsHolding, RedemptionGoal, RedemptionPlan, BurnPlan };

/**
 * The valid currency universe = the keys of the engine's redemption valuation
 * table. Any currency NOT in here is scored as a flagged placeholder by the
 * engine, so we only ever let the user pick from these (sorted for the dropdown).
 */
export const AVAILABLE_CURRENCIES: string[] = Object.keys(REDEMPTION_VALUATIONS).sort();

/** The four goals the engine models, in the order we present them. */
export const REDEMPTION_GOALS = ["max_value", "flights", "hotels", "cash_equivalent"] as const;

/** Human labels + one-line hints for each goal. */
export const GOAL_META: Record<RedemptionGoal, { label: string; hint: string }> = {
  max_value: { label: "Max value", hint: "Best AED per point, any route" },
  flights: { label: "Flights", hint: "Airline redemptions" },
  hotels: { label: "Hotels", hint: "Hotel-night redemptions" },
  cash_equivalent: { label: "Cash / bill", hint: "Statement credit, bills, vouchers" },
};

/**
 * A realistic starting inventory so the screen shows a meaningful result on load.
 * Every currency here is a verified key of REDEMPTION_VALUATIONS. Skywards carries
 * an expiryDate so the burn engine has something concrete to reason from; the
 * others deliberately omit it, to show the engine's honest "no false urgency" path.
 */
export const DEFAULT_HOLDINGS: PointsHolding[] = [
  { currency: "Skywards Miles", balance: 60000, expiryDate: nearFutureIso(5) },
  { currency: "TouchPoints (convertible to miles)", balance: 120000 },
  { currency: "FAB Rewards", balance: 40000 },
];

/** Today as ISO YYYY-MM-DD — the `asOf` the burn engine reasons from. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** An ISO date `months` from today — used only to seed a demo expiry. */
function nearFutureIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface RedemptionResult {
  plan: RedemptionPlan;
  burn: BurnPlan;
}

/**
 * Run both Engine-2 optimizers over an inventory + goal. Returns null on any
 * failure so the UI can degrade gracefully rather than white-screen — matching
 * runOptimize in lib/optimizer.ts.
 *
 * `premiumMultiplier` (optional) lets a caller value premium-cabin seats as
 * economy × N; without it the engine does not value premium seats (it refuses to
 * invent a number), which is the safe default.
 */
export function runRedemptions(
  inventory: PointsHolding[],
  goal: RedemptionGoal,
  opts: { premiumMultiplier?: number } = {},
): RedemptionResult | null {
  try {
    const plan = recommendRedemptions(inventory, goal, undefined, undefined, opts);
    const burn = burnPriority(inventory, todayIso());
    return { plan, burn };
  } catch (err) {
    console.error("Redemptions engine failed:", err);
    return null;
  }
}
