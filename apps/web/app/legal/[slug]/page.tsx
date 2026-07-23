import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal";
import { LegalShell, Prose } from "@/components/legal-shell";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return { title: "Legal | Fils" };
  return { title: `${doc.title} | Fils`, description: doc.summary };
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <LegalShell title={doc.title} summary={doc.summary} drafted={doc.drafted}>
      <div className="mt-12 space-y-4">
        {doc.intro.map((p, i) => (
          <p key={i} className="text-muted">
            <Prose text={p} />
          </p>
        ))}
      </div>

      <div className="mt-12 space-y-12">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-semibold text-fg">
              {section.heading}
            </h2>

            {section.body?.map((p, i) => (
              <p key={i} className="mt-4 text-muted">
                <Prose text={p} />
              </p>
            ))}

            {section.list && (
              <ul className="mt-4 space-y-2.5">
                {section.list.map((item, i) => (
                  <li key={i} className="flex gap-3 text-muted">
                    <span
                      className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-flame"
                      aria-hidden
                    />
                    <span>
                      <Prose text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-16 border-t border-line pt-8">
        <Link
          href="/legal"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All terms &amp; policies
        </Link>
      </div>
    </LegalShell>
  );
}
