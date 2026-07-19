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

## Section A — verification pass (in progress, bank by bank)

Method: cross-reference each card's concrete fields (salary, annual fee, earn
rates, currency) against multiple sources. **✓ = confirmed matches data**
(no change needed); **⚠ = candidate discrepancy** (logged, not yet edited — a
single aggregator isn't enough to change financial data; needs a 2nd source or
issuer T&C). Nothing here is edited into `cards.json` yet.

### First Abu Dhabi Bank
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `fab_cashback` | 5% categories | groceries, education, utilities | Sources say 5% on **fuel, dining, groceries**; 3% international; 1% other | ⚠ likely miscategorized |
| `fab_cashback` | min monthly spend | 0 | Sources: **AED 3,000/mo** required to earn cashback | ⚠ unmodeled |
| `fab_etihad_guest_elite` | card identity + earn unit | miles per USD | No card by this exact name found; FAB Etihad cards quote **miles per AED 10**, and "Elite" is an *account* tier, not this card | ⚠ verify identity + units |

### Emirates NBD
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `enbd_skywards_signature` | annual fee | 735 | AED 735 (+ joining AED 1,573.95) | ✓ |
| `enbd_skywards_signature` | min salary | 15,000 | Sources: **AED 12,000** (matches the 12k-vs-15k dispute already noted on `enbd_visa_flexi`) | ⚠ likely 12,000 |
| `enbd_skywards_signature` | earn rates | base 1, Emirates 2, intl 1.5 (mi/USD) | Sources: base **0.75**, Emirates **1.5**, intl **1.0** mi/USD | ⚠ rates look overstated |

### Abu Dhabi Commercial Bank
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `adcb_traveller` | annual fee | 1,575 | AED 1,575 (eff. 15 Sep 2024) | ✓ |
| `adcb_traveller` | min salary | 20,000 | AED 20,000 | ✓ |
| `adcb_traveller` | base earn | 1 TP/AED | Some sources: **2 TP/AED** on all spend (may be promo/variant) | ⚠ verify base rate |

### Mashreq Bank
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `mashreq_cashback` | annual fee | 367 | Multiple sources: **free for life / no annual fee** (may be a NEO vs Gold variant mix-up) | ⚠ likely 0 |
| `mashreq_cashback` | min salary | 8,000 | Sources: **AED 5,000** | ⚠ likely 5,000 |
| `mashreq_cashback` | categories | supermarket 5%, dining+ent 3% | Sources: **5% dining** (local+intl, no cap) + 5% on noon/Namshi ecosystem; 1% other | ⚠ rates/mapping differ |

### HSBC UAE
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `hsbc_liveplus` | annual fee | 313.95 | AED 313.95 incl. VAT (yr-1 free, waived on AED 12k/yr) | ✓ |
| `hsbc_liveplus` | min salary | 12,500 | Sources vary AED 10,000–12,500 | ✓ (plausible) |
| `hsbc_liveplus` | categories | 5% dining+ent+groceries, 1% other | Real: **6% dining / 5% fuel / 2% groceries+ent**, each **cap AED 200/cycle**, **min AED 3,000/mo**, else 0.5% | ⚠ rates + caps + min-spend unmodeled |

### 📌 Pattern emerging (useful for the whole dataset)
Across FAB, ENBD, ADCB, Mashreq, HSBC:
- **Annual fees are usually correct** (only `mashreq_cashback` looks wrong so far).
- **Min salary has recurring candidate errors** (ENBD 15k→12k, Mashreq 8k→5k) —
  worth a dedicated salary re-check across all cards.
- **Reward category structures are the weak spot**: rates get simplified, categories
  mislabeled, and two real mechanics are **systematically unmodeled** — **per-category
  reward caps** and **monthly minimum-spend thresholds** to unlock cashback. These
  materially change scoring and are the highest-value thing for the team to confirm.

_Banks still to pass: Emirates Islamic, DIB, ADIB, RAKBANK, CBD, Standard Chartered,
Citi (+ remaining ENBD/ADCB/FAB/Mashreq/HSBC cards)._ Given finding #2, the realistic
output of a full pass is a list of ✓ / ⚠ like the above; converting ⚠ rows into edits
needs a second source or issuer T&C confirmation.

## Corrections applied to `cards.json`
_None yet._ Per finding #2, no edit has a reliable enough source to change a number
in the source-of-truth data file without either a bank T&C or team confirmation.
This section will fill in as sources firm up (or as the team supplies figures).

## 🚧 The `valuations.ts` blocker — and the data anyway

**The stumbling block, plainly:** the per-point AED values Section B asks me to fix
are defined in **`packages/engine/src/valuations.ts`** (the `DEFAULT_VALUATIONS`
object), keyed by the exact `rewards.currency` string. That file is **human-owned
engine code** (CLAUDE.md) and the Golden Rules say *don't change engine logic
without Arshnoor*. Editing `cards.json` does **not** touch these values — so I
cannot correct them from my side of the fence. There is also a build guard: the
valuations test **fails if any currency in `cards.json` lacks an entry here**,
which is why new-currency cards (Section C) need an engine edit too.

**So I'm handing over the data ready to apply.** Each row below is the exact
`valuations.ts` key, its current value, my sourced recommendation, and the literal
change — Arshnoor (or whoever owns the engine) applies it after a quick confirm.

| `valuations.ts` key | Current | Recommended | Conf. | Basis / needed confirmation |
| --- | --- | --- | --- | --- |
| `"Plus Points"` | `0.01` (low, held) | `~0.015` **or** fix the earn rate instead | low | Fits "up to 1.5%" headline at 1 pt/AED. Confirm ENBD earn table before moving; also model the 500-pt/statement cap. |
| `"CBD Reward Points"` | `0.0075` (low) | `~0.005` (cash) / `~0.01` (travel, Engine 2) | low→med | Channel-dependent; confirm via CBD Rewards T&C PDF. |
| `"RAKrewards Points"` | `0.0075` (low) | hold until confirmed | low | No per-point AED value sourced. Earn side (2/5/3 on World card) also unconfirmed. |
| `"HSBC Reward Points"` | `0.0075` (low) | hold until confirmed | low | Not researched to confidence; confirm via HSBC UAE T&C. |
| EI SmartMiles *(not present)* | — | add `0.01` (medium) | medium | Self-consistent (3.75%/2.25% Instant Purchase). Add only when an EI SmartMiles card exists. |

**Example of the literal edit** (for whoever applies it), once ENBD is confirmed:
```ts
// packages/engine/src/valuations.ts
"Plus Points": { aedPerUnit: 0.015, confidence: "medium", note: "1.5% headline at 1 pt/AED (confirmed <source>, <date>)" },
```
Engine 2's `redemption-valuations.ts` carries the same currencies with per-route
values and would move in step (e.g. CBD travel route ~0.01 vs cash ~0.005).

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
