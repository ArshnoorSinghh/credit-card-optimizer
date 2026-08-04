/**
 * GAP STUDY — how much AED does a UAE cardholder leave on the table?
 *
 * Not a unit test. A reproducible measurement, run through vitest because vitest
 * is the only TS runner wired into this package. Run it with:
 *
 *   npx vitest run src/gap-study.test.ts --disable-console-intercept
 *
 * WHAT IT MEASURES
 * Three wallets scored against the same synthetic spending profile:
 *
 *   naive    — MEDIAN-value eligible single card. Proxy for "the card your salary
 *              bank put in front of you". Not the worst card; the middle one.
 *   diligent — BEST eligible single card. Proxy for someone who read a comparison
 *              site and picked well, but holds one card.
 *   optimal  — engine's overallBest (1–3 cards, exact min-cost max-flow).
 *
 * TWO UNIVERSES — this is the point of the study
 *   ALL    — every scoreable card. Produces implausible returns (13%+ of spend)
 *            because cards.json carries ACQUISITION PROMOS and PERKS as if they
 *            were steady-state earn rates. Known offenders: adcb_talabat's "first
 *            10 orders 35% back" applied to all dining forever; rakbank_titanium's
 *            cinema perk earning AED 1,500/yr on AED 3,000 of spend.
 *   CLEAN  — only cards whose score for THIS profile carries no low/unknown flags:
 *            no unresearched valuation, no merchant assumption, no range rate.
 *            This is the only universe a public claim can be made from.
 *
 * The difference between them is a data-quality measurement, not a product metric.
 *
 * HONESTY BOUNDARY (read before quoting any number from this)
 * These are MODELED profiles, not observed spend. The output is the spread of the
 * engine's own answers across a plausible population — evidence that the
 * optimization problem is worth solving, NOT evidence that any real user gained
 * AED X. Label it "modeled" anywhere it is shown externally.
 *
 * Profiles are drawn from five UAE segment archetypes with a seeded PRNG, so the
 * numbers reproduce exactly across runs.
 */

import { describe, it, expect } from "vitest";
import { CARDS } from "./index";
import { optimizePortfolio } from "./optimize-portfolio";
import { scoreCard, type SpendingProfile } from "./score-card";
import type { Card } from "./card";

// The engine tsconfig has no DOM/Node libs (types: []). Declare just the surface
// these measurements use, matching the pattern in normalize-rate.test.ts.
declare const console: { log(...args: unknown[]): void };
declare const process: { env: Record<string, string | undefined> };

// ── Seeded PRNG so the study is reproducible ───────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260804);
const jitter = () => 0.6 + rand() * 1.0;

interface Segment {
  name: string;
  salary: [number, number];
  spend: SpendingProfile;
  /*
    Share of the UAE credit-card-holding population this archetype represents.
    An EQUAL number of profiles per segment is NOT a population — it puts 40% of
    the sample in the two highest-spending archetypes and drags every pooled
    median upward by spend level rather than by optimizer skill. The first
    version of this file had these weights and lost them in a rewrite; the
    pooled median read ~60% high as a result.

    These are a judgement about the shape of the market (a pyramid: many
    early-career expats, few frequent travellers), not survey data. They are the
    single biggest assumption in the study — change them and every pooled number
    moves. Per-segment figures below are weight-independent; prefer those.
  */
  weight: number;
}

/*
  Segment archetypes. Spend levels are the assumption layer of this study —
  plausible UAE monthly card spend by household type, not survey data. The
  UAE-specific one that matters is `education`: school fees are large and often
  paid by card here, which is why several cards cap or exclude them.
*/
const SEGMENTS: Segment[] = [
  {
    name: "Early-career expat",
    weight: 0.40,
    salary: [8000, 15000],
    spend: { groceries: 900, dining: 700, fuel: 400, utilities: 350, education: 0,
      travel: 200, transport: 250, entertainment: 250, international: 150, other: 500 },
  },
  {
    name: "Family w/ school fees",
    weight: 0.13,
    salary: [25000, 50000],
    spend: { groceries: 3000, dining: 1500, fuel: 900, utilities: 900, education: 4000,
      travel: 1200, transport: 400, entertainment: 600, international: 700, other: 1500 },
  },
  {
    name: "Frequent traveller",
    weight: 0.07,
    salary: [40000, 90000],
    spend: { groceries: 2000, dining: 3000, fuel: 800, utilities: 700, education: 0,
      travel: 5000, transport: 600, entertainment: 1200, international: 4000, other: 2500 },
  },
  {
    name: "Young single, dining-led",
    weight: 0.20,
    salary: [12000, 25000],
    spend: { groceries: 1000, dining: 2000, fuel: 400, utilities: 400, education: 0,
      travel: 800, transport: 500, entertainment: 1200, international: 600, other: 800 },
  },
  {
    name: "Dual-income, balanced",
    weight: 0.20,
    salary: [20000, 40000],
    spend: { groceries: 2200, dining: 1800, fuel: 700, utilities: 700, education: 0,
      travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400 },
  },
];

