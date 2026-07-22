/**
 * Reward-expiry policy — when a reward currency goes stale.
 *
 * Shared deliberately by BOTH engines, which is why it lives in its own module
 * rather than inside the burn engine:
 *   - Engine 2 (burn-priority) uses it to PROJECT an expiry date for a dated
 *     holding and rank what to burn first.
 *   - Engine 1 (score-card) uses it only to FLAG that a card's rewards expire.
 *     It never discounts the value — see the note on haircuts below.
 *
 * why Engine 1 flags instead of discounting: the right discount depends entirely
 * on how often the user redeems, which the scorer cannot see. Someone who cashes
 * out quarterly loses nothing to a 15-month window; someone who never redeems
 * loses everything. Baking a single haircut into the AED value would invent an
 * average user — the exact fabrication the valuation model exists to avoid. So
 * Engine 1 states the term as a fact, and Engine 2 models the timing where the
 * user's actual dates live.
 *
 * These are program POLICY, not per-user confirmed expiries. Every entry is
 * flagged as an estimate downstream, and is used to inform, never to manufacture
 * urgency.
 *
 * Pure data. No I/O.
 */

export interface ProgramExpiryDefault {
  /** Currency key (matches cards.json / valuations.ts). */
  currency: string;
  /** Validity window in months. */
  months: number;
  /** What the clock counts from. */
  basis: "from_earning" | "from_last_activity";
  note: string;
}

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
  // why this needs its OWN currency label rather than plain "AED": RAKBANK's
  // cashback expires, and generic cashback does not. Keying the policy by currency
  // means an "AED" entry would silently impose a 15-month expiry on every cashback
  // card in the dataset. The "AED (<program>)" convention already used for Nol and
  // Salaam-convertible credit scopes it to the issuer that actually has the rule.
  {
    currency: "AED (RAKBANK cashback)",
    months: 15,
    basis: "from_earning",
    note: "RAKBANK cashback validity window (15 months from earning) — program policy, not user-confirmed",
  },
];
