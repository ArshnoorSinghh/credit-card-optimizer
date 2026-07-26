import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Accessibility,
  Building2,
  MessageSquare,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { Footer } from "@/components/footer";
import { SUGGESTIONS_EMAIL } from "@/lib/legal";

/*
  /contact — the channels are described, the addresses are blank.

  This page used to list four working addresses (general, privacy, complaints,
  accessibility), a postal address at a registered office, and response-time
  commitments. None of it was real: the addresses were on a domain Fils does not
  use, no mail provider is wired up, there is no registered office because there
  is no incorporated entity, and nobody had committed to answering anything in
  two business days.

  why the cards stay: describing what each channel is *for* costs nothing and
  commits to nothing — it is the same reason the empty headings stay in
  lib/legal.ts. What was removed is the part that made a promise: the address
  itself and the turnaround time. When a monitored inbox exists, the address slot
  is the only thing that needs filling.

  Do not add a contact form until something is wired up to receive it: a form
  that silently drops what you typed is worse than no form.
*/

export const metadata: Metadata = {
  title: "Contact — Fils",
  description:
    "What you'd reach us about, where Fils can't help, and why there's no inbox yet.",
};

/* An `href` means the channel is live; without one it renders as an open gap.
   Only feedback has somewhere to go — see SUGGESTIONS_EMAIL in lib/legal.ts. */
const CHANNELS = [
  {
    icon: MessageSquare,
    title: "Feedback and suggestions",
    body: "A recommendation that looked wrong, a card whose terms we've modelled badly, something broken, or an idea for what to build next.",
    href: "/suggestions",
    cta: "Go to suggestions",
  },
  {
    icon: Accessibility,
    title: "Accessibility barriers",
    body: "Hit something you couldn't use with a screen reader or a keyboard? We treat accessibility reports as bugs, not feature requests, so they go to the same place.",
    href: "/suggestions",
    cta: "Report a barrier",
  },
  {
    icon: ShieldCheck,
    title: "Your data",
    body: "Access, correction, erasure, or withdrawing consent. There is no data protection contact yet, because there is no entity to be the controller.",
  },
  {
    icon: Scale,
    title: "Complaints",
    body: "If something has gone wrong. Note that complaints about a card or a bank go to the issuer rather than to us — see below.",
  },
];

export default function ContactPage() {
  return (
    <main className="relative">
      {/* ---------------- INTRO ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pb-20 md:pt-24">
        <Reveal className="max-w-3xl">
          <Badge tone="brand">
            <MessageSquare className="h-3.5 w-3.5" />
            Contact
          </Badge>
          <h1 className="mt-6 text-5xl font-semibold text-balance md:text-7xl">
            One inbox, <span className="text-gradient">for feedback.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Fils is a prototype, so there&apos;s no support team — but there is somewhere to
            send what we got wrong, and it&apos;s read. The channels a real company would
            have are listed below with their addresses left blank, because publishing one
            nobody monitors is just a slower way of ignoring you.
          </p>
        </Reveal>
      </section>

      {/* ---------------- CHANNELS ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-24 md:pb-32">
        <Stagger className="grid gap-5 md:grid-cols-2">
          {CHANNELS.map((c) => (
            <StaggerItem key={c.title}>
              <Card className="flex h-full flex-col p-8">
                <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-flame/30 bg-flame/10 text-clay">
                  <c.icon className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold text-fg">{c.title}</h2>
                <p className="mt-3 flex-1 text-muted">{c.body}</p>
                {/* The address only appears on channels that actually reach it.
                    Repeating it under "Your data" or "Complaints" would imply a
                    data-protection contact and a complaints process that don't
                    exist — the empty state is the honest answer there. */}
                {c.href ? (
                  <div className="mt-6 flex flex-col items-start gap-3">
                    <Link
                      href={c.href}
                      className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-black/[0.04]"
                    >
                      {c.cta}
                      <ArrowRight className="h-3.5 w-3.5 text-clay" aria-hidden />
                    </Link>
                    {/* why text-muted and not text-clay: at 14px clay measures
                        4.23:1 on this canvas, under the AA floor. */}
                    <a
                      href={`mailto:${SUGGESTIONS_EMAIL}`}
                      className="text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-flame"
                    >
                      {SUGGESTIONS_EMAIL}
                    </a>
                  </div>
                ) : (
                  <p className="mt-6 text-sm italic text-faint">No address yet.</p>
                )}
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---------------- WHAT WE CAN'T HELP WITH ---------------- */}
      <section className="border-y border-line bg-bg-soft/60">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2 md:py-28">
          <Reveal>
            <span className="text-sm font-medium uppercase tracking-widest text-clay">
              Before you write
            </span>
            <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
              Some things we genuinely can&apos;t do
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-4 text-muted">
            <p>
              Fils isn&apos;t a bank and isn&apos;t a credit broker, so we can&apos;t check an
              application&apos;s status, change a limit, dispute a transaction, chase a missing
              reward, or tell you whether you&apos;ll be approved. Those decisions sit with the
              issuing bank, against its own criteria and your credit bureau record.
            </p>
            <p>
              If your complaint is about a card, a fee, or something an issuer did, raise it
              with that bank first — and escalate to Sanadak, the UAE&apos;s ombudsman unit for
              the financial sector, if their answer doesn&apos;t satisfy you.
            </p>
            <p>
              What we <em>can</em> fix is our own modelling. If a rate, cap or fee we show
              disagrees with what the issuer publishes, that&apos;s a bug in our dataset.
            </p>
            <Link
              href="/legal/disclaimer"
              className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-clay transition-colors hover:text-flame"
            >
              Read the Financial Disclaimer
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---------------- POSTAL ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <Reveal className="mx-auto max-w-2xl">
          <Card className="p-8">
            <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-line bg-surface-2 text-clay">
              <Building2 className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-semibold text-fg">By post</h2>
            {/* why blank rather than deleted: the same rule as the legal pages —
                an absent address shows the gap, a removed section hides it. */}
            <p className="mt-3 text-muted">
              There is no registered office, because there is no incorporated entity to
              register one. Nothing can be served on Fils by post.
            </p>
          </Card>
        </Reveal>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-24 md:pb-28">
        <Reveal>
          <div className="ring-gradient relative overflow-hidden rounded-[var(--radius-xl)] bg-surface px-8 py-16 text-center md:py-20">
            <Aurora className="opacity-70" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-semibold md:text-5xl">
                Or just try it and tell us what breaks
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
                The fastest useful message is one sent after you&apos;ve seen your own numbers.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/onboarding">
                  <Button size="lg">
                    Try the demo
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button variant="outline" size="lg">
                    About Fils
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
