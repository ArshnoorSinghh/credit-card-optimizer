import {
  CARDS,
  optimizePortfolio,
  SPEND_CATEGORIES,
  type SpendCategory,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";
import type { OptimizeError, OptimizeResponse } from "@/lib/optimize-contract";

// The engine holds the cards; the route only imports it (never the reverse), so
// the engine stays pure and framework-free. CARDS is a build-time bundled import,
// so this works in a serverless function with no filesystem access at runtime.

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

type Validated = { spending: SpendingProfile; profile: UserProfile };
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
  const { spending, profile } = body as Record<string, unknown>;

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

  return { ok: true, value: { spending: spendingOut, profile: { monthlySalaryAed, uaeResident } } };
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

  const result: OptimizeResponse = optimizePortfolio(
    validated.value.spending,
    validated.value.profile,
    CARDS,
  );
  return Response.json(result);
}
