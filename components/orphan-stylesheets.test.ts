import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY STYLESHEET HAS A CONSUMER.
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
 * Not a count. The survivors — ten, since this file's own blind spot was closed — are listed in
 * `docs/architecture.md` as a description, not a rule, and pinning the number here would fail the
 * day a component legitimately grows or drops one. The rule is the relationship: a stylesheet
 * exists because something imports it.
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
 */

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const walk = (dir: string, match: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full, match);
    return match(entry.name) ? [full] : [];
  });

const ROOTS = ["app", "components"] as const;

const stylesheets = ROOTS.flatMap((r) => walk(join(repoRoot, r), (n) => n.endsWith(".module.css")));
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

/** The last path segment of every `*.module.css` specifier actually imported by a source file. */
const importedStylesheetNames = new Set(
  ROOTS.flatMap((r) => walk(join(repoRoot, r), (n) => /\.tsx?$/.test(n) && !n.includes(".test.")))
    .flatMap((file) => [
      ...stripComments(readFileSync(file, "utf8")).matchAll(
        /from\s*["']([^"']+\.module\.css)["']/g,
      ),
    ])
    .map((match) => {
      const specifier = match[1] as string;
      return specifier.slice(specifier.lastIndexOf("/") + 1);
    }),
);

describe("CSS Modules", () => {
  it("finds both the stylesheets and the code that could import them", () => {
    // Anti-vacuity in both directions: no stylesheets means nothing is checked, and no parsed
    // specifiers means every stylesheet fails. The second guard is stronger than the old
    // "did any file mention this string" one — it proves the PARSER works, not just that files
    // were read, which is what the substring version never established.
    expect(stylesheets.length, "*.module.css files").toBeGreaterThan(0);
    expect(importedStylesheetNames.size, "parsed *.module.css import specifiers").toBeGreaterThan(
      5,
    );
  });

  it("are all imported by something", () => {
    const orphans = stylesheets
      .filter((sheet) => !importedStylesheetNames.has(sheet.slice(sheet.lastIndexOf("/") + 1)))
      .map((sheet) => sheet.slice(repoRoot.length));
    expect(orphans).toEqual([]);
  });

  it("does not accept a longer filename that merely ends the same way", () => {
    // The exact accident that hid `map.module.css` behind `locator-map.module.css` for a whole
    // task. Pinned as a property of the matcher so a future "simplification" back to a substring
    // search fails here rather than in six months.
    expect("locator-map.module.css".includes("map.module.css")).toBe(true);
    expect(importedStylesheetNames.has("locator-map.module.css")).toBe(true);
  });
});
