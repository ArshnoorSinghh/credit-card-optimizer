import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

/*
  Chrome shared by every /legal page.

  Two jobs beyond layout:

  1. DraftBanner — states on the page itself that these documents are unreviewed
     drafts. This lives in the product rather than only in a commit message
     because the failure mode we're guarding against is someone (a user, an
     investor, a future teammate) reading a polished legal page and reasonably
     assuming a lawyer wrote it. Do not remove it until counsel has signed off.

  2. Placeholders — legal drafts are full of details only the company can supply
     (entity name, licence number, retention period). Written as [CAPS IN
     BRACKETS] and rendered highlighted, so an unfilled one is visible at a
     glance instead of shipping as plausible-looking prose.

  These are working screens, so per the design brief: no BurjSunrise, calm warm
  neutrals, prose capped at max-w-2xl.
*/

// why: split() keeps the captured delimiter, so each placeholder arrives as its
// own part. Detection below is startsWith/endsWith rather than .test() — this
// regex carries the /g flag, and .test() on a global regex advances lastIndex
// between calls, so testing each part in a loop returns alternating results.
const PLACEHOLDER = /(\[[^\]]+\])/g;

/** Splits text on [BRACKETED] placeholders and marks them. */
export function Prose({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[") && part.endsWith("]") ? (
          <mark
            key={i}
            className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function DraftBanner() {
  return (
    <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/10 p-5">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold text-fg">Unreviewed draft — not in force</p>
          <p className="mt-1.5 text-muted">
            This document was drafted as a starting point and has{" "}
            <strong className="font-semibold text-fg">not</strong> been reviewed by a
            UAE-licensed lawyer. It is not legal advice, it does not yet bind anyone, and
            it must not be relied on. Highlighted{" "}
            <mark className="rounded bg-warning/15 px-1 font-medium text-warning">
              [PLACEHOLDERS]
            </mark>{" "}
            still need real values.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LegalShell({
  title,
  summary,
  drafted,
  children,
}: {
  title: string;
  summary: string;
  drafted: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 md:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-clay">Legal</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-balance md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-lg text-muted">{summary}</p>
      <p className="mt-3 text-sm text-faint">Drafted {drafted} · Not yet in force</p>

      <div className="mt-10">
        <DraftBanner />
      </div>

      {children}
    </main>
  );
}
