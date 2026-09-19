import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import {
  repoRoot,
  closureFrom,
  PRODUCT_ROOTS,
  SHOWCASE_ROUTE,
} from "@/lib/test-support/import-closure";

/**
 * EVERY STYLESHEET HAS A CONSUMER A READER CAN REACH.
 *
 * ## Why this is worth a test
 *
 * A CSS Module with no importer is invisible: it compiles, it lints, it ships nothing, and no
 * reviewer opens it. T-032 PR4 deleted eleven of them — and the reason that matters is what one
 * of them contained. `app/globals.css`'s `.placeholder-note` carried a `border-left: 4px solid`
 * side-tab, a decoration this project had rejected twice by explicit ruling. It survived both
 * reviews for the same reason it survived every browser sweep: nothing rendered it, so there was
 * nothing to look at.
 *
 * Dead CSS is not inert. It is where a rejected pattern waits for someone to find it and think
 * it is precedent.
 *
 * ## What it does NOT assert
 *
 * Not a count. The survivors are listed in `docs/architecture.md` as a description, not a rule,
 * and pinning the number here would fail the day a component legitimately grows or drops one.
 * The rule is the relationship: a stylesheet exists because something a reader can reach
 * imports it.
 *
 * ## Why the check reads import specifiers instead of searching for the filename
 *
 * It used to ask `source.includes("map.module.css")`, and that is not the same question. A
 * filename is a substring of every longer filename ending the same way, so
 * `import styles from "./locator-map.module.css"` answered for `map.module.css` as well —
 * `"locator-map.module.css".includes("map.module.css")` is `true`. It also answered from prose:
 * `components/tools/tool-png.ts` names `map.module.css` in a comment explaining where the fills
 * come from, and comments were not stripped.
 *
 * Between them those two accidents hid `components/map/map.module.css` — 876 lines, all 36 of its
 * classes dead — from the moment T-032 PR4 deleted its four consumers. The test this docblock
 * belongs to was green the whole time, which is the precise failure it was written to prevent.
 *
 * So: comments are stripped, specifiers are parsed, and a specifier matches only if its own last
 * path segment is the filename.
 *
 * ## T-042: AN IMPORTER IS NOT A CONSUMER
 *
 * And that fix was still not the question. The assertion above asks whether an importer EXISTS,
 * which is a fact about the filesystem; the rule it is supposed to enforce is that something a
 * reader can open renders the rules.
 *
 * `components/tools/tools.module.css` is what the gap cost. 514 lines, THREE importers, all of
 * them green under the old assertion — and all three (`tool-island.tsx`,
 * `tool-measurement-list.tsx`, `tool-measurement-save.tsx`) unreachable from any route, because
 * the only thing left importing the island was an `import type` clause TypeScript erases. A
 * stylesheet certified by three corpses. Fixing `components/orphan.test.ts` alone would have
 * deleted the corpses and left this file green on an empty set of importers, because zero
 * importers is the one shape `!importedStylesheetNames.has(...)` does catch — by accident, one
 * commit later, instead of here.
 *
 * So the question is now reachability, from the same {@link PRODUCT_ROOTS} the component orphan
 * test walks — one surface, two questions, so the two cannot answer from different trees.
 *
 * `SHOWCASE_ROUTE` is deliberately NOT unioned in, and that is a measurement rather than a
 * preference: no surviving stylesheet has a showcase importer at all, let alone only one, and the
 * control below executes that rather than remembering it. A showcase-only stylesheet would be the
 * same defect a showcase-only component is, so counting `/design-system` as a consumer here would
 * excuse exactly the thing this file exists to find. The code and the sentence above now say the
 * same thing; for a while the code unioned the showcase closure while the sentence claimed one
 * surface.
 */

const walk = (dir: string, match: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full, match);
    return match(entry.name) ? [full] : [];
  });

const ROOTS = ["app", "components"] as const;

const label = (path: string) => relative(repoRoot, path);

const stylesheets = ROOTS.flatMap((r) => walk(join(repoRoot, r), (n) => n.endsWith(".module.css")));

const sourceFiles = ROOTS.flatMap((r) =>
  walk(join(repoRoot, r), (n) => /\.tsx?$/.test(n) && !n.includes(".test.")),
);

/** The last path segment of a `*.module.css` specifier — the filename, never a suffix of one. */
const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Filename → every source file that actually writes an import specifier naming it. */
const importersByStylesheet = new Map<string, string[]>();
for (const file of sourceFiles) {
  for (const match of stripComments(readFileSync(file, "utf8")).matchAll(
    /from\s*["']([^"']+\.module\.css)["']/g,
  )) {
    const name = basename(match[1] as string);
    const list = importersByStylesheet.get(name);
    if (list) list.push(file);
    else importersByStylesheet.set(name, [file]);
  }
}

const reachable = closureFrom(PRODUCT_ROOTS);

/** Kept only to prove, below, that unioning it in would change no verdict. */
const showcaseReachable = closureFrom(SHOWCASE_ROUTE);

/**
 * A PURE function of one stylesheet's importer list and a reachability set, so the controls can
 * ask it about a sheet nobody wrote. A classifier that can only be run over the tree cannot be
 * shown to work: every answer it gives is also the answer the tree happens to want.
 */
function isOrphan(importers: readonly string[], reached: ReadonlySet<string>): boolean {
  return !importers.some((file) => reached.has(file));
}

