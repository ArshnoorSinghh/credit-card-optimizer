/**
 * REGRESSION: the study's filters must never silently match NOTHING, and the
 * publishable headline must never silently drift into implausibility.
 *
 * WHY THIS FILE EXISTS
 * Every serious defect this project has found survived because a guard was alive in
 * intent and dead in fact, with nothing asserting the difference:
 *
 *   - The SOUND filter's merchant clause tested for the contiguous substring
 *     "assumes spend occurs". The engine emits `<cat>: assumes <a>/<b> spend occurs
 *     at <merchant>` — the category list splits the phrase, so the clause matched
 *     nothing for its entire life. Every merchant-accelerator card passed as SOUND,
 *     which is how `emaar_malls` (6.25%, canonical `other`) credited a user's whole
 *     `other` spend as Emaar-mall spend.
 *   - An earlier revision guessed the tier-3 wording as "Unknown rate"; the engine
 *     says "Unresolved rate on". That clause matched nothing either.
 *   - The plausibility bar ("a UAE card returning >8% of spend does not exist") was
 *     printed to the console with an arrow next to it. A human had to notice.
 *
 * A filter that matches nothing looks exactly like a filter with nothing to reject,
 * and both of these bugs INFLATED the headline. So: every clause is asserted live
 * against the real card data, and the plausibility bar is an assertion.
 *
 * This file is NOT gated behind GAP_STUDY. The study is a measurement and runs on
 * demand; these are the guards on the measurement and must run in CI.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { optimizePortfolio } from "./optimize-portfolio";
import { scoreCard, type SpendingProfile } from "./score-card";
import {
  IMPLAUSIBLE_RETURN_PCT,
  RATE_DEFECT_CLAUSES,
  hasDoNotPublishCaveat,
  isRateDefect,
  isSoundScore,
  rateDefectsIn,
} from "./study-filters";

const realCards = cardsData as Card[];

/*
  The five segment archetypes' CENTRE points — gap-study.test.ts draws jittered
  profiles around these. Fixed (no PRNG) so this file is a regression test rather
  than a second measurement, and small enough to run in CI: five optimizePortfolio
  calls at ~0.2-1.2s each.
*/
const SEGMENT_CENTRES: { name: string; salary: number; spend: SpendingProfile }[] = [
  {
    name: "Early-career expat",
    salary: 11500,
    spend: { groceries: 900, dining: 700, fuel: 400, utilities: 350, education: 0,
      travel: 200, transport: 250, entertainment: 250, international: 150, other: 500 },
  },
  {
    name: "Family w/ school fees",
    salary: 37500,
    spend: { groceries: 3000, dining: 1500, fuel: 900, utilities: 900, education: 4000,
      travel: 1200, transport: 400, entertainment: 600, international: 700, other: 1500 },
  },
  {
    name: "Frequent traveller",
    salary: 65000,
    spend: { groceries: 2000, dining: 3000, fuel: 800, utilities: 700, education: 0,
      travel: 5000, transport: 600, entertainment: 1200, international: 4000, other: 2500 },
  },
  {
    name: "Young single, dining-led",
    salary: 18500,
    spend: { groceries: 1000, dining: 2000, fuel: 400, utilities: 400, education: 0,
      travel: 800, transport: 500, entertainment: 1200, international: 600, other: 800 },
  },
  {
    name: "Dual-income, balanced",
    salary: 30000,
    spend: { groceries: 2200, dining: 1800, fuel: 700, utilities: 700, education: 0,
      travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400 },
  },
];

const annual = (s: SpendingProfile) => Object.values(s).reduce((a, b) => a + (b ?? 0), 0) * 12;

function eligibleFor(salary: number): Card[] {
  return realCards.filter(
    (c) => !c.excluded_from_scoring && (c.eligibility.min_monthly_salary_aed ?? 0) <= salary,
  );
}

// ===========================================================================
// 1. LIVENESS — every clause must still match something real.
// ===========================================================================

