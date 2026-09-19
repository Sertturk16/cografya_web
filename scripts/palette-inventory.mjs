/**
 * Find every raw Tailwind palette class in the product tree.
 *
 * ONE reader. `components/ui/token-binding.test.ts` has its own regex for the escape rule and
 * that one stays; this is the reader for the COUNT, and Task 2's counter imports it rather
 * than writing a second pattern. Two scanners of one notation that nothing compares is
 * exactly the shape T-045 was created to remove.
 *
 * LINE-BASED, and knowingly so: it matches literal class text one source line at a time, so a
 * class split across two lines by the formatter, or assembled at runtime (a `text-${hue}-600`
 * template literal), is invisible to it. Today's exposure is zero outside test files. The nearest
 * thing to it is `v2-tools-hub.tsx`'s `variant="emerald"` / `variant="sky"`, which are benign:
 * they resolve to `bg-secondary` / `bg-info` in `components/ui/button.tsx`, not to raw classes.
 *
 * `lib/` is in the default roots because the definitions live there. `lib/map/continent-theme.ts`
 * alone holds 112 occurrences and is imported by five product files; scanning only the call sites
 * would have let the source of the hues sit outside the count.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PROPERTIES =
  "text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide";

/** e.g. `text-amber-600`, `bg-emerald-500/15`, `dark:text-cyan-400`. */
export const RAW_PALETTE = new RegExp(
  `\\b(?:${PROPERTIES})-(?:${FAMILIES})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`,
  "g",
);

/**
 * The second arm: an arbitrary hex in brackets, e.g. `bg-[#ea580c]`, `dark:fill-[#202b33]`.
 *
 * WHY THIS EXISTS. `RAW_PALETTE` matches a NOTATION, not a colour, so a file can reach zero on
 * it by rewriting `bg-orange-600` as `bg-[#ea580c]` — the same colour, the same problem, and a
 * budget of 0 would then assert something materially weaker than it reads.
 * `v2-marine-map-explorer.tsx` already does exactly this three times (orange-600, teal-600 and
 * blue-600 as the sea-surface-temperature legend swatches).
 *
 * This is the THIRD instance of one class of blindness — the count's scope not matching the
 * thing being counted. The first was occurrences inside comments, the second was `lib/` sitting
 * outside the roots. Each was found after the number had been quoted. So this arm ships with
 * the counter rather than as a note for later.
 *
 * Counted SEPARATELY, not folded into `RAW_PALETTE`'s total: most of these 75 are legitimate map
 * surfaces (sea, neighbour land, inland water) whose values were measured against fixed
 * backdrops and which belong to the `--map-*` / `--province-*` sets T-031d owns. A single number
 * mixing them with laundered palette values would be a number nobody could act on.
 */
export const ARBITRARY_HEX = new RegExp(`\\b(?:${PROPERTIES})-\\[#[0-9a-fA-F]{3,8}\\]`, "g");

/** Files this branch does not own, and files that are not product code. */
export const EXCLUDED = [
  // T-033 rewrites this file's climate markup wholesale and clears its 65 occurrences.
  "app/[locale]/(site)/turkiye/[slug]/page.tsx",
];

const isSource = (name) => name.endsWith(".tsx") || name.endsWith(".ts");
const isTest = (name) => name.includes(".test.");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return isSource(entry.name) && !isTest(entry.name) ? [path] : [];
  });
}

/**
 * Every source file both arms read. ONE reader for the scope, so the two counts can never be
 * taken over different trees — which is the mistake that produced 787 and 939 for the same
 * question.
 */
function sourceFiles(roots) {
  return roots.flatMap(walk).filter((file) => !EXCLUDED.some((e) => file.endsWith(e)));
}

/** @returns {{ file: string, line: number, cls: string, context: string }[]} */
function collect(pattern, roots) {
  return sourceFiles(roots).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((text, i) =>
        [...text.matchAll(pattern)].map((m) => ({
          file,
          line: i + 1,
          cls: m[0],
          context: text.trim().slice(0, 120),
        })),
      ),
  );
}

/** @returns {{ file: string, line: number, cls: string, context: string }[]} */
export function collectPaletteOccurrences(roots = ["components", "app", "lib"]) {
  return collect(RAW_PALETTE, roots);
}

/**
 * Arbitrary-hex utilities, the notation `RAW_PALETTE` cannot see.
 *
 * @returns {{ file: string, line: number, cls: string, context: string }[]}
 */
export function collectArbitraryHexOccurrences(roots = ["components", "app", "lib"]) {
  return collect(ARBITRARY_HEX, roots);
}

/** The bare `#rrggbb` inside `bg-[#ea580c]`, lower-cased and expanded from a 3-digit form. */
export function hexOf(cls) {
  const raw = /#([0-9a-fA-F]{3,8})/.exec(cls)[1].toLowerCase();
  const six =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return `#${six}`;
}
