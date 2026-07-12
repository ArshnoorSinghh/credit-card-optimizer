# Fils — Claude Code Briefing

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