describe("filter liveness — no clause may match zero rows", () => {
  /*
    Scored WITHOUT merchant shares on purpose. The merchant clause is supposed to
    fire on the unverified full-category assumption; supplying a share is exactly
    what makes it stop firing, so testing liveness with shares would test nothing.
  */
  const allFlagMessages = SEGMENT_CENTRES.flatMap((seg) =>
    eligibleFor(seg.salary).flatMap((c) => scoreCard(seg.spend, c).flags.map((f) => f.message)),
  );

  it("produces flags at all (the corpus this file reasons over is non-empty)", () => {
    expect(allFlagMessages.length).toBeGreaterThan(100);
  });

  it.each(RATE_DEFECT_CLAUSES.map((c) => [c.name, c] as const))(
    "clause %s matches at least one real flag",
    (_name, clause) => {
      const hits = allFlagMessages.filter((m) => clause.test(m));
      expect(
        hits.length,
        `Clause "${clause.name}" matched NOTHING across ${allFlagMessages.length} real flag ` +
          `messages. Either the engine reworded its message (fix the clause) or the data ` +
          `genuinely no longer has this defect (delete the clause and say so). Do not ` +
          `leave it: a dead clause silently widens the publishable universe. Reason it ` +
          `exists: ${clause.why}`,
      ).toBeGreaterThan(0);
    },
  );

  it("the do-not-publish caveat still matches at least one card", () => {
    // GOTCHA this guards: the check is a substring match, so a caveat that SAYS the
    // block was lifted keeps the card excluded. If this hits zero, either every
    // caveat was genuinely cleared or someone reworded the marker.
    expect(realCards.filter(hasDoNotPublishCaveat).length).toBeGreaterThan(0);
  });

  it("rejects a real number of cards — the filter is a filter, not a no-op", () => {
    const seg = SEGMENT_CENTRES[4]!; // dual-income, the mid-range profile
    const eligible = eligibleFor(seg.salary);
    const sound = eligible.filter((c) => isSoundScore(scoreCard(seg.spend, c).flags));
    expect(sound.length).toBeGreaterThan(0); // not everything is rejected
    expect(sound.length).toBeLessThan(eligible.length); // and not nothing is
  });

  it("attributes each rejection to a named clause", () => {
    const seg = SEGMENT_CENTRES[4]!;
    for (const card of eligibleFor(seg.salary)) {
      const flags = scoreCard(seg.spend, card).flags;
      // The two views of the filter must agree: a card is unsound iff some named
      // clause claims it. If they diverge, one of them is reading a stale message.
      expect(rateDefectsIn(flags).size > 0).toBe(!isSoundScore(flags));
    }
  });

  it("isRateDefect and the clause list are the same predicate", () => {
    const messages = allFlagMessages.slice(0, 500);
    for (const m of messages) {
      expect(isRateDefect(m)).toBe(RATE_DEFECT_CLAUSES.some((c) => c.test(m)));
    }
  });
});

// ===========================================================================
// 2. PLAUSIBILITY — the bar the study prints, asserted.
// ===========================================================================

/**
 * The publishable universe for one profile, under one set of merchant shares.
 * Mirrors gap-study.test.ts: sound rates, minus cards whose data_caveat forbids
 * publication.
 */
function publishableUniverse(
  spend: SpendingProfile,
  salary: number,
  shares?: Record<string, number>,
): Card[] {
  return eligibleFor(salary)
    .filter((c) => isSoundScore(scoreCard(spend, c, undefined, { merchantShares: shares }).flags))
    .filter((c) => !hasDoNotPublishCaveat(c));
}

/*
  optimizePortfolio is ~0.2-3s per call (the min-spend gate enumeration made it
  ~1.6x slower), and several assertions below want the same five answers. Memoized
  so the file stays a few seconds rather than a few minutes.
*/
const returnPctCache = new Map<string, number | null>();

/** Optimal net annual value as a % of annual spend, on the publishable universe. */
function publishableReturnPct(
  spend: SpendingProfile,
  salary: number,
  shares?: Record<string, number>,
): number | null {
  const key = `${salary}|${JSON.stringify(spend)}|${JSON.stringify(shares ?? null)}`;
  const hit = returnPctCache.get(key);
  if (hit !== undefined) return hit;
  const value = computeReturnPct(spend, salary, shares);
  returnPctCache.set(key, value);
  return value;
}

function computeReturnPct(
  spend: SpendingProfile,
  salary: number,
  shares?: Record<string, number>,
): number | null {
  const universe = publishableUniverse(spend, salary, shares);
  if (universe.length === 0) return null;
  const r = optimizePortfolio(
    spend,
    { monthlySalaryAed: salary, uaeResident: true },
    universe,
    undefined,
    // The study defines its own universe; the engine must not re-filter it, or
    // `optimal` and the singles would measure different card sets.
    { includeUnpublishable: true, merchantShares: shares },
  );
  if (!r.overallBest) return null;
  return (r.overallBest.netAnnualValue / annual(spend)) * 100;
}

/*
  Modelled shares, kept deliberately close to gap-study.test.ts's MERCHANT_SHARES.
  They do not have to match to the decimal — this is a ceiling test, not a
  reproduction of the study — but they must be in the same range, or this asserts a
  bar the study never runs against.
*/
const SHARES: Record<string, number> = {
  LuLu: 0.2, elGrocer: 0.03, Emaar: 0.12, noon: 0.1, Amazon: 0.12,
  "Dubai Duty Free": 0.03, "Smiles partners": 0.05, Emirates: 0.3, Etihad: 0.12,
  "Air Arabia": 0.08, "Booking.com": 0.15, dnata: 0.1, Marriott: 0.08,
  "Emirates Leisure": 0.03, RTA: 0.35, Talabat: 0.2,
};

