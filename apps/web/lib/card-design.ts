/*
  card-design.ts — maps each real UAE card to the way its physical card
  actually looks: real bank / co-brand brand colors, program identity, and
  network. This replaces the old "generic gradient per reward type" look.

  why hardcoded hex here (the design system normally forbids it): these are the
  *external* brand colors of real credit cards — Emirates red, ADIB purple,
  Mashreq orange, etc. They are third-party artwork, not Fils UI, so they can't
  come from our theme tokens. They live in this one file, clearly labelled, so
  the rest of the app keeps using tokens only.

  Resolution order: a co-brand *program* (Skywards, Etihad Guest, Marriott
  Bonvoy, LuLu, …) defines the look first, because in real life the airline /
  retailer branding dominates the card face. If there's no program, we fall
  back to the issuing bank's house style.
*/

export type CardSkin = {
  /** CSS background for the card face (real brand palette). */
  bg: string;
  /** Warm metallic accent used for the tier badge + highlight text. */
  accent: string;
  /** Short brand wordmark shown top-left (issuing bank). */
  brand: string;
  /** Co-brand program line under the bank, when the card has one. */
  program?: string;
  /** Chip metal tone — gold (default) or silver, matched to the card. */
  chip?: "gold" | "silver";
  /** Optional decorative motif layered over the background. */
  motif?: "sheen" | "arc" | "hex" | "waves";
};

type Match = { test: (name: string, currency: string) => boolean; skin: Omit<CardSkin, "brand"> & { brand?: string } };

const has = (s: string, ...needles: string[]) =>
  needles.some((n) => s.toLowerCase().includes(n.toLowerCase()));

// ---- Co-brand programs (checked first) ------------------------------------
const PROGRAMS: Match[] = [
  {
    test: (n) => has(n, "Skywards"),
    // Emirates' unmistakable crimson red with a gold hairline.
    skin: {
      bg: "linear-gradient(135deg,#d21f2b 0%,#9b1420 55%,#5c0b13 100%)",
      accent: "#e9c785",
      program: "Emirates Skywards",
      chip: "gold",
      motif: "arc",
    },
  },
  {
    test: (n) => has(n, "Etihad Guest"),
    // Etihad's warm bronze/champagne over charcoal.
    skin: {
      bg: "linear-gradient(135deg,#3d3527 0%,#221d16 60%,#14110c 100%)",
      accent: "#c9a24b",
      program: "Etihad Guest",
      chip: "gold",
      motif: "sheen",
    },
  },
  {
    test: (n) => has(n, "Marriott", "Bonvoy"),
    // Bonvoy's near-black with a tan accent.
    skin: {
      bg: "linear-gradient(135deg,#2c2c31 0%,#19191c 55%,#0e0e10 100%)",
      accent: "#c08a4e",
      program: "Marriott Bonvoy",
      chip: "gold",
      motif: "sheen",
    },
  },
  {
    test: (n) => has(n, "LuLu"),
    // LuLu hypermarket green + signature yellow.
    skin: {
      bg: "linear-gradient(135deg,#009a52 0%,#007a3e 55%,#00532b 100%)",
      accent: "#ffd200",
      program: "LuLu 24/7",
      chip: "gold",
      motif: "waves",
    },
  },
  {
    test: (n) => has(n, "dnata"),
    // dnata travel orange.
    skin: {
      bg: "linear-gradient(135deg,#f07d1a 0%,#d1550c 60%,#9a3c06 100%)",
      accent: "#ffffff",
      program: "dnata Travel",
      chip: "gold",
      motif: "arc",
    },
  },
  {
    test: (n) => has(n, "U By Emaar", "Emaar"),
    // Emaar's premium black + gold.
    skin: {
      bg: "linear-gradient(135deg,#232323 0%,#111 55%,#000 100%)",
      accent: "#c6a15b",
      program: "U By Emaar",
      chip: "gold",
      motif: "sheen",
    },
  },
  {
    test: (n) => has(n, "Smiles"),
    // Smiles loyalty teal.
    skin: {
      bg: "linear-gradient(135deg,#00c2b2 0%,#008d80 55%,#00625a 100%)",
      accent: "#ffffff",
      program: "Smiles",
      chip: "silver",
      motif: "waves",
    },
  },
  {
    test: (n) => has(n, "Booking.com"),
    // Booking.com deep blue + yellow.
    skin: {
      bg: "linear-gradient(135deg,#1a5fb4 0%,#0a3d80 55%,#00224e 100%)",
      accent: "#febb02",
      program: "Booking.com",
      chip: "gold",
      motif: "arc",
    },
  },
  {
    test: (n) => has(n, "RTA"),
    // Dubai RTA metro red + steel.
    skin: {
      bg: "linear-gradient(135deg,#e4002b 0%,#a00020 55%,#5e0013 100%)",
      accent: "#d7d7db",
      program: "RTA",
      chip: "silver",
      motif: "waves",
    },
  },
  {
    test: (n) => has(n, "Diners"),
    // Diners Club navy + silver.
    skin: {
      bg: "linear-gradient(135deg,#0a3d91 0%,#062d68 55%,#00224e 100%)",
      accent: "#c8ccd4",
      program: "Diners Club",
      chip: "silver",
      motif: "sheen",
    },
  },
];

