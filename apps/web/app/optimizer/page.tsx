"use client";

import { useEffect, useMemo, useState } from "react";
import type { SpendCategory } from "@fils/engine";
import { Aurora } from "@/components/aurora";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SpendSlider } from "@/components/spend-slider";
import { PortfolioResults } from "@/components/portfolio-results";
import { Reveal } from "@/components/ui/reveal";
import { CATEGORIES, DEFAULT_SPEND, DEFAULT_PROFILE, runOptimize, totalSpend } from "@/lib/optimizer";
import { loadProfile, saveProfile } from "@/lib/profile-store";
import { aed } from "@/lib/format";

/*
  Live Card Optimizer — the "top of main" view. Left rail edits the spend profile;
  the right pane re-runs the real engine on every change (useMemo) and shows the
  1/2/3-card portfolios. Seeded from the stored onboarding profile if present.
*/

export default function OptimizerPage() {
  // Start from deterministic defaults (same on server + client, no hydration
  // mismatch), then hydrate from the stored onboarding profile after mount.
  const [spend, setSpend] = useState<Record<SpendCategory, number>>({ ...DEFAULT_SPEND });
  const [salary, setSalary] = useState(DEFAULT_PROFILE.monthlySalaryAed);
  const [bank, setBank] = useState<string | null>(null);
  // Carried through so editing spend here doesn't wipe held cards chosen at entry.
  const [heldCardIds, setHeldCardIds] = useState<string[]>([]);

  useEffect(() => {
    const seed = loadProfile();
    setSpend(seed.spending);
    setSalary(seed.profile.monthlySalaryAed);
    setBank(seed.bank);
    setHeldCardIds(seed.heldCardIds);
  }, []);

  const result = useMemo(
    () => runOptimize(spend, { monthlySalaryAed: salary, uaeResident: true }),
    [spend, salary],
  );

  function update(cat: SpendCategory, v: number) {
    const next = { ...spend, [cat]: v };
    setSpend(next);
    saveProfile({ spending: next, profile: { monthlySalaryAed: salary, uaeResident: true }, bank, heldCardIds });
  }

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora subtle className="opacity-40" />
      <div className="relative mx-auto max-w-6xl px-5 py-12">
        <Reveal>
          <Badge tone="brand">Card Optimizer</Badge>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Tune it live</h1>
          <p className="mt-3 max-w-xl text-muted">
            Drag any category and watch the optimal 1, 2, and 3-card portfolios recompute in real time.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Controls */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">
                  Monthly spend
                </h3>
                <span className="text-sm font-semibold text-clay">{aed(totalSpend(spend))}</span>
              </div>
              <div className="space-y-4">
                {CATEGORIES.map((cat) => (
                  <SpendSlider key={cat} category={cat} value={spend[cat]} onChange={(v) => update(cat, v)} />
                ))}
              </div>
            </Card>
            <Card>
              <label className="mb-2 block text-sm text-muted">Monthly salary (AED)</label>
              <input
                type="number"
                min={0}
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value) || 0)}
                className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-4 py-3 text-fg outline-none transition-colors focus:border-line-strong focus:ring-2 focus:ring-flame/40"
              />
            </Card>
          </div>

          {/* Results — no remount key: the pane persists across edits so the
              headline figure can TWEEN to its new value (see CountTo) instead of
              snapping. The per-size fade lives inside PortfolioResults. */}
          <div>
            <PortfolioResults result={result} />
          </div>
        </div>
      </div>
    </main>
  );
}
