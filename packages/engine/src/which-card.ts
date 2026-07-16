/**
 * "Which card should I use?" — a deterministic lookup, not a chatbot.
 *
 * No AI, no LLM, no tokens, no network: this is a pure function over the existing
 * engine. Given an amount and a category (or a merchant name), it answers which of
 * your cards to swipe, and optionally which card you don't own would do better.
 *
 * ── How scoring is reused (NOT reimplemented) ───────────────────────────────────
 * Every number here comes from `scoreCard`. We build a SpendingProfile containing
 * exactly one category and hand it to the existing scorer, then read the result.
 * That inherits, for free and with one source of truth:
 *   - card-category → spend-category matching (the MATCH_TABLE)
 *   - rate normalization + unit handling (percent / per-AED / per-USD)
 *   - monthly AND annual caps, in reward-currency units
 *   - the unified over-cap reroute (spend past a bonus cap earns the base rate)
 *   - reward-currency → AED valuation
 *   - range propagation and every uncertainty flag
 * There is no rate parsing, no cap arithmetic and no category matching in this file.
 * If the scorer changes, this changes with it.
 *
 * ── Why earnings, not net-of-fee ────────────────────────────────────────────────
 * `scoreCard.netAnnualValue` subtracts the annual fee, and `optimizePortfolio` ranks
 * by it. That's right for "which cards should I HOLD", and wrong for "which card
 * should I SWIPE": the fee is already paid and is not attributable to one purchase.
 * A 4,200-fee card that earns 5% on groceries is still the right card to swipe there.
 * So we rank on GROSS earnings (`grossAnnualValue`) and expose each card's fee
 * separately for the frontend to caveat with. This is the one place we deliberately
 * diverge from the optimizer's ranking, and the reason we build on `scoreCard`
 * rather than `optimizePortfolio`.
 *
 * @example Intended input shape — an amount and one category-or-merchant term.
 * The frontend renders two plain fields: "Spend [ 3000 ] AED on [ Carrefour ]".
 * The engine receives clean structured input and NEVER a raw sentence — natural
 * language parsing is explicitly out of scope.
 *
 * ```ts
 * const answer = askWhichCard({
 *   merchantOrCategory: "Carrefour", // text field: one term — a category or a merchant
 *   monthlySpend: 3000,              // number field: AED per month
 *   userCards: myCards,              // the cards the user owns
 *   includeUnowned: true,            // also look for a better card they don't hold
 * });
 * // answer.status === "ok" -> answer.bestOwnedCard, answer.bestUnownedCard, ...
 * ```
 *
 * Pure functions. No I/O.
 */

import type { Card } from "./card";
import { normalizeMerchantName, resolveMerchant } from "./merchant-map";
import {
  merchantLockFor,
  scoreCard,
  SPEND_CATEGORIES,
  type AedRange,
  type SpendCategory,
  type SpendingProfile,
} from "./score-card";
import { DEFAULT_VALUATIONS, type ValuationTable } from "./valuations";

/**
 * Drop bonuses locked to a DIFFERENT merchant than the one being asked about.
 *
 * Some card bonuses only pay at one merchant ("lulu_supermarket" pays at LuLu).
 * `scoreCard` can only flag those as an optimistic assumption, because a generic
 * spending profile can't say where the spend happened. But here we KNOW: if you
 * asked about Carrefour, the LuLu card's bonus provably does not apply, and
 * recommending it would be wrong. Removing the category makes that spend fall to
 * the card's base rate — which is exactly what would really happen at the till.
 *
 * It cuts both ways: asking about Emirates correctly KEEPS `emirates_purchases`.
 *
 * why this is a card transform rather than new scoring code: we hand the modified
 * card to the existing `scoreCard`, so caps, reroutes and matching are still the
 * scorer's — one source of truth preserved.
 *
 * DEFERRED (intentionally): the fuzzy half of merchant precision — whether a GENERIC
 * bonus applies at a given merchant (does a "supermarket" bonus pay at Spinneys? is
 * a Careem ride "transport" or "travel" to this issuer?) depends on merchant category
 * codes and issuer interpretation that this table cannot capture. That judgement is
 * deferred to the future LLM layer. Here we only act on locks the data states
 * explicitly, and never guess.
 */
