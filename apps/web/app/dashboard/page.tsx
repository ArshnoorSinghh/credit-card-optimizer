"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Show } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Coins, CreditCard, ArrowRight, Sparkles } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AiEntry } from "@/components/ai-entry";
import { useStoredProfile } from "@/lib/profile-store";
import { runOptimize } from "@/lib/optimizer";
import { ALL_CARDS, cardsByBank } from "@/lib/cards";
import { aed } from "@/lib/format";

const NAME = new Map(ALL_CARDS.map((c) => [c.id, c.name]));

export default function DashboardPage() {
  const [stored, ready] = useStoredProfile();
  const result = useMemo(
    () => (ready ? runOptimize(stored.spending, stored.profile) : null),
    [ready, stored],
  );
  const best = result?.overallBest ?? null;
  const savedCards = stored.bank ? cardsByBank(stored.bank).slice(0, 3) : ALL_CARDS.slice(0, 3);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-5xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="brand">My Wallet</Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Your dashboard</h1>
          </div>
          <Show when="signed-out">
            <Link href="/sign-in">
              <Button variant="outline" size="sm">
                Sign in to save
              </Button>
            </Link>
          </Show>
        </div>

        <Show when="signed-out">
          <Card className="mt-8 border-dashed">
            <p className="text-muted">
              You&apos;re viewing a <span className="text-fg">demo wallet</span>. Sign in to save your
              spending profile, cards, and points across visits.
            </p>
          </Card>
        </Show>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 grid gap-5 md:grid-cols-2"
        >
          {/* Recommended portfolio */}
          <Card glow className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Badge tone="brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  Recommended for you
                </Badge>
                <h3 className="mt-3 text-xl font-semibold">
                  {best ? best.cardIds.map((id) => NAME.get(id) ?? id).join(" + ") : "Run the optimizer"}
                </h3>
                {best && (
                  <p className="mt-1 text-muted">
                    Nets you <span className="font-semibold text-clay">{aed(best.netAnnualValue)}</span> / year.
                  </p>
                )}
              </div>
              <Link href="/results">
                <Button size="sm">
                  View details
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Saved cards */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-clay" />
              <h3 className="text-lg font-semibold">Saved cards</h3>
            </div>
            <ul className="space-y-2">
              {savedCards.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/cards/${c.id}`}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface-2/40 px-3 py-2.5 text-sm transition-colors hover:border-line-strong"
                  >
                    <span className="font-medium text-fg">{c.name}</span>
                    <span className="text-faint">{c.bank}</span>
                  </Link>
                </li>
              ))}
            </ul>
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
        </motion.div>
      </div>
      <AiEntry />
    </main>
  );
}
