import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  Compass,
  Layers,
  Coins,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { Footer } from "@/components/footer";
import { CARD_COUNT, BANK_COUNT, PORTFOLIO_COUNT_ROUNDED } from "@/lib/marketing-stats";

/*
  /about — the company page.

  Marketing surface, so it gets the full golden-hour treatment (Reveal/Stagger,
  the dusk band, an Aurora CTA) — but NOT <BurjSunrise>, which the design brief
  reserves for the landing hero and auth screens.

  Every factual claim here is sourced, not written fresh: card/bank counts come
  from lib/marketing-stats (asserted against the real dataset in a test), and
  the entity details come from lib/legal so this page and the Terms cannot drift
  apart.

  why: a server component even though it's visually the busiest page here — the
  animation all lives inside Reveal/Stagger/Card, which are already client
  components, so the page itself needs no hooks and can export metadata.
*/

export const metadata: Metadata = {
  title: "About — Fils",
  description:
    "Why Fils exists, how the two optimization engines work, and the commitments behind every recommendation.",
};

const PRINCIPLES = [
  {
    icon: ScanSearch,
    title: "We show our working",
    body: "Every recommendation expands into a receipt: the rate applied, the cap that bound, the AED earned per category, the fee subtracted. If you can't audit a number, you shouldn't trust it.",
  },
  {
    icon: ShieldCheck,
    title: "We say when we don't know",
    body: "UAE issuers publish reward terms inconsistently. When a rate can't be parsed with confidence we flag it and carry a range through the model — rather than inventing a precise figure that looks authoritative and isn't.",
  },
  {
    icon: Compass,
    title: "Nobody pays for a ranking",
    body: "No bank pays us to feature, rank or recommend a card. The order you see is the order the model produced. If that ever changes, the commission gets disclosed on the page, not in a footnote.",
  },
  {
    icon: Building2,
    title: "We never ask for card details",
    body: "No card numbers, no CVVs, no banking logins, no Emirates ID, no credit-bureau pull. Fils runs on spending figures you type in yourself, and that is deliberately all it needs.",
  },
];

const ENGINES = [
  {
    icon: Layers,
    title: "Card Optimizer",
    body: `A constrained combinatorial search over every subset of one, two and three cards — roughly ${PORTFOLIO_COUNT_ROUNDED} portfolios — scored on net expected value: rewards earned minus annual fees, with each card's reward caps and eligibility rules enforced rather than assumed away.`,
  },
  {
    icon: Coins,
    title: "Points & Redemption Optimizer",
    body: "Models the points you already hold: what a currency is actually worth in the scenario you'd redeem it, which redemption returns the most per point, and what is close enough to expiry that burning it now beats holding.",
  },
];