function applyMerchantLocks(card: Card, merchant: string): Card {
  const kept = card.rewards.categories.filter((c) => {
    const lock = merchantLockFor(c.category);
    return lock === undefined || normalizeMerchantName(lock) === merchant;
  });
  if (kept.length === card.rewards.categories.length) return card; // nothing to drop
  return { ...card, rewards: { ...card.rewards, categories: kept } };
}

/** A card, with what it would earn on the spend in question. */
export interface CardRecommendation {
  cardId: string;
  cardName: string;
  bank: string;
  /** AED earned per month on this spend (midpoint when uncertain). */
  monthlyEarningsAed: number;
  /** AED earned per year on this spend (midpoint when uncertain). */
  annualEarningsAed: number;
  /** The annual range; min === max when fully resolved. */
  annualEarningsRange: AedRange;
  /**
   * The card's annual fee. NOT deducted from the earnings above — the fee is sunk
   * for a card you already hold. Exposed so the UI can caveat an unowned suggestion.
   */
  annualFeeAed: number;
  rewardCurrency: string;
  /** Which of the card's own reward categories the spend landed on (top earner). */
  viaCardCategory: string | null;
  /** True when a rate range, soft valuation or merchant assumption makes this an estimate. */
  uncertain: boolean;
  /** Inherited flags from the scorer (caps reached, merchant assumptions, …). */
  flags: string[];
}

/** An unowned card worth acquiring — only ever produced when strictly better. */
export interface UnownedSuggestion extends CardRecommendation {
  /**
   * Annual AED earnings ABOVE the user's best owned card. Always > 0.
   *
   * SEAM — this is GROSS: the new card's annual fee is deliberately not deducted,
   * because acquiring it is the caller's decision and the fee only bites if they do.
   * `annualFeeAed` is on this object so the frontend can render the real trade-off
   * ("+900/yr, costs 262/yr"). If a net figure is ever wanted, subtract there rather
   * than baking a policy into the engine.
   */
  improvementAed: number;
}

export interface WhichCardAnswer {
  status: "ok";
  /** Echo of what was asked, for display. */
  input: string;
  resolvedVia: "category" | "merchant";
  resolvedCategory: SpendCategory;
  /** The canonical merchant matched; present only when resolved via a merchant. */
  merchant?: string;
  /** True when the merchant genuinely spans several categories (e.g. Talabat). */
  multiCategory: boolean;
  /** The other categories that merchant spans; present only when `multiCategory`. */
  alsoCovers?: SpendCategory[];
  monthlySpend: number;
  /** null when the user owns no cards, or none of them can earn here. */
  bestOwnedCard: CardRecommendation | null;
  /** Why `bestOwnedCard` is null — present only when it is. */
  noOwnedCardReason?: string;
  /** Present only when `includeUnowned` AND a strictly better card exists. */
  bestUnownedCard?: UnownedSuggestion;
}

/** The input didn't match a category or any known merchant. Not an error — a prompt. */
export interface UnrecognizedInput {
  status: "unrecognized";
  input: string;
  message: string;
  /** Offer these to the user to pick from. */
  validCategories: readonly SpendCategory[];
}

export type WhichCardResult = WhichCardAnswer | UnrecognizedInput;

export interface AskWhichCardInput {
  /** ONE term: a spend category ("groceries") or a merchant ("Carrefour"). Not a sentence. */
  merchantOrCategory: string;
  /** AED per month. Assumed finite and >= 0 (validated at the API boundary). */
  monthlySpend: number;
  /** The cards the user holds. May be empty. */
  userCards: Card[];
  /** Also look across cards the user does NOT hold, and suggest one if strictly better. */
  includeUnowned: boolean;
  /** All known cards — required only when `includeUnowned` is true. */
  allCards?: Card[];
  valuations?: ValuationTable;
}

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

