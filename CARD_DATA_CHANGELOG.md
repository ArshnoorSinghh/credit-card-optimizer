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

### B6. Merchant-locked / miscategorized rates  ✅ REVIEWED — already handled by design
- CLAUDEUI: some cards store merchant-specific rates as general rates. On review,
  the engine **already isolates and flags these** in two places, so they are not
  silently over-counted:
  - `score-card.ts` `MATCH_TABLE` tags merchant-locked categories with a `merchant`
    field — `emirates_purchases`, `etihad_purchases`, `dnata_travel`,
    `marriott_hotels`, `booking_com`, `lulu_supermarket`/`lulu_purchases`,
    `emaar_properties`, `dubai_duty_free`, `rta_transport`, `smiles_partners`. Each
    scores but is flagged as an **optimistic merchant assumption** (lowered confidence).
  - `normalize-rate.ts` marks merchant-scoped free-text base rates (e.g.
    `"5% on dnata travel"`, `"10% on Emaar purchases"`) as **tier-2 / low confidence**.
- **Conclusion:** no `cards.json` change needed for the flagging mechanism itself.
  The residual work — confirming each card's bonus scope matches the issuer — is
  folded into the Section A per-card verification above. No edits made.

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

### Emirates Islamic
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `ei_cashback` | annual fee | 367 | Current EI cashback cards are **Cashback Plus** (fee 299, sal 12k) and **Switch** (fee 313.95, sal 5k) — neither is 367 | ⚠ fee + card identity |
| `ei_cashback` | category caps | none | Both real cards cap each category at **AED 200/mo** | ⚠ caps unmodeled |

### Citibank UAE
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `citi_prestige` | min salary | 30,000 | AED 30,000 | ✓ |
| `citi_prestige` | annual fee | 1,500 | AED 1,500 | ✓ |
| `citi_prestige` | earn rates | base 1.5, intl 3, dining/travel 2 (**per AED**) | Sources: **3 TY/USD intl, 2 TY/USD local** (**per USD**, not per AED — ~3.67× difference) | ⚠ earn unit/rate |

### 📌 Pattern emerging (useful for the whole dataset)
Across FAB, ENBD, ADCB, Mashreq, HSBC:
- **Annual fees are usually correct** (only `mashreq_cashback` looks wrong so far).
- **Min salary has recurring candidate errors** (ENBD 15k→12k, Mashreq 8k→5k) —
  worth a dedicated salary re-check across all cards.
- **Reward category structures are the weak spot**: rates get simplified, categories
  mislabeled, and two real mechanics are **systematically unmodeled** — **per-category
  reward caps** and **monthly minimum-spend thresholds** to unlock cashback. These
  materially change scoring and are the highest-value thing for the team to confirm.
- **Earn-rate UNITS are inconsistent and high-impact**: the data mixes miles/points
  *per USD* vs *per AED* (and issuers sometimes quote *per AED 10*). USD vs AED alone
  is a ~3.67× error. Seen on `citi_prestige` and `fab_etihad_guest_elite`; worth a
  dedicated unit audit of every miles/points card.

### Dubai Islamic Bank
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `dib_skywards_dib_signature` | annual fee | 1,575 | AED 1,575 | ✓ |
| `dib_skywards_dib_signature` | min salary | 15,000 | AED 15,000 | ✓ |
| `dib_skywards_dib_signature` | earn rates | base 1, Emirates 2 (mi/USD) | Sources: **0.2 mi/USD** on everyday categories, **0.5** in EEA (tiered-down) | ⚠ data likely overstates |

### Abu Dhabi Islamic Bank
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `adib_smiles_signature` | annual fee | 1,199 | AED 1,199 appears in a source as **supplementary from the 5th card**, not clearly the primary annual fee | ⚠ fee attribution unclear |
| `adib_smiles_signature` | salary / earn | 20,000 / 1 pt base, 5 partners | Signature salary + per-txn earn rate **not found** (only signup/quarterly bonuses) | ⚠ unverified |

### RAKBANK
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `rakbank_titanium_cashback` | annual fee | 0 | No annual fee | ✓ |
| `rakbank_titanium_cashback` | 5% category | groceries+dining+fuel 5% | 5% on supermarkets, dining & fuel | ✓ |
| `rakbank_titanium_cashback` | min salary | 5,000 | Sources: **AED 8,000** | ⚠ likely 8,000 |
| `rakbank_titanium_cashback` | conditions | none | Real: **AED 5,000/mo** min spend for 5%; base tiers 1%/2%; **50% cinema** | ⚠ unmodeled |

### Commercial Bank of Dubai
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `cbd_smiles_signature` | annual fee | 525 | AED 500 + VAT = **525** (yr1 free, waived AED 24k/yr) | ✓ |
| `cbd_smiles_signature` | min salary | 12,000 | Sources: **AED 5,000** | ⚠ likely 5,000 |
| `cbd_smiles_signature` | earn | 1 pt base, 5 partners | Real: **10** on Etisalat/Smiles/elGrocer (cap 25k/mo), **3** intl, **2** other | ⚠ structure differs |

