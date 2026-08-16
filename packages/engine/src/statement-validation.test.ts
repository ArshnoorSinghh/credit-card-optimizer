import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import exampleData from "../data/statements.example.json";
import type { Card } from "./card";
import {
  checkStatement,
  summariseStatementChecks,
  type Statement,
  type StatementCheck,
} from "./statement-check";

/**
 * STATEMENT VALIDATION — run this against real statements.
 *
 * Not a unit test. A measurement, like the gap study, and the only one in this repo
 * that compares the engine to something that actually happened rather than to a model
 * of itself.
 *
 *   1. Copy `data/statements.example.json` to `data/statements.local.json`.
 *      That path is GITIGNORED. Real statements are private financial records and
 *      must never be committed — not to this repo, not to a branch, not "temporarily".
 *   2. Fill it in from real statements. Map what you can honestly map; leave the rest
 *      `null` rather than guessing, and put the actual rewards credited in
 *      `actualRewardUnits` / `actualRewardAed`.
 *   3. STATEMENTS=1 npx vitest run src/statement-validation.test.ts --disable-console-intercept
 *
 * Gated behind the env var and skipped entirely when the local file is absent, so a
 * normal `pnpm test` never depends on data that only exists on one machine.
 *
 * ── What to do with the result ──────────────────────────────────────────────────
 * If the engine overstates, that is the finding. Fix the CARD DATA or the model —
 * never this harness, and never the mapping, which is the one knob that could be
 * turned until the answer looks good. The whole value of this file is that it can
 * embarrass the engine.
 */

declare const console: { log(...args: unknown[]): void };
declare const process: { env: Record<string, string | undefined> };

const realCards = cardsData as Card[];

/*
  The local file is optional by design. `import.meta.glob` is a Vite feature and the
  engine stays framework-free, so this uses a plain dynamic require-shaped lookup
  through the example import instead: when statements.local.json is absent the suite
  falls back to the EXAMPLE, which contains no real data and is clearly labelled.
  The example is scored too — not to validate anything, but to prove the harness runs
  end-to-end on every CI pass, so it cannot rot between the rare real runs.
*/
function loadStatements(): { statements: Statement[]; isReal: boolean } {
  /*
    `import.meta.glob` rather than a plain import or `require`: the engine's tsconfig
    carries no Node types (`types: []`, deliberately — the package must stay portable),
    so `require` and `fs` are both unavailable, and a static import of a file that
    usually does not exist would fail the build on every machine but one.

    Glob resolves to an empty object when nothing matches, which is exactly the
    "optional file" semantics needed here. It is a Vite feature, and this is a vitest
    test file — the same latitude the other measurement harnesses take when they
    declare `process` and `console` themselves.
  */
  // Must be written out in full: Vite replaces the literal `import.meta.glob(...)`
  // call at transform time, so aliasing or destructuring it fails at runtime.
  const matches: Record<string, { default?: unknown }> =
    // @ts-expect-error — `glob` is a Vite transform-time addition to import.meta and
    // is not in the engine's type surface, which carries no vite/client types by design.
    import.meta.glob("../data/statements.local.json", { eager: true });
  for (const mod of Object.values(matches)) {
    const local = mod?.default ?? mod;
    if (Array.isArray(local) && local.length > 0) {
      return { statements: local as Statement[], isReal: true };
    }
  }
  return { statements: exampleData as unknown as Statement[], isReal: false };
}

