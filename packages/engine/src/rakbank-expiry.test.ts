/**
 * RAKBANK's 15-month cashback expiry, modelled in Engine 2's burn engine rather
 * than as a valuation haircut.
 *
 * The split of responsibilities under test:
 *   Engine 1 (scoreCard)     — states the term as a FACT. Value unchanged.
 *   Engine 2 (burnPriority)  — projects a real date and ranks urgency.
 *
 * The contamination guard matters most: the expiry policy is keyed by currency,
 * and RAKBANK's cashback used to share the generic "AED" label with a dozen other
 * cashback cards. Scoping it to "AED (RAKBANK cashback)" is what stops a RAKBANK
 * product term from being applied to every cashback card in the dataset.
 */

import { describe, it, expect } from "vitest";
import cardsData from "../data/cards.json";
import type { Card } from "./card";
import { scoreCard } from "./score-card";
import { burnPriority } from "./burn-priority";
import { PROGRAM_EXPIRY_DEFAULTS } from "./expiry-policy";
import { DEFAULT_VALUATIONS } from "./valuations";
import { REDEMPTION_VALUATIONS } from "./redemption-valuations";

const realCards = cardsData as Card[];
const RAKBANK_CASHBACK = "AED (RAKBANK cashback)";

describe("RAKBANK cashback — its own currency, so the expiry can be scoped", () => {
  it("labels the three RAKBANK cashback cards with the scoped currency", () => {
    const ids = realCards
      .filter((c) => c.rewards.currency === RAKBANK_CASHBACK)
      .map((c) => c.id)
      .sort();
    expect(ids).toEqual(["rakbank_red", "rakbank_titanium", "rakbank_world"]);
  });

  it("values it at face, exactly like plain cashback — no expiry haircut", () => {
    const entry = DEFAULT_VALUATIONS[RAKBANK_CASHBACK]!;
    expect(entry.aedPerUnit).toBe(1.0);
    expect(entry.aedPerUnit).toBe(DEFAULT_VALUATIONS["AED"]!.aedPerUnit);
    expect(entry.confidence).toBe("high");
  });

  it("is known to both engines' tables", () => {
    expect(DEFAULT_VALUATIONS[RAKBANK_CASHBACK]).toBeDefined();
    expect(REDEMPTION_VALUATIONS[RAKBANK_CASHBACK]).toBeDefined();
  });
});

describe("Engine 1 — flags the expiry as a fact, without pricing it", () => {
  const card = realCards.find((c) => c.id === "rakbank_world")!;
  const spending = { groceries: 3000, dining: 2000 };
  const score = scoreCard(spending, card);

  it("surfaces a 15-month expiry flag", () => {
    const flag = score.flags.find((f) => /expire/i.test(f.message));
    expect(flag).toBeDefined();
    expect(flag!.message).toContain("15 months");
    expect(flag!.message).toContain("after being earned");
  });

  it("does NOT mark the score uncertain — the term is certain, only the value's timing isn't", () => {
    const expiryFlag = score.flags.find((f) => /expire/i.test(f.message))!;
    expect(expiryFlag.level).toBe("low"); // advisory, not an "unknown"
  });

  it("does NOT reduce the AED value: identical to the same card valued as plain AED", () => {
    // Same card, relabelled to generic cashback — the scores must match exactly,
    // proving the expiry costs nothing in Engine 1.
    const asPlainAed: Card = {
      ...card,
      rewards: { ...card.rewards, currency: "AED" },
    };
    expect(scoreCard(spending, asPlainAed).grossAnnualValue).toEqual(score.grossAnnualValue);
    expect(scoreCard(spending, asPlainAed).netAnnualValue).toBe(score.netAnnualValue);
  });

  it("does not leak onto ordinary cashback cards", () => {
    // The contamination guard. fab_cashback earns plain "FAB Rewards"; adib_cashback_visa
    // earns generic AED. Neither may pick up RAKBANK's product term.
    for (const id of ["adib_cashback_visa", "fab_cashback"]) {
      const other = realCards.find((c) => c.id === id)!;
      const flags = scoreCard({ groceries: 3000 }, other).flags;
      expect(flags.some((f) => /expire/i.test(f.message))).toBe(false);
    }
  });
});

describe("Engine 2 — projects the real date and ranks urgency", () => {
  it("projects expiry 15 months from the earned date", () => {
    // Earned 2026-01-15 -> expires 2027-04-15. As of 2026-07-23 that is >180 days
    // out, so it is not yet urgent.
    const plan = burnPriority(
      [{ currency: RAKBANK_CASHBACK, balance: 500, earnedDate: "2026-01-15" }],
      "2026-07-23",
    );
    const item = plan.items[0]!;
    expect(item.expiryDate).toBe("2027-04-15");
    expect(item.expirySource).toBe("projected_default");
    expect(item.urgency).toBe("later");
    // Cashback at face value: 500 units -> AED 500 at risk.
    expect(item.valueAtRiskAed).toBeCloseTo(500, 6);
  });

  it("escalates to urgent as the 15-month window closes", () => {
    // Earned 2025-06-01 -> expires 2026-09-01, ~40 days after this asOf.
    const plan = burnPriority(
      [{ currency: RAKBANK_CASHBACK, balance: 500, earnedDate: "2025-06-01" }],
      "2026-07-23",
    );
    expect(plan.items[0]!.expiryDate).toBe("2026-09-01");
    expect(plan.items[0]!.urgency).toBe("urgent");
  });

  it("flags the projection as policy-derived, never user-confirmed", () => {
    const plan = burnPriority(
      [{ currency: RAKBANK_CASHBACK, balance: 500, earnedDate: "2026-01-15" }],
      "2026-07-23",
    );
    expect(plan.items[0]!.flags.join(" ")).toMatch(/not user-confirmed/);
  });

  it("stays honest when the balance has no earned date — no invented urgency", () => {
    const plan = burnPriority([{ currency: RAKBANK_CASHBACK, balance: 500 }], "2026-07-23");
    expect(plan.items[0]!.urgency).toBe("unknown");
    expect(plan.items[0]!.expiryDate).toBeUndefined();
  });

  it("leaves generic AED cashback with no expiry policy at all", () => {
    const plan = burnPriority(
      [{ currency: "AED", balance: 500, earnedDate: "2020-01-01" }],
      "2026-07-23",
    );
    // Six years old and still not expiring — plain cashback doesn't.
    expect(plan.items[0]!.urgency).toBe("unknown");
    expect(plan.items[0]!.expiryDate).toBeUndefined();
  });
});

describe("expiry policy table", () => {
  it("carries RAKBANK at 15 months from earning", () => {
    const entry = PROGRAM_EXPIRY_DEFAULTS.find((e) => e.currency === RAKBANK_CASHBACK)!;
    expect(entry.months).toBe(15);
    expect(entry.basis).toBe("from_earning");
  });

  it("has no entry for generic AED — that would hit every cashback card", () => {
    expect(PROGRAM_EXPIRY_DEFAULTS.some((e) => e.currency === "AED")).toBe(false);
  });
});
