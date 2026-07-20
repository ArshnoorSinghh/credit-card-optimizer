"use client";

import type { SpendCategory } from "@fils/engine";
import { CATEGORY_META } from "@/lib/optimizer";
import { aed } from "@/lib/format";

/*
  SpendSlider — one category's monthly-spend control. Gradient-filled track that
  fills toward the thumb. Shared by onboarding and the live optimizer so the
  input feels identical everywhere (design-system consistency rule).
*/

export function SpendSlider({
  category,
  value,
  onChange,
}: {
  category: SpendCategory;
  value: number;
  onChange: (v: number) => void;
}) {
  const meta = CATEGORY_META[category];
  const pct = Math.min(100, (value / meta.max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-fg">{meta.label}</span>
          <span className="hidden text-xs text-faint sm:inline">{meta.hint}</span>
        </div>
        <span className="text-sm tabular-nums text-fg">{aed(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={meta.max}
        step={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={meta.label}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-flame)]"
        style={{
          background: `linear-gradient(90deg, var(--color-sun) 0%, var(--color-flame) ${pct}%, var(--color-surface-2) ${pct}%)`,
        }}
      />
    </div>
  );
}