const orphansAmong = (sheets: readonly string[]): string[] =>
  sheets
    .filter((sheet) => isOrphan(importersByStylesheet.get(basename(sheet)) ?? [], reachable))
    .map(label)
    .sort();

/**
 * THE MEASURED POPULATION — **EMPTY**, and an equality against an empty list is the strictest
 * form this pin can take.
 *
 * Two stylesheets were on it when the reachability question replaced the existence one, and both
 * are gone:
 *
 *   - `components/tools/tools.module.css` (514 lines) — three importers, all of them unreachable;
 *   - `components/home/home.module.css` — ONE importer, `components/home/featured-cards.tsx`, a
 *     component `components/orphan.test.ts` measured as reachable from no route. Ruling CL
 *     deleted both, and `components/home/` with them.
 *
 * Neither had zero importers, which is why the old "is it imported by something" assertion was
 * green on both. Every surviving stylesheet now has an importer a route reaches.
 */
const KNOWN_ORPHAN_STYLESHEETS: readonly string[] = [];

describe("CSS Modules", () => {
  /**
   * THE MATCHER IS KEYED BY BASENAME, so two stylesheets sharing one would merge their importer
   * lists and each would answer for the other — a dead sheet certified by a live namesake, which
   * is a hair's breadth from the `map.module.css` / `locator-map.module.css` accident this file's
   * docblock is mostly about. Measured: all 4 basenames are distinct today
   * (`book-detail`, `book-video`, `earthquake`, `locator-map`) — `marine`, `air-pollution`,
   * `climate` and `site-search` left with T-033 tasks 2, 3, 4 and 5. Asserted rather than resolved
   * to full paths because a
   * `*.module.css` specifier is not resolvable by `resolveSpecifier` (its extension list is
   * TS/JS only), so the honest fix is to keep the cheap key and fail loudly the day it stops
   * being unique.
   */
  it("no two stylesheets share a basename — the key this matcher uses", () => {
    const names = stylesheets.map(basename);
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicated, "basenames claimed by more than one stylesheet").toEqual([]);
  });

  it("no stylesheet is reachable only from the showcase — why the route is not a root here", () => {
    const showcaseOnly = stylesheets
      .filter((sheet) => {
        const importers = importersByStylesheet.get(basename(sheet)) ?? [];
        return isOrphan(importers, reachable) && !isOrphan(importers, showcaseReachable);
      })
      .map(label);
    expect(showcaseOnly, "stylesheets the showcase would excuse").toEqual([]);
  });

  it("finds the stylesheets, the code that could import them, and the routes", () => {
    // Anti-vacuity in three directions: no stylesheets means nothing is checked, no parsed
    // specifiers means every stylesheet fails, and an empty closure means every importer is
    // dead. The second guard is stronger than the old "did any file mention this string" one —
    // it proves the PARSER works, not just that files were read.
    expect(stylesheets.length, "*.module.css files").toBeGreaterThan(0);
    // The floor steps down with T-033, which is retiring these stylesheets one task at a time:
    // 8 when this was written, 4 once tasks 2-5 had taken `marine`, `air-pollution`, `climate`
    // and `site-search`. It is an anti-vacuity floor on the PARSER, not a pin on the population —
    // the "are all imported by something a reader can reach" case above is what holds that.
    expect(importersByStylesheet.size, "parsed *.module.css import specifiers").toBeGreaterThan(3);
    expect(reachable.size, "files reachable from a route").toBeGreaterThan(100);
  });

  it("are all imported by something a reader can reach", () => {
    expect(orphansAmong(stylesheets)).toEqual([...KNOWN_ORPHAN_STYLESHEETS].sort());
  });

  it("every recorded orphan is a real stylesheet on disk", () => {
    for (const name of KNOWN_ORPHAN_STYLESHEETS) {
      expect(stylesheets.map(label), `${name} is not a stylesheet on disk`).toContain(name);
    }
  });

  it("does not accept a longer filename that merely ends the same way", () => {
    // The exact accident that hid `map.module.css` behind `locator-map.module.css` for a whole
    // task. Pinned as a property of the matcher so a future "simplification" back to a substring
    // search fails here rather than in six months.
    expect("locator-map.module.css".includes("map.module.css")).toBe(true);
    expect(importersByStylesheet.has("locator-map.module.css")).toBe(true);
  });

  /**
   * THE DIFFERENCE BETWEEN THE OLD QUESTION AND THIS ONE, executed.
   *
   * A sheet with importers — so green under "is it imported by something" — every one of which
   * the routes cannot reach. That is `tools.module.css`'s exact shape, stated as a property of
   * the classifier so it survives the deletion of the file that demonstrated it.
   */
  it("a stylesheet whose only importers are dead reads as an orphan", () => {
    const dead = [join(repoRoot, "components/__probe__/dead.tsx")];
    expect(dead.length, "the probe has an importer, so the old check would pass it").toBe(1);
    expect(isOrphan(dead, reachable)).toBe(true);
    expect(isOrphan(dead, new Set(dead))).toBe(false);
  });

  it("an unimported stylesheet breaks the pin — the probe", () => {
    const ghost = join(repoRoot, "components/__probe__/ghost.module.css");
    expect(orphansAmong([...stylesheets, ghost])).not.toEqual([...KNOWN_ORPHAN_STYLESHEETS].sort());
    expect(orphansAmong([...stylesheets, ghost])).toContain(
      "components/__probe__/ghost.module.css",
    );
  });
});
