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

  // Airline miles — deep, liquid programs; firm data. 0.037 = economy-flight value
  // from the 2026-07 redemption research (Skywards economy Saver NOT devalued;
  // Etihad economy). Adopted from Engine 2's primary route. // was 0.035.
  "Skywards Miles": { aedPerUnit: 0.037, confidence: "high", note: "economy-flight value (research 2026-07)" },
  "Etihad Guest Miles": { aedPerUnit: 0.037, confidence: "high", note: "economy-flight value (research 2026-07)" },

  // Points with official/known redemption value.
  "Smiles Points": { aedPerUnit: 0.01, confidence: "high", note: "Official Smiles redemption value" },

  // Points with a defensible but softer estimate.
  "FAB Rewards": { aedPerUnit: 0.007, confidence: "medium" },
  // ENBD Plus Points: HELD at 0.01 pending verification. Engine 2 research puts the
  // card-bill route near 0.75, but adopting that makes enbd_visa_flexi (1 Plus
  // Point/AED) imply a >75% return — implausible. The earn rate AND per-point value
  // both need cofounder verification before we move this off 0.01. See the
  // data_caveat flag on enbd_visa_flexi and the implausibility guardrail in scoreCard.
  "Plus Points": { aedPerUnit: 0.01, confidence: "low", note: "HELD at 0.01 pending earn-rate + per-point verification (research suggests ~0.75; would imply implausible >75% return on enbd_visa_flexi)" },
  // ADCB TouchPoints: primary = in-store instant redemption 0.005 (research 2026-07);
  // NO card-bill route exists. // was 0.01.
  "TouchPoints (convertible to miles)": { aedPerUnit: 0.005, confidence: "high", note: "ADCB TouchPoints — in-store instant redemption (research 2026-07)" },
  "Marriott Bonvoy Points": { aedPerUnit: 0.028, confidence: "medium", note: "hotel-night value (research 2026-07)" }, // was 0.03

  // Bank/store points where UAE-specific redemption data is thin. Conservative
  // 0.0075 placeholder, flagged low for research.
  "LuLu Points": { aedPerUnit: 0.0075, confidence: "low" },
  // DIB Wala'a: base/cashback/bill-payment redemption 0.005 (research 2026-07). // was 0.0075.
  "DIB Points": { aedPerUnit: 0.005, confidence: "medium", note: "DIB Wala'a base redemption (research 2026-07)" },
  "RAKrewards Points": { aedPerUnit: 0.0075, confidence: "low" },
  // "Salaam Points" was removed in 2026-07: its only card (mashreq_solitaire_amex)
  // left with the Amex-network cleanup, so no card earns it. The researched value
  // (Mashreq cashback 0.00263) and its mile-transfer ratios are preserved in
  // Engine 2 (redemption-valuations.ts / conversions.ts) for if a Salaam card returns.
  // NOTE: "AED (Salaam Points convertible)" below is a DIFFERENT currency and stays.
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

  // RAKBANK cashback: face value like any cashback, but it EXPIRES 15 months after
  // earning, which plain "AED" cashback does not. Split into its own currency so the
  // expiry policy can be scoped to RAKBANK — keying it to "AED" would impose the
  // window on every cashback card in the dataset. See expiry-policy.ts.
  //
  // why the value is NOT discounted for expiry: how much a 15-month window costs
  // depends on how often the user redeems, which this table cannot see. Discounting
  // here would invent an average user. Engine 1 flags the term; Engine 2's burn
  // engine models the timing against the user's real dates.
  "AED (RAKBANK cashback)": {
    aedPerUnit: 1.0,
    confidence: "high",
    note: "Cashback — face value; expires 15 months after earning (see expiry-policy.ts)",
  },

  // Nol fare credit: transit fares are paid from Nol balance at face, so 1 unit
  // redeems for 1 AED of travel. Medium — face-value mechanics are clear, but
  // it's usable only for transit, so it's not fully cash-equivalent.
  "AED (Nol points)": {
    aedPerUnit: 1.0,
    confidence: "medium",
    note: "transit fare credit redeems at face value",
  },

  // Citi ThankYou (UAE): pay-with-points redemption 0.03 (research 2026-07). The
  // earlier 0.05 reflected US best-case transfers; the UAE realistic default is
  // lower. // was 0.05.
  "ThankYou Points": {
    aedPerUnit: 0.03,
    confidence: "medium",
    note: "Citi UAE pay-with-points redemption (research 2026-07)",
  },
  // Still NOT researched — the currency is user-customizable, so it's genuinely
  // unknown. Flagged placeholder; override before trusting.
  "Multiple programs (customizable)": {
    aedPerUnit: 0.0075,
    confidence: "low",
    note: "NOT researched — currency is user-customizable; genuinely unknown. Needs valuation.",
  },

  // ── 2026-07 dataset: currency labels renamed + new programs added ──────────────
  // The hand-verified 2026-07 data relabeled several currencies and introduced new
  // ones. RENAMES below inherit the SAME reviewed AED value as their prior label
  // (that value was researched; only the string changed). NEW programs get a
  // conservative, flagged placeholder — never a confident value we didn't research.
  // NOTE: most of the new cards quote rates as a PERCENT ("% back in <points>"),
  // and for a percent rate the AED value is invariant to aedPerUnit (the unit
  // conversion cancels), so a placeholder only affects unit COUNTS/caps, not value.

  // Renames of currencies with an existing researched value.
  "Emirates Skywards Miles": { aedPerUnit: 0.037, confidence: "high", note: "economy-flight value (research 2026-07); was 'Skywards Miles'" },
  "ADCB TouchPoints": { aedPerUnit: 0.005, confidence: "high", note: "in-store instant redemption (research 2026-07); was 'TouchPoints (convertible to miles)'" },
  "Citi ThankYou Points": { aedPerUnit: 0.03, confidence: "medium", note: "Citi UAE pay-with-points (research 2026-07); was 'ThankYou Points'" },
  "DIB Wala’a Rewards": { aedPerUnit: 0.005, confidence: "medium", note: "DIB Wala'a base redemption (research 2026-07); was 'DIB Points'" },
  "HSBC Rewards Points": { aedPerUnit: 0.0075, confidence: "low", note: "was 'HSBC Reward Points'" },
  // UPoints: the card data itself states "10 UPoints = AED 1", so 0.1 is issuer-
  // stated, not guessed. Medium (label was previously unresearched at 0.0075).
  "UPoints": { aedPerUnit: 0.1, confidence: "medium", note: "issuer-stated 10 UPoints = AED 1 (card data 2026-07); was 'U By Emaar Points'" },

  // NEW programs — conservative flagged placeholders. NEEDS RESEARCH before trusting.
  "Mashreq Vantage": { aedPerUnit: 0.0075, confidence: "low", note: "NOT researched — new program (Mashreq Vantage). Placeholder; needs valuation." },
  "360 Rewards Points": { aedPerUnit: 0.0075, confidence: "low", note: "NOT researched — new program (Standard Chartered 360 Rewards). Placeholder." },
  "AirRewards": { aedPerUnit: 0.0075, confidence: "low", note: "NOT researched — new program (Air Arabia AirRewards). Placeholder." },
  "Amazon Reward Points": { aedPerUnit: 0.0075, confidence: "low", note: "NOT researched — new program (EI Amazon). Placeholder; rates are percent-quoted so value is placeholder-invariant." },
  // EI SmartMiles are quoted per-AED (unit counts matter), so the value bites
  // directly. Researched 2026-07 to 0.010 AED/mile (was a 0.0075 placeholder).
  "EI SmartMiles": { aedPerUnit: 0.01, confidence: "medium", note: "Emirates Islamic SmartMiles — researched 2026-07 (was 0.0075 placeholder)" },
  // Cashback-type currencies redeemed as statement credit / store credit at face value.
  "Cashback Points": { aedPerUnit: 1.0, confidence: "medium", note: "cashback redeemed as statement credit at face value" },
  "talabat credit": { aedPerUnit: 1.0, confidence: "medium", note: "talabat store credit, spent 1:1 at face value" },
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
