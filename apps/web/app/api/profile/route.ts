import { getSavedState, saveSavedState, type SavedState } from "@fils/db";
import { SPEND_CATEGORIES } from "@fils/engine";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ALL_CARDS } from "@/lib/cards";

/**
 * The signed-in user's saved wallet + spending profile.
 *
 * PROTECTED, like /api/me: guests never call this (the client keeps their state in
 * sessionStorage). GET returns the persisted state; PUT persists any subset of it.
 * All validation happens here against the engine's category set and the known card
 * ids, so the database layer stays a generic store and can't be fed junk.
 */

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);
const KNOWN_CARD_IDS = new Set(ALL_CARDS.map((c) => c.id));

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) return unauthorized();

  const state = (await getSavedState(user.id)) ?? {
    cardIds: [],
    spending: null,
    salaryAed: null,
    bank: null,
  };
  return Response.json(state);
}

/** Validate + narrow a PUT body into a SavedState patch. Unknown fields are ignored. */
function parsePatch(body: unknown): { ok: true; patch: Partial<SavedState> } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const patch: Partial<SavedState> = {};

  if (b.cardIds !== undefined) {
    if (!Array.isArray(b.cardIds) || !b.cardIds.every((x) => typeof x === "string")) {
      return { ok: false, message: "`cardIds` must be an array of card id strings." };
    }
    // Silently drop ids we don't recognise rather than 400 — a stale client shouldn't
    // fail the whole save, and we never want to persist an id the engine can't score.
    patch.cardIds = (b.cardIds as string[]).filter((id) => KNOWN_CARD_IDS.has(id));
  }

  if (b.spending !== undefined) {
    if (b.spending === null) {
      patch.spending = null;
    } else if (typeof b.spending !== "object" || Array.isArray(b.spending)) {
      return { ok: false, message: "`spending` must be an object mapping category to AED/month." };
    } else {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.spending as Record<string, unknown>)) {
        if (!CATEGORY_SET.has(k)) return { ok: false, message: `Unknown spending category "${k}".` };
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
          return { ok: false, message: `Spending for "${k}" must be a non-negative finite number.` };
        }
        out[k] = v;
      }
      patch.spending = out;
    }
  }

  if (b.salaryAed !== undefined && b.salaryAed !== null) {
    if (typeof b.salaryAed !== "number" || !Number.isFinite(b.salaryAed) || b.salaryAed < 0) {
      return { ok: false, message: "`salaryAed` must be a non-negative finite number." };
    }
    patch.salaryAed = Math.round(b.salaryAed);
  }

  if (b.bank !== undefined) {
    if (b.bank !== null && typeof b.bank !== "string") {
      return { ok: false, message: "`bank` must be a string or null." };
    }
    patch.bank = b.bank as string | null;
  }

  return { ok: true, patch };
}

export async function PUT(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body is not valid JSON." }, { status: 400 });
  }

  const parsed = parsePatch(body);
  if (!parsed.ok) return Response.json({ error: parsed.message }, { status: 400 });

  await saveSavedState(user.id, parsed.patch);
  const state = (await getSavedState(user.id)) ?? { cardIds: [], spending: null, salaryAed: null, bank: null };
  return Response.json(state);
}
