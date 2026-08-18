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

Applied 2026-07 under cofounder authorization to action the well-corroborated ⚠
flags. **All are aggregator-sourced** (not issuer KFS) — high-confidence but worth
a final spot-check. Engine suite re-run after edits: **216/217 pass** (only the
count assertion). Salary changes don't affect `scoreCard`; the one fee change
(`mashreq_cashback`) is on a card not hand-computed by any test.

| Card | Field | Old → New | Source | Note |
| --- | --- | --- | --- | --- |
| `enbd_skywards_signature` | min salary | 15,000 → **12,000** | yallacompare; mymoneysouq | Corroborated by the 12k-vs-15k dispute already noted on `enbd_visa_flexi` |
| `mashreq_cashback` | min salary | 8,000 → **5,000** | kredit.ae; mashreq.com | |
| `mashreq_cashback` | annual fee | 367 → **0** (free for life) | multiple aggregators; mashreq.com | Waiver text updated to "Free for life". Caveat: possible NEO-vs-Gold variant mix-up — confirm the exact product |
| `rakbank_titanium_cashback` | min salary | 5,000 → **8,000** | rakbank.ae; kredit.ae | |
| `cbd_smiles_signature` | min salary | 12,000 → **5,000** | cbd.ae Smiles Signature offer page | |

### Flags deliberately NOT applied (held, with reason)
- `sc_cashback` fee 525 → 315: **held** — SC's cashback lineup (Cashback / Simply
  Cash / Platinum X) overlaps confusingly across sources; the AED 315 figure may
  belong to a different SC product. Needs issuer KFS before editing.
- **Reward-rate / earn-structure / unit** ⚠ rows (e.g. ENBD & DIB tiered-down
  miles, Citi per-USD units, FAB 5% category mapping, HSBC 6/5/2 + caps): **held** —
  these require modeling decisions (≤3-category limit, cap/min-spend fields, USD↔AED
  unit conversions) and are riskier than a single scalar; they stay flagged for a
  dedicated reward-mechanics pass against issuer KFS.
- **Per-point values** (Plus Points, RAK/CBD/HSBC): **held** — engine-owned
  (`valuations.ts`); see the recommendations table above.

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

---

# Section D — Gap-study calibration pass (2026-08-04)

Triggered by building `packages/engine/src/gap-study.test.ts`, a reproducible
measurement of "how much AED does an optimized wallet beat a naive one by",
across 150 seeded synthetic UAE spending profiles. It returned a **median
optimal return of 9.4% of total annual spend**. No UAE card portfolio returns
that. The study was therefore turned on the data itself.

Companion auditor: `packages/engine/src/gap-diag.test.ts` ranks cards by implied
return and prints the earning lines behind each. Both are gated behind
`describe.skipIf(!process.env.GAP_STUDY)` so they stay out of `pnpm test`.
Run: `GAP_STUDY=1 npx vitest run src/gap-study.test.ts --disable-console-intercept`

## D1. `rakbank_world` — missing minimum-spend gate  ✅ FIXED
- **In data:** `min_monthly_spend_required_aed: 0`, with 10% on supermarkets,
  dining and travel (caps 300/300/400, overall 1100).
- **Finding:** two independent aggregators state a **AED 10,000/month minimum
  spend to qualify for cashback at all**. With 0 recorded, the engine awarded
  full 10% category cashback to profiles spending AED ~4,000/month — the single
  largest source of inflation in the low-spend segments (early-career expat was
  showing a 13.5% return).
- **Action:** set to `10000`. Recorded in `data_caveat` that this is
  aggregator-sourced and the official T&C has not been read.
- **Also noted, deliberately NOT changed:** the same sources give supermarket cap
  **AED 400/mo** and travel cap **AED 600/mo**, both HIGHER than the 300/400
  recorded here. Raising them would inflate. The conservative values stay.
- **Sources:** skyscanner.ae RAKBANK World writeup · emiratesbreaking.com card guide

## D2. `citi_prestige` — unresolved arithmetic contradiction  ⚠️ FLAGGED
- **In data:** 2 ThankYou Points per AED on domestic spend. Engine values TY at
  0.03 AED/point.
- **Finding:** Citibank UAE's own redemption page publishes **15,000 TY points =
  AED 500** on travel — i.e. **0.0333 AED/point**, which *confirms* the engine's
  valuation rather than contradicting it. But 2 pts/AED × 0.0333 = a **6.7%
  return on all domestic spend**, which no UAE card pays. Exactly one of the earn
  rate or the rebate rate must be wrong (most likely the earn is not 2/AED across
  all domestic spend, or the rebate is tiered). They cannot be told apart without
  the official earn table. **Same class as B1 (`enbd_visa_flexi`).**
- **Action:** **no numeric change.** `data_caveat` extended to say the figure is
  not publishable. Applies equally to `citi_premier` and `citi_rewards`.
- **Sources:** citibank.ae/credit-cards/rewards-and-redemptions/rewards-rebate

## D3. `mashreq_platinum_plus` — uncapped accelerator + placeholder valuation  ⚠️ FLAGGED
- **In data:** 10 Vantage points/AED on `supermarkets_fuel_dining`, `monthly_cap:
  null`. Valued at the engine's 0.0075 placeholder, which `valuations.ts` itself
  marks *"NOT researched"*.
- **Finding:** 7.5% uncapped across the three largest spend categories. Either a
  cap is missing or the valuation is wrong; no source resolves either.
- **Action:** no numeric change; `data_caveat` added marking it not publishable.

## D4. Two claims from the first pass that were WRONG — corrected here
Recorded so they are not re-derived:
- **`rakbank_titanium`'s 50% cinema / video-streaming rate is REAL**, not a BOGO
  perk mis-modelled as an earn rate. RAKBANK does advertise up to 50% on those
  categories. The AED 100/mo caps recorded per category are also roughly
  faithful — the published cap is AED 400/mo *shared* across supermarket, dining,
  cinema and video streaming, and 4 × 100 sums to it. A shared cap is not
  expressible in the current schema; the approximation is reasonable and only
  diverges when spend is concentrated in one of the four.
- **`rakbank_world` was NOT missing its caps.** They were present and correct.
  The defect was the minimum-spend gate (D1).

## D5. The structural finding — this is the one that matters
After D1–D3, the study's median optimal return moved **9.38% → 6.68%** of spend.
Still not credible. The residual is **not** a list of remaining bad cards; it is
systemic, and it is not fixable in `cards.json`:

`normalize-rate.ts:72` deliberately parses **"Up to X%" as a certain X%** whenever
the card's cap fields model the constraint — the reasoning being that the cap,
not a discounted rate, expresses the limit. That is sound per card. But it means
**every card is scored at its maximum advertised rate**, and `optimizePortfolio`
then selects the best 3 cards *by that maximum*. The output is therefore a
maximum-of-maxima: a best case reported as an expected value. The engine cannot
see this because the bias is in the selection step, not the scoring step.

Nearly every `data_caveat` in this file already says the underlying rates are
"up to" values and "should not be treated as unconditional". The engine does
treat them as unconditional.

**This is an engine-design decision, not a data fix — Arshnoor's call.** Options:
1. Parse "Up to X%" as a **range 0..X** even when capped, so the portfolio result
   carries an honest band instead of a point estimate. Closest to the project's
   existing "uncertainty as a first-class type" philosophy, and `RateRange`
   already exists. Would widen most results substantially.
2. Add an explicit `expected_rate` alongside the advertised maximum in
   `cards.json`, sourced per card. Most accurate, slowest.
3. Report the portfolio optimum as "best case" in the UI and never as a single
   expected number.

**Until one is chosen, no headline AED figure derived from this engine should be
published** — in the product or in external material. The study reruns in ~90
seconds once it is.

## D6. The engine change was made (2026-08-04) — option 1 from D5

**This crosses the `packages/engine` line the Golden Rules reserve for Arshnoor.
It was made on explicit instruction, uncommitted, and is one function's worth of
diff to revert.**

