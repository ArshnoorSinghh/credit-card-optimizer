# Fils — Cofounder Handoff Guide

Everything you need to build the frontend + verify/expand the card data.

---

## Two jobs, kept separate

You have **two responsibilities**. Do them as separate streams of work:

1. **Frontend** — build the visual, interactive UI (Revolut-style).
2. **Card data** — verify every card's details are correct, log every change, and add more cards from major UAE banks.

---

## THE GOLDEN RULES (read first — these protect the whole project)

- **You build the UI only.** The pages you build *call* existing APIs and *display* what they return. You do **NOT** modify anything in `packages/engine`, `packages/db`, or the API route logic.
- **If a page needs data the API doesn't return, ASK Arshnoor** — do not change the engine yourself.
- **Work on branches, never commit straight to `main`.** Create a branch (e.g. `git checkout -b frontend`), commit there, push, and Arshnoor merges after review.
- **Card data changes go in `cards.json` only** (the data file), never in engine logic. Log every change you make.
- **Never commit secret keys** (`.env` files). They're gitignored — keep it that way.

---

## PART 1 — THE FRONTEND

### Design north star
**Revolut.** Go to revolut.com first and study it — how the cursor interacts, how elements pop and animate, the dark theme with vibrant gradients, the card-based layout, the smooth motion. That feel is the target.

- Dark theme, vibrant purple→blue gradient accents, glass/blur effects
- Big bold typography, generous spacing, rounded cards with depth
- Cards lift/glow on hover, smooth scroll animations, subtle cursor glow
- Playful but premium — fun, but trustworthy for money decisions

### Tools to use
- **v0.dev** — generate the look (start here; refine by chatting)
- **Tailwind CSS** — styling
- **shadcn/ui** — premium pre-built components
- **Framer Motion** — the animations/interactions (cursor effects, hover, pop-ups)

Build **one page at a time.** Perfect the landing page's design system first; every other page inherits that exact style.

### The user flow (the order screens appear)
1. **Intro / landing screen** -> explains what Fils is, Revolut-style, animated. NOT login — this is the front door. Has "Try the demo" and "Sign up / Log in" buttons.
2. **Sign up / Log in** (or "Try the demo" to skip) -> auth is already built (Clerk); you just style these pages to match the theme.
3. **Onboarding — select your bank(s)** -> user picks their bank, and it shows that bank's cards. Then **monthly expenses input** (spend per category). A "Skip to main" option should exist.
4. **Main / Results** -> shows the best card(s) for their spending.
   - At the **top: "Card Optimizer"** -> click it to see the best **1, 2, and 3-card combinations** (this is built — the optimizer).
   - Another option: **"Points Optimizer"** -> Engine 2 (redemption/burn advice).
   - A slot for the **AI bot** (name TBD — Arshnoor adds it after the frontend is done; just leave a clean space/entry point for it).

### All the pages to build
1. **Landing / intro page** — hero, "how it works," features, user-count social proof, "Try the demo" + "Sign up."
2. **Sign in / Sign up** — style Clerk's pages to match.
3. **Onboarding** — (a) select bank -> show that bank's cards; (b) monthly spending input per category (sliders/sleek inputs, "Skip to main" option).
4. **Results / recommendations** — best 1/2/3-card portfolios, total AED value, which card for which category, expandable "show the math."
5. **Card Optimizer view** (top of main) — the 1/2/3-card combinations.
6. **Points Optimizer view** — enter points held -> best redemption, conversions, expiry/burn warnings.
7. **Card browser** — filterable gallery of all cards (filter by bank, fee, reward type).
8. **Card detail page** — full breakdown of one card.
9. **My Wallet / Dashboard** (logged-in) — saved cards + points + personalized recs.
10. **AI bot entry point** — leave a clean placeholder/space; Arshnoor wires the actual bot later.

### Important
- These pages will show **placeholder data at first.** They get wired to the real engine afterward (Arshnoor has the API details). Build the look and structure; real data plugs in after.
- Keep the design **consistent** across every page — same colors, fonts, spacing, motion.

---

## PART 2 — CARD DATA (verify + expand)

### A. Verify every existing card
Go through **each card** in `cards.json` and check its details against the bank's official website:
- Reward rates per category (e.g. "5% on groceries")
- Annual fee, joining fee, fee-waiver conditions
- Eligibility (min salary, residency, salary-transfer requirement)
- Reward currency and redemption options
- Whether the source link works (many are stale)

**Log EVERY change you make** — keep a simple list: card name -> what was wrong -> what you changed it to -> source URL. Arshnoor needs this list to re-verify.

### B. Known issues to fix (start here)
- **enbd_visa_flexi** — the earn rate is wrong (currently implies an impossible return). Find the real Plus Points earn rate and per-point value.
- **Merchant-locked / miscategorized rates** — some cards have rates that only apply at specific merchants stored as general rates. Flag these.
- **Unverified point values** — HSBC Rewards, RAKrewards, CBD Rewards, EI SmartMiles, and the Plus Points earn rate all need real per-point AED values from the banks' own sites.

### C. Add more cards
Add cards from **major UAE banks** not fully covered: ADCB, Emirates NBD, FAB, Mashreq, RAKBANK, DIB, ADIB, CBD, HSBC, Standard Chartered, Citi, Emirates Islamic. For each new card, fill in the **same fields** as existing cards (match the exact structure in `cards.json` — same field names, same format). If unsure of a value, flag it rather than guessing.

### D. Data rules
- Edit `cards.json` only. Match the existing structure exactly.
- Never invent numbers — if a value can't be confirmed, flag it for verification.
- "Up to X%" that has a cap -> record the cap; don't treat it as a flat rate.

---

## HANDOFF SUMMARY (what to give back to Arshnoor)
1. The frontend on a branch (not main), ready for review + API wiring.
2. A **change log** of every card-data correction (card -> old -> new -> source).
3. A list of **new cards added**.
4. A list of anything you **flagged as unverified**.

---

## SETUP (to run the project locally)
- Clone the repo, `pnpm install`, `pnpm dev`.
- You'll need your own dev environment keys (Arshnoor will provide a **separate dev database** so you can't affect live data, plus your own Clerk dev keys).
- Ask Arshnoor before touching anything outside `apps/web` (the frontend) and `cards.json` (the data).