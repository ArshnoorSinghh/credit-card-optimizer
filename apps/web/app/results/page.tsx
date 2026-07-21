"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Coins, Bot, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { PortfolioResults } from "@/components/portfolio-results";
import { useStoredProfile } from "@/lib/profile-store";
import { runOptimize } from "@/lib/optimizer";

export default function ResultsPage() {
  const [stored, ready] = useStoredProfile();

  const result = useMemo(
    () => (ready ? runOptimize(stored.spending, stored.profile) : null),
    [ready, stored],
  );

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-50" />
      <div className="relative mx-auto max-w-4xl px-5 py-12">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="brand">Card Optimizer</Badge>
              <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Your best cards</h1>
              <p className="mt-3 text-muted">
                {stored.bank ? `Focused on ${stored.bank} and beyond — ` : ""}
                the portfolios that net you the most for how you actually spend.
              </p>
            </div>
            <Link href="/onboarding">
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4" />
                Edit spending
              </Button>
            </Link>
          </div>
        </Reveal>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 20 }}
          transition={{ duration: 0.5 }}
          className="mt-10"
        >
          {ready ? (
            <PortfolioResults result={result} />
          ) : (
            <Card className="animate-pulse text-muted">Crunching 22,000+ portfolios…</Card>
          )}
        </motion.div>

        {/* Next steps: Points Optimizer + AI bot placeholder */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <Card hover glow>
            <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-line bg-surface-2 text-clay">
              <Coins className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-semibold">Points Optimizer</h3>
            <p className="mt-2 text-muted">
              Already holding miles or points? See what they&apos;re worth and when to burn them.
            </p>
            <Link href="/points" className="mt-5 inline-block">
              <Button variant="solid" size="sm">
                Open Points Optimizer
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>

          {/* AI bot entry point — placeholder space for Arshnoor to wire later */}
          <Card className="border-dashed">
            <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-line bg-surface-2 text-faint">
              <Bot className="h-5 w-5" />
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-muted">Ask Fils AI</h3>
              <Badge tone="neutral">Coming soon</Badge>
            </div>
            <p className="mt-2 text-muted">
              A chat assistant that explains your recommendation and answers card questions. Entry
              point reserved — wiring lands after the frontend.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
