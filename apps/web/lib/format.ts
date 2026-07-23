/* Display formatting helpers shared across pages. Pure, UI-only. */

/** "AED 1,234" — rounded, thousands-separated. */
export function aed(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`;
}

/** Compact AED for tight spots: "AED 12.4k". */
export function aedCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `AED ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return aed(n);
}

/** A range, collapsing to a single value when min === max. */
export function aedRange(min: number, max: number): string {
  return max - min > 0.5 ? `${aed(min)} to ${aed(max)}` : aed(min);
}

/** Title-case a snake/lower category key: "international" → "International". */
export function label(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
