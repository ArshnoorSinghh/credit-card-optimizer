import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { parseBlocks, parseInline } from "@/lib/markdown";

/*
  Markdown — a deliberately small renderer for Rafiq's chat replies.

  Gemini returns light Markdown (bold, the odd heading, bullet or numbered lists, and
  links to card detail pages). We render it to real React elements — never
  dangerouslySetInnerHTML — so there is no HTML-injection surface even though the text
  originates from a language model. The href allowlist (relative or http(s) only)
  lives in the pure parser, so an unsafe link becomes literal text, never an anchor.

  Block AND inline parsing live in lib/markdown.ts (pure, unit-tested); this file owns
  only the React rendering. Anything not recognised falls through as plain text, so an
  unusual reply is always readable, never broken.
*/

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return parseInline(text).map((tok, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (tok.kind) {
      case "bold":
        return (
          <strong key={key} className="font-semibold text-fg">
            {tok.value}
          </strong>
        );
      case "code":
        return (
          <code key={key} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-fg">
            {tok.value}
          </code>
        );
      case "italic":
        return (
          <em key={key} className="italic">
            {tok.value}
          </em>
        );
      case "link": {
        // Internal links use next/link; external ones open in a new, isolated tab.
        const external = /^https?:\/\//i.test(tok.href);
        const className = "font-medium text-clay underline decoration-clay/40 underline-offset-2 transition-colors hover:text-flame hover:decoration-flame";
        return external ? (
          <a key={key} href={tok.href} target="_blank" rel="noopener noreferrer" className={className}>
            {tok.text}
          </a>
        ) : (
          <Link key={key} href={tok.href} className={className}>
            {tok.text}
          </Link>
        );
      }
      default:
        return <Fragment key={key}>{tok.value}</Fragment>;
    }
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          return (
            <p key={i} className="mt-2 mb-1 font-semibold text-fg first:mt-0">
              {renderInline(b.text, `h${i}`)}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="my-1 list-disc space-y-0.5 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `ul${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} className="my-1 list-decimal space-y-0.5 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `ol${i}-${j}`)}</li>
              ))}
            </ol>
          );
        }
        // Paragraph: keep soft line breaks within it.
        return (
          <p key={i} className="my-1 first:mt-0 last:mb-0">
            {b.lines.map((ln, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(ln, `p${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
