/**
 * Merchant share — how much of a category's spend actually happens at ONE retailer.
 *
 * ── The problem this closes ─────────────────────────────────────────────────────
 * Fourteen UAE co-brand cards bonus a specific merchant: `lulu_supermarket`,
 * `emaar_malls`, `noon_...`, `amazon_ae_...`, the Emirates/Etihad/Marriott cards.
 * The card data records those bonuses correctly. The SPEND MODEL had no notion of
 * "share of category X spent at merchant Y", so the engine credited a merchant rate
 * to EVERY dirham of the canonical category it maps to — `emaar_malls` (6.25%) maps
 * to canonical `other`, so all of a user's `other` spend was scored as though every
 * dirham were spent inside an Emaar mall.
 *
 * The only honest responses were to exclude those cards from any published figure
 * (which is what the gap study did — 15 of its 21 rejections) or to ask the user.
 * This module is the second option: the share becomes an INPUT, like spend itself.
 *
 * ── The model ───────────────────────────────────────────────────────────────────
 * A share is one number per merchant: the fraction (0..1) of the user's spend, in
 * the canonical categories that merchant's bonus covers, that occurs at it. It is
 * enforced in the allocator as a capacity, not as a rate haircut — see
 * `solveAssignment` in score-card.ts. Two consequences that a haircut would get
 * wrong, and which are the reason it is modelled this way:
 *
 *  1. The spend that ISN'T at the merchant is not destroyed — it flows on to the
 *     next-best option (another card, or the same card's base rate), exactly as
 *     over-cap spend does. Scaling the rate down by the share would silently keep
 *     that spend parked on a bonus it never earned.
 *  2. Two cards bonusing the SAME merchant share ONE pool. If 30% of your groceries
 *     are at LuLu, holding two LuLu cards does not make it 60% — the allocator
 *     splits the same 30% between them.
 *
 * ── What a share does NOT do ────────────────────────────────────────────────────
 * A share applies per canonical category, so a merchant whose bonus spans several
 * categories (noon covers `other`, `dining` and `groceries`) applies the SAME
 * fraction to each. Asking for a full merchant x category matrix would be a more
 * faithful model and a much worse question to put to a user; this is the
 * deliberate simplification, and the UI names the affected categories when it asks.
 *
 * ── Absent shares ───────────────────────────────────────────────────────────────
 * An unstated merchant is BOUNDED, not assumed: `boundMerchantLockedRates` in
 * score-card.ts rewrites the bonus to a 0..full range, because "we didn't ask" is
 * not evidence that the user spends everything there — nor that they spend nothing.
 *
 * This is deliberately NOT the model above. A bound is what you emit when you have
 * no information; a capacity is what you enforce when you do. The two never act on
 * the same option: a lock with a stated share keeps its real rate and is constrained
 * by the flow, and a lock without one is bounded and left out of the flow's share
 * machinery entirely.
 *
 * why it was worth doing both: an earlier revision left unstated merchants at the
 * FULL category, on the reasoning that this kept the change additive. Read one card
 * at a time that is defensible. Under SELECTION it is not — optimizePortfolio keeps
 * the best 1-3 of ~53 cards, so it would reliably pick whichever cards carried the
 * most optimistic merchant assumptions, and could stack three at once (all retail at
 * Emaar, all groceries at LuLu, all dining via Talabat). Measured over the weighted
 * population that was worth ~2.34pp of the reported optimal return.
 *
 * The product asks, so in the app a share is normally present and the bound is the
 * fallback for callers that cannot ask — the gap study's no-share universes, and any
 * integration not yet wired to the question.
 *
 * Pure data + pure functions. No I/O.
 *
 * why the question-builder lives in merchant-share-questions.ts and not here: it
 * needs `buildEarnOptions` from score-card.ts, and score-card.ts imports THIS module
 * to enforce the shares. Keeping the enforcement primitives free of that dependency
 * makes the import graph acyclic at runtime (score-card -> merchant-share ->
 * merchant-map, which imports score-card for a TYPE only, and types are erased).
 */

import { normalizeMerchantName } from "./merchant-map";

/**
 * User-supplied shares, keyed by merchant name as the engine spells it
 * (`merchantLockFor` / `MerchantShareQuestion.merchant` — e.g. "LuLu", "Emaar").
 * Keys are matched case- and whitespace-insensitively, so a caller round-tripping
 * a name through a form or a database can't miss by capitalisation.
 */
export type MerchantShares = Readonly<Record<string, number>>;

/**
 * Shares after validation: normalized merchant key -> fraction in [0,1]. This is
 * what the engine's internals carry, so the validation happens exactly once at the
 * boundary rather than on every lookup inside the allocator's inner loops.
 */
export type ResolvedMerchantShares = ReadonlyMap<string, number>;

/** A share value we refused to use, and why. Surfaced so a caller can show it. */
export interface MerchantShareIssue {
  merchant: string;
  value: unknown;
  reason: string;
}

/**
 * Validate raw shares into the engine's internal form.
 *
 * why REJECT rather than clamp an out-of-range value: a share of 1.4 or -0.2 is not
 * a user meaning "all" or "none", it is a broken input — a percentage entered where
 * a fraction was expected is the obvious way to produce 30 instead of 0.3. Clamping
 * 30 to 1.0 would turn a typo into the maximally optimistic assumption, silently,
 * which is the exact failure mode this whole module exists to remove. A rejected
 * entry falls back to "unstated", which keeps the existing loud flag.
 */
export function sanitizeMerchantShares(input: MerchantShares | undefined): {
  shares: ResolvedMerchantShares;
  issues: MerchantShareIssue[];
} {
  const shares = new Map<string, number>();
  const issues: MerchantShareIssue[] = [];
  if (!input) return { shares, issues };

  for (const [merchant, value] of Object.entries(input)) {
    const key = normalizeMerchantName(merchant);
    if (!key) {
      issues.push({ merchant, value, reason: "empty merchant name" });
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ merchant, value, reason: "not a finite number" });
      continue;
    }
    if (value < 0 || value > 1) {
      issues.push({
        merchant,
        value,
        reason: "outside 0..1 — a share is a fraction, not a percentage",
      });
      continue;
    }
    shares.set(key, value);
  }
  return { shares, issues };
}

/** The stated share for a merchant, or undefined when the user hasn't said. */
export function shareFor(
  shares: ResolvedMerchantShares | undefined,
  merchant: string,
): number | undefined {
  return shares?.get(normalizeMerchantName(merchant));
}

