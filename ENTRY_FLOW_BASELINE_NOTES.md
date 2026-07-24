# Entry Flow — "Intent → Baseline → Progressive 1/2/3 Reveal"

These are the working notes behind the new `/onboarding` entry experience. They
capture the interpretation of the product request, what was built, and — most
importantly — the two modeling decisions that were **flagged for human review**
rather than silently chosen (per the engine-ownership rule in `CLAUDE.md`).

---

## 1. The request (partner's words, interpreted)

> "It should show an option of what a user would want to do and then before it
> opens and chooses what it does on that page, the app can tell how much their
> current setup earns them and then if they click on the card option the app
> shows 1-2-3 setup."

Interpreted as a **hook → tension → reveal** arc:

1. **Intent picker** — first, ask *what the user wants to do*.
2. **Baseline anchor** — *before* dropping them into the full tool, show **how
   much their current card setup already earns**.
3. **Reveal on click** — only then reveal the optimized **1 / 2 / 3-card** setup.

The point: anchor on the user's *current* earnings, expose the gap, then reveal
the better wallet as the payoff. The old flow (bank → spend → results table) had
no personal "before" to measure the upgrade against.

### Two decisions taken up front
- **Baseline input:** ask which cards the user currently holds.
- **Reveal gating:** one page, progressive disclosure (no navigation to a
  separate results page).

---

## 2. What was built

A single-page stage machine at `apps/web/app/onboarding/page.tsx`
(**Goal → Your wallet → Your upgrade**):

1. **Intent picker** (`components/entry/intent-picker.tsx`) — three goal cards:
   "See what I'm leaving on the table", "Find my best card setup", "Optimize my
   points". Points routes to `/points`; the other two continue the card flow. No
   navigation — just stage state.
2. **Wallet stage** — held-cards picker (`components/entry/held-cards-picker.tsx`)
   + spend sliders + salary. As soon as a card is added, a **live baseline banner**
   (`components/entry/baseline-banner.tsx`) shows *"Your current cards earn you ≈
   AED X/yr."* The CTA reads **"Show me a better setup."**
3. **Reveal stage** — the baseline persists at the top, and `PortfolioResults`
   expands below it with the optimized 1/2/3 tabs. Each size shows a **"+AED X/yr
   vs your current cards"** delta.

Supporting changes:
- `lib/baseline.ts` (+ `lib/baseline.test.ts`) — computes the current-cards value.
- `lib/profile-store.ts` — added `heldCardIds` to the session store (key bumped
  `v1` → `v2`).
- `components/portfolio-results.tsx` — optional `baselineNet` prop renders the
  delta line; existing callers are unchanged when it's omitted.
- `/results` (deep-dive) and `/optimizer` updated to carry `heldCardIds` through,
  so the anchor/delta stays consistent across the app.

---

## 3. How the baseline works (and why it's safe)

**Zero edits to the human-owned `packages/engine`.** "What your current cards
earn" is computed in `lib/baseline.ts` by feeding *only the held cards* into the
engine's existing public `optimizePortfolio` as a private card universe, with a
**permissive eligibility profile** (`monthlySalaryAed: MAX_SAFE_INTEGER`,
`uaeResident: true`) so a card the user already holds is never filtered out by
salary/residency. The portfolio whose size equals the held-card count is the exact
held set, allocated optimally. The engine runs the same scoring math it always
does — no new valuation or optimization logic was introduced.

---

## 4. ⚠️ Decisions flagged for human review

Per `CLAUDE.md`, modeling choices that affect the numbers are surfaced here rather
than buried in code.

### 4a. Held-card picker is capped at 3
A consequence of scoring the baseline through the engine's 1/2/3-card API. It also
matches the reveal framing and how many cards people actually carry. Enforced in
the picker (`MAX_HELD_CARDS`) and pinned by a test.

### 4b. The baseline assumes *optimal* usage of current cards
The baseline models "current earnings" as the user's held cards allocated
**optimally** (each category swiped on whichever held card pays best). This is the
best case for the current wallet, which makes the reveal's **"+X/yr" delta
conservative** — it never overstates the gain from switching.

- **Alternative:** assume naive / default usage, which would inflate the delta.
- **Recommendation:** keep the optimal (conservative) baseline.
- This is the one knob to flip if bigger, flashier deltas are wanted. Documented
  in a `// why:` comment in `lib/baseline.ts`.

### 4c. Honesty on uncertainty (kept, not a choice)
If a held card has an uncertain reward rate, the baseline shows a **range + an
"estimate" warning** instead of a false-precision point figure — per the honesty
rule in `CLAUDE.md`.

---

## 5. Verification

- `pnpm -r typecheck` — all 3 packages clean.
- Engine: **220 tests pass** (untouched). Web: **58 tests pass** (incl. new
  `baseline.test.ts`).
- `pnpm --filter web build` — production build succeeds; `/onboarding`
  prerenders.

### Manual walk-through
1. Landing → "Try the demo" → pick an intent.
2. Select 1–3 held cards; confirm the picker blocks a 4th.
3. Set spend; the baseline number appears and matches the engine over just those
   cards.
4. Click the CTA → the 1/2/3 reveal animates in on the same page; each tab shows a
   non-negative "+X/yr vs your current cards" delta; the recommended size is
   badged.
5. A held card with an uncertain rate → baseline shows a **range + warning**.
6. `prefers-reduced-motion` on → stages cross-fade to final frames, no motion.

---

## 6. Out of scope (this pass)
- No server persistence of held cards (stays in `sessionStorage`, as before).
- No change to the Points optimizer beyond the intent option linking to `/points`.
- No engine edits.
