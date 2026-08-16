# Deadline Calendar — specification

**Status:** BUILT 2026-08-16 — engine (`deadline-calendar.ts`, `cap-thresholds.ts`,
`devaluations.ts`) and the `/calendar` screen. Engine 407 tests, web 140. No new
persistence, no email — see "Deliberately out of scope" and "What this needs before it
is a real product feature", which is the honest limit on any retention claim.

**Why it exists.** Fils answers an *annual* question — which cards should you hold.
That is a once-a-year reason to open the app. Sikka, the direct UAE competitor, answers
a *daily* question (which card for this purchase) and therefore has the better retention
shape. The calendar is the answer: recurring, dated, per-user reasons to come back, built
on engine work that already exists and that a transaction-routing product has no
equivalent of.

---

## 1. The core problem: a calendar demands dates, and this engine refuses to invent them

`burnPriority` will return `urgency: "unknown"` rather than guess an expiry. That is the
right behaviour and it is load-bearing — `expiry-policy.ts` says so explicitly:

> These are program POLICY, not per-user confirmed expiries. Every entry is flagged as
> an estimate downstream, and is used to inform, never to manufacture urgency.

A calendar UI inverts that pressure. Every row on a calendar looks equally real, and the
things that *cannot* be dated simply do not appear — which the user reads as **"nothing is
coming up"**. That is a false statement produced by omission rather than by fabrication,
and it is the same shape as the two defects this project has already caught (a filter that
matched nothing looked exactly like a filter with nothing to reject).

Two structural consequences, both non-negotiable:

1. **Every event carries a `certainty`**, and the UI renders the three tiers differently.
2. **Undateable deadlines get their own visible list**, never silent omission. "We know
   your Etihad miles expire, tell us when you earned them" is a calendar entry. It is also
   the highest-intent data-collection prompt in the product.

---

## 2. Event model

New pure module: `packages/engine/src/deadline-calendar.ts`. No I/O, `asOf` passed in,
same shape as every other engine module.

```ts
export type DeadlineKind =
  | "points_expiry"
  | "devaluation"
  | "fee_renewal";

export type DeadlineCertainty =
  /** A date the user gave us, or one the program publishes. */
  | "dated"
  /** Program policy applied to a user-supplied anchor date. An estimate, and said so. */
  | "projected";

export interface DeadlineEvent {
  kind: DeadlineKind;
  /** ISO date. */
  date: string;
  daysAway: number;
  certainty: DeadlineCertainty;
  title: string;
  detail: string;
  /** AED at stake, ONLY when it can be computed without an assumption. */
  valueAtRiskAed?: number;
  /** What to do about it. A deadline with no action is an anxiety generator. */
  action?: string;
  flags: string[];
}

/** A deadline we know EXISTS but cannot place on a date. Never hidden. */
export interface UndatedDeadline {
  kind: DeadlineKind;
  title: string;
  /** Why we can't date it, and the exact thing that would fix it. */
  reason: string;
  /** The question to ask the user, ready to render. */
  prompt: string;
}

export interface DeadlineCalendar {
  asOf: string;
  /** Dated events, soonest first. */
  events: DeadlineEvent[];
  undated: UndatedDeadline[];
  flags: string[];
}
```

`certainty` has only two members on purpose. The third tier ("estimated" — derived from a
behavioural assumption) was designed out; see §4.

---

## 3. Sources

### 3a. Points expiry — wraps `burnPriority`, no new maths

`burnPriority` already returns everything needed, including the three-way
`expirySource: "explicit" | "projected_default" | "unknown"` that maps exactly onto this
model. The calendar is a **projection of existing output**, not a second implementation:

| `expirySource` | Calendar |
| --- | --- |
| `explicit` | event, `certainty: "dated"` |
| `projected_default` | event, `certainty: "projected"`, carrying `burnPriority`'s own flag text |
| `unknown` | `undated`, prompt taken from `resolveExpiry`'s existing message |

`valueAtRiskAed` comes free from `BurnItem.valueAtRiskAed`. `action` comes from
`recommendRedemptions` where a route exists.

**Rule: the calendar must never compute an expiry itself.** If `burnPriority` cannot date
a holding, neither can the calendar. A test asserts every `points_expiry` event's date
appears in the corresponding `BurnItem` — this is what stops the two drifting.

### 3b. Devaluations — dated, from `DEVALUATIONS`

Filtered to `effectiveDate >= asOf` **and** to currencies the user actually holds. Always
`certainty: "dated"`. Action: "burn premium redemptions before this date".

> **⚠️ Defect found while specifying this (2026-08-16).** `DEVALUATIONS` has exactly one
> entry — Skywards, effective **2026-05-20**, which is three months in the past.
> `burnPriority` filters to future dates, so it currently warns about nothing, silently.
> The table has rotted and nothing detects it.
>
> **FIXED 2026-08-16.** The table moved to its own `devaluations.ts` (the precedent
> `expiry-policy.ts` set) and gained `DEVALUATIONS_REVIEWED_ON` — a table-level sweep
> date, updated whenever anyone *checks*, even if nothing changes. That is the only
> thing that distinguishes "no upcoming devaluations" from "nobody has looked".
>
> Per-entry dates would NOT have caught this: the Skywards entry was correct when
> written and stayed correct. What went stale was the sweep, not the fact.
>
> Staleness surfaces as a calendar **flag**, not a failing test. A test that broke
> purely because time passed would be silenced by bumping the date rather than by doing
> the sweep, converting a real signal into a ritual. And there is deliberately **no**
> test requiring a future entry — "no devaluation is currently announced" is a
> legitimate state, and demanding one would invite inventing one to get CI green.
>
> The Skywards entry is retained rather than deleted: it is the reason
> `redemption-valuations.ts` models Skywards premium as a user multiplier instead of a
> fixed number, and deleting it would leave that decision looking arbitrary. Consumers
> filter by date via the now-shared `upcomingDevaluations`.

