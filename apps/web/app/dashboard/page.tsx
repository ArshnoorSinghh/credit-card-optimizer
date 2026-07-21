"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Show } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Coins, CreditCard, ArrowRight, Sparkles, X } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AiEntry } from "@/components/ai-entry";
import { useStoredProfile, saveOwnedCards } from "@/lib/profile-store";
import { runOptimize } from "@/lib/optimizer";
import { ALL_CARDS } from "@/lib/cards";
import { aed } from "@/lib/format";

const NAME = new Map(ALL_CARDS.map((c) => [c.id, c.name]));
const BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));

export default function DashboardPage() {
  const [stored, ready] = useStoredProfile();
  const result = useMemo(
    () => (ready ? runOptimize(stored.spending, stored.profile) : null),
    [ready, stored],
  );
  const best = result?.overallBest ?? null;

  // The cards the user actually told us they hold. This used to be the first
  // three cards of their chosen bank, which looked like a wallet but was
  // fabricated — nobody had ever been asked which cards they own.
  //
  // Held in local state, not read straight from `stored`, because removing a
  // card has to re-render immediately; useStoredProfile only snapshots on mount.
  const [myCardIds, setMyCardIds] = useState<string[]>([]);
  useEffect(() => {
    if (ready) setMyCardIds(stored.ownedCardIds);
  }, [ready, stored.ownedCardIds]);

  function removeCard(id: string) {
    const next = myCardIds.filter((x) => x !== id);
    setMyCardIds(next);
    saveOwnedCards(next);
  }

  const myCards = useMemo(
    () => myCardIds.map((id) => BY_ID.get(id)).filter((c) => c !== undefined),
    [myCardIds],
  );

  // Recommended cards the user already holds — so the recommendation reads
  // "keep this" rather than "go get this".
  const ownedIds = useMemo(() => new Set(myCardIds), [myCardIds]);
  const alreadyHeld = best?.cardIds.filter((id) => ownedIds.has(id)) ?? [];

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
                {/* why: presentation only — the optimizer is not told what you
                    own, so this cannot change the ranking. Preferring cards a
                    user already holds is a modelling decision and belongs to the
                    engine's owner, not to this screen. */}
                {alreadyHeld.length > 0 && (
                  <p className="mt-1 text-sm text-faint">
                    You already hold {alreadyHeld.length} of these —{" "}
                    {alreadyHeld.map((id) => NAME.get(id) ?? id).join(", ")}.
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

          {/* Cards you already hold */}
          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-clay" />
                <h3 className="text-lg font-semibold">Cards you have</h3>
              </div>
              {myCards.length > 0 && (
                <Link
                  href="/onboarding"
                  className="text-sm text-muted transition-colors hover:text-fg"
                >
                  Edit
                </Link>
              )}
            </div>

            {myCards.length === 0 ? (
              <div>
                <p className="text-sm text-muted">
                  You haven&apos;t told us which cards you carry yet. Add them and we&apos;ll
                  show what you already hold against what we&apos;d recommend.
                </p>
                <Link href="/onboarding" className="mt-4 inline-block">
                  <Button variant="solid" size="sm">
                    Add your cards
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <>
              <ul className="space-y-2">
                {myCards.map((c) => (
                  // why: the remove control is a SIBLING of the link, not inside
                  // it — a button nested in an anchor is invalid HTML, and the
                  // click would navigate as well as remove.
                  <li
                    key={c.id}
                    className="flex items-stretch gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2/40 transition-colors hover:border-line-strong"
                  >
                    <Link
                      href={`/cards/${c.id}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="truncate font-medium text-fg">{c.name}</span>
                      <span className="shrink-0 text-faint">{c.bank}</span>
                    </Link>
                    <button
                      onClick={() => removeCard(c.id)}
                      aria-label={`Remove ${c.name} from your cards`}
                      title="Remove"
                      className="grid w-9 shrink-0 place-items-center rounded-r-[var(--radius-md)] text-faint transition-colors hover:bg-black/[0.04] hover:text-danger"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-faint">
                Removing a card here only updates your wallet — it doesn&apos;t affect the
                recommendation.
              </p>
              </>
            )}
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
