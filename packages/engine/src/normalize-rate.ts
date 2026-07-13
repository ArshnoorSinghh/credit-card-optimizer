/**
 * Rate normalizer.
 *
 * Turns the messy free-text `rate` / `base_rate` strings in cards.json into a
 * structured, numeric `NormalizedRate` the optimizer can compute with — while
 * being honest about uncertainty. Per CLAUDE.md: we flag genuinely uncertain
 * rates rather than inventing numbers, and we NEVER silently default an
 * unparseable string to some value. Anything we don't recognize is surfaced
 * loudly as unknown (tier 3), not guessed.
 *
 * Pure and deterministic: string in, struct out. No I/O.
 *
 * The three confidence tiers map to the design:
 *   high    (tier 1) — clean parse; number and unit are certain.
 *   low     (tier 2) — number parses, but a condition may be missing from the
 *                      structured data, so downstream should say "verify this card."
 *   unknown (tier 3) — no single value; we emit a range (or nothing) instead of guessing.
 */

/**
 * What the numeric `value` MEANS. These are genuinely different units and must
 * never be conflated (mixing them would silently corrupt the optimizer's math).
 *
 * why `percent` and not `percent_cashback`: the design called this unit
 * "percent cashback", but two cards in the data quote a percent while paying in
 * points ("10% on Emaar purchases" on a U-By-Emaar *points* card). So a percent
 * means "this fraction of spend comes back, in the card's reward currency" — not
 * necessarily cash. The reward currency lives on the card (`rewards.currency`);
 * this unit only describes the shape of the number.
 *
 * why both `miles_per_usd` AND `miles_per_aed`: the data contains "1 mile per
 * AED 1" as well as the more common "... per USD 1". These differ by the USD/AED
 * FX rate (~3.67x), so folding them into one unit would be exactly the
 * conflation the design warns against.
 */
export type RateUnit =
  | "percent" // decimal fraction of spend returned (0.05 === 5%), in the card's reward currency
  | "points_per_aed" // loyalty points earned per 1 AED spent (includes branded points, e.g. TouchPoints)
  | "miles_per_usd" // airline miles earned per 1 USD spent
  | "miles_per_aed"; // airline miles earned per 1 AED spent — NOT interchangeable with per-USD

export type RateConfidence = "high" | "low" | "unknown";

/**
 * A rate we can't pin to a single number but can bound. Used for genuinely
 * variable rates (tier 3). `max: null` means no ceiling is stated anywhere in
 * the string — genuinely unbounded/unknown, so we refuse to invent one.
 */
export interface RateRange {
  min: number;
  max: number | null;
}

export interface NormalizedRate {
  /** The original string, always preserved so a human can audit any decision. */
  raw: string;
  /** Decimal rate in `unit`. null when there is no single value (tier 3). */
  value: number | null;
  /** What `value`/`range` are denominated in. null when the string names no unit. */
  unit: RateUnit | null;
  confidence: RateConfidence;
  /** Present for variable rates (tier 3): the bounds we could establish. */
  range?: RateRange;
  /** Human-readable reason, especially for low/unknown, so review lists explain themselves. */
  note?: string;
}

/**
 * Optional card context for the one decision that can't be made from the string
 * alone: whether an "up to X%" ceiling is structurally modeled by cap fields.
 *
 * why: per CLAUDE.md/design, "up to X%" is tier 1 (parse as X%) when the card's
 * cap fields already model the constraint — because the cap, not a discounted
 * rate, expresses the limit. When no cap exists (e.g. a user-chosen category),
 * the same string is tier 3 (a 0..X range), because the actual earned rate
 * depends on an unmodeled user choice.
 */
export interface RateContext {
  monthlyCap?: number | null;
  annualCap?: number | null;
}

// ---------------------------------------------------------------------------
// Patterns. Each is anchored (^...$) so a string must match *entirely* — a
// partial match is not a match, which keeps unrecognized junk out of tier 1/2.
// A leading capture group grabs the number (integer or decimal).
// ---------------------------------------------------------------------------

const NUM = String.raw`(\d+(?:\.\d+)?)`;

// "5%", "1.5%", and base rates like "1% on all spend" / "10% on Emaar purchases".
// Group 2 is the trailing scope text (may be empty), used to detect conditions.
const PERCENT = new RegExp(String.raw`^${NUM}\s*%\s*(.*)$`, "i");

// "1 point per AED 1", "2 points per AED 1", "3 TouchPoints per AED 1".
// why TouchPoints here: they are a branded points currency; the *rate* ("2 per
// AED 1") is exact, so it's high-confidence. Which program it is (and what a
// TouchPoint is worth) is a valuation concern carried by `rewards.currency`.
const POINTS_PER_AED = new RegExp(
  String.raw`^${NUM}\s+(?:point|points|touchpoint|touchpoints)\s+per\s+AED\s*1$`,
  "i",
);

