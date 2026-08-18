# Deadline calendar — handoff to Arshnoor

**Written 2026-08-18.** Branch `fix/rate-ceiling-bias`, PR #5. Everything below is on
that branch and pushed.

The calendar is wired to real user data and it works. It is **not production ready**,
and the remaining work is gated on things only you can do: the `.env` files, the Vercel
project, and a production database migration. This document is the state, the mechanism,
and a prompt you can paste into a Claude Code session to finish it.

---

## 1. What landed this session

| Commit | What |
| --- | --- |
| `280caf2` | Empty commit to re-trigger Vercel after the repo went public. The four red deploys on PR #5 were authorization blocks, not build failures, and Vercel never re-runs those. |
| `363036d` | Removed em dashes from every string the app displays (UI copy, engine-emitted flags, API messages, and the `data_caveat` notes rendered on `/cards/[id]`). Comments and docs keep theirs. |
| `0843a9a` | Two copy defects in the cap threshold panel: the storage key leaked into prose ("AED 3,000 of **other** this month"), and spend sitting exactly on a cap printed the same figure twice then denied it. |
| `5118224` | **The calendar wiring.** Detail below. |

**Test baseline on the branch:** engine **427 passing / 3 skipped**, web **149 passing**,
`tsc` clean in engine + web + db, production build clean.

`pnpm --filter @fils/db test` fails **24 of 35** — that is the missing `.env`, not a
regression. See section 4.

---

## 2. The problem that was fixed

The calendar rendered **zero dated events for a real user**. Measured by calling
`deadlineCalendar` directly, not inferred:

| Input | Dated events | Undated prompts |
| --- | --- | --- |
| Demo holdings (what the screen hardcoded) | 1 | 4 |
| Real user, no dates supplied | **0** | 4 |
| Real user, no points at all | **0** | 2 |

The single dated event came from `DEFAULT_HOLDINGS`, a fixture in `lib/redemptions.ts`
that seeds an expiry five months out. `app/calendar/page.tsx` hardcoded
`usingDemoHoldings = useState(true)` and passed that fixture unconditionally — it never
read the user's points even if they had entered them on `/points`.

Three causes, each individually correct behaviour, compounding into an empty screen:

1. Points holdings had **nowhere to be stored** (`useState` on `/points`, lost on navigation).
2. No card carried an **opening date**, so every fee renewal was undated. `lib/calendar.ts`
   rightly refuses to substitute `SavedCard.createdAt` — that records when the card was
   added to Fils, not when it was opened with the bank.
3. **Nothing in the UI asked** for either date.

After the fix, supplying the dates takes it from **0 dated events to 3**: two fee
renewals with the real fee amounts, and a points expiry worth AED 2,220.

---

## 3. How the calendar works now

```
  /points  ──edits──┐
                    ├──▶  profile store  ──▶  lib/calendar.ts  ──▶  deadlineCalendar()
  /calendar ─dates──┘     (sessionStorage)     (thin wrapper,          (pure engine)
                           pointsHoldings       computes nothing)            │
                           cardOpenedOn                                      ▼
                                                                    events[]  +  undated[]
                                                                    (dated)      (questions)
```

**The rule the whole feature is built on: it never invents a date.** If the user has not
said when their points expire, that deadline appears in `undated` carrying the question
that would fix it — it is never hidden, and never estimated into the timeline. An empty
calendar must not read as "nothing is coming up" when the truth is "nobody has told us
yet".

**Three sources feed it:**

- **Points expiry** wraps `burnPriority`. `expirySource: explicit` becomes a `dated`
  event, `projected_default` becomes a `projected` one (labelled "Estimated date" on
  screen), `unknown` becomes an undated question.
- **Fee renewal** needs `openedOn`. With it, an event 30 days before the anniversary.
  Without it, an undated question.
- **Devaluations** are filtered to currencies the user holds and to future dates. This
  source currently contributes **nothing** — see section 4.

**Cap thresholds are deliberately NOT on the timeline.** Putting a cap crossing on a
calendar means computing a crossing *day*, which assumes spend is uniform through the
month — false in the UAE, where rent, school fees and salary are lumpy. The honest form
needs no assumption: *"after AED 3,000 of groceries this month, FAB Cashback stops paying
5% — switch to Emirates NBD."* That ships as a panel beside the calendar.

**What changed in `5118224`:**

- `StoredProfile` gained `pointsHoldings` and `cardOpenedOn`; sessionStorage key bumped
  to `fils.profile.v3`.
- `/points` persists the user's **own** edits only, behind a `touched` flag. Sample rows
  are never persisted — promoting them would present 60,000 Skywards nobody owns as a
  deadline worth AED 2,220.
