/**
 * Redemption recommender (Engine 2).
 *
 * Given a points inventory and a goal, for each holding find the best redemption —
 * across direct routes AND conversions-then-redemptions — compute AED realized, and
 * rank holdings by value. Each suggestion carries a plain-language "receipt" and
 * inherits the confidence flags of everything it touched.
 *
 * ── Phrasing rules (item 4) ──────────────────────────────────────────────────────
 * The recommender NEVER uses the word "cash". Redemption is described by the route's
 * semantic class and the currency's cash-capability:
 *   - card-bill-capable route  → "redeem as AED X off your card bill (statement credit)"
 *   - TouchPoints / Smiles     → "pay AED X of a utility bill / redeem as vouchers —
 *                                 no card-bill payment available"
 * (The goal that seeks liquid value is named `cash_equivalent`, never surfaced as prose.)
 *
 * ── Conversion rule (item 3) ─────────────────────────────────────────────────────
 * A conversion is only ever chosen when it strictly beats direct redemption — which,
 * at baseline economy value, it never does for a published ratio. Converting can win
 * only for premium-cabin targets, so pass `premiumMultiplier` to value premium seats;
 * otherwise the recommender states that converting is not worthwhile.
 *
 * Pure functions. No I/O.
 */

import type { PointsInventory } from "./points-inventory";
import {
  bestRouteAmongClasses,
  isCashCapable,
  premiumFlightRoute,
  resolveRedemptionProfile,
  routesForClasses,
  worstConfidence,
  type RedemptionClass,
  type RedemptionConfidence,
  type RedemptionRoute,
  type RedemptionValuationTable,
  REDEMPTION_VALUATIONS,
} from "./redemption-valuations";
import { conversionsFrom, evaluateConversion, type Conversion, CONVERSIONS, CONVERSION_FINDING } from "./conversions";

export type RedemptionGoal = "flights" | "hotels" | "max_value" | "cash_equivalent";

/** Which redemption classes satisfy each goal. max_value considers all classes. */
const GOAL_ALLOWED: Record<Exclude<RedemptionGoal, "max_value">, readonly RedemptionClass[]> = {
  flights: ["flight_economy", "flight_premium", "transfer"],
  hotels: ["hotel"],
  cash_equivalent: ["card_bill", "external_bill", "fixed_use", "voucher"],
};

const ALL_CLASSES: readonly RedemptionClass[] = [
  "card_bill",
  "external_bill",
  "fixed_use",
  "voucher",
  "partner_spend",
  "flight_economy",
  "flight_premium",
  "hotel",
  "transfer",
];

/** Classes where a holder might expect liquid value and so should hear the caveat. */
const LIQUID_CLASSES = new Set<RedemptionClass>(["card_bill", "external_bill", "fixed_use", "voucher", "partner_spend"]);

function allowedClassesForGoal(goal: RedemptionGoal): readonly RedemptionClass[] {
  return goal === "max_value" ? ALL_CLASSES : GOAL_ALLOWED[goal];
}

// Friendly, prose-safe goal labels (never the word "cash").
const GOAL_LABEL: Record<RedemptionGoal, string> = {
  flights: "flights",
  hotels: "hotels",
  max_value: "maximum value",
  cash_equivalent: "statement credit / bill payment",
};

export interface RecommendOptions {
  /**
   * Value premium-cabin seats as `economy × premiumMultiplier` for currencies that
   * model premium as a user multiple (Skywards). Without it, premium seats are not
   * valued (we don't invent a number) and conversions can't win.
   */
  premiumMultiplier?: number;
}

export interface RedemptionCandidate {
  type: string;
  class: RedemptionClass;
  aedPerUnit: number;
  /** Units redeemed — the balance, or converted units if a conversion was used. */
  units: number;
  aedValue: number;
  viaConversion?: { toCurrency: string; ratio: number; resultingUnits: number };
  confidence: RedemptionConfidence;
  flags: string[];
}

export interface RedemptionSuggestion {
  currency: string;
  balance: number;
  goal: RedemptionGoal;
  best: RedemptionCandidate | null;
  alternatives: RedemptionCandidate[];
  /** Plain-language advice for the chosen route — never uses the word "cash". */
  receipt: string;
  flags: string[];
}

