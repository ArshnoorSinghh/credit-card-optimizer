/**
 * scoreCard — the "show the math" receipt for one card against one spending
 * profile. Pure and deterministic: no I/O.
 *
 * Pipeline (all commented inline below):
 *   1. Match the user's spend categories to the card's reward categories.
 *   2. Apply the normalized rate per category, respecting its UNIT.
 *   3. Enforce monthly caps, then annual caps (in reward-currency units).
 *   4. Unmatched spend earns the base rate.
 *   5. Convert reward-currency earnings to AED via the valuation table.
 *   6. Annualize, subtract the annual fee (year-1 vs ongoing), and report a full
 *      breakdown plus any inherited low-confidence flags.
 *
 * Unresolved (tier-3) rates are scored as a RANGE (min/max net value), never a
 * single fabricated number.
 */

import type { Card, RewardCategory } from "./card";
import { normalizeRate, type NormalizedRate } from "./normalize-rate";
import {
  DEFAULT_VALUATIONS,
  resolveValuation,
  type ValuationEntry,
  type ValuationTable,
} from "./valuations";

/** AED per USD. Fixed peg used to convert "per USD" reward rates to AED spend. */
export const AED_PER_USD = 3.6725;

/**
 * Canonical spending categories the user reports (AED/month each). Deliberately
 * broad — the card data uses ~30 messy category names that we fold into these.
 * `international` is treated as its own category (foreign-currency / overseas
 * spend), orthogonal to merchant type, because that's how the card data models it.
 */
export type SpendCategory =
  | "groceries"
  | "dining"
  | "fuel"
  | "utilities"
  | "education"
  | "travel"
  | "transport"
  | "entertainment"
  | "international"
  | "other";

/** AED/month per category. Missing categories are treated as 0. */
export type SpendingProfile = Partial<Record<SpendCategory, number>>;

/**
 * The canonical spend categories as a RUNTIME list, for validating input at a
 * boundary (the union type erases at compile time and can't be iterated). The
 * `satisfies` clause rejects any entry that isn't a SpendCategory, and the
 * exhaustiveness check below fails the build if a category is missing — so this
 * list and the union can never silently drift apart.
 */
export const SPEND_CATEGORIES = [
  "groceries",
  "dining",
  "fuel",
  "utilities",
  "education",
  "travel",
  "transport",
  "entertainment",
  "international",
  "other",
] as const satisfies readonly SpendCategory[];

// Compile-time guard: every SpendCategory must appear in SPEND_CATEGORIES.
type _MissingCategory = Exclude<SpendCategory, (typeof SPEND_CATEGORIES)[number]>;
const _allCategoriesCovered: _MissingCategory extends never ? true : never = true;
void _allCategoriesCovered;

/**
 * How a card reward-category name maps to canonical spend categories.
 *  - `categories`: matches those specific spend categories. `merchant` marks an
 *    optimistic assumption (the bonus only applies at a specific merchant we
 *    can't see in a generic profile) — it lowers confidence rather than being
 *    dropped, so the card isn't unfairly zeroed.
 *  - `catchall`: eligible for ANY spend as a fallback (all_spend / all_other_spend).
 *  - `unmatched`: cannot be scored from a generic profile; earns nothing, flagged.
 */
type MatchRule =
  | { kind: "categories"; categories: SpendCategory[]; merchant?: string }
  | { kind: "catchall" }
  | { kind: "unmatched"; reason: string };

