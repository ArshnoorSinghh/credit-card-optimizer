"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Plane,
  Building,
  Coins,
  Banknote,
  Flame,
  ChevronDown,
  ArrowRightLeft,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { CountTo } from "@/components/count-to";
import { aed } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import {
  AVAILABLE_CURRENCIES,
  DEFAULT_HOLDINGS,
  GOAL_META,
  REDEMPTION_GOALS,
  runRedemptions,
  type PointsHolding,
  type RedemptionGoal,
} from "@/lib/redemptions";
import type { BurnItem, RedemptionCandidate, RedemptionSuggestion } from "@fils/engine";

/*
  Points & Redemption Optimizer (Engine 2) — wired to the real engine.

  Every AED figure, rate, confidence, expiry, and caveat on this screen comes from
  recommendRedemptions / burnPriority (via lib/redemptions.ts). Nothing is computed
  here — the page only arranges what the engine returns. Where the engine says a
  value is unknown or a route is unavailable, we render its honest message rather
  than fabricate a number.
*/

/** UI-only wrapper: a holding plus a stable id for list rendering. */
type Row = PointsHolding & { id: number };

const GOAL_ICON: Record<RedemptionGoal, typeof Coins> = {
  max_value: Coins,
  flights: Plane,
  hotels: Building,
  cash_equivalent: Banknote,
};

/** Confidence → semantic tone (per the design skill: low = warning). */
function confidenceTone(c: RedemptionCandidate["confidence"]): "success" | "neutral" | "warning" {
  return c === "high" ? "success" : c === "medium" ? "neutral" : "warning";
}

/** Burn urgency → tone. `unknown` stays neutral: no expiry known ≠ danger. */
function urgencyTone(u: BurnItem["urgency"]): "danger" | "warning" | "neutral" {
  return u === "urgent" ? "danger" : u === "soon" ? "warning" : "neutral";
}

const URGENCY_LABEL: Record<BurnItem["urgency"], string> = {
  urgent: "Urgent",
  soon: "Soon",
  later: "Later",
  unknown: "Unknown",
};

let nextId = DEFAULT_HOLDINGS.length + 1;