`normalize-rate.ts` — the `capModeled` fork inside the `UP_TO_PERCENT` branch was
removed. "Up to X%" now returns `{ value: null, confidence: "unknown",
range: { min: 0, max: X } }` whether or not a cap is modeled. `capModeled` is
retained solely to select between two `note` strings, because "capped ceiling"
(needs the tier table) and "uncapped ceiling" (needs a cap) are different review
tasks. The cap machinery downstream is untouched and still bounds the AED
outcome; what stopped being asserted is that the user earns the ceiling RATE.

Two tests updated, both of which encoded the old behaviour directly:
- `normalize-rate.test.ts` — "parses 'up to X%' as X% when a cap models the
  constraint" replaced by a pair asserting capped and uncapped ceilings are
  bounded identically, plus that the two notes differ.
- The tier-count lock: **126/46/21 -> 118/46/29**. Exactly 8 strings moved
  tier 1 -> tier 3, all capped "Up to X%" ceilings. No string changed in any
  other direction, which is the check that the edit did only what it claimed.

Suite: 274 passing, 2 skipped.

### Result — the study is now in a publishable range

| Universe | Median optimal return | Median gap vs naive |
| --- | --- | --- |
| All scoreable | 8.20% (was 9.38%) | AED 9,952 |
| Sound rates | 5.22% (was 7.81%) | AED 6,255 |
| **Publishable** | **3.66%** (was 6.68%) | **AED 4,750** |
| Zero-flag | 1.12% | AED 0 |

3.66% of spend for an optimized 2–3 card wallet, p25 3.27% / p90 4.03%, is a
credible UAE figure. `multi-card optimum` also fell from 100% to 84%, which is
the independent tell that the maximum-of-maxima selection bias is gone — a third
card no longer always "wins".

### Two things to read carefully before quoting AED 4,750

1. **The publishable universe is now ~9 cards per profile, from 44.6 eligible.**
   The optimum is optimal over a fifth of the market, so the true figure is
   probably higher. That makes AED 4,750 a conservative floor — the right
   direction for a claim, but say so.
2. **Gap vs the BEST single card is only AED 761 (median).** So most of the
   AED 4,750 headline is "you are holding a mediocre card", not "you need three
   cards". The product's demonstrated value is card SELECTION far more than
   portfolio CONSTRUCTION. Any external claim built on the portfolio maths
   specifically should use the AED 761 figure, not AED 4,750.

Rate-defect rejection rose 55.7% -> 75.3%, as expected: more strings are tier 3.

## D7. Study corrected for population mix (2026-08-04)

D6's pooled medians were inflated by a methodology bug, not by the engine: the
`weight` field on each segment archetype was dropped in a rewrite, so all five
segments drew an EQUAL number of profiles. That put 40% of the sample in the two
highest-spending archetypes (frequent traveller AED 255k/yr, school-fee family
AED 202k/yr) and dragged every pooled median up by SPEND LEVEL rather than by
optimizer skill. Weights restored (0.40 / 0.20 / 0.20 / 0.13 / 0.07), sample
raised to 200 profiles, and every figure is now reported per segment as well as
population-weighted.

Report also now prints, per segment: median annual spend, naive%, best-single%,
optimal%, gap% and gap AED — so `naive% + gap% ~= optimal%` is checkable on every
row rather than taken on trust. (They differ by tenths because a median of ratios
is not the ratio of medians; a large divergence would signal a real bug.)

### Headline, PUBLISHABLE universe, population-weighted

**AED 2,988/yr gap on AED 111,881 annual spend = 2.67% of spend.**

Per segment (weight-independent — prefer these, they don't depend on the weights
being right):

| Segment | Ann. spend | naive% | best-1% | optimal% | gap AED |
| --- | --- | --- | --- | --- | --- |
| Early-career expat | 48,660 | 0.68 | 2.86 | 2.87 | 1,060 |
| Family w/ school fees | 201,558 | 0.73 | 3.24 | 3.80 | 6,006 |
| Frequent traveller | 255,108 | 1.19 | 3.34 | 3.76 | 6,273 |
| Young single, dining-led | 102,318 | 1.00 | 3.04 | 3.35 | 2,403 |
| Dual-income, balanced | 139,464 | 0.68 | 3.33 | 4.00 | 4,319 |

Optimal returns of 2.9–4.0% of spend against a ~0.7–1.2% naive card are credible
UAE figures. `multi-card optimum` fell 100% -> 70.5% across the three fixes,
which is the independent tell that the maximum-of-maxima bias is gone.

### The uncomfortable finding: the portfolio optimizer earns AED 291

Compare the `best-1%` and `optimal%` columns. The median gap between the best
SINGLE card and the optimal 1–3 card portfolio is **AED 291/yr** (p25 = AED 0).
For the early-career segment — 40% of the modelled population — it is **AED 5**:
2.86% vs 2.87%.

So of the AED 2,988 headline, essentially all of it is *"you are holding the
wrong card"* and almost none is *"you need a portfolio"*. The min-cost max-flow
centrepiece is, on this data, worth AED 291/yr to a median user.

This does not make the engine wrong — exhaustive enumeration is what PROVES the
single card is optimal, and the caps machinery is what makes the per-category
assignment correct. But any external claim about the *optimizer* specifically
must use AED 291, not AED 2,988. The two numbers answer different questions and
only one of them is about the algorithm.

### Known limits on accuracy (ranked by how much they move the answer)

1. **77.5% of card-scores are still rejected for rate defects**, leaving ~7 of
   39 eligible cards in the publishable universe. The optimum is therefore
   optimal over 18% of the market and the true figure is HIGHER. AED 2,988 is a
   conservative floor. This is the binding constraint and the highest-value fix.
2. **Segment weights are a judgement**, not survey data. Per-segment rows above
   are immune to this; only the weighted headline moves.
3. **Spend archetypes are a judgement.** Real distributions would come from Open
   Finance, or cheaply from ~20 real statements.
4. **The naive baseline is the median card of the PUBLISHABLE universe**, not of
   the real market — a real user's existing card may be one of the excluded ones.
5. **Still modelled, not observed.** No real user has been measured.

## D8. Rate-defect pass (2026-08-04)

### D8.1 Two genuine normalizer false positives — FIXED

`isBenignScope` was demoting rate strings whose only "scope" stated nothing the
structured data didn't already carry. Two forms, both stripped before the benign
test now:

- **Currency definition** — `"(10 UPoints = AED 1)"`, `"(1 Plus Point = AED 1)"`.
  A conversion definition, not a condition. It was tripping the `"("` test.
- **"back in / back as <Currency>"** — `"6.25% back in UPoints"`,
  `"5% back as Wala'a Rewards"`, `"1.25% back as talabat credit"`. Names the
  reward currency, which `rewards.currency` holds and `valuations.ts` prices.
  `"6.25% back in UPoints"` is exactly as certain as `"6.25%"`.

**11 strings moved tier 2 -> tier 1; tier 3 unchanged at 29** — the check that
this touched nothing D6 did. Counts: 118/46/29 -> **129/35/29**.

Four new tests lock the behaviour, including two NEGATIVE cases proving the strip
does not rescue a real condition: `"on eligible non-Emaar spend"` stays tier 2,
as does `"capped at 3,000 dnata Points per statement cycle"`.

Effect on the study: rate-defect rejection **77.5% -> 73.5%**, publishable
universe 7.0 -> 8.6 cards per profile. The headline barely moved (see D8.3).

### D8.2 An idea that did NOT work — recorded so it isn't retried

Attempted: skip the "publishable subset" entirely and instead score the **full
39-card market at the LOWER BOUND** of every uncertainty range
(`netAnnualValueRange.min`), on the theory that this gives a defensible floor
over the whole market rather than an answer about 8 cards.

It fails. Full-market lower bound returns **7.38% of spend** — essentially
identical to the full-market midpoint (7.45%), and still implausible. The reason
is structural: **the worst defects are tier-2 POINT values, not ranges.**
`adcb_talabat`'s `"35% back; maximum AED 35 per order"` parses to a certain
0.35 with `min === max`, so there is no bottom of the band to take. Taking the
lower bound only pulls down tier-3 ranged rates, which are not where the
inflation lives.