// why an explicit table (not fuzzy string parsing): the 30 category names are a
// small, closed set in the data. Enumerating them means every match is a
// reviewable decision, and a NEW/unknown category is caught (routed to
// "unmatched" + flagged) instead of being silently mis-parsed.
const MATCH_TABLE: Record<string, MatchRule> = {
  // Generic categories.
  international_spend: { kind: "categories", categories: ["international"] },
  dining: { kind: "categories", categories: ["dining"] },
  groceries: { kind: "categories", categories: ["groceries"] },
  supermarket: { kind: "categories", categories: ["groceries"] },
  groceries_supermarket: { kind: "categories", categories: ["groceries"] },
  groceries_other: { kind: "categories", categories: ["groceries"] },
  fuel: { kind: "categories", categories: ["fuel"] },
  travel_spend: { kind: "categories", categories: ["travel"] },
  // Compound categories match every component.
  groceries_dining: { kind: "categories", categories: ["groceries", "dining"] },
  groceries_education_utilities: { kind: "categories", categories: ["groceries", "education", "utilities"] },
  dining_international: { kind: "categories", categories: ["dining", "international"] },
  fuel_utilities: { kind: "categories", categories: ["fuel", "utilities"] },
  dining_entertainment: { kind: "categories", categories: ["dining", "entertainment"] },
  dining_entertainment_groceries: { kind: "categories", categories: ["dining", "entertainment", "groceries"] },
  groceries_dining_fuel: { kind: "categories", categories: ["groceries", "dining", "fuel"] },
  dining_travel: { kind: "categories", categories: ["dining", "travel"] },
  // Catch-all / base categories.
  all_spend: { kind: "catchall" },
  all_other_spend: { kind: "catchall" },
  // Merchant-locked bonuses: matched to their nearest canonical category, but
  // flagged because a generic profile can't confirm the spend is at that merchant.
  emirates_purchases: { kind: "categories", categories: ["travel"], merchant: "Emirates" },
  etihad_purchases: { kind: "categories", categories: ["travel"], merchant: "Etihad" },
  dnata_travel: { kind: "categories", categories: ["travel"], merchant: "dnata" },
  marriott_hotels: { kind: "categories", categories: ["travel"], merchant: "Marriott" },
  booking_com: { kind: "categories", categories: ["travel"], merchant: "Booking.com" },
  lulu_supermarket: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  lulu_purchases: { kind: "categories", categories: ["groceries"], merchant: "LuLu" },
  emaar_properties: { kind: "categories", categories: ["other"], merchant: "Emaar" },
  dubai_duty_free: { kind: "categories", categories: ["other"], merchant: "Dubai Duty Free" },
  rta_transport: { kind: "categories", categories: ["transport"], merchant: "RTA" },
  smiles_partners: { kind: "categories", categories: ["other"], merchant: "Smiles partners" },
  // (No card currently uses a "user-chosen category". enbd_visa_flexi, which once
  // appeared to, was a data-entry error — it's a flat-rate points card; its "flexi"
  // is customizable *perks*, not reward rates. If such a category reappears it will
  // route to "unmatched" and be flagged, rather than being silently modeled.)
};

/** A pair of AED values bounding an uncertain quantity (min===max when certain). */
export interface AedRange {
  min: number;
  max: number;
}

export interface CategoryEarning {
  /** The card reward category that earned this spend ("base_rate" for the base fallback). */
  cardCategory: string;
  /** Canonical spend categories routed here. */
  spendCategories: SpendCategory[];
  monthlySpendAed: number;
  /** The normalized rate applied (carries its own confidence). */
  rate: NormalizedRate;
  /** Reward-currency units earned per YEAR, before AED conversion (e.g. 120000 miles). */
  annualUnits: { min: number; max: number | null };
  /** AED value of those units after valuation. */
  annualValueAed: AedRange;
  /** Set when a cap limited earnings. */
  capBound?: "monthly" | "annual";
  /** Set when this used an optimistic merchant assumption. */
  merchantAssumption?: string;
}

export interface FeeBreakdown {
  annualFeeAed: number;
  /** Fee actually charged in year 1 (0 if first-year-free / free-for-life). */
  year1FeeAed: number;
  /** Fee charged in steady state (year 2+). */
  ongoingFeeAed: number;
  /** Description of the waiver applied, if any. */
  waiverApplied?: string;
}

export interface ScoreFlag {
  level: "low" | "unknown";
  message: string;
}

export interface CardScore {
  cardId: string;
  rewardCurrency: string;
  /** The valuation entry used for this card's currency. */
  valuation: ValuationEntry;
  /** Ranking number: ongoing (year 2+) net annual AED value; midpoint if uncertain. */
  netAnnualValue: number;
  /** Ongoing net annual value as a range (min===max when fully resolved). */
  netAnnualValueRange: AedRange;
  /** Net annual value in year 1 (applies any first-year fee waiver); midpoint if uncertain. */
  netAnnualValueYear1: number;
  /** Gross annual AED value before fees. */
  grossAnnualValue: AedRange;
  fees: FeeBreakdown;
  /** Per-category "receipt". */
  breakdown: CategoryEarning[];
  /** Inherited low/unknown-confidence flags from rates, valuation, merchants, caps. */
  flags: ScoreFlag[];
  /** True if anything (range rate, low/unknown confidence) makes this estimate soft. */
  uncertain: boolean;
  /**
   * True when the card is excluded from scoring pending data verification (see
   * Card.excluded_from_scoring). Benched cards return a zeroed score with an
   * explanatory flag — they are visible but must not be ranked.
   */
  benched: boolean;
}

// ---------------------------------------------------------------------------
// Unit-aware earning helpers. A rate's NUMBER means nothing without its UNIT, so
// every conversion routes through here. Returns reward-currency UNITS per month.
// ---------------------------------------------------------------------------

/** Reward-currency units earned in a month for `spendAed` at a resolved rate. */
export function monthlyUnits(
  value: number,
  unit: NormalizedRate["unit"],
  spendAed: number,
  aedPerUnit: number,
): number {
  switch (unit) {
    case "percent":
      // A percent is a fraction of AED spend returned AS VALUE. Convert that AED
      // value back into units so caps (which are in units) apply uniformly.
      // For cashback (aedPerUnit=1) this is just spend*value.
      return aedPerUnit > 0 ? (spendAed * value) / aedPerUnit : 0;
    case "points_per_aed":
      return value * spendAed;
    case "miles_per_usd":
      // Convert AED spend to USD first — "per USD" and "per AED" are different units.
      return value * (spendAed / AED_PER_USD);
    case "miles_per_aed":
      return value * spendAed;
    case null:
      return 0; // no unit → cannot compute; caller handles via range/flags
  }
}

