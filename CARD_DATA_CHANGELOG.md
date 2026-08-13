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

# Section D — the rate-ceiling selection bias (2026-08)

Branch: `fix/rate-ceiling-bias`. Started 2026-08-13.

Trigger: a prior analysis reported the engine overstates rewards by roughly 3x.
This section reproduces that claim with a measurement harness, fixes the mechanism
that causes it, and reports — honestly — how much of the overstatement the fix
actually removes. Same rules as every section above: **nothing is edited unless a
source or an explicitly-flagged modelling decision supports it, and no number is
invented.**

## D0. The measurement harness (new): `packages/engine/src/gap-study.test.ts`

- **What it is:** a seeded sweep over **200 synthetic UAE spending profiles** drawn
  from 5 weighted segment archetypes — early-career expat **0.40**, young single
  **0.20**, dual-income **0.20**, family with school fees **0.13**, frequent
  traveller **0.07**. For each profile it compares three strategies on the same
  card universe and eligibility filter:
  - `naive` — **median** eligible single card (a user who picks without optimizing),
  - `best1` — best eligible single card (`optimizePortfolio.best1`),
  - `optimal` — best 1-3 card portfolio (`overallBest`).
- **Reporting:** per-segment and population-weighted rows printing
  `naive% / best1% / optimal% / gap%` as a share of annual spend, so
  `naive% + gap% ~= optimal%` is checkable on every row, plus the gap in AED/yr and
  the share of profiles whose optimum is multi-card.
- **Reproducibility:** seeded (`mulberry32`, seed `20260813`), so any movement in
  the output is an engine change, never sampling noise. Gated behind
  `describe.skipIf(!process.env.GAP_STUDY)` — it runs ~200 exhaustive portfolio
  optimizations and is far too slow for the normal suite.
  Run it with `GAP_STUDY=1 pnpm --filter @fils/engine test gap-study`.
- **Weights are an assumption, not a measurement.** They are the study's stated
  input, printed with the results so a reader can re-weight. Flagged as such.

**Reproduced the reported finding:** on the unmodified engine the harness returned a
**pooled median optimal return of 9.61% of annual spend** (population-weighted
10.05%; weighted gap AED 12,245/yr; multi-card optimum on 100% of profiles). No real
UAE card portfolio pays anything close to that once caps, fees and minimum-spend
gates bite. The ~3x overstatement claim is **confirmed**.

> Note: the brief anticipated ~9.4%; this harness measures **9.61%**. The archetype
> spend bands and jitter here are my own construction, so the two populations are not
> byte-identical. The finding reproduces; the third decimal does not, and is not
> claimed to.

## D1. The mechanism — `normalize-rate.ts`, the `capModeled` fork  ✅ FIXED

- **What was there:** `normalizeRate("Up to X%", ctx)` returned
  `{ value: X, confidence: "high" }` whenever the card carried a `monthly_cap` or
  `annual_cap`, on the reasoning that the cap — not a discounted rate — expresses
  the constraint. The code comment claimed *"No card in today's data hits this
  branch"*. **That comment was stale: 8 rate strings hit it** —
  `rakbank_titanium` (supermarkets, dining, cinemas, video_streaming) and
  `rakbank_world` (supermarkets, dining, travel_and_hotels, other_retail).
- **Finding:** read one card at a time the old reasoning is **sound**. It fails under
  **selection**. `optimizePortfolio` scores all ~53 cards on these numbers and keeps
  the best 1-3, so taking every ceiling at face value makes the winner a
  **maximum-of-maxima** — an estimator biased upward by the spread of the ceilings,
  and biased *more* the more cards are considered. **The bias is in the selection,
  not in the per-card arithmetic**, which is why the fix belongs at the point where
  an unqualified ceiling becomes a certainty rather than in the optimizer.
- **Action:** both branches of the fork now emit a bounded range
  `{ value: null, range: { min: 0, max: X }, confidence: "unknown" }`. The cap
  context is still consulted, but only to explain *why* the rate is uncertain, so
  the review list can still tell the two cases apart. Per CLAUDE.md, the uncertainty
  now propagates as a range instead of a silent point estimate.
- **Evidence it bit (`rakbank_world`, grocery/dining/travel profile, salary 30k):**

  | | before | after |
  | --- | --- | --- |
  | rank among single cards | **#1 of all eligible** | #3 |
  | net annual value | AED 10,410 (8.67% of spend) | AED 4,830 (4.03%) |
  | reported range | `[10410, 10410]` — a **false certainty** | `[-750, 10410]` — honest band |

- **Regression lock:** `optimize-portfolio.test.ts` case 8 asserts the range is
  genuinely wide, that `rakbank_world` no longer wins `best1` on that profile, and
  structurally that **no** `"Up to X%"` rate anywhere in the dataset carries a
  numeric value.

## D2. Data fixes

