/** Diagnostic: which cards/categories drive implausible returns in the SOUND universe? */
import { describe, it } from "vitest";
import { CARDS } from "./index";
import { scoreCard, type SpendingProfile } from "./score-card";

// See gap-study.test.ts — engine tsconfig has no DOM/Node libs.
declare const console: { log(...args: unknown[]): void };
declare const process: { env: Record<string, string | undefined> };

const profile: SpendingProfile = {
  groceries: 2200, dining: 1800, fuel: 700, utilities: 700, education: 0,
  travel: 1500, transport: 400, entertainment: 900, international: 900, other: 1400,
};

const isRateDefect = (m: string) =>
  m.includes("assumes spend occurs") ||
  m.startsWith("Low-confidence rate") ||
  m.startsWith("Unknown rate");

// Gated like gap-study: a data-quality auditor, not a regression test.
//   GAP_STUDY=1 npx vitest run src/gap-diag.test.ts --disable-console-intercept
describe.skipIf(!process.env.GAP_STUDY)("diag", () => {
  it("ranks cards by implied return and shows the earning lines", () => {
    const monthly = Object.values(profile).reduce((a, b) => a + b, 0);
    const annual = monthly * 12;
    console.log(`\nprofile: AED ${monthly}/mo, ${annual}/yr\n`);

    const scored = CARDS.filter((c) => !c.excluded_from_scoring)
      .map((c) => ({ card: c, s: scoreCard(profile, c) }))
      .filter((x) => !x.s.flags.some((f) => isRateDefect(f.message)))
      .map((x) => ({ ...x, ret: (x.s.netAnnualValue / annual) * 100 }))
      .sort((a, b) => b.ret - a.ret);

    console.log(`SOUND universe: ${scored.length} cards. Top 8 by implied annual return:\n`);
    for (const { card, s, ret } of scored.slice(0, 8)) {
      const plaus = ret > 4 ? "  <== IMPLAUSIBLE" : "";
      console.log(
        `${card.id.padEnd(26)} ${ret.toFixed(2).padStart(6)}%  net ${s.netAnnualValue.toFixed(0).padStart(6)}` +
          `  fee ${String(s.fees.ongoingFeeAed).padStart(4)}  ${card.rewards.currency}${plaus}`,
      );
      for (const b of s.breakdown.filter((b) => b.annualValueAed.max > 0).slice(0, 4)) {
        const spendYr = b.monthlySpendAed * 12;
        const eff = spendYr > 0 ? (b.annualValueAed.max / spendYr) * 100 : 0;
        console.log(
          `    ${b.cardCategory.slice(0, 40).padEnd(42)} AED ${b.monthlySpendAed
            .toFixed(0)
            .padStart(5)}/mo -> ${b.annualValueAed.max.toFixed(0).padStart(6)}/yr  = ${eff.toFixed(1)}%` +
            `${b.capBound ? " [cap]" : ""}`,
        );
      }
      console.log(`    valuation: ${s.valuation.aedPerUnit} AED/unit (${s.valuation.confidence})`);
      console.log("");
    }
  }, 300_000);
});
