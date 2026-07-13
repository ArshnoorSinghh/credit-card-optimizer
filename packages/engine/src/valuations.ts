/**
 * Valuation model.
 *
 * Maps each reward currency that appears in cards.json to an AED-per-unit value,
 * so the scorer can convert points/miles earnings into a comparable AED figure.
 *
 * Per CLAUDE.md: values are researched, each carries an explicit confidence, and
 * currencies we could NOT research are flagged (not silently guessed). The table
 * is a plain data structure the caller can override per-currency — these are only
 * defaults, meant to become user-editable later.
 *
 * Pure data + pure lookups. No I/O.
 *
 * Values researched July 2026. They are point estimates of what one unit is
 * realistically worth in AED when redeemed sensibly; they are NOT bank list
 * prices. Confidence reflects how firm the underlying data is.
 */

export type ValuationConfidence = "high" | "medium" | "low";

export interface ValuationEntry {
  /** AED value of one unit of the reward currency (e.g. 1 Skywards Mile ≈ 0.035 AED). */
  aedPerUnit: number;
  confidence: ValuationConfidence;
  /** Optional caveat — present where the value is a flagged placeholder or a judgment call. */
  note?: string;
}

/** Keyed by the exact `rewards.currency` string in cards.json. */
export type ValuationTable = Record<string, ValuationEntry>;

// why the "AED (X)" keys are valued LOW, not at 1.0: the data has both a pure
// "AED" cashback currency and several "AED (<store> credit)" currencies. The
// researched spec deliberately values the store-credit forms (Booking.com,
// Salaam) at 0.0075 — they are restricted credit, not spendable cash — so we
// treat every "AED (<program>)" the same way and keep pure "AED" at face value.
export const DEFAULT_VALUATIONS: ValuationTable = {
  // Cashback — face value by definition.
  AED: { aedPerUnit: 1.0, confidence: "high", note: "Cashback — face value by definition" },

  // Airline miles — deep, liquid programs; firm data.
  "Skywards Miles": { aedPerUnit: 0.035, confidence: "high" },
  "Etihad Guest Miles": { aedPerUnit: 0.035, confidence: "high" },

  // Points with official/known redemption value.
  "Smiles Points": { aedPerUnit: 0.01, confidence: "high", note: "Official Smiles redemption value" },

  // Points with a defensible but softer estimate.
  "Membership Rewards": { aedPerUnit: 0.07, confidence: "medium" },
  "FAB Rewards": { aedPerUnit: 0.007, confidence: "medium" },
  "TouchPoints (convertible to miles)": { aedPerUnit: 0.01, confidence: "medium", note: "ADCB TouchPoints" },
  "Marriott Bonvoy Points": { aedPerUnit: 0.03, confidence: "medium" },

  // Bank/store points where UAE-specific redemption data is thin. Conservative
  // 0.0075 placeholder, flagged low for research.
  "LuLu Points": { aedPerUnit: 0.0075, confidence: "low" },
  "DIB Points": { aedPerUnit: 0.0075, confidence: "low" },
  "RAKrewards Points": { aedPerUnit: 0.0075, confidence: "low" },
  "Salaam Points": { aedPerUnit: 0.0075, confidence: "low" },
  "AED (Salaam Points convertible)": { aedPerUnit: 0.0075, confidence: "low", note: "Salaam-convertible credit — valued as Salaam Points, not face AED" },
  "CBD Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "U By Emaar Points": { aedPerUnit: 0.0075, confidence: "low" },
  "dnata Points": { aedPerUnit: 0.0075, confidence: "low" },
  "DDF Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "HSBC Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "Diners Club Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "AED (Booking.com credit)": { aedPerUnit: 0.0075, confidence: "low", note: "Booking.com credit — restricted, valued below face AED" },

  // NOT in the researched spec. Flagged placeholders — override before trusting.
  // why 0.0075: defaulted to the store-credit rate for consistency, but this is a
  // guess. Nol fare credit may be closer to ~1.0; ThankYou/Multiple are unknown.
  "AED (Nol points)": {
    aedPerUnit: 0.0075,
    confidence: "low",
    note: "NOT researched — placeholder; Nol fare credit may be closer to face value. Needs valuation.",
  },
  "ThankYou Points": {
    aedPerUnit: 0.0075,
    confidence: "low",
    note: "NOT researched — placeholder. Needs valuation.",
  },
  "Multiple programs (customizable)": {
    aedPerUnit: 0.0075,
    confidence: "low",
    note: "NOT researched — currency is user-customizable; genuinely unknown. Needs valuation.",
  },
};

/**
 * Merge per-currency overrides onto a base table (defaults to DEFAULT_VALUATIONS).
 * Lets a caller adjust one currency without restating all of them — the intended
 * path for user-editable valuations.
 */
export function withValuations(
  overrides: ValuationTable,
  base: ValuationTable = DEFAULT_VALUATIONS,
): ValuationTable {
  return { ...base, ...overrides };
}

/**
 * Look up a currency. Missing currencies do NOT crash scoring — they return a
 * flagged unknown-value entry so the caller can surface "we can't value this",
 * rather than silently treating it as worthless or fabricating a number.
 * (The default table is exhaustively tested against cards.json, so this fallback
 * only fires for a caller-supplied table that dropped a currency.)
 */
export function resolveValuation(currency: string, table: ValuationTable = DEFAULT_VALUATIONS): ValuationEntry {
  const entry = table[currency];
  if (entry) return entry;
  return {
    aedPerUnit: 0,
    confidence: "low",
    note: `No valuation for "${currency}" — treated as 0 AED/unit, needs an entry`,
  };
}
