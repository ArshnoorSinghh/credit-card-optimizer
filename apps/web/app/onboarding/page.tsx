"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Building2 } from "lucide-react";
import type { SpendCategory } from "@fils/engine";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BANKS, cardsByBank } from "@/lib/cards";
import { CATEGORIES, DEFAULT_SPEND, totalSpend } from "@/lib/optimizer";
import { saveProfile } from "@/lib/profile-store";
import { SpendSlider } from "@/components/spend-slider";
import { aed } from "@/lib/format";
import { cn } from "@/lib/cn";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [bank, setBank] = useState<string | null>(null);
  const [spend, setSpend] = useState<Record<SpendCategory, number>>({ ...DEFAULT_SPEND });
  const [salary, setSalary] = useState(20000);

  function finish() {
    saveProfile({
      spending: spend,
      profile: { monthlySalaryAed: salary, uaeResident: true },
      bank,
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
          {["Your bank", "Your spending"].map((s, i) => (
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
              key="bank"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <h1 className="text-3xl font-semibold md:text-4xl">Who do you bank with?</h1>
              <p className="mt-3 text-muted">
                Pick your main bank to see its cards — or skip and we&apos;ll search all 12.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BANKS.map((b) => {
                  const count = cardsByBank(b).length;
                  const selected = bank === b;
                  return (
                    <button
                      key={b}
                      onClick={() => setBank(selected ? null : b)}
                      className={cn(
                        "group flex flex-col items-start gap-2 rounded-[var(--radius-md)] border p-4 text-left transition-all",
                        selected
                          ? "border-flame/60 bg-flame/10"
                          : "border-line bg-surface hover:border-line-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-lg",
                          selected ? "bg-flame text-white" : "bg-surface-2 text-muted",
                        )}
                      >
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-fg">{b}</span>
                      <span className="text-xs text-faint">{count} cards</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-10 flex items-center justify-between">
                <Button variant="ghost" onClick={finish}>
                  Skip to results
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
                  <p className="mt-3 text-muted">Monthly, in AED. Rough is fine — drag the sliders.</p>
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
                  Used only to filter cards you&apos;re eligible for. Never stored on a server in the demo.
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
