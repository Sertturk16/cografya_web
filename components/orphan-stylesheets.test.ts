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
 * Not a count. The eleven survivors are listed in `docs/architecture.md` as a description, not a
 * rule, and pinning the number here would fail the day a component legitimately grows or drops
 * one. The rule is the relationship: a stylesheet exists because something imports it.
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
const sources = ROOTS.flatMap((r) =>
  walk(join(repoRoot, r), (n) => /\.tsx?$/.test(n) && !n.includes(".test.")),
).map((file) => readFileSync(file, "utf8"));

describe("CSS Modules", () => {
  it("finds both the stylesheets and the code that could import them", () => {
    // Anti-vacuity in both directions: no stylesheets means nothing is checked, and no sources
    // means every stylesheet fails.
    expect(stylesheets.length, "*.module.css files").toBeGreaterThan(0);
    expect(sources.length, "component sources").toBeGreaterThan(100);
  });

  it("are all imported by something", () => {
    const orphans = stylesheets
      .filter((sheet) => {
        const name = sheet.slice(sheet.lastIndexOf("/") + 1);
        return !sources.some((source) => source.includes(name));
      })
      .map((sheet) => sheet.slice(repoRoot.length));
    expect(orphans).toEqual([]);
  });
});
