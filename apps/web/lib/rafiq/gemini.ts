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
  role: "user" | "model" | "function";
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

export class GeminiError extends Error {
  constructor(
    message: string,
    /** HTTP status when the API responded, else undefined (network/timeout). */
    readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

const DEFAULT_MODEL = "gemini-2.0-flash";
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
 * @param model   model id (default gemini-2.0-flash — free tier, supports tool use)
 */
export function createGeminiClient(apiKey: string, model: string = DEFAULT_MODEL): GeminiClient {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
        throw new GeminiError(
          err instanceof Error && err.name === "AbortError"
            ? "Gemini request timed out"
            : `Gemini request failed: ${String(err)}`,
        );
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new GeminiError(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`, res.status);
      }

      const json = (await res.json()) as RawResponse;
      const parts = json.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        const reason = json.promptFeedback?.blockReason;
        throw new GeminiError(reason ? `Gemini returned no content (blocked: ${reason})` : "Gemini returned no content");
      }
      return { role: "model", parts };
    },
  };
}
