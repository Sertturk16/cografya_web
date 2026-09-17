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
 * The three sticky in-page section-index bars, permanently exempt — named by file and EXACT
 * spelling, in the idiom `components/ui/token-binding.test.ts` uses for `ACHROMATIC_EXEMPTIONS`.
 * Their own className is layout (a horizontally scrolling pill row: `flex items-center gap-2
 * text-xs whitespace-nowrap`, one of them also `overflow-x-auto py-2.5 font-semibold
 * scrollbar-none`), not rhythm — `PageContainer`'s closed `space` union has no member for it and
 * is not getting one for three bars. They align to the body's edges and so still carry
 * `max-w-7xl`/`mx-auto`, which is why the scanner still sees them; that is scope, not a defect
 * in the exemption.
 */
const BODY_WRAPPER_EXEMPTIONS: ReadonlyArray<readonly [string, string, string]> = [
  [
    "app/[locale]/(site)/turkiye/bolge/page.tsx",
    "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto py-2.5 text-xs font-semibold scrollbar-none",
    "Sticky quicknav bar (scrolling pill row). Layout, not rhythm.",
  ],
  [
    "app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx",
    "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 text-xs whitespace-nowrap",
    "Sticky section-index bar. Layout, not rhythm.",
  ],
  [
    "app/[locale]/(site)/dunya/[slug]/page.tsx",
    "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 text-xs whitespace-nowrap",
    "Sticky section-index bar. Layout, not rhythm.",
  ],
];

/** `bodySpellings()` minus the exemptions above — one file/spelling pair removed per row, so a
 * spelling with other (non-exempt) files still reports them. */
function nonExemptBodySpellings(): Map<string, string[]> {
  const found = bodySpellings();
  for (const [file, spelling] of BODY_WRAPPER_EXEMPTIONS) {
    const files = found.get(spelling);
    if (!files) continue;
    const idx = files.indexOf(file);
    if (idx === -1) continue;
    const remaining = [...files.slice(0, idx), ...files.slice(idx + 1)];
    if (remaining.length > 0) found.set(spelling, remaining);
    else found.delete(spelling);
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
 *
 * Task 4a (2026-09-17) moved the 24 mechanical family-A pages (`max-w-7xl mx-auto px-4 sm:px-6
 * lg:px-8 pt-6 sm:pt-10 …` with a `space-y-*` and, on 13 of them, `pb-20`, and nothing else) onto
 * `PageContainer` too, collapsing 8 distinct spellings shared across those 24 pages: 7 distinct
 * spellings across 10 elements remain. What is left is exactly the deliberate leftovers —
 * `hakkimizda` (no `space-y-*`), `oyun/bolge-bolge-il` (`sm:pt-8`), `dunya` (`flex-1 w-full
 * pb-16`), `dunya/kita` and `dunya/kita/[slug]` (two spellings each, nested inside their own
 * `min-h-screen` wrapper) for task 4b, plus the three sticky quicknav/tab-strip bars from task 3
 * that are never migrated. See task-4a-report.md for the full before/after list.
 *
 * Task 4b (2026-09-17) moved the remaining five onto `PageContainer` too: `hakkimizda` took
 * `space="tight"` (it had no `space-y-*` to map from), `oyun/bolge-bolge-il` took `space="tight"`
 * accepting the `sm:pt-8` → `sm:pt-10` 8px difference, `dunya` took the `default` rhythm after
 * `flex-1 w-full` turned out to be dead weight (see task-4b-report.md — neither `<main>` in
 * `(site)/layout.tsx` nor any ancestor between it and this element is a flex container, so
 * `flex-1` had no flex parent to size against, and a block box is already 100% of its
 * containing block's width without `w-full`), and `dunya/kita` + `dunya/kita/[slug]` split into
 * two `PageContainer`s each — `space="band"` for the hero (which owns `pt-8 pb-14` itself,
 * matching `turkiye/[slug]`'s shape) and `space="loose"` for the body (`space-y-16`), with their
 * duplicate `min-h-screen … flex flex-col selection:bg-primary/20` root wrapper deleted (T-032
 * PR3 shell, already in `(site)/layout.tsx`; `selection:bg-primary/20` also redundant with the
 * site-wide `::selection` rule `app/globals.css` added). That deletion removed the flex
 * ancestor the body wrapper's `w-full min-w-0` comment said was load-bearing, so `min-w-0` is
 * gone with it — re-verified at 320px, still 305px, no regression. The two hero `relative z-10`
 * wrappers became `isolate` on the `<section>` plus `-z-10` on the glow div(s), the same shape
 * Task 3 used on `turkiye/[slug]` and `turkiye/bolge/[slug]`.
 *
 * That leaves ONLY the three sticky quicknav/tab-strip bars, now named and reasoned about in
 * `BODY_WRAPPER_EXEMPTIONS` above rather than carried in this docblock — the counter itself
 * reads 0. See task-4b-report.md for the full before/after list.
 */
export const PAGE_BODY_SPELLINGS = 0;

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
  it("has exactly the recorded number of spellings, sticky-nav exemptions aside", () => {
    const spellings = nonExemptBodySpellings();
    expect(
      spellings.size,
      `spellings:\n${[...spellings].map(([s, f]) => `  ${f.length}x ${s}`).join("\n")}`,
    ).toBe(PAGE_BODY_SPELLINGS);
  });
});

describe("the sticky-nav body-wrapper exemptions", () => {
  it("every exemption is still live", () => {
    // A stale exemption hides a real regression just as effectively as a missing rule — the
    // same guard `token-binding.test.ts` runs for `ACHROMATIC_EXEMPTIONS`.
    for (const [file, spelling] of BODY_WRAPPER_EXEMPTIONS) {
      const path = join(repoRoot, file);
      expect(existsSync(path), `${file} no longer exists; drop the exemption`).toBe(true);
      const matches = [...sourceOf(path).matchAll(BODY_WRAPPER)].map((m) =>
        m[1]!.trim().replace(/\s+/g, " "),
      );
      expect(
        matches,
        `${file} no longer contains the exempted spelling; drop the exemption`,
      ).toContain(spelling);
    }
  });
});