### Standard Chartered
| Card | Field | In data | Finding | Verdict |
| --- | --- | --- | --- | --- |
| `sc_cashback` | annual fee | 525 | Sources: **AED 315** (yr2+) | ⚠ likely 315 |
| `sc_cashback` | min salary | 8,000 | AED 8,000 (10,000 if employer not listed) | ✓ |
| `sc_cashback` | 5% categories | groceries+dining 5% | Sources describe SC cashback as **2% intl / 1% domestic**; 5% may belong to a different SC card (Platinum X) | ⚠ verify + lineup overlap |

> **SC lineup note:** SC's cashback cards (Cashback / Simply Cash / Platinum X)
> overlap confusingly across sources. Cross-check the existing `sc_cashback` and the
> newly-added `sc_simply_cash` against issuer KFS to avoid duplication/mislabel.

### ✅ Section A pass complete: 12 of 12 banks spot-checked
Roughly **half the checked fields matched the data** (esp. annual fees) and half are
⚠ candidates (esp. **min salary** and **reward-earn structure/caps/min-spend/units**).
Per finding #2, converting ⚠ rows into `cards.json` edits needs a second source or
issuer T&C — none were edited (flags only). The highest-value follow-ups: a
**salary re-check** and a **reward-mechanics pass** (caps + min-spend + USD/AED units)
across the dataset, done from issuer KFS documents.

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

## Section C — new cards added (safe lane)

Added **3 cards** (dataset now **54**), all **reusing existing currencies** so no
engine valuation change is needed. All use clean **tier-1** rate strings and
**recognized** category keys, so the normalizer tier-count and category-mapping
tests still pass. Verified by running the engine suite: **216 / 217 tests pass**;
the only failure is the count assertion below (by design).

| id | Bank | Currency | Fee | Salary | Earn | Sources |
| --- | --- | --- | --- | --- | --- | --- |
| `citi_rewards` | Citibank UAE | ThankYou Points *(existing)* | 300 (yr1 free, waived AED 9k/yr) | 8,000 | 1 TY/AED base; 1.5 on groceries & non-AED | citibank.ae/credit-cards/rewards/citi-rewards-credit-card; paisabazaar; yallacompare |
| `adcb_365_cashback` | ADCB | AED *(existing)* | 383.25 (yr1 free) | 8,000 | 6% dining, 5% fuel, 3% groceries, 1% other; min AED 2,500/mo | adcb.com/.../365-cashback-card; kredit.ae |
| `sc_simply_cash` | Standard Chartered UAE | AED *(existing)* | 525 (yr1 free, waived AED 9k/yr) | 8,000 | 1% base; 2% international | sc.com/ae/credit-cards/simply-cash; mymoneysouq; soulwallet |

**Caveats recorded on the cards (`notes`) and flagged for review:**
- `citi_rewards`: `network=Mastercard`, `tier=Titanium` are best-effort — confirm with issuer.
- `adcb_365_cashback`: real card also gives **5% on digital/AI subscriptions** (dropped — engine caps a card at **3 categories**) and caps total cashback at **AED 1,000/month** (**not modeled** — no overall monthly-cap field), so high-spend estimates may be overstated.
- `sc_simply_cash`: card advertises an **"up to 4%" boostable** category (dining/grocery/entertainment/education) — **omitted** because it's conditional and normalizes as tier-3 (a flat 4% would overstate); modeled conservatively at 1% + 2% international. `network`/`tier` best-effort.

### ⚠️ One required engine change (NOT done — flagged for Arshnoor)
Adding cards trips one count assertion in a **human-owned engine test**:
```
packages/engine/src/card.test.ts:29-30
  it("has all 51 cards", () => { expect(cards).toHaveLength(51); });
```
Bump `51` → **`54`** (and the "51 cards" text in the comment above it). One-line
mechanical change; left for the engine owner per the Golden Rules. Until then
`pnpm --filter @fils/engine test` shows exactly this one failure by design. The
app build (`next build`) and typecheck are unaffected — this is a vitest assertion,
not a compile error.

### Candidates researched but NOT added (with reasons)
Diligence trail — these were considered for the safe lane and rejected:
- **CBD Super Saver** — 4+ bonus categories (supermarket/education/utilities/transport) exceed the engine's 3-category limit; can't model faithfully.
- **ADCB TouchPoints Infinite** — heavily *tiered-down* earn (0.2–1.5 TP/AED across many categories) doesn't fit the bonus-category model; salary disputed (30k vs 40k).
- **FAB Infinite** — non-standard "1.5 FAB Rewards per AED 10" unit + unstated standard-variant salary.
- **Mashreq Platinum Elite** — Mashreq's own site lists it under **discontinued cards**.
- **DIB Prime Platinum** — sources conflict badly (fee "none" vs "AED 600/month"; unclear Wala'a→DIB Points mapping).
- **Citi Premier** — earns ThankYou **points per USD**, a unit the normalizer doesn't recognize; a clean tier-1 model isn't possible without converting units (which would misrepresent the raw data) and would risk breaking the tier-count locks.
- **HSBC Platinum** — legacy card, **not available to new customers**; no current earn-rate/salary figures sourced.

## Section C dependency (for future additions)
Adding a card with a **new reward currency** additionally breaks
`valuations.test.ts` (every `cards.json` currency must have a `valuations.ts`
entry) — that needs an engine valuation entry (Arshnoor). Cards reusing an
**existing** currency (as both above do) avoid that; the only engine touch they
require is the count bump noted above.
