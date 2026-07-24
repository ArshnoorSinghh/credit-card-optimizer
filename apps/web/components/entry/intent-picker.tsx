"use client";

import { Layers, Coins, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Stagger, StaggerItem } from "@/components/ui/reveal";
import { cn } from "@/lib/cn";

/*
  IntentPicker — the first thing the user sees. Pick a goal; it sets the flow's
  direction without navigating anywhere. "cards" and "gap" both run the card
  optimizer (gap just leads with the current-earnings anchor); "points" hands off
  to the Points optimizer.
*/

export type Intent = "cards" | "gap" | "points";

const OPTIONS: {
  intent: Intent;
  icon: typeof Layers;
  title: string;
  body: string;
}[] = [
  {
    intent: "gap",
    icon: TrendingUp,
    title: "See what I'm leaving on the table",
    body: "Tell us your cards, and we'll show what they earn today — then the setup that earns more.",
  },
  {
    intent: "cards",
    icon: Layers,
    title: "Find my best card setup",
    body: "The best 1, 2, or 3-card mix for how you actually spend, net of every fee and cap.",
  },
  {
    intent: "points",
    icon: Coins,
    title: "Optimize the points I already have",
    body: "Model your miles and points — what they're really worth and when to burn them.",
  },
];

export function IntentPicker({ onSelect }: { onSelect: (intent: Intent) => void }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">What are you here to do?</h1>
      <p className="mt-3 max-w-md text-muted">
        Pick a starting point. You can explore the rest once you&apos;re in.
      </p>

      <Stagger className="mt-8 space-y-3">
        {OPTIONS.map((o) => (
          <StaggerItem key={o.intent}>
            <motion.button
              type="button"
              onClick={() => onSelect(o.intent)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "group flex w-full items-center gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5 text-left shadow-card",
                "transition-colors hover:border-line-strong hover:shadow-lift",
              )}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.9rem] bg-flame/10 text-clay transition-colors group-hover:bg-flame group-hover:text-white">
                <o.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-fg">{o.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{o.body}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-clay" />
            </motion.button>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