/** AED earned per 1 AED spent at a resolved rate — used to pick the best category. */
export function yieldPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  if (rate.value === null || rate.unit === null) return 0; // unresolved → deprioritize
  return monthlyUnits(rate.value, rate.unit, 1, aedPerUnit) * aedPerUnit;
}

// ---------------------------------------------------------------------------
// Fee waivers.
// ---------------------------------------------------------------------------

/** Detect first-year-free / free-for-life from the free-text waiver string. */
export function computeFees(card: Card): FeeBreakdown {
  const fee = card.fees.annual_fee_aed;
  const waiver = card.fees.waiver_conditions ?? "";
  const freeForLife = /free for life|lifetime free|no annual fee/i.test(waiver) || fee === 0;
  const firstYearFree = /first year free|first year waived|1st year free|free for the first year/i.test(waiver);

  if (freeForLife) {
    return { annualFeeAed: fee, year1FeeAed: 0, ongoingFeeAed: 0, waiverApplied: "Free for life" };
  }
  if (firstYearFree) {
    return { annualFeeAed: fee, year1FeeAed: 0, ongoingFeeAed: fee, waiverApplied: "First year free" };
  }
  return { annualFeeAed: fee, year1FeeAed: fee, ongoingFeeAed: fee };
}

// ---------------------------------------------------------------------------
// Category matching.
// ---------------------------------------------------------------------------

export interface EarnOption {
  cardCategory: string;
  rate: NormalizedRate;
  monthlyCap: number | null;
  annualCap: number | null;
  rule: MatchRule;
}

/** Build the list of ways this card can earn, incl. a virtual base-rate fallback. */
export function buildEarnOptions(card: Card): { options: EarnOption[]; flags: ScoreFlag[] } {
  const flags: ScoreFlag[] = [];
  const options: EarnOption[] = card.rewards.categories.map((cat: RewardCategory) => {
    const rule = MATCH_TABLE[cat.category] ?? {
      kind: "unmatched" as const,
      reason: `Unknown category "${cat.category}" — not scored`,
    };
    if (!MATCH_TABLE[cat.category]) {
      flags.push({ level: "unknown", message: `Unrecognized reward category "${cat.category}"` });
    }
    return {
      cardCategory: cat.category,
      rate: normalizeRate(cat.rate, { monthlyCap: cat.monthly_cap, annualCap: cat.annual_cap }),
      monthlyCap: cat.monthly_cap,
      annualCap: cat.annual_cap,
      rule,
    };
  });

  // why only add a virtual base if there's no catch-all category: cards with
  // all_other_spend already express the base (with its cap); adding an uncapped
  // virtual base would let spend dodge that cap. Cards without a catch-all need
  // the base_rate as the fallback for spend that matches no bonus category.
  const hasCatchall = options.some((o) => o.rule.kind === "catchall");
  if (!hasCatchall) {
    options.push({
      cardCategory: "base_rate",
      rate: normalizeRate(card.rewards.base_rate),
      monthlyCap: null,
      annualCap: null,
      rule: { kind: "catchall" },
    });
  }
  return { options, flags };
}

/** Candidate earn-options for a given spend category. */
export function candidatesFor(cat: SpendCategory, options: EarnOption[]): EarnOption[] {
  return options.filter((o) => {
    if (o.rule.kind === "categories") return o.rule.categories.includes(cat);
    if (o.rule.kind === "catchall") return true;
    return false; // unmatched never claims spend
  });
}

// ---------------------------------------------------------------------------
// Earning + caps for ONE option — the single source of truth for the cap math.
// Both scoreCard and the portfolio optimizer route through here so caps behave
// identically everywhere. Given a monthly AED spend already routed to an option,
// it returns the annual reward (as a min/max range, since a tier-3 rate has no
// single value) plus which cap (if any) bound.
// ---------------------------------------------------------------------------

export interface OptionEarning {
  /** Reward-currency units earned per YEAR (max null when the rate is unbounded). */
  annualUnits: { min: number; max: number | null };
  /** AED value of those units after valuation. */
  annualValueAed: AedRange;
  /** Set when a cap limited earnings at this spend level. */
  capBound?: "monthly" | "annual";
  /** True when the rate has no stated ceiling, so the upside can't be bounded. */
  unbounded: boolean;
}