- `/calendar` reads real holdings and opening dates. `usingDemoHoldings` is now derived
  (`no holdings && !signedIn`), so a signed-in user never sees fixture data.
- A **"Fill in your calendar"** panel renders a date input per unanswered card and
  holding. This is the highest-intent data-collection prompt in the product: it asks one
  question, and answering it visibly adds a dated row.

**One bug worth knowing about.** `Date.parse("2024-02-31")` succeeds and silently rolls
forward to 2 March, so a mistyped date would have become a confident calendar entry two
days off with nothing showing it had moved. `isIsoDate` in `lib/profile-store.ts` now
round-trips `toISOString().slice(0,10)` against the input. Caught by a test, not by review.

---

## 4. Why it is not production ready

### 4a. Holdings and dates do not survive a session

They live in **sessionStorage**, the same position `merchantShares` has been in. They
survive navigation between screens, not a new session or a second device.

**This was deliberate, and the reason matters.** Vercel **Preview deployments run against
the PRODUCTION database** (`CLAUDE.md` > Databases; `guard.ts` treats `NODE_ENV=production`
as covering both). Shipping Prisma-dependent code before the migration is applied to prod
would **500 `/api/profile` for real users** on the live preview. And there are no local
`.env` files in the checkout, so `DATABASE_URL` / `DIRECT_URL` are unset — the migration
could be neither applied to DEV nor tested. That is also why the db test suite fails.

### 4b. The devaluation table has rotted

`DEVALUATIONS` holds exactly one entry (Skywards, effective **2026-05-20**, now in the
past). `upcomingDevaluations` filters to future dates, so that whole source warns about
nothing. This is not a bug and there is deliberately no test demanding a future entry —
"no devaluation is announced" is a legitimate state, and a test would invite inventing one
to get CI green. What it needs is a **research sweep**, then bumping
`DEVALUATIONS_REVIEWED_ON`. That field exists precisely to distinguish "nothing is coming"
from "nobody has looked".

### 4c. There is no delivery mechanism

No transactional email, no cron, no `vercel.json`. **A calendar the user must remember to
visit is not a retention feature.** Until a scheduled digest exists, the defensible pitch
line stays: *"the deadline maths is built and tested; delivery is the next build."*

### 4d. The fee-renewal row is missing its best half

`CALENDAR_SPEC.md` §3c designs the row as *"ADCB TouchPoints renews on 12 Sep — AED 525.
On your spending it now earns AED 380/yr. Review."* Today it carries only the fee. The
re-score is the optimizer's whole value proposition delivered as a notification, and it is
the reason this entry is worth more than a reminder.

---

## 5. What only you can do

1. **Create the `.env` files** with DEV database credentials. Nothing below can start
   without this. Templates: `packages/db/.env.example`, `apps/web/.env.example`.
   Needed: `DATABASE_URL` (pooled DEV) and `DIRECT_URL` (direct DEV).
2. **Confirm Vercel Preview env vars** cover `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY` and `DATABASE_URL` for the **Preview** scope, not only Production.
   A missing Clerk publishable key fails a production build on *every* route, because
   `ClerkProvider` wraps the root layout.
3. **Run the production migration** when the time comes. Per `CLAUDE.md`, that is a
   deliberate reviewed operation: `prisma migrate deploy` against prod, or a one-off with
   `FILS_ALLOW_PROD_DB=1`. The guard blocks a plain local run on purpose.
4. **Merge PR #5.** `main` still deploys the older engine, without this month's card-data
   corrections or two of the three selection-bias fixes.

**Deploy order matters.** Apply the migration to prod **before** merging schema-dependent
code, or the live preview breaks for real users.

---

## 6. Prompt to finish the feature

Paste this into a Claude Code session at the repo root, once the `.env` files exist.

````
Finish the Fils deadline calendar so it is production ready.

READ FIRST, before writing any code:
  - CALENDAR_HANDOFF.md (this handoff)
  - CALENDAR_SPEC.md, especially section 6
  - CLAUDE.md, especially the Databases and Engine principles sections

NON-NEGOTIABLE CONSTRAINTS:
  - packages/engine is human-owned. Explain your reasoning, comment the maths, and
    introduce no valuation or optimization logic that has not been reviewed.
  - The engine must never invent a date. If a deadline cannot be dated, it belongs in
    `undated` with the question that would fix it. Do not add an "estimated" certainty
    tier; it was designed out on purpose.
  - Fils runs TWO Postgres databases and Vercel Preview uses the PRODUCTION one.
    Never point a local command at the prod host; packages/db/src/guard.ts will stop
    you, and that guard must not be weakened.
  - No em dashes in any string the app displays. Comments and docs are exempt.
  - Verify before claiming: engine 427 passing / 3 skipped, web 149 passing, tsc clean
    in all three packages, production build clean. Report real numbers.

