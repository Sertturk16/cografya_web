import type { Locale } from "@/i18n/routing";

/** The same tags `lib/text/format-date.ts` uses, so numbers and dates agree on one page. */
export const numberLocaleTag = (locale: Locale) => (locale === "en" ? "en-GB" : "tr-TR");

/**
 * Number formatting for every figure that reaches visible text, never `toFixed`. `toFixed(2)`
 * returns an English decimal point (`"24.00"`) even inside otherwise-Turkish text, which is
 * wrong both in visible prose and inside JSON-LD built from the same string: Turkish writes
 * `21,5 °C` and `M 2,9`. One shared helper so every figure on a page — a percentage, a
 * population, a magnitude, a coordinate — goes through the same rule instead of a hand-typed
 * `toFixed` call drifting from it. `components/no-visible-tofixed.test.ts` holds the tree to it.
 *
 * `digits` fixes both the minimum and maximum fraction digits (a percentage rendered to one
 * or two decimal places); omit it for an integer-like figure (population, area, elevation),
 * which lets `toLocaleString` still group thousands.
 */
export function formatNumber(n: number, locale: Locale, digits?: number): string {
  return n.toLocaleString(
    numberLocaleTag(locale),
    digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  );
}

/**
 * {@link formatNumber} for Turkish text: a label, a unit or a sentence hard-written in Turkish
 * takes a Turkish figure whatever route renders it. A surface whose words go through
 * `next-intl` formats with the page locale instead.
 */
export function tr(n: number, digits?: number): string {
  return formatNumber(n, "tr", digits);
}
