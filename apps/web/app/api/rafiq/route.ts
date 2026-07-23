import { getAllCards } from "@fils/db";
import {
  SPEND_CATEGORIES,
  type Card,
  type PointsHolding,
  type PointsInventory,
  type SpendCategory,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";
import type { RafiqContext, RafiqError, RafiqResponse, RafiqTurn } from "@/lib/rafiq/contract";
import { createGeminiClient, type GeminiClient } from "@/lib/rafiq/gemini";
import { runRafiq } from "@/lib/rafiq/rafiq";
import type { RafiqEngineContext } from "@/lib/rafiq/tools";

/**
 * POST /api/rafiq — the AI chat assistant.
 *
 * This route is the HTTP boundary: it validates the request, loads the card
 * universe from Postgres (the engine never fetches — same rule as /api/optimize),
 * resolves the user's owned cards, builds the Gemini client from the SERVER-ONLY
 * GEMINI_API_KEY, and hands everything to the orchestrator. Rafiq being down never
 * takes the route down: runRafiq degrades gracefully and we always return 200.
 *
 * The route stays PUBLIC (guest/demo mode) — like /api/optimize, it asks for no
 * user. Context (cards/spending/points) arrives in the request body from the client.
 */

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 20;

type ValidatedContext = {
  ownedCardIds: string[];
  spending?: SpendingProfile;
  profile?: UserProfile;
  points?: PointsInventory;
};

type Validation =
  | { ok: true; message: string; context: ValidatedContext; history: RafiqTurn[] }
  | { ok: false; message: string };

/** Validate spending: { category: aedPerMonth }. Returns undefined for absent/empty. */
function parseSpending(raw: unknown): { ok: true; value?: SpendingProfile } | { ok: false; message: string } {
  if (raw == null) return { ok: true };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "`context.spending` must be an object mapping category -> AED/month." };
  }
  const out: SpendingProfile = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!CATEGORY_SET.has(key)) {
      return { ok: false, message: `Unknown spending category "${key}".` };
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { ok: false, message: `Spending for "${key}" must be a non-negative finite number.` };
    }
    out[key as SpendCategory] = v;
  }
  return { ok: true, value: out };
}

/** Validate the eligibility profile. Returns undefined when absent. */
function parseProfile(raw: unknown): { ok: true; value?: UserProfile } | { ok: false; message: string } {
  if (raw == null) return { ok: true };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "`context.profile` must be an object with monthlySalaryAed and uaeResident." };
  }
  const { monthlySalaryAed, uaeResident } = raw as Record<string, unknown>;
  if (typeof monthlySalaryAed !== "number" || !Number.isFinite(monthlySalaryAed) || monthlySalaryAed < 0) {
    return { ok: false, message: "`context.profile.monthlySalaryAed` must be a non-negative finite number." };
  }
  if (typeof uaeResident !== "boolean") {
    return { ok: false, message: "`context.profile.uaeResident` must be a boolean." };
  }
  return { ok: true, value: { monthlySalaryAed, uaeResident } };
}

/** Validate the points inventory. Returns undefined when absent. */
function parsePoints(raw: unknown): { ok: true; value?: PointsInventory } | { ok: false; message: string } {
  if (raw == null) return { ok: true };
  if (!Array.isArray(raw)) return { ok: false, message: "`context.points` must be an array of holdings." };
  const out: PointsHolding[] = [];
  for (const h of raw) {
    if (typeof h !== "object" || h === null) return { ok: false, message: "Each points holding must be an object." };
    const { currency, balance, expiryDate, earnedDate } = h as Record<string, unknown>;
    if (typeof currency !== "string" || currency.trim() === "") {
      return { ok: false, message: "Each points holding needs a non-empty `currency` string." };
    }
    if (typeof balance !== "number" || !Number.isFinite(balance) || balance < 0) {
      return { ok: false, message: `Balance for "${currency}" must be a non-negative finite number.` };
    }
    const holding: PointsHolding = { currency, balance };
    if (typeof expiryDate === "string") holding.expiryDate = expiryDate;
    if (typeof earnedDate === "string") holding.earnedDate = earnedDate;
    out.push(holding);
  }
  return { ok: true, value: out };
}