export default function PointsPage() {
  const [rows, setRows] = useState<Row[]>(
    DEFAULT_HOLDINGS.map((h, i) => ({ ...h, id: i + 1 })),
  );
  const [goal, setGoal] = useState<RedemptionGoal>("max_value");
  const [premiumCabin, setPremiumCabin] = useState(false);

  // Add-row drafts.
  const [draftCur, setDraftCur] = useState(AVAILABLE_CURRENCIES[0] ?? "");
  const [draftBal, setDraftBal] = useState(10000);
  const [draftExpiry, setDraftExpiry] = useState("");

  const { toast } = useToast();

  const result = useMemo(() => {
    // Strip the UI `id` before handing the engine a clean PointsHolding[].
    const inventory: PointsHolding[] = rows.map(({ id: _id, ...h }) => h);
    return runRedemptions(inventory, goal, premiumCabin ? { premiumMultiplier: 2 } : {});
  }, [rows, goal, premiumCabin]);

  function addRow() {
    if (!draftCur || draftBal <= 0) return;
    const holding: PointsHolding = { currency: draftCur, balance: draftBal };
    if (draftExpiry) holding.expiryDate = draftExpiry;
    setRows((r) => [...r, { ...holding, id: nextId++ }]);
    setDraftExpiry("");
    toast(`Added ${draftCur}`);
  }

  function removeRow(row: Row) {
    setRows((rs) => rs.filter((x) => x.id !== row.id));
    toast(`Removed ${row.currency}`, "info");
  }

  const goalLabel = GOAL_META[goal].label;
  // Burn items worth surfacing at the top as a warning.
  const burnAlerts = result?.burn.items.filter((i) => i.urgency === "urgent" || i.urgency === "soon") ?? [];

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora subtle className="opacity-40" />
      <div className="relative mx-auto max-w-5xl px-5 py-12">
        <Reveal>
          <Badge tone="brand">Points Optimizer</Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold md:text-5xl">Make your points count</h1>
          <p className="mt-3 max-w-xl text-muted">
            Add what you&apos;re holding and pick a goal. We show the best redemption route, the real
            AED value, and what&apos;s at risk of expiring — straight from the engine.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* ── Left: holdings editor + goal + advanced ─────────────────────── */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-faint">
                Your holdings
              </h3>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {rows.map((h) => (
                    <motion.div
                      key={h.id}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2/50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{h.currency}</p>
                        <p className="text-xs text-faint">
                          {h.balance.toLocaleString()} pts
                          {h.expiryDate && ` · expires ${h.expiryDate}`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRow(h)}
                        className="rounded-full p-1.5 text-faint transition-colors hover:bg-black/[0.04] hover:text-danger"
                        aria-label={`Remove ${h.currency}`}
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
                  aria-label="Reward currency"
                  className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none focus:border-line-strong"
                >
                  {AVAILABLE_CURRENCIES.map((c) => (
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
                    aria-label="Balance"
                    className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none focus:border-line-strong"
                  />
                  <Button size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-faint">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span className="shrink-0">Expiry (optional)</span>
                  <input
                    type="date"
                    value={draftExpiry}
                    onChange={(e) => setDraftExpiry(e.target.value)}
                    aria-label="Expiry date (optional)"
                    className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-2 py-1.5 text-xs text-fg outline-none focus:border-line-strong"
                  />
                </label>
              </div>
            </Card>

            {/* Goal */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Goal</h3>
              <div className="grid grid-cols-2 gap-2">
                {REDEMPTION_GOALS.map((g) => {
                  const Icon = GOAL_ICON[g];
                  return (
                    <button
                      key={g}
                      onClick={() => setGoal(g)}
                      className={cn(
                        "flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-all",
                        goal === g
                          ? "border-flame/60 bg-flame/10 text-fg"
                          : "border-line bg-surface-2/50 text-muted hover:text-fg",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {GOAL_META[g].label}
                    </button>
                  );
                })}
              </div>

              {/* Advanced: premium-cabin assumption. */}
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-line pt-4 text-sm">
                <input
                  type="checkbox"
                  checked={premiumCabin}
                  onChange={(e) => setPremiumCabin(e.target.checked)}
                  className="mt-0.5 accent-flame"
                />
                <span>
                  <span className="font-medium text-fg">Value premium-cabin seats</span>
                  <span className="mt-0.5 block text-xs text-faint">
                    Assumes premium redemptions are worth ~2× economy — an assumption, not a quote.
                  </span>
                </span>
              </label>
            </Card>
          </div>

          {/* ── Right: results ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            {rows.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface-2 text-clay">
                  <Coins className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold">Add a holding to begin</h3>
                <p className="max-w-xs text-sm text-muted">
                  Tell us which reward currencies you hold and how many points — we&apos;ll show the
                  best way to redeem them and what&apos;s at risk of expiring.
                </p>
              </Card>
            ) : result === null ? (
              <Card>
                <p className="text-sm text-muted">
                  We couldn&apos;t compute redemptions for this inventory. Try removing the last
                  holding, or adjust the balances.
                </p>
              </Card>
            ) : (
              <>
                {/* Total */}
                <Card glow>
                  <p className="text-sm text-muted">Total realizable value ({goalLabel})</p>
                  <CountTo value={result.plan.totalAed} format={aed} className="mt-1 block text-5xl font-semibold text-clay" />
                </Card>

                {/* Plan-level honesty flags */}
                {result.plan.flags.length > 0 && (
                  <div className="space-y-1.5 rounded-[var(--radius-md)] border border-line bg-surface-2/40 px-4 py-3">
                    {result.plan.flags.map((f, i) => (
                      <p key={i} className="text-xs text-faint">
                        {f}
                      </p>
                    ))}
                  </div>
                )}

                {/* Burn watch */}
                {burnAlerts.length > 0 && (
                  <Card className="border-warning/30 bg-warning/5">
                    <div className="flex items-start gap-3">
                      <Flame className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                      <div className="w-full">
                        <p className="font-medium text-fg">Burn watch</p>
                        <div className="mt-3 space-y-2.5">
                          {burnAlerts.map((item) => (
                            <BurnRow key={item.currency} item={item} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Redemption suggestions */}
                {result.plan.suggestions.map((s) => (
                  <motion.div key={s.currency} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <SuggestionCard suggestion={s} />
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>

        <p className="mt-8 text-xs text-faint">
          Figures come from the engine&apos;s researched redemption model. Low-confidence or flagged
          currencies are labelled as such — we never fabricate a value or invent an expiry date.
        </p>
      </div>
    </main>
  );
}

/** One burn item inside the Burn watch panel. */
function BurnRow({ item }: { item: BurnItem }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg">{item.currency}</span>
          <Badge tone={urgencyTone(item.urgency)}>{URGENCY_LABEL[item.urgency]}</Badge>
        </div>
        <span className="text-sm text-muted">
          {aed(item.valueAtRiskAed)} at risk
          {typeof item.daysToExpiry === "number" && ` · ${item.daysToExpiry}d left`}
        </span>
      </div>
      {item.devaluationWarning && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {item.devaluationWarning}
        </p>
      )}
    </div>
  );
}

/** One reward currency's best redemption route + alternatives + caveats. */
function SuggestionCard({ suggestion: s }: { suggestion: RedemptionSuggestion }) {
  const [showAlts, setShowAlts] = useState(false);
  const { best } = s;

  return (
    <Card hover>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold">{s.currency}</h4>
            {best && <Badge tone={confidenceTone(best.confidence)}>{best.confidence} confidence</Badge>}
            {best?.viaConversion && (
              <Badge tone="brand">
                <ArrowRightLeft className="h-3 w-3" />
                via {best.viaConversion.toCurrency}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{s.balance.toLocaleString()} pts</p>
        </div>
        {best && (
          <div className="text-right">
            <p className="text-2xl font-semibold text-fg tabular-nums">{aed(best.aedValue)}</p>
            <p className="text-xs text-faint tabular-nums">@ {best.aedPerUnit.toFixed(3)} AED/unit</p>
          </div>
        )}
      </div>

      {/* The engine's plain-language instruction (or the reason there's no route). */}
      {best ? (
        <p className="mt-3 text-sm text-muted">
          <span className="text-fg">Best route:</span> {s.receipt}
        </p>
      ) : (
        <p className="mt-3 text-sm text-danger">{s.flags[0] ?? "No redemption available for this goal."}</p>
      )}

      {/* Alternatives (collapsed). */}
      {s.alternatives.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowAlts((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-clay transition-colors hover:text-flame"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAlts && "rotate-180")} />
            {s.alternatives.length} other route{s.alternatives.length > 1 ? "s" : ""}
          </button>
          <AnimatePresence initial={false}>
            {showAlts && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 space-y-1.5 overflow-hidden"
              >
                {s.alternatives.map((alt, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <span className="capitalize text-muted">{alt.type.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-fg">
                      {aed(alt.aedValue)}
                      <span className="ml-2 text-xs text-faint">{alt.confidence}</span>
                    </span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Suggestion-level caveats (e.g. no card-bill cash, conversion-not-taken). */}
      {s.flags.length > 0 && (best !== null || s.flags.length > 1) && (
        <div className="mt-3 space-y-1 border-t border-line pt-3">
          {s.flags
            // If there's no best route, its reason is already shown above — skip it here.
            .filter((f, i) => best !== null || i !== 0)
            .map((f, i) => (
              <p key={i} className="text-xs text-faint">
                {f}
              </p>
            ))}
        </div>
      )}
    </Card>
  );
}
