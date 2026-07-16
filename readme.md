# Fils

A UAE credit-card optimization platform. Two engines:

1. **Card Optimizer** — recommends the best 1/2/3-card portfolio across ~51 UAE
   credit cards, given a user's spending pattern, eligibility, and fee structures.
2. **Points & Redemption Optimizer** — models point inventory, scenario-dependent
   valuation, redemption recommendations, and expiry/burn timing.

Under the hood: constrained combinatorial optimization over card subsets, scoring
by net expected value (rewards earned − fees) with reward caps and eligibility
rules, and explicit uncertainty modeling — ambiguous reward rates propagate as
ranges rather than silent point estimates.

> **Status:** both engines are built and tested, and card data now lives in Postgres.
> The **Card Optimizer** is complete — card domain model, rate normalizer, valuation
> model, per-card scorer, and portfolio optimizer (exact 1–3 card subset search). The
> **Points & Redemption Optimizer** is complete — redemption valuation model,
> conversion model, redemption recommender, and burn engine. Both are pure,
> framework-free, and independently testable.
>
> `POST /api/optimize` is live and reads cards from Postgres via `@fils/db`; the web
> app has a deliberately unstyled test page that exercises it end to end.
>
> Still to come: a real frontend, an admin write path for card data (edits go through
> `cards.json` + re-seed for now), and user accounts/auth.

## Structure

```
fils/
  apps/web/          Next.js (App Router) — UI + /api routes that call the engine
  packages/engine/   Pure TypeScript — domain models, normalizer, optimizers, tests
  packages/db/       Prisma schema + migrations + seed + typed data-access layer
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

`packages/engine/data/cards.json` — 51 UAE cards with messy, inconsistent
free-text rate strings — is the **source of truth**. The normalizer parses these and
**flags genuinely uncertain rates instead of fabricating values** — no rate is ever
invented, and no unrecognized string is silently defaulted to a number.

### Database (Postgres)

The app loads cards from Postgres, not from the JSON file. The database is a
queryable **copy** of `cards.json`, populated by the seed script.

> **Editing card data:** edit `cards.json`, then **re-seed**. There is no admin
> write path yet, and nothing else writes to these tables. The seed is idempotent
> (upsert by card id), so re-running never duplicates and always converges on
> exactly what the JSON says.

```bash
# one-time / after schema changes — creates + applies a migration
pnpm --filter @fils/db migrate

# load cards.json into Postgres (safe to re-run)
pnpm --filter @fils/db seed