function parseHistory(raw: unknown): { ok: true; value: RafiqTurn[] } | { ok: false; message: string } {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, message: "`history` must be an array of turns." };
  const out: RafiqTurn[] = [];
  for (const t of raw.slice(-MAX_HISTORY_TURNS)) {
    if (typeof t !== "object" || t === null) return { ok: false, message: "Each history turn must be an object." };
    const { role, text } = t as Record<string, unknown>;
    if (role !== "user" && role !== "model") return { ok: false, message: "History `role` must be 'user' or 'model'." };
    if (typeof text !== "string") return { ok: false, message: "History `text` must be a string." };
    out.push({ role, text });
  }
  return { ok: true, value: out };
}

function validateBody(body: unknown): Validation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const { message, context, history } = body as Record<string, unknown>;

  if (typeof message !== "string" || message.trim() === "") {
    return { ok: false, message: "`message` must be a non-empty string." };
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, message: `\`message\` must be at most ${MAX_MESSAGE_CHARS} characters.` };
  }

  const ctxObj = (context ?? {}) as Record<string, unknown>;
  if (typeof ctxObj !== "object" || Array.isArray(ctxObj)) {
    return { ok: false, message: "`context` must be an object." };
  }

  const ownedRaw = (ctxObj as { ownedCardIds?: unknown }).ownedCardIds;
  let ownedCardIds: string[] = [];
  if (ownedRaw != null) {
    if (!Array.isArray(ownedRaw) || !ownedRaw.every((x) => typeof x === "string")) {
      return { ok: false, message: "`context.ownedCardIds` must be an array of card id strings." };
    }
    ownedCardIds = ownedRaw as string[];
  }

  const spending = parseSpending((ctxObj as RafiqContext).spending);
  if (!spending.ok) return spending;
  const profile = parseProfile((ctxObj as RafiqContext).profile);
  if (!profile.ok) return profile;
  const points = parsePoints((ctxObj as RafiqContext).points);
  if (!points.ok) return points;
  const hist = parseHistory(history);
  if (!hist.ok) return hist;

  return {
    ok: true,
    message: message.trim(),
    context: { ownedCardIds, spending: spending.value, profile: profile.value, points: points.value },
    history: hist.value,
  };
}

function badRequest(message: string): Response {
  const body: RafiqError = { error: message };
  return Response.json(body, { status: 400 });
}

/** Build a Gemini client from the server-only key, or null when it's missing. */
function geminiClientFromEnv(): GeminiClient | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === "") return null;
  return createGeminiClient(key, process.env.GEMINI_MODEL);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body is not valid JSON.");
  }

  const validated = validateBody(body);
  if (!validated.ok) return badRequest(validated.message);

  // Load the card universe from Postgres, then resolve the user's owned cards.
  const cards = await getAllCards();
  const byId = new Map<string, Card>(cards.map((c) => [c.id, c]));
  const owned = validated.context.ownedCardIds
    .map((id) => byId.get(id))
    .filter((c): c is Card => c !== undefined);

  const ctx: RafiqEngineContext = {
    cards,
    owned,
    spending: validated.context.spending,
    profile: validated.context.profile,
    points: validated.context.points,
    // Inject "today" so the burn engine stays a pure function of its inputs.
    asOf: new Date().toISOString().slice(0, 10),
  };

  const outcome = await runRafiq(validated.message, ctx, validated.history, geminiClientFromEnv());

  const response: RafiqResponse = {
    reply: outcome.reply,
    tool: outcome.tool,
    data: outcome.data,
    degraded: outcome.degraded,
    ...(outcome.degradedReason ? { degradedReason: outcome.degradedReason } : {}),
  };
  return Response.json(response);
}
