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
 * The second arm: a colour written as a literal VALUE inside a bracketed utility.
 *
 * WHY THIS EXISTS. `RAW_PALETTE` matches a NOTATION, not a colour, so a file can reach zero on
 * it by rewriting `bg-orange-600` as the same colour spelled some other way — and a budget of 0
 * would then assert something materially weaker than it reads.
 * `v2-marine-map-explorer.tsx` already does this three times with a plain hex (orange-600,
 * teal-600 and blue-600 as the sea-surface-temperature legend swatches).
 *
 * THE PAYLOAD IS MATCHED ANYWHERE INSIDE THE BRACKETS, and the property prefix is optional.
 * A first version of this arm required `-[#` and so caught only the plain-hex spelling. Eleven
 * others escape it, all carrying the same orange-600 payload:
 *
 *   bg-[rgb(234 88 12)] / bg-[rgb(234,88,12)] / bg-[rgb(234 88 12 / 1)]   the three rgb forms
 *   bg-[rgba(...)]  bg-[hsl(...)]  bg-[color-mix(in srgb, ... )]          other functions
 *   bg-[oklch(0.646 0.222 41.116)]                                        see below
 *   shadow-[0_0_0_2px_#ea580c]  ring-[1px_solid_#ea580c]                  hex not at [ start
 *   [color:#ea580c]  [--tw-x:#ea580c]                                     arbitrary property
 *
 * `bg-[oklch(...)]` is the one worth naming: that is Tailwind v4's OWN notation for its
 * palette — `--color-orange-600: oklch(0.646 0.222 41.116)` sits in its `theme.css` — so
 * copy-pasting the theme value verbatim is the most natural laundering there is.
 *
 * Exposure to all eleven is zero today (every root grepped), so this arm's pinned count does
 * not move; what moves is what the count is able to claim.
 *
 * `[var(--x)]` IS DELIBERATELY NOT MATCHED, and this is not an oversight to be tidied up later.
 * `fill-[var(--region-marmara)]` is the GOAL state — it is how `lib/theme/region-identity.ts`
 * binds every region, because these tokens are not in Tailwind's colour namespace. A `var()`
 * reference names a token; a hex or a colour function inlines a value. Only the second is the
 * thing this arm is for.
 *
 * A `var()` is SUBTRACTED before the payload is looked for, not used as a veto — see
 * `stripVars`. `bg-[var(--map-sea,#dbe7e8)]` carries a literal hex, but it is that token's own
 * FALLBACK, inside the `var()`; ten of those exist across five map components and they are
 * token references, which is the state this branch is driving towards.
 *
 * DO NOT say they are governed elsewhere. They are not: `token-binding.test.ts`'s escape rule is
 * `var\(--color-[a-z-]+,\s*#hex\)` and every one of the ten names `--map-sea`, so that rule
 * never matches them. What they are exposed to is FALLBACK DRIFT — the fallback silently ceasing
 * to equal the token — and that is closed where it belongs, by pinning each fallback to
 * `app/globals.css` in `components/ui/token-binding.test.ts`, the same fix
 * `lib/theme/region-identity.ts`'s `fillValue` gets from `region-identity.test.ts`.
 *
 * Counted SEPARATELY, not folded into `RAW_PALETTE`'s total: most of these 75 are legitimate map
 * surfaces (sea, neighbour land, inland water) whose values were measured against fixed
 * backdrops and which belong to the `--map-*` / `--province-*` sets T-031d owns. A single number
 * mixing them with laundered palette values would be a number nobody could act on.
 */
const COLOR_PAYLOAD = "#[0-9a-fA-F]{3,8}|\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\\(";

/** Any bracketed utility value, colour or not. The payload test happens after `stripVars`. */
export const BRACKETED = /(?:\b[a-z][a-z0-9-]*-)?\[[^\]]*\]/g;

const PAYLOAD = new RegExp(COLOR_PAYLOAD);

/**
 * Remove every `var(--token)` / `var(--token, fallback)` from a bracket's contents.
 *
 * SUBTRACTION, NOT VETO, and the difference is a laundering route. The first version of this
 * arm excluded a bracket if `var(` appeared ANYWHERE inside it, which means one decorative
 * `var(--ring)` immunised the whole utility and everything beside it:
 *
 *   bg-[color-mix(in_oklab,var(--x),#ea580c)]                 orange-600, beside a var
 *   bg-[rgb(var(--y)_88_12)]                                  a var INSIDE the colour function
 *   bg-[color-mix(in_srgb,var(--a)_50%,oklch(0.646 0.222 41.116))]
 *   shadow-[0_0_0_2px_#ea580c,0_0_0_4px_var(--ring)]          two shadows, one laundered
 *   [color:#ea580c;--x:var(--y)]                              two declarations
 *   bg-[linear-gradient(var(--a),#ea580c)]                    a gradient stop
 *
 * Stripping the `var()` WITH ITS FALLBACK and then looking at what is left keeps every one of
 * those and still ignores the shapes that must be ignored: `fill-[var(--region-marmara)]`
 * leaves nothing, and `bg-[var(--map-sea,#dbe7e8)]` leaves nothing because the hex was the
 * token's own fallback, inside the `var()` — not a value sitting next to it.
 *
 * Looped because `var()` nests: `var(--a, var(--b, #fff))` needs two passes, the inner match
 * first (the fallback group excludes parentheses so it cannot swallow the outer call).
 */
export function stripVars(value) {
  let previous;
  let out = value;
  do {
    previous = out;
    out = out.replace(/var\((--[a-z0-9-]+)(?:\s*,[^()]*)?\)/g, "");
  } while (out !== previous);
  return out;
}

/** Does this bracketed utility inline a colour VALUE, once token references are removed? */
export function inlinesAColor(cls) {
  const inner = /\[([^\]]*)\]/.exec(cls);
  return inner === null ? false : PAYLOAD.test(stripVars(inner[1]));
}

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
 * Bracketed utilities carrying a literal colour value, the spellings `RAW_PALETTE` cannot see.
 *
 * @returns {{ file: string, line: number, cls: string, context: string }[]}
 */
export function collectArbitraryColorOccurrences(roots = ["components", "app", "lib"]) {
  return collect(BRACKETED, roots).filter((o) => inlinesAColor(o.cls));
}

/**
 * The bare `#rrggbb` inside `bg-[#ea580c]`, lower-cased and expanded from a 3-digit form, or
 * `null` when the value is spelled as a colour FUNCTION rather than a hex.
 */
export function hexOf(cls) {
  const match = /#([0-9a-fA-F]{3,8})/.exec(cls);
  if (match === null) return null;
  const raw = match[1].toLowerCase();
  const six =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return `#${six}`;
}
