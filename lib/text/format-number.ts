/**
 * Turkish-locale number formatting for figures that reach Turkish prose or a Turkish label
 * (`toLocaleString("tr-TR", …)`), never `toFixed`. `toFixed(2)` returns an English decimal
 * point (`"24.00"`) even inside otherwise-Turkish text, which is wrong both in visible prose
 * and inside JSON-LD built from the same string. One shared helper so every figure on a page
 * — a percentage, a population, an area — goes through the same formatting rule instead of a
 * second hand-typed `toFixed` call drifting from it.
 *
 * `digits` fixes both the minimum and maximum fraction digits (a percentage rendered to one
 * or two decimal places); omit it for an integer-like figure (population, area, elevation),
 * which lets `toLocaleString` still group thousands.
 */
export function tr(n: number, digits?: number): string {
  return n.toLocaleString(
    "tr-TR",
    digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  );
}
