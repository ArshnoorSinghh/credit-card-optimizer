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
import {
  ENTITY,
  REGISTERED_OFFICE,
  CONTACT_EMAIL,
  PRIVACY_EMAIL,
  COMPLAINTS_EMAIL,
} from "@/lib/legal";

/*
  /contact — how to reach a human.

  why no contact form: a form needs somewhere to post. There is no transactional
  mail provider wired up, and a form that silently drops what you typed is worse
  than no form at all — so this page routes to real mailto: addresses instead.
  When an inbox/provider exists, a form belongs here, posting to an API route.

  Addresses and entity details are imported from lib/legal so this page states
  exactly what the Terms, Privacy Policy and Complaints Policy state.
*/

export const metadata: Metadata = {
  title: "Contact — Fils",
  description:
    "How to reach Fils — general questions, data protection requests, complaints and accessibility reports.",
};

const CHANNELS = [
  {
    icon: MessageSquare,
    title: "General questions",
    email: CONTACT_EMAIL,
    body: "Feedback on a recommendation, a card whose terms we've modelled wrong, press, partnerships, or anything that doesn't fit the boxes below.",
    meta: "Usually answered within 2 business days",
  },
  {
    icon: ShieldCheck,
    title: "Your data",
    email: PRIVACY_EMAIL,
    body: "Access, correction, erasure, portability, or withdrawing consent. Reaches our data protection contact directly.",
    meta: "Rights requests handled under the DIFC Data Protection Law",
  },
  {
    icon: Scale,
    title: "Complaints",
    email: COMPLAINTS_EMAIL,
    body: "If something has gone wrong, tell us what happened, when, and what you'd like us to do. Include the email you registered with if it concerns your account.",
    meta: "Acknowledged within 5 business days · resolved within 30 days",
  },
  {
    icon: Accessibility,
    title: "Accessibility barriers",
    email: CONTACT_EMAIL,
    body: "Hit something you couldn't use with a screen reader or a keyboard? Describe what happened — we treat accessibility reports as bugs, not feature requests.",
    meta: "Targeting WCAG 2.2 level AA",
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
            Talk to <span className="text-gradient">a human.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Every message goes to a real inbox and gets a real reply. Pick the address that
            fits — it routes your message to whoever can actually resolve it, which is faster
            than a single catch-all.
          </p>
        </Reveal>
      </section>

      {/* ---------------- CHANNELS ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-24 md:pb-32">
        <Stagger className="grid gap-5 md:grid-cols-2">
          {CHANNELS.map((c) => (
            <StaggerItem key={c.title}>
              <Card hover className="flex h-full flex-col p-8">
                <span className="mb-5 inline-grid h-11 w-11 place-items-center rounded-[0.8rem] border border-flame/30 bg-flame/10 text-clay">
                  <c.icon className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold text-fg">{c.title}</h2>
                <p className="mt-3 flex-1 text-muted">{c.body}</p>
                <a
                  href={`mailto:${c.email}`}
                  className="mt-6 inline-flex items-center gap-2 self-start rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-black/[0.04]"
                >
                  {c.email}
                  <ArrowRight className="h-3.5 w-3.5 text-clay" aria-hidden />
                </a>
                <p className="mt-4 text-xs text-faint">{c.meta}</p>
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
              disagrees with what the issuer publishes, send it over — that&apos;s a bug in our
              dataset and we want it.
            </p>
            <Link
              href="/legal/complaints"
              className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-clay transition-colors hover:text-flame"
            >
              Read the full Complaints Policy
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
            <p className="mt-3 text-muted">
              Email reaches us far faster, but formal notices can be sent to the registered
              office:
            </p>
            <address className="mt-5 not-italic text-fg">
              <span className="block font-medium">{ENTITY}</span>
              {REGISTERED_OFFICE.map((line) => (
                <span key={line} className="block text-muted">
                  {line}
                </span>
              ))}
            </address>
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