export function earnOnOption(
  option: EarnOption,
  monthlySpendAed: number,
  aedPerUnit: number,
): OptionEarning {
  const rate = option.rate;
  // Resolve the rate into a min/max value pair in the rate's unit.
  // - resolved rate: min===max===value.
  // - range rate ("Up to X%"): min=range.min, max=range.max (may be null = unbounded).
  const lo = rate.value ?? rate.range?.min ?? 0;
  const hi = rate.value ?? rate.range?.max ?? null; // null => unbounded upper

  const earn = (v: number): { units: number; aed: number; cap?: "monthly" | "annual" } => {
    const rawMonthly = monthlyUnits(v, rate.unit, monthlySpendAed, aedPerUnit);
    let cap: "monthly" | "annual" | undefined;
    let capped = rawMonthly;
    if (option.monthlyCap !== null && capped > option.monthlyCap) {
      capped = option.monthlyCap; // why: caps are in reward-currency units; monthly first
      cap = "monthly";
    }
    let annual = capped * 12;
    if (option.annualCap !== null && annual > option.annualCap) {
      annual = option.annualCap;
      cap = "annual";
    }
    return { units: annual, aed: annual * aedPerUnit, cap };
  };

  const low = earn(lo);
  // For an unbounded upper rate we cannot invent a ceiling — max mirrors min and we flag it.
  const high = hi === null ? low : earn(hi);
  const unbounded = hi === null && rate.value === null;

  return {
    annualUnits: { min: low.units, max: unbounded ? null : high.units },
    annualValueAed: { min: low.aed, max: high.aed },
    capBound: low.cap ?? high.cap,
    unbounded,
  };
}

// ===========================================================================
// Shared scoring core: assign spend across ONE OR MORE cards, exactly.
//
// This is the single source of truth both scoreCard and optimizePortfolio use.
// scoreCard(card) is just earnAcrossCards([card]); the portfolio optimizer runs
// earnAcrossCards on each candidate subset. Because it's literally the same
// function, a single card scored on its own and the best-1-card portfolio return
// identical numbers by construction.
//
// The assignment rule (unified): each AED of spend earns on the best-yielding
// option AVAILABLE IN CONTEXT; when an option's reward cap is full, the overflow
// flows to the next-best option — another card in a portfolio, or the SAME card's
// base rate for a lone card. This matches how the cards actually work: a bonus cap
// means "no more BONUS," not "no more earning" — spend past the cap still earns
// the base rate. Spend only earns nothing if every eligible option's cap is full.
//
// We solve the assignment EXACTLY (not greedily) as a min-cost max-flow, because
// caps make naive per-category greedy wrong: filling a shared/capped bonus with
// one category can starve another that had no other good home. At <=3 cards /
// ~10 categories this is cheap, so correctness is free.
// ===========================================================================

/** Float tolerance for flow arithmetic and value comparisons (AED are continuous). */
const EPS = 1e-9;

/**
 * Per-card data that doesn't depend on the portfolio (options, valuation, fees).
 * Precomputed once so the optimizer can reuse it across every candidate subset.
 */
export interface CardData {
  card: Card;
  options: EarnOption[];
  aedPerUnit: number;
  valuation: ValuationEntry;
  fees: FeeBreakdown;
  /** Structural flags from option-building (e.g. an unrecognized reward category). */
  buildFlags: ScoreFlag[];
  /** Parallel to `options`: expected AED/AED yield used for routing decisions. */
  yields: number[];
  /** Parallel to `options`: annual AED-spend capacity before the reward cap binds (null = uncapped). */
  capacities: (number | null)[];
}

/**
 * Expected reward-currency units per 1 AED spent, using the rate's MIDPOINT when
 * it's a bounded range (so a genuinely-valuable "up to X%" option isn't ignored)
 * and its lower bound when unbounded (we refuse to invent a ceiling). For a
 * resolved rate this equals the exact yield — so for the real cards (none of which
 * has a range rate among scored cards) routing is identical to a point estimate.
 *
 * why expected value for routing: the assignment is a decision under uncertainty.
 * Routing on the expected rate is the neutral choice; realized value is then
 * reported as a min/max range around it.
 */
function expectedUnitsPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  if (rate.unit === null) return 0;
  const v =
    rate.value ??
    (rate.range
      ? rate.range.max === null
        ? rate.range.min
        : (rate.range.min + rate.range.max) / 2
      : 0);
  return monthlyUnits(v, rate.unit, 1, aedPerUnit);
}

/** Expected AED earned per 1 AED spent — the routing weight for an option. */
function expectedYieldPerAed(rate: NormalizedRate, aedPerUnit: number): number {
  return expectedUnitsPerAed(rate, aedPerUnit) * aedPerUnit;
}

/**
 * Effective ANNUAL AED-spend capacity of an option: the amount of spend past
 * which its reward cap binds and additional spend here earns nothing (so the
 * overflow must route to the next-best option). null = uncapped.
 *
 * Derivation: max annual reward units = min(monthlyCap*12, annualCap). Dividing
 * by units-per-AED converts that unit ceiling into an AED-spend ceiling. Assumes
 * even monthly spend — the same steady-state assumption the rest of the engine makes.
 */
