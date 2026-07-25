import type { ReactNode } from "react";

/*
  Chrome shared by every /legal page.

  One job beyond layout: Prose. These documents can still carry details only the
  company can supply (a value not yet known). Any left as [CAPS IN BRACKETS]
  render highlighted, so an unfilled one is visible at a glance instead of
  shipping as plausible-looking prose.

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

export function LegalShell({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 md:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-clay">Legal</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-balance md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-lg text-muted">{summary}</p>

      {children}
    </main>
  );
}