// ---- Issuing banks (fallback house styles) --------------------------------
const BANKS: Record<string, Omit<CardSkin, "program">> = {
  "First Abu Dhabi Bank": {
    brand: "FAB",
    bg: "linear-gradient(135deg,#00b5e2 0%,#0083c7 55%,#00568f 100%)",
    accent: "#ffffff",
    chip: "silver",
    motif: "arc",
  },
  "Emirates NBD": {
    brand: "Emirates NBD",
    bg: "linear-gradient(135deg,#0aa6a2 0%,#067c78 55%,#034f4c 100%)",
    accent: "#ffd23f",
    chip: "gold",
    motif: "waves",
  },
  "Abu Dhabi Commercial Bank": {
    brand: "ADCB",
    bg: "linear-gradient(135deg,#e0002b 0%,#8f0a24 45%,#2a2a30 100%)",
    accent: "#d7d7db",
    chip: "silver",
    motif: "sheen",
  },
  "Mashreq Bank": {
    brand: "Mashreq",
    bg: "linear-gradient(135deg,#ff7a00 0%,#f0531a 55%,#c23a10 100%)",
    accent: "#ffffff",
    chip: "gold",
    motif: "arc",
  },
  "HSBC UAE": {
    brand: "HSBC",
    bg: "linear-gradient(135deg,#e60013 0%,#b00010 55%,#7a000b 100%)",
    accent: "#ffffff",
    chip: "gold",
    motif: "hex",
  },
  "Emirates Islamic": {
    brand: "Emirates Islamic",
    bg: "linear-gradient(135deg,#009a4e 0%,#00713a 55%,#004a26 100%)",
    accent: "#e9c785",
    chip: "gold",
    motif: "waves",
  },
  "Dubai Islamic Bank": {
    brand: "DIB",
    bg: "linear-gradient(135deg,#00814a 0%,#005c34 55%,#003a21 100%)",
    accent: "#c6a15b",
    chip: "gold",
    motif: "sheen",
  },
  "Abu Dhabi Islamic Bank": {
    brand: "ADIB",
    // ADIB's distinctive violet with a gold accent.
    bg: "linear-gradient(135deg,#6d2077 0%,#4a1552 55%,#2a0c30 100%)",
    accent: "#f2a900",
    chip: "gold",
    motif: "arc",
  },
  RAKBANK: {
    brand: "RAKBANK",
    bg: "linear-gradient(135deg,#d0102e 0%,#9a0c22 55%,#5e0715 100%)",
    accent: "#d7d7db",
    chip: "silver",
    motif: "sheen",
  },
  "Commercial Bank of Dubai": {
    brand: "CBD",
    bg: "linear-gradient(135deg,#f7941e 0%,#f15a22 50%,#d81e2c 100%)",
    accent: "#ffffff",
    chip: "gold",
    motif: "arc",
  },
  "Standard Chartered UAE": {
    brand: "Standard Chartered",
    bg: "linear-gradient(135deg,#0473ea 0%,#0a9d6b 100%)",
    accent: "#ffffff",
    chip: "silver",
    motif: "waves",
  },
  "Citibank UAE": {
    brand: "Citi",
    bg: "linear-gradient(135deg,#1b72bd 0%,#0f5290 55%,#093a67 100%)",
    accent: "#e4002b",
    chip: "silver",
    motif: "arc",
  },
};

const FALLBACK: Omit<CardSkin, "program"> = {
  brand: "Fils",
  bg: "linear-gradient(135deg,#8b5cf6 0%,#6366f1 45%,#38bdf8 100%)",
  accent: "#ffffff",
  chip: "gold",
  motif: "sheen",
};

/**
 * Resolve the visual skin for a card from its bank, name and reward currency.
 * Co-brand program wins; otherwise the issuing bank's house style.
 */
export function cardSkin(input: {
  bank: string;
  name: string;
  currency?: string;
}): CardSkin {
  const bankSkin = BANKS[input.bank] ?? FALLBACK;
  const program = PROGRAMS.find((p) => p.test(input.name, input.currency ?? ""));
  if (program) {
    return {
      ...bankSkin,
      ...program.skin,
      brand: program.skin.brand ?? bankSkin.brand,
    };
  }
  return bankSkin;
}
