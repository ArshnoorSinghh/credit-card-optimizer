import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card, GateMode, RewardType } from "./card";
import { SPEND_CATEGORIES } from "./score-card";

// The Card shape as TypeScript actually infers it from the JSON import: identical
// to Card, except the string-literal union fields are widened to `string`. TS drops
// string-literal types when inferring large JSON arrays, so it can't see that every
// value is one of the union's members — a compiler limitation, not a data mismatch.
// Both widened fields are re-checked at RUNTIME below, so nothing is lost.
type JsonCard = Omit<Card, "rewards"> & {
  rewards: Omit<Card["rewards"], "type" | "gate_mode"> & { type: string; gate_mode?: string };
};

// Compile-time proof (no `as` cast, which would mask a mismatch): this forces
// `tsc` to check all 51 cards structurally against Card — every field, every
// nested block, nullability — with `rewards.type` relaxed to string per above.
// It fails `pnpm --filter @fils/engine typecheck` if any card deviates.
const cards = cardsData satisfies readonly JsonCard[];

const REWARD_TYPES = [
  "cashback",
  "points",
  "miles",
] as const satisfies readonly RewardType[];

const GATE_MODES = ["degrade", "forfeit"] as const satisfies readonly GateMode[];

describe("cards.json conforms to the Card type", () => {
  // 51 after the 2026-07 Amex cleanup: the 3 American Express UAE cards (amex_gold,
  // amex_platinum, amex_ddf) plus mashreq_solitaire_amex (Mashreq-issued but on the
  // Amex network) — Amex is niche in the UAE and not worth maintaining.
  //
  // 53 after the 2026-07 hand-verified data pass: adib_booking_signature was
  // removed (product discontinued Dec 2023, closed to new applicants). Verified the
  // removal is intentional — no duplicate ids, no other card dropped.
  it("has all 53 cards", () => {
    expect(cards).toHaveLength(53);
  });

  it("gives every card the required nested blocks", () => {
    for (const card of cards) {
      expect(card.eligibility).toBeTypeOf("object");
      expect(card.fees).toBeTypeOf("object");
      expect(card.rewards).toBeTypeOf("object");
      expect(card.redemption).toBeTypeOf("object");
      expect(Array.isArray(card.benefits)).toBe(true);
    }
  });

  it("gives every card 0-8 reward categories", () => {
    // Lower bound 0: a flat-rate card (enbd_visa_flexi) legitimately has NO bonus
    // categories and earns via base_rate only. adcb_talabat joined it when its
    // first-10-orders promo was moved out of `categories` (D12).
    // Upper bound raised 3 -> 7 by the 2026-07 data, then 7 -> 8 by the D13 base-rate
    // splits: ei_switch_cashback gained `government_utilities_charity` when its
    // compound base ("1% on other; 0.5% on telecom/utilities/real estate/government")
    // was split, taking it to 8. This bound DESCRIBES the data — it is not a
    // constraint the engine relies on — so it moves when a legitimate split adds one.
    for (const card of cards) {
      expect(card.rewards.categories.length).toBeGreaterThanOrEqual(0);
      expect(card.rewards.categories.length).toBeLessThanOrEqual(8);
    }
  });

  /*
    A card must never name the same reward category twice.

    THIS IS A MERGE GUARD, and it exists because the failure it catches actually
    happened (D19e). Merging `origin/main` on 2026-08-16 met a case git cannot
    handle: both sides had REORDERED the `categories` array on the same four cards
    (`international_spend` first on one side, last on the other). A line-based merge
    reads a move as a deletion in one place plus an insertion in another, keeps both
    halves, and produces a duplicate. It did — on adcb_touchpoints_gold_titanium,
    dib_shams_platinum, dib_shams_infinite and sc_smart_saadiq.

    Why nothing else caught it: the result was still valid JSON, still satisfied the
    Card type, still had 53 cards, still passed the 0-8 bound, and the app ran. It
    surfaced only because the tier-count checksum in normalize-rate.test.ts read 200
    tier-1 strings where 196 was expected — a guard firing for a defect it was never
    written for, whose first and entirely plausible explanation was a normalizer
    change that had nothing to do with it.

    A duplicate is always a defect, never a data choice: `buildEarnOptions` turns each
    entry into its own earn option, so a duplicated category is a second option
    claiming the same spend with its own independent caps. Two uncapped copies are
    merely redundant; two CAPPED copies would let a card earn twice its real cap.

    Asserted over ALL cards at once so a failure names every offender in one run —
    a merge produces them in batches, and fixing them one test-run at a time is how
    the second and third get missed.
  */
  it("never names the same reward category twice on one card", () => {
    const duplicates: string[] = [];
    for (const card of cards) {
      const seen = new Set<string>();
      for (const cat of card.rewards.categories) {
        if (seen.has(cat.category)) duplicates.push(`${card.id}: "${cat.category}"`);
        seen.add(cat.category);
      }
    }
    expect(duplicates, "duplicated reward categories (see D19e — likely a bad merge)").toEqual([]);
  });

  // Runtime half of the type check: verify the one field the compiler couldn't.
  it("uses only known reward types", () => {
    for (const card of cards) {
      expect(REWARD_TYPES).toContain(card.rewards.type);
    }
  });

  // Recovers the type safety the JsonCard widening gives up: an unknown gate_mode
  // would silently fall back to "degrade" in the scorer and quietly overstate a
  // forfeiting card, so it must fail here instead.
  it("uses only known gate_mode values, where present", () => {
    for (const card of cards) {
      if (card.rewards.gate_mode === undefined) continue;
      expect(GATE_MODES).toContain(card.rewards.gate_mode);
    }
  });

  // ── Regression locks from the 2026-08 rate-ceiling-bias pass ────────────────
  // These guard DATA defects that the type system cannot express but that
  // materially overstate rewards. Each one was a live bug; see CARD_DATA_CHANGELOG.md.

  it("never hides a second earn rate inside a semicolon-joined base_rate", () => {
    // A base_rate of the form "X per AED 1 on local spend; Y per AED 1 on
    // international spend" is a TRAP: the normalizer parses only the leading number,
    // so Y is silently dropped while the string still claims the card pays it. Six
    // cards carried this shape. The fix is to either promote the second clause to a
    // real reward category (so it is scored) or drop it (so it isn't advertised) —
    // never to leave both halves in one string.
    for (const card of cards) {
      const compound = /;\s*[\d.]+\s+[^;]*\bper\s+AED\b[^;]*\b(international|non-?AED|foreign)/i;
      expect(
        compound.test(card.rewards.base_rate),
        `${card.id} base_rate hides an unparsed international rate: "${card.rewards.base_rate}"`,
      ).toBe(false);
    }
  });

  it("gates rakbank_world's headline tiers behind a minimum monthly spend", () => {
    // rakbank_world advertises "Up to 10%" categories with an AED 1,100 overall cap
    // and previously had min_monthly_spend_required_aed: 0, so the engine paid the
    // top tier at every spend level. It was the single largest contributor to the
    // inflated optimum. The threshold itself is an unverified modelling assumption
    // recorded in the card's data_caveat — this test locks that it stays non-zero.
    const rw = cards.find((c) => c.id === "rakbank_world");
    expect(rw).toBeDefined();
    expect(rw!.rewards.min_monthly_spend_required_aed).toBeGreaterThan(0);
    /*
      The threshold was originally recorded as an UNSOURCED modelling assumption and
      this test asserted that word, to stop the figure hardening into fact. D16
      sourced it: RAKBANK's own product page restates the AED 10,000 minimum against
      every category, which is also what lifted the card's do-not-publish hold. So
      the assertion now locks the SOURCING rather than the caveat — the point was
      never the word, it was that the number must not be silently unattributed.
    */
    expect(rw!.data_caveat).toContain("D16");
    expect(rw!.data_caveat).toContain("10,000 minimum monthly spend is restated");
  });

  // Same reasoning for excluded_spend: a category the scorer doesn't recognise
  // means the exclusion never applies.
  it("declares excluded_spend against real spend categories with a stated reason", () => {
    for (const card of cards) {
      for (const excluded of card.excluded_spend ?? []) {
        expect(SPEND_CATEGORIES).toContain(excluded.category);
        expect(excluded.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