### D2a. `rakbank_world` — minimum monthly spend  ⚠️ APPLIED, FIGURE UNSOURCED
- **In data:** `min_monthly_spend_required_aed: 0`, alongside four "Up to 10%" /
  "Up to 3%" categories and an AED 1,100 overall cap.
- **Finding:** with no gate the engine paid the top advertised tier at **every**
  spend level. Combined with D1 this made the card the single largest contributor to
  the inflated optimum.
- **Action:** set to **10,000**.
- 🚩 **UNSOURCED — flagged, not sourced.** The 10,000 figure is a reviewed modelling
  assumption supplied by the engine owner, **not** a published RAKBANK threshold; the
  product page still does not expose the tier table (the card's pre-existing
  `data_caveat` already said so). Recorded verbatim in the card's `data_caveat` with
  the word `UNSOURCED`, and locked by a test asserting the caveat retains it.
  **Confirm against the card's T&C before treating it as fact.**

### D2b. Compound "local; international" base rates on 6 cards  ✅ FIXED
- **What was there:** base rates of the form
  `"X per AED 1 on eligible local spend; Y per AED 1 on eligible international spend"`.
- **Finding:** a **trap**. The normalizer parses only the leading number, so the
  international rate `Y` was **silently dropped** — while the string still claimed
  the card paid it. The compound also forced the rate to tier 2 for a condition that
  isn't really unmodelled.
- **Action — split into a real `international_spend` category (4 cards):**

  | Card | base_rate now | new `international_spend` |
  | --- | --- | --- |
  | `adcb_touchpoints_gold_titanium` | 0.5 TouchPoints per AED 1 on eligible local spend | 0.75 TouchPoints per AED 1 |
  | `dib_shams_platinum` | 1 Wala'a Reward per AED 1 on eligible local spend | 2 Wala'a Rewards per AED 1 |
  | `dib_shams_infinite` | 2 Wala'a Rewards per AED 1 on eligible local spend | 4 Wala'a Rewards per AED 1 |
  | `sc_smart_saadiq` | 1 360 Rewards Point per AED 1 on eligible local spend | 2 points per AED 1 |

  No caps were invented — the source strings state none, so both are `null`.
  `international_spend` is already mapped to the `international` bucket in
  `score-card.ts`'s `MATCH_TABLE`, so no engine mapping change was needed.

- **Action — clause DROPPED, not split (2 cards):** `adcb_lulu_platinum` (1.75
  LuLu Points) and `adcb_touchpoints_platinum` (1.5 TouchPoints).
  **Why the exception:** both already carry an explicit `uk_and_eea_spend` carve-out
  at the **reduced** rate of 0.4 points/AED, which maps to the *same* `international`
  bucket. Adding a blanket international rate would let the allocator route all
  international spend to the higher rate and **shadow the carve-out**, overstating
  exactly what ADCB reduced. Both figures are unverified against ADCB's current
  schedule, so they are recorded in each card's `data_caveat` rather than modelled.
- **Regression lock:** `card.test.ts` now fails if any `base_rate` again hides a
  semicolon-joined international rate.

### D2c. Two normalizer false positives  ✅ FIXED
Both made honest rates look conditional, pushing clean parses down to tier 2:

| # | Pattern | Example | Why it was wrong |
| --- | --- | --- | --- |
| 1 | Currency-definition parenthetical | `"1.5% back in Plus Points on general eligible spend (1 Plus Point = AED 1)"` | The `(` tripped the scope test. The parenthetical **defines the unit's value**; it is not a condition on earning. |
| 2 | `back in / back as <Currency>` | `"6.25% back in UPoints"` | Read as a trailing scope, but it only restates `rewards.currency` — a fact the data already carries. |

- **Action:** `RateContext` gained an optional `rewardCurrency`; `score-card.ts`
  passes `card.rewards.currency` for both category rates and the base rate.
  Both exemptions are **deliberately narrow**:
  - the parenthetical must match `(<N> <currency> = AED <M>)`, so FAB's
    `"(utilities, government, education, ...)"` enumeration, Mashreq's
    `"(up to 2% during promotional periods)"` and RAKBANK's
    `"(1.5 points per AED 5)"` **still flag low**;
  - the phrase must actually **name that card's own currency** (whole-word, tolerant
    of the `DIB Wala'a Rewards` vs `Wala'a Rewards` prefix mismatch and the mixed
    straight/typographic apostrophes). `"5% back in Skywards Miles"` on a Plus Points
    card still flags low, and with no currency context the old conservative behaviour
    holds.
  - Strings with a genuine extra condition are untouched: `enbd_dnata_world`
    (`", capped at 3,000 dnata Points per statement cycle"`) and
    `enbd_lulu_247_platinum` (`"when the AED 2,500 monthly threshold is not met"`)
    both correctly remain tier 2.