describe("statement validation", () => {
  it("runs the harness end-to-end on the example, so it cannot rot", () => {
    /*
      This one is NOT gated. The real runs are rare and manual; without an ungated
      path the harness would quietly break between them and nobody would find out
      until the day it mattered. Scoring the example proves the wiring works — it
      validates nothing about the engine and must never be quoted as if it did.
    */
    const statements = exampleData as unknown as Statement[];
    const checks = statements.map((s) => {
      const card = realCards.find((c) => c.id === s.cardId);
      expect(card, `statements.example.json names unknown card "${s.cardId}"`).toBeDefined();
      return checkStatement(card!, s);
    });
    expect(checks).toHaveLength(statements.length);
    for (const c of checks) {
      expect(c.predictedAed.min).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(c.mappedSpendAed)).toBe(true);
    }
    const summary = summariseStatementChecks(checks);
    expect(summary.cycles).toBe(statements.length);
    // The example has ground truth, so the summary must warn that two cycles of made-up
    // data is not a characterisation of anything.
    expect(summary.flags.some((f) => /too few to characterise|NOTHING WAS VALIDATED/.test(f))).toBe(true);
  });

  it.skipIf(!process.env.STATEMENTS)("measures the engine against real statements", () => {
    const { statements, isReal } = loadStatements();
    const out: string[] = [];

    if (!isReal) {
      out.push(
        "\n  NO data/statements.local.json FOUND — running on the EXAMPLE file.",
        "  These numbers validate NOTHING. Copy statements.example.json to",
        "  statements.local.json and fill it in from real statements.\n",
      );
    }

    const checks: StatementCheck[] = [];
    for (const s of statements) {
      const card = realCards.find((c) => c.id === s.cardId);
      if (!card) {
        out.push(`  SKIPPED ${s.cycle}: unknown card "${s.cardId}"`);
        continue;
      }
      checks.push(checkStatement(card, s));
    }

    out.push("\n═══ STATEMENT VALIDATION ═══════════════════════════════════════");
    for (const c of checks) {
      out.push(`\n  ${c.cardName} — ${c.cycle}`);
      out.push(
        `    spend mapped AED ${Math.round(c.mappedSpendAed)}` +
          (c.unmappedSpendAed > 0
            ? `, unmapped AED ${Math.round(c.unmappedSpendAed)} (${c.unmappedSharePct.toFixed(0)}%)`
            : ""),
      );
      const pu = c.predictedUnits;
      out.push(
        `    predicted  ${Math.round(pu.min)}–${pu.max === null ? "unbounded" : Math.round(pu.max)} ${c.rewardCurrency}` +
          `  (AED ${c.predictedAed.min.toFixed(2)}–${c.predictedAed.max.toFixed(2)})`,
      );
      if (c.actualUnits !== undefined) {
        out.push(
          `    ACTUAL     ${Math.round(c.actualUnits)} ${c.rewardCurrency}` +
            `  ->  ${c.unitsWithinRange ? "WITHIN range" : "OUTSIDE range"}` +
            `, midpoint gap ${c.unitsGapPct!.toFixed(1)}% ${c.unitsGapPct! > 0 ? "(engine OVERSTATED)" : "(engine understated)"}`,
        );
      }
      if (c.actualAed !== undefined) {
        out.push(
          `    ACTUAL     AED ${c.actualAed.toFixed(2)}` +
            `  ->  ${c.aedWithinRange ? "WITHIN range" : "OUTSIDE range"}` +
            `, midpoint gap ${c.aedGapPct!.toFixed(1)}% ${c.aedGapPct! > 0 ? "(engine OVERSTATED)" : "(engine understated)"}`,
        );
      }
      for (const f of c.flags) out.push(`    ! ${f}`);
    }

    const s = summariseStatementChecks(checks);
    out.push("\n═══ SUMMARY ════════════════════════════════════════════════════");
    out.push(`  cycles supplied:        ${s.cycles}`);
    out.push(`  cycles with ground truth: ${s.compared}`);
    out.push(
      `  range CONTAINED reality:  ${s.withinRange}/${s.compared}` +
        (s.compared > 0 ? ` (${s.withinRangePct.toFixed(0)}%)` : ""),
    );
    out.push(
      `  median midpoint gap:      ${s.medianGapPct === null ? "n/a" : `${s.medianGapPct.toFixed(1)}%`}` +
        "   (positive = engine OVERSTATES)",
    );
    out.push(
      `  worst overstatement:      ${
        s.worstOverstatementPct === null
          ? "none"
          : `${s.worstOverstatementPct.toFixed(1)}% on ${s.worstOverstatementCard}`
      }`,
    );
    for (const f of s.flags) out.push(`  ! ${f}`);
    out.push("");
    out.push("  Range containment is the metric that matters. This engine's claim is that");
    out.push("  an uncertain rate propagates as a RANGE rather than a point estimate; a range");
    out.push("  that does not contain what the bank actually paid is a bound that was wrong.");
    out.push("");

    console.log(out.join("\n"));

    // Deliberately no pass/fail threshold. Inventing one ("must be within 10%")
    // would turn a measurement into a target, and the honest response to a bad
    // result is to fix the card data, not to relax a number in a test file.
    expect(checks.length).toBeGreaterThan(0);
  }, 300_000);
});
