"use client";

import { useState } from "react";
import { CARDS, SPEND_CATEGORIES, type Portfolio } from "@fils/engine";
import type { OptimizeError, OptimizeRequest, OptimizeResponse } from "@/lib/optimize-contract";

const CARD_NAME = new Map(CARDS.map((c) => [c.id, c.name]));
const nameOf = (id: string): string => CARD_NAME.get(id) ?? id;

const aed = (n: number): string => `AED ${Math.round(n).toLocaleString()}`;
const aedRange = (r: { min: number; max: number }): string =>
  r.max !== r.min ? `${aed(r.min)}–${aed(r.max)}` : aed(r.min);

const CATEGORY_LABELS: Record<string, string> = {
  groceries: "Groceries",
  dining: "Dining",
  fuel: "Fuel",
  utilities: "Utilities",
  education: "Education",
  travel: "Travel",
  transport: "Transport",
  entertainment: "Entertainment",
  international: "International",
  other: "Other",
};

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
    <main className="page">
      <section className="hero">
        <h1>
          Your cards, <span className="hero-accent">optimized</span>.
        </h1>
        <p>
          Enter your monthly spending and we&apos;ll find the best 1, 2, and 3-card portfolio across {CARDS.length} UAE
          credit cards — maximizing rewards, minimizing fees.
        </p>
      </section>

      <form onSubmit={onSubmit}>
        <div className="panel">
          <div className="panel-title">Monthly spending (AED)</div>
          <div className="spend-grid">
            {SPEND_CATEGORIES.map((cat) => (
              <div key={cat} className="spend-field">
                <label>{CATEGORY_LABELS[cat] ?? cat}</label>
                <div className="input-wrap">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={spending[cat] ?? ""}
                    onChange={(e) => setSpending((s) => ({ ...s, [cat]: e.target.value }))}
                  />
                  <span className="input-suffix">AED</span>
                </div>
              </div>
            ))}
          </div>

          <div className="profile-row">
            <div className="profile-field spend-field">
              <label>Monthly salary</label>
              <div className="input-wrap">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
                <span className="input-suffix">AED</span>
              </div>
            </div>
            <label className="checkbox-field">
              <input type="checkbox" checked={resident} onChange={(e) => setResident(e.target.checked)} />
              <span>UAE resident</span>
            </label>
          </div>

          <div className="submit-row">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Optimizing…
                </>
              ) : (
                "Optimize my cards"
              )}
            </button>
          </div>
        </div>
      </form>

      {error ? <div className="error-box">{error}</div> : null}

      {result ? <Results result={result} /> : null}
    </main>
  );
}

function Results({ result }: { result: OptimizeResponse }): React.ReactElement {
  return (
    <section className="results">
      <div className="results-summary">
        <span className="badge badge-success">{result.eligibleCardCount} eligible</span>
        <span className="badge">{result.totalCardCount} total</span>
        {result.excludedForEligibility > 0 ? (
          <span className="badge">{result.excludedForEligibility} excluded</span>
        ) : null}
        {result.benchedCount > 0 ? <span className="badge">{result.benchedCount} benched</span> : null}
      </div>

      {result.overallBest ? <OverallBanner p={result.overallBest} /> : null}

      <div className="portfolio-grid">
        {result.best1 ? <PortfolioCard label="Best 1-card" p={result.best1} recommended={result.overallBest?.size === 1} /> : null}
        {result.best2 ? <PortfolioCard label="Best 2-card" p={result.best2} recommended={result.overallBest?.size === 2} /> : null}
        {result.best3 ? <PortfolioCard label="Best 3-card" p={result.best3} recommended={result.overallBest?.size === 3} /> : null}
      </div>
    </section>
  );
}

function OverallBanner({ p }: { p: Portfolio }): React.ReactElement {
  return (
    <div className="overall-banner">
      <div>
        <div className="overall-label">Recommended portfolio</div>
        <div className="overall-cards">{p.cardIds.map(nameOf).join(" + ")}</div>
      </div>
      <div className="overall-value">
        <div className="overall-value-num">{aed(p.netAnnualValue)}</div>
        <div className="overall-value-label">per year, ongoing</div>
      </div>
    </div>
  );
}

function PortfolioCard({
  label,
  p,
  recommended,
}: {
  label: string;
  p: Portfolio;
  recommended: boolean;
}): React.ReactElement {
  return (
    <div className={`portfolio-card${recommended ? " recommended" : ""}`}>
      {recommended ? <span className="recommended-tag">Best pick</span> : null}
      <div className="portfolio-size">{label}</div>

      <div className="portfolio-cards">
        {p.cardIds.map((id) => (
          <span key={id} className="card-chip">
            {nameOf(id)}
          </span>
        ))}
      </div>

      <div className="portfolio-value">{aed(p.netAnnualValue)}</div>
      <div className="portfolio-value-sub">
        {aedRange(p.netAnnualValueRange)} / yr ongoing
        {p.uncertain ? " · estimate has uncertainty" : ""}
      </div>

      <div className="portfolio-meta">
        <div className="portfolio-meta-item">
          <span className="portfolio-meta-label">Year 1 net</span>
          <span className="portfolio-meta-value">{aed(p.netAnnualValueYear1)}</span>
        </div>
        <div className="portfolio-meta-item">
          <span className="portfolio-meta-label">Gross</span>
          <span className="portfolio-meta-value">{aedRange(p.grossAnnualValue)}</span>
        </div>
        <div className="portfolio-meta-item">
          <span className="portfolio-meta-label">Fees (yr 1 / ongoing)</span>
          <span className="portfolio-meta-value">
            {aed(p.totalFees.year1)} / {aed(p.totalFees.ongoing)}
          </span>
        </div>
      </div>

      {p.allocations.length > 0 ? <Allocations p={p} /> : null}

      {p.flags.length > 0 ? <Flags p={p} /> : null}
    </div>
  );
}

function Allocations({ p }: { p: Portfolio }): React.ReactElement {
  return (
    <div className="allocations">
      <div className="alloc-title">Swipe this card for…</div>
      {p.allocations.map((a, i) => (
        <div key={i} className="alloc-row">
          <div className="alloc-left">
            <span className="alloc-cat">{CATEGORY_LABELS[a.spendCategory] ?? a.spendCategory}</span>
            <span className="alloc-card-name">{nameOf(a.cardId)}</span>
            {a.capBound ? <span className="alloc-cap">{a.capBound} cap</span> : null}
          </div>
          <div className="alloc-right">{aedRange(a.annualValueAed)}/yr</div>
        </div>
      ))}
      {p.unearnedMonthlyAed > 0 ? (
        <div className="alloc-row">
          <div className="alloc-left" style={{ color: "var(--warning)" }}>
            Unearned (all caps full)
          </div>
          <div className="alloc-right" style={{ color: "var(--warning)" }}>
            {aed(p.unearnedMonthlyAed)}/mo
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Flags({ p }: { p: Portfolio }): React.ReactElement {
  return (
    <div className="flags">
      {p.flags.map((f, i) => (
        <div key={i} className={`flag flag-${f.level}`}>
          <span className="flag-dot" />
          <span>{f.message}</span>
        </div>
      ))}
    </div>
  );
}
