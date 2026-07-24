"use client";

import { Wallet, TriangleAlert } from "lucide-react";
import type { Portfolio } from "@fils/engine";
import { Badge } from "@/components/ui/badge";
import { CountTo } from "@/components/count-to";
import { aed, aedRange } from "@/lib/format";

/*
  BaselineBanner — the "before" anchor. Shows what the user's CURRENT cards net
  per year on their spend, so the reveal's optimized number has something to beat.

  Honesty rule (CLAUDE.md): if the baseline estimate is uncertain (a flagged rate
  or soft valuation), we show the RANGE and a warning — never a false-precision
  point figure. Certain estimates collapse to a single tweened number.
*/

export function BaselineBanner({ baseline }: { baseline: Portfolio | null }) {
  if (!baseline) return null;

  const { min, max } = baseline.netAnnualValueRange;
  const uncertain = baseline.uncertain && max - min > 0.5;

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface-2 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.8rem] bg-surface text-clay">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-muted">Your current cards earn you</p>
          {uncertain ? (
            <p className="mt-0.5 font-display text-3xl font-semibold text-fg tabular-nums">
              {aedRange(min, max)}
              <span className="ml-1 text-base font-normal text-muted">/yr</span>
            </p>
          ) : (
            <p className="mt-0.5 flex items-baseline gap-1">
              <CountTo
                value={baseline.netAnnualValue}
                format={aed}
                className="font-display text-3xl font-semibold text-fg"
              />
              <span className="text-base text-muted">/yr</span>
            </p>
          )}
        </div>
      </div>

      {uncertain && (
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          One of your cards has a reward rate we can&apos;t pin down exactly, so this is a
          range. <Badge tone="warning" className="ml-1 align-middle">estimate</Badge>
        </p>
      )}
    </div>
  );
}
