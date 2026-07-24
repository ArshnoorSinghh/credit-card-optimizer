"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Check, X, CreditCard } from "lucide-react";
import { ALL_CARDS } from "@/lib/cards";
import { MAX_HELD_CARDS } from "@/lib/baseline";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/*
  HeldCardsPicker — searchable multi-select over the real card dataset, capped at
  MAX_HELD_CARDS. The cap is a hard product constraint: the baseline is scored via
  the engine's 1/2/3-card API, and it also matches how many cards people actually
  carry. Selected cards drive the "what you already earn" anchor.
*/

const NAME = new Map(ALL_CARDS.map((c) => [c.id, c.name]));
const BANK = new Map(ALL_CARDS.map((c) => [c.id, c.bank]));

export function HeldCardsPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const atCap = selected.length >= MAX_HELD_CARDS;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = ALL_CARDS.filter((c) => !c.excluded_from_scoring);
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((c) => `${c.name} ${c.bank}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (!atCap) {
      onChange([...selected, id]);
    }
  }

  return (
    <div>
      {/* Selected chips */}
      <AnimatePresence initial={false}>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex flex-wrap gap-2 overflow-hidden"
          >
            {selected.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-flame/30 bg-flame/10 py-1.5 pl-3 pr-1.5 text-sm"
              >
                <span className="font-medium text-fg">{NAME.get(id) ?? id}</span>
                <span className="text-faint">{BANK.get(id)}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${NAME.get(id) ?? id}`}
                  className="grid h-5 w-5 place-items-center rounded-full text-clay transition-colors hover:bg-black/[0.06]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={atCap ? `Up to ${MAX_HELD_CARDS} cards selected` : "Search your bank or card…"}
          disabled={atCap}
          className="w-full rounded-[var(--radius-md)] border border-line bg-surface-2 py-3 pl-10 pr-4 text-fg outline-none transition-colors placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-flame/40 disabled:opacity-60"
        />
      </div>

      {/* Results */}
      <div className="mt-3 space-y-1.5">
        {matches.length === 0 ? (
          <p className="px-1 py-4 text-sm text-faint">No cards match “{query}”.</p>
        ) : (
          matches.map((c) => {
            const isSelected = selected.includes(c.id);
            const disabled = atCap && !isSelected;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-left text-sm transition-colors",
                  isSelected
                    ? "border-flame/50 bg-flame/[0.07]"
                    : "border-line bg-surface hover:border-line-strong hover:bg-black/[0.02]",
                  disabled && "cursor-not-allowed opacity-40 hover:border-line hover:bg-surface",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    isSelected ? "bg-flame text-white" : "bg-surface-2 text-muted",
                  )}
                >
                  {isSelected ? <Check className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{c.name}</span>
                  <span className="block truncate text-xs text-faint">
                    {c.bank}
                    {c.tier ? ` · ${c.tier}` : ""}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-faint">
        <Badge tone="neutral">
          {selected.length}/{MAX_HELD_CARDS}
        </Badge>
        Don&apos;t hold any yet? Skip — we&apos;ll just show you the best setup.
      </p>
    </div>
  );
}