Kept in the report as the "ALL cards, LOWER BOUND" universe because the *gap*
between it and the midpoint universe is a useful read on how much of the
uncertainty is ranged vs. silently point-valued. Right now: almost none.

**Conclusion: PUBLISHABLE remains the only universe a claim can rest on.**

### D8.3 The headline is stable, which is the useful result

| Change | Publishable weighted gap |
| --- | --- |
| D6 (engine ceiling fix) | AED 2,988 |
| D7 (population weights) | AED 2,988 |
| D8 (normalizer false positives) | AED 2,988 |

**AED 2,988/yr on AED 111,881 annual spend (2.67%)**, unmoved across three
independent methodology changes. That stability is worth more than the number:
it says the figure is not an artefact of any one modelling choice.

Against a AED 199/yr subscription that is **15x**, and 100% of modelled profiles
clear the price. Note this is the gap vs the card a user ACTUALLY HOLDS, which is
the product's value. The separate AED 291 figure (D7) is what the multi-card
optimizer adds over already knowing your single best card — a different claim.

### D8.4 What is left, and why it needs a human with a bank login

The residual 73.5% rejection is **not** fixable by better parsing. Classes:

1. **Unpublished rates** (6 cards) — `"No general base cashback published"`,
   `"the underlying category schedule is not published on the current page"`.
   dib_consumer_platinum, dib_consumer_reward, adib_cashback_visa,
   cbd_visa_platinum, fab_etihad_guest_signature, ei_cashback.
2. **Spend-tier tables the schema cannot express** — `"3% at AED 3,000-9,999.99;
   5% at AED 10,000-19,999.99; 10% at AED 20,000+"` (cbd_super_saver, sc_x),
   plus rakbank_red and hsbc_max_rewards threshold rates. Fixing these needs a
   SCHEMA change (a tier array on a category), not a data edit.
3. **"Up to X%" ceilings** (rakbank_world, rakbank_titanium, ei_skywards,
   dib_skywards, sc_simply_cash, ei_amazon_world) — need the official earn table.
4. **Lump bonuses** — `"20,000 bonus FAB Rewards when monthly spend reaches AED
   10,000"`. Not a rate; the schema has nowhere to put it.
5. **Compound base rates** — `"1.0 TouchPoint per AED 1 local; 1.5 international"`.
   Fixable in `cards.json` by splitting into an explicit `international` category,
   since the engine already has that spend category. ~8 cards. **This is the
   cheapest remaining win and needs no new sources.**

Classes 1 and 3 need a bank login or a T&C PDF. Class 2 needs a schema decision.
That is the "verified data is slow" moat argument, measured.

## D9. Compound base rates split (class 5 from D8.4) — 2026-08-04

Six cards recorded two different earn rates inside one `base_rate` string, e.g.
`"1.0 TouchPoint per AED 1 on eligible local spend; 1.5 TouchPoints per AED 1 on
eligible international spend"`. The `;` made every one of them tier 2, and the
international rate was invisible to the engine even though `score-card` already
has an `international` spend category. No new sources were needed — this is a
re-encoding of data already present in the string.

### Split into base + `international_spend` category (4 cards)
| Card | base_rate keeps | new `international_spend` |
| --- | --- | --- |
| `adcb_touchpoints_gold_titanium` | 0.5 TouchPoints/AED | 0.75 TouchPoints/AED |
| `dib_shams_platinum` | 1 Wala'a Reward/AED | 2 Wala'a Rewards/AED |
| `dib_shams_infinite` | 2 Wala'a Rewards/AED | 4 Wala'a Rewards/AED |
| `sc_smart_saadiq` | 1 360 Rewards Point/AED | 2 360 Rewards Points/AED |

### International clause REMOVED, not modelled (2 cards)
`adcb_lulu_platinum` (1.75 LuLu Points/AED) and `adcb_touchpoints_platinum`
(1.5 TouchPoints/AED). Both already carry a **`uk_and_eea_spend` category at a
LOWER rate (0.4)**, and `score-card.ts:106,113` maps BOTH `uk_and_eea_spend` and
`international_spend` onto the single `international` bucket. The scorer takes the
best option per bucket, so adding a blanket international rate would shadow the
carve-out and credit these cards 1.75/1.5 on UK/EEA spend they actually pay 0.4
on. The engine cannot express "international EXCEPT UK/EEA".

Conservative read taken: international spend falls through to the base rate.
**This understates both cards on purpose.** Recorded in each `data_caveat` with
the exact clause removed, so it can be restored if the spend model ever gains a
UK/EEA split.

### Tier movement — the arithmetic closes exactly
**129/35/29 -> 139/29/29**, string total 193 -> 197. Six base rates moved
tier 2 -> tier 1; four new category strings entered at tier 1. `129 + 6 + 4 = 139`,
`35 - 6 = 29`, **tier 3 untouched**. Nothing moved that was not intended to.

### Study result

| | Before D9 | After D9 |
| --- | --- | --- |
| Publishable universe | 8.6 cards | **12.9 cards** |
| Rate-defect rejection | 73.5% | **62.5%** |
| Weighted gap | AED 2,988 | **AED 3,383** |
| Optimal % of spend | 3.43% | 3.45% |
| Multi-card optimum | 70.5% | **99.5%** |

The publishable universe grew 50% and the headline rose 13%, while the
plausibility check barely moved (3.43% -> 3.45%). That combination is what a
genuine data improvement looks like: more of the market becomes usable without
the per-card returns drifting upward.

### The interesting side effect: multi-card optimum 70.5% -> 99.5%

Splitting four base rates into explicit international categories made the
portfolio optimizer useful again. `GAP vs BEST single card` p25 moved 0 -> 144,
i.e. the number of profiles where a second card adds literally nothing collapsed.

**The optimizer's value is bounded by how much category structure the DATA
expresses.** While a card's international rate sat inside a prose base_rate, the
engine saw a flat card and had nothing to trade off; four one-line splits gave it
genuine complementarity to exploit. The median gap vs best-single is still only
AED 291 — but the reason it is low is now partly a data-encoding limit, not a
statement about the algorithm. Classes 1-4 in D8.4 are the rest of that limit.

## D10. Unresolved-rate pass (class 1 from D8.4) — 2026-08-04

Six cards carried prose in `base_rate` instead of a rate. All six are now
resolved or bounded. **The official Emirates Islamic page turned out to be
readable** — contradicting the standing assumption in this file's header that
UAE bank pages are uniformly JS-rendered and unreachable. Worth retrying the
others individually rather than treating the whole class as blocked.

### D10.1 `ei_cashback` — the page WAS readable ✅ RESOLVED
`emiratesislamic.ae/en/cards/credit-cards/cashback-card` publishes, in accessible
text: 5% on Etisalat & du, 5% electronics, **"Up to 1% on local and international
transactions"**, no minimum spend. Two defects:
- `base_rate` `"…the general base rate is not published on the official page"` →
  **`"Up to 1%"`**. Scored 0..1%, not 1% — it is a ceiling.
- The **5% Etisalat/du telecom category was absent from this record entirely.**
  Added (`etisalat_and_du`, which `score-card.ts:138` already maps to `utilities`).
  This is the only rate in this pass that ADDS earning power, and it was sourced
  from the bank's own page.

### D10.2 Three category-only cashback cards — conservative 0% base
`adib_cashback_visa`, `dib_consumer_platinum`, `dib_consumer_reward` each publish
a complete category schedule with per-category caps AND an overall monthly cap,
and no source — official or aggregator — states any rate on spend outside those
categories. `"No general base cashback published"` matched no pattern, so all
non-category spend scored as an *unbounded unknown*.

Set to **`"0%"`**. This asserts LESS than the old string implied, not more: a
certain zero instead of an unknown, and the conservative floor if a small general
rate does exist. Recorded in each `data_caveat` as a floor, not a sourced value,
with a one-line path back.

### D10.3 Two ceiling-only cards — prose trimmed so the ceiling BOUNDS
`cbd_visa_platinum` and `fab_etihad_guest_signature` stated their headline
ceiling inside a sentence, which matched no pattern and scored as zero:
- `"Official product page states up to 1.5 CBD Reward Points per AED 1; the
  underlying category schedule is not published…"` → **`"Up to 1.5 CBD Reward
  Points per AED 1"`**
