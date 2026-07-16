/**
 * Burn engine (Engine 2).
 *
 * Points expire. This ranks a user's holdings by how urgently they should be spent
 * ("burned") before they vanish or devalue. It answers "what do I lose first, and
 * what's most at stake?".
 *
 * Honesty constraints (the hard part):
 *  - We only claim urgency when we can actually date an expiry. An explicit
 *    expiryDate is ground truth. Otherwise we fall back to a KNOWN PROGRAM POLICY
 *    default (e.g. Etihad = 18 months) — but a policy alone doesn't date a balance;
 *    we can only PROJECT a date if the holding also has an earnedDate. Without one,
 *    urgency is "unknown" and we say so — no false alarms.
 *  - Program defaults are flagged "estimated from program policy, not user-confirmed".
 *  - Known upcoming devaluations (Skywards premium, 20 May 2026) are surfaced as a
 *    "burn premium redemptions before this date" warning.
 *
 * Burn-priority ordering:
 *   1. Urgency first        (urgent > soon > later > unknown)
 *   2. Value-at-risk desc   (balance x best rate — most AED on the line first)
 *   3. Versatility asc      (fewest escape routes first — see note below)
 *
 * Pure functions. No I/O — the caller passes `asOf` (today) in.
 */

import type { PointsInventory, PointsHolding } from "./points-inventory";
import {
  bestRoute,
  supportedClasses,
  type RedemptionClass,
  type RedemptionValuationTable,
  REDEMPTION_VALUATIONS,
} from "./redemption-valuations";

export type BurnUrgency = "urgent" | "soon" | "later" | "unknown";

const URGENT_DAYS = 90;
const SOON_DAYS = 180;

export interface ProgramExpiryDefault {
  /** Currency key (matches cards.json / valuations.ts). */
  currency: string;
  /** Validity window in months. */
  months: number;
  /** What the clock counts from. */
  basis: "from_earning" | "from_last_activity";
  note: string;
}

// why these are flagged estimates: they're program marketing policy, not a per-user
// confirmed expiry. We surface them to inform, never to manufacture urgency.
export const PROGRAM_EXPIRY_DEFAULTS: ProgramExpiryDefault[] = [
  {
    currency: "Etihad Guest Miles",
    months: 18,
    basis: "from_earning",
    note: "estimated from program policy (18 months, extendable ONLY by flight activity — not purchases/transfers — since June 2024), not user-confirmed",
  },
  {
    currency: "Skywards Miles",
    months: 36,
    basis: "from_earning",
    note: "estimated from program policy (~3 years), not user-confirmed",
  },
  {
    currency: "Smiles Points",
    months: 24,
    basis: "from_earning",
    note: "estimated from program policy, not user-confirmed",
  },
  {
    currency: "Marriott Bonvoy Points",
    months: 24,
    basis: "from_last_activity",
    note: "estimated from program policy (expire after 24 months of inactivity), not user-confirmed",
  },
];

export interface Devaluation {
  currency: string;
  /** ISO date the devaluation takes effect. */
  effectiveDate: string;
  /** Which redemption classes lose value. */
  affects: RedemptionClass[];
  note: string;
}

// why one list: like conversion ratios, devaluation dates change and should live in
// a single editable place the burn engine reads.
export const DEVALUATIONS: Devaluation[] = [
  {
    currency: "Skywards Miles",
    effectiveDate: "2026-05-20",
    affects: ["flight_premium"],
    note: "~15% premium-cabin devaluation — burn premium (business/first) redemptions before this date",
  },
];

