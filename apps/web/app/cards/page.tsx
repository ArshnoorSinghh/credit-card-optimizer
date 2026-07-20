"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CreditCardArt } from "@/components/credit-card-art";
import { ALL_CARDS, BANKS, REWARD_TYPES } from "@/lib/cards";
import { aed, label } from "@/lib/format";
import { cn } from "@/lib/cn";

type FeeFilter = "all" | "free" | "paid";

export default function CardBrowserPage() {
  const [q, setQ] = useState("");
  const [bank, setBank] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [fee, setFee] = useState<FeeFilter>("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ALL_CARDS.filter((c) => {
      if (bank !== "all" && c.bank !== bank) return false;
      if (type !== "all" && c.rewards.type !== type) return false;
      if (fee === "free" && c.fees.annual_fee_aed > 0) return false;
      if (fee === "paid" && c.fees.annual_fee_aed === 0) return false;
      if (query && !`${c.name} ${c.bank} ${c.tier}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [q, bank, type, fee]);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-6xl px-5 py-12">
        <Badge tone="brand">Card browser</Badge>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Every UAE card, in one place</h1>
        <p className="mt-3 text-muted">
          {ALL_CARDS.length} cards across {BANKS.length} banks. Filter, then open one for the full
          breakdown.
        </p>

        {/* Filters */}
        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search cards…"
              className="w-full rounded-full border border-line bg-surface-2 py-3 pl-11 pr-4 text-sm text-fg outline-none transition-colors focus:border-line-strong focus:ring-2 focus:ring-flame/40"
            />
          </div>
          <Select value={bank} onChange={setBank} options={[["all", "All banks"], ...BANKS.map((b) => [b, b] as [string, string])]} />
          <Select
            value={type}
            onChange={setType}
            options={[["all", "All rewards"], ...REWARD_TYPES.map((t) => [t, label(t)] as [string, string])]}
          />
          <div className="inline-flex rounded-full border border-line bg-surface p-1">
            {(["all", "free", "paid"] as FeeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFee(f)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors",
                  fee === f ? "bg-brand text-white" : "text-muted hover:text-fg",
                )}
              >
                {f === "all" ? "All fees" : f}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-sm text-faint">
          {filtered.length} card{filtered.length === 1 ? "" : "s"}
        </p>

        {/* Grid */}
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link href={`/cards/${c.id}`}>
                <Card hover className="h-full">
                  <CreditCardArt
                    bank={c.bank}
                    name={c.name}
                    tier={c.tier}
                    network={c.network}
                    currency={c.rewards.currency}
                    highlight={c.rewards.base_rate.length < 22 ? c.rewards.base_rate : undefined}
                    className="mb-5"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="neutral">{label(c.rewards.type)}</Badge>
                    <span className="text-sm text-muted">
                      {c.fees.annual_fee_aed === 0 ? (
                        <span className="text-success">Free for life</span>
                      ) : (
                        `${aed(c.fees.annual_fee_aed)}/yr`
                      )}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted line-clamp-2">
                    Earns {c.rewards.currency}. Min salary {aed(c.eligibility.min_monthly_salary_aed)}.
                  </p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <Card className="mt-6 text-center text-muted">No cards match those filters.</Card>
        )}
      </div>
    </main>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-line bg-surface-2 px-4 py-3 text-sm text-fg outline-none transition-colors focus:border-line-strong focus:ring-2 focus:ring-flame/40"
    >
      {options.map(([v, lbl]) => (
        <option key={v} value={v} className="bg-surface text-fg">
          {lbl}
        </option>
      ))}
    </select>
  );
}
