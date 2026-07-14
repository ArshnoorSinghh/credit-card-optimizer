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

// why the "AED (X)" keys are NOT all valued the same: the data has a pure "AED"
// cashback currency plus several "AED (<program>)" currencies, and they differ in
// how cash-like they really are. Each is judged on its own mechanics rather than
// lumped together: Salaam-convertible and Nol credit redeem at face value (1.0);
// Booking.com credit is a flagged 0.85 placeholder pending re-verification. Pure
// "AED" stays at face value.
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
  // ENBD Plus Points: issuer states up to ~1.5% of spend redeemable as cashback;
  // 0.01 is the conservative end of that band (1 pt/AED earning -> ~1% back).
  "Plus Points": { aedPerUnit: 0.01, confidence: "medium" },
  "TouchPoints (convertible to miles)": { aedPerUnit: 0.01, confidence: "medium", note: "ADCB TouchPoints" },
  "Marriott Bonvoy Points": { aedPerUnit: 0.03, confidence: "medium" },

  // Bank/store points where UAE-specific redemption data is thin. Conservative
  // 0.0075 placeholder, flagged low for research.
  "LuLu Points": { aedPerUnit: 0.0075, confidence: "low" },
  "DIB Points": { aedPerUnit: 0.0075, confidence: "low" },
  "RAKrewards Points": { aedPerUnit: 0.0075, confidence: "low" },
  "Salaam Points": { aedPerUnit: 0.0075, confidence: "low" },
  // why 1.0: this card's rewards are type "cashback", quoted as percentages with
  // AED-denominated caps and redeemable as statement credit — functionally
  // cashback that happens to be Salaam-convertible. So it earns face value, and
  // its unit caps behave as AED caps (as intended), unlike the pure-points
  // "Salaam Points" currency above. Medium (not high) only because the currency
  // label carries some ambiguity; the underlying structure is plain cashback.
  "AED (Salaam Points convertible)": { aedPerUnit: 1.0, confidence: "medium", note: "Functionally cashback (statement credit at face value); Salaam-convertible" },
  "CBD Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "U By Emaar Points": { aedPerUnit: 0.0075, confidence: "low" },
  "dnata Points": { aedPerUnit: 0.0075, confidence: "low" },
  "DDF Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "HSBC Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  "Diners Club Reward Points": { aedPerUnit: 0.0075, confidence: "low" },
  // why 0.85 placeholder, low: the card data conflicts with the issuer's current
  // published structure — this currency may not exist as modeled. Priced below
  // face as a restricted travel credit, but the real fix is card re-verification.
  "AED (Booking.com credit)": {
    aedPerUnit: 0.85,
    confidence: "low",
    note: "card data conflicts with issuer's current published structure — this currency may not exist; full card re-verification required (adib_booking_signature).",
  },

  // Nol fare credit: transit fares are paid from Nol balance at face, so 1 unit
  // redeems for 1 AED of travel. Medium — face-value mechanics are clear, but
  // it's usable only for transit, so it's not fully cash-equivalent.
  "AED (Nol points)": {
    aedPerUnit: 1.0,
    confidence: "medium",
    note: "transit fare credit redeems at face value",
  },

  // ThankYou Points: ~1¢ (0.05 AED) is the realistic US practical floor; 1.6–1.9¢
  // is reachable only via optimized transfer partners. We price the realistic
  // mid-range, not best-case. Medium.
  "ThankYou Points": {
    aedPerUnit: 0.05,
    confidence: "medium",
    note: "~1¢ US practical floor; 1.6–1.9¢ only via optimized transfers — we price realistic mid-range, not best-case",
  },
  // Still NOT researched — the currency is user-customizable, so it's genuinely
  // unknown. Flagged placeholder; override before trusting.
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
