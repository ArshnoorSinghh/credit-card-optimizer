"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Store } from "lucide-react";
import {
  PRIMARY_QUESTION_COUNT,
  SHARE_BUCKETS,
  SHARE_QUESTIONS,
  answeredCount,
  describeCategories,
  type ShareAnswers,
} from "@/lib/merchant-shares";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/*
  MerchantSharePicker — the question that unlocks the co-brand cards.

  Fourteen UAE cards pay their headline rate only at one retailer (LuLu, Emaar
  malls, noon, Emirates…). Without an answer the engine assumes every dirham of the
  matching category is spent there, which OVERSTATES those cards — it flags the
  assumption, but it still scores and can still recommend them.

  So the copy below has to be honest about the cost of skipping: unanswered is not
  neutral, it is optimistic. Nothing is pre-selected, because a pre-selected bucket
  would be us inventing the answer, which is the thing this exists to stop.
*/

export function MerchantSharePicker({
  answers,
  onChange,
}: {
  answers: ShareAnswers;
  onChange: (next: ShareAnswers) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const primary = SHARE_QUESTIONS.slice(0, PRIMARY_QUESTION_COUNT);
  const rest = SHARE_QUESTIONS.slice(PRIMARY_QUESTION_COUNT);
  const shown = expanded ? SHARE_QUESTIONS : primary;
  const answered = answeredCount(answers);

  function pick(merchant: string, bucketId: string) {
    const next = { ...answers };
    if (next[merchant] === bucketId) {
      delete next[merchant]; // tapping the chosen bucket again clears the answer
    } else {
      next[merchant] = bucketId as ShareAnswers[string];
    }
    onChange(next);
  }

  return (
    <div>
      <div className="space-y-3">
        {shown.map((q) => {
          const chosen = answers[q.merchant];
          return (
            <div
              key={q.merchant}
              className="rounded-[var(--radius-md)] border border-line bg-surface p-3.5"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                  <Store className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">
                    How much of your {describeCategories(q.categories)} spend goes to {q.merchant}?
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    Affects {q.cardCount} card{q.cardCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {SHARE_BUCKETS.map((b) => {
                  const active = chosen === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pick(q.merchant, b.id)}
                      aria-pressed={active}
                      title={b.hint}
                      className={cn(
                        "rounded-[var(--radius-sm)] border px-2 py-2 text-sm transition-colors",
                        active
                          ? "border-flame/50 bg-flame/[0.09] font-medium text-fg"
                          : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg",
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>

              {/* Say what we did with the answer, in the number the engine uses. */}
              <AnimatePresence initial={false}>
                {chosen && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden text-xs text-faint"
                  >
                    <span className="mt-2 block">
                      We&apos;ll count {SHARE_BUCKETS.find((b) => b.id === chosen)!.hint} at{" "}
                      {q.merchant}. The rest earns your cards&apos; normal rates.
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-clay transition-colors hover:text-fg"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Show fewer" : `${rest.length} more retailer${rest.length === 1 ? "" : "s"}`}
        </button>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-faint">
        <Badge tone="neutral">
          {answered}/{SHARE_QUESTIONS.length}
        </Badge>
        Optional — but skipping one means we assume <em>all</em> of that spending happens
        there, which flatters those cards. We&apos;ll say so on the estimate.
      </p>
    </div>
  );
}
