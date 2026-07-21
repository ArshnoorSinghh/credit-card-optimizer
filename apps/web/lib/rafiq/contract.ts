import type {
  PointsInventory,
  SpendingProfile,
  UserProfile,
} from "@fils/engine";

/**
 * HTTP contract for POST /api/rafiq — the AI chat assistant.
 *
 * Rafiq is a conversational FRONT DOOR to the engine, never a source of truth.
 * The request carries the user's message plus whatever the app already knows
 * about them (cards, spend, points). The response carries Rafiq's phrased reply
 * AND the raw engine result behind it — so the UI (and our tests) can display and
 * verify the real numbers independently of anything the language model said.
 */

/** What the app knows about the user, passed as context on every message. */
export interface RafiqContext {
  /** Ids of the cards the user holds (resolved server-side against the dataset). */
  ownedCardIds?: string[];
  /** AED/month by spend category. Used for portfolio, comparison, defaults. */
  spending?: SpendingProfile;
  /** Salary + residency — gates which cards Rafiq may SUGGEST (eligibility). */
  profile?: UserProfile;
  /** The user's points holdings, for redemption / expiry questions. */
  points?: PointsInventory;
}

/** One prior turn of the conversation, so follow-ups keep context. */
export interface RafiqTurn {
  role: "user" | "model";
  text: string;
}

/** POST /api/rafiq request body. */
export interface RafiqRequest {
  message: string;
  context?: RafiqContext;
  /** Prior turns, oldest first. Optional — a fresh chat sends none. */
  history?: RafiqTurn[];
}

/** POST /api/rafiq success response. */
export interface RafiqResponse {
  /** Rafiq's conversational reply. */
  reply: string;
  /** Which engine tool answered this, or null for a refusal / clarifying question. */
  tool: string | null;
  /**
   * The RAW engine result behind the reply (verbatim), or null when no engine call
   * was made. This is the authoritative, exact data — the UI renders numbers from
   * here, not by parsing `reply`. Every factual number Rafiq states must appear here.
   */
  data: unknown | null;
  /**
   * True when the language model was unavailable (missing key, rate-limited, error)
   * and the reply is a deterministic fallback. The rest of the app keeps working.
   */
  degraded: boolean;
}

/** Error response shape (4xx). */
export interface RafiqError {
  error: string;
}
