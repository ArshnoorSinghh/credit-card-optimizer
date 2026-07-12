# Fils

A UAE credit-card optimization platform. Two engines:

1. **Card Optimizer** — recommends the best 1/2/3-card portfolio across ~55 UAE
   credit cards, given a user's spending pattern, eligibility, and fee structures.
2. **Points & Redemption Optimizer** — models point inventory, scenario-dependent
   valuation, redemption recommendations, and expiry/burn timing.

Under the hood: constrained combinatorial optimization over card subsets, scoring
by net expected value (rewards earned − fees) with reward caps and eligibility
rules, and explicit uncertainty modeling — ambiguous reward rates propagate as
ranges rather than silent point estimates.

> **Status:** monorepo skeleton. The workspace wiring is verified end to end
> (the web app renders a placeholder `hello()` from the engine package), but no
> product features are built yet.

## Structure

```
fils/
  apps/web/          Next.js (App Router) — UI + /api routes that call the engine
  packages/engine/   Pure TypeScript — domain models, normalizer, optimizers, tests
  packages/db/       Prisma schema + client + seed script
```

The engine is framework-free, pure TypeScript: no I/O, no Next.js/Prisma/Node-only
imports, deterministic functions only. It ships as raw TS and is transpiled into
the app build via `transpilePackages`.

## Stack

- **pnpm workspaces** monorepo
- **Next.js (App Router)** + TypeScript strict mode, deployed on **Vercel**
- **Vercel Postgres** via **Prisma**
- **vitest** for engine tests (colocated in `packages/engine`)

## Getting started

Requires Node ≥ 24 and pnpm ≥ 11.

```bash
pnpm install

# run the web app locally
pnpm --filter web dev

# run engine tests
pnpm --filter @fils/engine test

# typecheck all packages
pnpm -r typecheck

# production build
pnpm --filter web build
```

## Data

The source of truth is `finaldata_creditcard.json` (~55 UAE cards) with messy,
inconsistent rate strings. The normalizer parses these and **flags genuinely
uncertain rates instead of fabricating values** — no rate is ever invented.
