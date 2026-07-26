# Fils

Smarter UAE credit cards. An optimization engine that computes the best card portfolio for how you spend, and the best way to redeem the points you earn.

**Live:** https://credit-card-optimizer-web.vercel.app

## Overview

| | |
| --- | --- |
| **Domain** | Consumer fintech, UAE credit card and rewards optimization |
| **Core** | Constrained combinatorial optimization over a 53-card dataset |
| **Stack** | TypeScript, Next.js, Prisma/Postgres, Clerk, Gemini, Vercel |
| **Architecture** | pnpm monorepo, pure framework-free engine |

## Features

- **Card Optimizer** - optimal 1 to 3 card portfolio for a spending profile, net of caps and fees, with per-category card assignment.
- **Points Optimizer** - per-redemption-type point valuation, conversion break-even analysis, expiry-aware burn prioritization.
- **Sensitivity Analysis** - sweeps inputs to locate where the recommendation flips; surfaces recommendations that depend on unverified data.
- **Rafiq (AI assistant)** - natural-language interface, structurally grounded so it cannot fabricate numbers.

## Core algorithm

Portfolio selection is constrained combinatorial optimization, not ranking. Monthly reward caps make spending categories compete for a shared bonus pool per card, so greedy assignment (best card per category) is suboptimal. It loses roughly 45% of achievable reward on adversarial cases.

The solution uses two nested layers:

| Layer | Method | Why |
| --- | --- | --- |
| **Outer** | Exhaustive enumeration of all ~23k 1-3 card subsets | Trivially cheap at this scale; no approximation needed |
| **Inner** | Min-cost max-flow for spend assignment | Caps as edge capacities, negated rewards as edge costs; fixed total flow means min cost provably equals max reward |

The result is exact, not heuristic.

## Architecture decisions

| Decision | Rationale |
| --- | --- |
| **Pure engine (`packages/engine`)** | No I/O, no framework imports, compiler-enforced. Independently testable, web layer swappable. |
| **Uncertainty as a first-class type** | Reward rates parsed into confidence tiers; unresolvable values flagged and returned as ranges, never guessed. |
| **Structurally grounded LLM** | Engine numbers travel in a data field the model cannot edit. Rafiq phrases only; it cannot fabricate a rate under adversarial prompting. |
| **Single-source data boundary** | The card dataset is source of truth; engine, DB, and AI read from it, none can corrupt it. |
| **Dev/prod DB isolation** | Separate Postgres instances with a guard that fails loudly on cross-environment access. |

## Repository

| Path | Contents |
| --- | --- |
| `packages/engine` | Pure optimization core: both engines plus sensitivity analysis. Zero framework/DB deps. |
| `packages/db` | Prisma schema, migrations, typed data-access layer. |
| `apps/web` | Next.js app, API routes, Rafiq. The only layer touching both engine and DB. |

## Stack

TypeScript, Next.js (App Router), Prisma, PostgreSQL, Clerk, Google Gemini, Vercel, pnpm workspaces, Vitest.