# integration tests (needs DATABASE_URL + a seeded DB)
pnpm --filter @fils/db test
```

**Environment** (`packages/db/.env`, gitignored; `vercel env pull` fills it):

| Var | Connection | Used by |
| --- | --- | --- |
| `DATABASE_URL` | **pooled** (PgBouncer) | app queries at runtime |
| `DIRECT_URL` | **direct** | `prisma migrate` only |

Two URLs because serverless functions open many short-lived connections and must go
through the pooler, while migrations need a direct session (a transaction-mode
pooler breaks advisory locks and transactional DDL). `apps/web/.env.local` needs
`DATABASE_URL` for local `next dev`; Vercel injects it in deployed environments.

**Migrations** live in `packages/db/prisma/migrations/` and are versioned in git
like code: each is a timestamped, immutable folder of SQL that has been applied, so
the schema's history is reviewable and reproducible on any environment. Never edit
an applied migration — add a new one.

### Architecture rule

Data flows one way:

```
apps/web  ->  @fils/db  ->  @fils/engine (TYPES ONLY)
```

`packages/db` imports the engine's types with `import type` (erased at compile time).
The engine **never** imports `@fils/db`, never touches a database, and receives plain
card arrays — it stays a pure calculator. `packages/db/src/architecture.test.ts`
fails the build if that inverts.

## Engine 1 — Card Optimizer

Five pieces (`packages/engine/src`). They form a chain — raw card → normalized rates
→ AED valuation → per-card score → best portfolio. All are pure and deterministic,
with the math commented inline — this package is human-owned, so it's meant to be
read and explained, not just run.

### 1. Card domain model — `card.ts`

A `Card` type (plus `Eligibility`, `Fees`, `Rewards`, `RewardCategory`,
`Redemption`, `RewardType`) that matches the raw shape of `cards.json`
field-for-field. It models the data **as it exists on disk** — deliberately messy;
rate strings are left as text for the normalizer, not pre-parsed.

Conformance is enforced at build time: `card.test.ts` imports the real
`cards.json` and assigns it to `Card[]`, so `tsc` fails if any of the 51 cards
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

Running it over all 51 cards (140 rate strings) today: **136 tier-1, 2 tier-2,
2 tier-3**. The two tier-2 and two tier-3 strings are listed by a sweep test,
and their counts are locked so a new card with a novel string breaks the build
instead of being silently reclassified.

### 3. Valuation model — `valuations.ts`

`DEFAULT_VALUATIONS` maps every reward currency in `cards.json` to an AED-per-unit
value with a per-entry confidence (`high` / `medium` / `low`) — e.g. 1 Skywards
Mile ≈ 0.037 AED (high), 1 FAB Reward ≈ 0.007 AED (medium). Cashback (`AED`) is
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

`scoreCard` is a thin shell over the shared earning core (`earnAcrossCards`): it is
literally a **1-card portfolio**, the same computation the optimizer runs on each
subset. So there's one source of truth for how a card earns — see the optimizer below.

### 5. Portfolio optimizer — `optimize-portfolio.ts`

`optimizePortfolio(spending, userProfile, cards, valuations?, options?)` →
`PortfolioResult`: the best 1-, 2-, and 3-card portfolios for a spending +
eligibility profile, plus the single portfolio to recommend across sizes. Each
carries net annual value (year-1 and ongoing), a per-category **"swipe THIS card"**
assignment, each card's individual contribution, total fees, and inherited
uncertainty flags — the scorer's receipt, portfolio edition.

- **Eligibility first.** Cards whose salary/residency requirements the user fails
  are dropped and benched cards are set aside (both counts reported). At most one
  salary-transfer-required card per portfolio — a salary routes to a single bank —
  enforced during enumeration.
- **Exhaustive subset search.** Every 1/2/3-card subset is scored — ~22k at 51
  cards, trivially fast. Portfolio value is non-additive across cards (two cards can
  be complementary or redundant), so only exhaustive search is provably correct, and
  at this scale it's free. No approximations.
- **Exact spend assignment via min-cost max-flow.** Splitting a portfolio's spend
  across its cards is a transportation problem: each AED of spend flows from its
  category to a card's earn-option, option capacities encode reward caps, edge costs
  encode (negated) yield. Naive per-category greedy is *wrong* under caps — filling a
  shared capped bonus with one category can starve another that had no other good
  home — so the assignment is solved to optimality. An adversarial test constructs a
  case where greedy loses and asserts the engine returns the hand-computed optimum.
- **Tie-break:** higher net → fewer cards → lower total fees → deterministic. This
  is where "fewer cards" bites: a 3rd card whose fee eats its own rewards isn't
  recommended just because it ties.

## Engine 2 — Points & Redemption Optimizer

Four pieces plus an inventory type (`packages/engine/src`), same rules as Engine 1:
pure, deterministic, no I/O, every value carries a confidence, nothing is invented.
Where Engine 1 asks *"which cards should I carry?"*, Engine 2 asks *"I have these
points — what are they actually worth, how should I spend them, and what's about to
expire?"*

### 1. Redemption valuation model — `redemption-valuations.ts`

Engine 1 needs one number per currency. Engine 2 needs more resolution: the same
Skywards Mile is worth ~0.037 AED as an economy seat but only ~0.011 dumped into a
mall. So each currency owns a list of **named routes**, each with an AED value, a
confidence, and a semantic `class` (`card_bill`, `external_bill`, `fixed_use`,
`voucher`, `partner_spend`, `flight_economy`, `flight_premium`, `hotel`, `transfer`).
Goals and phrasing branch on the class, so adding a program means adding data, not code.

The structural fact this encodes: **cash-equivalent redemption is per-currency, not
universal.** Most UAE bank currencies can pay down your card bill; **ADCB TouchPoints
and Etisalat Smiles cannot** — Smiles is voucher/bill-pay only ("cashback not
permitted"). That's an explicit `cashCapable` flag, never an assumption.

Merchant-tier variance is modeled rather than averaged away — the same TouchPoint is
`0.006` at a Max partner, `0.005` in-store, `0.004` as a voucher, `0.004348` against
a utility bill. **Skywards premium cabins carry no fixed number**: after the ~15%
premium devaluation (20 May 2026) any single figure is unreliable, so premium is
valued as `economy × a user-supplied multiplier`, and is simply not valued if you
don't supply one. Economy Saver was not devalued, so `0.037` stands.

Each currency names a **primary** route — the one Engine 1's flat value represents —
so `deriveFlatValuationTable()` / `reconcileWithFlat()` can prove the two engines
agree. They currently agree everywhere except one deliberate divergence: **Plus
Points**, where research says ~0.75 but Engine 1 holds `0.01` pending verification
(see Key decisions). A test locks that hold in place so it stays visible.

### 2. Conversion model — `conversions.ts`

Bank points → airline miles is a separate concern from valuation, and the ratios are
the most volatile numbers in the codebase (TouchPoints → Skywards was 18:1 before
Nov 2024, now 22:1), so they live in one small editable table: TouchPoints 22:1 /
14:1, Mashreq 32:1 / 22:1, DIB 20:1.

Converting only pays off when `points × source_value < miles × mile_value`, which
reduces to a **break-even destination value of `source_value × ratio`**. Run over the
real numbers, the finding is uniform: **at baseline economy value (~0.037), direct
redemption beats every published conversion** — TouchPoints → Etihad would need a
mile worth 0.084, Mashreq 0.076, DIB 0.10. Conversion only wins for premium cabins
above break-even, so the recommender never suggests it otherwise and says why.

### 3. Points inventory — `points-inventory.ts`

`{ currency, balance, expiryDate?, earnedDate? }` — manual entry. Expiry is optional
because most UAE programs don't show it, and we refuse to invent one.

### 4. Redemption recommender — `recommend-redemptions.ts`

Input: inventory + a goal (`flights` | `hotels` | `max_value` | `cash_equivalent`).
For each holding it considers every direct route *and* every conversion whose
destination serves the goal, picks the best by realized AED, ranks holdings, and
returns a receipt — `balance × rate = AED`, the route chosen, whether a conversion
was involved, and inherited confidence flags.

It **never says "cash"**, because that word is wrong for most of these currencies.
Card-bill-capable currencies read *"redeem as AED X off your card bill (statement
credit)"*; TouchPoints and Smiles read *"pay AED X of a utility bill / redeem as
vouchers — no card-bill payment available."* A currency with no route for the goal
reports that plainly instead of returning a fabricated number.

### 5. Burn engine — `burn-priority.ts`

Ranks holdings by what you lose first: **urgency** (≤90 days urgent, ≤180 soon),
then **value-at-risk** (`balance × best rate`), then **versatility ascending** — the
least flexible currency burns first, because a voucher-only balance has fewer escape
routes than miles if you miss the window.

It refuses to manufacture urgency. An explicit expiry is ground truth; a known
program policy (Etihad 18 months — extendable **only by flight activity** since June
2024; Skywards ~36; Smiles 24; Marriott 24 inactivity) can only *project* a date if
the holding also has an earned date, and every projection is flagged *"estimated from
program policy, not user-confirmed."* No date and no policy ⇒ **"expiry unknown"** —
never a false alarm. Known devaluations (Skywards premium, 20 May 2026) surface as
their own "burn premium redemptions before this date" warning.

## Key decisions

Decisions worth knowing before extending the engine:

- **A suspect number is held, flagged, and left visible — not quietly adopted.**
  Research puts ENBD Plus Points near `0.75` AED/point, but `enbd_visa_flexi` earns
  1 point per AED — so adopting it would imply a **>75% return**, which is
  impossible. Rather than invent a plausible earn rate to make the model behave,
  Engine 1 **holds Plus Points at `0.01`** until both the earn rate and the per-point
  value are verified, the card carries a loud `data_caveat` flag on every score, and
  Engine 2 records `0.75` as a deliberate, tested divergence. Backing this is a
  permanent guardrail: any card whose net annual value exceeds the user's total
  annual spend is flagged *"implausible — check earn rate/valuation"* (flagged, never
  crashed, never silently dropped).

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

- **One earning rule everywhere; over-cap spend reroutes, never vanishes.** A bonus
  cap means "no more *bonus*," not "no more earning" — spend past a cap flows to the
  next-best option: another card in a portfolio, or the card's own base rate for a
  lone card. Because `scoreCard(card)` and the best 1-card portfolio are the *same*
  computation (both call `earnAcrossCards`), a card scored on its own and as a 1-card
  portfolio return identical numbers — a property proven across all 51 cards in
  `reconcile.test.ts`. Reached caps are still flagged; merchant-locked bonuses (e.g.
  an Emirates co-brand's airline rate) are credited but flagged as an optimistic
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

