/**
 * Domain model for a single UAE credit card, matching the raw shape of
 * `packages/engine/data/cards.json` field-for-field.
 *
 * These types describe the data *as it exists on disk* — deliberately messy.
 * Rate strings are NOT parsed here; the normalizer is responsible for turning
 * `rate` / `base_rate` into numeric rates (and flagging uncertain ones) later.
 *
 * Field names are kept in the source's snake_case so the JSON assigns to these
 * types with no remapping — see `card.test.ts` for the compile-time proof.
 */

/**
 * How a card denominates its rewards. Only these three values appear across all
 * 51 cards. Modeled as a union (not a bare string) because it drives valuation:
 * cashback is worth face value in AED, while points/miles need scenario-dependent
 * valuation in the Points & Redemption engine.
 */
export type RewardType = "cashback" | "points" | "miles";

/**
 * What happens to rewards when monthly spend falls below
 * `Rewards.min_monthly_spend_required_aed`.
 *
 *  - "degrade" (default): bonus category rates switch off, base rate still earns.
 *    This is how most threshold cards work (fab_cashback, cbd_one, …), and it was
 *    the engine's only modelled behaviour.
 *  - "forfeit": ALL cashback earned in that statement cycle is lost — not reduced
 *    to base, zeroed. The DIB consumer cards state this explicitly.
 *
 * why a mode rather than a boolean: "forfeit" vs "degrade" reads at the call site,
 * and a boolean named something like `forfeits_below_threshold` inverts awkwardly.
 * Default is "degrade" so every existing card keeps its current behaviour.
 */
export type GateMode = "degrade" | "forfeit";

/**
 * A segment of spend that earns NOTHING on a particular card, regardless of the
 * card's advertised rates. Distinct from a 0% rate: the spend is not merely
 * unrewarded here, it must not be routed to this card at all when another card
 * could earn on it.
 *
 * why this exists: some issuers strip earning from a geography or channel rather
 * than a merchant category — DIB pays zero Wala'a Rewards on European Economic
 * Area transactions to offset interchange. That rule is invisible to a rate table.
 */
export interface ExcludedSpend {
  /**
   * The canonical spend category this exclusion zeroes out on this card. Typed
   * loosely as `string` here to keep card.ts free of engine imports; the scorer
   * validates it against its own SpendCategory union and flags an unknown value
   * rather than silently ignoring the exclusion.
   */
  category: string;
  /** Why the spend earns nothing — surfaced verbatim as a score flag. */
  reason: string;
}

export interface Eligibility {
  min_monthly_salary_aed: number;
  uae_resident_required: boolean;
  min_age: number;
  /** Whether the applicant must route their salary to the issuing bank to qualify. */
  salary_transfer_required: boolean;
  // Free-text eligibility caveat, or null when none. The 2026-07 data revealed this
  // field IS free text ("AED 5,000 salary or AED 3,000 minimum assigned credit
  // limit", "Maximum age 65 for UAE nationals"), so it's now typed `string` as the
  // prior note anticipated. No engine logic branches on it — it's a display caveat.
  employer_restrictions: string | null;
}

export interface Fees {
  annual_fee_aed: number;
  /** Free-text description of how the annual fee is waived; null when none is stated. */
  waiver_conditions: string | null;
  joining_fee_aed: number;
}

export interface RewardCategory {
  /** Snake_case category key, e.g. "dining_international" — raw, not yet normalized. */
  category: string;
  // why: kept as a raw string ("5%", "5 points per AED 1", "1.5 miles per USD 1")
  // because the source rates are inconsistent. The normalizer parses this into a
  // numeric rate + uncertainty flag downstream. Never treat this as pre-parsed.
  rate: string;
  /** Max reward (in `Rewards.currency`) earnable in this category per month; null = uncapped. */
  monthly_cap: number | null;
  /** Max reward earnable in this category per year; null = uncapped. */
  annual_cap: number | null;
}

export interface Rewards {
  type: RewardType;
  /** Unit rewards accrue in, e.g. "AED", "FAB Rewards", "Etihad Guest Miles". */
  currency: string;
  // why: free-text headline rate. Per CLAUDE.md, when this conflicts with a
  // structured `categories` entry, the category entry wins.
  base_rate: string;
  /** Category-specific reward rates. Always 1–3 entries in the current data. */
  categories: RewardCategory[];
  /** Cap across all categories combined; null = no overall cap. (null in all 51 today.) */
  overall_cap: number | null;
  /** Minimum monthly spend before any rewards accrue (0 = no minimum). */
  min_monthly_spend_required_aed: number;
  /**
   * What falling below `min_monthly_spend_required_aed` costs. Absent = "degrade",
   * which is the behaviour every card had before this field existed.
   */
  gate_mode?: GateMode;
}

export interface Redemption {
  /** Redemption-side currency label; may be worded differently from `Rewards.currency`. */
  currency: string;
  /** Human-readable redemption channels, e.g. "statement credit", "flights", "hotels". */
  primary_uses: string[];
  redemption_url: string;
}

export interface Card {
  id: string;
  name: string;
  bank: string;
  // why: kept as string, not a union, even though only a handful of values
  // appear. It's descriptive (compound values like "Diners Club + Mastercard"
  // occur), no engine logic branches on the exact value, and the set will grow
  // as cards are added — a union would just be churn.
  network: string;
  /** Marketing tier (Platinum, Signature, Infinite, …). Descriptive; kept as string for the same reason as `network`. */
  tier: string;
  eligibility: Eligibility;
  fees: Fees;
  rewards: Rewards;
  redemption: Redemption;
  benefits: string[];
  source_url: string;
  // why optional: JSON has no comments, so data-provenance / verification caveats
  // live in this free-text field. Absent on cards with nothing to note.
  notes?: string;
  // why: some cards have a data-entry defect we can't yet correct from a source
  // (e.g. "customizable" perks mislabeled as variable reward rates). Rather than
  // guess a reward structure or silently delete the card, we mark it excluded so
  // the scorer benches it visibly — pending verification. Absent/false = scored.
  excluded_from_scoring?: boolean;
  // why: a card that is STILL scored but carries a known data-quality caveat (e.g.
  // enbd_visa_flexi's earn rate implies an implausible return). The scorer surfaces
  // this as a loud flag on every score so the number is never trusted blindly.
  // Distinct from excluded_from_scoring: the card still ranks, just with a warning.
  data_caveat?: string;
  // why optional: only a handful of cards strip earning from a whole segment of
  // spend. Absent = the card earns on everything its rates cover.
  excluded_spend?: ExcludedSpend[];
}
