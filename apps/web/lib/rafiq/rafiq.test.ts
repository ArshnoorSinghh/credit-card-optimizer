import { describe, it, expect } from "vitest";
import {
  askWhichCard,
  bestCardOverall,
  burnPriority,
  recommendRedemptions,
  scoreCard,
  CARDS,
  type Card,
  type PointsInventory,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";
import { runRafiq } from "./rafiq";
import { dispatchTool, type RafiqEngineContext } from "./tools";
import { GeminiError, type GeminiClient, type GeminiContent } from "./gemini";

/**
 * These tests exercise Rafiq's brain WITHOUT the network: a fake GeminiClient plays
 * back scripted model turns (a function call, then a phrased reply), and we assert
 * (a) the right engine tool ran, and (b) the data Rafiq returns is byte-for-byte the
 * engine's own output — the "Gemini never invents facts" guarantee, made testable.
 */

const ASOF = "2026-07-21";

// A fake transport that returns queued model turns in order. If the pipeline asks
// for more turns than scripted, it throws — surfacing an unexpected extra round.
function fakeClient(turns: GeminiContent[]): GeminiClient {
  let i = 0;
  return {
    async generateContent(): Promise<GeminiContent> {
      if (i >= turns.length) throw new Error(`fake client exhausted after ${turns.length} turns`);
      return turns[i++]!;
    },
  };
}

function modelCall(name: string, args: Record<string, unknown>): GeminiContent {
  return { role: "model", parts: [{ functionCall: { name, args } }] };
}
function modelText(text: string): GeminiContent {
  return { role: "model", parts: [{ text }] };
}

// A one-tool conversation: model calls a tool, then phrases the result.
function toolThenReply(name: string, args: Record<string, unknown>, reply = "Here you go."): GeminiClient {
  return fakeClient([modelCall(name, args), modelText(reply)]);
}

function ctxOf(over: Partial<RafiqEngineContext>): RafiqEngineContext {
  return { cards: CARDS, owned: [], asOf: ASOF, ...over };
}

const SPENDING: SpendingProfile = { groceries: 3000, dining: 2000, fuel: 800, other: 2000 };
const PROFILE: UserProfile = { monthlySalaryAed: 25000, uaeResident: true };
const POINTS: PointsInventory = [{ currency: "Skywards Miles", balance: 60000, earnedDate: "2025-01-01" }];

describe("routing: Rafiq calls the correct engine function", () => {
  it("'which card for groceries' -> which_card, data matches askWhichCard exactly", async () => {
    const owned = [CARDS[0]!];
    const out = await runRafiq(
      "wat card for grocerys",
      ctxOf({ owned }),
      [],
      toolThenReply("which_card", { merchantOrCategory: "groceries", monthlySpend: 3000 }),
    );
    expect(out.tool).toBe("which_card");
    // No profile in context -> includeUnowned is false, allCards empty. Mirror that.
    const expected = askWhichCard({
      merchantOrCategory: "groceries",
      monthlySpend: 3000,
      userCards: owned,
      includeUnowned: false,
      allCards: [],
    });
    expect(out.data).toEqual(expected);
    expect(out.degraded).toBe(false);
  });

  it("'which cards should I get' -> optimize_portfolio, data matches the optimizer", async () => {
    const out = await runRafiq(
      "which cards should I get?",
      ctxOf({ spending: SPENDING, profile: PROFILE }),
      [],
      toolThenReply("optimize_portfolio", {}),
    );
    expect(out.tool).toBe("optimize_portfolio");
    const data = out.data as { overallBest: { netAnnualValue: number } | null };
    expect(data.overallBest).not.toBeNull();
    expect(Number.isFinite(data.overallBest!.netAnnualValue)).toBe(true);
  });

  it("'what are my points worth' -> recommend_redemptions, totals match the engine", async () => {
    const out = await runRafiq(
      "what are my points worth?",
      ctxOf({ points: POINTS }),
      [],
      toolThenReply("recommend_redemptions", { goal: "max_value" }),
    );
    expect(out.tool).toBe("recommend_redemptions");
    const expected = recommendRedemptions(POINTS, "max_value");
    expect(out.data).toEqual(expected);
  });

  it("'what's expiring' -> burn_priority, data matches burnPriority(asOf)", async () => {
    const out = await runRafiq(
      "what's expiring soon?",
      ctxOf({ points: POINTS }),
      [],
      toolThenReply("burn_priority", {}),
    );
    expect(out.tool).toBe("burn_priority");
    expect(out.data).toEqual(burnPriority(POINTS, ASOF));
  });
});

describe("factual fidelity: comparison numbers equal the scorer", () => {
  it("compare_cards returns each card's net exactly as scoreCard computes it", async () => {
    const [a, b] = [CARDS[0]!, CARDS[1]!];
    const out = await runRafiq(
      `is ${a.name} or ${b.name} better for me?`,
      ctxOf({ spending: SPENDING, profile: PROFILE }),
      [],
      toolThenReply("compare_cards", { cards: [a.id, b.id] }),
    );
    expect(out.tool).toBe("compare_cards");
    const data = out.data as { cards: { cardId: string; netAnnualValueAed: number; netAnnualValueYear1Aed: number }[] };
    for (const scored of data.cards) {
      const card = CARDS.find((c) => c.id === scored.cardId)!;
      const truth = scoreCard(SPENDING, card);
      expect(scored.netAnnualValueAed).toBe(truth.netAnnualValue);
      expect(scored.netAnnualValueYear1Aed).toBe(truth.netAnnualValueYear1);
    }
  });

  it("comparison WITHOUT a spending profile refuses to assume — asks for it", async () => {
    // Model tries to compare; dispatch reports needsSpending; model asks (round 2).
    const client = fakeClient([
      modelCall("compare_cards", { cards: [CARDS[0]!.id, CARDS[1]!.id] }),
      modelText("What do you roughly spend each month?"),
    ]);
    const out = await runRafiq("compare these two", ctxOf({ profile: PROFILE }), [], client);
    expect(out.tool).toBe("compare_cards");
    expect(out.data).toBeNull(); // no numbers produced without spending
  });
});

describe("out-of-scope refusal", () => {
  it("answers with prose and no engine call (tool null, data null)", async () => {
    const out = await runRafiq(
      "what's the weather in Dubai?",
      ctxOf({}),
      [],
      fakeClient([modelText("I can only help with UAE credit cards and rewards.")]),
    );
    expect(out.tool).toBeNull();
    expect(out.data).toBeNull();
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.degraded).toBe(false);
  });
});