function optionCapacityAnnualAed(option: EarnOption, aedPerUnit: number): number | null {
  if (option.monthlyCap === null && option.annualCap === null) return null;
  const unitsPerAed = expectedUnitsPerAed(option.rate, aedPerUnit);
  // A zero-yield option (unresolved/0% rate) earns nothing regardless, so its cap
  // is immaterial — leave it uncapped for the flow and let earnOnOption report 0.
  if (unitsPerAed <= 0) return null;
  const capUnits = Math.min(
    option.monthlyCap !== null ? option.monthlyCap * 12 : Infinity,
    option.annualCap !== null ? option.annualCap : Infinity,
  );
  return capUnits / unitsPerAed;
}

/** Precompute the portfolio-independent data for one card. */
export function precomputeCardData(card: Card, valuations: ValuationTable = DEFAULT_VALUATIONS): CardData {
  const { options, flags } = buildEarnOptions(card);
  const valuation = resolveValuation(card.rewards.currency, valuations);
  return {
    card,
    options,
    aedPerUnit: valuation.aedPerUnit,
    valuation,
    fees: computeFees(card),
    buildFlags: flags,
    yields: options.map((o) => expectedYieldPerAed(o.rate, valuation.aedPerUnit)),
    capacities: options.map((o) => optionCapacityAnnualAed(o, valuation.aedPerUnit)),
  };
}

/**
 * Which cap direction (monthly vs annual) bounds an option — for the receipt when
 * the FLOW saturated the option's capacity (earnOnOption itself won't report a cap
 * when spend was pre-limited to exactly the cap).
 */
function bindingCapDirection(option: EarnOption): "monthly" | "annual" | undefined {
  if (option.monthlyCap === null && option.annualCap === null) return undefined;
  const monthlyAsAnnual = option.monthlyCap !== null ? option.monthlyCap * 12 : Infinity;
  const annual = option.annualCap !== null ? option.annualCap : Infinity;
  return monthlyAsAnnual <= annual ? "monthly" : "annual";
}

// ---------------------------------------------------------------------------
// Min-cost max-flow. We model routing spend as a transportation problem:
//
//     source ──[spend]──> category ──[eligible]──> option ──[cap]──> sink
//
//   • source -> category c : capacity = c's ANNUAL spend, cost 0
//   • category c -> option o: exists iff o can earn on c; capacity ∞;
//                             cost = MAXY - yield(o)   (>= 0 after the shift)
//   • option o -> sink      : capacity = o's annual AED-spend cap (∞ if uncapped)
//
// Minimising total cost maximises total yield: every valid assignment routes the
// same total flow (all the spend), so sum((MAXY - y)*flow) is minimised exactly
// when sum(y*flow) is maximised. The MAXY shift keeps costs non-negative, so
// successive-shortest-path (SPFA) augmentation is provably optimal.
//
// A virtual zero-yield "unearned" option (uncapped, worst cost) keeps the flow
// feasible even when every real cap is full — spend that can't earn anywhere lands
// there and is reported, never crashing the solver or silently vanishing.
// ---------------------------------------------------------------------------

interface FlowEdge {
  to: number;
  cap: number;
  cost: number;
  flow: number;
}

class MinCostFlow {
  private edges: FlowEdge[] = [];
  private adj: number[][];

  constructor(private n: number) {
    this.adj = Array.from({ length: n }, () => []);
  }

  /** Add a directed edge u->v plus its (zero-capacity) residual reverse edge. */
  addEdge(u: number, v: number, cap: number, cost: number): number {
    const id = this.edges.length;
    this.adj[u]!.push(id);
    this.edges.push({ to: v, cap, cost, flow: 0 });
    this.adj[v]!.push(id + 1);
    this.edges.push({ to: u, cap: 0, cost: -cost, flow: 0 });
    return id;
  }

  /** Flow currently pushed through a forward edge (by the id addEdge returned). */
  flowOn(id: number): number {
    return this.edges[id]!.flow;
  }

  /** Saturate max flow from s to t at minimum total cost (SPFA shortest paths). */
  solve(s: number, t: number): void {
    for (;;) {
      const dist = new Array(this.n).fill(Infinity);
      const inQueue = new Array(this.n).fill(false);
      const prevEdge = new Array(this.n).fill(-1);
      dist[s] = 0;
      const queue: number[] = [s];
      inQueue[s] = true;
      while (queue.length > 0) {
        const u = queue.shift()!;
        inQueue[u] = false;
        for (const id of this.adj[u]!) {
          const e = this.edges[id]!;
          if (e.cap - e.flow > EPS && dist[u] + e.cost < dist[e.to] - EPS) {
            dist[e.to] = dist[u] + e.cost;
            prevEdge[e.to] = id;
            if (!inQueue[e.to]) {
              inQueue[e.to] = true;
              queue.push(e.to);
            }
          }
        }
      }
      if (dist[t] === Infinity) break; // no augmenting path left → max flow reached

      let push = Infinity;
      for (let v = t; v !== s; ) {
        const id = prevEdge[v]!;
        const e = this.edges[id]!;
        push = Math.min(push, e.cap - e.flow);
        v = this.edges[id ^ 1]!.to; // reverse edge's target = the predecessor node
      }
      for (let v = t; v !== s; ) {
        const id = prevEdge[v]!;
        this.edges[id]!.flow += push;
        this.edges[id ^ 1]!.flow -= push;
        v = this.edges[id ^ 1]!.to;
      }
    }
  }
}