export interface RedemptionPlan {
  goal: RedemptionGoal;
  suggestions: RedemptionSuggestion[];
  totalAed: number;
  flags: string[];
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** Human phrase for a chosen route, honoring the no-"cash" rule and cash-capability. */
function phraseFor(route: RedemptionCandidate, currency: string, cashCapable: boolean): string {
  const v = fmt(route.aedValue);
  // Cash-incapable currency redeemed for liquid value → the explicit caveat wording.
  if (!cashCapable && LIQUID_CLASSES.has(route.class)) {
    return `pay AED ${v} of a utility bill / redeem as vouchers — no card-bill payment available`;
  }
  switch (route.class) {
    case "card_bill":
      return `redeem as AED ${v} off your card bill (statement credit)`;
    case "external_bill":
      return `pay AED ${v} of a utility / Salik / school bill`;
    case "fixed_use":
      return `redeem AED ${v} toward Nol / education / donation (fixed use)`;
    case "voucher":
      return `redeem as AED ${v} in vouchers`;
    case "partner_spend":
      return `spend AED ${v} with a partner (in-store / e-commerce)`;
    case "flight_economy":
      return `book ~AED ${v} of economy flights`;
    case "flight_premium":
      return `book premium-cabin flights (~AED ${v} at your multiplier)`;
    case "hotel":
      return `redeem ~AED ${v} in hotel nights`;
    case "transfer":
      return `transfer to airline miles (~AED ${v})`;
  }
}

function receiptFor(currency: string, balance: number, c: RedemptionCandidate, cashCapable: boolean): string {
  const head = c.viaConversion
    ? `${balance} ${currency} → ${c.viaConversion.resultingUnits} ${c.viaConversion.toCurrency} (${c.viaConversion.ratio}:1): `
    : `${balance} ${currency}: `;
  return head + phraseFor(c, currency, cashCapable);
}

function toCandidate(route: RedemptionRoute, balance: number): RedemptionCandidate {
  const flags: string[] = [];
  if (route.note) flags.push(route.note);
  return {
    type: route.type,
    class: route.class,
    aedPerUnit: route.aedPerUnit,
    units: balance,
    aedValue: balance * route.aedPerUnit,
    confidence: route.confidence,
    flags,
  };
}

/** Best destination route for a conversion, considering allowed classes + premium. */
function destBestRoute(
  dest: string,
  allowed: readonly RedemptionClass[],
  table: RedemptionValuationTable,
  premiumMultiplier?: number,
): RedemptionRoute | null {
  let best = bestRouteAmongClasses(dest, allowed, table);
  if (allowed.includes("flight_premium")) {
    const premium = premiumFlightRoute(dest, premiumMultiplier, table);
    if (premium && (!best || premium.aedPerUnit > best.aedPerUnit)) best = premium;
  }
  return best;
}

function candidatesFor(
  currency: string,
  balance: number,
  goal: RedemptionGoal,
  table: RedemptionValuationTable,
  conversions: readonly Conversion[],
  opts: RecommendOptions,
): { candidates: RedemptionCandidate[]; conversionConsidered: boolean } {
  const allowed = allowedClassesForGoal(goal);
  const profile = resolveRedemptionProfile(currency, table);
  const candidates: RedemptionCandidate[] = [];

  // Direct routes.
  for (const r of routesForClasses(currency, allowed, table)) {
    const c = toCandidate(r, balance);
    if (profile.note) c.flags.push(profile.note);
    candidates.push(c);
  }
  // Premium direct route (Skywards), only if the caller supplied a multiplier.
  if (allowed.includes("flight_premium")) {
    const premium = premiumFlightRoute(currency, opts.premiumMultiplier, table);
    if (premium) candidates.push(toCandidate(premium, balance));
  }

  // Conversions: convert, then redeem the destination for the goal.
  let conversionConsidered = false;
  for (const conv of conversionsFrom(currency, conversions)) {
    const destRoute = destBestRoute(conv.to, allowed, table, opts.premiumMultiplier);
    if (!destRoute) continue;
    const resultingUnits = Math.floor(balance / conv.ratio);
    if (resultingUnits <= 0) continue;
    conversionConsidered = true;
    const destProfile = resolveRedemptionProfile(conv.to, table);
    const flags = [`converted from ${currency} at ${conv.ratio}:1`];
    if (conv.note) flags.push(conv.note);
    if (destRoute.note) flags.push(destRoute.note);
    if (destProfile.note) flags.push(destProfile.note);
    candidates.push({
      type: destRoute.type,
      class: destRoute.class,
      aedPerUnit: destRoute.aedPerUnit,
      units: resultingUnits,
      aedValue: resultingUnits * destRoute.aedPerUnit,
      viaConversion: { toCurrency: conv.to, ratio: conv.ratio, resultingUnits },
      confidence: worstConfidence(conv.confidence, destRoute.confidence),
      flags,
    });
  }

  return { candidates, conversionConsidered };
}

export function recommendRedemptions(
  inventory: PointsInventory,
  goal: RedemptionGoal,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
  conversions: readonly Conversion[] = CONVERSIONS,
  opts: RecommendOptions = {},
): RedemptionPlan {
  const suggestions: RedemptionSuggestion[] = [];
  const planFlags: string[] = [];

  for (const holding of inventory) {
    const { currency, balance } = holding;
    const cashCapable = isCashCapable(currency, table);
    const isUnknown = !table[currency];
    if (isUnknown) {
      planFlags.push(`unknown currency "${currency}" — valued at a flagged placeholder; verify before trusting`);
    }

    const { candidates, conversionConsidered } = candidatesFor(currency, balance, goal, table, conversions, opts);
    candidates.sort((a, b) => b.aedValue - a.aedValue);

    const best = candidates[0] ?? null;
    const alternatives = candidates.slice(1);
    const flags: string[] = best ? [...best.flags] : [];
    if (!best) flags.push(`no redemption available for "${currency}" toward ${GOAL_LABEL[goal]}`);
    if (isUnknown) flags.push(`"${currency}" is not in the researched set — placeholder valuation`);
    // Item 3: if we evaluated a conversion but chose a direct route, say why.
    if (best && !best.viaConversion && conversionConsidered) flags.push(CONVERSION_FINDING);

    suggestions.push({
      currency,
      balance,
      goal,
      best,
      alternatives,
      receipt: best
        ? receiptFor(currency, balance, best, cashCapable)
        : `${balance} ${currency}: no redemption toward ${GOAL_LABEL[goal]}`,
      flags,
    });
  }

  suggestions.sort((a, b) => (b.best?.aedValue ?? 0) - (a.best?.aedValue ?? 0));
  const totalAed = suggestions.reduce((sum, s) => sum + (s.best?.aedValue ?? 0), 0);
  return { goal, suggestions, totalAed, flags: planFlags };
}
