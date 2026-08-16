import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import { normalizeRate, rateTier, type NormalizedRate } from "./normalize-rate";

// The engine tsconfig has no DOM/Node libs (types: []). Declare just the console
// surface the sweep uses so this stays type-clean without pulling in @types/node.
declare const console: { log(...args: unknown[]): void };

describe("normalizeRate — tier 1 (clean, high confidence)", () => {
  it("parses percent cashback", () => {
    expect(normalizeRate("5%")).toMatchObject({
      value: 0.05,
      unit: "percent",
      confidence: "high",
    });
    expect(normalizeRate("1.5%")).toMatchObject({ value: 0.015, unit: "percent" });
  });

  it("treats an all-spend scope as a clean blanket rate", () => {
    expect(normalizeRate("1% on all spend")).toMatchObject({
      value: 0.01,
      unit: "percent",
      confidence: "high",
    });
  });

  it("parses points-per-AED, including branded TouchPoints", () => {
    expect(normalizeRate("3 points per AED 1")).toMatchObject({
      value: 3,
      unit: "points_per_aed",
      confidence: "high",
    });
    expect(normalizeRate("2 TouchPoints per AED 1")).toMatchObject({
      value: 2,
      unit: "points_per_aed",
      confidence: "high",
    });
  });

  it("keeps miles-per-USD and miles-per-AED as distinct units", () => {
    expect(normalizeRate("1.5 miles per USD 1")).toMatchObject({
      value: 1.5,
      unit: "miles_per_usd",
      confidence: "high",
    });
    expect(normalizeRate("1 mile per AED 1")).toMatchObject({
      value: 1,
      unit: "miles_per_aed",
      confidence: "high",
    });
  });

  it("strips a trailing FX annotation without lowering confidence", () => {
    expect(normalizeRate("1 mile per USD 1 (approx AED 3.67)")).toMatchObject({
      value: 1,
      unit: "miles_per_usd",
      confidence: "high",
    });
  });

});

describe("normalizeRate — 'up to X%' is a ceiling, capped or not", () => {
  /*
    This pair used to assert opposite things: a CAPPED "up to X%" was tier 1 at X,
    an UNCAPPED one was tier 3 bounded 0..X. The fork was removed — see the long
    comment in normalize-rate.ts. Scoring every capped ceiling AT the ceiling made
    optimizePortfolio, which SELECTS on that rate, return a maximum-of-maxima.
  */
  it("bounds a CAPPED ceiling 0..X rather than asserting X", () => {
    const r = normalizeRate("Up to 5%", { monthlyCap: 200 });
    expect(r).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
    // The note must distinguish it from the uncapped case — different review task.
    expect(r.note).toContain("cap bounds the AED outcome");
  });

  it("bounds an UNCAPPED ceiling 0..X the same way", () => {
    expect(normalizeRate("Up to 5%")).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
  });
});

describe("normalizeRate — naming the reward currency is not a condition", () => {
  /*
    "6.25% back in UPoints" is exactly as certain as "6.25%": the trailing text
    names the currency, which rewards.currency already carries and valuations.ts
    already prices. Treating it as a scope cost ~10 clean rate strings a tier.

    The phrase is stripped ONLY when it names THIS card's currency, which is why
    every case here supplies `rewardCurrency`. Stripping any "back in <X>" would
    also strip one naming a currency the card does not pay in — a real scope. The
    mismatch and the no-context cases are asserted in the tier-2 block below.
  */
  it.each([
    ["6.25% back in UPoints", "UPoints"],
    // The label need only NAME the currency, not equal it: dib_shams_infinite
    // writes "Wala'a Rewards" where its currency field reads "DIB Wala'a Rewards".
    ["5% back as Wala’a Rewards", "DIB Wala’a Rewards"],
    ["1.5% back in Plus Points on general eligible spend (1 Plus Point = AED 1)", "Plus Points"],
    ["1.25% back as talabat credit on other eligible retail purchases", "talabat credit"],
  ])("keeps %s at high confidence", (raw, currency) => {
    expect(normalizeRate(raw, { rewardCurrency: currency }).confidence).toBe("high");
  });

  it("still flags a REAL scope hiding behind the currency name", () => {
    // "non-Emaar" is a genuine condition the structured data does not model, so
    // stripping "back in UPoints" must not rescue this one.
    expect(
      normalizeRate("1.25% back in UPoints on eligible non-Emaar spend (10 UPoints = AED 1)", {
        rewardCurrency: "UPoints",
      }).confidence,
    ).toBe("low");
  });

  it("still flags a rate carrying a cap condition in prose", () => {
    expect(
      normalizeRate(
        "1.5% back in dnata Points on eligible domestic and international spend, capped at 3,000 dnata Points per statement cycle",
        { rewardCurrency: "dnata Points" },
      ).confidence,
    ).toBe("low");
  });
});

