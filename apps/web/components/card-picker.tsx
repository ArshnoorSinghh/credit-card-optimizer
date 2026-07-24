"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, X, CreditCard } from "lucide-react";
import { ALL_CARDS, BANKS, cardsByBank } from "@/lib/cards";
import { aed } from "@/lib/format";
import { cn } from "@/lib/cn";

/*
  CardPicker — pick a bank, tick the cards you hold, pick another bank, add more. A
  running list of everything selected sits alongside so multi-bank wallets are
  obvious, and each selected card can be removed. Fully controlled: selection lives
  in the parent (onboarding step or dashboard wallet), so the same component persists
  to sessionStorage or Postgres without knowing which.
*/

const NAME = new Map(ALL_CARDS.map((c) => [c.id, c.name]));
const BANK = new Map(ALL_CARDS.map((c) => [c.id, c.bank]));

export function CardPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [activeBank, setActiveBank] = useState<string>(BANKS[0] ?? "");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const bankCards = useMemo(() => (activeBank ? cardsByBank(activeBank) : []), [activeBank]);
  const selectedInBank = bankCards.filter((c) => selectedSet.has(c.id)).length;

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="space-y-6">
      {/* Bank selector */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Pick a bank</h4>
        <div className="flex flex-wrap gap-2">
          {BANKS.map((b) => {
            const count = cardsByBank(b).filter((c) => selectedSet.has(c.id)).length;
            const active = b === activeBank;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setActiveBank(b)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "border-flame/60 bg-flame/10 text-fg"
                    : "border-line bg-surface-2/50 text-muted hover:border-line-strong hover:text-fg",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                {b}
                {count > 0 && (
                  <span className="rounded-full bg-flame px-1.5 text-xs font-semibold text-white">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards for the active bank */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
          {activeBank} cards{selectedInBank > 0 ? ` · ${selectedInBank} selected` : ""}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {bankCards.map((c) => {
            const on = selectedSet.has(c.id);
            const fee = c.fees.annual_fee_aed;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-all",
                  on
                    ? "border-flame/60 bg-flame/[0.07]"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors",
                    on ? "border-flame bg-flame text-white" : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                  <span className="block text-xs text-faint">
                    {fee > 0 ? `${aed(fee)}/yr fee` : "No annual fee"} · {c.rewards.type}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Running list of everything selected, across banks */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-faint">
          <CreditCard className="h-4 w-4" />
          Your cards ({selected.length})
        </h4>
        {selected.length === 0 ? (
          <p className="text-sm text-muted">
            None selected yet. Tick the cards you hold above. You can skip this if you have none.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {selected.map((id) => (
                <motion.span
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1.5 text-sm"
                >
                  <span className="font-medium text-fg">{NAME.get(id) ?? id}</span>
                  <span className="text-faint">{BANK.get(id)}</span>
                  <button
                    type="button"
                    onClick={() => onChange(selected.filter((x) => x !== id))}
                    aria-label={`Remove ${NAME.get(id) ?? id}`}
                    className="rounded-full p-1 text-faint transition-colors hover:bg-black/[0.06] hover:text-danger"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
