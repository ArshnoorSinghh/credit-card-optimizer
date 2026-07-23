/*
  Markdown block parser — pure, no JSX, so it is unit-testable in the Node test
  environment. The rendering (components/markdown.tsx) turns these blocks into React
  elements. Kept separate precisely so the risky logic (grouping list runs, splitting
  paragraphs, spotting headings) can be tested without a DOM.

  Scope is intentional: paragraphs, headings, and unordered/ordered lists. Inline
  emphasis (**bold**, *italic*, `code`) is handled at render time. Anything not
  recognised falls through as a plain paragraph, so an unusual reply stays readable.
*/

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
