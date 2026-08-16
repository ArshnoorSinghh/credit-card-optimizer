import { CARDS, merchantShareQuestions, type MerchantShares } from "@fils/engine";

/*
  Merchant share, at the app layer.

  Fourteen UAE cards bonus one named retailer. Until now the engine had to assume
  100% of the matching category landed there (a large overstatement) and those cards
  were held back from recommendations as a result. The engine can now take a SHARE
  as an input — see packages/engine/src/merchant-share.ts — so the product's job is
  to ask a question a person can actually answer.

  ── why buckets and not a percentage slider ───────────────────────────────────────
  "What fraction of your grocery spend happens at LuLu?" is a question almost nobody
  can answer to the percentage point, and a slider invites a made-up number that we
  would then treat as fact. Four coarse buckets are answerable honestly, and each one
  is a deliberate choice rather than a default someone dragged past. The bucket's
  numeric value is shown in the UI, so the user can see what we did with their answer.

  ── unanswered means UNANSWERED ───────────────────────────────────────────────────
  A merchant the user hasn't answered is simply absent from the MerchantShares map.
  The engine treats an absent merchant exactly as it always did — full category,
  flagged as an optimistic assumption — so an unanswered question can never silently
  become an optimistic one. This is why the buckets have no "default" value.
*/

/** How often the user shops at a merchant, and what share of the category that is. */
export interface ShareBucket {
  id: "never" | "sometimes" | "often" | "mostly";
  label: string;
  /** Fraction of the affected categories' spend, passed to the engine verbatim. */
  value: number;
  hint: string;
}

export const SHARE_BUCKETS: ShareBucket[] = [
  { id: "never", label: "Never", value: 0, hint: "0% — the bonus is worth nothing to you" },
  { id: "sometimes", label: "Sometimes", value: 0.15, hint: "about 15% of that spend" },
  { id: "often", label: "Often", value: 0.35, hint: "about 35% of that spend" },
  { id: "mostly", label: "Mostly there", value: 0.6, hint: "about 60% of that spend" },
];

/** The user's answers: merchant name -> bucket id. Absent key = not yet answered. */
export type ShareAnswers = Record<string, ShareBucket["id"]>;

/**
 * Every merchant the bundled card universe needs a share for, most consequential
 * first. Derived from the card data by the engine, so adding a co-brand card to
 * cards.json adds its question here with no code change.
 */
export const SHARE_QUESTIONS = merchantShareQuestions(CARDS);

/**
 * How many questions to show before the "show the rest" disclosure. The list is
 * ordered by how many cards each merchant affects, so the first few carry most of
 * the value and the tail is genuinely optional.
 */
export const PRIMARY_QUESTION_COUNT = 6;

/** Human-readable category list for a question ("groceries", "travel and dining"). */
export function describeCategories(categories: readonly string[]): string {
  if (categories.length === 0) return "spend";
  if (categories.length === 1) return categories[0]!;
  return `${categories.slice(0, -1).join(", ")} and ${categories[categories.length - 1]}`;
}

/** Turn bucket answers into the engine's MerchantShares. Unanswered stays absent. */
export function toMerchantShares(answers: ShareAnswers): MerchantShares {
  const out: Record<string, number> = {};
  for (const [merchant, bucketId] of Object.entries(answers)) {
    const bucket = SHARE_BUCKETS.find((b) => b.id === bucketId);
    // An unrecognised bucket id (a stale value from an older stored profile) is
    // dropped rather than guessed — it falls back to "unanswered", which is the safe
    // direction and keeps the engine's loud flag.
    if (bucket) out[merchant] = bucket.value;
  }
  return out;
}

/** How many of the questions the user has actually answered. */
export function answeredCount(answers: ShareAnswers): number {
  return SHARE_QUESTIONS.filter((q) => answers[q.merchant] !== undefined).length;
}
