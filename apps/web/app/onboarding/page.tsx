"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import type { SpendCategory } from "@fils/engine";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardPicker } from "@/components/card-picker";
import { CATEGORIES, DEFAULT_SPEND, totalSpend } from "@/lib/optimizer";
import { useProfileStore } from "@/lib/profile-store";
import { SpendSlider } from "@/components/spend-slider";
import { cardById } from "@/lib/cards";
import { aed } from "@/lib/format";
import { cn } from "@/lib/cn";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const STEPS = ["Your cards", "Your spending"];

export default function OnboardingPage() {
  const router = useRouter();
  const { state, ready, save } = useProfileStore();
  const [step, setStep] = useState(0);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [spend, setSpend] = useState<Record<SpendCategory, number>>({ ...DEFAULT_SPEND });
  const [salary, setSalary] = useState(20000);
  const [seeded, setSeeded] = useState(false);

  // Seed the form from any saved state once, after the store hydrates.
  useEffect(() => {
    if (!ready || seeded) return;
    setCardIds(state.cardIds);
    setSpend(state.spending);
    setSalary(state.profile.monthlySalaryAed);
    setSeeded(true);
  }, [ready, seeded, state]);

  function finish() {
    // Primary bank = the bank of the first card the user picked (display only).
    const bank = cardIds.length ? cardById(cardIds[0]!)?.bank ?? null : null;
    save({
      cardIds,
      spending: spend,
      profile: { monthlySalaryAed: salary, uaeResident: true },
      bank,
      onboarded: true,
    });
    router.push("/results");
  }

  const total = totalSpend(spend);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-70" />
      <div className="relative mx-auto max-w-2xl px-5 py-14">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-3">
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-colors",
                  i <= step ? "bg-flame text-white" : "bg-surface-2 text-faint",
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("text-sm", i <= step ? "text-fg" : "text-faint")}>{s}</span>
              {i === 0 && <span className="h-px flex-1 bg-line" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <h1 className="text-3xl font-semibold md:text-4xl">Which cards do you hold?</h1>
              <p className="mt-3 text-muted">
                Pick a bank, tick the cards you have, then add more from another bank. This lets us
                show what your wallet earns today. Skip it if you have none or would rather not say.
              </p>

              <Card className="mt-8">
                <CardPicker selected={cardIds} onChange={setCardIds} />
              </Card>

              <div className="mt-10 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setCardIds([])}>
                  I have no cards yet
                </Button>
                <Button onClick={() => setStep(1)}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="spend"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-3xl font-semibold md:text-4xl">How do you spend?</h1>
                  <p className="mt-3 text-muted">Monthly, in AED. Rough is fine. Drag the sliders.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-faint">Total / month</p>
                  <p className="text-2xl font-semibold text-clay">{aed(total)}</p>
                </div>
              </div>

              <Card className="mt-8 space-y-5">
                {CATEGORIES.map((cat) => (
                  <SpendSlider
                    key={cat}
                    category={cat}
                    value={spend[cat]}
                    onChange={(v) => setSpend((s) => ({ ...s, [cat]: v }))}
                  />
                ))}
              </Card>

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
                  Used only to filter cards you&apos;re eligible for.
                </p>
              </div>

              <div className="mt-10 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={finish}>
                  See my best cards
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
