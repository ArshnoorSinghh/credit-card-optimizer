/*
  Markdown block parser — pure, no JSX, so it is unit-testable in the Node test
  environment. The rendering (components/markdown.tsx) turns these blocks into React
  elements. Kept separate precisely so the risky logic (grouping list runs, splitting
  paragraphs, spotting headings) can be tested without a DOM.

  Scope is intentional: paragraphs, headings, and unordered/ordered lists at the
  block level, and **bold**, *italic*, `code`, and [links](/href) inline. Both the
  block grouping and the inline tokenizer live here (pure) so they can be unit
  tested; components/markdown.tsx only turns the output into React elements. Anything
  not recognised falls through as plain text, so an unusual reply stays readable.
*/

// ── Inline tokens ────────────────────────────────────────────────────────────────

export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; text: string; href: string };

// Order matters: links first so their bracket/paren syntax is claimed before the
// emphasis rules see the inner text.
const INLINE_SOURCE =
  "(\\[[^\\]]+\\]\\([^)\\s]+\\)|\\*\\*[^*]+\\*\\*|`[^`]+`|(?<![*\\w])\\*[^*\\n]+\\*(?!\\w)|(?<![_\\w])_[^_\\n]+_(?!\\w))";

const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
// Only relative in-app paths and http(s) URLs are treated as links; anything else
// (javascript:, data:, mailto:, …) renders as literal text — no injection surface
// from model output.
const SAFE_HREF = /^(\/[^\s]*|https?:\/\/\S+)$/i;

/** Tokenize one line of inline markdown. Unknown or unsafe constructs become text. */
export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  const re = new RegExp(INLINE_SOURCE, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    const tok = m[0];
    const link = LINK.exec(tok);
    if (link) {
      if (SAFE_HREF.test(link[2]!)) out.push({ kind: "link", text: link[1]!, href: link[2]! });
      else out.push({ kind: "text", value: tok }); // unsafe href -> literal, not a link
    } else if (tok.startsWith("**")) {
      out.push({ kind: "bold", value: tok.slice(2, -2) });
    } else if (tok.startsWith("`")) {
      out.push({ kind: "code", value: tok.slice(1, -1) });
    } else {
      out.push({ kind: "italic", value: tok.slice(1, -1) });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

export type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

/** Group lines into blocks: headings, list runs, and paragraphs (blank line = break). */
export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", lines: para });
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (line.trim() === "") {
      flushPara();
    } else if (heading) {
      flushPara();
      blocks.push({ kind: "h", level: heading[1]!.length, text: heading[2]! });
    } else if (bullet) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "ul") prev.items.push(bullet[1]!);
      else blocks.push({ kind: "ul", items: [bullet[1]!] });
    } else if (ordered) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "ol") prev.items.push(ordered[1]!);
      else blocks.push({ kind: "ol", items: [ordered[1]!] });
    } else {
      para.push(line);
    }
  }
  flushPara();
  return blocks;
}
