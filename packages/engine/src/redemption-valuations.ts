/**
 * Redemption valuation model (Engine 2) — rebuilt from verified UAE research.
 *
 * Engine 1 (valuations.ts) values a currency with ONE AED-per-unit number. Engine 2
 * needs per-route resolution: the same ADCB TouchPoint is worth 0.006 AED spent at a
 * Max partner but only 0.004 as a voucher; the same Skywards Mile is 0.037 in economy
 * and materially more (a user-supplied multiple) in a premium cabin.
 *
 * THE STRUCTURAL FACT this rebuild encodes: **cash-equivalent redemption (statement
 * credit / card-bill payment) is available for MOST UAE bank currencies but NOT for
 * ADCB TouchPoints or Etisalat Smiles.** It is neither universal nor universally
 * absent, so it is modeled per-currency via `cashCapable` — never assumed.
 *
 * Design:
 *  - A currency has a list of concrete `routes`, each with its exact program name
 *    (`type`), a semantic `class` (goals + phrasing branch on the class, not the
 *    name), an AED/unit value, and a confidence tag taken verbatim from research.
 *  - `cashCapable` states whether a card-bill / statement-credit route exists.
 *  - `primary` names the route whose value Engine 1's flat table represents.
 *  - Miles whose premium-cabin value is a user multiple over economy carry a
 *    `premiumCabin` marker instead of a fabricated fixed premium number.
 *
 * Honesty rules: every value is sourced + confidence-tagged; we list only routes a
 * program actually offers; unresearched currencies are FLAGGED (0.0075, low), never
 * invented. Every entry is user-overridable via withRedemptionValuations().
 *
 * Pure data + pure lookups. No I/O.
 *
 * ── Relationship to Engine 1 ────────────────────────────────────────────────────
 * deriveFlatValuationTable() builds an Engine-1-shaped table from each currency's
 * `primary` route; reconcileWithFlat() reports where that diverges from Engine 1's
 * current DEFAULT_VALUATIONS. This file does NOT edit valuations.ts — reconciliation
 * is a report for the human owner to act on.
 */

import type { ValuationConfidence, ValuationEntry, ValuationTable } from "./valuations";

// Reuse Engine 1's confidence scale verbatim — one vocabulary across both engines.
export type RedemptionConfidence = ValuationConfidence;

/**
 * Semantic class of a redemption route. Goals and recommender phrasing branch on
 * THIS, so adding a new program route only needs the right class, not new goal code.
 *
 *  - card_bill:      statement credit / card-bill cashback — reduces YOUR card
 *                    balance. This is the cash-equivalent route; its presence is
 *                    exactly what `cashCapable` tracks.
 *  - external_bill:  pay a utility / Salik / school / donation bill — NOT your card.
 *  - fixed_use:      Nol top-up / education / donation at a fixed (often 1:1) rate.
 *  - voucher:        gift cards, merchant vouchers, catalogue items.
 *  - partner_spend:  pay-with-points at a partner (in-store / e-commerce).
 *  - flight_economy: economy award seat.
 *  - flight_premium: premium-cabin award seat (value is a user multiple of economy).
 *  - hotel:          hotel night.
 *  - transfer:       transfer to an airline/hotel partner (usually via conversions.ts).
 */
export type RedemptionClass =
  | "card_bill"
  | "external_bill"
  | "fixed_use"
  | "voucher"
  | "partner_spend"
  | "flight_economy"
  | "flight_premium"
  | "hotel"
  | "transfer";

/** The set of classes that reduce the holder's card balance (cash-equivalent). */
export const CARD_BILL_CLASSES: readonly RedemptionClass[] = ["card_bill"];

export interface RedemptionValuationEntry {
  aedPerUnit: number;
  confidence: RedemptionConfidence;
  note?: string;
  source?: string;
}

export interface RedemptionRoute extends RedemptionValuationEntry {
  /** Exact program route name, e.g. "touchpoints_max_partner", "card_bill_cashback". */
  type: string;
  class: RedemptionClass;
}

/**
 * A currency whose premium-cabin value is a user-supplied multiple of its economy
 * value, rather than a researched fixed number. (Skywards, post-May-2026 premium
 * devaluation — economy Saver was NOT devalued, so only premium is uncertain.)
 */
