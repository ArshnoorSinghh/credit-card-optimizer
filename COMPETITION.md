# Competition — verified 2026-08-16

The deck has no competition slide. This is the material for one, checked against the
live sites today rather than from notes. **Two things changed since the last look, and
one of them kills a claim the pitch currently rests on.**

Everything below is marked `[verified 2026-08-16]` (read off the company's own site
today) or `[inferred]`. Do not put an inferred line on a slide as fact.

---

## 1. Sikka has left the consumer market

The previous read was: Sikka is a direct UAE consumer competitor doing transaction
routing at AED 49/month, alpha stage, WhatsApp bot.

**That is no longer what Sikka is.** `[verified 2026-08-16, usesikka.com]`

It is now a **B2B payment decision layer sold to processors** — an API that scores
which card should fund a transaction and hands the answer back to existing payment
infrastructure. Concretely:

- Pricing is a **platform fee + per-recommendation usage fee**, enterprise terms,
  not a consumer subscription.
- Deployments run in **shadow mode** first, comparing recommendations against actual
  outcomes; there is an SLA and a pilot gate.
- **"No PAN. No CVV."** — it never touches accounts. The *processor* supplies the
  eligible card set.
- Features are per-transaction ranking, cap tracking, eligibility, reason codes,
  deterministic replay. **No redemption, no expiry, no portfolio selection.**

**What this means for the pitch.** The "direct UAE consumer competitor" framing is
out of date, and using it would be the kind of error a UAE investor catches
immediately. Two readings, and the slide should acknowledge both:

- *Favourable:* the consumer lane they occupied is now empty of them.
- *Unfavourable, and more likely the honest one:* a funded UAE team looked at
  consumer card-optimisation economics and moved up the stack to sell infrastructure
  instead. **That is a data point about the consumer market, not about Sikka.** If
  asked "why did Sikka move B2B and why won't you have to", have an answer.

---

## 2. The real competitor is a free calculator, and it has 3x the card coverage

**Card Stack Builder**, by **Yalla Calculators** (Dubai). `[verified 2026-08-16]`

This does what Fils's Engine 1 does. Not adjacently — the same thing:

| | Card Stack Builder | Fils |
| --- | --- | --- |
| UAE cards covered | **147**, across 16 banks | **53** |
| Data freshness | re-verified **monthly**, "last verified 2026-08-11" shown | ad-hoc, D-series passes |
| Portfolio size optimised | **1–5 cards** | 1–3 cards |
| Nets annual fees | yes | yes |
| Category caps | yes | yes |
| Minimum-spend gates | yes | yes |
| Points devaluation | modelled | modelled |
| Eligibility filtering | emirate + salary | salary + residency |
| Complexity penalty | **AED 200/yr per card beyond the 2nd** | none |
| Price | **free, no signup** | subscription (planned) |
| Business model | affiliate links on apply buttons (disclosed) | subscription |

They even have a heuristic Fils does not: an explicit complexity penalty for carrying
more cards.

### The claim this kills

> "Fils does portfolio *selection* — which cards to hold — and nobody else in the UAE
> does."

**That is now false**, and it is 30 seconds of searching away from any investor who
looks. It must come out of the deck. The related claim — that constrained
combinatorial optimisation is the moat — should go with it. Your own notes already
concluded the optimiser is *data-bound, not algorithm-bound*; this is external
confirmation of that, and it is the single most important correction here.

### The coverage gap is real and quotable against you

147 versus 53. There is no spin for this. Either close it, or get in front of it: the
53 are hand-verified with a written changelog of every correction, and 6 are held back
because the data could not be sourced honestly. "Fewer cards, each one defensible" is
a real position — but only if you say it first.

---

## 3. What is actually differentiated

Checked against Card Stack Builder's own pages, not assumed. `[verified 2026-08-16]`

**1. Engine 2 has no counterpart.** Their points treatment is "minimal" — earn rates
listed without redemption value, one card showing a stated valuation, no systematic
expiry tracking, no devaluation history, no miles-to-cash equivalence. Fils has
per-route valuation, a redemption recommender, burn priority, conversion break-evens,
and now the deadline calendar. **This is the strongest true differentiator and the
deck currently under-sells it.**

**2. Uncertainty is modelled and visible.** Their grid presents point figures; there
is no confidence scoring, no ranges, and no published methodology for a rate they
cannot verify. Fils propagates unverified rates as ranges, tiers every rate string by
confidence, refuses to date an expiry it cannot source, and shows the "we can't answer
this yet" list rather than hiding it. That is unusual, it is hard to retrofit, and it
is the thing your engineering culture is actually built around.

**3. Nobody validates.** As of today Fils has a statement-check harness that compares
predictions to what a bank actually paid, in reward units, scored on whether the range
contained reality. Neither competitor claims any validation. **Once you have run it on
real statements this is the strongest slide in the deck** — and until you have, it is
not a claim, it is a harness.

**4. Incentive alignment, and this one is worth saying out loud.** Card Stack Builder
is one of 25 free calculators from a business monetised by **affiliate links on card
applications**. They disclose it and say it does not influence ranking, and that may
well be true — but the incentive is to get a user to *apply for a card*. A
subscription's incentive is to be *right*. Paired with "we publish our own null
results", that is a credible and genuinely differentiating position on trust.

---

## 4. Pricing, revisited

Prior benchmarks `[from earlier research, not re-verified today]`: MaxRewards
$39.99–60/yr with 900k+ members and a $3M seed; CardPointers $72/yr **and** $240
lifetime side by side; Kudos $17.2M raised.

CardPointers running both models remains the answer to "why subscription, not
one-time".

**What changed:** the local anchor is no longer AED 49/month. It is **free**. The
price test (still un-run) now has to answer a harder question — not "how much", but
"will anyone pay anything when a free UAE tool covers 147 cards". Run it against the
real alternative, not against a competitor who has left the market.

---

## 5. What to put on the slide

Suggested framing, in the order it should be read:

> **Direct portfolio optimisation exists and is free.** Card Stack Builder covers 147
> UAE cards. We cover 53, each hand-verified, with every correction written down.
>
> **What nobody does is the second half.** Points valuation per redemption route,
> expiry and burn timing, devaluation, and a deadline calendar. That is where the
> recurring reason to come back lives, and it is the half a free calculator has no
> reason to build.
>
> **And nobody validates.** We compare our predictions against real statements and
> report whether our stated range contained what the bank actually paid.
>
> **Sikka, the funded local player, moved from consumer to B2B infrastructure.** We
> think the consumer answer is trust, not routing.

Do not claim retention that is not built: the calendar has no email, no scheduled job
and no persistence for holdings. The honest line is *"the deadline maths is built and
tested; delivery is the next build."*

---

## Open questions this raises

1. **Is 147 real, and is it good?** Worth an hour checking whether their 147 includes
   discontinued or closed-to-new-applicants products, and whether their rates match
   yours on the ~53 you both cover. **If your data disagrees with theirs on cards you
   have hand-verified, that is a slide of its own** — and the D-series changelog is
   the evidence.
2. **Does their optimiser handle the biases you found?** They model caps, gates and
   devaluation. Do they score "Up to 10%" at the ceiling? Do they credit a co-brand
   merchant bonus across a whole category? If so, their numbers are inflated in
   exactly the ways you spent this month removing — and you can demonstrate it.
3. **Why did Sikka move B2B?** Have an answer before you are asked.
