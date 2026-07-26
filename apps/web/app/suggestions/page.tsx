import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bug, Lightbulb, MessageSquare, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { Footer } from "@/components/footer";
import { SuggestionForm } from "@/components/suggestion-form";

/*
  /suggestions — the one place on the site that accepts input from a reader.

  why this exists when /contact says there is no inbox: there is now exactly one
  monitored address (see SUGGESTIONS_EMAIL in lib/legal.ts). It is a temporary
  Gmail for prototype feedback, not a support desk, and this page is scoped to
  match — it asks for modelling errors and bugs, and routes everything a
  prototype genuinely cannot handle back to /contact.

  Server component so it can export metadata; the composer is the only client
  piece.
*/

export const metadata: Metadata = {
  title: "Suggestions — Fils",
  description:
    "Tell us what Fils got wrong. Modelling errors, bugs, and ideas for what to build next.",
};

const WANTED = [
  {
    icon: Table2,
    title: "A rate or fee that's wrong",
    body: "The most valuable thing you can send. If a rate, cap or annual fee we show disagrees with what the bank publishes, that's a bug in our dataset — and one we can fix the same day.",
  },
  {
    icon: Bug,
    title: "Something broken",
    body: "A page that won't load, a number that renders as NaN, a control you couldn't reach with a keyboard. Tell us what you were doing when it happened.",
  },
  {
    icon: MessageSquare,
    title: "A result that made no sense",
    body: "If the model recommended something that felt obviously wrong for how you spend, we want to know. Either our modelling is off or our explanation is, and both are worth fixing.",
  },
  {
    icon: Lightbulb,
    title: "What we should build next",
    body: "A card we haven't covered, a category that doesn't match how you actually spend, a question the optimizer can't answer yet.",
  },
];

export default function SuggestionsPage() {
  return (
    <main className="relative">
      {/* ---------------- INTRO ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pb-20 md:pt-24">
        <Reveal className="max-w-3xl">
          <Badge tone="brand">
            <Lightbulb className="h-3.5 w-3.5" />
            Suggestions
          </Badge>
          <h1 className="mt-6 text-5xl font-semibold text-balance md:text-7xl">
            Tell us what we <span className="text-gradient">got wrong.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Fils is early, and the fastest way it gets better is someone finding the number
            that doesn&apos;t match reality. There&apos;s no support team behind this — it&apos;s
            a prototype and a small inbox — but everything sent here is read.
          </p>
        </Reveal>
      </section>

      {/* ---------------- WHAT'S USEFUL ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20 md:pb-24">
        <Stagger className="grid gap-5 md:grid-cols-2">
          {WANTED.map((w) => (
            <StaggerItem key={w.title}>
              <Card className="flex h-full flex-col p-8">
                <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-flame/30 bg-flame/10 text-clay">
                  <w.icon className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold text-fg">{w.title}</h2>
                <p className="mt-3 text-muted">{w.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---------------- THE FORM ---------------- */}
      <section className="border-y border-line bg-bg-soft/60">
        <div className="mx-auto max-w-2xl px-5 py-24 md:py-28">
          <Reveal>
            <h2 className="text-3xl font-semibold md:text-4xl">Send it over</h2>
            <p className="mt-4 text-muted">
              Fill this in and it opens a draft in your own email app, already addressed and
              filled out. We don&apos;t store anything you type here.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <Card className="p-8">
              <SuggestionForm />
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ---------------- WHAT WE CAN'T DO ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-28">
        <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-[1fr_1.3fr]">
          <Reveal>
            <span className="text-sm font-medium uppercase tracking-widest text-clay">
              One thing first
            </span>
            <h2 className="mt-5 text-3xl font-semibold">This isn&apos;t support</h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-4 text-muted">
            <p>
              Fils isn&apos;t a bank or a credit broker, so anything about a real card — an
              application, a limit, a disputed transaction, a reward that never arrived — has
              to go to the bank that issued it. We have no visibility into your account and
              no way to act on it.
            </p>
            <p>
              What we can act on is our own modelling, and that&apos;s what this page is for.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-clay transition-colors hover:text-flame"
            >
              Where those complaints actually go
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