describe("graceful degradation", () => {
  it("null client (missing/invalid API key) degrades without throwing", async () => {
    const out = await runRafiq("which card for fuel?", ctxOf({}), [], null);
    expect(out.degraded).toBe(true);
    expect(out.tool).toBeNull();
    expect(out.reply.length).toBeGreaterThan(0);
  });

  it("a mid-conversation Gemini failure still returns the real engine result", async () => {
    // Model calls the tool successfully, then the phrasing call throws. We must
    // recover with a deterministic reply whose numbers are the engine's.
    let calls = 0;
    const client: GeminiClient = {
      async generateContent(): Promise<GeminiContent> {
        calls++;
        if (calls === 1) return modelCall("burn_priority", {});
        throw new GeminiError("Gemini API error 429: quota", 429, "http");
      },
    };
    const out = await runRafiq("what's expiring?", ctxOf({ points: POINTS }), [], client);
    expect(out.tool).toBe("burn_priority");
    expect(out.data).toEqual(burnPriority(POINTS, ASOF));
    expect(out.degraded).toBe(true);
    // Even though phrasing failed on a rate limit, the engine result is preserved.
    expect(out.degradedReason).toBe("rate_limited");
    expect(out.reply.length).toBeGreaterThan(0);
  });
});

describe("degradedReason classification", () => {
  // A client whose FIRST (tool-selection) call throws the given error, so there is
  // no engine result to fall back on — the path that was previously invisible.
  const throwing = (err: unknown): GeminiClient => ({
    async generateContent(): Promise<GeminiContent> {
      throw err;
    },
  });

  const run = (err: unknown) => runRafiq("which card for fuel?", ctxOf({}), [], throwing(err));

  it("missing key -> missing_key", async () => {
    const out = await runRafiq("which card for fuel?", ctxOf({}), [], null);
    expect(out.degradedReason).toBe("missing_key");
  });

  it("HTTP 429 -> rate_limited", async () => {
    const out = await run(new GeminiError("Gemini API error 429: quota, limit 0", 429, "http"));
    expect(out.degraded).toBe(true);
    expect(out.degradedReason).toBe("rate_limited");
  });

  it("HTTP 400/404 -> model_error", async () => {
    expect((await run(new GeminiError("bad request", 400, "http"))).degradedReason).toBe("model_error");
    expect((await run(new GeminiError("not found", 404, "http"))).degradedReason).toBe("model_error");
  });

  it("timeout -> timeout", async () => {
    const out = await run(new GeminiError("timed out after 12000ms", undefined, "timeout"));
    expect(out.degradedReason).toBe("timeout");
  });

  it("network failure -> network_error", async () => {
    const out = await run(new GeminiError("fetch failed", undefined, "network"));
    expect(out.degradedReason).toBe("network_error");
  });

  it("empty/blocked content -> model_error", async () => {
    const out = await run(new GeminiError("no content (blocked: SAFETY)", undefined, "empty"));
    expect(out.degradedReason).toBe("model_error");
  });

  it("an unexpected non-Gemini error still classifies as model_error, never throws", async () => {
    const out = await run(new Error("something odd"));
    expect(out.degraded).toBe(true);
    expect(out.degradedReason).toBe("model_error");
  });

  it("a successful turn carries no degradedReason", async () => {
    const out = await runRafiq(
      "which card for groceries?",
      ctxOf({ owned: [] }),
      [],
      toolThenReply("which_card", { category: "groceries" }),
    );
    expect(out.degraded).toBe(false);
    expect(out.degradedReason).toBeUndefined();
  });
});