export default function AboutPage() {
  return (
    <main className="relative">
      {/* ---------------- INTRO ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:pb-28 md:pt-24">
        <Reveal className="max-w-3xl">
          <Badge tone="brand">
            <Building2 className="h-3.5 w-3.5" />
            About Fils
          </Badge>
          <h1 className="mt-6 text-5xl font-semibold text-balance md:text-7xl">
            Built to answer one <span className="text-gradient">stubborn question.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Which UAE credit cards should you actually carry? It sounds simple. It isn&apos;t
            — the answer depends on how you spend, which caps you hit, what the annual fees
            claw back, and how {CARD_COUNT} cards across {BANK_COUNT} banks interact when you
            hold two or three of them at once.
          </p>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Comparison sites answer it with a leaderboard. We answer it with a model.
          </p>
        </Reveal>
      </section>

      {/* ---------------- THE PROBLEM ---------------- */}
      <section className="border-y border-line bg-bg-soft/60">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2 md:py-32">
          <Reveal>
            <span className="text-sm font-medium uppercase tracking-widest text-clay">
              Why we exist
            </span>
            <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
              A leaderboard can&apos;t know how you spend
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-4 text-muted">
            <p>
              &ldquo;Best cashback card in the UAE&rdquo; is a question with no single answer.
              A card paying 10% on dining is worthless if you cook, and a AED 1,500 annual fee
              is either a bargain or a loss depending entirely on the spend behind it.
            </p>
            <p>
              The genuinely hard part is that the best <em>single</em> card is rarely part of
              the best <em>pair</em>. Cards overlap: two strong grocery cards mostly duplicate
              each other, while a mediocre one with a category nobody else covers can be worth
              more in combination. You cannot see that by reading a list — it only falls out
              of searching the combinations.
            </p>
            <p>
              So that&apos;s what Fils does. You describe your spending once; the engine scores
              every portfolio it could build for you and returns the one that nets the most,
              along with which card to reach for in which category.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- ENGINES (dusk band) ---------------- */}
      <section className="relative overflow-hidden bg-dusk text-on-dusk">
        <div className="pointer-events-none absolute -top-24 left-[6%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(244,166,58,0.4),transparent_65%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Reveal className="max-w-2xl">
            <span className="text-sm font-medium uppercase tracking-widest text-sun">
              Under the hood
            </span>
            <h2 className="mt-5 text-3xl font-semibold md:text-5xl">Two engines</h2>
            <p className="mt-4 text-lg text-on-dusk-muted">
              Both are pure, deterministic TypeScript with no network calls and no hidden
              state — the same inputs always produce the same answer, which is the only way a
              recommendation about money is worth auditing.
            </p>
          </Reveal>

          <Stagger className="mt-14 grid gap-5 md:grid-cols-2">
            {ENGINES.map((e) => (
              <StaggerItem key={e.title}>
                <div className="h-full rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.06] p-8 backdrop-blur-sm">
                  <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] bg-flame text-white shadow-glow">
                    <e.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{e.title}</h3>
                  <p className="mt-3 text-on-dusk-faint">{e.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------- PRINCIPLES ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal className="max-w-2xl">
          <span className="text-sm font-medium uppercase tracking-widest text-clay">
            How we work
          </span>
          <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
            Four commitments we&apos;d rather be held to
          </h2>
        </Reveal>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <StaggerItem key={p.title}>
              <Card hover className="h-full p-8">
                <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-flame/30 bg-flame/10 text-clay">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-semibold text-fg">{p.title}</h3>
                <p className="mt-3 text-muted">{p.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---------------- WHAT FILS IS ---------------- */}
      {/* why no entity details here: Fils is not incorporated. There is no
          operating entity, licence number or registered office to state, and a
          plausible-looking one would be a fabrication. What replaces it is the
          true version of the same disclosure. */}
      <section className="border-t border-line bg-bg-soft/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1fr_1.2fr] md:py-24">
          <Reveal>
            <span className="text-sm font-medium uppercase tracking-widest text-clay">
              Where we are
            </span>
            <h2 className="mt-5 text-3xl font-semibold">Early, and honest about it</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="p-8">
              {/* why the values are em-dashes: Fils is not incorporated, so there is
                  no entity name, licence number or registered office to state. The
                  rows stay because an absent field shows the gap, where a removed
                  one hides it — and an empty value asserts nothing. The sr-only
                  text is because a screen reader announces a bare dash as nothing. */}
              <dl className="space-y-5 text-sm">
                {[
                  { term: "Operating entity", note: "none; Fils is not incorporated" },
                  { term: "Trade licence", note: "none held" },
                  { term: "Registered office", note: "none" },
                ].map(({ term, note }) => (
                  <div key={term}>
                    <dt className="text-faint">{term}</dt>
                    <dd className="mt-1 text-faint" aria-hidden>
                      —
                    </dd>
                    <dd className="sr-only">{note}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 border-t border-line pt-5 text-muted">
                Fils is a working prototype, not a company. It isn&apos;t incorporated, holds
                no trade licence, and is not licensed or regulated by the Central Bank of the
                UAE or any other financial regulator.
              </p>
              <p className="mt-4 text-muted">
                It is an information and modelling tool, not a bank or a credit broker. It
                doesn&apos;t issue cards, arrange credit, or submit applications for you. What
                it does do is model published card terms against spending figures you type in
                yourself, and show its working.
              </p>
              <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
                The{" "}
                <Link href="/legal/disclaimer" className="text-clay hover:text-flame">
                  Financial Disclaimer
                </Link>{" "}
                sets out the full position, including what the numbers are and are not.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-28">
        <Reveal>
          <div className="ring-gradient relative overflow-hidden rounded-[var(--radius-xl)] bg-surface px-8 py-16 text-center md:py-20">
            <Aurora className="opacity-70" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-semibold md:text-5xl">
                See what the model says about your wallet
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
                A minute of sliders, no account, no card details. Or tell us what you think
                we&apos;ve got wrong — we read everything.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/onboarding">
                  <Button size="lg">
                    Try the demo
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" size="lg">
                    <MessageSquare className="h-4 w-4" />
                    Get in touch
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
