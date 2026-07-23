"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Plane, Building, Coins, Banknote, Flame } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { CountTo } from "@/components/count-to";
import { aed } from "@/lib/format";
import { cn } from "@/lib/cn";

/*
  Points Optimizer UI — Engine 2 surface. Uses realistic PLACEHOLDER valuations
  (from the project's research notes) so the screen is fully explorable before it
  is wired to the real recommendRedemptions / burnPriority exports. No numbers are
  invented — where a currency can't do a goal, we say so rather than faking a value.
*/

type Goal = "flights" | "hotels" | "max_value" | "cash_equivalent";

interface Program {
  currency: string;
  perPoint: number; // best AED/point for the goal
  cashCapable: boolean;
  note: string;
  expiryMonths: number | null;
}

// Best realized AED/point by program, keyed loosely by goal intent.
const PROGRAMS: Record<string, { flights: number; cash: number; cashCapable: boolean; note: string; expiry: number | null }> = {
  "Skywards Miles": { flights: 0.037, cash: 0.02, cashCapable: false, note: "Best as economy Saver flights", expiry: 36 },
  "Etihad Guest Miles": { flights: 0.036, cash: 0.02, cashCapable: false, note: "Extendable only by flight activity", expiry: 18 },
  "Mashreq TouchPoints": { flights: 0.006, cash: 0.006, cashCapable: true, note: "Pay down card bill or Max vouchers", expiry: null },
  "ADCB TouchPoints": { flights: 0.006, cash: 0.005, cashCapable: false, note: "Voucher or bill-pay only, no card-bill cash", expiry: null },
  "FAB Rewards": { flights: 0.007, cash: 0.007, cashCapable: true, note: "Statement credit at face value", expiry: 36 },
  "Etisalat Smiles": { flights: 0.01, cash: 0.01, cashCapable: false, note: "Vouchers or bill-pay only, cashback not permitted", expiry: 24 },
};

const CURRENCIES = Object.keys(PROGRAMS);

const GOALS: { key: Goal; label: string; icon: typeof Plane }[] = [
  { key: "max_value", label: "Max value", icon: Coins },
  { key: "flights", label: "Flights", icon: Plane },
  { key: "hotels", label: "Hotels", icon: Building },
  { key: "cash_equivalent", label: "Cash / bill", icon: Banknote },
];

interface Holding {
  id: number;
  currency: string;
  balance: number;
}

let nextId = 3;

export default function PointsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: 1, currency: "Skywards Miles", balance: 60000 },
    { id: 2, currency: "Mashreq TouchPoints", balance: 120000 },
  ]);
  const [goal, setGoal] = useState<Goal>("max_value");
  const [draftCur, setDraftCur] = useState(CURRENCIES[0] ?? "");
  const [draftBal, setDraftBal] = useState(10000);

  const results = useMemo(() => {
    return holdings
      .map((h) => {
        const p = PROGRAMS[h.currency];
        if (!p) return null;
        const wantsCash = goal === "cash_equivalent";
        const rate = wantsCash ? p.cash : p.flights;
        const value = h.balance * rate;
        const blocked = wantsCash && !p.cashCapable;
        return { ...h, value, rate, blocked, cashCapable: p.cashCapable, note: p.note, expiry: p.expiry };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.value - a.value);
  }, [holdings, goal]);

  const total = results.filter((r) => !r.blocked).reduce((s, r) => s + r.value, 0);
  const burnRisks = results.filter((r) => r.expiry !== null && r.expiry <= 24);

  function addHolding() {
    if (!draftCur || draftBal <= 0) return;
    setHoldings((h) => [...h, { id: nextId++, currency: draftCur, balance: draftBal }]);
  }

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora subtle className="opacity-40" />
      <div className="relative mx-auto max-w-5xl px-5 py-12">
        <Reveal>
          <Badge tone="brand">Points Optimizer</Badge>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Make your points count</h1>
          <p className="mt-3 max-w-xl text-muted">
            Add what you&apos;re holding and pick a goal. We show the best redemption route, the real
            AED value, and what&apos;s at risk of expiring.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Holdings editor */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-faint">
                Your holdings
              </h3>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {holdings.map((h) => (
                    <motion.div
                      key={h.id}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2/50 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-fg">{h.currency}</p>
                        <p className="text-xs text-faint">{h.balance.toLocaleString()} pts</p>
                      </div>
                      <button
                        onClick={() => setHoldings((hs) => hs.filter((x) => x.id !== h.id))}
                        className="rounded-full p-1.5 text-faint transition-colors hover:bg-black/[0.04] hover:text-danger"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Add row */}
              <div className="mt-4 space-y-2 border-t border-line pt-4">
                <select
                  value={draftCur}
                  onChange={(e) => setDraftCur(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none focus:border-line-strong"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c} className="bg-surface">
                      {c}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={draftBal}
                    onChange={(e) => setDraftBal(Number(e.target.value) || 0)}
                    className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none focus:border-line-strong"
                  />
                  <Button size="sm" onClick={addHolding}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            </Card>

            {/* Goal */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Goal</h3>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGoal(g.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-all",
                      goal === g.key
                        ? "border-flame/60 bg-flame/10 text-fg"
                        : "border-line bg-surface-2/50 text-muted hover:text-fg",
                    )}
                  >
                    <g.icon className="h-4 w-4" />
                    {g.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-5">
            <Card glow>
              <p className="text-sm text-muted">Total realizable value ({GOALS.find((g) => g.key === goal)?.label})</p>
              <CountTo value={total} format={aed} className="mt-1 block text-5xl font-semibold text-clay" />
            </Card>

            {burnRisks.length > 0 && (
              <Card className="border-warning/30 bg-warning/5">
                <div className="flex items-start gap-3">
                  <Flame className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-fg">Burn watch</p>
                    <p className="mt-1 text-sm text-muted">
                      {burnRisks.map((r) => r.currency).join(", ")} have shorter expiry windows
                      (~{Math.min(...burnRisks.map((r) => r.expiry ?? 99))} months by program policy).
                      Least-flexible balances first if you&apos;re close to the window.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {results.map((r) => (
              <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card hover>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold">{r.currency}</h4>
                        {!r.cashCapable && <Badge tone="warning">No card-bill cash</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted">{r.balance.toLocaleString()} pts · {r.note}</p>
                    </div>
                    <div className="text-right">
                      {r.blocked ? (
                        <span className="text-sm text-danger">Not available for this goal</span>
                      ) : (
                        <>
                          <p className="text-2xl font-semibold text-fg">{aed(r.value)}</p>
                          <p className="text-xs text-faint">@ {r.rate.toFixed(3)} AED/pt</p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs text-faint">
          Demo valuations from the project&apos;s research notes. Live figures plug in when the Points
          engine is wired to this screen.
        </p>
      </div>
    </main>
  );
}
