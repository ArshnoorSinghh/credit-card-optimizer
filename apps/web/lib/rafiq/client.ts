import type { RafiqRequest, RafiqResponse } from "./contract";

/**
 * Client-side helper for talking to POST /api/rafiq.
 *
 * The browser NEVER calls Gemini directly — GEMINI_API_KEY is server-only. This just
 * posts the user's message plus known context and returns Rafiq's reply and the raw
 * engine data behind it. Failures resolve to a graceful degraded response rather than
 * throwing, so the chat UI can render an "unavailable" bubble without special-casing.
 */
export async function sendRafiqMessage(req: RafiqRequest): Promise<RafiqResponse> {
  try {
    const res = await fetch("/api/rafiq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      return {
        reply: "Sorry — I couldn't process that just now. Please try again.",
        tool: null,
        data: null,
        degraded: true,
      };
    }
    return (await res.json()) as RafiqResponse;
  } catch {
    return {
      reply: "I'm offline right now. Please check your connection and try again.",
      tool: null,
      data: null,
      degraded: true,
    };
  }
}

export type { RafiqRequest, RafiqResponse };
