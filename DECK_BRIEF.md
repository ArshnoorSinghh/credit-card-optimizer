# Brief for the pitch-deck session — state of Fils as of 2026-08-16

Hand this to the Claude session that owns the deck. It assumes **no prior context** and
is written to be actionable without asking follow-up questions.

Deadline: **Hub71 cohort 20 closes 21 Aug 2026** — five days out.

---

## 0. Read this first: three claims in the current deck are now wrong

Fix these before touching layout. Each is a factual correction, not a preference.

1. **"Nobody else in the UAE does portfolio selection."** ❌ **False as of today.**
   Card Stack Builder (Yalla Calculators, Dubai) covers **147 UAE cards across 16
   banks**, optimises **1–5 card** portfolios, nets annual fees, and models category
   caps, minimum-spend gates and devaluation. It is **free, no signup.** An investor
   finds it in 30 seconds. Cut the claim.
2. **"Sikka is our direct consumer competitor at AED 49/month."** ❌ **Out of date.**
   Sikka is now a **B2B payment decision layer sold to processors** — platform fee plus
   per-recommendation usage fee, shadow deployments, SLAs, "No PAN. No CVV.". No
   redemption, no expiry, no portfolio selection.
3. **Any retention claim based on the calendar.** ❌ **Not true yet.** The deadline
   calendar ships as engine + screen, but there is **no email, no scheduled job and no
   persistence for points holdings**. A calendar you must remember to visit is not a
   retention mechanism. Correct line: *"the deadline maths is built and tested;
   delivery is the next build."*

Full competitive detail is in `COMPETITION.md` at the repo root — read it before
writing the competition slide.

---

## 1. What Fils is

A UAE credit-card optimisation platform. Two engines, both pure TypeScript:

- **Engine 1 — Card Optimizer.** Given a spending profile, salary and eligibility,
  returns the best 1–3 card portfolio by net expected value (rewards − fees), via
  exhaustive subset enumeration with a min-cost max-flow allocator underneath. Respects
  reward caps, minimum-spend gates, excluded categories and per-category rates.
- **Engine 2 — Points & Redemption Optimizer.** Point inventory, per-redemption-route
  valuation, redemption recommendations, conversion break-evens, expiry/burn priority,
  devaluation tracking, and (new today) a deadline calendar.

**53 cards across 12 banks**, hand-verified, with every correction recorded in
`CARD_DATA_CHANGELOG.md` (sections D1–D19). 4 cards are marked do-not-publish because
their data could not be sourced honestly; 2 are closed to new applicants.

---

## 2. Current verified state (2026-08-16)

| | |
| --- | --- |
| Engine tests | **424 passing**, 3 skipped |
| Web tests | **140 passing** |
| Typecheck | clean — engine, web, db |
| Production build | clean |
| Cards | 53, across 12 banks |
| Live product | **open** — the invite-only gate and waitlist were removed today |

**Shipped today, all on the branch below:**
- Merged an independent contributor's parallel work on the same two selection biases.
- Removed the waitlist + invite-only gate — the product is reachable again.
- **Deadline calendar**: engine (`deadline-calendar.ts`) + `/calendar` screen.
- **Cap thresholds**: "after AED 6,000 of groceries this month, switch to X."
- **Statement-check harness**: compares predictions to what a bank actually paid.
- **Competition brief** (`COMPETITION.md`), verified against live competitor sites.

---

## 3. Pull request state — the deck cannot claim "live" yet

- Branch `fix/rate-ceiling-bias`, **PR #5**, **12 commits ahead of `main`**, **not
  merged**.
- **Vercel is blocking the deployment.** First cause (commit author email not
  resolvable to a GitHub account) is fixed. The likely remaining cause is that the
  RadicatStudios GitHub account is not connected to the Vercel `fils` team — an access
  grant only the team owner can make.
- **`main` still deploys the older engine**, without this month's card-data corrections
  or two of the three bias fixes.

**Implication for the deck:** the improved engine is on a branch, not in production. If
the deck says "live product", say what is live — the site and the optimizer — and do
not imply the corrected numbers are what a visitor sees today.

---

## 4. The numbers — and which may be spoken aloud

Source: gap study, 2026-08-09, **200 modelled profiles, not observed spend**. Anything
quoted must be labelled *modelled*.

**SAFE to use:**
- **AED 766/year** — median gain of the optimiser over the user's **best single card**.
  *This is what the optimiser is actually worth.*
- **AED 447/year** — p25 of that same gap, i.e. **≥75% of modelled profiles clear AED
  447/yr measured against their own best single card.** This is the affordability stat.
- **20.5%** — card-rejection rate after the merchant-share work (down from 38.7%).