describe("plausibility — the publishable headline must stay inside the stated bar", () => {
  /*
    OBSERVED 2026-08-09, at the commit that introduced merchant shares. A CHECKSUM in
    the same spirit as the tier counts in normalize-rate.test.ts: not a target, a
    tripwire. If one moves, something changed in the data or the model and the
    headline needs re-deriving before it is quoted. Update these ONLY together with a
    note saying what moved and why.

      segment                   universe (no-share -> shares)   optimal % of spend
      Early-career expat              15 -> 18                        6.74
      Family w/ school fees           30 -> 44                        5.13
      Frequent traveller              30 -> 44                        5.90
      Young single, dining-led        23 -> 32                        6.30
      Dual-income, balanced           30 -> 44                        5.58
                                                            median    5.90

    THE FINDING WORTH KEEPING: supplying shares grew the publishable universe by up
    to 47% and changed the recommended portfolio in ZERO of the five segments — the
    optimum was identical, to the dirham, with and without. The co-brand cards'
    apparent edge was the 100%-of-category assumption, not the cards. So this work
    does not raise the headline; it removes an exclusion and makes the answer
    honest. Do not let anyone quote the universe growth as a value increase.
  */
  const CEILING_PCT = IMPLAUSIBLE_RETURN_PCT; // 8% — "does not exist" in this market

  it.each(SEGMENT_CENTRES.map((s) => [s.name, s] as const))(
    "%s: publishable optimum stays under the impossibility bar, with shares",
    (_name, seg) => {
      const pct = publishableReturnPct(seg.spend, seg.salary, SHARES);
      expect(pct).not.toBeNull();
      expect(
        pct!,
        `${seg.name} publishable optimum is ${pct!.toFixed(2)}% of spend. The study's own ` +
          `stated bar is that a UAE card returning >${CEILING_PCT}% does not exist, so this ` +
          `is a DATA defect (a bad earn rate, a bad valuation, or a unit error), not a ` +
          `product result. Do not raise this ceiling to make the test pass.`,
      ).toBeLessThan(CEILING_PCT);
    },
    30_000,
  );

  it("the median across segments stays under the tripwire", () => {
    /*
      Tighter than the impossibility bar and set just above the observed spread. The
      8% bar catches a catastrophe (the sc_journey unit error was a 3.67x); this
      catches a drift. Observed median 5.90%, observed max segment 6.74% — see the
      table above. 7.0 leaves room for ordinary data movement and none for a
      doubling.
    */
    const TRIPWIRE_PCT = 7.0;
    const pcts = SEGMENT_CENTRES.map((s) => publishableReturnPct(s.spend, s.salary, SHARES))
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);
    expect(pcts.length).toBe(SEGMENT_CENTRES.length);
    const median = pcts[Math.floor((pcts.length - 1) / 2)]!;
    expect(
      median,
      `Median publishable return across the five segment centres is ${median.toFixed(2)}%. ` +
        `That is above the ${TRIPWIRE_PCT}% tripwire. Something moved — re-derive the ` +
        `headline before quoting it, and only then adjust this number with a note.`,
    ).toBeLessThan(TRIPWIRE_PCT);
  }, 60_000);

  it("no single publishable card claims an impossible return on its own", () => {
    // The portfolio ceiling above can hide one broken card behind a sane optimum.
    // This is the per-card version, and it is how a unit error (per-USD recorded as
    // per-AED, twice now) shows up: one card, one implausible number.
    for (const seg of SEGMENT_CENTRES) {
      const spendYr = annual(seg.spend);
      for (const card of publishableUniverse(seg.spend, seg.salary, SHARES)) {
        const s = scoreCard(seg.spend, card, undefined, { merchantShares: SHARES });
        const pct = (s.netAnnualValue / spendYr) * 100;
        expect(
          pct,
          `${card.id} returns ${pct.toFixed(2)}% of spend on ${seg.name} and is in the ` +
            `PUBLISHABLE universe. Check its earn rate and its currency valuation — ` +
            `especially whether the rate is quoted per USD and recorded per AED.`,
        ).toBeLessThan(CEILING_PCT);
      }
    }
  });
});

// ===========================================================================
// 3. LOCKSTEP — the study and its diagnostic share one definition.
// ===========================================================================

describe("lockstep — the universe predicates have exactly one definition", () => {
  it("supplying a merchant share moves cards INTO the sound universe", () => {
    /*
      The mechanism the merchant-share work rests on, asserted end to end: a stated
      share replaces the "spend occurs at" flag, which is what the SOUND filter
      rejects on. If this stops holding, answering the question stops paying for
      itself and the co-brand cards silently fall back out of the universe.
    */
    const seg = SEGMENT_CENTRES[4]!;
    const without = publishableUniverse(seg.spend, seg.salary).length;
    const withShares = publishableUniverse(seg.spend, seg.salary, SHARES).length;
    expect(withShares).toBeGreaterThan(without);
  });

  it("a share of zero still admits the card — it just earns nothing extra", () => {
    // "I never shop there" is an ANSWER. The card should be scored honestly (at its
    // base rate) rather than held back for an unverified assumption nobody made.
    const seg = SEGMENT_CENTRES[4]!;
    const zeroed = Object.fromEntries(Object.keys(SHARES).map((m) => [m, 0]));
    expect(publishableUniverse(seg.spend, seg.salary, zeroed).length).toBeGreaterThan(
      publishableUniverse(seg.spend, seg.salary).length,
    );
  });
});
