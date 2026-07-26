"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Layers,
  Coins,
  ShieldCheck,
  Calculator,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Aurora } from "@/components/aurora";
import { BurjSunrise } from "@/components/burj-sunrise";
import { HeroCards } from "@/components/hero-cards";
import { BankMarquee } from "@/components/bank-marquee";
import { CountUp } from "@/components/count-up";
import { StickySteps } from "@/components/sticky-steps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { Footer } from "@/components/footer";
import {
  CARD_COUNT,
  BANK_COUNT,
  PORTFOLIO_COUNT_K,
  PORTFOLIO_COUNT_ROUNDED,
} from "@/lib/marketing-stats";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// why: sourced from lib/marketing-stats, which is asserted against the real card
// dataset in a test. Hardcoding these inline is how they went stale last time.
const STATS = [
  { value: CARD_COUNT, suffix: "", label: "UAE cards modelled" },
  { value: BANK_COUNT, suffix: "", label: "banks covered" },
  { value: PORTFOLIO_COUNT_K, suffix: "k+", label: "portfolios searched" },
  { value: 2, suffix: "", label: "optimization engines" },
];

const STEPS = [
  {
    icon: Wallet,
    title: "Tell us how you spend",
    body: "A minute of sliders: groceries, dining, fuel, travel, salary. No account needed to try it.",
  },
  {
    icon: Calculator,
    title: "We search every combination",
    body: `The engine scores every 1, 2, and 3-card portfolio (over ${PORTFOLIO_COUNT_ROUNDED} of them) against your exact spend, and respects every monthly and annual cap.`,
  },
  {
    icon: TrendingUp,
    title: "See your best cards",
    body: "Get the portfolio that nets you the most, with which card to swipe for which category, and every annual fee already subtracted.",
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Card Optimizer",
    body: "The best 1, 2, or 3-card mix for your life, net of every annual fee and reward cap. Not the flashiest card, the most profitable one.",
    span: "md:col-span-2",
  },
  {
    icon: Coins,
    title: "Points Optimizer",
    body: "Model the points you already hold. See what they're truly worth, the best way to burn them, and what's about to expire.",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Honest about uncertainty",
    body: "When a reward rate is ambiguous, we show a range and flag it. Never a confident fabricated number.",
    span: "",
  },
  {
    icon: Calculator,
    title: "Show the math",
    body: "Every recommendation expands into a full receipt: rate applied, caps hit, AED earned per category. No black box.",
    span: "md:col-span-2",
  },
];

