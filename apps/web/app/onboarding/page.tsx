"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Coins, SlidersHorizontal, Sparkles } from "lucide-react";
import type { SpendCategory } from "@fils/engine";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SpendSlider } from "@/components/spend-slider";
import { PortfolioResults } from "@/components/portfolio-results";
import { IntentPicker, type Intent } from "@/components/entry/intent-picker";
import { HeldCardsPicker } from "@/components/entry/held-cards-picker";
import { BaselineBanner } from "@/components/entry/baseline-banner";
import { CATEGORIES, DEFAULT_SPEND, runOptimize, totalSpend } from "@/lib/optimizer";
import { runBaseline } from "@/lib/baseline";
import { saveProfile } from "@/lib/profile-store";
import { aed } from "@/lib/format";
import { cn } from "@/lib/cn";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/*
  The entry flow: intent → wallet (held cards + spend, with a live "what you
  already earn" anchor) → the 1/2/3-card reveal, all on one page via a stage
  machine. The baseline persists into the reveal so the upgrade is measured
  against it. Everything runs the real engine client-side (see lib/optimizer).
*/

type Stage = "intent" | "wallet" | "reveal";
const STEPS: { stage: Stage; label: string }[] = [
  { stage: "intent", label: "Goal" },
  { stage: "wallet", label: "Your wallet" },
  { stage: "reveal", label: "Your upgrade" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intent");
  const [intent, setIntent] = useState<Intent>("gap");
  const [heldCardIds, setHeldCardIds] = useState<string[]>([]);
  const [spend, setSpend] = useState<Record<SpendCategory, number>>({ ...DEFAULT_SPEND });
  const [salary, setSalary] = useState(20000);

  const profile = useMemo(
    () => ({ monthlySalaryAed: salary, uaeResident: true }),
    [salary],
  );

  // The current wallet's value — recomputes live as held cards / spend change.
  const baseline = useMemo(
    () => runBaseline(heldCardIds, spend, profile),
    [heldCardIds, spend, profile],
  );

  // The optimizer's recommendation — only needed once we reach the reveal.
  const result = useMemo(
    () => (stage === "reveal" ? runOptimize(spend, profile) : null),
    [stage, spend, profile],
  );

  function persist() {
    saveProfile({ spending: spend, profile, bank: null, heldCardIds });
  }

  function pickIntent(next: Intent) {
    setIntent(next);
    if (next === "points") {
      persist();
      router.push("/points");
      return;
    }
    setStage("wallet");
  }

  function reveal() {
    persist();
    setStage("reveal");
  }

  const activeStep = STEPS.findIndex((s) => s.stage === stage);
  const total = totalSpend(spend);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-60" />
      <div className="relative mx-auto max-w-2xl px-5 py-14">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s.stage} className="flex flex-1 items-center gap-3">
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-colors",
                  i <= activeStep ? "bg-flame text-white" : "bg-surface-2 text-faint",
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-sm", i <= activeStep ? "text-fg" : "text-faint")}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {stage === "intent" && (
            <motion.div
              key="intent"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <IntentPicker onSelect={pickIntent} />
            </motion.div>
          )}

          {stage === "wallet" && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <h1 className="text-3xl font-semibold md:text-4xl">
                {intent === "gap" ? "What's in your wallet today?" : "Tell us about your spending"}
              </h1>
              <p className="mt-3 text-muted">
                Add the cards you carry and how you spend — we&apos;ll show what they earn you now,
                then a setup that earns more.
              </p>

              {/* Held cards */}
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
                  Cards you currently hold
                </h2>
                <HeldCardsPicker selected={heldCardIds} onChange={setHeldCardIds} />
              </div>

              {/* Spend */}
              <div className="mt-8">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
                    How you spend each month
                  </h2>
                  <div className="text-right">
                    <p className="text-xs text-faint">Total / month</p>
                    <p className="text-xl font-semibold text-clay tabular-nums">{aed(total)}</p>
                  </div>
                </div>
                <Card className="space-y-5">
                  {CATEGORIES.map((cat) => (
                    <SpendSlider
                      key={cat}
                      category={cat}
                      value={spend[cat]}
                      onChange={(v) => setSpend((s) => ({ ...s, [cat]: v }))}
                    />
                  ))}
                </Card>
              </div>

              {/* Salary */}
              <div className="mt-6">
                <label className="mb-2 block text-sm text-muted">Monthly salary (AED)</label>
                <input
                  type="number"
                  min={0}
                  value={salary}
                  onChange={(e) => setSalary(Number(e.target.value) || 0)}
                  className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-4 py-3 text-fg outline-none transition-colors focus:border-line-strong focus:ring-2 focus:ring-flame/40"
                />
                <p className="mt-2 text-xs text-faint">
                  Used only to filter cards you&apos;re eligible for. Never stored on a server in the demo.
                </p>
              </div>

              {/* Live baseline anchor */}
              <AnimatePresence>
                {baseline && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="mt-8"
                  >
                    <BaselineBanner baseline={baseline} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-10 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStage("intent")}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button variant="brand" onClick={reveal}>
                  {baseline ? "Show me a better setup" : "See my best cards"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {stage === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Badge tone="brand">
                    <Sparkles className="h-3.5 w-3.5" />
                    Card Optimizer
                  </Badge>
                  <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Your best cards</h1>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStage("wallet")}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Edit
                </Button>
              </div>

              {/* The baseline persists at the top so the upgrade is anchored to it. */}
              {baseline && (
                <div className="mt-6">
                  <BaselineBanner baseline={baseline} />
                </div>
              )}

              <div className="mt-6">
                <PortfolioResults result={result} baselineNet={baseline?.netAnnualValue ?? null} />
              </div>

              {/* Next step: the Points optimizer. */}
              <Card
                hover
                glow
                className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-[0.8rem] border border-line bg-surface-2 text-clay">
                    <Coins className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">Points Optimizer</h3>
                    <p className="mt-1 text-muted">
                      Holding miles or points? See what they&apos;re worth and when to burn them.
                    </p>
                  </div>
                </div>
                <Link href="/points" className="shrink-0 sm:self-center" onClick={persist}>
                  <Button variant="solid" size="sm">
                    Open Points Optimizer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
