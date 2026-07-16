import { describe, it, expect } from "vitest";
import { MERCHANT_MAP, resolveMerchant } from "./merchant-map";
import { SPEND_CATEGORIES } from "./score-card";

describe("resolveMerchant — single-category merchants", () => {
  it("maps Carrefour to groceries, with no multi-category ambiguity", () => {
    expect(resolveMerchant("Carrefour")).toEqual({
      merchant: "carrefour",
      category: "groceries",
      multiCategory: false,
    });
  });

  it("maps a merchant from every seeded category", () => {
    const cases: Array<[string, string]> = [
      ["Lulu", "groceries"],
      ["Spinneys", "groceries"],
      ["Union Coop", "groceries"],
      ["Choithrams", "groceries"],
      ["VOX", "entertainment"],
      ["Reel", "entertainment"],
      ["Novo", "entertainment"],
      ["ADNOC", "fuel"],
      ["ENOC", "fuel"],
      ["EPPCO", "fuel"],
      ["Emirates", "travel"],
      ["Etihad", "travel"],
      ["flydubai", "travel"],
      ["Careem", "transport"],
      ["Uber", "transport"],
      ["RTA", "transport"],
      ["DEWA", "utilities"],
      ["SEWA", "utilities"],
      ["du", "utilities"],
      ["Etisalat", "utilities"],
    ];
    for (const [input, expected] of cases) {
      expect(resolveMerchant(input)?.category, input).toBe(expected);
    }
  });

  it("maps general marketplaces to `other` — the engine has no `shopping` category", () => {
    // No card in cards.json bonuses online shopping, so this spend earns the base
    // rate, which is exactly what `other` models.
    for (const input of ["Amazon.ae", "Amazon", "Noon", "Namshi"]) {
      expect(resolveMerchant(input)?.category, input).toBe("other");
    }
  });
});

describe("resolveMerchant — multi-category merchants", () => {
  it("flags Talabat as dining primary that also covers groceries", () => {
    expect(resolveMerchant("Talabat")).toEqual({
      merchant: "talabat",
      category: "dining",
      multiCategory: true,
      alsoCovers: ["groceries"],
    });
  });

  it("flags every food-delivery app the same way", () => {
    for (const input of ["Talabat", "Deliveroo", "Noon Food", "Zomato"]) {
      const hit = resolveMerchant(input)!;
      expect(hit.category, input).toBe("dining");
      expect(hit.multiCategory, input).toBe(true);
      expect(hit.alsoCovers, input).toEqual(["groceries"]);
    }
  });

  it("does not confuse 'Noon Food' (dining) with 'Noon' (marketplace)", () => {
    // Longest-match-wins: "noon food" must not collapse to "noon", and a bare
    // "noon" must not be captured by "noon food".
    expect(resolveMerchant("Noon Food")?.category).toBe("dining");
    expect(resolveMerchant("Noon")?.category).toBe("other");
    expect(resolveMerchant("Noon")?.multiCategory).toBe(false);
  });
});

describe("resolveMerchant — input tolerance", () => {
  it("is case-insensitive and trims whitespace", () => {
    for (const input of ["carrefour", "CARREFOUR", "  Carrefour  ", "CaRrEfOuR", "\tcarrefour\n"]) {
      expect(resolveMerchant(input)?.category, JSON.stringify(input)).toBe("groceries");
    }
  });

  it("collapses internal whitespace", () => {
    expect(resolveMerchant("  noon    food ")?.category).toBe("dining");
  });

  it("finds a known merchant inside a longer real-world string", () => {
    expect(resolveMerchant("Carrefour City Mall of the Emirates")?.merchant).toBe("carrefour");
    expect(resolveMerchant("ADNOC station")?.category).toBe("fuel");
    expect(resolveMerchant("my talabat order")?.category).toBe("dining");
  });

  it("resolves aliases", () => {
    expect(resolveMerchant("Amazon")?.merchant).toBe("amazon.ae");
    expect(resolveMerchant("Lulu Hypermarket")?.merchant).toBe("lulu");
    expect(resolveMerchant("Fly Dubai")?.merchant).toBe("flydubai");
  });

  it("matches on word boundaries only — 'dubai' is not 'du'", () => {
    // The nastiest false positive the table invites: a 2-letter merchant.
    expect(resolveMerchant("dubai mall")).toBeNull();
    expect(resolveMerchant("du")?.category).toBe("utilities");
    expect(resolveMerchant("du bill")?.category).toBe("utilities");
  });
});

describe("resolveMerchant — unknown input is never guessed", () => {
  it("returns null rather than mapping an unknown merchant to a plausible category", () => {
    for (const input of ["Whole Foods", "Trader Joe's", "some random shop", "xyzzy", "Tesco"]) {
      expect(resolveMerchant(input), input).toBeNull();
    }
  });

  it("returns null for empty / whitespace input", () => {
    expect(resolveMerchant("")).toBeNull();
    expect(resolveMerchant("   ")).toBeNull();
  });
});

describe("MERCHANT_MAP integrity", () => {
  it("only ever points at real spend categories", () => {
    const valid = new Set<string>(SPEND_CATEGORIES);
    for (const [name, entry] of Object.entries(MERCHANT_MAP)) {
      expect(valid.has(entry.primaryCategory), `${name}.primaryCategory`).toBe(true);
      for (const c of entry.alsoCovers ?? []) {
        expect(valid.has(c), `${name}.alsoCovers`).toBe(true);
        // alsoCovers is for OTHER categories — repeating the primary is a data bug.
        expect(c, `${name}.alsoCovers`).not.toBe(entry.primaryCategory);
      }
    }
  });

  it("uses normalized (lowercase, trimmed) canonical keys so lookups can't miss", () => {
    for (const key of Object.keys(MERCHANT_MAP)) {
      expect(key, key).toBe(key.trim().toLowerCase());
    }
  });
});
