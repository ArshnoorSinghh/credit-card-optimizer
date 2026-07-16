import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * why this file exists: Prisma 7 removed `url` / `directUrl` from the datasource
 * block in schema.prisma. Connection details for the CLI (migrate, introspect) now
 * live here, and the runtime connection is supplied to PrismaClient via a driver
 * adapter (see src/index.ts).
 *
 * why DIRECT_URL here, not DATABASE_URL: this URL is used only by the CLI —
 * migrations need a DIRECT connection because a transaction-mode pooler (PgBouncer)
 * breaks the session-level advisory locks and transactional DDL that Migrate relies
 * on. The pooled DATABASE_URL is used at RUNTIME instead, where many short-lived
 * serverless connections would otherwise exhaust Postgres' connection limit.
 *
 * `dotenv/config` is imported explicitly because Prisma 7 no longer auto-loads .env.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL,
  },
  migrations: {
    // `prisma db seed` -> our idempotent seeder (upsert by card id).
    seed: "tsx prisma/seed.ts",
  },
});