// ── Proactive suggestions + eligibility (tested at the pure dispatch layer) ───────

function isEligible(card: Card, profile: UserProfile): boolean {
  if (card.excluded_from_scoring) return false;
  const e = card.eligibility;
  return profile.monthlySalaryAed >= e.min_monthly_salary_aed && (!e.uae_resident_required || profile.uaeResident);
}

describe("proactive suggestions", () => {
  it("surfaces a strictly-positive improvement and only an eligible card", () => {
    // User owns nothing -> the best eligible grocery card is a genuine improvement.
    const res = dispatchTool(
      "which_card",
      { merchantOrCategory: "groceries", monthlySpend: 3000 },
      ctxOf({ owned: [], profile: PROFILE }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.suggestion).toBeDefined();
    expect(res.suggestion!.improvementAedPerYear).toBeGreaterThan(0);
    // The suggested card must pass the eligibility filter for this profile.
    const suggested = CARDS.find((c) => c.id === res.suggestion!.cardId)!;
    expect(isEligible(suggested, PROFILE)).toBe(true);
  });

  it("makes NO suggestion when the user already holds the best card (no positive delta)", () => {
    const best = bestCardOverall(
      CARDS.filter((c) => isEligible(c, PROFILE)),
      "groceries",
      3000,
    )!;
    const owned = [CARDS.find((c) => c.id === best.cardId)!];
    const res = dispatchTool(
      "which_card",
      { merchantOrCategory: "groceries", monthlySpend: 3000 },
      ctxOf({ owned, profile: PROFILE }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.suggestion).toBeUndefined();
  });

  it("never suggests an unowned card when no profile is present (can't verify eligibility)", () => {
    const res = dispatchTool(
      "which_card",
      { merchantOrCategory: "groceries", monthlySpend: 3000 },
      ctxOf({ owned: [] }), // no profile
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.suggestion).toBeUndefined();
  });
});