- `"…markets up to 6.5 Etihad Guest Miles per AED 10; …"` → **`"Up to 6.5 Etihad
  Guest Miles per AED 10"`**

`UP_TO_PER_UNIT` now bounds these 0..X. **Both stay tier 3 by design** — a bounded
range is honest and strictly more information than "unrecognized", and the
explanation moved to `data_caveat` where it belongs rather than sitting in a
field the parser reads.

### Tier movement
**139/29/26 -> 143/29/26**, total 197 -> 198. Three `0%` bases moved tier 3 ->
tier 1 (+3/-3); the new telecom category entered at tier 1 (+1, and the total
+1). D10.3 produced no tier movement, as intended. Tier 2 untouched.

### Study result

| | Before D10 | After D10 |
| --- | --- | --- |
| Publishable universe | 12.9 cards | **15.5 of 39.3** |
| Rate-defect rejection | 62.5% | **56.0%** |
| Weighted gap | AED 3,383 | AED 3,315 |
| Optimal % of spend | 3.45% | 3.73% |
| **Gap vs BEST single card** | AED 291 | **AED 566** (p25 144 -> 287) |

The headline gap fell slightly while the optimal return rose slightly — the naive
baseline rose too, because the newly-admitted cards are ordinary rather than
inflated. That is what a healthy data addition looks like.

**The portfolio optimizer's measured value nearly doubled, 291 -> 566**, and the
p25 doubled as well, so even the bottom quartile now gains from a second card.
This is the second time (see D9) that giving the engine more category structure
raised the optimizer's value without raising per-card returns. The AED 291 figure
was never a verdict on the algorithm; it was a measure of how little structure
the data was exposing to it.

### What remains genuinely blocked
- **Spend-tier tables** (`cbd_super_saver`, `sc_x`, `rakbank_red`,
  `hsbc_max_rewards`): NOT a schema gap that can be patched. A tiered rate depends
  on how much spend lands on that card, but `optimize-portfolio` precomputes rates
  into fixed edge costs before the min-cost max-flow solve, and the allocation is
  the flow solution. Rate-depends-on-allocation is circular and would break the
  exactness guarantee that is the engine's whole claim. Needs a design decision,
  not an edit.
- **Lump bonuses** (`"20,000 bonus FAB Rewards when monthly spend reaches AED
  10,000"`): not a rate; the schema has nowhere to put it.
- **`citi_prestige`/`premier`/`rewards`, `mashreq_platinum_plus`,
  `enbd_visa_flexi`**: unresolved arithmetic contradictions needing official earn
  tables. Unchanged.

---

# 2026-08-05 — D11–D14: annotation noise, promo removal, base-rate splits, refetched ceilings

Prompted by the question "what is the 56% rejection rate and how do we lower it".
Answering it exposed a measurement bug that made the 56% itself wrong (D14b).

**Method note.** Each step below was measured before it was made, using a throwaway
audit that counts rejections per (card, profile) pair across the same 200 modelled
profiles the gap study uses (7,851 pairs). Attribution, not intuition, chose the
order of work. One hypothesis was tested and **discarded**: that many rejections came
from flagging categories the user does not spend in. Measured effect: zero. Nearly
every defective string is a `base_rate`, which always carries spend.

## D11. Annotation noise — a comma cost 200 rejections

Four strings were tier 2 solely because `isBenignScope` treats any comma or
parenthesis as evidence of a real condition. None of them stated a condition:

