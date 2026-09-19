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
import { stripComments } from "../lib/test-support/strip-comments.ts";

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
/**
 * A colour written as a VALUE: a hex, or the opening of a colour function.
 *
 * THE HEX CARRIES A TRAILING GUARD, and it was the inline arm that needed it. `{3,8}` is
 * greedy but it still matches a PREFIX of a longer word: `href="#afet"` yields `#afe`, a
 * perfectly well-formed three-digit hex that is not a colour at all. Inside brackets that
 * never bit, because a bracketed value ends at `]`; outside them the tree is full of fragment
 * ids. `(?![0-9a-zA-Z_])` rejects it and touches nothing else — every real spelling ends at a
 * quote, a bracket, a comma, a semicolon or a space.
 */
const COLOR_PAYLOAD =
  "#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])|\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\\(";

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

/**
 * The raw-palette occurrences that are allowed to remain, BY FILE AND BY COUNT.
 *
 * ## Why this replaced a budget
 *
 * The arm ended T-031c reading `expect(found.length).toBeLessThanOrEqual(15)`. A `<=` on a
 * number cannot fail when the count FALLS, and it cannot say which 15 are allowed: a new
 * `text-rose-500` in a new component passed that assertion as long as somebody deleted a
 * graticule stroke in the same commit. The budget only ever tripped on growth, which is the
 * least likely way this number moves now that the application work is done.
 *
 * A named row with an exact count fails in both directions and names the file, which is why
 * this arm ended by DELETING its one entry rather than editing a digit. The arm is closed:
 * the empty array below is the assertion, not a placeholder waiting for a row.
 *
 * Task 10 deleted the one row this table ever held: `components/v2/v2-world-map-explorer.tsx`
 * bound its graticule, its neighbour-land tones and its hover/selected highlight to
 * `--map-graticule`, `--map-unknown-land` and `--map-context-line`, so nothing in the tree
 * carries a raw palette class any more. `RAW_EXEMPT` is `[]`.
 */
export const RAW_EXEMPT = [];

/** Is this file one of the named raw-palette deferrals? An exact compare, like `isInlineExempt`. */
export function isRawExempt(file) {
  return RAW_EXEMPT.some((e) => file === e.file);
}

/**
 * The bracketed colour VALUES that are allowed to remain, by file and by count.
 *
 * Same replacement, same reason. `ARBITRARY_COLOR_BUDGET = 72` had not moved for twelve
 * commits, so a `<=` on it was a tripwire armed against the one thing that was not going to
 * happen. What these 72 actually are is narrow and nameable: painted map surfaces — sea,
 * land, borders, inland water, the graticule — plus the workbench's canvas, on six explorer
 * components and two locator mini-maps. Pinning them per file makes a new `bg-[#ea580c]` in
 * a component fail BY NAME instead of being absorbed by a 72-wide allowance.
 *
 * `v2-header.tsx` held the table's one non-map row: `dark:text-[#e2896a]` on the wordmark,
 * recorded as a finding rather than folded in with the maps. T-031d Task 11 closed it —
 * `--primary-strong` is already declared in `.dark` and measures 8.99:1 on `--background`
 * against the literal's 7.12:1, so the wordmark now binds to a token instead of a hex, and the
 * table's last row is deleted rather than edited. `ARBITRARY_PINNED` is `[]`: the arm is
 * closed, and the empty array is the assertion, not a placeholder waiting for a row.
 */
export const ARBITRARY_PINNED = [];

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
 *
 * NOTHING IS EXCLUDED ANY MORE. This used to filter out `turkiye/[slug]/page.tsx`, the one file
 * T-033 owned and this branch did not, and a staleness test in `raw-palette-count.test.ts` red
 * on the merge to say so. T-033 has landed, the file carries no raw palette class, and the scope
 * is now simply every source file under the roots — so the exclusion, its filter and its
 * staleness test are gone rather than kept as an empty list nothing can trip over.
 */
