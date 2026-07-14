import { CARDS } from "@fils/engine";

/** Liveness check: confirms the app is up and the engine's card data is bundled in. */
export function GET(): Response {
  return Response.json({ ok: true, cards: CARDS.length });
}