**DO NOT use:**
- ❌ **AED 5,080 "gap vs naive"** as the optimiser's value. It is dominated by "your
  bank gave you a bad card", which a free comparison table also delivers. Using it
  claims credit for the part that was not built — and it is the number the current deck
  leads with.
- ❌ **Any %-of-spend figure.** Median 5.87% with p90 7.28%, against the project's own
  stated bar that ">8% of total spend does not exist", is too close to the
  impossibility line to headline.
- ❌ **"We now cover 31 cards instead of 22"** as if it were more value. It is not — see
  the null result below.
- ❌ **"Validated against real statements."** The harness exists; it has not been run on
  real data. Until it has, it is a harness, not a claim.

---

## 5. The strongest material — lead with these

The deck currently leads with the algorithm. That is the hardest-built and
least-valuable part. Lead instead with **why these numbers can be trusted**, which is
genuinely unusual and hard to copy.

1. **"We caught our own engine overstating by 78x, and we can show you the test that
   stops it recurring."** An audit found recommended portfolios were unachievable — the
   min-spend gate was judged on total profile spend, so a recommended 3-card split
   starved the thresholds it assumed were met. One profile claimed AED 9,859/yr and was
   actually worth AED 127. Found by the engine's own gap study, fixed, regression-locked.
2. **A published null result.** Asking users their co-brand merchant share added 9 cards
   to the publishable universe and moved the answer by **0.01 percentage points**
   (5.86% → 5.87%); on the five segment centres the recommended portfolio was
   **identical to the dirham**. The co-brand cards' apparent edge was an assumption, not
   the cards. *A team that publishes its own null results is the signal.*
3. **Three selection biases found and removed**, each invisible per-card and only
   detectable across a population: scoring "Up to X%" ceilings as certain; crediting
   merchant-locked bonuses across a whole category; ranking on a midpoint rather than a
   floor.
4. **Two filters that measured nothing** while looking exactly like filters with nothing
   to reject — both inflated the headline. Now declared as named data and CI-asserted to
   match real flags.
5. **Uncertainty is modelled and visible.** Unverified rates propagate as ranges, every
   rate string is confidence-tiered, an expiry that cannot be sourced is never dated, and
   the UI shows a "we can't answer this yet" list rather than hiding it. Competitors show
   point figures with no confidence surface.

---

## 6. Competition slide — suggested framing

In this order:

> **Direct portfolio optimisation exists, and it is free.** Card Stack Builder covers
> 147 UAE cards. We cover 53 — each hand-verified, every correction written down, six
> deliberately held back because the data could not be sourced honestly.
>
> **What nobody does is the second half.** Points valuation per redemption route, expiry
> and burn timing, devaluation, and a deadline calendar. That is where a recurring
> reason to return lives, and it is the half a free calculator has no reason to build.
>
> **And nobody validates.** We compare predictions against real statements and report
> whether our stated range contained what the bank actually paid.
>
> **Sikka — the funded local player — moved from consumer to B2B infrastructure.** We
> think the consumer answer is trust, not routing.

**Say the 147-vs-53 gap first.** There is no spin for it, and getting in front of it is
the only version that reads as confidence rather than omission.

**One differentiator worth a line of its own:** Card Stack Builder is monetised by
**affiliate links on card applications**. That incentive rewards getting a user to
*apply*. A subscription rewards being *right*. Paired with publishing null results, that
is a position a free affiliate-funded calculator structurally cannot take.

---

## 7. Pricing

Benchmarks (not re-verified today): MaxRewards $39.99–60/yr, 900k+ members, $3M seed;
CardPointers $72/yr **and** $240 lifetime side by side; Kudos $17.2M raised. CardPointers
running both models is the answer to *"why subscription, not one-time."*

**What changed:** the local anchor is no longer AED 49/month — it is **free**. The
landing-page price test has still never been run, so **every pricing number in the deck
is inference from competitors.** Do not present one as validated demand.

---

## 8. Hard rules

- Label every figure **modelled**. No real user has been measured.
- Never claim retention, validation, or "nobody else does this" — see §0 and §4.
- Understating is the safe direction and it is also the better pitch. The strongest
  version of this deck leads with *"here is what we refuse to claim, and here is the
  test that stops us"*, not with a return figure.

---

## 9. Still open (do not present as done)

1. **Validate against 3–5 real statements** — blocking for credibility. The harness is
   built; it needs real statements.
2. **Run the landing-page price test** — never done.
3. **Merge PR #5 and unblock the Vercel deploy** — needs a Vercel team access grant.
4. **`/calendar` has not been visually reviewed** — it typechecks, builds and serves,
   but nobody has looked at it.