/** A single option belonging to a specific card in the set being scored. */
interface FlatOption {
  cardIndex: number;
  option: EarnOption;
  yield: number;
  capAnnualAed: number | null;
  aedPerUnit: number;
}

/** Flatten every card's options into one indexed list (stable order). */
function flattenOptions(cards: CardData[]): FlatOption[] {
  const flat: FlatOption[] = [];
  cards.forEach((cd, cardIndex) => {
    cd.options.forEach((option, i) => {
      flat.push({
        cardIndex,
        option,
        yield: cd.yields[i]!,
        capAnnualAed: cd.capacities[i]!,
        aedPerUnit: cd.aedPerUnit,
      });
    });
  });
  return flat;
}

/** Raw flow solution: annual AED spend on each option, on each (category, option) edge. */
interface FlowSolution {
  optionSpend: number[];
  edgeSpend: { category: SpendCategory; optionIndex: number; annualAed: number }[];
  unearnedAnnualAed: number;
}

function solveAssignment(
  spending: SpendingProfile,
  cards: CardData[],
  flat: FlatOption[],
): FlowSolution {
  const categories = (Object.keys(spending) as SpendCategory[]).filter(
    (c) => (spending[c] ?? 0) > 0,
  );

  const maxYield = flat.reduce((m, o) => Math.max(m, o.yield), 0);

  // Node layout: [source] [categories...] [options...] [unearned] [sink].
  const C = categories.length;
  const O = flat.length;
  const SOURCE = 0;
  const CAT0 = 1;
  const OPT0 = CAT0 + C;
  const UNEARNED = OPT0 + O;
  const SINK = UNEARNED + 1;
  const flow = new MinCostFlow(SINK + 1);

  categories.forEach((c, ci) => {
    flow.addEdge(SOURCE, CAT0 + ci, (spending[c] ?? 0) * 12, 0);
  });

  const edgeIds: { category: SpendCategory; optionIndex: number; edgeId: number }[] = [];
  categories.forEach((c, ci) => {
    flat.forEach((po, oi) => {
      // Eligibility uses the same candidatesFor as scoreCard — one source of truth.
      const eligible = candidatesFor(c, cards[po.cardIndex]!.options).includes(po.option);
      if (!eligible) return;
      const id = flow.addEdge(CAT0 + ci, OPT0 + oi, Infinity, maxYield - po.yield);
      edgeIds.push({ category: c, optionIndex: oi, edgeId: id });
    });
    // category -> unearned (worst cost): feasibility if every real cap fills.
    flow.addEdge(CAT0 + ci, UNEARNED, Infinity, maxYield - 0);
  });

  const optSinkIds = flat.map((po, oi) =>
    flow.addEdge(OPT0 + oi, SINK, po.capAnnualAed ?? Infinity, 0),
  );
  const unearnedSinkId = flow.addEdge(UNEARNED, SINK, Infinity, 0);

  flow.solve(SOURCE, SINK);

  return {
    optionSpend: flat.map((_, oi) => flow.flowOn(optSinkIds[oi]!)),
    edgeSpend: edgeIds
      .map((e) => ({ category: e.category, optionIndex: e.optionIndex, annualAed: flow.flowOn(e.edgeId) }))
      .filter((e) => e.annualAed > EPS),
    unearnedAnnualAed: flow.flowOn(unearnedSinkId),
  };
}

/** One option that received spend, with its aggregate earnings (the per-option receipt). */
export interface OptionOutcome {
  cardIndex: number;
  option: EarnOption;
  aedPerUnit: number;
  /** Aggregate monthly AED routed to this option (may come from several categories). */
  monthlySpendAed: number;
  /** Categories feeding this option, in the user's category order. */
  spendCategories: SpendCategory[];
  /** Full earn result (annual units + AED range + unbounded flag) from the shared cap math. */
  earning: OptionEarning;
  /** Set when the flow saturated this option's cap. */
  capBound?: "monthly" | "annual";
  /** Set when the option relies on an optimistic merchant assumption. */
  merchantAssumption?: string;
}

/** One (category, option) slice that received spend (the "swipe THIS card" receipt). */
export interface SliceOutcome {
  spendCategory: SpendCategory;
  cardIndex: number;
  option: EarnOption;
  monthlySpendAed: number;
  /** This slice's proportional share of its option's (possibly capped) value. */
  annualValueAed: AedRange;
  capBound?: "monthly" | "annual";
  merchantAssumption?: string;
}