function isSpendCategory(input: string): input is SpendCategory {
  return CATEGORY_SET.has(input);
}

/** Midpoint of a range — the same convention `scoreCard` uses for its ranking number. */
function midpoint(range: AedRange): number {
  return (range.min + range.max) / 2;
}

/**
 * Score ONE card against a single-category profile, via the existing scorer.
 * Returns null for a card that cannot earn here (benched, or earns nothing).
 */
function earningsFor(
  card: Card,
  category: SpendCategory,
  monthlySpend: number,
  valuations: ValuationTable,
): CardRecommendation | null {
  // A profile with exactly one category: everything else is 0 spend. This is what
  // makes the reuse exact — caps, reroutes and matching all behave as they do in a
  // full profile, just with one category present.
  const profile: SpendingProfile = { [category]: monthlySpend };
  const score = scoreCard(profile, card, valuations);

  // Benched cards carry a data defect we can't correct; they're never recommended.
  if (score.benched) return null;

  // The top-earning line of the receipt tells us which card category actually paid.
  // (There can be two: a capped bonus plus base-rate overflow.)
  const topLine = [...score.breakdown].sort(
    (a, b) => midpoint(b.annualValueAed) - midpoint(a.annualValueAed),
  )[0];

  return {
    cardId: card.id,
    cardName: card.name,
    bank: card.bank,
    monthlyEarningsAed: midpoint(score.grossAnnualValue) / 12,
    annualEarningsAed: midpoint(score.grossAnnualValue),
    annualEarningsRange: score.grossAnnualValue,
    annualFeeAed: score.fees.annualFeeAed,
    rewardCurrency: score.rewardCurrency,
    viaCardCategory: topLine?.cardCategory ?? null,
    uncertain: score.uncertain,
    flags: score.flags.map((f) => f.message),
  };
}

/**
 * Rank candidates and return the winner, or null if none can earn.
 *
 * Tie-break mirrors the optimizer's spirit, adapted to a single card and to
 * earnings-based ranking: more earnings → lower annual fee → card id (deterministic).
 * A deterministic final key matters: the same question must always give the same
 * answer, and `askWhichCard("Carrefour")` must agree with `askWhichCard("groceries")`.
 */
function pickBest(candidates: CardRecommendation[]): CardRecommendation | null {
  const earning = candidates.filter((c) => c.annualEarningsAed > 0);
  if (earning.length === 0) return null;
  return [...earning].sort(
    (a, b) =>
      b.annualEarningsAed - a.annualEarningsAed ||
      a.annualFeeAed - b.annualFeeAed ||
      a.cardId.localeCompare(b.cardId),
  )[0]!;
}

/**
 * Best card for a category among the cards the user OWNS.
 * Returns null when they own none, or none of them earns anything here.
 */
export function bestCardForCategory(
  userCards: Card[],
  category: SpendCategory,
  monthlySpend: number,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
): CardRecommendation | null {
  const scored = userCards
    .map((c) => earningsFor(c, category, monthlySpend, valuations))
    .filter((c): c is CardRecommendation => c !== null);
  return pickBest(scored);
}

/**
 * Best card for a category across ALL cards, owned or not.
 *
 * SEAM — eligibility is deliberately NOT filtered here (yet). `askWhichCard` takes no
 * salary/residency profile, so a suggestion may be a card the user can't qualify for.
 * When the frontend starts passing a profile, filter `allCards` through the
 * optimizer's existing eligibility rules BEFORE calling this — that keeps eligibility
 * logic in one place rather than growing a second copy here. Nothing in this function
 * needs to change for that.
 */
