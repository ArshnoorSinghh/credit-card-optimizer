import { Info } from "lucide-react";
import type { ReactNode } from "react";

/*
  Chrome shared by every /legal page.

  Two jobs beyond layout:

  1. DraftBanner — a quiet, always-present notice that these pages are
     illustrative demo content built on SAMPLE company details (entity name,
     DIFC licence number, address, emails — see lib/legal.ts), not in force and
     not legal advice. It lives in the product rather than only in a commit
     message because the failure mode we're guarding against is someone (a user,
     an investor, a future teammate) reading a polished legal page and reasonably
     assuming a lawyer wrote it and the details are real. Do not remove it until
     counsel has signed off and those sample values are replaced with real ones.

  2. Prose — legal drafts can still carry details only the company can supply
     (a value not yet known). Any left as [CAPS IN BRACKETS] render highlighted,
     so an unfilled one is visible at a glance instead of shipping as
     plausible-looking prose.

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
    <div className="rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3">
      <p className="flex items-start gap-2 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
        <span>
          Illustrative content — these pages use sample company details for a product
          demo and are not in force or legal advice.
        </span>
      </p>
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