// "1.5 miles per USD 1", optionally with a trailing FX note like "(approx AED 3.67)".
// why we strip the parenthetical: it annotates the USD->AED conversion; it does
// not change the rate, so the core string is still a clean high-confidence parse.
const MILES_PER_USD = new RegExp(
  String.raw`^${NUM}\s+(?:mile|miles)\s+per\s+USD\s*1(?:\s*\(.*\))?$`,
  "i",
);

// "1 mile per AED 1" — deliberately separate from MILES_PER_USD (see RateUnit).
const MILES_PER_AED = new RegExp(
  String.raw`^${NUM}\s+(?:mile|miles)\s+per\s+AED\s*1$`,
  "i",
);

// "Up to 5%" — the tier-1-vs-tier-3 fork, resolved using RateContext.
const UP_TO_PERCENT = new RegExp(String.raw`^up\s+to\s+${NUM}\s*%$`, "i");

// Explicitly-variable rates with no number: "Variable", "Customizable based on ...".
const EXPLICITLY_VARIABLE = /variable|customi[sz]/i;

// Trailing scope text on a percent that still counts as a plain blanket rate.
const WHOLE_CARD_SCOPE = /^(?:on\s+)?(?:all\s+spend|all\s+purchases|everything)$/i;

/**
 * Normalize one raw rate string.
 *
 * @param raw  the source string (e.g. a category `rate` or a `base_rate`)
 * @param ctx  optional cap context; only consulted for "up to X%" strings
 */
export function normalizeRate(raw: string, ctx: RateContext = {}): NormalizedRate {
  const s = raw.trim();

  // --- "Up to X%": check BEFORE plain percent, since it also contains "%". ---
  const upTo = UP_TO_PERCENT.exec(s);
  if (upTo) {
    const ceiling = Number(upTo[1]) / 100;
    const capModeled =
      (ctx.monthlyCap ?? null) !== null || (ctx.annualCap ?? null) !== null;
    if (capModeled) {
      // The cap fields express the constraint; treat the headline as the real
      // rate. (No card in today's data hits this branch, but future ones may.)
      return { raw, value: ceiling, unit: "percent", confidence: "high" };
    }
    // No cap: the earned rate depends on an unmodeled choice. Bound it, 0..X.
    return {
      raw,
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: ceiling },
      note: "Ceiling only; actual rate depends on an unmodeled choice/condition",
    };
  }

  // --- Plain percent: "5%", "1% on all spend", "10% on Emaar purchases". ---
  const pct = PERCENT.exec(s);
  if (pct) {
    const value = Number(pct[1]) / 100;
    // pct[2] is the `(.*)` scope group; typed string|undefined under
    // noUncheckedIndexedAccess even though `(.*)` always captures (possibly "").
    const scope = (pct[2] ?? "").trim();
    // Blanket rate (no scope, or an all-spend scope) is clean -> high.
    if (scope === "" || WHOLE_CARD_SCOPE.test(scope)) {
      return { raw, value, unit: "percent", confidence: "high" };
    }
    // A specific scope ("on Emaar purchases", "on dnata travel") means this rate
    // only applies to some merchants, but no structured field captures that.
    // Parse the number, but flag low so downstream says "verify this card."
    return {
      raw,
      value,
      unit: "percent",
      confidence: "low",
      note: `Rate is scoped ("${scope}") but the condition isn't in the structured data`,
    };
  }

  // --- Points / miles: order among these doesn't matter (mutually exclusive). ---
  const ppa = POINTS_PER_AED.exec(s);
  if (ppa) {
    return { raw, value: Number(ppa[1]), unit: "points_per_aed", confidence: "high" };
  }

  const mpu = MILES_PER_USD.exec(s);
  if (mpu) {
    return { raw, value: Number(mpu[1]), unit: "miles_per_usd", confidence: "high" };
  }

  const mpa = MILES_PER_AED.exec(s);
  if (mpa) {
    return { raw, value: Number(mpa[1]), unit: "miles_per_aed", confidence: "high" };
  }

  // --- Explicitly variable, no number ("Variable", "Customizable ..."). ---
  if (EXPLICITLY_VARIABLE.test(s)) {
    return {
      raw,
      value: null,
      unit: null,
      confidence: "unknown",
      // min 0; no ceiling is stated in the string, so we refuse to invent a max.
      range: { min: 0, max: null },
      note: "Explicitly variable; no number or ceiling stated",
    };
  }

  // --- Fell through everything: unknown pattern. Surface it, never guess. ---
  return {
    raw,
    value: null,
    unit: null,
    confidence: "unknown",
    range: { min: 0, max: null },
    note: "Unrecognized rate pattern — needs manual review",
  };
}

/** Which review tier a normalized rate belongs to (1 clean, 2 verify, 3 unresolved). */
export function rateTier(rate: NormalizedRate): 1 | 2 | 3 {
  switch (rate.confidence) {
    case "high":
      return 1;
    case "low":
      return 2;
    case "unknown":
      return 3;
  }
}
