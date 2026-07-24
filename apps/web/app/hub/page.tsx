"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Layers, Coins, CreditCard, Bot, ArrowRight, Wallet, TrendingUp } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { useProfileStore } from "@/lib/profile-store";
import { runOptimizeOver } from "@/lib/optimizer";
import { cardById } from "@/lib/cards";
import { aed } from "@/lib/format";

/*
  Hub. The landing home for everyone, signed in or not. It never redirects; the
  dashboard is one option among several. For a signed-in user the dashboard tile is
  the flagship and previews what their current cards earn, so there is a reason to
  open it. For a guest it invites sign-in instead of hiding.
*/

// Non-dashboard paths, shown to everyone.
const PATHS = [
  {
    icon: Layers,
    title: "Find my best card combination",
    body: "Search every 1, 2, and 3-card combination for how you spend, net of every fee and cap.",
    href: "/onboarding",
    cta: "Open the optimizer",
  },
  {
    icon: Coins,
    title: "See what my points are worth",
    body: "Value the miles and points you hold by how you would actually redeem them, and get expiry warnings.",
    href: "/points",
    cta: "Open Points Optimizer",
  },
  {
    icon: Bot,
    title: "Ask Rafiq",
    body: "Which card to use for a purchase, a comparison, or a card's benefits. Every number comes from the engine.",
    href: "/ask",
    cta: "Chat with Rafiq",
  },
  {
    icon: CreditCard,
    title: "Browse every UAE card",
    body: "Search and filter all the cards we model, then open any one for its full rate, cap and fee breakdown.",
    href: "/cards",
    cta: "Browse all cards",
  },
];

export default function HubPage() {
  const { state, ready, signedIn } = useProfileStore();

  const owned = useMemo(
    () => state.cardIds.map((id) => cardById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [state.cardIds],
  );
  const currentNet = useMemo(() => {
    const r = runOptimizeOver(state.spending, state.profile, owned);
    return r?.overallBest?.netAnnualValue ?? null;
  }, [owned, state.spending, state.profile]);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-5xl px-5 py-14">
        <Reveal>
          <Badge tone="brand">Home</Badge>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Where would you like to start?</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Pick your path. You can switch between them at any time, and nothing here needs an
            account to try.
          </p>
        </Reveal>

        {/* Flagship tile: the personalized dashboard for signed-in users, a sign-in
            invitation for guests. */}
        <Reveal delay={0.05} className="mt-10">
          {signedIn ? (
            <Link href="/dashboard" className="group block">
              <Card
                glow
                hover
                className="flex flex-col gap-6 bg-gradient-to-br from-surface to-flame/[0.06] p-8 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-5">
                  <span className="inline-grid h-14 w-14 shrink-0 place-items-center rounded-[0.9rem] bg-flame text-white shadow-glow">
                    <Wallet className="h-7 w-7" />
                  </span>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-semibold">My dashboard</h2>
                      <Badge tone="brand">Your view</Badge>
                    </div>
                    <p className="mt-2 max-w-xl text-muted">
                      {ready && owned.length > 0 && currentNet !== null ? (
                        <>
                          Your current cards earn about{" "}
                          <span className="font-semibold text-clay">{aed(currentNet)}</span> a year. See
                          the full breakdown and how much more the best setup would earn.
                        </>
                      ) : (
                        <>Add the cards you hold and your spending to see what your wallet earns.</>
                      )}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-transform group-hover:translate-x-0.5 sm:self-center">
                  {ready && owned.length > 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4" />
                      Open
                    </>
                  ) : (
                    <>Set up</>
                  )}
                </span>
              </Card>
            </Link>
          ) : (
            <Link href="/sign-in" className="group block">
              <Card
                hover
                className="flex flex-col gap-6 bg-gradient-to-br from-surface to-flame/[0.05] p-8 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-5">
                  <span className="inline-grid h-14 w-14 shrink-0 place-items-center rounded-[0.9rem] border border-line bg-surface-2 text-clay">
                    <Wallet className="h-7 w-7" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold">My dashboard</h2>
                    <p className="mt-2 max-w-xl text-muted">
                      Sign in to save your cards and spending, then see what your wallet earns and how
                      much more the best setup would, every time you visit.
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-line px-5 py-2.5 text-sm font-medium text-fg transition-colors group-hover:border-line-strong sm:self-center">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Card>
            </Link>
          )}
        </Reveal>

        {/* The other paths. */}
        <Stagger className="mt-5 grid gap-5 md:grid-cols-2">
          {PATHS.map((p) => (
            <StaggerItem key={p.href}>
              <Link href={p.href} className="group block h-full">
                <Card hover className="flex h-full flex-col">
                  <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-line bg-surface-2 text-clay">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{p.title}</h3>
                  <p className="mt-2 flex-1 text-muted">{p.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-clay transition-colors group-hover:text-flame">
                    {p.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </main>
  );
}