describe("normalizeRate — tier 2 (parses but condition missing, low confidence)", () => {
  it("flags a merchant-scoped base rate", () => {
    const r = normalizeRate("10% on Emaar purchases");
    expect(r).toMatchObject({ value: 0.1, unit: "percent", confidence: "low" });
    expect(r.note).toBeTruthy();
  });

  it("flags another scoped base rate", () => {
    expect(normalizeRate("5% on dnata travel")).toMatchObject({
      value: 0.05,
      unit: "percent",
      confidence: "low",
    });
  });

  it("still flags 'back in X' when X is NOT this card's reward currency", () => {
    // The exemption is narrow: it only covers a phrase that names the card's OWN
    // payout currency. Anything else is a real scope and must keep flagging low —
    // otherwise the exemption would launder arbitrary conditions into tier 1.
    expect(normalizeRate("5% back in Skywards Miles", { rewardCurrency: "Plus Points" })).toMatchObject({
      confidence: "low",
    });
    // ...and with no currency context at all, the conservative old behaviour holds.
    expect(normalizeRate("5% back in Plus Points")).toMatchObject({ confidence: "low" });
  });

  it("keeps flagging a parenthetical that states a real condition", () => {
    // Only "<N> <currency> = AED <M>" definitions are exempt. An enumeration of
    // categories, or a promotional qualifier, still marks the rate as scoped.
    expect(
      normalizeRate(
        "0.15% on select low-interchange categories (utilities, government, education)",
      ),
    ).toMatchObject({ confidence: "low" });
    expect(
      normalizeRate("0.3 AirRewards Points per AED 1 on eligible local spend (1.5 points per AED 5)"),
    ).toMatchObject({ confidence: "low" });
  });
});

describe("normalizeRate — tier 3 (unresolvable, unknown confidence)", () => {
  it("bounds 'up to X%' as 0..X when no cap models it", () => {
    const r = normalizeRate("Up to 5%"); // no context => no cap
    expect(r).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
  });

  it("bounds 'up to X%' as 0..X EVEN WHEN a cap models the constraint", () => {
    // Regression lock for the rate-ceiling selection bias. This used to return
    // { value: 0.05, confidence: "high" } on the reasoning that the cap expresses
    // the constraint — sound per card, but unsound once optimizePortfolio picks the
    // best of ~53 cards on these numbers, which makes the winner a maximum-of-maxima.
    // The ceiling must stay a range so the uncertainty reaches the ranking.
    const r = normalizeRate("Up to 5%", { monthlyCap: 200 });
    expect(r).toMatchObject({
      value: null,
      unit: "percent",
      confidence: "unknown",
      range: { min: 0, max: 0.05 },
    });
    // The cap context still shapes the explanation, so the review list can tell the
    // two cases apart even though they now share a tier.
    expect(r.note).toContain("cap bounds the AED outcome");
  });

  it("emits an unbounded range for explicitly variable rates", () => {
    expect(normalizeRate("Variable")).toMatchObject({
      value: null,
      confidence: "unknown",
      range: { min: 0, max: null },
    });
    expect(normalizeRate("Customizable based on chosen category")).toMatchObject({
      value: null,
      confidence: "unknown",
      range: { min: 0, max: null },
    });
  });

  it("routes an unrecognized string to tier 3 loudly, never guessing a number", () => {
    const r = normalizeRate("some rate we've never seen");
    expect(r.value).toBeNull();
    expect(r.confidence).toBe("unknown");
    expect(r.note).toContain("Unrecognized");
  });
});

/**
 * Full-dataset sweep. Runs the real normalizer over every rate string in
 * cards.json, tallies the tiers, and prints every tier-2/3 string for human
 * review. The assertions lock in today's counts so a regression (or a new card
 * with a novel string) shows up as a failed test, not a silent reclassification.
 */