## D3. Tier arithmetic — closes exactly at every step

Verified after each change independently, not just at the end:

| Step | tier 1 | tier 2 | tier 3 | total | delta |
| --- | --- | --- | --- | --- | --- |
| baseline | 126 | 46 | 21 | 193 | — |
| D1 `capModeled` fork | **118** | 46 | **29** | 193 | -8 t1 / +8 t3 (the 8 capped "Up to X%" rates) |
| D2c false positives | **129** | **35** | 29 | 193 | +11 t1 / -11 t2 |
| D2b compound split | **139** | **29** | 29 | **197** | +10 t1 / -6 t2; +4 strings (the 4 new categories) |

Tier 3 is untouched by the last two steps, as expected — neither touches an
unresolvable rate. The locked counts in `normalize-rate.test.ts` were updated to
`139 / 29 / 29` over `197` strings, with the derivation recorded inline.

**Suite: 280 passing, 2 skipped** (the 2 skipped are the gated gap study).
Baseline was 273 passing. `tsc --noEmit` clean in **both** `packages/engine` and
`apps/web`.

## D4. ⚠️ Outcome vs. expectation — the fix works, but does NOT reach the target

The brief expected, after these changes: median optimal **~3.45%**,
population-weighted gap **~AED 3,383/yr**, multi-card optimum **~99.5%**.
**Measured, on the same harness, same seed:**

| metric | before | after (measured) | expected | reached? |
| --- | --- | --- | --- | --- |
| pooled median optimal% | 9.61% | **8.86%** | ~3.45% | ❌ no |
| population-weighted gap | AED 12,245 | **AED 11,249** | ~AED 3,383 | ❌ no |
| multi-card optimum | 100.0% | **100.0%** | ~99.5% | ❌ no |

The D1 fix removes roughly **0.75pp** of the overstatement. It is doing exactly what
it should — `rakbank_world`'s false certainty is gone and its ceiling now reaches the
ranking as a band — but the ceiling bias was **not** the dominant term in the
population median. **I did not tune the study or the data to reach 3.45%**; the
numbers above are what the specified changes actually produce.

### Where the remaining overstatement comes from (measured, not guessed)

A diagnostic run — cloning the dataset and dropping merchant-locked reward
categories, **no engine change** — isolates the next term:

| dataset variant | median optimal% | weighted gap |
| --- | --- | --- |
| current (after this pass) | 8.86% | AED 11,249 |
| with merchant-locked bonuses removed | **6.21%** | AED 8,582 |

1. **Merchant-lock optimism (~2.65pp).** `emaar_malls` / `emaar_hospitality` at
   6.25% are applied to *all* generic `other` / `travel` spend, and
   `first_10_talabat_orders` at 35% to dining. This is the **same
   maximum-of-maxima structure as D1** — the optimizer will always select the card
   with the most optimistic merchant assumption. It is currently
   **flagged-by-design** (Section B6 above) rather than discounted. Out of scope
   here: changing it is a modelling decision on human-owned engine code.
2. **Missing per-category caps (the remainder).** Several top-ranked cards score
   uncapped bonus categories that the real products cap. Example:
   `mashreq_platinum_plus` returns **4.86%** on a median early-career profile from
   `"10 Vantage points per AED 1"` on supermarkets/fuel/dining with **no cap
   modelled**, on a currency (`Mashreq Vantage`) whose valuation is itself an
   explicitly **low-confidence placeholder** (`0.0075`, "NOT researched"). An
   unverified earn rate times an unverified valuation yields a ~7.5% effective
   category rate. `adib_cashback_visa` (4% across four uncapped categories) is the
   same shape.

Both are **already on the record** in this document — the Section A "📌 Pattern
emerging" note calls per-category caps and min-spend thresholds "the highest-value
thing for the team to confirm", and the `valuations.ts` blocker section holds the
point values. **Neither can be fixed without issuer KFS data, and per Data rule D I
will not invent caps or point values to make the headline number land.**

### Recommended next pass (in expected-impact order)
1. **Model per-category reward caps + min-spend gates** from issuer KFS for the
   cards that now top the ranking — `mashreq_platinum_plus`, `adib_cashback_visa`,
   `adcb_365_cashback`, `dib_consumer_reward`. Highest impact by a wide margin.
2. **Resolve `Mashreq Vantage`** (and the other placeholder valuations in the
   `valuations.ts` table above). A low-confidence valuation on an uncapped
   double-digit earn rate is the single most leveraged unknown in the dataset.
3. **Decide the merchant-lock policy.** Options: discount merchant-locked bonuses by
   an assumed realization share, or exclude them from `optimizePortfolio` selection
   while still showing them in `which-card` (which *does* know the merchant). This is
   a product/modelling call for the engine owner, not a data fix.
4. Re-run `GAP_STUDY=1` after each — the harness is seeded, so the deltas are clean.
