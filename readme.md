# Fils

Fils works out which UAE credit cards you should carry, and what to do with the
points once you have them.

There are two engines. The **Card Optimizer** takes your monthly spending by
category, your salary and residency, and searches every 1, 2 and 3 card
combination across 53 UAE cards to find the portfolio with the highest net annual
value after fees. The **Points & Redemption Optimizer** takes what you already
hold, values each currency by how you would actually redeem it, and tells you what
to burn first before it expires or devalues.

The interesting part is not the web app. It is the modelling underneath: an exact
assignment of spend to cards under reward caps, a valuation model that refuses to
invent numbers it cannot source, and an AI assistant that structurally cannot make
up a rate.

## What is actually hard here

### Assigning spend to cards is not greedy

The obvious approach is to walk each spending category and send it to whichever
card pays best. That is wrong, and it is wrong in a way that quietly overstates
every recommendation.

Reward caps are the reason. A card might pay 10% on groceries but only on the
first AED 1,000 a month, and that cap is often shared across several categories.
If you greedily fill a capped bonus with groceries, you can starve dining, which
had no other good home, while the groceries would have been nearly as well served
by a second card. The categories compete for the same limited capacity, so the
right choice for one depends on the choice for all the others.

So the engine solves it exactly, as a **min-cost max-flow** problem:

```
source --[monthly spend]--> category --[eligible]--> earn option --[reward cap]--> sink
```

Each category is a source of spend, each way a card can earn is a sink whose
capacity is its reward cap, and the cost of an edge is the inverse of its yield.
Minimising total cost maximises total reward, because every valid assignment
routes the same total flow. When a cap fills, the overflow reroutes to the next
best option automatically, which is what happens in real life: a full bonus cap
means no more bonus, not no more earning, so that spend falls back to the base
rate or to another card.

One function, `earnAcrossCards`, is the single source of truth for this. Scoring
one card is literally `earnAcrossCards([card])`, so a card scored alone and the
same card as a one card portfolio agree by construction rather than by luck.

### Exhaustive search is the correct choice at this size

Portfolio value is not additive. Two cards can be complementary or redundant, so
you cannot rank cards individually and take the top three. The only way to
guarantee the optimum is to evaluate every subset.

With 53 cards, sizes 1 to 3 give just under 25,000 subsets, and fewer once
eligibility filtering drops the cards you cannot get. That is small. Each subset
runs the flow solve above, and a full optimisation takes roughly a second. Being
approximate here would buy nothing and cost correctness, so the engine enumerates
everything, and the reasoning is written into the code rather than assumed. If the
card universe ever grew by an order of magnitude this would need revisiting, and
that is noted too.

Ties break deterministically: highest net value, then fewer cards, then lower
fees, then card id. The "fewer cards" rule matters, because a third card that only
matches the value of two is not worth carrying.

### Valuation is per redemption route, not per currency

A mile is not worth one number. It is worth one number if you fly economy, a
different one in business, and something else again as a statement credit. Engine
2 models each currency as a set of named routes, each with its own AED value, its
own confidence, and a flag for whether it can become cash at all. Nol credit pays
face value but only for transit. ADCB TouchPoints have an in store route and no
card bill route. The recommender picks the best route for the goal you asked
about, instead of collapsing everything into an average that is wrong for
everyone.

Every value carries a confidence of high, medium or low, and unresearched
currencies get a conservative placeholder that is explicitly marked as one. The
engine will tell you when it does not know something rather than quietly guessing.

### Never fabricating a rate

Card data is genuinely messy. Rates arrive as `"5%"`, `"1.5 miles per USD 1"`,
`"Up to 10%"`, `"3.5 miles per AED 10"`, and occasionally `"Variable"`. The
normalizer parses what it can and assigns a confidence tier. What it will not do
is invent a value for something it cannot parse.

An unbounded "up to" rate becomes a range with no upper bound rather than a
convenient point estimate, and that uncertainty propagates all the way through to
the recommendation as a minimum and maximum. If a card's data is too broken to
score, it is benched visibly instead of being deleted or guessed at. If a card is
scoreable but has a known defect, it still ranks and carries a loud flag on every
result that uses it.

### Sensitivity analysis

A single best answer hides how fragile it is. Two sweeps measure that:

- **Valuation sensitivity** perturbs one currency's AED value and finds the point
  where the recommendation flips.
- **Spending sensitivity** sweeps one category's monthly spend and finds the
  threshold where one card overtakes another, which is the "is this annual fee
  worth paying" question reduced to a single number.

For a fixed portfolio, net value moves smoothly with either input. The
recommendation is the maximum across all candidate portfolios, so it traces an
upper envelope, and the kinks in that envelope are exactly where the winning card
set changes. The engine samples a grid, finds adjacent samples that disagree, then
bisects to locate the crossing. The reported break-even comes with an error bar,
and the tests assert that the hand-computed root falls inside the reported
bracket rather than at a rounded literal.

This feeds back into honesty. When a recommendation only holds within a few
percent of a valuation we admit we never researched, the receipt says so. That
check fires on the real dataset today.

### Burn and expiry timing

Points expire, and programs devalue on announced dates. The burn engine ranks
holdings by urgency, then by how much AED is at risk, then by how few escape
routes a currency has.

