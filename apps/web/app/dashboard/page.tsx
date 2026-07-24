"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  CreditCard,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Search,
  Layers,
  Bot,
  Wallet as WalletIcon,
  Pencil,
  TrendingUp,
} from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AiEntry } from "@/components/ai-entry";
import { CardPicker } from "@/components/card-picker";
import { useProfileStore } from "@/lib/profile-store";
import { runOptimize, runOptimizeOver, CATEGORIES, CATEGORY_META } from "@/lib/optimizer";
import { ALL_CARDS, cardById } from "@/lib/cards";
import { groupAllocationsByCategory } from "@/lib/allocation-groups";
import { aed, aedRange } from "@/lib/format";

const NAME = new Map(ALL_CARDS.map((c) => [c.id, c.name]));
const BANK = new Map(ALL_CARDS.map((c) => [c.id, c.bank]));

const SHORTCUTS = [
  { icon: Layers, label: "Card optimizer", href: "/optimizer" },
  { icon: Coins, label: "Points optimizer", href: "/points" },
  { icon: Search, label: "Which card to use", href: "/ask?for=purchase" },
  { icon: CreditCard, label: "Browse cards", href: "/cards" },
  { icon: Bot, label: "Ask Rafiq", href: "/ask" },
];

export default function DashboardPage() {
  const { state, ready, signedIn, save } = useProfileStore();
  const [editingCards, setEditingCards] = useState(false);

  const owned = useMemo(
    () => state.cardIds.map((id) => cardById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [state.cardIds],
  );

  const current = useMemo(
    () => runOptimizeOver(state.spending, state.profile, owned),
    [owned, state.spending, state.profile],
  );
  const best = useMemo(() => runOptimize(state.spending, state.profile), [state.spending, state.profile]);

  const currentNet = current?.overallBest?.netAnnualValue ?? 0;
  const bestNet = best?.overallBest?.netAnnualValue ?? 0;
  const gap = Math.max(0, Math.round(bestNet - currentNet));
  const bestSize = best?.overallBest?.size ?? 0;

  const currentBreakdown = current?.overallBest
    ? groupAllocationsByCategory(current.overallBest.allocations)
    : [];

  const hasCards = owned.length > 0;
  const needsSpending = signedIn && ready && !state.onboarded;

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-5xl px-5 py-12">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="brand">
              <WalletIcon className="h-3.5 w-3.5" />
              My dashboard
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Your wallet, working for you</h1>
          </div>
          {!signedIn && ready && (
            <Link href="/sign-in">
              <Button variant="outline" size="sm">
                Sign in to save
              </Button>
            </Link>
          )}
        </div>

        {!signedIn && ready && (
          <Card className="mt-8 border-dashed">
            <p className="text-muted">
              You&apos;re viewing a <span className="text-fg">demo wallet</span>. Sign in to save your
              cards and spending across visits.
            </p>
          </Card>
        )}

        {/* Finish-setup prompt when a signed-in user hasn't set spending yet. */}
        {needsSpending && (
          <Card glow className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Finish setting up</h3>
              <p className="mt-1 text-muted">
                Tell us how you spend and we&apos;ll show what your cards earn and what you&apos;re
                leaving on the table.
              </p>
            </div>
            <Link href="/onboarding" className="shrink-0">
              <Button size="sm">
                Set your spending
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 grid gap-5 md:grid-cols-2"
        >
          {/* Earnings comparison — the headline */}
          <Card glow className="md:col-span-2">
            {hasCards ? (
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <Badge tone="brand">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Your earnings
                  </Badge>
                  <p className="mt-4 max-w-xl text-lg leading-relaxed text-fg">
                    Your current cards earn{" "}
                    <span className="font-semibold text-clay">{aed(currentNet)}</span> a year. The best{" "}
                    {bestSize}-card setup for your spending earns{" "}
                    <span className="font-semibold text-clay">{aed(bestNet)}</span>
                    {gap > 0 ? (
                      <>
                        , a difference of <span className="font-semibold text-flame">{aed(gap)}</span> per
                        year.
                      </>
                    ) : (
                      <>. You&apos;re already at the best setup for your spending.</>
                    )}
                  </p>
                </div>
                <Link href="/results" className="shrink-0">
                  <Button size="sm">
                    View full result
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Add the cards you hold</h3>
                  <p className="mt-1 max-w-lg text-muted">
                    Once we know your wallet, we&apos;ll show what it earns today and how much more the
                    best setup would earn.
                  </p>
                </div>
                <Button size="sm" onClick={() => setEditingCards(true)}>
                  Add cards
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>

          {/* Current earnings by category */}
          {hasCards && currentBreakdown.length > 0 && (
            <Card className="md:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-clay" />
                <h3 className="text-lg font-semibold">What your cards earn, by category</h3>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line">
                {currentBreakdown.map((g) => (
                  <div
                    key={g.spendCategory}
                    className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-fg">
                      {CATEGORY_META[g.spendCategory]?.label ?? g.spendCategory}
                    </span>
                    <span className="text-muted">
                      <span className="tabular-nums">{aed(g.monthlySpendAed)}</span>/mo
                    </span>
                    <span className="text-right tabular-nums font-medium text-fg">
                      {aedRange(g.annualValueAed.min, g.annualValueAed.max)}/yr
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Wallet: the held cards, with add/remove */}
          <Card className="md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-clay" />
                <h3 className="text-lg font-semibold">Your cards ({owned.length})</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingCards((v) => !v)}>
                <Pencil className="h-4 w-4" />
                {editingCards ? "Done" : "Add or remove"}
              </Button>
            </div>

            {!editingCards &&
              (hasCards ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {owned.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/cards/${c.id}`}
                        className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface-2/40 px-3 py-2.5 text-sm transition-colors hover:border-line-strong"
                      >
                        <span className="font-medium text-fg">{NAME.get(c.id) ?? c.name}</span>
                        <span className="text-faint">{BANK.get(c.id) ?? c.bank}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  No cards saved yet. Use &ldquo;Add or remove&rdquo; to build your wallet.
                </p>
              ))}

            {editingCards && (
              <div className="mt-2">
                <CardPicker selected={state.cardIds} onChange={(ids) => save({ cardIds: ids })} />
              </div>
            )}
          </Card>

          {/* Profile: spending + salary */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-clay" />
                <h3 className="text-lg font-semibold">Your profile</h3>
              </div>
              <Link href="/onboarding">
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </Link>
            </div>
            <dl className="space-y-1.5 text-sm">
              {CATEGORIES.filter((c) => (state.spending[c] ?? 0) > 0).map((c) => (
                <div key={c} className="flex items-center justify-between">
                  <dt className="text-muted">{CATEGORY_META[c]?.label ?? c}</dt>
                  <dd className="tabular-nums text-fg">{aed(state.spending[c])}/mo</dd>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <dt className="text-muted">Monthly salary</dt>
                <dd className="tabular-nums font-medium text-fg">{aed(state.profile.monthlySalaryAed)}</dd>
              </div>
            </dl>
          </Card>

          {/* Points snapshot */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Coins className="h-5 w-5 text-clay" />
              <h3 className="text-lg font-semibold">Points</h3>
            </div>
            <p className="text-sm text-muted">
              Track miles and points, see their real value, and get burn warnings before they expire.
            </p>
            <Link href="/points" className="mt-4 inline-block">
              <Button variant="solid" size="sm">
                Open Points Optimizer
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>

          {/* Shortcuts */}
          <Card className="md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-clay" />
              <h3 className="text-lg font-semibold">Jump to</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {SHORTCUTS.map((s) => (
                <Link
                  key={s.href + s.label}
                  href={s.href}
                  className="group flex flex-col items-start gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2/40 p-3 transition-colors hover:border-line-strong"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[0.7rem] border border-line bg-surface text-clay transition-colors group-hover:text-flame">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-fg">{s.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
      <AiEntry />
    </main>
  );
}