export interface PremiumCabinModel {
  basedOn: "flight_economy";
  confidence: RedemptionConfidence;
  note: string;
}

export interface CurrencyRedemptionProfile {
  /**
   * Does a card-bill / statement-credit (cash-equivalent) route exist? NOT universal:
   * false for ADCB TouchPoints and Etisalat Smiles; true for most bank currencies.
   */
  cashCapable: boolean;
  /** The route `type` whose value Engine 1's flat table represents for this currency. */
  primary: string;
  /** Only the routes this program actually offers. */
  routes: RedemptionRoute[];
  /** For miles whose premium value is a user multiple over economy (see above). */
  premiumCabin?: PremiumCabinModel;
  /** Optional single blended reference (e.g. WalletHub) — a sanity check, not used to recommend. */
  blendedReference?: RedemptionValuationEntry;
  /** Program-level caveat (e.g. "cashback not permitted", devaluation, conflict-to-verify). */
  note?: string;
}

/** Keyed by the exact `rewards.currency` string in cards.json. */
export type RedemptionValuationTable = Record<string, CurrencyRedemptionProfile>;

// Small helper so route literals stay readable below.
function route(
  type: string,
  cls: RedemptionClass,
  aedPerUnit: number,
  confidence: RedemptionConfidence,
  note?: string,
  source?: string,
): RedemptionRoute {
  return { type, class: cls, aedPerUnit, confidence, note, source };
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed data. Currency keys match cards.json / valuations.ts so Engine 1 stays in
// sync. Program → key mapping: ADCB TouchPoints -> "TouchPoints (convertible to
// miles)", Etisalat Smiles -> "Smiles Points", ENBD Plus Points -> "Plus Points",
// DIB Wala'a -> "DIB Points", Mashreq Vantage/Salaam -> "Salaam Points", Citi
// ThankYou -> "ThankYou Points". (Amex UAE cards were removed from the dataset in
// 2026-07, so Membership Rewards / DDF are no longer modeled here.)
// ─────────────────────────────────────────────────────────────────────────────
export const REDEMPTION_VALUATIONS: RedemptionValuationTable = {
  // ── Airline miles ──────────────────────────────────────────────────────────
  // Skywards: economy is firm; premium is a USER MULTIPLE of economy, not a fixed
  // number, because the ~15% premium devaluation (effective 20 May 2026) makes any
  // single premium figure unreliable. Economy Saver was NOT devalued.
  "Skywards Miles": {
    cashCapable: false, // miles have no statement-credit route
    primary: "economy_flight",
    routes: [
      route("economy_flight", "flight_economy", 0.037, "high", "economy Saver NOT devalued in the May 2026 change"),
      route("mall_non_flight", "partner_spend", 0.011, "low", "known low-value trap (mall / Skywards+ non-flight spend)"),
    ],
    premiumCabin: {
      basedOn: "flight_economy",
      confidence: "low",
      note: "premium value = economy × your multiplier; ~15% premium devaluation effective 20 May 2026 — supply a multiplier from your actual target redemption rather than trusting a fixed number",
    },
    blendedReference: { aedPerUnit: 0.028, confidence: "medium", source: "WalletHub", note: "conservative blended reference across redemptions" },
    note: "convertible from ADCB TouchPoints (22:1) and Mashreq Salaam (32:1) — see conversions.ts",
  },

  // Etihad: economy firm; business is a researched fixed number (unlike Skywards).
  "Etihad Guest Miles": {
    cashCapable: false,
    primary: "economy_flight",
    routes: [
      route("economy_flight", "flight_economy", 0.037, "high"),
      route("business_flight", "flight_premium", 0.048, "medium", "first-cabin can exceed this"),
      route("shop_voucher", "voucher", 0.018, "low", "shop / voucher redemption"),
    ],
    note: "expiry 18 months, extendable ONLY by flight activity (not purchases/transfers) since June 2024; convertible from TouchPoints (14:1), Mashreq (22:1), DIB (20:1)",
  },

  // ── Cash-INCAPABLE bank currencies (the structural exceptions) ───────────────
  // ADCB TouchPoints — NO card-bill / statement-credit route. Merchant-tier variance
  // is modeled explicitly: 0.006 at a Max partner vs 0.004 as a voucher.
  "TouchPoints (convertible to miles)": {
    cashCapable: false,
    primary: "instore_instant", // per research: Engine-1 primary = 0.005
    routes: [
      route("touchpoints_max_partner", "partner_spend", 0.006, "high", "ADCB TouchPoints Max partners"),
      route("ecommerce_partner", "partner_spend", 0.006, "high"),
      route("instore_instant", "partner_spend", 0.005, "high"),
      route("voucher", "voucher", 0.004, "high"),
      route("bill_payment", "external_bill", 0.004348, "high", "utility / donation / Zakat / school / Salik"),
    ],
    note: "NO card-bill / statement-credit redemption; converts to Skywards 22:1 or Etihad 14:1 (conversions.ts) — rarely beats direct partner spend at baseline mile value",
  },

  // Etisalat Smiles — NO card-bill route. Every route is the official 100 pts = AED 1.
  "Smiles Points": {
    cashCapable: false,
    primary: "voucher",
    routes: [
      route("voucher", "voucher", 0.01, "high", "official 100 pts = AED 1"),
      route("bill_pay", "external_bill", 0.01, "high"),
      route("merchant", "partner_spend", 0.01, "high"),
      route("travel", "voucher", 0.01, "high"),
    ],
    note: "cashback not permitted — no card-bill / statement-credit route exists",
  },

  // ── Cash-CAPABLE bank currencies ─────────────────────────────────────────────
  // ENBD Plus Points — cash-capable but at a haircut. The card-bill route (0.75) is
  // the realistic default, NOT the 1.0 fixed-use which assumes specific obligations.
  // IMPORTANT: Engine 1 (valuations.ts) deliberately HOLDS Plus Points at 0.01, not
  // 0.75, pending verification — adopting 0.75 makes enbd_visa_flexi (1 Plus
  // Point/AED) imply an implausible >75% return. So this research value is not yet
  // reflected in card scoring. See enbd_visa_flexi's data_caveat + the scoreCard guardrail.
  "Plus Points": {
    cashCapable: true,
    primary: "card_bill_cashback",
    routes: [
      route("fixed_use", "fixed_use", 1.0, "high", "Nol / education / donation / in-store — assumes you have these specific uses"),
      route("card_bill_cashback", "card_bill", 0.75, "high", "min 500 PP + AED 375 outstanding balance; NOT adopted into Engine 1 — earn rate needs verification"),
      route("rewards_hub", "voucher", 0.75, "high"),
    ],
    note: "transfer_to_miles available but ratio unresearched — not quantified here",
  },

  // FAB Rewards — cash-capable. Note the sourced conflict on the card-bill rate.
  "FAB Rewards": {
    cashCapable: true,
    primary: "cashback",
    routes: [
      route("cashback", "card_bill", 0.007, "high", "FAB FAQ PDF states 0.004 — CONFLICT, verify"),
      route("voucher", "voucher", 0.007, "medium"),
    ],
    note: "transfer_to_miles available",
  },

  // ADIB Exceed — cash-capable, everything anchored to the official 1 pt = AED 2.00.
  // NOTE: no card in the current cards.json uses this currency (future-proofing).
  "ADIB Exceed Points": {
    cashCapable: true,
    primary: "cashback",
    routes: [
      route("cashback", "card_bill", 2.0, "high", "official migration rate 1 pt = AED 2.00"),
      route("utility", "external_bill", 2.0, "high"),
      route("voucher", "voucher", 2.0, "high"),
      route("hotel", "hotel", 2.0, "high"),
      route("flight", "flight_economy", 2.0, "high"),
    ],
    note: "not present in cards.json — no current card earns this currency",
  },

  // DIB Wala'a — cash-capable. All base routes at 0.005.
  "DIB Points": {
    cashCapable: true,
    primary: "cashback",
    routes: [
      route("cashback", "card_bill", 0.005, "medium"),
      route("pay_with_rewards", "partner_spend", 0.005, "medium"),
      route("bill_payment", "external_bill", 0.005, "medium"),
      route("base", "voucher", 0.005, "medium"),
    ],
    note: "transfer to Etihad 20:1 or Avios 20:1 — see conversions.ts",
  },

  // Mashreq (Vantage / Salaam). Gift-card routes edge out plain card-bill cashback.
  "Salaam Points": {
    cashCapable: true,
    primary: "cashback",
    routes: [
      route("cashback", "card_bill", 0.00263, "high"),
      route("noon_giftcard", "voucher", 0.00347, "high"),
      route("amazon_giftcard", "voucher", 0.0033, "high"),
      route("travel", "voucher", 0.00329, "high"),
    ],
    note: "Mashreq Vantage/Salaam; transfer to Skywards 32:1 or Etihad 22:1 — see conversions.ts. NOT present in cards.json since the 2026-07 Amex-network cleanup removed mashreq_solitaire_amex; research kept here for if a Salaam card returns",
  },

  // Citi ThankYou (UAE) — cash-capable. Both routes offset card spend.
  "ThankYou Points": {
    cashCapable: true,
    primary: "pay_with_points", // per research: primary = 0.03
    routes: [
      route("cash_for_points", "card_bill", 0.0333, "high", "travel-spend rebate"),
      route("pay_with_points", "card_bill", 0.03, "medium"),
    ],
    note: "transfer_to_miles available",
  },

  // Standard Chartered 360° — cash-capable. NOTE: SC cards in cards.json earn AED
  // cashback directly, so no card currently uses a 360° points currency.
  "360 Rewards Points": {
    cashCapable: true,
    primary: "cashback",
    routes: [
      route("cashback", "card_bill", 0.02, "high"),
      route("purchase_with_rewards", "partner_spend", 0.02, "medium"),
      route("voucher", "voucher", 0.02, "low", "value varies by catalogue item"),
    ],
    note: "not present in cards.json — SC cards earn AED cashback directly",
  },

  // ── Low-confidence: no official UAE per-point figure — SEEDED & FLAGGED ───────
  // (Amex UAE Membership Rewards was removed with the Amex cards in 2026-07.)
  // HSBC supports cash-equivalent per program docs (rate unconfirmed).
  "HSBC Reward Points": {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 0.0075, "low", "no official UAE per-point figure published — verify in-app")],
  },
  "RAKrewards Points": {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 0.0075, "low", "no official UAE per-point figure published — verify in-app")],
  },
  "CBD Reward Points": {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 0.0075, "low", "no official UAE per-point figure published — verify in-app")],
  },
  // Emirates Islamic SmartMiles — a miles product; not present in cards.json.
  "SmartMiles": {
    cashCapable: false,
    primary: "flight_economy",
    routes: [route("flight", "flight_economy", 0.0075, "low", "no official UAE per-point figure published — verify in-app")],
    note: "not present in cards.json",
  },

  // ── Cashback / fixed-AED currencies (kept at Engine-1 face value for holdings) ─
  AED: {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 1.0, "high", "cashback — face value by definition")],
  },
  "AED (Salaam Points convertible)": {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 1.0, "medium", "functionally cashback (statement credit at face value)")],
  },
  // Face value like any cashback; the 15-month expiry is modelled by the burn
  // engine (expiry-policy.ts), not by discounting the rate here.
  "AED (RAKBANK cashback)": {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 1.0, "high", "cashback — face value; expires 15 months after earning")],
  },
  "AED (Nol points)": {
    cashCapable: false, // Nol fare credit, not a card-bill route
    primary: "nol_topup",
    routes: [route("nol_topup", "fixed_use", 1.0, "medium", "transit fare credit redeems at face value")],
  },
  "AED (Booking.com credit)": {
    cashCapable: false,
    primary: "booking_credit",
    routes: [route("booking_credit", "voucher", 0.85, "low", "restricted travel credit; card data conflicts with issuer's current structure — re-verify")],
  },

  // ── Store / niche points — no researched UAE figure; conservative flagged 0.0075 ─
  "Marriott Bonvoy Points": {
    cashCapable: false,
    primary: "hotel",
    routes: [
      route("hotel", "hotel", 0.028, "medium"),
      route("airline_transfer", "transfer", 0.015, "low", "airline transfer dilutes value"),
    ],
  },
  "LuLu Points": {
    cashCapable: false,
    primary: "voucher",
    routes: [route("voucher", "voucher", 0.0075, "low", "no official UAE per-point figure — verify")],
  },
  "U By Emaar Points": {
    cashCapable: false,
    primary: "voucher",
    routes: [route("voucher", "voucher", 0.0075, "low", "no official UAE per-point figure — verify")],
  },
  "dnata Points": {
    cashCapable: false,
    primary: "voucher",
    routes: [route("voucher", "voucher", 0.0075, "low", "no official UAE per-point figure — verify")],
  },
  // (DDF Reward Points was removed with the Amex DDF card in 2026-07.)
  "Diners Club Reward Points": {
    cashCapable: true,
    primary: "statement_credit",
    routes: [route("statement_credit", "card_bill", 0.0075, "low", "no official UAE per-point figure — verify")],
  },
  "Multiple programs (customizable)": {
    cashCapable: false,
    primary: "voucher",
    routes: [route("voucher", "voucher", 0.0075, "low", "user-customizable currency — genuinely unknown; needs valuation")],
    note: "card is excluded from scoring pending verification",
  },
};