describe("normalizeRate — cards.json sweep", () => {
  interface Row {
    tier: 1 | 2 | 3;
    rate: NormalizedRate;
    where: string;
  }

  const rows: Row[] = [];
  for (const card of cardsData) {
    // Mirrors score-card.ts's buildEarnOptions exactly (caps + reward currency), so
    // the tiers counted here are the tiers the scorer actually sees.
    const base = normalizeRate(card.rewards.base_rate, { rewardCurrency: card.rewards.currency });
    rows.push({ tier: rateTier(base), rate: base, where: `${card.id} base_rate` });
    for (const cat of card.rewards.categories) {
      const r = normalizeRate(cat.rate, {
        monthlyCap: cat.monthly_cap,
        annualCap: cat.annual_cap,
        rewardCurrency: card.rewards.currency,
      });
      rows.push({ tier: rateTier(r), rate: r, where: `${card.id} ${cat.category}` });
    }
  }

  const byTier = (t: 1 | 2 | 3) => rows.filter((r) => r.tier === t);

  it("prints a tier summary and the tier-2/3 review list", () => {
    const counts = { 1: byTier(1).length, 2: byTier(2).length, 3: byTier(3).length };
    // eslint-disable-next-line no-console
    console.log(
      `\nRate normalizer sweep over ${rows.length} strings:\n` +
        `  tier 1 (clean/high):    ${counts[1]}\n` +
        `  tier 2 (verify/low):    ${counts[2]}\n` +
        `  tier 3 (unresolved):    ${counts[3]}\n` +
        `\n  --- TIER 2 (parses, condition missing) ---\n` +
        byTier(2)
          .map((r) => `  [${r.where}] "${r.rate.raw}" -> ${r.rate.note}`)
          .join("\n") +
        `\n\n  --- TIER 3 (unresolved) ---\n` +
        byTier(3)
          .map((r) => `  [${r.where}] "${r.rate.raw}" -> ${r.rate.note}`)
          .join("\n") +
        "\n",
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("matches the reviewed tier counts", () => {
    // Locked to the 2026-08 rate-ceiling-bias pass (53 cards, 197 rate strings).
    // Update deliberately if the data changes — a diff here means a rate changed tier.
    //   tier 1 (clean/high):  143
    //   tier 2 (verify/low):   29  — scoped/conditional rates that parse to a number
    //   tier 3 (unresolved):   26  — threshold/quarter lump bonuses,
    //                                "up to" ceilings, and the DIB Prime "0 Wala'a" EEA line
    //
    // 2026-08-04, two changes in sequence. Both are recorded because the net
    // (126 -> 129 tier 1) hides that they move in OPPOSITE directions:
    //
    //   126/46/21 -> 118/46/29  EXACTLY 8 strings tier 1 -> tier 3, all capped
    //     "Up to X%" ceilings (rakbank_world, rakbank_titanium et al) that the
    //     normalizer used to score AT the ceiling because a cap was modeled. That
    //     fork was removed — a ceiling is bounded 0..X capped or not. Section D5.
    //   118/46/29 -> 129/35/29  EXACTLY 11 strings tier 2 -> tier 1, all of them
    //     "N% back in <Currency>" / "back as <Currency>" forms whose only "scope"
    //     named the reward currency. Tier 3 is UNCHANGED, which is the check that
    //     this second fix touched nothing the first one did. Section D8.
    //   129/35/29 -> 139/29/29, and the string TOTAL rises 193 -> 197. Six compound
    //     "X per AED 1 local; Y per AED 1 international" base rates were split in
    //     cards.json: each base keeps its local clause (6 strings tier 2 -> tier 1)
    //     and four of them gained a real `international_spend` category (4 NEW
    //     tier-1 strings). 129 + 6 + 4 = 139, 35 - 6 = 29, tier 3 untouched — the
    //     arithmetic closing exactly is the check that nothing else moved. The other
    //     two (adcb_lulu_platinum, adcb_touchpoints_platinum) did NOT gain a
    //     category: they already carry a LOWER uk_and_eea_spend rate that a blanket
    //     international rate would shadow, since both map to `international`. D9.
    //   139/29/29 -> 143/29/26, total 197 -> 198. Six cards whose rates were
    //     recorded as unpublished prose were resolved (D10): three category-only
    //     cashback cards got an explicit conservative 0% base (3 x tier3 -> tier1);
    //     ei_cashback gained a 5% telecom category from its official page (+1 NEW
    //     tier-1 string, hence the total moving); and two ceiling-only cards had
    //     unparseable prose trimmed to a bare "Up to X per AED N" so it BOUNDS
    //     instead of failing every pattern — those stay tier 3 by design.
    //     +3 -3 for the zeros, +1 for the new category. Tier 2 untouched.
    //   143/29/26 -> 147/24/26, total 198 -> 197. Two unrelated cleanups (D11/D12):
    //     FOUR strings tier 2 -> tier 1 whose only "scope" was an ANNOTATION, not a
    //     condition — a comma or parenthesis alone was failing isBenignScope:
    //       fab_rewards_indulge base "...on all eligible spend, including
    //         international spend" (the card has no international category, so the
    //         clause restates the default),
    //       dib_shams_platinum dining AND travel "10 Wala'a per AED 1, advertised as
    //         5% back" (x2 — marketing restatement; cross-checks exactly, since
    //         valuations prices Wala'a at 0.005, so 10/AED = 5%),
    //       rakbank_air_arabia_platinum base "0.3 AirRewards per AED 1 ... (1.5
    //         points per AED 5)" (same rate restated; 1.5/5 = 0.3).
    //     Each was worth ~200 (card,profile) rejections in the gap study, i.e. the
    //     comma in the FAB string alone cost 200. Fixed in the DATA, not by loosening
    //     isBenignScope — a looser regex would move the bar rather than the facts.
    //     ONE tier-2 string REMOVED (hence 198 -> 197): adcb_talabat's
    //     "35% back; maximum AED 35 per order" was a one-time first-10-orders
    //     ACQUISITION PROMO encoded as a scored category, so it paid 35% on all
    //     dining forever. Moved to `benefits` (displayed, never scored); steady-state
    //     talabat spend now correctly earns the 1.25% base. This is the offender
    //     gap-study.test.ts names in its own header.
    //     143 + 4 = 147, 29 - 4 - 1 = 24, tier 3 UNTOUCHED at 26 — that last part is
    //     the check that this pass touched nothing the "Up to X%" ceiling work will.
    //   147/24/26 -> 162/12/26, total 197 -> 200 (D13). ELEVEN compound base rates
    //     split, the D9 technique applied to the rest of the dataset. Each packed 2-3
    //     rates into one string; the base keeps its first clause and the remaining
    //     clause becomes a real category (or was ALREADY structurally encoded, in
    //     which case the clause was pure restatement and just goes):
    //       already-encoded restatements (no new category needed) —
    //         hsbc_live_plus + enbd_lulu_247_platinum "...when the AED N monthly
    //           threshold is not met" IS `min_monthly_spend_required_aed` + the
    //           default "degrade" gate,
    //         enbd_uemaar_signature "on eligible non-Emaar spend" — the Emaar
    //           accelerators are already their own categories, so "non-Emaar" is
    //           just the base,
    //         mashreq_noon "at non-partner merchants" — likewise, noon partners are
    //           already a category,
    //         sc_simply_cash "domestic airline transactions earn standard category
    //           rates" — i.e. the base,
    //         enbd_dnata_world's base cap clause (see that card's data_caveat: the
    //           schema caps categories, not base_rate; immaterial below AED 200k/mo).
    //       genuinely new categories (+4 tier-1 strings) —
    //         fab_cashback `specified_low_interchange_categories` 0.15%,
    //         adcb_traveller `international_spend` 1.5%,
    //         mashreq_cashback `international_spend` 1%,
    //         ei_switch_cashback `government_utilities_charity` 0.5%.
    //     adcb_365_cashback is the DELIBERATE non-split: it pays 1% on non-EU but
    //     0.5% on EU international, and both map to canonical `international`, so a
    //     blanket 1% would SHADOW the 0.5% and overstate. Left at 0.5% — understating
    //     non-EU is the safe direction. See its data_caveat.
    //     ONE tier-2 string REMOVED (hence -1): fab_etihad_guest_infinite's
    //     `optional_miles_accelerator`, a PAID AED 250/month opt-in scored as a free
    //     category — 7.5 miles/AED 10 on all spend with its AED 3,000/yr cost
    //     invisible to the fee model. Same defect class as the talabat promo above.
    //     147 + 11 + 4 = 162, 24 - 11 - 1 = 12, 197 - 1 + 4 = 200, tier 3 UNTOUCHED.
    //   162/12/26 -> 175/12/19, total 200 -> 206 (D14). SEVEN "Up to X" ceilings
    //     became CERTAIN rates — but ONLY because the official pages were refetched
    //     and turned out to publish the reduced-rate grid that the "up to" was hiding.
    //     This is NOT a reversal of D5 (which stopped scoring ceilings AT the ceiling):
    //     there the variance was unexplained and assumed away; here it is enumerated
    //     and ENCODED, which is the only thing that licenses a certain rate.
    //     Four banks, all previously recorded as "does not expose ... in accessible
    //     text" — every one of those notes was STALE:
    //       ei_skywards_infinite   base+2 ceilings -> certain, +3 reduced categories
    //         (grocery 0.5, fuel 0.25, government/education 0.15 miles per USD 1),
    //       dib_skywards_infinite  base+1 ceiling  -> certain, +1 reduced category
    //         (the 0.3 bucket maps EXACTLY onto an existing compound key),
    //       fab_etihad_guest_signature base ceiling -> certain, +2 categories. Its
    //         "Up to 6.5" was the PAID accelerator rate used as the headline, the
    //         same defect removed from the Infinite card in D13,
    //       sc_simply_cash         1 ceiling -> flat 2%, published as flat.
    //     Two deliberate UNDERSTATEMENTS, both the EEA/non-EEA collapse: DIB pays 1.5
    //     miles general foreign but 0.75 in the EEA, and EI's telecom earns 0.25 while
    //     government/education earn 0.15 — each pair collapses into one canonical
    //     category, so the LOWER rate is encoded. Rule: when two official rates map to
    //     one canonical category, take the lower. See both cards' data_caveats.
    //     162 + 13 = 175, tier 2 UNTOUCHED at 12, 26 - 7 = 19, 200 + 6 new = 206.
    //   175/12/19 -> 188/12/8, total 206 -> 208 (D15). Issuer schedules supplied
    //     directly for the pages that could not be fetched. Tier 2 UNTOUCHED again.
    //     +1 string, +1 tier 1 — CITI UNIT CORRECTION, the big one. All three Citi
    //       cards recorded ThankYou Points "per AED 1"; they are earned PER USD, so
    //       every Citi card was overstated by the FX rate (~3.67x). This RESOLVES the
    //       D2 contradiction: 2 pts/AED x 0.0333 implied a 6.7% domestic return that
    //       no UAE card pays, but 2 pts/USD is ~1.8%. Neither the earn nor the rebate
    //       was wrong — the UNIT was, exactly as this changelog suspected in its
    //       Citibank table but never applied. citi_premier also gained a
    //       `supermarkets_fuel_dining` 3 pts/USD accelerator that was absent entirely
    //       (the +1 string), and citi_rewards' `grocery_and_non_aed_spend` bucket was
    //       split because the 1.5 rate applies to non-AED ONLY, not groceries.
    //     -10 tier 3, +12 tier 1, +2 strings — RAKBANK titanium and world, whose
    //       "up to" ceilings ALL became certain. Both base rates were also corrected
    //       DOWNWARD (2%->1%, 3%->1%): the advertised ceiling was the E-WALLET rate,
    //       not standard retail. Each card gained the 0.25% low-earn bucket that was
    //       missing entirely, so government/education/fuel/transport spend had been
    //       earning the base rate — a 4x overstatement. titanium's overall_cap was
    //       null and is now the stated 600; world's was 1100 and is now 1250.
    //     -1 tier 3, -1 string — dib_prime_infinite's `eu_spend` "0 Wala'a Rewards"
    //       category removed. It DUPLICATED a fact already encoded correctly in
    //       `excluded_spend`, which zeroes all canonical `international` (broader than
    //       EEA, hence conservative). Scoring is unchanged; a tier-3 string is gone.
    //     175 + 1 + 12 = 188, 19 - 10 - 1 = 8, 206 + 1 + 2 - 1 = 208.
    //   188/12/8 -> 189/12/8, total 208 -> 209 (D16). RAKBANK's own product pages
    //     supplied, resolving the DO-NOT-PUBLISH hold on titanium and world. The
    //     tier movement is deliberately TINY because the pages CONFIRMED the encoded
    //     rates rather than changing them — the value of this pass is the hold being
    //     lifted, not a re-rating. What the checksum sees:
    //       +1 tier-1 string: rakbank_titanium gained `all_other_spend` 1% capped
    //         AED 100/mo. Its non-e-wallet retail rate IS capped, and the schema can
    //         only cap a CATEGORY, never `base_rate` — so an uncapped virtual base
    //         was being synthesised for every non-bonus category. Encoding the
    //         catch-all explicitly suppresses that virtual base and applies the cap.
    //       +0 net: rakbank_world's `other_retail` 1%/100 became `all_other_spend`
    //         1%/100. Same string, same tier; `other_retail` reached only canonical
    //         `other`, so travel-adjacent and all remaining spend still escaped to
    //         the uncapped virtual base. Renaming it to the catch-all is what makes
    //         the AED 100 cap actually bind on everything it should.
    //     CORROBORATION worth recording, because it is why the hold could be lifted
    //     on a marketing page: the per-category caps stated there SUM EXACTLY to the
    //     overall_cap taken from the separately-supplied 1 Sep 2024 schedule —
    //     100x6 = 600 (titanium), 400+300+300+150+100 = 1250 (world). Two sources
    //     neither of which derives from the other, agreeing to the dirham.
    //     188 + 1 = 189, tier 2 and tier 3 BOTH UNTOUCHED — that is the check that a
    //     pass which lifted a publication hold did not quietly re-tier anything.
    //   189/12/8 -> 196/11/6, total 209 -> 213 (D17). Issuer pages supplied for
    //     five cards. +4 strings, +7 tier 1, -1 tier 2, -2 tier 3:
    //       enbd_lulu_247_platinum +3 strings, all tier 1. Its reduced grid was
    //         missing entirely: car dealers/grocery/supermarkets/insurance/fast
    //         food at 25% of base (0.175%), education/government/real estate at
    //         10% (0.07%), EU retail at 25% (0.175%). Same pass split LuLu Points
    //         into two currencies — see valuations.ts; ADCB and ENBD run the same
    //         brand on scales 100x apart and were sharing one placeholder.
    //       ei_amazon_world +1 string, -2 tier 3, +3 tier 1. The full Prime /
    //         non-Prime grid was published, so the recorded resolution was applied:
    //         encode the NON-PRIME column and understate Prime members. That
    //         retires both "Up to X%" ceilings — the D14 condition, since the
    //         0.25% named-category row is exactly the reduction the "up to" hid.
    //         The base also lost a restating "non-Amazon" scope (D13's uemaar
    //         precedent), which is the -1 tier 2 alongside hsbc below.
    //       hsbc_max_rewards tier 2 -> tier 1, no string change. Its base packed a
    //         spend-TIERED rate ("1 point per AED 1; 2 points when monthly spend
    //         exceeds AED 3,000") that the engine cannot express; per D14 the
    //         LOWER tier is encoded and holders over the threshold are understated.
    //     NO tier movement, but the largest correction in the pass: sc_journey's
    //       rates were recorded PER AED and the issuer states PER USD, so the card
    //       was overstated by the FX rate (~3.6725x). Identical to the Citi unit
    //       error in D15a, at a different bank — which is why sc_smart_saadiq, on
    //       the same programme with no earn table supplied, is now flagged suspect
    //       rather than trusted. A unit error is invisible to this checksum: the
    //       string stays tier 1 either way. Two guards that DO catch it are the
    //       implausibility check in scoreCard and a human reading the rate.
    //     189 + 7 = 196, 12 - 1 = 11, 8 - 2 = 6, 209 + 4 = 213.
    //   The remaining SIX tier-3 strings are all genuinely unresolvable, not
    //   unresearched: 3 lump bonuses (no schema slot), cbd_visa_platinum + cbd_one
    //   (the BLOCKED spend-tiered class), and ei_cashback (the issuer itself
    //   publishes only "up to 1%"). Further reduction needs schema or engine work,
    //   not data — the spend-tier class is the one worth building, and it would
    //   also clear the 11 remaining tier-2 strings, 10 of which are tiered rates.
    expect(byTier(1).length).toBe(196);
    expect(byTier(2).length).toBe(11);
    expect(byTier(3).length).toBe(6);
  });

  it("never assigns a numeric value to a tier-3 rate", () => {
    for (const r of byTier(3)) {
      expect(r.rate.value).toBeNull();
    }
  });
});