/** The shared scoring result for a set of cards under one spending profile. */
export interface EarnResult {
  cards: CardData[];
  /** Only options that received spend. */
  optionOutcomes: OptionOutcome[];
  /** Only (category, option) slices that received spend. */
  slices: SliceOutcome[];
  /** Gross AED/year each card contributes (parallel to `cards`). */
  perCardGross: AedRange[];
  /** Gross AED/year across all cards, before fees. */
  grossAnnualValue: AedRange;
  /** Monthly AED that earns nothing because every eligible option's cap is full. */
  unearnedMonthlyAed: number;
}

/**
 * Assign `spending` across `cards` optimally and report what each option/slice
 * earns. THE single source of truth for portfolio-aware earning — scoreCard and
 * optimizePortfolio both call it, so a lone card and a 1-card portfolio agree.
 */
export function earnAcrossCards(spending: SpendingProfile, cards: CardData[]): EarnResult {
  const flat = flattenOptions(cards);
  const sol = solveAssignment(spending, cards, flat);

  // Per-option aggregate earnings. Caps apply to the AGGREGATE on an option (several
  // categories can feed one option), so value is computed at the option level.
  const optionValue: AedRange[] = flat.map((po, oi) => {
    const monthlyAgg = sol.optionSpend[oi]! / 12;
    if (monthlyAgg <= EPS) return { min: 0, max: 0 };
    return earnOnOption(po.option, monthlyAgg, po.aedPerUnit).annualValueAed;
  });
  const optionCapBound: (("monthly" | "annual") | undefined)[] = flat.map((po, oi) => {
    const cap = po.capAnnualAed;
    if (cap === null) return undefined;
    return sol.optionSpend[oi]! >= cap - EPS ? bindingCapDirection(po.option) : undefined;
  });

  // Per-option outcome (for the single-card receipt). Categories feeding each option
  // are gathered from the slices, preserving the user's category order.
  const catsByOption = new Map<number, SpendCategory[]>();
  for (const e of sol.edgeSpend) {
    const list = catsByOption.get(e.optionIndex) ?? [];
    if (!list.includes(e.category)) list.push(e.category);
    catsByOption.set(e.optionIndex, list);
  }
  const optionOutcomes: OptionOutcome[] = [];
  flat.forEach((po, oi) => {
    const monthly = sol.optionSpend[oi]! / 12;
    if (monthly <= EPS) return;
    optionOutcomes.push({
      cardIndex: po.cardIndex,
      option: po.option,
      aedPerUnit: po.aedPerUnit,
      monthlySpendAed: monthly,
      spendCategories: catsByOption.get(oi) ?? [],
      earning: earnOnOption(po.option, monthly, po.aedPerUnit),
      capBound: optionCapBound[oi],
      merchantAssumption: po.option.rule.kind === "categories" ? po.option.rule.merchant : undefined,
    });
  });

  // Per-slice outcome (for the portfolio's "swipe THIS card" receipt). A slice takes
  // its option's value in proportion to its spend, so slices sum back to the option.
  const slices: SliceOutcome[] = sol.edgeSpend.map((e) => {
    const po = flat[e.optionIndex]!;
    const totalOnOption = sol.optionSpend[e.optionIndex]!;
    const share = totalOnOption > EPS ? e.annualAed / totalOnOption : 0;
    const optVal = optionValue[e.optionIndex]!;
    return {
      spendCategory: e.category,
      cardIndex: po.cardIndex,
      option: po.option,
      monthlySpendAed: e.annualAed / 12,
      annualValueAed: { min: optVal.min * share, max: optVal.max * share },
      capBound: optionCapBound[e.optionIndex],
      merchantAssumption: po.option.rule.kind === "categories" ? po.option.rule.merchant : undefined,
    };
  });

  // Per-card gross and portfolio gross.
  const perCardGross: AedRange[] = cards.map(() => ({ min: 0, max: 0 }));
  flat.forEach((po, oi) => {
    perCardGross[po.cardIndex]!.min += optionValue[oi]!.min;
    perCardGross[po.cardIndex]!.max += optionValue[oi]!.max;
  });
  const grossAnnualValue = perCardGross.reduce(
    (acc, g) => ({ min: acc.min + g.min, max: acc.max + g.max }),
    { min: 0, max: 0 },
  );

  return {
    cards,
    optionOutcomes,
    slices,
    perCardGross,
    grossAnnualValue,
    unearnedMonthlyAed: sol.unearnedAnnualAed / 12,
  };
}

// ---------------------------------------------------------------------------
// scoreCard.
// ---------------------------------------------------------------------------

