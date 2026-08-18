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
  AED: { aedPerUnit: 1.0, confidence: "high", note: "Cashback - face value by definition" },

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
  "Plus Points": { aedPerUnit: 0.01, confidence: "low", note: "HELD at 0.01 pending earn-rate + per-point verification (research suggests ~0.75; would imply implausible >75% return on the Emirates NBD Visa Flexi)" },
  // ADCB TouchPoints: primary = in-store instant redemption 0.005 (research 2026-07);
  // NO card-bill route exists. // was 0.01.
  "TouchPoints (convertible to miles)": { aedPerUnit: 0.005, confidence: "high", note: "ADCB TouchPoints - in-store instant redemption (research 2026-07)" },
  "Marriott Bonvoy Points": { aedPerUnit: 0.028, confidence: "medium", note: "hotel-night value (research 2026-07)" }, // was 0.03

  /*
    LuLu Points are TWO DIFFERENT CURRENCIES that share a name, 100x apart.

    ADCB:  "5,000 LuLu Points worth AED 50"  -> 1 point = AED 0.01
    ENBD:  "1 LuLu Point = 1 AED"            -> 1 point = AED 1.00

    Both issuer-stated, and each card's own earn table cross-checks its scale:
    ADCB pays 8 points per AED 1 at LuLu and advertises that as "8% back"
    (8 x 0.01 = 8%); ENBD pays 7 points per AED 100 and advertises 7%
    (7 x 1.00 / 100 = 7%). Neither is wrong — they are separate programmes with
    the same brand on them.

    why they MUST be separate keys: a single "LuLu Points" entry is off by 100x
    for whichever card it does not match. That is invisible in AED terms on
    percent-quoted rates (the unit cancels), which is exactly what makes it
    dangerous — it surfaces only in the CAPS, which are denominated in points.
    ENBD's AED 1,667/statement cap read as 1,667 x 0.0075 = AED 12.50 under the
    old shared value.
  */
  "LuLu Points (ADCB)": {
    aedPerUnit: 0.01,
    confidence: "high",
    note: "issuer-stated 5,000 LuLu Points = AED 50 (2026-08-08); cross-checks against the card's own '8% back' = 8 pts/AED",
  },
  "LuLu Points (Emirates NBD)": {
    aedPerUnit: 1.0,
    confidence: "high",
    note: "issuer-stated 1 LuLu Point = AED 1, redeemed at face value in LuLu stores (2026-08-08); cross-checks against '7% = 7 points per AED 100'",
  },
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
  // CBD publishes 1 Reward Point = AED 0.004 (min redemption 10,000 pts = AED 40),
  // sourced 2026-08-05 from the CBD redemption terms. Nearly HALF the 0.0075
  // placeholder that stood here, so every CBD points card was overstated ~1.9x.
  "CBD Reward Points": { aedPerUnit: 0.004, confidence: "medium", note: "issuer-stated 1 point = AED 0.004; 10,000-point minimum redemption (2026-08-05)" },
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
    note: "card data conflicts with issuer's current published structure - this currency may not exist; full card re-verification required (ADIB Booking.com Signature).",
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
    note: "Cashback - face value; expires 15 months after earning (see expiry-policy.ts)",
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
    note: "NOT researched - currency is user-customizable; genuinely unknown. Needs valuation.",
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
  // RESEARCH PRIORITY. Sensitivity analysis (assessValuationFragility, 2026-07)
  // shows this placeholder is not harmless: for a mid-range profile the recommended
  // 3-card portfolio is stable only within about -8%/+17% of this number, so an
  // error we cannot currently rule out changes which cards we recommend. Highest-
  // value valuation to research next.
  /*
    RESEARCHED 2026-08-05, was an 0.0075 placeholder — the highest-value valuation
    outstanding, and it was 2.85x TOO HIGH. Mashreq's own redemption table:
      cashback via app   380 points = AED 1  -> 0.00263 AED/point  <- used
      noon gift card     270 points = AED 1  -> 0.00370
      Amazon.ae gift card 303 points = AED 1 -> 0.00330
    Cashback is the floor and the only channel every holder can use, so it is the
    honest basis; the gift-card channels are worth ~25-40% more to someone who
    would have shopped there anyway. This single number is what made
    mashreq_platinum_plus read as an implausible 4.19% return (D3) — at the correct
    valuation its uncapped 10 pts/AED accelerator lands near 2.6%, which is real.
  */
  "Mashreq Vantage": { aedPerUnit: 0.00263, confidence: "medium", note: "issuer redemption table: 380 points = AED 1 cashback (2026-08-05); gift-card channels worth more but not universally usable" },
  // Standard Chartered publishes the cash-equivalent rate on its Purchase with
  // Rewards page: 100 Rewards Points = AED 1. That is the redemption every holder
  // can use, so it is the honest basis. // was an 0.0075 placeholder (33% too high).
  "360 Rewards Points": {
    aedPerUnit: 0.01,
    confidence: "medium",
    note: "issuer-stated 100 Rewards Points = AED 1 via Purchase with Rewards (sc.com/ae, 2026-08-08)",
  },
  "AirRewards": { aedPerUnit: 0.0075, confidence: "low", note: "NOT researched - new program (Air Arabia AirRewards). Placeholder." },
  // Emirates Islamic states the transfer rate outright: 1 Amazon Reward Point =
  // AED 1, spent on Amazon.ae at face value. // was an 0.0075 placeholder — 133x
  // too low, though the AED result was unaffected because every rate on the card
  // is percent-quoted (the unit cancels). It bites on point COUNTS and any cap.
  "Amazon Reward Points": {
    aedPerUnit: 1.0,
    confidence: "high",
    note: "issuer-stated 1 Amazon Reward Point = AED 1 (Emirates Islamic, 2026-08-08)",
  },
  // EI SmartMiles are quoted per-AED (unit counts matter), so the value bites
  // directly. Researched 2026-07 to 0.010 AED/mile (was a 0.0075 placeholder).
  "EI SmartMiles": { aedPerUnit: 0.01, confidence: "medium", note: "Emirates Islamic SmartMiles - researched 2026-07 (was 0.0075 placeholder)" },
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
    note: `No valuation for "${currency}" - treated as 0 AED/unit, needs an entry`,
  };
}