TASK 1 - Persist points holdings.
  Add a `PointsHolding` model to packages/db/prisma/schema.prisma: FK to User.id with
  onDelete: Cascade, `currency String`, `balance Float`, `expiryDate DateTime? @db.Date`,
  timestamps, `@@unique([userId, currency])`, `@@index([userId])`, snake_case @map names
  matching the file's existing convention. Follow the SavedCard precedent, including its
  comment style explaining WHY each modelling choice was made.
  Extend SavedState + getSavedState/saveSavedState in packages/db/src/users.ts, using the
  same transaction shape and the same generous maxWait/timeout (Neon goes cold).
  Extend /api/profile GET and PUT. Validate in the route, not in the db layer, matching
  how cardIds and spending are already validated. Reject a balance that is negative or
  non-finite, and reject an expiryDate that is not a real ISO day - note that
  Date.parse("2024-02-31") SUCCEEDS and rolls forward, so round-trip the formatted date
  against the input (apps/web/lib/profile-store.ts isIsoDate does this correctly).

TASK 2 - Persist the card anniversary.
  Add `openedOn DateTime? @db.Date` to SavedCard. Nullable, and it must STAY nullable:
  unknown is a real state and the calendar renders it as a question.
  It must never fall back to SavedCard.createdAt - that is when the card was added to
  Fils, not when it was opened with the bank. Put that reason in a comment.
  Carry it through SavedState, /api/profile, and the store.

TASK 3 - Move the two fields off sessionStorage.
  In apps/web/lib/profile-store.ts, `pointsHoldings` and `cardOpenedOn` are currently
  LOCAL ONLY and merged back over server state in serverToStored(). Once the columns
  exist, send them in the debounced PUT like cardIds, and drop them from the local-only
  merge. Leave merchantShares exactly as it is - it still has no column.
  Keep the existing guest -> sign-up handover working: adoptionPatch() must carry a
  guest's holdings into a fresh account, and isUnwrittenServerState() must still only
  return true for a genuinely untouched account.

TASK 4 - Refresh the devaluation table.
  packages/engine/src/devaluations.ts holds one entry, effective 2026-05-20, in the past,
  so the calendar warns about nothing. Do a real sweep of announced devaluations for the
  currencies in the dataset and update DEVALUATIONS_REVIEWED_ON to the date you swept,
  EVEN IF nothing changed - that field exists to distinguish "nothing is coming" from
  "nobody has looked". Cite a source URL per entry. Invent nothing: if a devaluation is
  rumoured but not announced, it does not go in the table. Do not add a test requiring a
  future entry.

TASK 5 - Give the fee-renewal row its re-score.
  CALENDAR_SPEC.md 3c designs this row as "renews on 12 Sep - AED 525. On your spending it
  now earns AED 380/yr. Review." Today it carries only the fee. Add the single-card
  re-score against the user's current spending. This touches the engine, so keep it a
  composition of existing scoring rather than new maths, and say plainly in the PR what
  you reused.

MIGRATION AND DEPLOY ORDER - get this wrong and real users see 500s:
  1. `pnpm --filter @fils/db exec prisma migrate dev --name add_points_holdings_and_opened_on`
     against DEV. Confirm the guard did not fire and the DEV host is not
     ep-twilight-voice-at5pi2e5.
  2. Run the full suite: engine, web, AND db (the db suite needs the DEV connection).
  3. Apply to PRODUCTION deliberately: `prisma migrate deploy` against prod.
  4. Only then merge schema-dependent code to a branch Vercel will deploy.

DEFINITION OF DONE:
  - A signed-in user enters holdings on /points, signs out, signs back in, and the
    calendar still shows their dated deadlines.
  - A card with an opening date produces a dated fee_renewal event carrying both the fee
    and the re-score.
  - A user who has answered nothing sees questions, never a guessed date and never an
    empty timeline that implies nothing is coming.
  - The db test suite passes against DEV.
  - CALENDAR_SPEC.md section 6 is updated to say what is now closed.

STILL OUT OF SCOPE, do not build it: email, cron, any scheduled digest. That is the
retention feature and it needs a product decision first.
````

---

## 7. One thing not to say yet

Until a scheduled digest exists, **do not make a retention claim from the calendar** in a
deck or an application. The maths is built and tested; delivery is the next build. That
distinction is in `DECK_BRIEF.md` §0 as one of three claims that had to change, and
shipping this work does not change it.
