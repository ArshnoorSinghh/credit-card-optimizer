/**
 * Merchant → spend-category mapping.
 *
 * "Which card for Carrefour?" is the question people actually ask; the engine
 * scores in categories. This table is the translation layer between the two.
 *
 * ── Scope and maintenance ───────────────────────────────────────────────────────
 * This is a UAE-SPECIFIC table and it is expected to GROW over time — it is plain
 * data, deliberately trivial to extend: add a key with a `primaryCategory` (and
 * `alsoCovers` / `aliases` if relevant) and you're done. No code changes needed.
 *
 * ── Rules ───────────────────────────────────────────────────────────────────────
 *  - An UNKNOWN merchant returns `null`. We never guess-map a name we don't know:
 *    a wrong category silently recommends the wrong card, which is worse than
 *    admitting we don't recognise the merchant and asking for a category.
 *  - Matching is case-insensitive, whitespace-tolerant, and accepts a merchant name
 *    embedded in a longer string ("carrefour city mall" → Carrefour), but only on
 *    WORD BOUNDARIES, so "dubai" never resolves to "du".
 *
 * Pure data + pure lookups. No I/O.
 */

import type { SpendCategory } from "./score-card";

export interface MerchantEntry {
  /**
   * The category this merchant's spend lands in by default — the most common case.
   * This is the category the engine actually scores.
   */
  primaryCategory: SpendCategory;
  /**
   * Other categories this merchant genuinely spans. Present only for merchants where
   * a single charge could honestly be either thing (Talabat sells restaurant meals
   * AND groceries). We do NOT try to guess which one a given charge was — see
   * `resolveMerchant` and which-card.ts for how this is surfaced instead.
   */
  alsoCovers?: SpendCategory[];
  /** Extra spellings that should resolve to this merchant ("amazon" → "amazon.ae"). */
  aliases?: string[];
}

/**
 * Keyed by canonical merchant name (lowercase).
 *
 * NOTE on "shopping": the engine has no `shopping` category — `SpendCategory` is a
 * closed 10-member union, and no card in cards.json bonuses online shopping. So
 * general marketplaces (Amazon.ae / Noon / Namshi) map to `other`, which is exactly
 * right: that spend earns the card's base rate, and `other` is what models base-rate
 * spend. If a card with an online-shopping bonus is ever added, revisit this.
 */
export const MERCHANT_MAP: Record<string, MerchantEntry> = {
  // ── Groceries ────────────────────────────────────────────────────────────────
  carrefour: { primaryCategory: "groceries" },
  lulu: { primaryCategory: "groceries", aliases: ["lulu hypermarket", "lulu express"] },
  spinneys: { primaryCategory: "groceries" },
  "union coop": { primaryCategory: "groceries", aliases: ["union co-op", "unioncoop"] },
  choithrams: { primaryCategory: "groceries", aliases: ["choitrams"] },

  // ── Food delivery — genuinely multi-category ─────────────────────────────────
  // why dining is primary with groceries as alsoCovers: these apps started as
  // restaurant delivery (still the majority of orders) but now all run grocery
  // arms (Talabat Mart, Deliveroo Hop). A single charge could be either, and the
  // merchant name alone cannot tell us which — so we answer for the primary and
  // surface the ambiguity rather than silently picking one.
  talabat: { primaryCategory: "dining", alsoCovers: ["groceries"] },
  deliveroo: { primaryCategory: "dining", alsoCovers: ["groceries"] },
  "noon food": { primaryCategory: "dining", alsoCovers: ["groceries"] },
  zomato: { primaryCategory: "dining", alsoCovers: ["groceries"] },

  // ── Entertainment ────────────────────────────────────────────────────────────
  vox: { primaryCategory: "entertainment", aliases: ["vox cinemas"] },
  reel: { primaryCategory: "entertainment", aliases: ["reel cinemas"] },
  novo: { primaryCategory: "entertainment", aliases: ["novo cinemas"] },

  // ── Fuel ─────────────────────────────────────────────────────────────────────
  adnoc: { primaryCategory: "fuel" },
  enoc: { primaryCategory: "fuel" },
  eppco: { primaryCategory: "fuel" },

  // ── Travel ───────────────────────────────────────────────────────────────────
  emirates: { primaryCategory: "travel", aliases: ["emirates airlines", "emirates airline"] },
  etihad: { primaryCategory: "travel", aliases: ["etihad airways"] },
  flydubai: { primaryCategory: "travel", aliases: ["fly dubai"] },

  // ── General marketplaces → `other` (see the "shopping" note above) ───────────
  "amazon.ae": { primaryCategory: "other", aliases: ["amazon", "amazon ae"] },
  noon: { primaryCategory: "other", aliases: ["noon.com"] },
  namshi: { primaryCategory: "other" },

  // ── Transport ────────────────────────────────────────────────────────────────
  careem: { primaryCategory: "transport" },
  uber: { primaryCategory: "transport" },
  rta: { primaryCategory: "transport", aliases: ["nol", "dubai metro"] },

  // ── Utilities ────────────────────────────────────────────────────────────────
  dewa: { primaryCategory: "utilities" },
  sewa: { primaryCategory: "utilities" },
  du: { primaryCategory: "utilities" },
  etisalat: { primaryCategory: "utilities", aliases: ["e&"] },
};

