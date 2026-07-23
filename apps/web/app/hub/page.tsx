"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Layers, Coins, Search, CreditCard, Bot, ArrowRight } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";

/*
  Hub. The considered home screen shown after sign in and to guests who start the
  demo. Instead of dropping people straight into the card optimizer, it lets them
  pick their own path. The card optimizer is visually primary because it is the
  flagship, but nothing is forced.
*/

const PATHS = [
  {
    icon: Coins,
    title: "See what my points are worth",
    body: "Enter the miles and points you already hold. We value them by how you would actually redeem them, and warn you before they expire.",
    href: "/points",
    cta: "Open Points Optimizer",
  },
  {
    icon: Search,
    title: "Which card should I use?",
    body: "Name a purchase or a merchant and we tell you which of your cards earns the most on it. Every figure comes from the engine.",
    href: "/ask?for=purchase",
    cta: "Ask about a purchase",
  },
  {
    icon: CreditCard,
    title: "Browse every UAE card",
    body: "Search and filter all the cards we model, then open any one for its full rate, cap and fee breakdown.",
    href: "/cards",
    cta: "Browse all cards",
  },
  {
    icon: Bot,
    title: "Ask Rafiq",
    body: "A plain language assistant for anything above. It only answers with numbers from the engine, never made up ones.",
    href: "/ask",
    cta: "Chat with Rafiq",
  },
];

export default function HubPage() {
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

        {/* Primary: the flagship card optimizer. */}
        <Reveal delay={0.05} className="mt-10">
          <Link href="/onboarding" className="group block">
            <Card
              glow
              hover
              className="flex flex-col gap-6 bg-gradient-to-br from-surface to-flame/[0.06] p-8 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-5">
                <span className="inline-grid h-14 w-14 shrink-0 place-items-center rounded-[0.9rem] bg-flame text-white shadow-glow">
                  <Layers className="h-7 w-7" />
                </span>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold">Find my best card combination</h2>
                    <Badge tone="brand">Most popular</Badge>
                  </div>
                  <p className="mt-2 max-w-xl text-muted">
                    Tell us how you spend and we search every 1, 2, and 3-card combination, respect
                    every monthly and annual cap, subtract the annual fees, and show you the mix that
                    nets you the most.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-transform group-hover:translate-x-0.5 sm:self-center">
                Start
                <ArrowRight className="h-4 w-4" />
              </span>
            </Card>
          </Link>
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
