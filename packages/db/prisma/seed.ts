/**
 * Seed the card tables from packages/engine/data/cards.json.
 *
 * cards.json is the SOURCE OF TRUTH; this database is a queryable copy of it.
 * Workflow today: edit cards.json -> re-run this seed. (An admin write path comes
 * later; until then nothing writes to these tables except this script.)
 *
 * IDEMPOTENT: cards are upserted by their natural `id`, so re-running never
 * duplicates and always converges on exactly what cards.json says.
 *
 * why this reads the JSON file rather than importing the engine's `CARDS`:
 * packages/db may depend on the engine for TYPES ONLY. Reading the data file keeps
 * cards.json as the single seed source without creating a runtime dependency on
 * engine code. (Type-checked against the engine's `Card` type below regardless.)
 *
 * Run: pnpm --filter @fils/db seed
 */

// Prisma 7 no longer auto-loads .env, so the seed loads it explicitly.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Card } from "@fils/engine";

const CARDS_JSON = fileURLToPath(new URL("../../engine/data/cards.json", import.meta.url));

function loadCards(): Card[] {
  return JSON.parse(readFileSync(CARDS_JSON, "utf8")) as Card[];
}

function createClient(): PrismaClient {
  // Seeding is a bulk write from a single long-lived process, so the DIRECT
  // connection is the right choice — no pooler in the way. Fall back to the pooled
  // URL if DIRECT_URL isn't set.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL / DATABASE_URL is not set — cannot seed.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function main(): Promise<void> {
  const cards = loadCards();
  const prisma = createClient();

  try {
    for (const [index, card] of cards.entries()) {
      // Everything a Card row needs, minus id/timestamps — shared by create+update.
      const data = {
        name: card.name,
        bank: card.bank,
        network: card.network,
        tier: card.tier,
        sortOrder: index, // preserve cards.json order for deterministic reads
        eligMinMonthlySalaryAed: card.eligibility.min_monthly_salary_aed,
        eligUaeResidentRequired: card.eligibility.uae_resident_required,
        eligMinAge: card.eligibility.min_age,
        eligSalaryTransferRequired: card.eligibility.salary_transfer_required,
        eligEmployerRestrictions: card.eligibility.employer_restrictions ?? undefined,
        feesAnnualFeeAed: card.fees.annual_fee_aed,
        feesWaiverConditions: card.fees.waiver_conditions,
        feesJoiningFeeAed: card.fees.joining_fee_aed,
        rewardsType: card.rewards.type,
        rewardsCurrency: card.rewards.currency,
        rewardsBaseRate: card.rewards.base_rate,
        rewardsOverallCap: card.rewards.overall_cap,
        rewardsMinMonthlySpendRequiredAed: card.rewards.min_monthly_spend_required_aed,
        redemption: card.redemption,
        benefits: card.benefits,
        sourceUrl: card.source_url,
        notes: card.notes ?? null,
        excludedFromScoring: card.excluded_from_scoring ?? null,
        dataCaveat: card.data_caveat ?? null,
      };

      // why a transaction + delete-then-recreate for categories: upserting them
      // individually would leave STALE rows behind if a category is removed from
      // cards.json. Replacing the set wholesale makes the DB converge exactly on
      // the source, and the transaction keeps a card and its rates consistent.
      await prisma.$transaction([
        prisma.card.upsert({
          where: { id: card.id },
          create: { id: card.id, ...data },
          update: data,
        }),
        prisma.rewardCategory.deleteMany({ where: { cardId: card.id } }),
        prisma.rewardCategory.createMany({
          data: card.rewards.categories.map((c, position) => ({
            cardId: card.id,
            position,
            category: c.category,
            rate: c.rate,
            monthlyCap: c.monthly_cap,
            annualCap: c.annual_cap,
          })),
        }),
      ]);
    }

    // Prune cards that no longer exist in cards.json (e.g. a discontinued product
    // like adib_booking_signature). Upsert alone never deletes, so without this the
    // DB would keep stale rows and drift from the source. RewardCategory rows cascade
    // on card delete (schema onDelete: Cascade). Nothing else references Card, so this
    // touches only card REFERENCE data — never user rows.
    const jsonIds = new Set(cards.map((c) => c.id));
    const dbCards = await prisma.card.findMany({ select: { id: true } });
    const stale = dbCards.filter((c) => !jsonIds.has(c.id)).map((c) => c.id);
    if (stale.length > 0) {
      await prisma.card.deleteMany({ where: { id: { in: stale } } });
      console.log(`Pruned ${stale.length} stale card(s) not in cards.json: ${stale.join(", ")}`);
    }

    // Assert the DB agrees with the source, so a silent partial seed can't pass.
    const seeded = await prisma.card.count();
    const categories = await prisma.rewardCategory.count();
    const expectedCategories = cards.reduce((n, c) => n + c.rewards.categories.length, 0);

    console.log(`Seeded ${seeded} cards (${categories} reward categories) from cards.json.`);

    if (seeded !== cards.length) {
      throw new Error(`Seed count mismatch: DB has ${seeded} cards, cards.json has ${cards.length}.`);
    }
    if (categories !== expectedCategories) {
      throw new Error(
        `Category count mismatch: DB has ${categories}, cards.json has ${expectedCategories}.`,
      );
    }
    console.log(`OK — matches cards.json (${cards.length} cards).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