export default function LandingPage() {
  return (
    <main className="relative">
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        <BurjSunrise />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-16 md:grid-cols-2 md:pb-32 md:pt-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <Badge tone="brand">
                <Sparkles className="h-3.5 w-3.5" />
                UAE credit-card intelligence
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
              className="mt-6 text-5xl font-semibold leading-[1.02] md:text-7xl"
            >
              The right cards for
              <br />
              the way you <span className="text-gradient">actually spend</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.16 }}
              className="mt-6 max-w-md text-lg text-muted"
            >
              Fils models your spending across every UAE credit card and tells you the exact
              portfolio that earns you the most, then how to spend the points you already have.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              // why this sits above the buttons: it is the last thing a reader
              // needs before deciding, and the "no card details" half answers the
              // objection that stops people clicking. Underneath the CTAs it was
              // a footnote to a decision already made.
              transition={{ duration: 0.8, delay: 0.24 }}
              // why text-fg: this line was text-faint (4.64:1), then text-muted
              // (5.84:1) — legible, but it reads as body copy. Warm ink is
              // 14.19:1 and unmistakably deliberate.
              //
              // why not text-clay, the system's accent *text* colour: measured
              // against the canvas it is 4.23:1, under the 4.5:1 AA floor for
              // 14px. It clears the bar only at heading sizes, which is where the
              // design brief's eyebrows use it. Carrying the golden hour here is
              // the separators' job instead — they are decorative, so a warm
              // accent on them costs no legibility.
              className="mt-6 text-sm font-medium text-fg"
            >
              {/* why {" "} and not the mx-1.5 this used to rely on: a margin puts
                  visual space between the words but leaves the TEXT joined, so the
                  line copy-pasted as "53 cards·12 banks·no card details required"
                  and a screen reader ran the words together — the separators are
                  aria-hidden, so nothing stood between them. Real spaces fix both,
                  and the margin is no longer needed to fake them. */}
              {CARD_COUNT} cards{" "}
              <span className="text-clay" aria-hidden>
                ·
              </span>{" "}
              {BANK_COUNT} banks{" "}
              <span className="text-clay" aria-hidden>
                ·
              </span>{" "}
              no card details required
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.32 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link href="/hub">
                <Button size="lg">
                  Try the demo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="outline" size="lg">
                  Sign up free
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Floating card fan — 3D tilt + scroll parallax */}
          <HeroCards />
        </div>

      </section>

      {/* ---------------- BANK TICKER ---------------- */}
      <BankMarquee />

      {/* ---------------- STATS ---------------- */}
      <div className="relative border-b border-line bg-bg-soft/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-12 md:grid-cols-4">
          {STATS.map((s) => (
            <Reveal key={s.label} className="text-center">
              <CountUp
                value={s.value}
                suffix={s.suffix}
                className="font-display text-4xl font-semibold text-fg md:text-5xl"
              />
              <p className="mt-1 text-sm text-muted">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ---------------- HOW IT WORKS (pinned scroll sequence) ---------------- */}
      <div id="how" className="scroll-mt-20">
        <StickySteps steps={STEPS} />
      </div>

      {/* ---------------- FEATURES (bold dusk band) ---------------- */}
      <section id="features" className="relative scroll-mt-20 overflow-hidden bg-dusk text-on-dusk">
        {/* a low sun still glowing at the horizon of the dark band */}
        <div className="pointer-events-none absolute -top-24 right-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(244,166,58,0.4),transparent_65%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Reveal className="max-w-2xl">
            <span className="text-sm font-medium uppercase tracking-widest text-sun">
              Two engines, one wallet
            </span>
            <h2 className="mt-5 text-3xl font-semibold md:text-5xl">
              Quantitative modeling, in plain language
            </h2>
            <p className="mt-4 text-lg text-on-dusk-muted">
              Under the hood: constrained combinatorial optimization and expected-value modeling.
              On the surface: just tell it how you spend.
            </p>
          </Reveal>

          <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <StaggerItem key={f.title} className={f.span}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="h-full rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm transition-colors hover:border-white/20"
                >
                  <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] bg-flame text-white shadow-glow">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{f.title}</h3>
                  <p className="mt-3 text-on-dusk-faint">{f.body}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------- WHAT WE STAND ON ---------------- */}
      {/*
        why there are no testimonials here: this section used to carry three
        quotes attributed to named people in named emirates, one of them citing a
        specific AED figure. Nobody said them. An "illustrative examples" caption
        does not cure an invented testimonial — it still renders as a person with
        an avatar and a location — and under Federal Law No. 15 of 2020 that is
        consumer-protection exposure no disclaimer reaches. Fils has no users to
        quote yet. What it does have is a method, so that is what this says.
      */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-clay">
            Built for smart spenders
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold md:text-4xl">
            Every recommendation is <span className="text-fg">modelled, not marketed</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            No bank pays to be ranked here. Every number expands into a receipt: the rate
            applied, the cap that bound, the fee subtracted. Where an issuer&apos;s published
            terms are ambiguous, we show a range and say so rather than inventing a figure
            that looks authoritative.
          </p>
        </Reveal>
      </section>

      {/* ---------------- CTA BAND ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <div className="ring-gradient relative overflow-hidden rounded-[var(--radius-xl)] bg-surface px-8 py-16 text-center md:py-20">
            <Aurora className="opacity-70" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-semibold md:text-5xl">
                Your best wallet is one minute away
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
                No card details. No spam. Just the numbers on which UAE cards actually pay you back.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/hub">
                  <Button size="lg">
                    Try the demo
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button variant="outline" size="lg">
                    Create free account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
}
