# Card Data — Verification Change Log

Handoff artifact for **CLAUDEUI.md Part 2** (verify + expand card data).
Branch: `card-data-verification` (off `main`, independent of `frontend`).
Started: 2026-07-19.

Every entry follows: **card/currency → what was there → finding → source → action**.
Nothing is edited unless a reliable source confirms it. Unconfirmed values are
**flagged, not guessed** (Data rule D: never invent).

---

## ⚠️ Two structural findings that shape this task (read first)

### 1. The flagged "point values" live in the ENGINE, not `cards.json`
CLAUDEUI Section B asks for the real **per-point AED values** of Plus Points,
RAKrewards, CBD Rewards, HSBC Rewards, and EI SmartMiles. Those values are **not
in `cards.json`** — they live in `packages/engine/src/valuations.ts` (Engine 1)
and `packages/engine/src/redemption-valuations.ts` (Engine 2), which are
**human-owned engine files**. The Golden Rules say *edit `cards.json` only* and
*don't change engine logic without asking Arshnoor*.

**So:** value corrections below are written as **recommendations for Arshnoor to
apply in the engine**, with sources — not as edits I made. `cards.json` holds the
**earn rate**, currency label, fees, eligibility, and redemption metadata; those I
can and do verify/fix here.

### 2. Official UAE bank sites can't be read by the research tooling
Bank product pages (emiratesnbd.com, rakbank.ae, cbd.ae, emiratesislamic.ae) are
JavaScript-rendered; the fetch tool returns only the nav shell, not the rewards
tables. Aggregator sites (paisabazaar, soulwallet, mymoneysouq, pointcheckout)
are readable but **frequently inconsistent and sometimes self-contradictory**
(see ENBD below). Consequence: most items resolve to a **well-sourced flag with a
recommendation**, not a confident numeric edit. Authoritative confirmation needs
either the bank's **T&C PDF**, a **logged-in account**, or figures supplied by the
team.

---

## Section B — known issues (the "start here" list)

### B1. `enbd_visa_flexi` — Plus Points earn rate + value  ❌ STILL UNRESOLVED
- **In data:** earn `1 point per AED 1`; engine values Plus Points at `0.01`
  (held, low) in Engine 1 and ~`0.75` in Engine 2's research note.
- **Finding:** sources agree the card advertises **"up to 1.5%" total return**
  (ENBD launch release + aggregators). But point-value figures are **mutually
  contradictory**: one aggregator states *both* "1 point per AED spent" *and*
  "1 Plus Point = 0.75–1 AED" — together an impossible **75–100% return**. Two
  self-consistent models fit the 1.5% headline and can't be told apart without the
  official earn table:
  - (a) earn 1 pt/AED, 1 pt ≈ **0.015 AED** → 1.5%; or
  - (b) earn ~0.015 pt/AED, 1 pt = **1 AED** → 1.5%.
  Also relevant: **max 500 Plus Points per statement** (eff. 5 Apr 2025) — a cap
  the data does not currently model.
- **Action:** **No numeric change.** Keep the `data_caveat`. The current engine
  hold (`0.01`) is coincidentally close to model (a)'s ~0.015 and remains the safe
  placeholder. **Recommend:** Arshnoor confirms earn rate + per-point value from
  the ENBD T&C/app, then set Plus Points ≈ 0.015 **and** add the 500-pt/statement
  cap — or confirm model (b) and fix the earn rate string instead.
- **Sources:** emiratesnbd.com/en/cards/credit-cards/visa-flexi-credit-card ·
  emiratesnbd.com/en/media-center/...visa-flexi... · paisabazaar.ae · halasaves.com

### B2. `rakbank_world` — RAKrewards earn rate + value  🚩 FLAGGED
- **In data:** earn base `2 pts/AED`, international `5 pts/AED`, dining `3 pts/AED`;
  engine values RAKrewards Points at `0.0075` (low placeholder).
- **Finding:** generic RAKrewards material cites `1.75 pts/AED` local /
  `3 pts/AED` international (up to AED 14,999) — but that's the **program default**,
  and the premium *World* card plausibly earns more, so it does **not** disprove
  the 2/5/3 in the data. No reliable **per-point AED value** was found (redemption
  is travel/hotels/miles-transfer/voucher; min 10,000 pts to redeem).
- **Action:** **No change** to earn rates (specific card, unconfirmed either way).
  **Recommend:** confirm the World card's earn table + a per-point value from
  RAKBANK before moving the engine off the `0.0075` placeholder.
- **Sources:** rewards.rakbank.ae · rakbank.ae/.../cashback-calculator ·
  mymoneysouq.com/.../rak-rewards · pointcheckout.com/.../rak-rewards

