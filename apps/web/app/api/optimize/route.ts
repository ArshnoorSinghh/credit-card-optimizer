import {
  optimizePortfolio,
  SPEND_CATEGORIES,
  type MerchantShares,
  type SpendCategory,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";
import { getAllCards } from "@fils/db";
import type { OptimizeError, OptimizeResponse } from "@/lib/optimize-contract";

// Cards come from Postgres via @fils/db — the single place card data is loaded.
// The engine receives a plain Card[] and neither knows nor cares where it came
// from: it stays a pure calculator with no database access. Dependency arrows point
// one way (web -> db -> engine types), so the engine never imports @fils/db.

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

type Validated = {
  spending: SpendingProfile;
  profile: UserProfile;
  merchantShares: MerchantShares | undefined;
};
type ValidationResult = { ok: true; value: Validated } | { ok: false; message: string };

/**
 * Validate the request body at the boundary (CLAUDE.md: validate at every
 * boundary). Rejects non-objects, unknown category keys, non-finite/negative
 * spending, and missing/wrong-typed profile fields — always a clear 400, never a
 * crash. Returns a value with only known-good, typed fields.
 */
function validateBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const { spending, profile, merchantShares } = body as Record<string, unknown>;

  // --- spending: { category: aedPerMonth } ---
  if (typeof spending !== "object" || spending === null || Array.isArray(spending)) {
    return { ok: false, message: "`spending` must be an object mapping category → AED/month." };
  }
  const spendingOut: SpendingProfile = {};
  for (const [key, raw] of Object.entries(spending as Record<string, unknown>)) {
    if (!CATEGORY_SET.has(key)) {
      return {
        ok: false,
        message: `Unknown spending category "${key}". Valid categories: ${SPEND_CATEGORIES.join(", ")}.`,
      };
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return { ok: false, message: `Spending for "${key}" must be a finite number (AED/month).` };
    }
    if (raw < 0) {
      return { ok: false, message: `Spending for "${key}" cannot be negative.` };
    }
    spendingOut[key as SpendCategory] = raw;
  }

  // --- profile: { monthlySalaryAed, uaeResident } ---
  if (typeof profile !== "object" || profile === null || Array.isArray(profile)) {
    return { ok: false, message: "`profile` must be an object with `monthlySalaryAed` and `uaeResident`." };
  }
  const { monthlySalaryAed, uaeResident } = profile as Record<string, unknown>;
  if (typeof monthlySalaryAed !== "number" || !Number.isFinite(monthlySalaryAed)) {
    return { ok: false, message: "`profile.monthlySalaryAed` must be a finite number." };
  }
  if (monthlySalaryAed < 0) {
    return { ok: false, message: "`profile.monthlySalaryAed` cannot be negative." };
  }
  if (typeof uaeResident !== "boolean") {
    return { ok: false, message: "`profile.uaeResident` must be a boolean (true/false)." };
  }

  // --- merchantShares: optional { merchantName: fraction 0..1 } ---
  // The engine's sanitizer would drop a bad entry and fall back to "unanswered",
  // which is safe but silent. At an HTTP boundary a caller sending 30 where 0.3 was
  // meant deserves a 400 telling them so, not a quietly different answer.
  let sharesOut: MerchantShares | undefined;
  if (merchantShares !== undefined && merchantShares !== null) {
    if (typeof merchantShares !== "object" || Array.isArray(merchantShares)) {
      return { ok: false, message: "`merchantShares` must be an object mapping merchant → share (0–1)." };
    }
    const out: Record<string, number> = {};
    for (const [merchant, raw] of Object.entries(merchantShares as Record<string, unknown>)) {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return { ok: false, message: `Merchant share for "${merchant}" must be a finite number.` };
      }
      if (raw < 0 || raw > 1) {
        return {
          ok: false,
          message: `Merchant share for "${merchant}" must be between 0 and 1 (a fraction, not a percentage).`,
        };
      }
      out[merchant] = raw;
    }
    sharesOut = out;
  }

  return {
    ok: true,
    value: {
      spending: spendingOut,
      profile: { monthlySalaryAed, uaeResident },
      merchantShares: sharesOut,
    },
  };
}

function badRequest(message: string): Response {
  const body: OptimizeError = { error: message };
  return Response.json(body, { status: 400 });
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

  // Load cards from Postgres, then hand the engine a plain array.
  const cards = await getAllCards();

  const result: OptimizeResponse = optimizePortfolio(
    validated.value.spending,
    validated.value.profile,
    cards,
    undefined,
    { merchantShares: validated.value.merchantShares },
  );
  return Response.json(result);
}
