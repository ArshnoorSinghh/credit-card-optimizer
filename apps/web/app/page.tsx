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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { CreditCardArt } from "@/components/credit-card-art";
import { Footer } from "@/components/footer";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const STATS = [
  { value: "51", label: "UAE cards modelled" },
  { value: "12", label: "banks covered" },
  { value: "22k+", label: "portfolios searched" },
  { value: "2", label: "optimization engines" },
];

const STEPS = [
  {
    icon: Wallet,
    title: "Tell us how you spend",
    body: "A minute of sliders — groceries, dining, fuel, travel, salary. No account needed to try it.",
  },
  {
    icon: Calculator,
    title: "We search every combination",
    body: "The engine scores 22,000+ one-, two-, and three-card portfolios against your exact spend and caps.",
  },
  {
    icon: TrendingUp,
    title: "See your best cards",
    body: "Get the portfolio that nets you the most — with which card to swipe for which category, fees included.",
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Card Optimizer",
    body: "The best 1, 2, or 3-card mix for your life — net of every annual fee and reward cap. Not the flashiest card, the most profitable one.",
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
    body: "When a reward rate is ambiguous, we show a range and flag it — never a confident fabricated number.",
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
        <Aurora />
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
              Stop leaving
              <br />
              money on the <span className="text-gradient">table.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.16 }}
              className="mt-6 max-w-md text-lg text-muted"
            >
              Fils models your spending across every UAE credit card and tells you the exact
              portfolio that earns you the most — then how to spend the points you already have.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.24 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link href="/onboarding">
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

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-6 text-sm text-faint"
            >
              51 cards · 12 banks · no card details required
            </motion.p>
          </div>

          {/* Floating card stack */}
          <div className="relative mx-auto w-full max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -6 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
              className="absolute inset-x-6 top-10"
            >
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
                <CreditCardArt
                  bank="Emirates NBD"
                  name="Skywards Signature"
                  tier="Signature"
                  network="Visa"
                  highlight="1.5 miles / AED"
                  gradient="from-indigo via-violet to-sky"
                />
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 60, rotate: 5 }}
              animate={{ opacity: 1, y: 0, rotate: 5 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
              className="relative z-10"
            >
              <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
                <CreditCardArt
                  bank="Mashreq"
                  name="Cashback Card"
                  tier="Platinum"
                  network="Mastercard"
                  highlight="Up to 5% back"
                  gradient="from-sky via-indigo to-violet"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-y border-line bg-bg-soft/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4">
            {STATS.map((s) => (
              <Reveal key={s.label} className="text-center">
                <p className="text-3xl font-semibold text-fg md:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge tone="brand">How it works</Badge>
          <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
            From guesswork to your best wallet in three steps
          </h2>
        </Reveal>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <StaggerItem key={step.title}>
              <Card hover className="h-full">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[0.8rem] bg-brand text-white">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-faint">Step {i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-muted">{step.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---------------- FEATURES (bento) ---------------- */}
      <section className="relative overflow-hidden bg-bg-soft/50">
        <Aurora className="opacity-60" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Reveal className="max-w-2xl">
            <Badge tone="brand">Two engines, one wallet</Badge>
            <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
              Quantitative modeling, in plain language
            </h2>
            <p className="mt-4 text-lg text-muted">
              Under the hood: constrained combinatorial optimization and expected-value modeling.
              On the surface: just tell it how you spend.
            </p>
          </Reveal>

          <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <StaggerItem key={f.title} className={f.span}>
                <Card glow hover className="h-full">
                  <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-line bg-surface-2 text-violet">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{f.title}</h3>
                  <p className="mt-3 text-muted">{f.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------- SOCIAL PROOF ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-violet">
            Trusted by smart spenders
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold md:text-4xl">
            <span className="text-gradient">8,400+</span> UAE residents have found their best cards
          </h2>
        </Reveal>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            {
              quote:
                "I was carrying two cards that overlapped completely. Fils found a combo that adds ~AED 3,100 a year for me.",
              name: "Layla H.",
              role: "Dubai Marina",
            },
            {
              quote:
                "The points optimizer told me my Skywards miles were about to devalue. Burned them just in time.",
              name: "Omar R.",
              role: "Abu Dhabi",
            },
            {
              quote:
                "Finally a tool that shows the math instead of pushing whatever card pays the biggest referral.",
              name: "Priya S.",
              role: "Sharjah",
            },
          ].map((t) => (
            <StaggerItem key={t.name}>
              <Card className="h-full">
                <p className="text-lg leading-relaxed text-fg">“{t.quote}”</p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{t.name}</p>
                    <p className="text-xs text-faint">{t.role}</p>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
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
                <Link href="/onboarding">
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