/**
 * Placeholder profile for a currency not in the table. Cash-capability is UNKNOWN,
 * so we conservatively model a single flagged voucher route and mark it loudly —
 * never a silent zero, never a fabricated cash route.
 */
export function defaultRedemptionProfile(currency: string): CurrencyRedemptionProfile {
  return {
    cashCapable: false,
    primary: "unknown",
    routes: [route("unknown", "voucher", 0.0075, "low", "estimated — research pending")],
    note: `unknown currency "${currency}" — redemption routes not researched; modeled as a flagged placeholder`,
  };
}

/** Look up a currency's profile; unknown currencies return a loudly-flagged default. */
export function resolveRedemptionProfile(
  currency: string,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): CurrencyRedemptionProfile {
  return table[currency] ?? defaultRedemptionProfile(currency);
}

// ── Overrides ─────────────────────────────────────────────────────────────────
export interface RedemptionProfileOverride {
  cashCapable?: boolean;
  primary?: string;
  /** Routes to add or replace, matched by `type`. */
  routes?: RedemptionRoute[];
  premiumCabin?: PremiumCabinModel;
  blendedReference?: RedemptionValuationEntry;
  note?: string;
}
export type RedemptionOverrides = Record<string, RedemptionProfileOverride>;

/**
 * Merge per-currency overrides onto a base table. Routes merge by `type` (an override
 * route replaces the base route of the same name; new names are appended), so a caller
 * can retune one route without restating the currency. Every value is overridable.
 */
