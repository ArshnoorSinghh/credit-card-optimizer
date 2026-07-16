/**
 * Points inventory — the user's holdings across reward programs.
 *
 * Manual entry: the user (or an importer) tells us what they have. The engine
 * never fetches balances; it only reasons over what it's given. Expiry is
 * optional because most UAE programs don't surface a per-batch expiry to the
 * cardholder, and we refuse to invent one (see burn-priority.ts for how missing
 * expiry is handled honestly rather than guessed).
 *
 * Pure data. No I/O.
 */

export interface PointsHolding {
  /**
   * Reward-currency label. MUST match the `rewards.currency` strings used in
   * cards.json / valuations.ts (e.g. "Skywards Miles", "TouchPoints (convertible
   * to miles)") so Engine 1 and Engine 2 value the same currency the same way.
   */
  currency: string;
  /** Units held (points or miles). */
  balance: number;
  /**
   * ISO date (YYYY-MM-DD) when this balance expires, if the user knows it.
   * Omitted when unknown — we do NOT fabricate a date. The burn engine falls back
   * to a flagged program-policy default only when it can project one.
   */
  expiryDate?: string;
  /**
   * ISO date (YYYY-MM-DD) the points were earned / last activity occurred.
   * Optional and additive to the spec's minimal shape: when present (and no
   * explicit expiryDate), the burn engine can PROJECT an expiry from a known
   * program-policy window (e.g. Etihad = 18 months from earning) and flag it as
   * an estimate. Without it, a currency with a known policy still can't be dated,
   * so urgency stays "unknown" rather than false.
   */
  earnedDate?: string;
}

export type PointsInventory = PointsHolding[];
