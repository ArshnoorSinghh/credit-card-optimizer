/**
 * Typed data-access layer for card data.
 *
 * This is the SINGLE place the app loads cards from. Everything goes through
 * Prisma — no raw SQL — so every query is parameterized by default (CLAUDE.md's
 * security goal: no string-concatenated SQL, no injection surface).
 *
 * ── Architecture rule (load-bearing) ────────────────────────────────────────────
 * This package imports the engine's TYPES ONLY (`import type` — erased at compile
 * time, zero runtime dependency). The engine must never import this package: it
 * stays a pure calculator that receives plain card arrays and knows nothing about
 * Postgres. The dependency arrows point one way: web -> db -> engine (types only).
 * `packages/engine/src/engine-purity.test.ts` locks that invariant in.
 *
 * ── Source of truth ─────────────────────────────────────────────────────────────
 * These rows are seeded FROM packages/engine/data/cards.json. To change card data:
 * edit cards.json, then re-run `pnpm --filter @fils/db seed`. There is no admin
 * write path yet — this layer is read-only by design.
 */

import { PrismaClient, type Card as CardRow, type RewardCategory as CategoryRow } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Card, Redemption } from "@fils/engine";
import { assertDatabaseSafe } from "./guard";

// why an adapter: Prisma 7 no longer takes a connection URL from schema.prisma —
// the runtime connection is supplied by a driver adapter. We give it the POOLED
// DATABASE_URL (PgBouncer): serverless functions open many short-lived connections
// and would otherwise exhaust Postgres' connection limit. Migrations use the direct
// URL instead — see prisma.config.ts.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Fail loudly at construction rather than with an opaque error on first query.
    throw new Error("DATABASE_URL is not set — cannot connect to Postgres.");
  }
  // Never let local dev / tests touch the production database (see guard.ts).
  assertDatabaseSafe(connectionString);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Single shared client; `globalThis` caching prevents Next.js dev-server hot
// reloads from exhausting the connection pool with new clients.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let cached: PrismaClient | undefined;

/**
 * The shared Prisma client, created on FIRST USE.
 *
 * why lazy, not a module-level `const`: importing this module must not require a
 * database. `next build` imports every route to collect page data, so eager
 * construction made the build fail without DATABASE_URL — and it would also open a
 * connection on cold start even for requests that never query. Importing is now
 * side-effect-free; we connect only when a query actually runs.
 */
export function getPrisma(): PrismaClient {
  if (cached) return cached;
  cached = globalForPrisma.prisma ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = cached;
  return cached;
}

/** A card row with its category rows joined — what the mapper consumes. */
type CardRowWithCategories = CardRow & { categories: CategoryRow[] };

// Always fetch categories, and always in source order.
const cardInclude = { categories: { orderBy: { position: "asc" } } } as const;

/**
 * Rebuild the engine's nested `Card` shape from the flattened row + JSON columns.
 *
 * This mapper is the seam that lets the DB schema and the engine's domain type
 * evolve independently: columns stay flat and indexable, while the engine still
 * receives exactly the nested structure it always had (identical to cards.json).
 * DB-only bookkeeping (sortOrder, createdAt, updatedAt) is stripped here.
 */
function toEngineCard(row: CardRowWithCategories): Card {
  const card: Card = {
    id: row.id,
    name: row.name,
    bank: row.bank,
    network: row.network,
    tier: row.tier,
    eligibility: {
      min_monthly_salary_aed: row.eligMinMonthlySalaryAed,
      uae_resident_required: row.eligUaeResidentRequired,
      min_age: row.eligMinAge,
      salary_transfer_required: row.eligSalaryTransferRequired,
      // why the cast: Prisma types JSON columns as the broad `JsonValue`. The seed
      // writes exactly `string | null` here (free-text caveat), cards.json the only writer.
      employer_restrictions: row.eligEmployerRestrictions as string | null,
    },
    fees: {
      annual_fee_aed: row.feesAnnualFeeAed,
      waiver_conditions: row.feesWaiverConditions,
      joining_fee_aed: row.feesJoiningFeeAed,
    },
    rewards: {
      type: row.rewardsType,
      currency: row.rewardsCurrency,
      base_rate: row.rewardsBaseRate,
      // Rows arrive ordered by `position`, preserving the cards.json array order.
      categories: row.categories.map((c) => ({
        category: c.category,
        rate: c.rate,
        monthly_cap: c.monthlyCap,
        annual_cap: c.annualCap,
      })),
      overall_cap: row.rewardsOverallCap,
      min_monthly_spend_required_aed: row.rewardsMinMonthlySpendRequiredAed,
    },
    // why the casts: same as employer_restrictions — opaque JSON the engine never
    // branches on, written only by the seed straight from cards.json.
    redemption: row.redemption as unknown as Redemption,
    benefits: row.benefits as unknown as string[],
    source_url: row.sourceUrl,
  };

  // why conditional: these are OPTIONAL on the engine's Card type and absent from
  // most cards.json entries. The DB stores absence as NULL, so we omit them rather
  // than emit `notes: null` — that keeps the mapped object identical to the source
  // JSON (asserted by the round-trip test).
  if (row.notes !== null) card.notes = row.notes;
  if (row.excludedFromScoring !== null) card.excluded_from_scoring = row.excludedFromScoring;
  if (row.dataCaveat !== null) card.data_caveat = row.dataCaveat;

  return card;
}

/**
 * Every card, in cards.json source order.
 *
 * why the explicit ORDER BY: Postgres gives no inherent row order. Ordering by
 * `sortOrder` reproduces the source order exactly, which keeps the optimizer's
 * enumeration (and therefore its tie-breaking) identical to the pre-database code
 * path that read cards.json directly.
 */
export async function getAllCards(): Promise<Card[]> {
  const rows = await getPrisma().card.findMany({
    include: cardInclude,
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(toEngineCard);
}

/** One card by its id, or null when no such card exists (a miss is not an error). */
export async function getCardById(id: string): Promise<Card | null> {
  const row = await getPrisma().card.findUnique({ where: { id }, include: cardInclude });
  return row ? toEngineCard(row) : null;
}

// Registered users live in ./users — a separate module because they are an APP
// concern (identities the web layer attaches data to), not card data. Re-exported
// here so `@fils/db` remains the single import surface for the app.
export {
  upsertUser,
  getUserByClerkId,
  deleteUserByClerkId,
  getRegisteredUserCount,
  type UserSyncInput,
  type AppUser,
} from "./users";
