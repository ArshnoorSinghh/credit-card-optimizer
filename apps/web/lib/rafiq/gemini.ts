/**
 * Gemini transport — the "mouth and ears", isolated behind a small interface.
 *
 * This is the ONLY file that talks to Google's API. It's deliberately thin: build a
 * request, POST it, parse the parts back. Everything policy-related (what tools
 * exist, how the engine is called, how we fall back) lives elsewhere so this stays
 * a swappable pipe — and so rafiq.ts can be tested with a fake `GeminiClient` and no
 * network.
 *
 * Uses the REST API via `fetch` rather than an SDK: zero new dependencies (nothing
 * to add to the lockfile for the human to review), and total control over timeouts
 * and error handling for graceful degradation.
 *
 * GEMINI_API_KEY is read on the SERVER only. This module is never imported by client
 * components; the key is passed in explicitly by the route.
 */

// ── The shape rafiq.ts speaks in (a trimmed slice of Gemini's content format) ────

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

export interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponse;
}

export interface GeminiContent {
  // Only "user" and "model" — the current models reject "function"/"tool" roles.
  // A functionResponse part rides on a "user"-role turn (see rafiq.ts).
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiGenerateRequest {
  systemInstruction: string;
  contents: GeminiContent[];
  /** Function declarations Gemini may call (our TOOL_DECLARATIONS). */
  tools: readonly unknown[];
}

/** The transport contract. Real impl calls Google; tests inject a fake. */
export interface GeminiClient {
  /** Returns the model's reply content (parts). Throws on transport/API failure. */
  generateContent(req: GeminiGenerateRequest): Promise<GeminiContent>;
}

/**
 * How a Gemini call failed, so callers can react without string-matching messages:
 *  - "http"    the API responded with a non-2xx status (see `status`)
 *  - "timeout" our own AbortController fired (REQUEST_TIMEOUT_MS)
 *  - "network" fetch threw before any response (DNS, TLS, connection reset)
 *  - "empty"   a 200 with no usable content (e.g. a safety block)
 */
export type GeminiErrorKind = "http" | "timeout" | "network" | "empty";

export class GeminiError extends Error {
  constructor(
    message: string,
    /** HTTP status when the API responded, else undefined (network/timeout). */
    readonly status?: number,
    readonly kind: GeminiErrorKind = "http",
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

// why a floating "-latest" alias, and why it's overridable: Google rotates which
// models the generateContent endpoint actually serves, independently of what
// ListModels advertises. Pinned ids rot silently — verified July 2026 against this
// key: gemini-2.0-flash returns 429 (free-tier request quota 0), gemini-2.5-flash
// returns 404 NOT_FOUND despite appearing in ListModels, while gemini-flash-latest
// returns 200. The "-latest" alias tracks a currently-served model, so it survives
// Google's rotation; GEMINI_MODEL overrides it without a deploy if we ever need to
// pin a specific version.
const DEFAULT_MODEL = "gemini-flash-latest";
const REQUEST_TIMEOUT_MS = 12_000;

interface RawCandidate {
  content?: { parts?: GeminiPart[]; role?: string };
}
interface RawResponse {
  candidates?: RawCandidate[];
  promptFeedback?: { blockReason?: string };
}

/**
 * A live client backed by Google's Generative Language API.
 *
 * @param apiKey  server-side GEMINI_API_KEY
 * @param model   model id from GEMINI_MODEL; falls back to DEFAULT_MODEL. An empty
 *                or whitespace value is treated as unset (a blank env var shouldn't
 *                produce a `/models/:generateContent` URL with no model).
 */
export function createGeminiClient(apiKey: string, model?: string): GeminiClient {
  const resolvedModel = model && model.trim() !== "" ? model.trim() : DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`;

  return {
    async generateContent(req: GeminiGenerateRequest): Promise<GeminiContent> {
      const body = {
        systemInstruction: { parts: [{ text: req.systemInstruction }] },
        contents: req.contents,
        tools: [{ functionDeclarations: req.tools }],
        // AUTO lets the model answer directly (refuse / clarify) OR call a tool. We
        // rely on the system prompt to force a tool for anything factual.
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        // Low temperature: this is routing + faithful phrasing, not creative writing.
        generationConfig: { temperature: 0.2 },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          // Key travels in a header, not the URL, so it never lands in request logs.
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        const timedOut = err instanceof Error && err.name === "AbortError";
        throw new GeminiError(
          timedOut
            ? `Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `Gemini request failed: ${String(err)}`,
          undefined,
          timedOut ? "timeout" : "network",
        );
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new GeminiError(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`, res.status, "http");
      }

      const json = (await res.json()) as RawResponse;
      const parts = json.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        const reason = json.promptFeedback?.blockReason;
        throw new GeminiError(
          reason ? `Gemini returned no content (blocked: ${reason})` : "Gemini returned no content",
          undefined,
          "empty",
        );
      }
      return { role: "model", parts };
    },
  };
}
