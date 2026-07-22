/*
 * Presentation-only grouping of the engine's allocation receipt.
 *
 * The engine emits one row per (category, card): when a cap fills and overflow
 * routes to a second card, one category legitimately appears twice. That's
 * correct engine output but noisy to read, so the UI shows one summary row per
 * category and hides the per-card split behind an expander.
 *
 * Nothing here recomputes value — sums are straight additions of what the
 * engine already returned, so a group's total always equals its parts.
 */

import type { AedRange, CategoryAllocation, SpendCategory } from "@fils/engine";

export interface AllocationGroup {
  spendCategory: SpendCategory;
  /** Total monthly spend routed to this category, across all cards. */
  monthlySpendAed: number;
  /** Summed annual AED earned across all cards for this category. */
  annualValueAed: AedRange;
  /** The engine's per-card instructions, in engine order. Length ≥ 1. */
  parts: CategoryAllocation[];
}

/**
 * Group allocations by spend category, preserving the engine's ordering:
 * categories appear in first-seen order (the engine sorts by its own category
 * order), and each group's parts stay in the engine's card order.
 */
export function groupAllocationsByCategory(
  allocations: readonly CategoryAllocation[],
): AllocationGroup[] {
  const groups = new Map<SpendCategory, AllocationGroup>();

  for (const a of allocations) {
    const existing = groups.get(a.spendCategory);
    if (!existing) {
      groups.set(a.spendCategory, {
        spendCategory: a.spendCategory,
        monthlySpendAed: a.monthlySpendAed,
        annualValueAed: { min: a.annualValueAed.min, max: a.annualValueAed.max },
        parts: [a],
      });
    } else {
      existing.monthlySpendAed += a.monthlySpendAed;
      existing.annualValueAed.min += a.annualValueAed.min;
      existing.annualValueAed.max += a.annualValueAed.max;
      existing.parts.push(a);
    }
  }

  return [...groups.values()];
}