function daysBetween(fromISO: string, toISO: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  // Round to whole days so boundary tests (89 vs 91) are exact regardless of any
  // time component in the ISO strings.
  return Math.round((to - from) / MS_PER_DAY);
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function classifyUrgency(daysToExpiry: number): BurnUrgency {
  if (daysToExpiry <= URGENT_DAYS) return "urgent";
  if (daysToExpiry <= SOON_DAYS) return "soon";
  return "later";
}

export interface BurnItem {
  currency: string;
  balance: number;
  /** The expiry we're reasoning from — explicit, projected from policy, or absent. */
  expiryDate?: string;
  expirySource: "explicit" | "projected_default" | "unknown";
  daysToExpiry?: number;
  urgency: BurnUrgency;
  /** balance x best available rate — the AED you'd lose if this expired unused. */
  valueAtRiskAed: number;
  /** How many redemption types this currency supports. Fewer = burn earlier. */
  versatility: number;
  /** Set when a known devaluation is upcoming for this currency. */
  devaluationWarning?: string;
  flags: string[];
}

export interface BurnPlan {
  asOf: string;
  /** Items ordered by burn priority (most urgent / most at risk first). */
  items: BurnItem[];
  flags: string[];
}

const URGENCY_ORDER: Record<BurnUrgency, number> = { urgent: 0, soon: 1, later: 2, unknown: 3 };

/**
 * Determine an item's expiry basis: explicit date wins; else project from program
 * policy IF we have an earnedDate/last-activity date; else unknown.
 */
function resolveExpiry(
  holding: PointsHolding,
  defaults: readonly ProgramExpiryDefault[],
): { expiryDate?: string; source: BurnItem["expirySource"]; flags: string[] } {
  const flags: string[] = [];
  if (holding.expiryDate) {
    return { expiryDate: holding.expiryDate, source: "explicit", flags };
  }
  const def = defaults.find((d) => d.currency === holding.currency);
  if (def) {
    if (holding.earnedDate) {
      // We can project a concrete date — but it's an estimate off program policy.
      const projected = addMonthsISO(holding.earnedDate, def.months);
      flags.push(
        `expiry projected as ${projected} (${def.months} months ${def.basis === "from_earning" ? "from earning" : "from last activity"}) — ${def.note}`,
      );
      return { expiryDate: projected, source: "projected_default", flags };
    }
    // Policy known, but no date to anchor it to — inform, don't invent urgency.
    flags.push(
      `program policy: ${holding.currency} typically expires ${def.months} months ${def.basis === "from_earning" ? "from earning" : "from last activity"} (${def.note}); add an expiry or earned date to enable urgency`,
    );
    return { source: "unknown", flags };
  }
  // No explicit date and no known default -> genuinely unknown. No false urgency.
  flags.push("expiry unknown — no explicit date and no known program default");
  return { source: "unknown", flags };
}

/**
 * Rank an inventory by burn priority as of `asOf` (ISO date, e.g. "2026-07-15").
 */
export function burnPriority(
  inventory: PointsInventory,
  asOf: string,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
  expiryDefaults: readonly ProgramExpiryDefault[] = PROGRAM_EXPIRY_DEFAULTS,
  devaluations: readonly Devaluation[] = DEVALUATIONS,
): BurnPlan {
  const planFlags: string[] = [];

  const items: BurnItem[] = inventory.map((holding) => {
    const { currency, balance } = holding;
    const isUnknown = !table[currency];
    if (isUnknown) {
      planFlags.push(`unknown currency "${currency}" — value-at-risk uses a flagged placeholder rate`);
    }

    const { expiryDate, source, flags } = resolveExpiry(holding, expiryDefaults);

    let urgency: BurnUrgency = "unknown";
    let daysToExpiry: number | undefined;
    if (expiryDate) {
      daysToExpiry = daysBetween(asOf, expiryDate);
      urgency = daysToExpiry < 0 ? "urgent" : classifyUrgency(daysToExpiry);
      if (daysToExpiry < 0) flags.push(`already expired ${-daysToExpiry} day(s) ago`);
    }

    const rate = bestRoute(currency, table);
    const valueAtRiskAed = balance * rate.aedPerUnit;
    if (rate.note) flags.push(`best-rate basis: ${rate.type} — ${rate.note}`);

    // Versatility = number of distinct redemption CLASSES (genuine flexibility): a
    // currency with a card-bill route escapes more ways than a voucher-only one.
    const versatility = supportedClasses(currency, table).length;

    // Upcoming devaluation for this currency (effective in the future from asOf).
    let devaluationWarning: string | undefined;
    const deval = devaluations.find((d) => d.currency === currency && daysBetween(asOf, d.effectiveDate) >= 0);
    if (deval) {
      devaluationWarning = `${deval.note} (effective ${deval.effectiveDate})`;
      flags.push(devaluationWarning);
    }

    return {
      currency,
      balance,
      expiryDate,
      expirySource: source,
      daysToExpiry,
      urgency,
      valueAtRiskAed,
      versatility,
      devaluationWarning,
      flags,
    };
  });

  // Burn-priority sort: urgency, then value-at-risk desc, then versatility asc.
  //
  // why versatility asc as the final tie-breaker: a low-versatility currency (e.g.
  // Smiles, redeemable only as vouchers) has few escape routes — if you don't burn
  // it in its narrow window you're stuck. A versatile currency (miles: flights,
  // transfers, more) gives you more chances to extract value later, so among things
  // equally urgent and equally valuable, spend the inflexible one first.
  items.sort((a, b) => {
    const byUrgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    const byValue = b.valueAtRiskAed - a.valueAtRiskAed;
    if (byValue !== 0) return byValue;
    return a.versatility - b.versatility;
  });

  return { asOf, items, flags: planFlags };
}
