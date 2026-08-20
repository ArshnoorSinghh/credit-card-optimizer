import { getSavedState, saveSavedState, type SavedHolding, type SavedState } from "@fils/db";
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

/** What a user with no saved row looks like. One definition, used by GET and PUT. */
const EMPTY_STATE: SavedState = {
  cardIds: [],
  spending: null,
  salaryAed: null,
  bank: null,
  pointsHoldings: [],
  cardOpenedOn: {},
};

/**
 * ISO YYYY-MM-DD, and a REAL day.
 *
 * why the round-trip rather than a bare `Date.parse`: parsing ACCEPTS a day that does
 * not exist and silently rolls it forward. "2024-02-31" parses happily and comes back
 * as 2 March, so a typo would be stored as a confident date and then drawn on the
 * calendar two days from where the user meant, with nothing showing it had moved.
 * Comparing the formatted date back to the input is what rejects it. Same rule, and the
 * same reasoning, as `isIsoDate` in apps/web/lib/profile-store.ts — this is the server
 * copy, because a client-side check is not a validation.
 */
function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === v;
}

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) return unauthorized();

  const state = (await getSavedState(user.id)) ?? EMPTY_STATE;
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

  if (b.pointsHoldings !== undefined) {
    if (!Array.isArray(b.pointsHoldings)) {
      return { ok: false, message: "`pointsHoldings` must be an array." };
    }
    const out: SavedHolding[] = [];
    for (const item of b.pointsHoldings as unknown[]) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return { ok: false, message: "Each points holding must be a JSON object." };
      }
      const h = item as Record<string, unknown>;
      if (typeof h.currency !== "string" || h.currency === "") {
        return { ok: false, message: "Each points holding needs a non-empty `currency`." };
      }
      // Rejected, not clamped: a balance we cannot trust drives a value-at-risk figure
      // on the calendar, and silently repairing it would hide that the client is wrong.
      if (typeof h.balance !== "number" || !Number.isFinite(h.balance) || h.balance < 0) {
        return {
          ok: false,
          message: `Balance for "${h.currency}" must be a non-negative finite number.`,
        };
      }
      const holding: SavedHolding = { currency: h.currency, balance: h.balance };
      if (h.expiryDate !== undefined && h.expiryDate !== null) {
        if (!isIsoDate(h.expiryDate)) {
          return {
            ok: false,
            message: `Expiry date for "${h.currency}" must be a real calendar day as YYYY-MM-DD.`,
          };
        }
        holding.expiryDate = h.expiryDate;
      }
      out.push(holding);
    }
    patch.pointsHoldings = out;
  }

  if (b.cardOpenedOn !== undefined) {
    if (typeof b.cardOpenedOn !== "object" || b.cardOpenedOn === null || Array.isArray(b.cardOpenedOn)) {
      return { ok: false, message: "`cardOpenedOn` must be an object mapping card id to YYYY-MM-DD." };
    }
    const out: Record<string, string> = {};
    for (const [cardId, v] of Object.entries(b.cardOpenedOn as Record<string, unknown>)) {
      // Same rule as cardIds above: drop ids we don't recognise rather than 400, so a
      // stale client cannot fail the whole save.
      if (!KNOWN_CARD_IDS.has(cardId)) continue;
      if (!isIsoDate(v)) {
        return {
          ok: false,
          message: `Opening date for "${cardId}" must be a real calendar day as YYYY-MM-DD.`,
        };
      }
      out[cardId] = v;
    }
    patch.cardOpenedOn = out;
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
  const state = (await getSavedState(user.id)) ?? EMPTY_STATE;
  return Response.json(state);
}