### 3c. Annual-fee renewal — the strongest entry, and it needs one date we don't have

`computeFees(card)` gives `ongoingFeeAed` and any waiver. What is missing is *when the
card renews*.

**`SavedCard.createdAt` must not be used for this.** It records when the user added the
card to Fils, not when they opened it with the bank. Treating one as the other is exactly
the class of error this codebase keeps catching — a plausible number standing in for an
unknown one. So:

- anniversary known → event, `certainty: "dated"`, 30 days before renewal
- anniversary unknown → `undated`, prompt "when did you open this card?"

This is the best entry in the calendar because the action is not "spend your points" —
it is **"is this card still worth its fee?"**, which Engine 1 already answers. The event
carries a re-score of that single card against the user's current spending, so the row
reads:

> *ADCB TouchPoints renews on 12 Sep — AED 525. On your spending it now earns AED 380/yr.
> Review.*

That is the optimizer's whole value proposition delivered as a notification, once a year,
per card, without the user asking. It is also the number that most often changes after a
data pass, which makes it a reason for the *product* to contact the user rather than the
other way round.

---

## 4. Cap crossings: a spend threshold, not a date

Putting a cap crossing on a calendar requires computing a crossing *day*:

```
crossing_day ≈ cap_aed / monthly_category_spend × days_in_month
```

That assumes spend is **uniform through the month**, which is false in general and
specifically false in the UAE: school fees, rent and DEWA are lumpy, and salary lands
near the 25th. The assumption would be invisible in the output and indefensible in
diligence — the same defect shape as scoring an "Up to 10%" ceiling as a certain rate.

The honest form of the same fact needs **no assumption at all**:

> *After AED 6,000 of grocery spend this month, ADCB stops paying 5% — switch to
> Emirates NBD.*

This is exactly true, it is more actionable than a date, and `which-card.ts`
(`bestCardForCategory`) already computes the "switch to" half. It ships as a **spend
threshold panel beside the calendar**, not as a calendar event, and therefore does not
enter `DeadlineEvent` at all — which is why `DeadlineCertainty` has no "estimated" tier.

This is also the piece that answers Sikka structurally: it is a recurring, per-purchase
reason to open the app that falls out of the portfolio maths rather than requiring
transaction data.

**Built as `cap-thresholds.ts`.** Two things the implementation added to this design:

- Each cap is reported **in its own period** and never converted between them. A
  monthly cap is a fact about a month; annualising it (or dividing an annual cap into
  months) would smuggle the uniform-spend assumption back in through the side door.
  `optionSpendThresholds` in `score-card.ts` exists for exactly this and shares its cap
  arithmetic with `optionCapacityAnnualAed`, so the two cannot drift.
- A **range rate gets no threshold at all**. An unstated merchant bonus is bounded
  0..full and routes on the midpoint; dividing a cap by that midpoint yields a
  confident number roughly *double* the truth. Those go to `unstated` with the reason,
  mirroring the calendar's `undated`.

**A float bug this surfaced, worth recording.** fab_cashback pays 5% capped at AED
150/month — exactly AED 3,000 of spend. Through the cap→units→AED chain that lands on
`2999.9999999999995`, so a user spending precisely AED 3,000 "exceeded" it by 4.5e-13
and the screen printed **REACHED** beside two numbers both rounded to "AED 3,000". Found
by rendering the real page, not by a test. Ties now resolve to *not* reached, which is
also the conservative direction — it never tells someone to stop using a card whose
bonus is still paying.

---

## 5. Delivery

### Engine (`packages/engine`)
- `deadline-calendar.ts` — pure, `asOf` injected, composes `burnPriority`,
  `DEVALUATIONS`, `computeFees`. No new domain maths.
- `cap-thresholds.ts` — per (card, category) remaining-AED-to-cap plus the switch target
  from `bestCardForCategory`.
- Tests: certainty mapping per `expirySource`; undated never silently dropped; ordering;
  devaluation filtered by holdings AND by date; a card with no anniversary produces an
  `undated` entry rather than a guessed one; the drift test in §3a.

### App (`apps/web`)
- `lib/calendar.ts` — thin wrapper, same "call the engine, never reimplement it" pattern
  as the existing `lib/redemptions.ts`.
- `app/calendar/page.tsx` — timeline of dated events grouped by month; a distinct
  "we can't date these yet" block; the threshold panel. Certainty rendered as a visible
  distinction, not a tooltip.

Inputs for this pass come from existing session state (points-page holdings, saved cards,
`savedSpending`). The calendar therefore resets on reload — acceptable for a demo, and
called out below.

### Deliberately out of scope for this pass
Persistence, the anniversary question, email/push, and any scheduled job.

---

## 6. What this needs before it is a real product feature

Stated plainly so the demo is not mistaken for the feature:

1. **Points holdings are not persisted.** The points page holds them in `useState` with
   `DEFAULT_HOLDINGS` demo data. Expiry deadlines cannot survive a reload until a
   `PointsHolding` model exists. This is the single largest build item.
2. **No card anniversary field.** Needs `SavedCard.openedOn DateTime?` plus the question
   in the UI. Until then every fee-renewal entry is `undated`.
3. **No delivery mechanism.** There is no transactional email, no cron, no `vercel.json`.
   A calendar the user must remember to visit is not a retention feature — the retention
   claim depends on a scheduled digest that does not exist yet.

Item 3 is the honest limit on the pitch claim. The defensible version is *"the deadline
maths is built and tested; delivery is the next build"*, not *"we have retention"*.
