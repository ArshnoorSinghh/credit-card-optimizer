import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { LEGAL_DOCS, LEGAL_DRAFTED } from "@/lib/legal";
import { DraftBanner } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Legal — Fils",
  description: "Terms, privacy, cookies and disclosures for Fils.",
};

/* The /legal hub — mirrors Revolut's "Terms & Policies" index. */
export default function LegalHubPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 md:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-clay">Legal</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-balance md:text-5xl">
        Terms &amp; policies
      </h1>
      <p className="mt-4 text-lg text-muted">
        Everything governing your use of Fils, in one place. Drafted {LEGAL_DRAFTED}.
      </p>

      <div className="mt-10">
        <DraftBanner />
      </div>

      <ul className="mt-10 space-y-3">
        {LEGAL_DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/legal/${doc.slug}`}
              className="group flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
            >
              <span>
                <span className="block font-semibold text-fg">{doc.title}</span>
                <span className="mt-1 block text-sm text-muted">{doc.summary}</span>
              </span>
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