The constraint that shaped it: urgency is only claimed when an expiry can actually
be dated. An explicit date from the user is ground truth. A known program policy
plus an earned date lets us project one, flagged as an estimate. A policy with no
date to anchor it to gives you the policy as information and an urgency of
unknown. No false alarms.

The same reasoning settled RAKBANK's 15 month cashback window. Discounting the
card's value for it would have meant guessing how often the user redeems, so
Engine 1 states the term as a fact and Engine 2 dates it against the user's real
timeline.

### Rafiq cannot lie about a rate

Rafiq is the chat assistant. It runs on Gemini and has no card knowledge at all.
The engine is the brain, the model is the mouth.

The model's only job is to read a messy question, pick a tool, and phrase the real
result. Three things enforce that:

1. The system prompt forbids stating any card fact without a tool call, and the
   model is given no card data to begin with.
2. Every number the user sees is returned in a structured `data` field straight
   from the engine, and the UI renders from `data`, not by parsing the prose. A
   jailbroken model still cannot touch `data`. It only ever gets to phrase.
3. The tool layer validates every argument. An unknown merchant comes back as
   "unrecognized", an unknown card as "no data". The model cannot talk the engine
   into producing a fact that is not there.

If Gemini is missing or failing, the assistant degrades instead of throwing. Where
an engine result already exists, it gets phrased deterministically and the numbers
stay real.

## Architecture

```
fils/
  apps/web/          Next.js App Router. UI plus /api routes that call the engine.
  packages/engine/   Pure TypeScript. Domain models, normalizer, both engines, tests.
  packages/db/       Prisma schema, migrations, seed, typed data access.
```

pnpm workspaces, TypeScript in strict mode throughout, deployed on Vercel with
Postgres on Neon. Auth is Clerk.

`packages/engine` is the core, and it is deliberately framework free. No Next.js,
no Prisma, no Node only APIs, no I/O of any kind. Every function is pure and
deterministic, which is what makes the modelling testable on its own and portable
if it ever needs to run somewhere other than a Next.js API route. Caps bind or do
not bind based on what the user actually typed. Nothing about spend levels is
hardcoded.

The Clerk middleware deliberately protects nothing by default, because the
optimizer is meant to answer anonymous requests. Routes that need a user enforce
it themselves at the point of use, which fails safe as new routes get added.

## Running it locally

Requires Node 24 or newer, pnpm 11 or newer, and a Postgres database.

```bash
pnpm install
pnpm --filter @fils/db migrate   # create and apply migrations on your dev database
pnpm --filter @fils/db seed      # load the 53 cards (idempotent, upserts by card id)
pnpm dev                         # http://localhost:3000
```

The app reads cards from Postgres rather than from the JSON file. The database is
a queryable copy of `cards.json` produced by the seed script. There is no admin
write path yet, so editing card data means editing the JSON and re-seeding.

Environment variables:

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `packages/db/.env`, `apps/web/.env.local` | Pooled connection |
| `DIRECT_URL` | same | Direct connection, used by migrations |
| `GEMINI_API_KEY` | `apps/web/.env.local` | Rafiq, server side only. Optional; without it Rafiq degrades cleanly |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/web/.env.local` | Auth |

Other commands:

```bash
pnpm test                    # engine test suite
pnpm typecheck               # every package
pnpm --filter web test       # API route and lib tests
pnpm --filter @fils/db test  # database layer, including the safety guard
pnpm build                   # production build
```

### Development and production databases are separate

Two independent Postgres databases, and the split is enforced in code rather than
by convention. Production holds the live cards and real users, and its connection
string exists only in Vercel's environment variables. Development is a separate
database that is safe to reset and reseed, and its connection string lives only in
local `.env` files.

`packages/db/src/guard.ts` throws if any non production context is pointed at the
production host. Local dev, the test runner and a local seed are all blocked. The
production database is allowed only when `NODE_ENV` is production, meaning the
Vercel runtime, or behind an explicit `FILS_ALLOW_PROD_DB=1` opt in for a
deliberate one off operation. The guard is wired into both the database client and
the seed script, and it has its own regression tests.

This exists because a stray `prisma migrate dev` pointed at the wrong URL can
reset a production database, and no amount of being careful reliably prevents
that. A guard does.

## Testing

Tests run on vitest and sit next to the code they cover.

The part worth mentioning is that the modelling is checked against arithmetic
worked out by hand, not against whatever the code happened to return. Cases use
small synthetic cards with round numbers so the expected value can be derived in
the test's own comment and verified independently. A few real examples: a
complementary pair of 10% cards beating the single strongest 6% card, a capped
bonus overflowing to a second card at exactly the right split, and a fee carrying
card overtaking a free one at precisely AED 1,666.67 of monthly spend.

The card data is checked structurally as well. `cards.json` is validated against
the `Card` type at compile time using `satisfies` rather than a cast, so a data
file that drifts from the model fails `typecheck` instead of failing quietly at
runtime. The few fields TypeScript cannot narrow from a large JSON import are
re-checked at runtime in the same test file.

## Data

`packages/engine/data/cards.json` is the source of truth: 53 UAE cards, hand
verified, each with a source URL. Changes are tracked in
`CARD_DATA_CHANGELOG.md`. Cards with unresolved data problems are either benched
from scoring or flagged, and both states are visible in the output rather than
hidden.