const TOTAL_PROFILES = 200;
/** Profiles drawn per segment, proportional to its population weight (min 10). */
const nFor = (seg: Segment) => Math.max(10, Math.round(TOTAL_PROFILES * seg.weight));

function drawProfile(seg: Segment): { spending: SpendingProfile; salary: number } {
  const spending = {} as SpendingProfile;
  for (const [cat, base] of Object.entries(seg.spend)) {
    (spending as Record<string, number>)[cat] = Math.round((base as number) * jitter());
  }
  const salary = Math.round(seg.salary[0] + rand() * (seg.salary[1] - seg.salary[0]));
  return { spending, salary };
}

function isEligible(card: Card, salary: number): boolean {
  if (card.excluded_from_scoring) return false;
  const e = card.eligibility;
  if (e.min_monthly_salary_aed != null && salary < e.min_monthly_salary_aed) return false;
  return true;
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  // Non-null: lo/hi are clamped to valid indices and length was checked above.
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}
const aed = (n: number) => Math.round(n).toLocaleString("en-US");

interface Row {
  segment: string;
  annualSpend: number;
  naive: number;
  optimal: number;
  diligent: number;
  size: number;
  returnPct: number;
  universeSize: number;
}

// Gated: this takes ~2 minutes and is a measurement, not a regression test, so it
// stays out of `pnpm test`. Run it deliberately:
//   GAP_STUDY=1 npx vitest run src/gap-study.test.ts --disable-console-intercept
describe.skipIf(!process.env.GAP_STUDY)("gap study", () => {
  it("measures optimal-vs-baseline on ALL vs CLEAN card data", () => {
    const all: Row[] = [];
    const clean: Row[] = [];
    const sound: Row[] = [];
    const pub: Row[] = [];
    const floorRows: Row[] = [];
    let profilesSeen = 0;
    let cleanUniverseTotal = 0;
    let soundUniverseTotal = 0;
    let pubUniverseTotal = 0;
    let eligibleUniverseTotal = 0;

    for (const seg of SEGMENTS) {
      for (let i = 0; i < nFor(seg); i++) {
        const { spending, salary } = drawProfile(seg);
        const annualSpend = Object.values(spending).reduce((a: number, b: number) => a + b, 0) * 12;
        const eligible = CARDS.filter((c) => isEligible(c, salary));
        if (eligible.length === 0) continue;
        profilesSeen++;
        eligibleUniverseTotal += eligible.length;

        // A card is CLEAN for this profile if its own score carries no soft signal:
        // no low/unknown flag, no range, no merchant assumption.
        const cleanCards = eligible.filter((c) => {
          const s = scoreCard(spending, c);
          return s.flags.length === 0 && !s.uncertain;
        });
        cleanUniverseTotal += cleanCards.length;

        /*
          SOUND universe — the one a public claim can actually be made from.

          Distinguishes two very different flag classes that the strict filter
          above lumps together:
            REJECT: rate defects. A "low-confidence rate" is usually a promo
                    string ("first 10 orders, 35% back") the normalizer could not
                    resolve to a steady-state rate; a merchant assumption means
                    the rate only holds at one retailer. Both INFLATE.
            ALLOW:  valuation softness (a points currency not yet researched) and
                    cap notices. These move the number a few percent either way;
                    they do not manufacture a 35% return.
        */
        const soundCards = eligible.filter((c) => {
          const s = scoreCard(spending, c);
          return !s.flags.some(
            (f) =>
              f.message.includes("assumes spend occurs") ||
              f.message.startsWith("Low-confidence rate") ||
              // The engine's tier-3 wording. An earlier revision of this filter
              // guessed "Unknown rate" and therefore matched nothing.
              f.message.startsWith("Unresolved rate on"),
          );
        });
        soundUniverseTotal += soundCards.length;

        /*
          `lower` selects the PESSIMISTIC end of every uncertainty range instead of
          the midpoint. That is what makes the FULL-MARKET universe usable: rather
          than discarding a card because one of its rate strings is a 0..X ceiling,
          we keep the card and credit it with the bottom of its own band. Dropping
          82% of the market to get a "clean" subset answers a question nobody asked
          ("what if only these 7 cards existed"); this answers the real one ("what
          is the least this user could gain, given everything we do not know").

          Caveat: optimizePortfolio still RANKS by midpoint, so the portfolio picked
          is not necessarily the one maximising the lower bound. The figure is still
          a valid floor for the portfolio actually recommended, which is what a user
          would hold — but it is a floor on the RECOMMENDATION, not the tightest
          possible floor.
        */
        const build = (universe: Card[], into: Row[], lower = false) => {
          if (universe.length === 0) return;
          const val = (n: { netAnnualValue: number; netAnnualValueRange: { min: number } }) =>
            lower ? n.netAnnualValueRange.min : n.netAnnualValue;
          const singles = universe.map((c) => val(scoreCard(spending, c))).sort((a, b) => a - b);
          const r = optimizePortfolio(spending, { monthlySalaryAed: salary, uaeResident: true }, universe);
          const best = r.overallBest;
          if (!best) return;
          into.push({
            segment: seg.name,
            annualSpend,
            naive: pct(singles, 0.5),
            diligent: singles[singles.length - 1]!,
            optimal: val(best),
            size: best.size,
            returnPct: (val(best) / annualSpend) * 100,
          universeSize: universe.length,
          });
        };

        /*
          PUBLISHABLE — sound rates, MINUS any card whose data_caveat explicitly
          says its figure cannot be published. That caveat is an editorial
          decision recorded in the data, so the study honours it rather than
          re-deriving it.
        */
        const pubCards = soundCards.filter(
          (c) => !(c.data_caveat ?? "").toLowerCase().includes("do not publish"),
        );
        pubUniverseTotal += pubCards.length;

        build(eligible, all);
        build(eligible, floorRows, true);
        build(soundCards, sound);
        build(pubCards, pub);
        build(cleanCards, clean);
      }
    }

    const out: string[] = [];
    const P = (s: string) => out.push(s);

    const med = (rows: Row[], f: (r: Row) => number) =>
      pct(rows.map(f).sort((a, b) => a - b), 0.5);

    const report = (label: string, rows: Row[]) => {
      if (!rows.length) { P(`\n${label}: no rows`); return; }
      const gapNaive = rows.map((r) => r.optimal - r.naive).sort((a, b) => a - b);
      const gapDil = rows.map((r) => r.optimal - r.diligent).sort((a, b) => a - b);
      const ret = rows.map((r) => r.returnPct).sort((a, b) => a - b);
      P("");
      P(`── ${label} ─────────────────────────────────────────────`);
      P(`   profiles ${rows.length} · median universe ${Math.round(
        rows.reduce((a, r) => a + r.universeSize, 0) / rows.length)} cards` +
        ` · median annual spend AED ${aed(med(rows, (r) => r.annualSpend))}`);
      P(`   GAP vs naive single card:  p25 ${aed(pct(gapNaive, 0.25))}  ` +
        `MEDIAN ${aed(pct(gapNaive, 0.5))}  p75 ${aed(pct(gapNaive, 0.75))}  p90 ${aed(pct(gapNaive, 0.9))}`);
      P(`   GAP vs BEST single card:   p25 ${aed(pct(gapDil, 0.25))}  ` +
        `MEDIAN ${aed(pct(gapDil, 0.5))}  p75 ${aed(pct(gapDil, 0.75))}`);
      P(`   optimal as % of spend:     p25 ${pct(ret, 0.25).toFixed(2)}%  ` +
        `MEDIAN ${pct(ret, 0.5).toFixed(2)}%  p90 ${pct(ret, 0.9).toFixed(2)}%   <-- plausibility check`);
      const multi = rows.filter((r) => r.size > 1).length;
      P(`   multi-card optimum:        ${((multi / rows.length) * 100).toFixed(1)}%`);
      const b199 = gapNaive.filter((g) => g >= 199).length;
      P(`   gap >= AED 199 (1x price): ${((b199 / rows.length) * 100).toFixed(1)}%`);
      P("");
      P("   PER SEGMENT — weight-independent, prefer these over any pooled number.");
      P("   Every row is cross-checkable: naive% + gap% should equal optimal%.");
      P("   segment                  wt   ann.spend    naive%  best1%  optimal%   gap%   gap AED");
      for (const seg of SEGMENTS) {
        const sub = rows.filter((r) => r.segment === seg.name);
        if (!sub.length) continue;
        const spend = med(sub, (r) => r.annualSpend);
        const nPct = med(sub, (r) => (r.naive / r.annualSpend) * 100);
        const dPct = med(sub, (r) => (r.diligent / r.annualSpend) * 100);
        const oPct = med(sub, (r) => r.returnPct);
        const gPct = med(sub, (r) => ((r.optimal - r.naive) / r.annualSpend) * 100);
        const gAed = med(sub, (r) => r.optimal - r.naive);
        P(
          `   ${seg.name.padEnd(24)} ${seg.weight.toFixed(2)} ${aed(spend).padStart(10)}   ` +
            `${nPct.toFixed(2).padStart(6)}  ${dPct.toFixed(2).padStart(6)}  ` +
            `${oPct.toFixed(2).padStart(7)}  ${gPct.toFixed(2).padStart(6)}  ${aed(gAed).padStart(8)}`,
        );
      }
      /*
        Population-weighted headline. The pooled median above is the median of the
        SAMPLE, which is only a population if the per-segment draw counts match the
        weights exactly — rounding means they don't. This recomputes the headline as
        a weight-blend of per-segment medians, which is what a "typical UAE
        cardholder" figure should mean.
      */
      let wGap = 0, wSpend = 0, wTotal = 0;
      for (const seg of SEGMENTS) {
        const sub = rows.filter((r) => r.segment === seg.name);
        if (!sub.length) continue;
        wGap += seg.weight * med(sub, (r) => r.optimal - r.naive);
        wSpend += seg.weight * med(sub, (r) => r.annualSpend);
        wTotal += seg.weight;
      }
      P("");
      P(`   >> POPULATION-WEIGHTED: gap AED ${aed(wGap / wTotal)}/yr on ` +
        `AED ${aed(wSpend / wTotal)} annual spend  (= ${((wGap / wSpend) * 100).toFixed(2)}% of spend)`);
      P(`      vs unweighted pooled median AED ${aed(pct(gapNaive, 0.5))} — ` +
        `the difference is sample mix, not optimizer skill.`);
    };

    P("");
    P("══════════════════════════════════════════════════════════════════");
    P("  FILS GAP STUDY — modeled, not observed");
    P(`  ${profilesSeen} profiles · ${CARDS.length} cards · seed 20260804`);
    P("══════════════════════════════════════════════════════════════════");

    report("UNIVERSE: ALL cards, midpoint  (optimistic — every range read at its centre)", all);
    report("UNIVERSE: ALL cards, LOWER BOUND  (<<< THE DEFENSIBLE FLOOR)", floorRows);
    report("UNIVERSE: SOUND rates  (promo/merchant defects removed)", sound);
    report("UNIVERSE: PUBLISHABLE  (<-- THE ONE A CLAIM CAN REST ON)", pub);
    report("UNIVERSE: CLEAN cards only  (zero flags — too strict, degenerate)", clean);

    P("");
    P("── DATA QUALITY ──────────────────────────────────────────");
    P(`   avg eligible cards per profile:      ${(eligibleUniverseTotal / profilesSeen).toFixed(1)}`);
    P(`   avg SOUND-rate cards per profile:    ${(soundUniverseTotal / profilesSeen).toFixed(1)}`);
    P(`   avg PUBLISHABLE cards per profile:   ${(pubUniverseTotal / profilesSeen).toFixed(1)}`);
    P(`   avg CLEAN (zero-flag) cards:         ${(cleanUniverseTotal / profilesSeen).toFixed(1)}`);
    P(`   cards REJECTED for rate defects:     ${(100 - (soundUniverseTotal / eligibleUniverseTotal) * 100).toFixed(1)}%`);
    P(`   share of card-scores carrying a flag:${(
      100 - (cleanUniverseTotal / eligibleUniverseTotal) * 100).toFixed(1)}%`);
    P("");
    P("   A UAE credit card returning >8% of total spend does not exist.");
    P("   Any median above that is a DATA defect, not a product result.");
    P("");

    console.log(out.join("\n"));
    expect(profilesSeen).toBeGreaterThan(100);
  }, 1_800_000);
});
