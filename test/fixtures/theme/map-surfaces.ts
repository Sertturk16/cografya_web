/**
 * Every painted map surface, per theme, exactly as `app/globals.css` declares it.
 *
 * Committed here rather than only parsed, for the reason `region-palette.test.ts` gives: this
 * is the set the floors in `lib/theme/map-surface.test.ts` are ABOUT, so a stylesheet edit
 * should make that file disagree loudly rather than quietly re-measure whatever the stylesheet
 * now says. The `matches app/globals.css` test there compares the two in both directions.
 *
 * WHAT IS NOT HERE. There is no `--map-land-line` and no second, deeper sea. Six of the eight
 * surfaces that draw Türkiye already carry their coastline on `--province-stroke`, which the
 * light palette's luminance budget was built around (`globals.css:161`) and which measures
 * 4.38:1 on the dark land and 4.21:1 on the dark sea without being redefined. The two that
 * did not — the play board and the workbench canvas — were also the only two that missed a
 * floor in EITHER theme. They adopt these tokens; their private tones are deleted, not ported.
 *
 * ELEVEN, not ten, as of review round 1: `--map-water` joins the table. It shipped before
 * this file did (`--map-water: var(--map-sea)`, inland water on the Türkiye map) and was
 * always a real surface — the original oversight was leaving it out of `MAP_SURFACES` while
 * the `matches app/globals.css` test filtered `shipped` down to `name in table`, so a real
 * `--map-*` token nobody had written down here could never make that test fail either way.
 * See `NOT_A_SURFACE` and `mapSurfacesIn` in `lib/theme/map-surface.test.ts` for the
 * prefix-based filter that replaced it and now needs `--map-water` accounted for on purpose.
 * It resolves to the sea in both themes, so its value here is the same as `--map-sea`'s, per
 * theme.
 *
 * TWELVE, THEN BACK TO ELEVEN, as of review round 2: `--map-tectonic` lived here for one
 * round and was removed again. It was meant to cover the earthquake explorer's
 * `fill-[#537b93] dark:fill-[#5a86a0]` sea-basin fill as "a real third surface, neither land
 * nor water", measured with `ratio` against `--map-sea` at 3.59:1 light / 4.14:1 dark — both
 * clearing `GRAPHICAL_MIN`. The review that produced those figures never opened the
 * component: the element is `<text>` (sea-name labels), so its floor is `TEXT_MIN` (4.5:1),
 * not `GRAPHICAL_MIN`; and it carries `opacity-60`, so its RENDERED contrast — the fill
 * blended over `--map-sea` at 60%, not the undiluted fill this table measured — is 2.03:1
 * light / 2.35:1 dark, clearing neither floor. The token documented a surface the app does
 * not have, so it came back out; the actual defect (a label at 60% opacity with no floor of
 * its own) is fixed on the component, in Task 7, not carried by a token here.
 *
 * BINDING NOTE FOR TASK 3: `.dark` must declare `--map-water` explicitly (as
 * `var(--map-sea)`, the same alias `:root` already carries), not leave it to inherit from
 * `:root`. Same decision the plan already records for `--map-graticule` and
 * `--map-unknown-land` (both identical across themes, both still declared in `.dark`): a
 * token missing from a block reads as either "unchanged from light" or "forgotten", and
 * nothing here can tell those apart except declaring it.
 *
 * ---
 *
 * WHY THIS LIVES IN `test/fixtures/theme/`, AND NOT IN `lib/theme/` WHERE IT LIVED TWICE
 * BEFORE LANDING HERE. Two separate defects, in sequence, on the same table.
 *
 * FIRST — a table shared across test files must live somewhere that registers no suites. This
 * table was originally declared and exported directly from `lib/theme/map-surface.test.ts`.
 * `region-palette.test.ts` and `continent-palette.test.ts` then imported it from there so all
 * three files measure the same eleven tokens. That was wrong: importing a `.test.ts` file does
 * not just import its exports, it EXECUTES the module, and executing `map-surface.test.ts` runs
 * every `describe`/`it` at its top level all over again inside each importer. Both
 * `region-palette.test.ts` and `continent-palette.test.ts` are themselves imported (for
 * `REGION_TINTS` / `CONTINENT_TINTS`) by `fault-palette.test.ts`, `basin-palette.test.ts`,
 * `fault-identity.test.ts` and `components/v2/continent-identity.test.ts`, so the 21 top-level
 * `map-surface.test.ts` cases registered again inside every one of those too. The suite total
 * went from 5804 to 6008 for a change that added five real assertions. Three real costs, not a
 * cosmetic one: the two cases that read and parse `app/globals.css` did that file I/O about ten
 * times a run instead of once; one genuine failure would have been reported from roughly ten
 * files at once, obscuring which file actually regressed; and the suite total stopped meaning
 * anything as a health signal. The six PRE-EXISTING cross-file imports in `lib/theme` at the
 * time (`REGION_TINTS`, `CONTINENT_TINTS`, and the tables `delta-e.ts` / `cvd.ts` export) never
 * had this problem: each is a `const` or a function from a plain module that registers no
 * suites of its own. `map-surface.test.ts` was different because it was BOTH a test file and
 * the only source of a table other files needed — importing it got the const and, silently,
 * the suite riding along with it.
 *
 * SECOND — a plain module is not enough BY ITSELF if it sits under `components/`, `app/` or
 * `lib/`. The first fix moved this table to `lib/theme/map-surfaces.ts` — a `const` export,
 * no `describe`/`it` — which closed the suite-registration problem but opened a different one:
 * `components/ui/raw-palette-count.test.ts` calls `scripts/palette-inventory.mjs`'s scanners
 * with their default roots, `["components", "app", "lib"]`, walking every `.ts`/`.tsx` file
 * that is not named `*.test.*` for literal colour values — the guard against a Tailwind class
 * "laundered" into a raw hex. `map-surface.test.ts` had always been invisible to it purely
 * because its filename matched `.test.`; a plain `lib/theme/map-surfaces.ts` does not, and the
 * eleven hex values per theme are real colour literals to that scanner, which is correct: it
 * cannot tell a hand-maintained verification fixture from a component that stopped using a
 * token. It failed two assertions — "has no bracketed colour value in any file that is not a
 * named surface" (2 occurrences) and "leaves nothing unnamed — the live count is zero, not a
 * budget" (22 occurrences, the eleven values times two themes). The fix is NOT an entry in that
 * file's `RAW_EXEMPT`/`ARBITRARY_PINNED`/`INLINE_EXEMPT`/`INLINE_PINNED` lists: a later task in
 * this plan asserts `RAW_EXEMPT` and `ARBITRARY_PINNED` are both empty as the proof that the
 * palette arm is closed, and those lists exist for "every surviving colour in the PRODUCT
 * carries a reason" — a test-expectation table paints nothing, so it does not belong in either
 * list no matter how good its reason would read.
 *
 * THE RULE, so the next person adding a table another test file needs does not repeat either
 * half: it must live in a plain module (no `describe`/`it`) so importing it registers no
 * suites, AND that module must live outside `components/`, `app/` and `lib/` — `test/` is this
 * repo's home for test-only modules (see `test/fixtures/books/book-fixtures.ts` and
 * `test/stubs/server-only.ts`), it is outside every root the colour scanners and
 * `vitest.config.ts`'s `include` walk, and it holds that property by configuration rather than
 * by a filename trick a future rename could undo.
 */
export const MAP_SURFACES = {
  light: {
    "--map-plate": "#dbe7e8",
    "--map-sea": "#dbe7e8",
    "--map-water": "#dbe7e8",
    "--map-land": "#ffffff",
    "--map-context-land": "#f1ece3",
    "--map-context-line": "#8a8078",
    "--map-water-line": "#002337",
    "--map-label": "#635a4e",
    "--map-ocean": "#0d1b2a",
    "--map-graticule": "#4d7ea8",
    "--map-unknown-land": "#64748b",
  },
  dark: {
    "--map-plate": "#152228",
    "--map-sea": "#152228",
    "--map-water": "#152228",
    "--map-land": "#201c18",
    "--map-context-land": "#2d2822",
    "--map-context-line": "#7d7468",
    "--map-water-line": "#5d8fb8",
    "--map-label": "#a89e92",
    "--map-ocean": "#070e17",
    "--map-graticule": "#4d7ea8",
    "--map-unknown-land": "#64748b",
  },
} as const;