export function bestCardOverall(
  allCards: Card[],
  category: SpendCategory,
  monthlySpend: number,
  valuations: ValuationTable = DEFAULT_VALUATIONS,
): CardRecommendation | null {
  const scored = allCards
    .map((c) => earningsFor(c, category, monthlySpend, valuations))
    .filter((c): c is CardRecommendation => c !== null);
  return pickBest(scored);
}

/**
 * The entry point. Accepts a category OR a merchant name and answers with a
 * structured result for the frontend to render. The engine only computes.
 *
 * Resolution order: an exact spend category wins; otherwise we try the merchant
 * table; if neither matches we say so and offer the category list — we never guess.
 */
export function askWhichCard(input: AskWhichCardInput): WhichCardResult {
  const {
    merchantOrCategory,
    monthlySpend,
    userCards,
    includeUnowned,
    allCards = [],
    valuations = DEFAULT_VALUATIONS,
  } = input;

  const raw = typeof merchantOrCategory === "string" ? merchantOrCategory.trim() : "";
  const term = raw.toLowerCase();

  // --- Resolve the term to a category. Category first: it's the engine's own
  // vocabulary, so "groceries" must never be re-interpreted as a merchant. ---
  let resolvedCategory: SpendCategory;
  let resolvedVia: "category" | "merchant";
  let merchant: string | undefined;
  let multiCategory = false;
  let alsoCovers: SpendCategory[] | undefined;

  if (isSpendCategory(term)) {
    resolvedCategory = term;
    resolvedVia = "category";
  } else {
    const hit = resolveMerchant(raw);
    if (!hit) {
      return {
        status: "unrecognized",
        input: raw,
        message: `"${raw}" isn't a spend category or a merchant we recognise — pick a category instead.`,
        validCategories: SPEND_CATEGORIES,
      };
    }
    resolvedCategory = hit.category;
    resolvedVia = "merchant";
    merchant = hit.merchant;
    multiCategory = hit.multiCategory;
    alsoCovers = hit.alsoCovers;
  }

  // --- From here on a merchant and a category share the SAME scoring path; the only
  // difference is that a known merchant lets us drop bonuses locked to a different
  // one. So the two agree EXCEPT where a merchant-locked bonus is involved — asking
  // "Carrefour" won't credit a LuLu-only bonus, while the generic "groceries" still
  // will (flagged as an assumption, since a category can't say where you shopped). ---
  const forScoring = merchant ? userCards.map((c) => applyMerchantLocks(c, merchant)) : userCards;
  const bestOwnedCard = bestCardForCategory(forScoring, resolvedCategory, monthlySpend, valuations);

  const answer: WhichCardAnswer = {
    status: "ok",
    input: raw,
    resolvedVia,
    resolvedCategory,
    ...(merchant ? { merchant } : {}),
    multiCategory,
    ...(alsoCovers ? { alsoCovers } : {}),
    monthlySpend,
    bestOwnedCard,
  };

  if (!bestOwnedCard) {
    answer.noOwnedCardReason =
      userCards.length === 0
        ? "You haven't added any cards yet."
        : `None of your cards earns anything on ${resolvedCategory}.`;
  }

  // --- Optional upsell: only ever surfaced when strictly better. ---
  if (includeUnowned) {
    const ownedIds = new Set(userCards.map((c) => c.id));
    const allForScoring = merchant ? allCards.map((c) => applyMerchantLocks(c, merchant)) : allCards;
    const overall = bestCardOverall(allForScoring, resolvedCategory, monthlySpend, valuations);
    // Nothing to suggest if the best card is one they already hold.
    if (overall && !ownedIds.has(overall.cardId)) {
      const improvementAed = overall.annualEarningsAed - (bestOwnedCard?.annualEarningsAed ?? 0);
      // Strictly positive only: never nag about a sideways move.
      if (improvementAed > 0) {
        answer.bestUnownedCard = { ...overall, improvementAed };
      }
    }
  }

  return answer;
}
