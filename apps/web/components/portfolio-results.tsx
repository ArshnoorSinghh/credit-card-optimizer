"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, TriangleAlert, Sparkles } from "lucide-react";
import type { Portfolio, PortfolioResult } from "@fils/engine";
import { ALL_CARDS } from "@/lib/cards";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { aed, aedRange, label } from "@/lib/format";
import { cn } from "@/lib/cn";

const NAME = new Map(ALL_CARDS.map((c) => [c.id, c.name]));
const BANK = new Map(ALL_CARDS.map((c) => [c.id, c.bank]));
const nameOf = (id: string) => NAME.get(id) ?? id;

type SizeKey = 1 | 2 | 3;

export function PortfolioResults({ result }: { result: PortfolioResult | null }) {
  const [size, setSize] = useState<SizeKey>(result?.overallBest?.size ?? 1);
  const [showMath, setShowMath] = useState(false);

  if (!result) {
    return (
      <Card className="text-center">
        <p className="text-muted">
          Couldn&apos;t compute a recommendation. Try adjusting your spend and running again.
        </p>
      </Card>
    );
  }

  const bySize: Record<SizeKey, Portfolio | null> = {
    1: result.best1,
    2: result.best2,
    3: result.best3,
  };
  const active = bySize[size];
  const recommendedSize = result.overallBest?.size;

  return (
    <div className="space-y-6">
      {/* Eligibility summary */}
      <p className="text-sm text-muted">
        <span className="text-fg">{result.eligibleCardCount}</span> of {result.totalCardCount} cards
        match your profile
        {result.excludedForEligibility > 0
          ? ` · ${result.excludedForEligibility} excluded by salary/residency`
          : ""}
        {result.benchedCount > 0 ? ` · ${result.benchedCount} pending verification` : ""}.
      </p>

      {/* Size tabs */}
      <div className="inline-flex rounded-full border border-line bg-surface p-1">
        {([1, 2, 3] as SizeKey[]).map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={cn(
              "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
              size === s ? "text-white" : "text-muted hover:text-fg",
            )}
          >
            {size === s && (
              <motion.span
                layoutId="sizeTab"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {s} card{s > 1 ? "s" : ""}
              {recommendedSize === s && <Sparkles className="h-3.5 w-3.5" />}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={size}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {!active ? (
            <Card>
              <p className="text-muted">No {size}-card portfolio available for your profile.</p>
            </Card>
          ) : (
            <Card glow className="overflow-hidden">
              {/* Headline value */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  {recommendedSize === size && (
                    <Badge tone="brand" className="mb-3">
                      <Sparkles className="h-3.5 w-3.5" />
                      Recommended for you
                    </Badge>
                  )}
                  <p className="text-sm text-muted">Net value per year (ongoing)</p>
                  <p className="mt-1 text-5xl font-semibold text-gradient">
                    {aed(active.netAnnualValue)}
                  </p>
                </div>
                <div className="text-right text-sm text-muted">
                  <p>
                    Year 1: <span className="text-fg">{aed(active.netAnnualValueYear1)}</span>
                  </p>
                  <p className="mt-1">
                    Annual fees:{" "}
                    <span className="text-fg">{aed(active.totalFees.ongoing)}</span>
                  </p>
                </div>
              </div>

              {/* The cards */}
              <div className="mt-6 flex flex-wrap gap-2">
                {active.cardIds.map((id) => (
                  <Link
                    key={id}
                    href={`/cards/${id}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm transition-colors hover:border-line-strong"
                  >
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    <span className="font-medium text-fg group-hover:text-white">{nameOf(id)}</span>
                    <span className="text-faint">{BANK.get(id)}</span>
                  </Link>
                ))}
              </div>

              {/* Allocations — swipe THIS card */}
              <div className="mt-8">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
                  Which card for what
                </h4>
                <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line">
                  {active.allocations.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 bg-surface-2/40 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-24 font-medium text-fg">{label(a.spendCategory)}</span>
                        <span className="text-muted">
                          {aed(a.monthlySpendAed)}/mo → <span className="text-fg">{nameOf(a.cardId)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-fg">
                          {aedRange(a.annualValueAed.min, a.annualValueAed.max)}/yr
                        </span>
                        {a.capBound && (
                          <Badge tone="warning" className="hidden sm:inline-flex">
                            {a.capBound} cap
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show the math / flags */}
              {(active.flags.length > 0 || active.uncertain) && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowMath((v) => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-fg"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", showMath && "rotate-180")}
                    />
                    {active.flags.length} note{active.flags.length === 1 ? "" : "s"} on this estimate
                  </button>
                  <AnimatePresence initial={false}>
                    {showMath && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mt-3 space-y-2 overflow-hidden"
                      >
                        {active.flags.map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm text-muted">
                            <TriangleAlert
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0",
                                f.level === "unknown" ? "text-danger" : "text-warning",
                              )}
                            />
                            {f.message}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
