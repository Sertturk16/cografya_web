import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The reading and play surfaces. `design-system` is deliberately absent: it is internal
 * tooling that brings its own chrome, and including it would let showcase markup answer for
 * product markup — the shape of vacuity `components/ui/orphan.test.ts` guards against by
 * naming its roots instead of globbing `app/`.
 */
const PAGE_ROOTS = ["app/[locale]/(site)", "app/[locale]/(play)"] as const;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });
}

export function walkPages(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => path.endsWith("page.tsx"))
    .sort();
}

/** Comments stripped: a docblock quoting a className must not answer for the markup. */
export function sourceOf(path: string): string {
  return stripComments(readFileSync(path, "utf8"));
}

const label = (path: string) => relative(repoRoot, path);

/**
 * The page BODY wrapper: the element carrying the container width. Both families are matched
 * — `max-w-7xl mx-auto …` and `container mx-auto px-4 max-w-7xl …` — because the second is
 * the same intent with the Tailwind tokens written in the other order, and a counter that saw
 * only the first would report progress while five pages kept their own spelling.
 */
const BODY_WRAPPER = /className="((?:[^"]*\b(?:max-w-7xl|container)\b)[^"]*)"/g;

function bodySpellings(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of walkPages()) {
    for (const match of sourceOf(path).matchAll(BODY_WRAPPER)) {
      const spelling = match[1]!.trim().replace(/\s+/g, " ");
      found.set(spelling, [...(found.get(spelling) ?? []), label(path)]);
    }
  }
  return found;
}

/**
 * EXACT, not a ceiling. `docs/design.md` records what a ceiling is worth here: a raw-palette
 * count "moved without anyone noticing" from 749 to 895 because it lived only in a comment.
 * An exact number makes raising it and lowering it equally deliberate, and equally visible in
 * a diff.
 *
 * Measured 2026-09-17 against the real tree, not predicted: 17 distinct spellings across 39
 * body-width elements in the 37 pages (three `(play)` screens carry none, by design — they are
 * fullscreen game screens that opt out of the reading-surface chrome). Not the 8 guessed before
 * the scan ran. See task-1-report.md for the full list; every entry was checked by hand against
 * its source line to confirm it is a real `className` on an element carrying the container
 * width — including the sticky quicknav/tab-strip wrappers in `turkiye/bolge/[slug]`,
 * `turkiye/bolge` and `dunya/[slug]`, which align to the same edges as the body content and
 * carry the same `container`/`max-w-7xl` tokens, not just the primary content wrapper.
 *
 * Task 3 (2026-09-17) moved the five family-B pages (`container mx-auto px-4 max-w-7xl …`) onto
 * `PageContainer`, which renders as a component call rather than a literal `className` — those
 * five wrapper elements simply stop matching this scanner, taking 2 spellings and 5 elements
 * with them: 15 distinct spellings across 34 elements. The three sticky quicknav/tab-strip bars
 * named above are UNCHANGED (out of scope — they are not page body wrappers) and still count
 * toward this total. See task-3-report.md for the full before/after list.
 */
export const PAGE_BODY_SPELLINGS = 15;

describe("the scanner itself", () => {
  it("walked the product surface and nothing else", () => {
    const pages = walkPages().map(label);
    expect(pages.length).toBe(37);
    expect(pages).toContain("app/[locale]/(site)/araclar/page.tsx");
    expect(pages.some((p) => p.includes("design-system"))).toBe(false);
  });

  it("strips comments — a className in prose does not count", () => {
    const stripped = stripComments('const a = 1; /* className="max-w-7xl mx-auto" */');
    expect(stripped).not.toContain("max-w-7xl");
  });

  it("the BODY_WRAPPER pattern matches source that carries one", () => {
    const hit = [...'<div className="max-w-7xl mx-auto px-4">'.matchAll(BODY_WRAPPER)];
    expect(hit).toHaveLength(1);
  });
});

describe("page body wrappers converge on one spelling", () => {
  it("has exactly the recorded number of spellings", () => {
    const spellings = bodySpellings();
    expect(
      spellings.size,
      `spellings:\n${[...spellings].map(([s, f]) => `  ${f.length}x ${s}`).join("\n")}`,
    ).toBe(PAGE_BODY_SPELLINGS);
  });
});
