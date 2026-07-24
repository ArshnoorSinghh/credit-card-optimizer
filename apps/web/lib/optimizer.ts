import {
  optimizePortfolio,
  SPEND_CATEGORIES,
  type Card,
  type PortfolioResult,
  type SpendCategory,
  type SpendingProfile,
  type UserProfile,
} from "@fils/engine";
import { ALL_CARDS } from "@/lib/cards";

/*
  Client-side optimizer runner for the DEMO flow.

  The engine is pure and framework-free, so the browser can call it directly with
  the bundled card dataset — the demo is genuinely functional with no API/DB. When
  the product wires the real POST /api/optimize (cards from Postgres), swap
  `runOptimize` for a fetch; the result shape is identical (PortfolioResult).

  We do NOT modify the engine (Golden Rule) — we only call its exported function.
*/

export type { PortfolioResult, SpendingProfile, UserProfile };

export const CATEGORIES = SPEND_CATEGORIES;

/** A realistic default profile so the demo shows a meaningful result immediately. */
export const DEFAULT_SPEND: Record<SpendCategory, number> = {
  groceries: 2500,
  dining: 1800,
  fuel: 800,
  utilities: 700,
  education: 0,
  travel: 1200,
  transport: 400,
  entertainment: 600,
  international: 900,
  other: 1500,
};

export const DEFAULT_PROFILE: UserProfile = {
  monthlySalaryAed: 20000,
  uaeResident: true,
};

/** Human labels + hints for the spend sliders. */
export const CATEGORY_META: Record<SpendCategory, { label: string; hint: string; max: number }> = {
  groceries: { label: "Groceries", hint: "Supermarkets, co-ops", max: 8000 },
  dining: { label: "Dining", hint: "Restaurants, cafés, delivery", max: 6000 },
  fuel: { label: "Fuel", hint: "Petrol stations", max: 3000 },
  utilities: { label: "Utilities", hint: "DEWA, telecom, bills", max: 3000 },
  education: { label: "Education", hint: "School & tuition fees", max: 10000 },
  travel: { label: "Travel", hint: "Flights, hotels, airlines", max: 8000 },
  transport: { label: "Transport", hint: "Taxi, metro, Salik", max: 2000 },
  entertainment: { label: "Entertainment", hint: "Cinema, events, streaming", max: 3000 },
  international: { label: "International", hint: "Foreign-currency spend", max: 6000 },
  other: { label: "Other", hint: "Everything else", max: 8000 },
};

/**
 * Run the real engine over a spending profile. Returns null on any failure so the
 * UI can degrade gracefully rather than crash — the demo should never white-screen.
 */
export function runOptimize(
  spending: SpendingProfile,
  profile: UserProfile = DEFAULT_PROFILE,
): PortfolioResult | null {
  try {
    return optimizePortfolio(spending, profile, ALL_CARDS);
  } catch (err) {
    console.error("Optimizer failed:", err);
    return null;
  }
}

/**
 * Run the engine over a SPECIFIC set of cards (e.g. the ones the user holds), to see
 * the best they can net from what they already have. Same pure engine, just a
 * different universe. Returns null on any failure or an empty card set.
 */
export function runOptimizeOver(
  spending: SpendingProfile,
  profile: UserProfile,
  cards: Card[],
): PortfolioResult | null {
  if (cards.length === 0) return null;
  try {
    return optimizePortfolio(spending, profile, cards);
  } catch (err) {
    console.error("Optimizer (owned cards) failed:", err);
    return null;
  }
}

/** Total monthly spend across all categories. */
export function totalSpend(spending: SpendingProfile): number {
  return Object.values(spending).reduce((a, b) => a + (b ?? 0), 0);
}
