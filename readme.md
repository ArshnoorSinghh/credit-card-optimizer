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

> **Status:** early engine foundations. The monorepo skeleton is wired end to end
> (the web app renders a placeholder `hello()` from the engine package). Inside the
> engine, two building blocks are built and tested: the **card domain model** and
> the **rate normalizer**. The optimizers themselves are not built yet.

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

The engine reads `packages/engine/data/cards.json` — 55 UAE cards with messy,
inconsistent free-text rate strings. The normalizer parses these and **flags
genuinely uncertain rates instead of fabricating values** — no rate is ever
invented, and no unrecognized string is silently defaulted to a number.

## Engine progress

Two pieces of the engine are built and tested (`packages/engine/src`). Both are
pure and deterministic, with the math commented inline — this package is
human-owned, so it's meant to be read and explained, not just run.

### 1. Card domain model — `card.ts`

A `Card` type (plus `Eligibility`, `Fees`, `Rewards`, `RewardCategory`,
`Redemption`, `RewardType`) that matches the raw shape of `cards.json`
field-for-field. It models the data **as it exists on disk** — deliberately messy;
rate strings are left as text for the normalizer, not pre-parsed.

Conformance is enforced at build time: `card.test.ts` imports the real
`cards.json` and assigns it to `Card[]`, so `tsc` fails if any of the 55 cards
deviates from the type. Reward-type values are additionally checked at runtime.

### 2. Rate normalizer — `normalize-rate.ts`

`normalizeRate(raw, ctx?)` turns a raw rate string into a structured
`NormalizedRate { value, unit, confidence, range?, note? }`. It classifies every
string into one of three confidence tiers and never guesses:

| Tier | Confidence | Meaning | Example |
| --- | --- | --- | --- |
| 1 | `high` | clean parse; number and unit are certain | `"5%"`, `"3 points per AED 1"` |
| 2 | `low` | number parses, but a condition is missing from the structured data — surface "verify this card" | `"10% on Emaar purchases"` |
| 3 | `unknown` | no single value; emit a bounded/unbounded range instead of a point estimate | `"Up to 5%"`, `"Variable"` |

Running it over all 55 cards (150 rate strings) today: **144 tier-1, 2 tier-2,
4 tier-3**. The two tier-2 and four tier-3 strings are listed by a sweep test,
and their counts are locked so a new card with a novel string breaks the build
instead of being silently reclassified.

## Key decisions

Decisions worth knowing before extending the engine:

- **Uncertainty is explicit, never fabricated.** Rates carry a `confidence`
  (`high` / `low` / `unknown`) and, when unresolved, a `range` — the optimizer is
  expected to propagate these, not collapse them to a silent number. Unrecognized
  strings fail loudly (tier 3 with a review note), never default to a value.

- **Rate `unit` is first-class and units are never conflated.** A number means
  nothing without its unit, so `NormalizedRate` carries one of
  `percent` / `points_per_aed` / `miles_per_usd` / `miles_per_aed`.
  - `miles_per_usd` and `miles_per_aed` are kept **separate** — the data contains
    both, and they differ by the USD/AED rate (~3.67×); merging them would corrupt
    the math.
  - The percent unit is `percent`, not "cashback" — one card quotes a percent while
    paying in points (`"10% on Emaar purchases"` on a points card), so a percent
    means "this fraction of spend comes back, in the card's reward currency."
  - Branded points (e.g. Mashreq **TouchPoints**) normalize to `points_per_aed` at
    `high` confidence; what a point is *worth* is a valuation concern for later,
    not a rate-parsing uncertainty.

- **`"Up to X%"` depends on the card's cap fields.** When a cap models the
  constraint, it's parsed as `X%` (tier 1); when no cap exists (e.g. a user-chosen
  category), it becomes a `0..X` range (tier 3). This mirrors the rule that
  structural caps — not a discounted headline rate — express the real limit.

- **Merchant-scoped base rates are flagged, not trusted.** A `base_rate` like
  `"5% on dnata travel"` parses to `0.05` but is marked `low`, because no
  structured field captures the "dnata only" scope — treating it as a blanket rate
  would over-count.

- **The card model mirrors the raw JSON exactly** (snake_case field names,
  nullable fields kept nullable) so the data type-checks against it directly, with
  no lossy remapping. It is the *input* to the normalizer, not a normalized model.

## Open questions

Three cofounder-alignment questions are unresolved (tracked in `CLAUDE.md`). Tasks
that depend on them are flagged rather than guessed.