export function withRedemptionValuations(
  overrides: RedemptionOverrides,
  base: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionValuationTable {
  const out: RedemptionValuationTable = {};
  const currencies = new Set([...Object.keys(base), ...Object.keys(overrides)]);
  for (const cur of currencies) {
    const b = base[cur];
    const o = overrides[cur];
    if (!b) {
      out[cur] = {
        cashCapable: o?.cashCapable ?? false,
        primary: o?.primary ?? (o?.routes?.[0]?.type ?? "unknown"),
        routes: o?.routes ?? [],
        premiumCabin: o?.premiumCabin,
        blendedReference: o?.blendedReference,
        note: o?.note,
      };
      continue;
    }
    if (!o) {
      out[cur] = b;
      continue;
    }
    const mergedRoutes = [...b.routes];
    for (const r of o.routes ?? []) {
      const i = mergedRoutes.findIndex((x) => x.type === r.type);
      if (i >= 0) mergedRoutes[i] = r;
      else mergedRoutes.push(r);
    }
    out[cur] = {
      cashCapable: o.cashCapable ?? b.cashCapable,
      primary: o.primary ?? b.primary,
      routes: mergedRoutes,
      premiumCabin: o.premiumCabin ?? b.premiumCabin,
      blendedReference: o.blendedReference ?? b.blendedReference,
      note: o.note ?? b.note,
    };
  }
  return out;
}

// ── Lookups used by the recommender & burn engine ────────────────────────────────

/** The primary route (the value Engine 1's flat table means for this currency). */
export function primaryRoute(
  currency: string,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionRoute {
  const profile = resolveRedemptionProfile(currency, table);
  const found = profile.routes.find((r) => r.type === profile.primary);
  if (found) return found;
  // A well-formed profile always has its primary present; fall back defensively.
  return profile.routes[0] ?? route("unknown", "voucher", 0, "low", "profile has no routes — treated as 0 AED/unit");
}

/** Routes whose class is in `allowed`. */
export function routesForClasses(
  currency: string,
  allowed: readonly RedemptionClass[],
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionRoute[] {
  const set = new Set(allowed);
  return resolveRedemptionProfile(currency, table).routes.filter((r) => set.has(r.class));
}

/** Best (highest-AED) route among a set of allowed classes, or null if none. */
export function bestRouteAmongClasses(
  currency: string,
  allowed: readonly RedemptionClass[],
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionRoute | null {
  let best: RedemptionRoute | null = null;
  for (const r of routesForClasses(currency, allowed, table)) {
    if (!best || r.aedPerUnit > best.aedPerUnit) best = r;
  }
  return best;
}

/** Highest-value route across ALL classes (best-case rate — used for value-at-risk). */
export function bestRoute(
  currency: string,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionRoute {
  const routes = resolveRedemptionProfile(currency, table).routes;
  let best = routes[0];
  for (const r of routes) if (r.aedPerUnit > (best?.aedPerUnit ?? -Infinity)) best = r;
  return best ?? route("unknown", "voucher", 0, "low", "no routes");
}

/** Distinct redemption classes a currency supports (versatility = flexibility). */
export function supportedClasses(
  currency: string,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionClass[] {
  return [...new Set(resolveRedemptionProfile(currency, table).routes.map((r) => r.class))];
}

/** True when the currency offers a card-bill / statement-credit route. */
export function isCashCapable(currency: string, table: RedemptionValuationTable = REDEMPTION_VALUATIONS): boolean {
  return resolveRedemptionProfile(currency, table).cashCapable;
}

/**
 * Materialize a premium-cabin route for a currency that models premium as a user
 * multiple over economy (Skywards). Returns undefined if the currency has no
 * premiumCabin marker, no economy route, or the caller supplied no multiplier.
 */
export function premiumFlightRoute(
  currency: string,
  multiplier: number | undefined,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): RedemptionRoute | undefined {
  if (multiplier === undefined) return undefined;
  const profile = resolveRedemptionProfile(currency, table);
  if (!profile.premiumCabin) return undefined;
  const economy = profile.routes.find((r) => r.class === "flight_economy");
  if (!economy) return undefined;
  return route(
    "premium_flight",
    "flight_premium",
    economy.aedPerUnit * multiplier,
    "low", // a user-supplied multiplier is inherently low-confidence
    `economy ${economy.aedPerUnit} × your ${multiplier} multiplier — ${profile.premiumCabin.note}`,
  );
}

// ── Confidence combination (weakest link) ───────────────────────────────────────
const CONFIDENCE_RANK: Record<RedemptionConfidence, number> = { high: 3, medium: 2, low: 1 };
export function worstConfidence(...cs: RedemptionConfidence[]): RedemptionConfidence {
  return cs.reduce((worst, c) => (CONFIDENCE_RANK[c] < CONFIDENCE_RANK[worst] ? c : worst), "high");
}

// ── Engine 1 reconciliation ─────────────────────────────────────────────────────

/** Derive an Engine-1-shaped flat table from each currency's primary route. */
export function deriveFlatValuationTable(
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
): ValuationTable {
  const out: ValuationTable = {};
  for (const currency of Object.keys(table)) {
    const r = primaryRoute(currency, table);
    out[currency] = {
      aedPerUnit: r.aedPerUnit,
      confidence: r.confidence,
      note: `primary route: ${r.type} (${r.class})${r.note ? ` — ${r.note}` : ""}`,
    };
  }
  return out;
}

export interface FlatReconciliation {
  currency: string;
  derived: number;
  flat: number;
  primaryType: string;
  agrees: boolean;
}

/** Compare each currency's derived-primary value against Engine 1's flat table. */
export function reconcileWithFlat(
  flat: ValuationTable,
  table: RedemptionValuationTable = REDEMPTION_VALUATIONS,
  tolerance = 0.1,
): FlatReconciliation[] {
  const out: FlatReconciliation[] = [];
  for (const currency of Object.keys(table)) {
    const flatEntry: ValuationEntry | undefined = flat[currency];
    if (!flatEntry) continue;
    const r = primaryRoute(currency, table);
    const denom = Math.max(Math.abs(flatEntry.aedPerUnit), 1e-9);
    out.push({
      currency,
      derived: r.aedPerUnit,
      flat: flatEntry.aedPerUnit,
      primaryType: r.type,
      agrees: Math.abs(r.aedPerUnit - flatEntry.aedPerUnit) / denom <= tolerance,
    });
  }
  return out;
}
