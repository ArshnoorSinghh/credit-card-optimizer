/**
 * Conversion model (Engine 2).
 *
 * Some bank points transfer into airline miles. That's distinct from redemption
 * valuation: it transforms one currency into another, and whether it's smart depends
 * entirely on the numbers on both sides.
 *
 * ── The general finding (item 3) ─────────────────────────────────────────────────
 * At the baseline economy mile value (~0.037 AED), DIRECT redemption BEATS every
 * published bank-point→mile conversion — verified for ADCB TouchPoints, Mashreq
 * Salaam, and DIB Wala'a (see CONVERSION_FINDING below and conversions.test.ts).
 * Conversion only wins when the miles are redeemed in a PREMIUM cabin whose per-mile
 * value clears the break-even. The recommender therefore never suggests converting
 * unless the user's target redemption value exceeds break-even.
 *
 * Break-even (derived in evaluateConversion): converting beats direct only if
 *     source_value < dest_value / ratio      ⟺     dest_value > source_value × ratio.
 * So the destination mile must be worth at least `source_value × ratio` per unit.
 *
 * These ratios CHANGE (TouchPoints→Skywards was 18:1 before Nov 2024, now 22:1), so
 * they live in one editable table — a devaluation is a one-line edit here.
 *
 * Pure data + pure functions. No I/O.
 */

import type { RedemptionConfidence } from "./redemption-valuations";

export interface Conversion {
  /** Source currency key (matches cards.json / valuations.ts). */
  from: string;
  /** Destination currency key. */
  to: string;
  /** Source units per 1 destination unit. 22 = 22 TouchPoints → 1 Skywards Mile. Higher = worse. */
  ratio: number;
  confidence: RedemptionConfidence;
  note?: string;
}

// why one table: these are the most volatile numbers in the engine. Edit only here.
export const CONVERSIONS: Conversion[] = [
  // ADCB TouchPoints
  { from: "TouchPoints (convertible to miles)", to: "Skywards Miles", ratio: 22, confidence: "high", note: "was 18:1 before Nov 2024" },
  { from: "TouchPoints (convertible to miles)", to: "Etihad Guest Miles", ratio: 14, confidence: "high" },
  // Mashreq (Vantage / Salaam)
  { from: "Salaam Points", to: "Skywards Miles", ratio: 32, confidence: "high" },
  { from: "Salaam Points", to: "Etihad Guest Miles", ratio: 22, confidence: "high" },
  // DIB Wala'a
  { from: "DIB Points", to: "Etihad Guest Miles", ratio: 20, confidence: "medium" },
  { from: "DIB Points", to: "Avios", ratio: 20, confidence: "medium", note: "Avios per-mile value unresearched" },
];

/**
 * The documented general finding, exposed so the recommender/UI can state it. At
 * baseline economy value, direct redemption beats conversion for every program with
 * a published ratio; conversion only pays off for premium-cabin targets.
 */
export const CONVERSION_FINDING =
  "At baseline economy mile value (~0.037 AED), direct redemption beats bank-point→mile conversion for every program with a published ratio (TouchPoints, Mashreq, DIB). Convert only when your target premium-cabin value per mile clears the break-even.";

/** Conversions available from a given source currency. */
export function conversionsFrom(
  currency: string,
  conversions: readonly Conversion[] = CONVERSIONS,
): Conversion[] {
  return conversions.filter((c) => c.from === currency);
}

export interface ConversionOutcome {
  conversion: Conversion;
  sourcePoints: number;
  /** AED if you redeemed the source points directly at `sourceAedPerUnit`. */
  directAed: number;
  /** Whole destination units received (floored — you can't transfer a fraction). */
  resultingUnits: number;
  /** AED from redeeming those converted units at `destAedPerUnit`. */
  convertedAed: number;
  /** convertedAed − directAed. Positive ⇒ converting wins, by this much. */
  deltaAed: number;
  /** True only when converting realizes strictly more AED than redeeming directly. */
  worthwhile: boolean;
  /** Destination per-unit value at which converting exactly breaks even (= source × ratio). */
  breakEvenDestAedPerUnit: number;
}

/**
 * Compute whether converting beats redeeming directly, and by how much.
 * Uses FLOORED resulting units (real transfers are whole units).
 *
 * @param sourceAedPerUnit  AED/unit if you redeem the source points directly (the
 *                          best DIRECT route — for cash-incapable currencies this is
 *                          the best partner/voucher route, not a cash rate).
 * @param destAedPerUnit    AED/unit of the redemption you'd do with the converted miles.
 */
export function evaluateConversion(
  sourcePoints: number,
  conversion: Conversion,
  sourceAedPerUnit: number,
  destAedPerUnit: number,
): ConversionOutcome {
  const resultingUnits = Math.floor(sourcePoints / conversion.ratio);
  const directAed = sourcePoints * sourceAedPerUnit;
  const convertedAed = resultingUnits * destAedPerUnit;
  return {
    conversion,
    sourcePoints,
    directAed,
    resultingUnits,
    convertedAed,
    deltaAed: convertedAed - directAed,
    worthwhile: convertedAed > directAed,
    breakEvenDestAedPerUnit: sourceAedPerUnit * conversion.ratio,
  };
}