export function scoreCard(
  spending: SpendingProfile,
  card: Card,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
): CardScore {
  const valuation = resolveValuation(card.rewards.currency, valuations);

  // --- Benched cards: excluded from scoring pending data verification. We return
  // a zeroed, clearly-flagged score rather than guessing a reward structure or
  // dropping the card, so it stays visible but is never ranked. ---
  if (card.excluded_from_scoring) {
    return {
      cardId: card.id,
      rewardCurrency: card.rewards.currency,
      valuation,
      netAnnualValue: 0,
      netAnnualValueRange: { min: 0, max: 0 },
      netAnnualValueYear1: 0,
      grossAnnualValue: { min: 0, max: 0 },
      fees: computeFees(card),
      breakdown: [],
      flags: [
        {
          level: "unknown",
          message: `Excluded from scoring — pending data verification${card.notes ? ` (${card.notes})` : ""}`,
        },
      ],
      uncertain: true,
      benched: true,
    };
  }

  // --- Assign + earn via the SHARED core. scoreCard(card) is exactly a 1-card
  // portfolio, so it delegates to earnAcrossCards([card]) — the same computation
  // the optimizer runs. This is what makes scoreCard and best-1-card agree. ---
  const cd = precomputeCardData(card, valuations);
  const result = earnAcrossCards(spending, [cd]);

  const flags: ScoreFlag[] = [...cd.buildFlags]; // structural (e.g. unknown-category) flags first
  let uncertain = false;

  // --- Build the per-option receipt + inherit flags from each earning option. ---
  const breakdown: CategoryEarning[] = [];
  for (const o of result.optionOutcomes) {
    const rate = o.option.rate;
    breakdown.push({
      cardCategory: o.option.cardCategory,
      spendCategories: o.spendCategories,
      monthlySpendAed: o.monthlySpendAed,
      rate,
      annualUnits: o.earning.annualUnits,
      annualValueAed: o.earning.annualValueAed,
      capBound: o.capBound,
      merchantAssumption: o.merchantAssumption,
    });

    if (rate.confidence === "unknown") {
      uncertain = true;
      flags.push({
        level: "unknown",
        message: `Unresolved rate on ${o.option.cardCategory} ("${rate.raw}") — scored as a range`,
      });
    } else if (rate.confidence === "low") {
      uncertain = true;
      flags.push({ level: "low", message: `Low-confidence rate on ${o.option.cardCategory} ("${rate.raw}")` });
    }
    if (o.earning.unbounded) {
      flags.push({
        level: "unknown",
        message: `${o.option.cardCategory} has an unbounded variable rate — upside not scored`,
      });
    }
    if (o.capBound) {
      // why the message changed from "not modeled": over-cap spend is no longer
      // dropped — it earns the card's base rate (the unified reroute rule).
      flags.push({
        level: "low",
        message: `${o.capBound} cap reached on ${o.option.cardCategory} — over-cap spend earns the base rate`,
      });
    }
    if (o.merchantAssumption) {
      uncertain = true;
      flags.push({
        level: "low",
        message: `${o.option.cardCategory}: assumes ${o.spendCategories.join("/")} spend occurs at ${o.merchantAssumption}`,
      });
    }
  }

  // Report unmatched (un-scoreable) categories once, as a flag.
  for (const o of cd.options) {
    if (o.rule.kind === "unmatched") {
      flags.push({ level: "low", message: `${o.cardCategory}: ${o.rule.reason}` });
    }
  }
  // Spend that couldn't earn anywhere (every option's cap full) — rare for one card.
  if (result.unearnedMonthlyAed > EPS) {
    flags.push({
      level: "low",
      message: `${result.unearnedMonthlyAed.toFixed(0)} AED/mo of spend exceeds this card's caps and earns nothing`,
    });
  }

  const grossMin = result.grossAnnualValue.min;
  const grossMax = result.grossAnnualValue.max;

  // --- Fees + valuation-confidence flag. ---
  const fees = cd.fees;
  if (valuation.confidence !== "high") {
    uncertain = true;
    flags.push({
      level: valuation.confidence === "low" ? "low" : "low",
      message: `Valuation of "${card.rewards.currency}" is ${valuation.confidence} confidence${
        valuation.note ? ` (${valuation.note})` : ""
      }`,
    });
  }

  const netMinOngoing = grossMin - fees.ongoingFeeAed;
  const netMaxOngoing = grossMax - fees.ongoingFeeAed;
  const netMinYear1 = grossMin - fees.year1FeeAed;
  const netMaxYear1 = grossMax - fees.year1FeeAed;
  if (grossMax !== grossMin) uncertain = true;

  return {
    cardId: card.id,
    rewardCurrency: card.rewards.currency,
    valuation,
    // why midpoint for the single ranking number: it's a neutral expected value
    // across the uncertainty band. The full range is exposed alongside it.
    netAnnualValue: (netMinOngoing + netMaxOngoing) / 2,
    netAnnualValueRange: { min: netMinOngoing, max: netMaxOngoing },
    netAnnualValueYear1: (netMinYear1 + netMaxYear1) / 2,
    grossAnnualValue: { min: grossMin, max: grossMax },
    fees,
    breakdown,
    flags,
    uncertain,
    benched: false,
  };
}
