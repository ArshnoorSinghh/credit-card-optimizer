/**
 * Rafiq's tool layer — the ONLY bridge between the language model and the engine.
 *
 * ── The non-negotiable rule ─────────────────────────────────────────────────────
 * Gemini is the translator and mouth; the engine is the brain. Gemini decides
 * WHICH of these tools to call and with WHAT arguments; this file EXECUTES the real
 * engine call and returns the real result. Gemini never produces a card fact, rate,
 * fee, cap, or point value on its own — every number a user sees originates from a
 * `dispatchTool` return value here.
 *
 * This module imports the engine and is a pure function of its inputs. It does NOT
 * import Gemini or do any network I/O — that lives in gemini.ts / rafiq.ts. Keeping
 * the dispatcher Gemini-free is what lets us test "the right engine function is
 * called with the right args, and the numbers match" without touching the model.
 */

import {
  askWhichCard,
  burnPriority,
  optimizePortfolio,
  recommendRedemptions,
  scoreCard,
  SPEND_CATEGORIES,
  type Card,
  type PointsInventory,
  type RedemptionGoal,
  type SpendCategory,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";

// ── Context the dispatcher needs (assembled by the route from request + DB) ──────

export interface RafiqEngineContext {
  /** The full card universe (from the database). Needed for suggestions + comparison. */
  cards: Card[];
  /** The cards the user owns (resolved from ids). May be empty. */
  owned: Card[];
  spending?: SpendingProfile;
  profile?: UserProfile;
  points?: PointsInventory;
  /** Today, as ISO YYYY-MM-DD — injected so the burn engine stays pure. */
  asOf: string;
}

/** A brief, non-pushy upsell surfaced only when the engine proves a positive delta. */
export interface ProactiveSuggestion {
  message: string;
  cardId: string;
  cardName: string;
  improvementAedPerYear: number;
  annualFeeAed: number;
}

export type DispatchResult =
  | {
      ok: true;
      tool: string;
      /** The RAW engine result, verbatim — the authoritative data the UI renders. */
      data: unknown;
      /** A compact, rounded summary handed to Gemini to phrase from (never the exact data). */
      forModel: unknown;
      suggestion?: ProactiveSuggestion;
    }
  | {
      ok: false;
      tool: string;
      data: null;
      /** Why we couldn't answer — handed to Gemini so it asks or refuses in its own words. */
      forModel: unknown;
    };

// When the user asks "which card for X?" but never says how much they spend, the
// engine still needs a number. Best-card identity is largely stable across amounts,
// so we score a representative basket and FLAG the assumption for the reply to caveat.
// why not silently pick their profile total: that would attribute all spend to one
// category and mislead on caps. A flagged flat assumption is the honest default.
const ASSUMED_MONTHLY_SPEND = 2000;

// ── Eligibility (mirrors optimizePortfolio's filter) ─────────────────────────────
// why replicated here rather than imported: the engine applies this filter INSIDE
// optimizePortfolio and exports no standalone predicate. which-card.ts explicitly
// invites the caller to "filter allCards through the optimizer's existing
// eligibility rules BEFORE calling this" (its SEAM comment). We honour that here so
// a suggested card is one the user can actually get. Kept tiny and adjacent to the
// engine types so drift is obvious.
function isEligible(card: Card, profile: UserProfile): boolean {
  if (card.excluded_from_scoring) return false;
  const e = card.eligibility;
  const salaryOk = profile.monthlySalaryAed >= e.min_monthly_salary_aed;
  const residencyOk = !e.uae_resident_required || profile.uaeResident;
  return salaryOk && residencyOk;
}

function hasSpending(spending?: SpendingProfile): spending is SpendingProfile {
  return spending != null && Object.values(spending).some((v) => (v ?? 0) > 0);
}

function round(n: number): number {
  return Math.round(n);
}

// ─────────────────────────────────────────────────────────────────────────────────
// Tool: which_card  →  askWhichCard
// ─────────────────────────────────────────────────────────────────────────────────

function toolWhichCard(args: Record<string, unknown>, ctx: RafiqEngineContext): DispatchResult {
  const term = typeof args.merchantOrCategory === "string" ? args.merchantOrCategory.trim() : "";
  if (!term) {
    return {
      ok: false,
      tool: "which_card",
      data: null,
      forModel: { error: "No category or merchant given. Ask the user what they're buying." },
    };
  }

  const rawSpend =
    typeof args.monthlySpend === "number" && Number.isFinite(args.monthlySpend) && args.monthlySpend > 0
      ? args.monthlySpend
      : undefined;
  const monthlySpend = rawSpend ?? ASSUMED_MONTHLY_SPEND;
  const assumedSpend = rawSpend === undefined;

  // We only look across UNOWNED cards to suggest one when we have a profile to check
  // eligibility with — never suggest a card the user can't get. No profile => no upsell.
  const canSuggest = ctx.profile != null;
  const eligibleUniverse = canSuggest ? ctx.cards.filter((c) => isEligible(c, ctx.profile!)) : [];

  const result = askWhichCard({
    merchantOrCategory: term,
    monthlySpend,
    userCards: ctx.owned,
    includeUnowned: canSuggest,
    allCards: eligibleUniverse,
  });

  if (result.status === "unrecognized") {
    return {
      ok: false,
      tool: "which_card",
      data: null,
      forModel: {
        unrecognized: true,
        message: result.message,
        validCategories: result.validCategories,
        hint: "Ask the user to pick one of these categories, or name a known merchant.",
      },
    };
  }

  const best = result.bestOwnedCard;
  const unowned = result.bestUnownedCard;

  const suggestion: ProactiveSuggestion | undefined = unowned
    ? {
        message: `${unowned.cardName} would earn about ${round(
          unowned.improvementAed,
        )} AED/year more here than your best current card (annual fee ${round(unowned.annualFeeAed)} AED).`,
        cardId: unowned.cardId,
        cardName: unowned.cardName,
        improvementAedPerYear: round(unowned.improvementAed),
        annualFeeAed: round(unowned.annualFeeAed),
      }
    : undefined;

  const forModel = {
    input: result.input,
    resolvedVia: result.resolvedVia,
    category: result.resolvedCategory,
    merchant: result.merchant ?? null,
    multiCategory: result.multiCategory,
    alsoCovers: result.alsoCovers ?? null,
    monthlySpend,
    assumedSpend,
    bestOwnedCard: best
      ? {
          cardName: best.cardName,
          bank: best.bank,
          monthlyEarningsAed: round(best.monthlyEarningsAed),
          annualEarningsAed: round(best.annualEarningsAed),
          rewardCurrency: best.rewardCurrency,
          uncertain: best.uncertain,
        }
      : null,
    noOwnedCardReason: result.noOwnedCardReason ?? null,
    suggestion: suggestion ?? null,
  };

  return { ok: true, tool: "which_card", data: result, forModel, suggestion };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Tool: optimize_portfolio  →  optimizePortfolio
// ─────────────────────────────────────────────────────────────────────────────────

function toolOptimizePortfolio(args: Record<string, unknown>, ctx: RafiqEngineContext): DispatchResult {
  if (!hasSpending(ctx.spending)) {
    return {
      ok: false,
      tool: "optimize_portfolio",
      data: null,
      forModel: {
        needsSpending: true,
        message: "No spending profile on file. Ask the user roughly how much they spend per month by category.",
      },
    };
  }
  if (!ctx.profile) {
    return {
      ok: false,
      tool: "optimize_portfolio",
      data: null,
      forModel: {
        needsProfile: true,
        message: "No salary/residency on file. Ask the user their monthly salary and whether they're a UAE resident.",
      },
    };
  }

  const maxCards =
    args.maxCards === 1 || args.maxCards === 2 || args.maxCards === 3 ? (args.maxCards as 1 | 2 | 3) : 3;

  const result = optimizePortfolio(ctx.spending, ctx.profile, ctx.cards, undefined, { maxCards });
  const best = result.overallBest;

  const forModel = {
    eligibleCardCount: result.eligibleCardCount,
    totalCardCount: result.totalCardCount,
    recommended: best
      ? {
          size: best.size,
          cardIds: best.cardIds,
          netAnnualValueAed: round(best.netAnnualValue),
          netAnnualValueYear1Aed: round(best.netAnnualValueYear1),
          totalFeesOngoingAed: round(best.totalFees.ongoing),
          totalFeesYear1Aed: round(best.totalFees.year1),
          uncertain: best.uncertain,
          // A human-facing name list so the model never has to invent one from an id.
          cardNames: best.cardIds.map((id) => ctx.cards.find((c) => c.id === id)?.name ?? id),
        }
      : null,
  };

  return { ok: true, tool: "optimize_portfolio", data: result, forModel };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Tool: recommend_redemptions  →  recommendRedemptions
// ─────────────────────────────────────────────────────────────────────────────────

const REDEMPTION_GOALS: readonly RedemptionGoal[] = ["flights", "hotels", "max_value", "cash_equivalent"];

function toolRecommendRedemptions(args: Record<string, unknown>, ctx: RafiqEngineContext): DispatchResult {
  if (!ctx.points || ctx.points.length === 0) {
    return {
      ok: false,
      tool: "recommend_redemptions",
      data: null,
      forModel: {
        needsPoints: true,
        message: "No points inventory on file. Ask the user which reward currencies they hold and how many points.",
      },
    };
  }

  const goal: RedemptionGoal = REDEMPTION_GOALS.includes(args.goal as RedemptionGoal)
    ? (args.goal as RedemptionGoal)
    : "max_value";

  const premiumMultiplier =
    typeof args.premiumMultiplier === "number" && Number.isFinite(args.premiumMultiplier) && args.premiumMultiplier > 0
      ? args.premiumMultiplier
      : undefined;

  const result = recommendRedemptions(ctx.points, goal, undefined, undefined, { premiumMultiplier });

  const forModel = {
    goal: result.goal,
    totalAed: round(result.totalAed),
    suggestions: result.suggestions.map((s) => ({
      currency: s.currency,
      balance: s.balance,
      receipt: s.receipt,
      bestAedValue: s.best ? round(s.best.aedValue) : null,
      flags: s.flags,
    })),
  };

  return { ok: true, tool: "recommend_redemptions", data: result, forModel };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Tool: burn_priority  →  burnPriority
// ─────────────────────────────────────────────────────────────────────────────────

function toolBurnPriority(_args: Record<string, unknown>, ctx: RafiqEngineContext): DispatchResult {
  if (!ctx.points || ctx.points.length === 0) {
    return {
      ok: false,
      tool: "burn_priority",
      data: null,
      forModel: {
        needsPoints: true,
        message: "No points inventory on file. Ask the user which reward currencies they hold and how many points.",
      },
    };
  }

  const result = burnPriority(ctx.points, ctx.asOf);

  const forModel = {
    asOf: result.asOf,
    items: result.items.map((i) => ({
      currency: i.currency,
      balance: i.balance,
      urgency: i.urgency,
      expiryDate: i.expiryDate ?? null,
      daysToExpiry: i.daysToExpiry ?? null,
      valueAtRiskAed: round(i.valueAtRiskAed),
      devaluationWarning: i.devaluationWarning ?? null,
    })),
  };

  return { ok: true, tool: "burn_priority", data: result, forModel };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Tool: compare_cards  →  scoreCard per card, personalized to the user's spending
// ─────────────────────────────────────────────────────────────────────────────────

/** Resolve a free-text card reference ("the FAB one", "Emirates NBD Skywards") to a card. */
function resolveCard(query: string, cards: Card[]): { card: Card } | { error: "unknown" | "ambiguous"; options: string[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { error: "unknown", options: [] };

  const byId = cards.find((c) => c.id.toLowerCase() === q);
  if (byId) return { card: byId };
  const byName = cards.find((c) => c.name.toLowerCase() === q);
  if (byName) return { card: byName };

  const contains = cards.filter((c) => `${c.name} ${c.bank}`.toLowerCase().includes(q));
  if (contains.length === 1) return { card: contains[0]! };
  if (contains.length > 1) return { error: "ambiguous", options: contains.slice(0, 6).map((c) => c.name) };
  return { error: "unknown", options: [] };
}

/** Aggregate a CardScore's per-line breakdown into AED/year by canonical spend category. */
function earningsByCategory(breakdown: ReturnType<typeof scoreCard>["breakdown"]): Partial<Record<SpendCategory, number>> {
  const out: Partial<Record<SpendCategory, number>> = {};
  for (const line of breakdown) {
    const mid = (line.annualValueAed.min + line.annualValueAed.max) / 2;
    // A line can serve several spend categories; attribute its value to each it names.
    for (const cat of line.spendCategories) {
      out[cat] = (out[cat] ?? 0) + mid;
    }
  }
  return out;
}

function toolCompareCards(args: Record<string, unknown>, ctx: RafiqEngineContext): DispatchResult {
  // A personalized comparison is meaningless without spending — refuse to assume it.
  if (!hasSpending(ctx.spending)) {
    return {
      ok: false,
      tool: "compare_cards",
      data: null,
      forModel: {
        needsSpending: true,
        message:
          "Comparison must be personalized to spending, and none is on file. Ask the user for their monthly spend by category before comparing. Do not assume it.",
      },
    };
  }

  const rawList = Array.isArray(args.cards) ? args.cards : [];
  const queries = rawList.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
  if (queries.length < 2) {
    return {
      ok: false,
      tool: "compare_cards",
      data: null,
      forModel: { message: "Need at least two specific cards to compare. Ask the user which cards they mean." },
    };
  }

  const resolved: Card[] = [];
  const unknown: string[] = [];
  const ambiguous: { query: string; options: string[] }[] = [];
  for (const q of queries) {
    const r = resolveCard(q, ctx.cards);
    if ("card" in r) resolved.push(r.card);
    else if (r.error === "ambiguous") ambiguous.push({ query: q, options: r.options });
    else unknown.push(q);
  }

  if (unknown.length > 0) {
    return {
      ok: false,
      tool: "compare_cards",
      data: null,
      forModel: {
        unknownCards: unknown,
        message: `No data on: ${unknown.join(", ")}. Tell the user those cards aren't in our dataset.`,
      },
    };
  }
  if (ambiguous.length > 0) {
    return {
      ok: false,
      tool: "compare_cards",
      data: null,
      forModel: { ambiguous, message: "Some card names matched several cards. Ask the user to be more specific." },
    };
  }

  const spending = ctx.spending;
  const scored = resolved.map((card) => {
    const score = scoreCard(spending, card);
    return {
      cardId: card.id,
      cardName: card.name,
      bank: card.bank,
      netAnnualValueAed: score.netAnnualValue,
      netAnnualValueYear1Aed: score.netAnnualValueYear1,
      grossAnnualValueAed: (score.grossAnnualValue.min + score.grossAnnualValue.max) / 2,
      annualFeeAed: score.fees.annualFeeAed,
      year1FeeAed: score.fees.year1FeeAed,
      ongoingFeeAed: score.fees.ongoingFeeAed,
      rewardCurrency: score.rewardCurrency,
      uncertain: score.uncertain,
      earningsByCategory: earningsByCategory(score.breakdown),
    };
  });

  // Rank by ongoing net value (fees included, the honest "which is better for YOU").
  const rankedOngoing = [...scored].sort((a, b) => b.netAnnualValueAed - a.netAnnualValueAed);
  const rankedYear1 = [...scored].sort((a, b) => b.netAnnualValueYear1Aed - a.netAnnualValueYear1Aed);
  const winnerOngoing = rankedOngoing[0]!;
  const winnerYear1 = rankedYear1[0]!;

  // Per-category deltas between the top two (where a comparison is most legible).
  const categoryDeltas: { category: SpendCategory; byCard: Record<string, number> }[] = [];
  for (const cat of SPEND_CATEGORIES) {
    const byCard: Record<string, number> = {};
    let anyNonZero = false;
    for (const s of scored) {
      const v = s.earningsByCategory[cat] ?? 0;
      byCard[s.cardName] = round(v);
      if (v > 0) anyNonZero = true;
    }
    if (anyNonZero) categoryDeltas.push({ category: cat, byCard });
  }

  const data = {
    cards: scored,
    winnerOngoing: winnerOngoing.cardName,
    winnerYear1: winnerYear1.cardName,
    ongoingDeltaAed: round(winnerOngoing.netAnnualValueAed - (rankedOngoing[1]?.netAnnualValueAed ?? 0)),
    year1DeltaAed: round(winnerYear1.netAnnualValueYear1Aed - (rankedYear1[1]?.netAnnualValueYear1Aed ?? 0)),
    // Surface the year1-vs-ongoing split so the reply can flag fee-waiver effects.
    winnerDiffersYear1VsOngoing: winnerYear1.cardName !== winnerOngoing.cardName,
    categoryDeltas,
  };

  const forModel = {
    winnerOngoing: data.winnerOngoing,
    winnerYear1: data.winnerYear1,
    ongoingDeltaAed: data.ongoingDeltaAed,
    year1DeltaAed: data.year1DeltaAed,
    winnerDiffersYear1VsOngoing: data.winnerDiffersYear1VsOngoing,
    cards: scored.map((s) => ({
      cardName: s.cardName,
      netAnnualValueAed: round(s.netAnnualValueAed),
      netAnnualValueYear1Aed: round(s.netAnnualValueYear1Aed),
      annualFeeAed: round(s.annualFeeAed),
      uncertain: s.uncertain,
    })),
    categoryDeltas: data.categoryDeltas,
  };

  return { ok: true, tool: "compare_cards", data, forModel };
}

// ── Public dispatch + declarations ───────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>, ctx: RafiqEngineContext) => DispatchResult;

const HANDLERS: Record<string, ToolHandler> = {
  which_card: toolWhichCard,
  optimize_portfolio: toolOptimizePortfolio,
  recommend_redemptions: toolRecommendRedemptions,
  burn_priority: toolBurnPriority,
  compare_cards: toolCompareCards,
};

/** Execute the engine call Gemini selected. Unknown tool names fail closed. */
export function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ctx: RafiqEngineContext,
): DispatchResult {
  const handler = HANDLERS[name];
  if (!handler) {
    return {
      ok: false,
      tool: name,
      data: null,
      forModel: { error: `Unknown tool "${name}". Do not answer from your own knowledge; ask the user to rephrase.` },
    };
  }
  return handler(args, ctx);
}

export const TOOL_NAMES = Object.keys(HANDLERS);

/**
 * Gemini function declarations. These are the ONLY actions Rafiq can take. The
 * descriptions steer routing; the parameter schemas constrain what Gemini may pass.
 * Uppercase `type` values match the Gemini REST Schema enum.
 */
export const TOOL_DECLARATIONS = [
  {
    name: "which_card",
    description:
      "Recommend which of the user's cards to USE for a specific purchase. Handles a spend category (groceries, dining, fuel, utilities, education, travel, transport, entertainment, international, other) OR a merchant name (Carrefour, Talabat, ADNOC, Emirates, ...). Use for 'which card should I use for X', 'best card for <merchant>'. Tolerate typos and informal phrasing, and map them to the right category or merchant.",
    parameters: {
      type: "OBJECT",
      properties: {
        merchantOrCategory: {
          type: "STRING",
          description: "One spend category or one merchant name. Normalize typos (e.g. 'carefour' -> 'Carrefour').",
        },
        monthlySpend: {
          type: "NUMBER",
          description: "AED per month on this, if the user stated or implied an amount. Omit if unknown.",
        },
      },
      required: ["merchantOrCategory"],
    },
  },
  {
    name: "optimize_portfolio",
    description:
      "Recommend the best 1-, 2-, or 3-card portfolio to HOLD for the user's overall spending. Use for 'which cards should I get', 'what's the best card combination for me'. Uses the spending + salary profile already in context.",
    parameters: {
      type: "OBJECT",
      properties: {
        maxCards: { type: "NUMBER", description: "Largest portfolio size to consider (1, 2, or 3). Default 3." },
      },
    },
  },
  {
    name: "recommend_redemptions",
    description:
      "Given the user's points inventory, recommend how to redeem for the best value. Use for 'what are my points worth', 'how should I redeem', 'best use of my miles'. Uses the points inventory in context.",
    parameters: {
      type: "OBJECT",
      properties: {
        goal: {
          type: "STRING",
          description: "What the user wants: 'flights', 'hotels', 'cash_equivalent' (statement credit / bills), or 'max_value'. Default 'max_value'.",
        },
      },
    },
  },
  {
    name: "burn_priority",
    description:
      "Rank the user's points by how urgently they should be spent before expiring or devaluing. Use for 'what's expiring', 'which points should I use first', 'should I convert before they expire'. Uses the points inventory in context.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "compare_cards",
    description:
      "Compare two or more SPECIFIC named cards for THIS user, scored against their spending. Use for 'is card A or card B better for me', 'compare X and Y'. Requires a spending profile in context.",
    parameters: {
      type: "OBJECT",
      properties: {
        cards: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "The card names or ids to compare (two or more).",
        },
      },
      required: ["cards"],
    },
  },
] as const;
