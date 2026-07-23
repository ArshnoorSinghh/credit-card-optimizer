import { Fragment, type ReactNode } from "react";
import { parseBlocks } from "@/lib/markdown";

/*
  Markdown — a deliberately small renderer for Rafiq's chat replies.

  Gemini returns light Markdown (bold, the odd heading, bullet or numbered lists).
  We render it to real React elements — never dangerouslySetInnerHTML — so there is
  no HTML-injection surface even though the text originates from a language model.

  Block parsing lives in lib/markdown.ts (pure, unit-tested); this file owns only the
  React rendering and the inline emphasis pass. Scope is intentional: bold, italic,
  inline code, headings, and unordered/ordered lists — everything the assistant emits
  now that the prompt keeps replies to a few sentences. Anything it doesn't recognise
  falls through as plain text, so an unusual reply is always readable, never broken.
*/

// ── Inline: **bold**, *italic* / _italic_, `code`. ──────────────────────────────────
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|(?<![*\w])\*[^*\n]+\*(?!\w)|(?<![_\w])_[^_\n]+_(?!\w))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let i = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      out.push(
        <strong key={key} className="font-semibold text-fg">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-fg">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
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
