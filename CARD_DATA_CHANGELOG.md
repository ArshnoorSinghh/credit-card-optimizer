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
