/**
 * Gap study — how much reward does a UAE cardholder leave on the table?
 *
 * This is a MEASUREMENT harness, not a unit test. It sweeps a synthetic but
 * weighted population of UAE spending profiles and, for each one, compares three
 * strategies against the same card universe and eligibility rules:
 *
 *   naive    — the MEDIAN eligible single card. Models a user who picks a card
 *              without optimizing: they end up somewhere in the middle of what
 *              they could have got. (Not the worst card — nobody deliberately
 *              picks the worst — and not a random one, because the median is
 *              stable under the long left tail of fee-heavy cards.)
 *   diligent — the BEST eligible single card (optimizePortfolio's `best1`). Models
 *              a user who researched properly but carries one card.
 *   optimal  — `overallBest`: the best 1-3 card portfolio the engine can find.
 *
 * The headline number is the GAP: optimal − naive, i.e. what optimization is
 * actually worth to a typical user. It is reported both as a share of annual
 * spend and in AED/year, per segment and population-weighted.
 *
 * why this lives in the test suite but is gated behind an env var: it takes
 * ~200 full portfolio optimizations (each an exhaustive ~23k-subset enumeration),
 * which is far too slow for the normal suite, and its output is a report to read
 * rather than an assertion to enforce. Run it deliberately:
 *
 *     GAP_STUDY=1 pnpm --filter @fils/engine test gap-study
 *
 * why it is seeded: the population must be byte-identical between runs, so a
 * change in the ENGINE is the only thing that can move the numbers. Any drift in
 * the output is a real modelling change, never sampling noise.
 *
 * IMPORTANT: the naive/diligent/optimal spread this measures is only as honest as
 * the rate data underneath it. This harness is what surfaced the rate-ceiling
 * selection bias (see CARD_DATA_CHANGELOG.md) — an implausible ~9.4% median
 * optimal return that no real UAE card portfolio pays.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { scoreCard, type SpendCategory, type SpendingProfile } from "./score-card";
import { optimizePortfolio, type UserProfile } from "./optimize-portfolio";

const CARDS = cardsData as Card[];

// The engine tsconfig deliberately has no Node/DOM libs (types: []), matching the
// "no Node-only APIs in the engine" rule. Declare just the two `process` members
// this harness needs — the env gate and the report writer — rather than pulling in
// @types/node. Same approach normalize-rate.test.ts uses for `console`.
declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write(s: string): void };
};

// ---------------------------------------------------------------------------
// Deterministic PRNG.
//
// why hand-rolled: Math.random() can't be seeded, and the engine must stay
// dependency-free (CLAUDE.md). mulberry32 is a well-known 32-bit generator whose
// only job here is to make an arbitrary-but-fixed population — it needs to be
// reproducible and reasonably uniform, not cryptographic.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform draw in [lo, hi]. */
function between(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

// ---------------------------------------------------------------------------
// Segment archetypes.
//
// Each archetype fixes a salary band, a total-monthly-spend band, and a share of
// that spend per category. Shares are RELATIVE WEIGHTS (they are normalized to
// sum to 1 below), so they can be read as "how much of this person's life is
// this category" without having to hand-balance them to 1.0.
//
// why these five and these weights: they are a deliberate, stated model of the UAE
// cardholder base, not a measured distribution — weights are the study's input
// assumption and are printed with the results so a reader can re-weight. The
// population skews heavily to the early-career expat because that is who most UAE
// credit-card holders are; the frequent traveller is rare but is the segment the
// premium-card marketing is aimed at, so it must be represented.
// ---------------------------------------------------------------------------
interface Archetype {
  name: string;
  /** Share of the population. Must sum to 1 across all archetypes. */
  weight: number;
  salaryAed: [number, number];
  monthlySpendAed: [number, number];
  /** Relative category weights, normalized to the monthly spend total. */
  shares: Partial<Record<SpendCategory, number>>;
}

const ARCHETYPES: Archetype[] = [
  {
    // Single or newly-arrived professional. Rent dominates their outgoings but is
    // paid by cheque/transfer, not card — so card spend is groceries + dining +
    // getting to work, with a thin international tail (remittances, home visits).
    name: "early-career expat",
    weight: 0.4,
    salaryAed: [8_000, 16_000],
    monthlySpendAed: [4_000, 8_000],
    shares: {
      groceries: 26, dining: 20, fuel: 10, transport: 9, utilities: 11,
      entertainment: 7, international: 5, travel: 4, other: 8,
    },
  },
  {
    // Higher disposable income, no dependants: dining and entertainment heavy,
    // very little education or utilities.
    name: "young single",
    weight: 0.2,
    salaryAed: [12_000, 24_000],
    monthlySpendAed: [6_000, 13_000],
    shares: {
      dining: 27, groceries: 16, entertainment: 14, other: 12, fuel: 8,
      transport: 7, travel: 8, international: 6, utilities: 2,
    },
  },
  {
    // Two earners, no school fees yet. Broad, high-volume, unremarkable spend —
    // the segment where category caps bind hardest.
    name: "dual-income",
    weight: 0.2,
    salaryAed: [22_000, 45_000],
    monthlySpendAed: [12_000, 24_000],
    shares: {
      groceries: 24, dining: 18, other: 13, fuel: 11, utilities: 10,
      travel: 8, entertainment: 7, transport: 5, international: 4,
    },
  },
  {
    // School fees are the defining feature: a single very large, very lumpy
    // category that most UAE cards either exclude or pay a stub rate on.
    name: "family with school fees",
    weight: 0.13,
    salaryAed: [28_000, 60_000],
    monthlySpendAed: [20_000, 40_000],
    shares: {
      education: 32, groceries: 21, utilities: 11, fuel: 9, dining: 9,
      other: 7, transport: 4, travel: 4, entertainment: 3,
    },
  },
  {
    // Travel and foreign-currency spend dominate. Small segment, but it is the
    // one premium miles cards are priced for.
    name: "frequent traveller",
    weight: 0.07,
    salaryAed: [25_000, 55_000],
    monthlySpendAed: [15_000, 32_000],
    shares: {
      travel: 30, international: 24, dining: 14, groceries: 10, other: 8,
      entertainment: 6, fuel: 4, transport: 3, utilities: 1,
    },
  },
];

/** Population size. Split across archetypes in proportion to their weights. */
const POPULATION = 200;

const SEED = 20260813;

interface Profile {
  segment: string;
  spending: SpendingProfile;
  user: UserProfile;
  annualSpendAed: number;
}

/**
 * Build the population. Each archetype contributes round(weight * POPULATION)
 * profiles; each profile jitters BOTH its total spend and every category share
 * (±35%) so the sweep covers a spread of shapes rather than 200 rescalings of one
 * canonical profile — which would make caps bind at the same place every time and
 * badly understate the variance in the gap.
 */
function buildPopulation(): Profile[] {
  const rng = mulberry32(SEED);
  const profiles: Profile[] = [];

  for (const arch of ARCHETYPES) {
    const n = Math.round(arch.weight * POPULATION);
    for (let i = 0; i < n; i++) {
      // Jitter each category weight independently, then normalize to the drawn total.
      const jittered: Partial<Record<SpendCategory, number>> = {};
      let totalWeight = 0;
      for (const [cat, share] of Object.entries(arch.shares) as [SpendCategory, number][]) {
        const w = share * between(rng, 0.65, 1.35);
        jittered[cat] = w;
        totalWeight += w;
      }
      const monthlyTotal = between(rng, arch.monthlySpendAed[0], arch.monthlySpendAed[1]);
      const spending: SpendingProfile = {};
      for (const [cat, w] of Object.entries(jittered) as [SpendCategory, number][]) {
        spending[cat] = (w / totalWeight) * monthlyTotal;
      }

      profiles.push({
        segment: arch.name,
        spending,
        user: {
          monthlySalaryAed: between(rng, arch.salaryAed[0], arch.salaryAed[1]),
          uaeResident: true,
        },
        annualSpendAed: monthlyTotal * 12,
      });
    }
  }
  return profiles;
}

// ---------------------------------------------------------------------------
// Strategy evaluation.
// ---------------------------------------------------------------------------

/**
 * Net annual value of the MEDIAN eligible single card.
 *
 * Eligibility mirrors optimizePortfolio's own filter exactly (benched cards out,
 * then salary + residency), so `naive` and `optimal` are always drawn from the
 * same universe — otherwise the gap would partly measure a difference in which
 * cards were on the table, which is not what we want to report.
 */
function naiveSingleCardValue(p: Profile): number {
  const values: number[] = [];
  for (const card of CARDS) {
    if (card.excluded_from_scoring) continue;
    const e = card.eligibility;
    if (p.user.monthlySalaryAed < e.min_monthly_salary_aed) continue;
    if (e.uae_resident_required && !p.user.uaeResident) continue;
    values.push(scoreCard(p.spending, card).netAnnualValue);
  }
  return median(values);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

interface Observation {
  segment: string;
  annualSpendAed: number;
  naiveAed: number;
  best1Aed: number;
  optimalAed: number;
  /** optimal − naive: what optimizing is worth to this profile, AED/year. */
  gapAed: number;
  /** Cards in the recommended optimum (1-3). */
  optimalSize: number;
}

function observe(p: Profile): Observation {
  const result = optimizePortfolio(p.spending, p.user, CARDS);
  const naiveAed = naiveSingleCardValue(p);
  const best1Aed = result.best1?.netAnnualValue ?? 0;
  const optimalAed = result.overallBest?.netAnnualValue ?? 0;
  return {
    segment: p.segment,
    annualSpendAed: p.annualSpendAed,
    naiveAed,
    best1Aed,
    optimalAed,
    gapAed: optimalAed - naiveAed,
    optimalSize: result.overallBest?.size ?? 0,
  };
}

/** Express an AED/year figure as a percentage of that profile's annual spend. */
const pct = (aed: number, spend: number): number => (spend > 0 ? (aed / spend) * 100 : 0);

function fmt(n: number, width: number, dp = 2): string {
  return n.toFixed(dp).padStart(width);
}

// ---------------------------------------------------------------------------
// The study.
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.GAP_STUDY)("gap study — naive vs diligent vs optimal", () => {
  const population = buildPopulation();
  const observations = population.map(observe);

  it("reports the per-segment and population-weighted reward gap", () => {
    const out: string[] = [];
    const line = (s = "") => out.push(s);

    line("");
    line("=".repeat(96));
    line(`GAP STUDY — ${observations.length} synthetic UAE profiles, seed ${SEED}`);
    line("=".repeat(96));
    line("");
    line("  naive%   = median eligible SINGLE card, as % of annual spend");
    line("  best1%   = best eligible single card (a diligent one-card user)");
    line("  optimal% = best 1-3 card portfolio (engine's overallBest)");
    line("  gap%     = optimal% - naive%   (so naive% + gap% == optimal%, per row)");
    line("");
    line(
      "segment                    n   wt     naive%    best1%  optimal%      gap%      gap AED/yr  multi%",
    );
    line("-".repeat(96));

    // Per-segment rows, in the declared archetype order so the report is stable.
    for (const arch of ARCHETYPES) {
      const rows = observations.filter((o) => o.segment === arch.name);
      const naiveP = median(rows.map((o) => pct(o.naiveAed, o.annualSpendAed)));
      const best1P = median(rows.map((o) => pct(o.best1Aed, o.annualSpendAed)));
      const optimalP = median(rows.map((o) => pct(o.optimalAed, o.annualSpendAed)));
      const gapP = median(rows.map((o) => pct(o.gapAed, o.annualSpendAed)));
      const gapAed = mean(rows.map((o) => o.gapAed));
      const multi = (rows.filter((o) => o.optimalSize > 1).length / rows.length) * 100;
      line(
        `${arch.name.padEnd(26)}${String(rows.length).padStart(3)}  ${fmt(arch.weight, 4)}  ` +
          `${fmt(naiveP, 8)}  ${fmt(best1P, 8)}  ${fmt(optimalP, 8)}  ${fmt(gapP, 8)}  ` +
          `${fmt(gapAed, 14, 0)}  ${fmt(multi, 5, 1)}`,
      );
    }

    line("-".repeat(96));

    // Population-weighted: combine per-segment MEANS using the declared weights.
    // why weight explicitly rather than just pooling all 200 rows: the sample sizes
    // are only approximately proportional to the weights after rounding, and the
    // weights are the study's stated assumption — applying them explicitly keeps
    // the headline number traceable to them.
    const weighted = (pick: (o: Observation) => number): number =>
      ARCHETYPES.reduce(
        (acc, arch) => acc + arch.weight * mean(observations.filter((o) => o.segment === arch.name).map(pick)),
        0,
      );

    const wNaiveP = weighted((o) => pct(o.naiveAed, o.annualSpendAed));
    const wBest1P = weighted((o) => pct(o.best1Aed, o.annualSpendAed));
    const wOptimalP = weighted((o) => pct(o.optimalAed, o.annualSpendAed));
    const wGapP = weighted((o) => pct(o.gapAed, o.annualSpendAed));
    const wGapAed = weighted((o) => o.gapAed);
    line(
      `${"POPULATION-WEIGHTED".padEnd(26)}${String(observations.length).padStart(3)}  1.00  ` +
        `${fmt(wNaiveP, 8)}  ${fmt(wBest1P, 8)}  ${fmt(wOptimalP, 8)}  ${fmt(wGapP, 8)}  ` +
        `${fmt(wGapAed, 14, 0)}  ` +
        `${fmt((observations.filter((o) => o.optimalSize > 1).length / observations.length) * 100, 5, 1)}`,
    );

    // Pooled medians across the whole population — the headline "typical user".
    const pooledOptimalP = median(observations.map((o) => pct(o.optimalAed, o.annualSpendAed)));
    const pooledNaiveP = median(observations.map((o) => pct(o.naiveAed, o.annualSpendAed)));
    const pooledGapP = median(observations.map((o) => pct(o.gapAed, o.annualSpendAed)));
    line("");
    line(`  pooled MEDIAN naive%   : ${pooledNaiveP.toFixed(2)}%`);
    line(`  pooled MEDIAN optimal% : ${pooledOptimalP.toFixed(2)}%  <-- headline`);
    line(`  pooled MEDIAN gap%     : ${pooledGapP.toFixed(2)}%`);
    line(`  population-weighted gap: AED ${wGapAed.toFixed(0)}/yr`);
    line(
      `  optimum is multi-card  : ${(
        (observations.filter((o) => o.optimalSize > 1).length / observations.length) *
        100
      ).toFixed(1)}% of profiles`,
    );
    line("");
    line(
      "  PLAUSIBILITY: a median optimal return materially above ~4% of total spend is not",
    );
    line(
      "  achievable on real UAE cards once caps, fees and minimum-spend gates bite. A higher",
    );
    line("  figure indicates a modelling bias, not an opportunity.");
    line("=".repeat(96));
    line("");

    // why process.stdout.write and not console.log: vitest intercepts console in
    // this setup and swallows it, which would make the study silently produce nothing.
    process.stdout.write(out.join("\n") + "\n");

    expect(observations).toHaveLength(POPULATION);
  });

  it("keeps every strategy ordered naive <= best1 <= optimal", () => {
    // A structural invariant, not a calibration: the best single card can never be
    // worse than the median single card, and the best 1-3 portfolio can never be
    // worse than the best single card (a 1-card portfolio is in its search space).
    // If this ever fails, the optimizer is broken — independent of any rate data.
    for (const o of observations) {
      expect(o.best1Aed).toBeGreaterThanOrEqual(o.naiveAed - 1e-6);
      expect(o.optimalAed).toBeGreaterThanOrEqual(o.best1Aed - 1e-6);
    }
  });
});