function sourceFiles(roots) {
  return roots.flatMap(walk);
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
 * THE THIRD ARM: a colour value inlined OUTSIDE any bracketed utility.
 *
 * ## The hole the first two arms leave, measured
 *
 * Arm one matches a class NOTATION (`bg-emerald-600`). Arm two matches a literal inside a
 * bracketed utility (`bg-[#059669]`). Neither can see a colour written where Tailwind never
 * looks — an SVG presentation attribute, a `stopColor`/`floodColor` prop, a canvas
 * `fillStyle`, a module constant, the arm of a ternary. That is not hypothetical: when this
 * arm was written the live population was **40**, and **seven** of those were Tailwind palette
 * values spelled as literals —
 *
 *   - `v2-world-map-explorer` `floodColor` amber-500, the glow around the hovered country
 *   - `v2-marine-map-explorer` two dead gradient stops (cyan-500, sky-600), the selected
 *     station pin (amber-500), and a label plate as `rgba(15, 23, 42, 0.85)`, i.e. slate-900
 *   - `v2-tool-workbench` the drawn area polygon, `rgba(5, 150, 105, 0.25)` + `#059669`,
 *     i.e. emerald-600 twice — **in a file the raw-palette arm had already reported as 0**
 *
 * That last one is the whole argument for this arm existing: the branch was shipping a zero
 * that was not a zero, in the same shape it had already closed twice for classes and once for
 * brackets.
 *
 * ## What it does not count, and why each exclusion is principled
 *
 * COMMENTS ARE STRIPPED, through `lib/test-support/strip-comments.ts` — the one scanner this
 * repo has for the job. A docblock quoting `#ea580c` while explaining why it was removed is
 * prose, and pinning prose forces a historical note to be rewritten every time a value moves.
 *
 * WHAT ARM TWO ALREADY COUNTS IS MASKED OUT, so the two numbers partition the population
 * rather than overlapping it. A bracketed utility that `inlinesAColor` calls a colour is
 * blanked before this arm reads the line; one that it does not — `bg-[var(--map-sea,#dbe7e8)]`
 * — is left in place, and then `stripVars` removes the token reference and its own fallback.
 * Both arms therefore share `COLOR_PAYLOAD`, `BRACKETED`, `stripVars` and `sourceFiles`: one
 * reader for the notation, one reader for the scope.
 *
 * `var(--token, #hex)` IS NOT COUNTED, for the reason arm two already gives: the hex is that
 * token's own fallback, inside the `var()`, so the value is a token reference. Its exposure is
 * DRIFT, and drift is pinned in `components/ui/token-binding.test.ts`, in both directions and
 * per token — which is also why closing a laundering by moving it to a `var()` fallback is not
 * laundering in the other direction: the fallback joins a census that has to be re-recorded.
 *
 * ## NO `line` FIELD, AND THAT IS DELIBERATE
 *
 * `stripComments` collapses each comment to a single space, so a block comment of ten lines
 * becomes one. A line number taken after stripping names a line the file does not have, and a
 * failure message pointing at the wrong line is worse than one pointing at none. Both budget
 * assertions and every exemption in `INLINE_EXEMPT` are per FILE, which is the granularity
 * this arm needs; `grep` finds the value inside the file it names.
 *
 * @returns {{ file: string, cls: string }[]}
 */
export function collectInlineColorOccurrences(roots = ["components", "app", "lib"]) {
  const payload = new RegExp(COLOR_PAYLOAD, "g");
  return sourceFiles(roots).flatMap((file) => {
    const code = stripComments(readFileSync(file, "utf8"));
    // LINE BY LINE, like the other two arms, and for a reason this arm found the hard way.
    // `BRACKETED` and `stripVars` both allow their contents to run to a closing delimiter, and
    // over a whole file that delimiter can be pages away: `app/[locale]/layout.tsx` writes its
    // `themeColor` as a multi-line array, so a whole-file pass masked the array as one
    // "bracketed colour utility" and lost both of its hexes. A real bracketed utility is a
    // class string and never spans a line.
    return code.split("\n").flatMap((text) => {
      const outsideBrackets = text.replace(BRACKETED, (m) => (inlinesAColor(m) ? " " : m));
      return [...stripVars(outsideBrackets).matchAll(payload)].map((m) => ({ file, cls: m[0] }));
    });
  });
}

/**
 * Files whose colours CANNOT be a token, because nothing that resolves one is loaded.
 *
 * Every entry is a context with no stylesheet at all, and each file says so in its own
 * docblock — this list transcribes that, it does not decide it. The count is part of the
 * entry so an exemption cannot quietly grow: `raw-palette-count.test.ts` asserts each file
 * still carries exactly this many, in both directions.
 */
export const INLINE_EXEMPT = [
  {
    file: "app/global-error.tsx",
    count: 6,
    why: "the root boundary replaces the whole document when the root layout itself throws; its own docblock records that neither globals.css nor the next-intl context is guaranteed to be present",
  },
  {
    file: "app/[locale]/opengraph-image.tsx",
    count: 5,
    why: "Satori rasterises this to PNG outside a browser and resolves no custom properties",
  },
  {
    file: "app/manifest.ts",
    count: 2,
    why: "the web app manifest is JSON read by the OS shell, not CSS",
  },
  {
    file: "app/[locale]/layout.tsx",
    count: 2,
    why: "`themeColor` becomes a <meta> tag the browser chrome reads before any stylesheet applies; the file's own comment says the metadata layer cannot read CSS variables",
  },
  {
    file: "lib/brand/glyph.ts",
    count: 2,
    why: "builds a standalone SVG string for the favicon and apple-icon, served without the stylesheet",
  },
  {
    file: "lib/map/base-map-svg.ts",
    count: 5,
    why: "builds the shared locator silhouettes as standalone SVG documents served through `<img src>`, which cannot see the page's CSS; its own docblock says so and `base-map-svg.test.ts` asserts each hex is byte-identical to the globals.css token it transcribes, so a retune fails CI rather than splitting the palette",
  },
];

/**
 * The inlined colour values that are allowed to remain in a file that DOES have a stylesheet.
 *
 * ## Why this table exists, and why the budget it replaces does not
 *
 * `INLINE_COLOR_BUDGET = 16` was the last `<=` in the counter. Its failure message described
 * exactly the right defect and the assertion could not detect it: the number was the sum over
 * six files, so a new `fillStyle` in a seventh passed as long as a dead gradient stop went in
 * the same commit. Splitting it per file with `toBe` makes the live population **0 by
 * construction** — an occurrence is either a named row here, a no-stylesheet row in
 * `INLINE_EXEMPT`, or a failure — and every surviving colour carries a reason. The split is
 * 22 exempt and 11 pinned, 33 in total.
 *
 * These eleven are not the same thing as the five above. A token WOULD resolve in each of
 * them; they are pinned because they are painted map/canvas values owned by T-031d, or a
 * white mark drawn on top of a map surface whose own contrast was measured against that
 * surface rather than against any page background.
 */
export const INLINE_PINNED = [
  {
    file: "components/v2/v2-marine-map-explorer.tsx",
    count: 4,
    why: "the station pins drawn on the basin map: the white pin stroke, the white core, the white label mark and the 30% white halo around the selected one, all measured against the sea plate they sit on rather than against `--background`",
  },
  {
    file: "components/v2/v2-tool-workbench.tsx",
    count: 2,
    why: "two `ctx.fillStyle` calls on the measurement canvas — a white label and its 60% black plate. Canvas takes a colour VALUE and cannot read a custom property without a `getComputedStyle` round trip per frame",
  },
  // T-031d Task 13 dropped the `v2-earthquake-explorer.tsx` row that lived here: the white
  // on-disc magnitude number, an SVG `fill="#ffffff"` presentation attribute measured against
  // that disc's own fill rather than the page. A token (`--eq-mag-fg`) resolves the same
  // relationship in both themes now, so it moved to `fill-[var(--eq-mag-fg)]` and left this
  // table rather than staying pinned at a stale reason. See `raw-palette-count.test.ts`'s
  // addendum for the running total this leaves.
  {
    file: "components/v2/v2-region-locator-map.tsx",
    count: 1,
    why: "the white hover stroke on a region silhouette, one arm of a ternary whose other arm is the bound stroke colour",
  },
];

/** Is this file one of the named painted-surface pins? An exact compare, like `isInlineExempt`. */
export function isInlinePinned(file) {
  return INLINE_PINNED.some((e) => file === e.file);
}

/**
 * Is this file one of the no-stylesheet contexts?
 *
 * AN EXACT COMPARE, NOT `endsWith`, and that was a deliberate difference from the `EXCLUDED` list
 * this file used to carry.
 * `endsWith` reads as harmless on a path list and is not: a file at `lib/app/manifest.ts` ends
 * with `app/manifest.ts`, so it would have been exempted by an entry written for a different
 * file. The count assertion in `raw-palette-count.test.ts` catches that at the test level --
 * the exempt file's own total no longer matches -- but a guard whose first line of defence is
 * a second guard is one edit away from being neither. `collect` builds every path by joining
 * the root it was given, so for the default roots these strings are exactly what it produces.
 *
 * The contrast this paragraph drew was with `EXCLUDED`, which kept `endsWith` because its own
 * staleness test re-read the named file from disk by that same relative path. That list is gone
 * (see {@link sourceFiles}); the rule for THIS list is unchanged and is the stricter of the two.
 */
export function isInlineExempt(file) {
  return INLINE_EXEMPT.some((e) => file === e.file);
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
