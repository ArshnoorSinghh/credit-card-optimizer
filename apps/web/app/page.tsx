"use client";

import { useState } from "react";
import { CARDS, SPEND_CATEGORIES, type Portfolio } from "@fils/engine";
import type { OptimizeError, OptimizeRequest, OptimizeResponse } from "@/lib/optimize-contract";

// NOTE: deliberately plain scaffolding — no styling effort. This exists to prove
// the engine is wired to the web end to end and to eyeball a real PortfolioResult.
// The real frontend replaces this.

const CARD_NAME = new Map(CARDS.map((c) => [c.id, c.name]));
const nameOf = (id: string): string => CARD_NAME.get(id) ?? id;
const aed = (n: number): string => `AED ${Math.round(n).toLocaleString()}`;

function PortfolioView({ label, p }: { label: string; p: Portfolio | null }): React.ReactElement {
  if (!p) {
    return (
      <div style={{ marginBottom: 16 }}>
        <strong>{label}:</strong> none available
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16, borderTop: "1px solid #ccc", paddingTop: 8 }}>
      <div>
        <strong>{label}:</strong> {p.cardIds.map(nameOf).join(" + ")}
      </div>
      <div>
        Net annual value — ongoing: <strong>{aed(p.netAnnualValue)}</strong>, year 1:{" "}
        <strong>{aed(p.netAnnualValueYear1)}</strong>
      </div>
      <div>
        Total fees — ongoing: {aed(p.totalFees.ongoing)}, year 1: {aed(p.totalFees.year1)}
      </div>
      <ul style={{ marginTop: 6 }}>
        {p.allocations.map((a, i) => (
          <li key={i}>
            Swipe <strong>{nameOf(a.cardId)}</strong> for {a.spendCategory}: {aed(a.monthlySpendAed)}/mo →{" "}
            {a.annualValueAed.max !== a.annualValueAed.min
              ? `${aed(a.annualValueAed.min)}–${aed(a.annualValueAed.max)}`
              : aed(a.annualValueAed.min)}
            /yr{a.capBound ? ` (${a.capBound} cap reached)` : ""}
          </li>
        ))}
      </ul>
      {p.unearnedMonthlyAed > 0 ? (
        <div>Unearned (exceeds all caps): {aed(p.unearnedMonthlyAed)}/mo</div>
      ) : null}
      {p.flags.length > 0 ? (
        <details>
          <summary>{p.flags.length} uncertainty flag(s)</summary>
          <ul>
            {p.flags.map((f, i) => (
              <li key={i}>
                [{f.level}] {f.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export default function HomePage(): React.ReactElement {
  const [spending, setSpending] = useState<Record<string, string>>({});
  const [salary, setSalary] = useState("20000");
  const [resident, setResident] = useState(true);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    // Build the request from the inputs. Empty fields are omitted (treated as 0).
    const spendingBody: Record<string, number> = {};
    for (const cat of SPEND_CATEGORIES) {
      const raw = spending[cat];
      if (raw !== undefined && raw.trim() !== "") spendingBody[cat] = Number(raw);
    }
    const requestBody: OptimizeRequest = {
      spending: spendingBody,
      profile: { monthlySalaryAed: Number(salary), uaeResident: resident },
    };

    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data: OptimizeResponse | OptimizeError = await res.json();
      if (!res.ok) {
        setError("error" in data ? data.error : `Request failed (${res.status}).`);
      } else {
        setResult(data as OptimizeResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 780, margin: "24px auto", padding: "0 16px" }}>
      <h1>Fils — optimizer test harness</h1>
      <p>Enter monthly spend (AED) per category, plus your profile, and submit.</p>

      <form onSubmit={onSubmit}>
        <fieldset style={{ marginBottom: 12 }}>
          <legend>Monthly spend by category (AED)</legend>
          {SPEND_CATEGORIES.map((cat) => (
            <label key={cat} style={{ display: "inline-block", width: 220, margin: "4px 8px 4px 0" }}>
              {cat}:{" "}
              <input
                type="number"
                min="0"
                step="any"
                value={spending[cat] ?? ""}
                onChange={(e) => setSpending((s) => ({ ...s, [cat]: e.target.value }))}
                style={{ width: 90 }}
              />
            </label>
          ))}
        </fieldset>

        <fieldset style={{ marginBottom: 12 }}>
          <legend>Profile</legend>
          <label style={{ marginRight: 16 }}>
            Monthly salary (AED):{" "}
            <input type="number" min="0" step="any" value={salary} onChange={(e) => setSalary(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={resident} onChange={(e) => setResident(e.target.checked)} /> UAE resident
          </label>
        </fieldset>

        <button type="submit" disabled={loading}>
          {loading ? "Optimizing…" : "Optimize"}
        </button>
      </form>

      {error ? <p style={{ color: "crimson" }}>Error: {error}</p> : null}

      {result ? (
        <section style={{ marginTop: 20 }}>
          <h2>Result</h2>
          <p>
            {result.eligibleCardCount} of {result.totalCardCount} cards eligible ({result.benchedCount} benched,{" "}
            {result.excludedForEligibility} excluded by eligibility).
          </p>
          <PortfolioView label="Best 1-card" p={result.best1} />
          <PortfolioView label="Best 2-card" p={result.best2} />
          <PortfolioView label="Best 3-card" p={result.best3} />
          {result.overallBest ? (
            <p>
              <strong>Recommended overall:</strong> {result.overallBest.cardIds.map(nameOf).join(" + ")} (
              {aed(result.overallBest.netAnnualValue)}/yr ongoing)
            </p>
          ) : null}

          <details style={{ marginTop: 16 }}>
            <summary>Raw PortfolioResult (JSON)</summary>
            <pre style={{ overflowX: "auto", background: "#f5f5f5", padding: 8 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </main>
  );
}
