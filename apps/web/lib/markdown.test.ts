import { describe, it, expect } from "vitest";
import { parseBlocks } from "./markdown";

/**
 * The React renderer needs a DOM to assert on; the block PARSER is pure and carries
 * the risk (grouping list runs, splitting paragraphs, spotting headings), so that is
 * what we test. Inline bold/italic is a separate render-time pass, exercised live.
 */
describe("parseBlocks", () => {
  it("keeps a plain sentence as one paragraph", () => {
    expect(parseBlocks("ADCB 365 comes out ahead — about AED 181/year more.")).toEqual([
      { kind: "p", lines: ["ADCB 365 comes out ahead — about AED 181/year more."] },
    ]);
  });

  it("groups consecutive bullets into one list, then a following paragraph", () => {
    const md = "Your best mix:\n\n* RAKBANK World\n* ADCB Talabat\n\nSee the breakdown below.";
    expect(parseBlocks(md)).toEqual([
      { kind: "p", lines: ["Your best mix:"] },
      { kind: "ul", items: ["RAKBANK World", "ADCB Talabat"] },
      { kind: "p", lines: ["See the breakdown below."] },
    ]);
  });

  it("recognises numbered lists as ordered", () => {
    expect(parseBlocks("1. Mashreq Platinum Plus\n2. ADCB Talabat")).toEqual([
      { kind: "ol", items: ["Mashreq Platinum Plus", "ADCB Talabat"] },
    ]);
  });

  it("treats ### as a heading and strips the markers", () => {
    expect(parseBlocks("### Expected Value\nabout AED 11,490/year")).toEqual([
      { kind: "h", level: 3, text: "Expected Value" },
      { kind: "p", lines: ["about AED 11,490/year"] },
    ]);
  });

  it("does not merge two paragraphs separated by a blank line", () => {
    const blocks = parseBlocks("First line.\n\nSecond line.");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.kind === "p")).toBe(true);
  });

  it("keeps a soft line break inside one paragraph", () => {
    expect(parseBlocks("line one\nline two")).toEqual([{ kind: "p", lines: ["line one", "line two"] }]);
  });

  it("handles a dash bullet as well as a star", () => {
    expect(parseBlocks("- one\n- two")).toEqual([{ kind: "ul", items: ["one", "two"] }]);
  });
});
