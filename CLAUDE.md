# Fils - Claude Code Briefing

## What this is
Fils is a UAE credit-card optimization platform. Two engines:

1. **Card Optimizer** — recommends the best 1/2/3-card portfolio across ~55 UAE
   credit cards, given a user's spending pattern, eligibility, and fee structures.
2. **Points & Redemption Optimizer** — models point inventory, scenario-dependent
   valuation, redemption recommendations, and expiry/burn timing.

It is both a real product idea and a portfolio piece meant to demonstrate
quantitative modeling: constrained combinatorial optimization, expected-value
modeling under uncertainty, and sensitivity analysis.

## Ownership rule (READ THIS)
- Code in `packages/engine` is **owned by the human**. Explain your reasoning,
  keep it readable, comment the math, and never introduce optimization or
  valuation logic the human hasn't reviewed. Prefer clarity over cleverness here.
- Everything else — the Next.js app, API routes, DB wiring, deploy config, CI —
  build it idiomatically and well. The human reviews these at a high level.

## Stack (locked)
- Monorepo: **pnpm workspaces**
- Frontend + API: **Next.js (App Router)** in `apps/web`
- Deploy: **Vercel**
- Database: **Vercel Postgres**, accessed via **Prisma** (in `packages/db`)
- Engine: **framework-free pure TypeScript** in `packages/engine` — no framework
  imports, independently testable, portable
- TypeScript everywhere, `strict` mode on

## Structure
```
fils/
  apps/web/          Next.js app (UI + /api routes that call the engine)
  packages/engine/   pure TS: domain models, normalizer, optimizers, tests
  packages/db/       Prisma schema + client + seed script
  pnpm-workspace.yaml
  CLAUDE.md
```

## Databases (PROD and DEV are separate — keep it that way)
Two independent Postgres databases:
- **PRODUCTION** — Neon endpoint `ep-twilight-voice-at5pi2e5`. Holds live cards +
  real users. Used ONLY by the deployed site on Vercel (Production + Preview). Its
  connection string lives in **Vercel env vars only** — never in local files.
- **DEVELOPMENT** — a separate Neon database (its own endpoint/host). Used by local
  `pnpm dev`, all tests, and `seed`. Safe to reset/reseed/experiment on. Its
  connection string lives in local `.env` files only:
  - `packages/db/.env`, `apps/web/.env.local`, root `.env` → `DATABASE_URL`
    (pooled DEV) and `DIRECT_URL` (direct DEV). (root `.env.local` has no DB vars.)

**Guard:** `packages/db/src/guard.ts` (`assertDatabaseSafe`) throws if any
non-production context (local dev, `vitest`, local `seed`) is pointed at the
production host. The prod DB is permitted only when `NODE_ENV === "production"`
(Vercel runtime) or with an explicit `FILS_ALLOW_PROD_DB=1` opt-in for a deliberate,
reviewed prod operation. This is wired into the DB client and the seed script, and
regression-locked by `packages/db/src/guard.test.ts`.

To change PRODUCTION card data or schema: run migrations via `prisma migrate deploy`
against prod, or a one-off `FILS_ALLOW_PROD_DB=1 DATABASE_URL=<prod> pnpm --filter
@fils/db seed`. Never a plain local `seed` (the guard blocks it).

## Data
- Source of truth: `finaldata_creditcard.json` (~55 UAE cards). Contains messy,
  inconsistent rate strings.
- The normalizer already parses messy rates and **flags genuinely uncertain rates
  rather than fabricating values**. Never invent a rate. If a rate can't be parsed
  confidently, flag it as uncertain.
- When a structured category entry conflicts with a free-text `base_rate` string,
  prefer the structured category entry.

## Engine principles
- Pure, deterministic functions. **No I/O inside the engine** (no DB, no fetch, no fs).
- Optimizer: constrained combinatorial search over card subsets (size 1–3),
  scoring by net expected value = rewards earned − fees, respecting reward caps
  and eligibility rules.
- Model uncertainty explicitly — flagged rates should propagate as ranges, not
  silent point estimates, where it affects the recommendation.
- Every non-obvious modeling decision gets a `// why:` comment.

## Conventions
- Strict TS. No `any` without a comment justifying it.
- Tests colocated in `packages/engine`, run with **vitest**.
- `packages/engine` must NOT import Next.js, Prisma, or Node-only APIs — it stays
  portable and independently testable.

## Open questions (do not assume answers)
Three cofounder-alignment questions are unresolved — see `FILS_SCOPE_v2.md`.
If a task depends on one of them, flag it instead of guessing.
