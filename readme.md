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

> **Status:** engine foundations coming together. The monorepo skeleton is wired
> end to end (the web app renders a placeholder `hello()` from the engine package).
> Inside the engine, four building blocks are built and tested: the **card domain
> model**, the **rate normalizer**, the **valuation model**, and the per-card
> **scorer**. Next up is the portfolio optimizer (1–3 card subset search); it is
> not built yet.

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

Four pieces of the engine are built and tested (`packages/engine/src`). They form
a chain — raw card → normalized rates → AED valuation → per-card score. All are
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

### 3. Valuation model — `valuations.ts`

`DEFAULT_VALUATIONS` maps every reward currency in `cards.json` to an AED-per-unit
value with a per-entry confidence (`high` / `medium` / `low`) — e.g. 1 Skywards
Mile ≈ 0.035 AED (high), 1 FAB Reward ≈ 0.007 AED (medium). Cashback (`AED`) is
1.0 by definition. It's plain data plus pure lookups; `withValuations(overrides)`
lets a caller adjust one currency without restating the rest (the path to
user-editable valuations later).

A test cross-checks the table against the data and **fails the build if any
currency lacks an entry**, so a new card with a new currency can't score against a
missing value. A currency still outside the researched set
(`Multiple programs (customizable)`, whose value is user-customizable and so
genuinely unknown) is shipped as a **flagged placeholder**, not an invented value.

### 4. Card scorer — `score-card.ts`

`scoreCard(spending, card, valuations?)` → `CardScore`: the "show the math"
receipt for one card against a monthly spending profile. It:

1. matches spend categories to the card's reward categories via an explicit table;
2. applies each normalized rate respecting its unit (percent → AED directly;
   points/miles-per-AED → multiply spend; per-USD → convert at **3.6725 AED/USD**
   first);
3. enforces monthly then annual caps in reward-currency units;
4. routes unmatched spend to the base rate;
5. converts earnings to AED via the valuation table, annualizes, and subtracts the
   annual fee (exposing **year-1 vs ongoing** value for fee waivers).

The result carries a full per-category breakdown, reward-currency amounts before
conversion (e.g. "120,000 FAB Rewards"), the valuation used, and every inherited
low/unknown-confidence flag. Unresolved (tier-3) rates score as a **min/max range**
rather than a fabricated point value. Tests hand-compute three cards on a fixed
profile — a cashback card with a binding cap, a miles card with USD conversion, and
a free-for-life points card — and assert the engine matches the hand math exactly.

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

- **`"Up to X%"` depends on the card's cap fields.** In the normalizer, when a cap
  models the constraint it's parsed as `X%` (tier 1); when no cap exists it becomes
  a `0..X` range (tier 3). This mirrors the rule that structural caps — not a
  discounted headline rate — express the real limit.

- **Merchant-scoped base rates are flagged, not trusted.** A `base_rate` like
  `"5% on dnata travel"` parses to `0.05` but is marked `low`, because no
  structured field captures the "dnata only" scope — treating it as a blanket rate
  would over-count.

- **The card model mirrors the raw JSON exactly** (snake_case field names,
  nullable fields kept nullable) so the data type-checks against it directly, with
  no lossy remapping. It is the *input* to the normalizer, not a normalized model.

- **Valuations are researched defaults, overridable, and honest about gaps.** Every
  currency carries a confidence, and any currency with no researched value is a
  flagged placeholder (conservative `0.0075`) rather than an invented number — any
  card using it is marked uncertain. `AED (<program>)` currencies are judged on how
  cash-like they actually are, not lumped together: transit fare credit
  (`AED (Nol points)`) and the statement-credit `AED (Salaam Points convertible)`
  redeem at face value (`1.0`), `AED (Booking.com credit)` is a flagged `0.85`
  pending card re-verification, and pure `AED` is `1.0`.

- **Scoring is conservative and flags its assumptions.** Spend routes to the
  highest-yield matching category; over-cap spend earns nothing more (never
  overstated), and reached caps are flagged. Merchant-locked bonuses (e.g. an
  Emirates co-brand's airline rate) are credited but flagged as an optimistic
  assumption, since a generic profile can't confirm the spend is at that merchant.

- **Un-verifiable cards are benched, not guessed.** When a card's data carries a
  defect we can't correct from a source (e.g. `ei_flex_elite`, whose "customizable"
  perks were mislabeled as variable reward rates), it's marked
  `excluded_from_scoring` in the data. `scoreCard` returns a zeroed,
  clearly-flagged score with `benched: true` — the card stays visible but is never
  ranked, pending verification. We never invent a reward structure to fill the gap.

- **Ranges propagate; unbounded upside is never invented.** Tier-3 rates score as a
  min/max band. A bounded ceiling (`"Up to 4%"`) yields a real `0..max`; an
  unbounded rate (`"Variable"`) collapses to its min with an "upside not scored"
  flag rather than a fabricated ceiling. The single ranking number is the range
  midpoint, with the full range exposed alongside it.