### B3. CBD Reward Points — value  🚩 FLAGGED (researched range)
- **In data:** engine values CBD Reward Points at `0.0075` (low placeholder).
- **Finding:** value is **channel-dependent** — aggregator cites ≈ **0.005 AED**
  (0.5 fils) for statement credit vs ≈ **0.01 AED** (1 fil) for travel; earn "up to
  3 pts/AED"; min 10,000 pts to redeem. CBD publishes a **Rewards T&C PDF** (below)
  — the authoritative source to encode.
- **Action:** **No change.** **Recommend:** read the CBD T&C PDF and set the
  cash-equivalent value near **0.005** (statement credit), with the travel route
  ~0.01 in Engine 2. Current `0.0075` placeholder sits between the two, defensibly.
- **Sources:** cbd.ae/personal/more/cbd-rewards · cbd.ae/docs/...cbd-reward-points-wallet-terms-conditions...pdf · pointcheckout.com/.../commercial-bank-of-dubai

### B4. HSBC Reward Points — value  🚩 FLAGGED (not yet researched to confidence)
- **In data:** engine values HSBC Reward Points at `0.0075` (low placeholder).
- **Finding:** not resolved this pass. HSBC UAE Rewards redeem for cashback,
  vouchers, and airline transfers at varying rates; no single confident AED/point
  figure sourced yet.
- **Action:** **No change.** **Recommend:** confirm from HSBC UAE rewards T&C.

### B5. EI SmartMiles — value  ℹ️ NOT APPLICABLE to current data
- **Finding:** research supports **EI SmartMiles ≈ 0.01 AED/mile** (self-consistent:
  3,750 miles = AED 37.50 at 3.75%; 2,250 miles = AED 22.50 at 2.25% — Instant
  Purchase). **But** no card in the current `cards.json` uses an "EI SmartMiles"
  currency (grep: 0 matches) — the Emirates Islamic cards present are modeled
  differently, and `ei_flex_elite` is `excluded_from_scoring`. So there is nothing
  to value yet.
- **Action:** **No change.** **Recommend:** when an EI SmartMiles card is added
  (Section C), add the currency to the engine at **0.01 (medium)**.
- **Sources:** emiratesislamic.ae/.../flex-card/flex-eismartmiles-details ·
  emiratesislamic.ae/.../ei-smartmiles-conversion · kredit.ae/blog/...flex-elite...

### B6. Merchant-locked / miscategorized rates  ⏳ NOT STARTED
- CLAUDEUI: some cards store merchant-specific rates as general rates. The engine
  already flags several of these at scoring time (`merchant` assumption → low
  confidence). A systematic pass over each card's `categories[].category` vs the
  issuer's actual scope is pending. No edits yet.

---

## Corrections applied to `cards.json`
_None yet._ Per finding #2, no edit has a reliable enough source to change a number
in the source-of-truth data file without either a bank T&C or team confirmation.
This section will fill in as sources firm up (or as the team supplies figures).

## Engine-valuation recommendations for Arshnoor (NOT applied — human-owned)
| Currency | Current (`valuations.ts`) | Recommended | Confidence | Basis |
| --- | --- | --- | --- | --- |
| Plus Points | 0.01 (low, held) | ~0.015 **or** fix earn rate | low | 1.5% headline; needs official earn table |
| CBD Reward Points | 0.0075 (low) | ~0.005 cash / ~0.01 travel | low→med | aggregator range; confirm via CBD T&C PDF |
| RAKrewards Points | 0.0075 (low) | confirm before moving | low | no per-point value sourced |
| HSBC Reward Points | 0.0075 (low) | confirm before moving | low | not researched to confidence |
| EI SmartMiles (future) | — (not present) | 0.01 (medium) | medium | self-consistent 3.75%/2.25% math |

## Flagged as unverified (needs official confirmation)
- ENBD Plus Points earn rate **and** per-point value; 500-pt/statement cap unmodeled.
- `rakbank_world` earn table (2/5/3) and RAKrewards per-point value.
- CBD Reward Points per-channel value.
- HSBC Reward Points value.
- `enbd_visa_flexi` salary requirement (12k vs 15k — pre-existing note).

## New cards added
_None yet._ See Section C dependency below.

## Section C dependency (adding cards)
Adding a card with a **new reward currency** will break the build: the engine's
valuations test **fails if any `cards.json` currency lacks a `valuations.ts`
entry**. So new-currency cards require an engine edit (a valuation entry), which is
**out of the `cards.json`-only mandate** and needs Arshnoor. New cards that reuse
an **existing** currency (e.g. cashback `AED`, `Skywards Miles`) can be added
freely — that's the safe lane to start Section C.