| Card | String | Why it is an annotation |
| --- | --- | --- |
| `fab_rewards_indulge` | `...on all eligible spend, including international spend` | the card has no international category, so the clause restates the default |
| `dib_shams_platinum` (x2) | `10 Wala'a Rewards per AED 1, advertised as 5% back` | marketing restatement; cross-checks exactly (valuations prices Wala'a at 0.005, so 10/AED = 5%) |
| `rakbank_air_arabia_platinum` | `0.3 AirRewards Points per AED 1 ... (1.5 points per AED 5)` | the same rate restated; 1.5/5 = 0.3 |

- **Action:** fixed in the DATA, not by loosening `isBenignScope`. A looser regex
  would have moved the bar rather than the facts.
- **`rakbank_air_arabia_platinum` also gained a DO NOT PUBLISH caveat.** Its rate
  strings now parse cleanly, but its own prior caveat said the official page exposes
  no earn rates — i.e. the numbers have unverified provenance — and its AirRewards
  valuation is an unresearched placeholder against per-AED rates, where unit counts
  bite directly. **Soundness is not provenance**; the two universes exist precisely
  to separate them, and the caveat wording had to match the publish filter.

## D12. `adcb_talabat` — an acquisition promo scored as a steady-state rate

- **In data:** `first_10_talabat_orders` at `"35% back; maximum AED 35 per order"`.
- **Finding:** a ONE-TIME first-10-orders offer, scored as a permanent category —
  so it paid 35% on all dining forever. This is the exact offender `gap-study.test.ts`
  names in its own file header, which had never been acted on.
- **Action:** moved to `benefits` (displayed, never scored). Steady-state talabat
  spend now correctly earns the 1.25% base. `overall_cap` left at 350 deliberately:
  relaxing it would raise the card's value, which is not a direction to move casually.
- **Same class, found while doing D13:** `fab_etihad_guest_infinite`'s
  `optional_miles_accelerator` — a **paid** AED 250/month (AED 3,000/year) opt-in
  scored as a free category, crediting 7.5 miles/AED 10 on all spend with its cost
  invisible to the fee model. Also moved to `benefits`.

## D13. Eleven compound base rates split — the D9 technique, applied to the rest

Each packed 2–3 rates into one string. The base keeps its first clause; the rest
becomes a real category, or turns out to be **already structurally encoded**:

- **Already encoded (pure restatement, no new category):** `hsbc_live_plus` and
  `enbd_lulu_247_platinum` ("...when the AED N monthly threshold is not met" IS
  `min_monthly_spend_required_aed` plus the default `degrade` gate);
  `enbd_uemaar_signature` ("non-Emaar" — the Emaar accelerators are already their own
  categories); `mashreq_noon` ("at non-partner merchants" — likewise);
  `sc_simply_cash` ("domestic airline transactions earn standard category rates").
- **Genuinely new categories (+4 tier-1 strings):** `fab_cashback`
  `specified_low_interchange_categories` 0.15%; `adcb_traveller` `international_spend`
  1.5%; `mashreq_cashback` `international_spend` 1%; `ei_switch_cashback`
  `government_utilities_charity` 0.5%.
- **`adcb_365_cashback` is the deliberate NON-split.** It pays 1% on non-EU but 0.5%
  on EU international, and both map to canonical `international`. A blanket 1% would
  **shadow** the 0.5% and overstate, so international stays at 0.5%. Understating
  non-EU is the safe direction. Same structural gap as D9's `adcb_lulu_platinum`.

## D14. Seven "Up to X" ceilings resolved — because the pages were refetched

**The changelog's claim that UAE bank pages are uniformly JS-rendered was wrong for
four more banks.** Every card below carried a caveat saying the page "does not expose
... in accessible text". Every one of those notes was STALE:

| Card | Was | Now |
| --- | --- | --- |
| `ei_skywards_infinite` | base + 2 ceilings | certain 1 / 2 / 1.5 miles per USD 1, **+3 reduced categories** (grocery 0.5, fuel 0.25, government/education 0.15) |
| `dib_skywards_infinite` | base + 1 ceiling | certain 1 / 2, **+1 reduced category** (the 0.3 bucket maps EXACTLY onto an existing compound key) |
| `fab_etihad_guest_signature` | base ceiling, NO categories | 2.75 domestic / 4.5 non-AED / 5.5 Etihad per AED 10 |
| `sc_simply_cash` | `Up to 2%` | flat **2%**, published as flat |

**This is not a reversal of D5.** D5 stopped scoring ceilings AT the ceiling because
the variance was unexplained. Here the pages publish the reduced-rate grid that the
"up to" was hiding, so the variance is **enumerated and encoded**. That, and only
that, licenses a certain rate. Residual risk is recorded per card: if a bank omits a
reduced bucket from its page, the base is overstated.

`fab_etihad_guest_signature`'s "Up to 6.5" turned out to be the **paid accelerator**
rate used as the headline — the identical defect as D12's, on a card whose entire
score rested on that one string.

**Rule adopted: when two official rates collapse into one canonical category, encode
the lower one.** Applied twice (DIB EEA 0.75 vs foreign 1.5; EI telecom 0.25 vs
government/education 0.15). Both understate. Both need a spend-model split to fix.

### D14b. The 56% was measured with a filter that never matched  ⚠️

The SOUND filter tested `message.includes("assumes spend occurs")`. The emitted
message is `<cat>: assumes <a>/<b> spend occurs at <merchant>` — the category list
sits INSIDE the phrase, so the contiguous substring **matched nothing, ever**. The
merchant-assumption leg of the filter was dead for its whole life.

This is the **second instance of this exact defect**; the first was the `"Unknown
rate"` guess corrected in an earlier revision, whose comment is two lines above.

Consequence: every merchant-accelerator card was scored as SOUND. `emaar_malls` at
6.25% maps to canonical `other`, so a user's **entire** "other" spend was credited as
though every dirham were spent at an Emaar mall. Fixed to `includes("spend occurs at")`
in both `gap-study.test.ts` and `gap-diag.test.ts`, which had drifted apart.

A `monthlySpendAed > 0` guard was also added to the flag in `score-card.ts`. **It is
correctness insurance, not a live fix: measured effect on this dataset is zero** (1,826
merchant rejections with or without it). It must not be cited as an improvement.

### D14c. A do-not-publish decision that was never propagated  ⚠️

D2 concluded the Citi ThankYou contradiction makes the figure "not publishable —
**applies equally to `citi_premier` and `citi_rewards`**". Only `citi_prestige` ever
got the marker. `citi_rewards` carried **no `data_caveat` at all** and ranked 4th in
the sound universe at a 3.19% implied return. Both now carry DO NOT PUBLISH.

Also found: **`sc_simply_cash` is closed to new clients** (its page is a servicing
page for existing holders) yet was fully scored and publishable. For a product that
recommends cards to *acquire*, that is a product bug, not a data bug. Marked, and
raised as an open question below.

### Result

| | After D10 | After D14 |
| --- | --- | --- |
| Tier 1 / 2 / 3 | 143 / 29 / 26 (198) | **175 / 12 / 19 (206)** |
| **Rate-defect rejection** | 56.0% | **20.9%** |
| Merchant-assumption rejection | (never measured) | **24.7%** |
| Total rejection, working filter | (unmeasurable) | **44.2%** |
| Publishable universe | 15.5 of 39.3 | **18.6 of 39.3** |
| Optimal % of spend | 3.73% | 3.98% |
| Gap vs BEST single card | AED 566 | AED 491 |

**Read this table honestly.** Rate defects fell by 63%, which is the real win. Total
rejection fell only 56.0% -> 44.2% because D14b exposed 24.7% of scores that had been
silently passing. The headline "56%" was never the true number — it was the number a
half-broken filter produced. The gap vs best single card fell 566 -> 491 for the same
reason: some of that 566 was merchant-assumption inflation.

### What remains genuinely blocked

- **Spend-tier tables** (`cbd_super_saver`, `sc_x`, `rakbank_red`, `hsbc_max_rewards`,
  `cbd_one`): unchanged and still the largest single data bucket. See D10's statement
  of the circularity — it is a design decision, not an edit.
- **Merchant assumptions (24.7%, the new largest bucket).** Not a data defect at all:
  the data is right, the *spend model* has no notion of "share of category X spent at
  merchant Y". Fixing it needs a modelling decision, not research.
- **`rakbank_titanium` / `rakbank_world`**: pages fetched fine but publish only "up
  to" and point to a "Cashback Information" leaflet / Key Fact Statement PDF.
- **`cbd_visa_platinum`**: cbd.ae returns HTTP 403 to automated fetches.
- **`ei_amazon_world`**: rates depend on Amazon Prime membership, which the engine
  cannot know. Legitimately unresolvable as a single rate.
- **Lump bonuses**: unchanged; not a rate, no schema slot.
- **OPEN QUESTION:** should cards closed to new business (`sc_simply_cash`) be scored
  at all? They are useful to existing holders and misleading as recommendations. This
  needs a product decision about which question Fils answers.

---

# 2026-08-05 — D15: issuer schedules supplied directly

The pages D14 could not reach (`rakbank_titanium`, `rakbank_world`,
`cbd_visa_platinum`) plus the Citi and Mashreq earn/redemption tables were supplied
directly. Tiers **175 / 12 / 19 (206) -> 188 / 12 / 8 (208)**. Tier 2 untouched again.

## D15a. Citi — a unit error, not an arithmetic contradiction  ✅ RESOLVES D2

**All three Citi cards recorded ThankYou Points as "per AED 1". They are earned PER
USD.** Every Citi card was therefore overstated by the FX rate, ~3.67x.

This **resolves the D2 contradiction outright.** D2 could not reconcile 2 pts/AED with
the issuer's own 15,000 TY = AED 500 rebate (0.0333 AED/pt), because together they
imply a 6.7% return on all domestic spend. At the correct 2 pts/**USD** the same two
numbers give ~1.8%. Neither the earn rate nor the rebate rate was wrong — **the unit
was**, exactly as this changelog's own Citibank table suspected ("per USD, not per
AED — ~3.67x difference") and never applied. Issuer conversion 1 AED = 0.271 USD
matches the engine's `AED_PER_USD = 3.6725`.

**DO NOT PUBLISH is lifted on all three** (it had been applied to `citi_prestige` in
D2 and propagated to the other two in D14c).

Two further corrections fell out of the earn tables:
- `citi_premier` was missing its **3 pts/USD dining + fuel + groceries accelerator**
  entirely; now encoded as `supermarkets_fuel_dining`.
- `citi_rewards` folded groceries and non-AED into one bucket at 1.5. The issuer table
  shows **1.5 applies to non-AED only**; groceries earn the 1 pt/USD base. Split —
  this REMOVES an overstatement.

Still unencoded: the reduced-rate categories (insurance, education, real estate,
transport, utilities, telecom, government) are stated to earn less but **the rate is
not published**, so those categories remain overstated at the base rate.

## D15b. Mashreq Vantage — the placeholder was 2.85x too high  ✅ RESOLVES D3

Researched: **0.00263 AED/point**, was an unresearched 0.0075 placeholder. Mashreq's
redemption table gives cashback 380 pts = AED 1, noon 270, Amazon.ae 303. Cashback is
the floor and the only channel every holder can use, so it is the honest basis.

This was flagged in `valuations.ts` as the highest-value valuation outstanding, with a
note that the recommendation was stable only within ~±8% of it. It was out by 185%.
**It is also the whole of D3**: `mashreq_platinum_plus` read an implausible 4.19%
return purely because of this number.

## D15c. CBD Reward Points — 1.9x too high

**0.004 AED/point** (issuer-stated, 10,000-point minimum redemption), was an 0.0075
placeholder. Every CBD points card was overstated ~1.9x.

## D15d. RAKBANK — resolved, then flagged  ⚠️

Both cards' "up to" ceilings became certain rates from the schedule effective
1 Sep 2024. Three things fell out:

- **Both base rates were corrected DOWNWARD** (titanium 2% -> 1%, world 3% -> 1%).
  The advertised ceiling was the **e-wallet** rate; standard retail earns 1%. The
  e-wallet tier is not encoded because it and standard retail both map to canonical
  `other`, so encoding it would shadow the 1% (D14 rule: encode the lower).
- **Both were missing the 0.25% low-earn bucket entirely** (charities, government,
  bill payments, schools, education, transit, transport, telecom, real estate,
  petrol). That spend had been earning the base rate — a **4x overstatement**.
- Caps corrected: titanium's `overall_cap` was **null** (uncapped in aggregate!) and
  is now the stated 600; world's was 1100 and is now 1250.

**Then the plausibility guard fired on both, and it was right to.** Faithfully
encoded, `rakbank_world` reads 5.12% and `rakbank_titanium` 4.31% net annual return,
and admitting them moved the PUBLISHABLE median from 3.98% to **6.49%** with p90 at
**7.80%** — a 63% headline jump caused by two cards, pressed against the study's own
">8% does not exist" bar. World's AED 1,250 monthly cap implies up to AED 15,000/year
against the AED 120,000 annual spend it requires: 12.5%.

The encoding was re-checked line by line against the supplied schedule and matches.
**The doubt is about the source, not the transcription**, so both are marked DO NOT
PUBLISH pending the Key Fact Statement — most likely the headline rates are
promotional, or the caps are lower than recorded. With them excluded the publishable
median returns to exactly 3.98% / p90 4.52%.

## D15e. `dib_prime_infinite` — a fact encoded twice

Its `eu_spend` category carried the unparseable rate `"0 Wala'a Rewards"` — the card's
only tier-3 string — while `excluded_spend` **already** encoded the same fact
correctly. Duplicate category removed; scoring unchanged, because `excluded_spend`
zeroes all canonical `international`, which is strictly broader than EEA.

### Result

| | After D14 | After D15 |
| --- | --- | --- |
| Tier 1 / 2 / 3 | 175 / 12 / 19 (206) | **188 / 12 / 8 (208)** |
| Rate-defect rejection | 20.9% | **~17%** |
| Total rejection | 44.2% | **40.8%** |
| Publishable universe | 18.6 of 39.3 | 18.6 of 39.3 |
| Optimal % of spend | 3.98% | **3.98%** (unchanged) |

**The headline did not move, and that is the point.** Four of the five corrections
push value DOWN (Citi 3.67x, Mashreq 2.85x, CBD 1.9x, RAKBANK base rates and the
missing 0.25% buckets). The publishable median is unchanged because every card those
corrections touch is do-not-publish for independent reasons. A session that only
raised numbers would have been the suspicious one.

### Remaining tier 3: eight strings, all structurally unresolvable

Not unresearched — **unresolvable without schema or engine work**:
- **3 lump bonuses** (`fab_rewards_indulge`, `adcb_touchpoints_gold_titanium`,
  `cbd_smiles_signature`): not a rate, no schema slot.
- **2 `ei_amazon_world`**: rates depend on Amazon Prime membership. A PRODUCT decision
  — ask the user and carry two card variants, or publish the non-Prime baseline.
- **`cbd_visa_platinum` + `cbd_one`**: the blocked spend-tiered class. CBD's table is
  now IN HAND (0.55 / 2 / 3 / 5% by monthly spend band), so this is blocked on the
  engine, not on research. Note an unresolved contradiction recorded on the card: the
  1.5 pts/AED earn rate at 0.004 AED/pt is ~0.6%, consistent with the 0.55% bottom
  tier but irreconcilable with the 5% top tier (which needs ~12.5 pts/AED).
- **`ei_cashback`**: the issuer itself publishes only "up to 1%".

---

## D16. RAKBANK — the hold is lifted, and one uncapped base was found  ✅ RESOLVES D15d

Source supplied 2026-08-08: RAKBANK's own Titanium and World Cashback product pages,
stating **per-category cashback percentages AND their monthly caps together** — which
is the exact evidence D15d's `NEEDED TO RESOLVE` clause demanded, and the reason both
cards sat at `DO NOT PUBLISH`.

### Why the hold could be lifted on a marketing page

D15d's worry was never transcription; it was the SOURCE. Three checks, all passed:

1. **The cap arithmetic closes against an independent source.** The per-category caps
   on the product page sum to exactly the `overall_cap` already recorded from the
   separately-supplied 1 Sep 2024 schedule:

   | Card | Stated per-category caps (AED/mo) | Sum | Recorded `overall_cap` |
   |---|---|---|---|
   | Titanium | 100 x 6 (supermarket, dining, cinema, streaming, e-wallet retail, non-e-wallet retail) | **600** | 600 ✅ |
   | World | 400 travel + 300 supermarket + 300 dining + 150 e-wallet retail + 100 non-e-wallet retail | **1250** | 1250 ✅ |

   Two sources, neither derived from the other, agreeing to the dirham. That is
   materially stronger evidence than either alone.

2. **Promotional and standing terms are now separable.** The welcome bonuses (AED 500
   Titanium, AED 750 World) are explicitly dated **15 Jul – 15 Sep 2026**; the cashback
   percentages carry no date. This retires D15d's leading hypothesis ("the 10%/50%
   headline rates are promotional or introductory rather than standing"). The welcome
   bonuses are NOT encoded — same rule as the `adcb_talabat` promo in D12.

3. **The minimum monthly spend is restated against every category** (AED 2,000
   Titanium, AED 10,000 World), matching what was already encoded.

### The defect this pass found: an UNCAPPED base rate

Both cards' non-e-wallet retail rate is **1% capped at AED 100/month**. The engine was
modelling it as an uncapped base rate, because **the schema can cap a CATEGORY but
never `base_rate`** — so `buildEarnOptions` synthesised an uncapped virtual base for
every non-bonus category. (This is the base-rate-cap schema gap flagged on
`enbd_dnata_world` in D13; here it was load-bearing.)

Fixed within the existing schema by encoding the catch-all explicitly, which suppresses
the virtual base:
- **titanium**: gained `all_other_spend` 1% cap 100 (+1 tier-1 string).
- **world**: `other_retail` 1% cap 100 -> `all_other_spend` 1% cap 100. `other_retail`
  reached canonical `other` ONLY, so entertainment, international and transport spend
  still escaped to the uncapped virtual base. Same string count, same tier.

### Deliberately NOT changed

- **The 0.25% low-earn bucket is KEPT** on both cards though the product pages do not
  mention it. It rests solely on the 1 Sep 2024 schedule, and dropping it would RAISE
  each card's score. Absence from a marketing page is not evidence of absence, and the
  conservative reading is the one that stays. // review: confirm against the Key Fact
  Statement if it ever surfaces.
- **The e-wallet retail tiers stay unencoded** (2% Titanium, 3% World). They and
  standard retail both map to canonical `other`, so encoding the higher rate would
  shadow the 1% and overstate — the D14 rule. E-wallet spend remains understated.
- **Two PERKS were supplied and must never become categories**: World's 12-month
  Careem Plus membership (10% back on up to 10 rides, free delivery, DineOut deals) and
  50% off up to 4 VOX cinema tickets per month. Neither is an earn rate on card spend;
  both belong in `benefits`. This is the `rakbank_titanium` cinema-perk error the gap
  study header still names as a known offender.

### Effect

| Metric | Before D16 | After D16 |
|---|---|---|
| Tier 1 / 2 / 3 | 188 / 12 / 8 (208) | **189 / 12 / 8 (209)** |
| Cards held at DO NOT PUBLISH | 7 | **5** |
| `rakbank_world` net, dual-income profile | 6,450 (uncapped base) | **6,288** (4.99% of spend) |
| `rakbank_titanium` net, same profile | 5,436 | **5,274** (4.19% of spend) |

Tier 2 and tier 3 both UNTOUCHED — the check that a pass which lifted a publication
hold did not quietly re-tier anything else.

### Still open on these two cards

The Key Fact Statement would settle the 0.25% bucket and confirm the e-wallet tiers are
a genuine second grid rather than a headline. Neither blocks publication now.

---

## D17. Five issuer pages — and a second unit error  ⚠️ RESOLVES B2/B4-class items

Sources supplied 2026-08-08 for SC Journey, SC Smart Saadiq, ADCB LuLu Platinum,
ENBD LuLu 24/7 Platinum, HSBC Max Rewards and EI Amazon World.

### D17a. `sc_journey` — per AED recorded, per USD published  🚨 3.6725x OVERSTATEMENT

Standard Chartered's page: *"Earn 4 360º Rewards Points for every **USD 1** spent
internationally"* and *"2 360º Rewards Points for every **USD 1** spent locally"*.
All three rates were recorded `per AED 1`.

**This is the Citi error from D15a, at a different bank.** The card's own `data_caveat`
asserted the opposite — *"Points accrue on AED spend, not USD"* — with no source. That
claim is withdrawn.

Effect on a mid-range profile: the card is now **net −899/yr** (AED 1,575 fee against
rewards that no longer cover it), where the per-AED encoding made it comfortably
positive. A card that loses money is a legitimate answer.

⚠️ **`sc_smart_saadiq` is now suspect.** Same programme, still recorded per AED 1, and
no earn table was supplied for it. Left unchanged — changing it would be inventing a
rate — but flagged. **If SC quotes 360 Rewards per-USD programme-wide, that card is
overstated 3.67x too.** Its earn table is the single highest-value thing still missing.

A unit error is **invisible to the tier checksum** (the string parses cleanly either
way). The only guards are the implausibility check and a human reading the rate.

### D17b. LuLu Points were TWO currencies sharing one key  🚨 100x APART

| Issuer | Stated redemption | AED/point | Cross-check |
|---|---|---|---|
| ADCB | 5,000 points = AED 50 | **0.01** | 8 pts/AED at LuLu = "8% back" ✅ |
| Emirates NBD | 1 point = AED 1 | **1.00** | 7 pts per AED 100 = "7%" ✅ |

Both were priced from one `"LuLu Points"` key at an 0.0075 placeholder, so one card was
wrong by two orders of magnitude whatever value was chosen. Each issuer's own earn table
independently confirms its own scale. Now separate currencies.

The damage was hidden because both cards' AED values are percent-driven (the unit
cancels) — it surfaced only in the **caps**, which are denominated in points. ENBD's
statement cap read as **AED 12.50** under the shared placeholder. This is the
cap-unit ambiguity flagged earlier; it was a currency error, not a cap error.

ENBD's full reduced grid was also missing (all stated as fractions of the 0.7% base):
car dealers/grocery/supermarkets-outside-LuLu/insurance/fast food **0.175%**,
education/government/real estate **0.07%**, EU retail **0.175%**. Cap corrected
**200 → 1,667 points/statement**, applied as an overall cap (the issuer publishes one
statement cap, not the three per-category 200s recorded).

*Known collapse:* government services should earn 0.07% but canonical `utilities` also
carries Utility Bills, stated explicitly at 2%. The 2% is kept — utility bills are the
bulk of that bucket for a UAE household — so government-services spend is credited 2%.

### D17c. `ei_amazon_world` — the Prime grid published, hold lifted

The full two-column table resolved the DO-NOT-PUBLISH hold by applying the resolution
the previous caveat had already recorded: **publish the non-Prime baseline.**
Encoded: on-Amazon 3%, domestic 1%, EEA+UK 0.25%, named low-earn list 0.25%.
Prime members (6% / 2.5% / 2% / up to 2%) are **understated**.

The certain 1% base is licensed by the D14 condition — the issuer's "Up to 1%" is
explained by the 0.25% row beneath it, and **both** are now encoded rather than the
variance being assumed away. Amazon Reward Points valued at **1.0** (issuer-stated),
was an 0.0075 placeholder.

### D17d. Two cards are CLOSED TO NEW APPLICANTS — a new concept

`hsbc_max_rewards` ("This card isn't available to new customers") and
`sc_smart_saadiq` ("not available for new clients"). Both were being recommended.

New field `closed_to_new_applicants` + `isRecommendable(card)` in the engine. Such a
card is **still scored** (a holder deserves an honest number, and the app's held-cards
baseline must include it) but is **never recommended** — the advice is useless, not
wrong. Reported as `excludedForClosedProduct`, separate from `excludedForDataCaveat`,
because "we're checking the data" and "the bank stopped offering it" are different facts.

`hsbc_max_rewards` base also split: `"1 point per AED 1; 2 points per AED 1 when
monthly eligible spend exceeds AED 3,000"` → the lower tier (D14 rule). HSBC Rewards
Points **remain unvalued** — the issuer publishes redemption channels (airline miles,
hotel points) but no AED rate.

`sc_smart_saadiq` fee corrected **315 → 0** ("No Fee On Annual Fee").
`360 Rewards Points` valued at **0.01** (issuer: 100 Rewards Points = AED 1), was 0.0075.

### Effect

| Metric | Before D17 | After D17 |
|---|---|---|
| Tier 1 / 2 / 3 | 189 / 12 / 8 (209) | **196 / 11 / 6 (213)** |
| Held at DO NOT PUBLISH | 5 | **4** |
| Closed to new applicants | not modelled | **2** |
| Recommendable universe | 48 | **47** |

Ten of the eleven remaining tier-2 strings are the **spend-tiered class**
(`sc_x`, `cbd_super_saver`, `rakbank_red`). That is now the single biggest
data-quality lever left, and it is blocked on engine work, not research.

---

## D18. Merchant share — the spend model learns where spending happens (2026-08-09)

Not a data fix. A **spend-model** change, and the one the previous three passes kept
deferring: fifteen of the gap study's twenty-one card rejections were co-brand cards
whose bonus is locked to a single retailer, and every one of them was rejected for the
same reason — *the data is right, the model has no notion of merchant share.*

### What was wrong

`emaar_malls` pays 6.25% and maps to canonical `other`. `lulu_supermarket` maps to
`groceries`. `noon_...` maps to `other`/`dining`/`groceries`. With no way to say how
much of a category actually lands at that retailer, the engine credited the merchant
rate to **every dirham of the whole category** — a user's entire `other` spend scored
as if each dirham were spent inside an Emaar mall.

The gap study excluded these cards from its publishable universe. **The live product
did not** — `optimizePortfolio` recommends them, flagged, so the overstatement was
reaching users behind a collapsed disclosure.

### The decision

Ask the user. (The alternatives were a stated blanket haircut, or keeping the cards out
of published claims — the status quo.) A share is now an INPUT, alongside spend itself.

### How it is modelled

`packages/engine/src/merchant-share.ts`, enforced in the allocator as a **capacity, not
a rate haircut**. A per-(category, merchant) gate node is inserted into the min-cost
flow with inbound capacity `share x category spend`; the yield cost stays on the
gate → option edge, so path costs and therefore optimality are unchanged.

Two properties a haircut would have got wrong, and the reason for the node:

1. **The remainder is not destroyed.** Spend that is not at the merchant flows on to
   the next-best option — the card's base rate, or another card — exactly as over-cap
   spend does. Scaling the rate would have left that spend parked on a bonus it never
   earned.
2. **Two cards bonusing one merchant share ONE pool.** 30% of groceries at LuLu does
   not become 60% because you carry a second LuLu card.

Absent shares keep the previous behaviour exactly, so the change is additive. An
**invalid** share (30 where 0.3 was meant) is REJECTED, not clamped — clamping a typo
to 1.0 would silently produce the maximally optimistic reading.

A stated share also changes the flag: it no longer carries the "spend occurs at"
phrasing and no longer sets `uncertain`, because a number the user gave us is an input,
not an assumption of ours. That is the mechanism by which answering the question moves
a co-brand card into the publishable universe.

### Effect — measured on the five segment centres

| | universe (no shares → shares) | optimal % of spend |
|---|---|---|
| Early-career expat | 15 → 18 | 6.74 |
| Family w/ school fees | 30 → 44 | 5.13 |
| Frequent traveller | 30 → 44 | 5.90 |
| Young single, dining-led | 23 → 32 | 6.30 |
| Dual-income, balanced | 30 → 44 | 5.58 |

**The publishable universe grows by up to 47% and the recommended portfolio does not
change in a single segment — identical to the dirham.** The co-brand cards' apparent
edge was the 100%-of-category assumption, not the cards. This work therefore does not
raise the headline; it removes an exclusion and makes the answer honest. Nobody should
quote the universe growth as a value increase.

### Guards (the second half of this pass)

The filters that measure all of the above were, twice in this project's history,
**dead** — matching nothing while looking exactly like a filter with nothing to reject,
and both times inflating the headline. They are now declared as named data in
`study-filters.ts`, shared by `gap-study.test.ts` and `gap-diag.test.ts` (they can no
longer drift), and `study-filters.test.ts` asserts:

- every rate-defect clause still matches at least one real flag, with a failure message
  naming the clause and why it exists;
- the do-not-publish caveat still matches at least one card;
- the SOUND filter rejects some cards and not all cards;
- **the plausibility bar is an assertion, not a console note** — no publishable
  portfolio, and no single publishable card, may return more than 8% of spend, with a
  7% tripwire on the median (observed 5.90%).

That last one was previously a printed line with an arrow next to it that a human had
to notice.

---

# D19. Merging `origin/main` — a second, independent attack on the same two biases (2026-08-16)

A `fix/rate-ceiling-bias` branch was pushed to GitHub and merged to `main` by another
hand, from a commit predating this line of work. It attacks the SAME two selection
biases, arrives at substantially the same conclusions, and — because it forked early —
carries none of D10–D18. This section records what was taken from it, what was not,
and the one thing the merge itself broke.

## D19a. What the two sides agreed on

The remote's `normalize-rate.ts` reaches the identical verdict on `capModeled`: a
ceiling is bounded 0..X whether or not a cap is modelled, because `optimizePortfolio`
SELECTS on the rate, and taking every headline at face value makes the optimum a
maximum-of-maxima. Its own measurement (9.61% pooled median before, 8.86% after) is
within rounding of D5's. Two independent derivations of the same defect is the
strongest evidence either of them is right.

## D19b. TAKEN — the reward-currency check is gated on the card's actual currency

Ours stripped ANY leading "back in <words>" / "back as <words>" phrase before testing
whether a scope was benign. The remote's threads the card's `rewards.currency` into
`RateContext` and strips the phrase only when it NAMES that currency, matching on whole
words so "5% back as Wala'a Rewards" still matches a `DIB Wala'a Rewards` currency field.

**Theirs is strictly safer and was adopted.** Ours would have laundered a genuine scope
into tier 1 the moment the data contained a phrase like "back as statement credit at
partner outlets" — the phrase is stripped, the remainder never reaches the punctuation
test, and an unmodelled condition scores as certain. Nothing in today's 53 cards trips
it, which is exactly why it was worth taking: the guard costs nothing and closes a hole
that only opens when the data changes.

**Tier counts are UNCHANGED at 196 / 11 / 6 over 213 strings.** That was verified by
running both normalizers over the current `cards.json` string by string: 14 strings have
their tier decided by the currency gate, and all 14 land where the ungated version put
them. The checksum in `normalize-rate.test.ts` did not move, and the four tests that
asserted the old ungated behaviour now pass `rewardCurrency` explicitly.

## D19c. TAKEN — merchant locks are BOUNDED when nobody has stated a share

The remote found the merchant-lock optimism independently (its Section E) and fixed it
by bounding every merchant-locked bonus 0..full. D18 fixed the same defect by ASKING the
user and enforcing the answer as a flow capacity. These are not competing answers; they
answer different questions, and D18's own docstring named the gap:

> An unstated merchant keeps the old behaviour — the full category, flagged as an
> optimistic assumption.

That was the hole. The remote's own Section E5 independently concludes *"the product
answer is to ask"* — which is D18. So **both are now wired, and they are disjoint by
construction**: a lock with a stated share keeps its real rate and is constrained by the
allocator; a lock without one has its rate bounded 0..full and never enters the share
machinery. `merchantLocksResolved` is the third case — `which-card.ts` resolved the
merchant, so every surviving lock genuinely applies and is scored in full.

Order matters and is documented in `precomputeCardData`: the suppressed-category
("penalty bucket") lock is decided on the UNBOUNDED yields, because whether a card runs
a penalty bucket is a fact about the issuer's schedule and must not change with what we
happen to know about the user's merchants. Bounding happens after, and the yields the
flow routes on are recomputed from the bounded rates.

### The consequence worth stating plainly

This branch also ranks portfolios on the LOWER bound of net value (not the midpoint,
which the remote used). Combined with bounding, an unstated merchant bonus contributes
**zero** to ranking. A co-brand card can therefore no longer win a recommendation on
merchant value nobody has confirmed — it has to earn the place on its base rate. That is
stricter than the remote's midpoint routing, and it is the deliberate choice: ranking on
a midpoint asserts a return that appears nowhere in the card's terms.

Two tests were rewritten because they had encoded the old meaning, not because they
broke:

- `merchant-share.test.ts` compared "with shares" against "without shares" to pin that a
  share can only REMOVE unearned value. Unstated is no longer the optimistic ceiling, so
  the baseline is now `{ merchantLocksResolved: true }` — the actual full-credit case. A
  third test was ADDED so that wiring the bound out would fail something.
- `api/optimize/route.test.ts` required "all shares 0" to differ from omitted. At the
  floor those are the same statement, so it now compares the two ENDS of the stated
  range (0 vs 1), which tests the wiring without depending on which portfolio wins.

## D19d. NOT TAKEN — the card data, all of it

Every one of the five `cards.json` conflicts resolved to this branch's version, because
the remote forked before D10–D17. Its file still carries: "No general base cashback
published" as three cards' base rates (unparseable — the reason D10 set an explicit
conservative 0%), the CBD and Etihad ceilings as prose the normalizer cannot read,
`rakbank_world.overall_cap` at 1100 rather than the sourced 1250, one `LuLu Points`
currency where D17b split the two that are 100x apart, and none of the D-series
`data_caveat`s. Its ADCB and RAKBANK caveats are earlier drafts of ours.

One provenance conflict is worth recording because the two files contradicted each
other: the remote states `rakbank_world`'s AED 10,000 minimum spend is **UNSOURCED**, "a
reviewed modelling assumption supplied by the engine owner, NOT a published RAKBANK
threshold". D16 records RAKBANK's own product page restating that minimum against every
category, which is part of what lifted the card's publication hold. **D16 supersedes
it** — the remote's note was written before the page was supplied. `card.test.ts`
asserted the literal word `UNSOURCED`; it now asserts the D16 sourcing instead, because
the point of that test was that the number must not be silently unattributed, not that
it must stay unattributed forever.

## D19e. THE MERGE ITSELF INTRODUCED A DATA DEFECT — caught, fixed, worth the warning

Both sides had reordered the `categories` array on four cards (`international_spend`
first here, last there). Git's line-based merge read the remote's move as an INSERTION
and applied it on top of ours, **silently duplicating `international_spend`** on
`adcb_touchpoints_gold_titanium`, `dib_shams_platinum`, `dib_shams_infinite` and
`sc_smart_saadiq`. The merged file was valid JSON and the app ran.

It surfaced only because the tier checksum read 200 tier-1 strings against an expected
196 — a guard catching a defect it was not written for. Note the shape of the near miss:
the first hypothesis was that the currency gate had re-tiered four strings, which is a
plausible and completely wrong explanation that a less specific test would have let
stand. The duplicates were removed and `cards.json` verified byte-identical to this
branch's pre-merge version.

**The warning:** a reordering of a JSON array and an edit to the same array cannot be
merged by a line-based tool. Any future merge touching `cards.json` should be followed by
a duplicate-category check across every card, not just a JSON-validity check.

## D19f. TAKEN — one test

`gap-study.test.ts` gained the remote's ordering invariant, ported onto this branch's
row shape: `naive <= diligent <= optimal` on every row of every universe. It is
data-independent (the median single card cannot beat the best single card; a 1-card
portfolio is inside the optimizer's own search space), and it is exactly the assertion
that would have caught the `includeUnpublishable` harness mismatch, which reported a
best single card at 6.01% of spend beating an "optimal" portfolio at 3.24%.

## D19g. Incidental

`optimize-portfolio.ts` contained a literal NUL byte inside a template literal, used as
an impossible separator in a map key. It made git classify the file as BINARY and refuse
to merge it textually. It is now the escape `\0` — same separator at runtime, and the
file is diffable again.

## Result

- `packages/engine`: 362 passing, 2 skipped, `tsc --noEmit` clean.
- `apps/web`: 143 passing, `tsc --noEmit` clean.
- Tier checksum unchanged at 196 / 11 / 6 over 213 strings.
- `cards.json` unchanged from this branch's pre-merge state.
