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

/*
  Non-dismissible prototype notice, on every disclosure page.

  why non-dismissible: these pages look like the legal pages of a live company,
  because they are styled like the rest of the site. The one fact that changes
  how a reader should weigh all of them — that no company exists behind any of
  it — has to be stated where it cannot be closed, scrolled past accidentally,
  or lost in a footer. Do not make this dismissible for visual polish.
*/
function PrototypeNotice() {
  return (
    <div
      role="note"
      className="mt-8 rounded-[var(--radius-md)] border border-warning/30 bg-warning/10 p-5 text-sm text-fg"
    >
      <p className="font-semibold">Fils is a prototype, not a company.</p>
      <p className="mt-2 text-muted">
        There is no incorporated entity behind Fils yet, no trade licence, and no
        registered office. These pages describe what the software does. They are not a
        contract, they create no obligations, and none of them has been reviewed by a
        lawyer.
      </p>
      <p className="mt-2 text-muted">
        {/* {" "} rather than a plain space: JSX trims the leading whitespace of a
            text node that wraps across lines, which rendered this as "draftedare". */}
        Sections marked <em>not yet drafted</em>{" "}
        are deliberately blank. Each would state a commitment nobody can currently
        stand behind, so it keeps its heading and says nothing. Treat the prototype
        accordingly and don&apos;t enter anything you would mind losing.
      </p>
    </div>
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
      <p className="text-sm font-medium uppercase tracking-widest text-clay">Disclosures</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-balance md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-lg text-muted">{summary}</p>

      <PrototypeNotice />

      {children}
    </main>
  );
}