export interface ResolvedMerchant {
  /** The canonical merchant key that matched (e.g. "carrefour"). */
  merchant: string;
  /** The category to score — the merchant's primary. */
  category: SpendCategory;
  /** True when this merchant genuinely spans more than one category. */
  multiCategory: boolean;
  /** The other categories it spans; present only when `multiCategory`. */
  alsoCovers?: SpendCategory[];
}

/**
 * Lowercase, trim, and collapse runs of internal whitespace.
 *
 * Exported so callers comparing a resolved merchant against a merchant name from
 * elsewhere in the engine (e.g. the scorer's merchant-locked bonuses, which spell
 * it "LuLu") normalize both sides the same way rather than inventing a second rule.
 */
export function normalizeMerchantName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

const normalize = normalizeMerchantName;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every lookup key (canonical names + aliases) paired with its canonical name. */
function lookupKeys(): Array<{ key: string; canonical: string }> {
  const out: Array<{ key: string; canonical: string }> = [];
  for (const [canonical, entry] of Object.entries(MERCHANT_MAP)) {
    out.push({ key: canonical, canonical });
    for (const alias of entry.aliases ?? []) out.push({ key: normalize(alias), canonical });
  }
  return out;
}

/**
 * Resolve a merchant name to the category the engine should score.
 *
 * Returns `null` for anything we don't recognise — never a guess. The caller is
 * expected to fall back to asking the user for a category.
 *
 * Matching, in order:
 *  1. exact match on a canonical name or alias ("Carrefour", "amazon");
 *  2. otherwise the longest known name appearing in the input on word boundaries
 *     ("carrefour city mall" → carrefour). Longest wins so "noon food" beats "noon".
 */
export function resolveMerchant(input: string): ResolvedMerchant | null {
  if (typeof input !== "string") return null;
  const needle = normalize(input);
  if (!needle) return null;

  const keys = lookupKeys();

  // 1. Exact match.
  let canonical = keys.find((k) => k.key === needle)?.canonical;

  // 2. Word-boundary containment; longest key wins so a more specific merchant
  //    ("noon food") beats a shorter one it contains ("noon"). We only ever check
  //    whether the INPUT contains a known name — never the reverse — so a bare
  //    "noon" can't be captured by "noon food".
  if (!canonical) {
    const matches = keys
      .filter(({ key }) => new RegExp(`(^|\\W)${escapeRegex(key)}(\\W|$)`).test(needle))
      .sort((a, b) => b.key.length - a.key.length);
    canonical = matches[0]?.canonical;
  }

  if (!canonical) return null;

  const entry = MERCHANT_MAP[canonical]!;
  const alsoCovers = entry.alsoCovers;
  return {
    merchant: canonical,
    category: entry.primaryCategory,
    multiCategory: alsoCovers !== undefined && alsoCovers.length > 0,
    ...(alsoCovers && alsoCovers.length > 0 ? { alsoCovers } : {}),
  };
}
