import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { resolveSpecifier, runtimeImportsOf } from "@/lib/test-support/import-closure";

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

/**
 * EVERY FILE UNDER `PAGE_ROOTS` THAT RENDERS A FULL SCREEN TO A READER — `page.tsx` plus the two
 * Next.js special files that take over the viewport in its place, `error.tsx` and `not-found.tsx`.
 *
 * A SECOND walker rather than a wider `walkPages()`, deliberately. Three counters from PR1 and
 * PR2 (`PAGE_BODY_SPELLINGS`, `HAND_WRITTEN_BREADCRUMBS` and the two derived from it) are pinned
 * at values measured over `page.tsx` ONLY; widening that function would move their scope silently,
 * which is the exact failure mode this whole programme exists to stop. `walkPages()` is untouched
 * and still returns 37 — asserted below, so this split cannot rot.
 *
 * Used ONLY by the three heading counters at the bottom of this file, for a reason specific to
 * them: a reader who lands on a thrown error or an unknown slug sees a real page with a real
 * `<h1>`, so a counter named `PAGES_WITHOUT_H1` that cannot see those two files would claim more
 * than it measures. `app/[locale]/(site)/error.tsx` and `app/[locale]/(site)/not-found.tsx` are
 * the only two in the tree today; there is no `(play)` equivalent and no `loading.tsx` or
 * `template.tsx` anywhere.
 *
 * NOT WIDENED PAST `PAGE_ROOTS`. `app/global-error.tsx` and `app/not-found.tsx` are app-ROOT
 * special files that sit ABOVE `app/[locale]`, outside both roots — the same placement
 * `components/patterns/rsc-boundary.test.ts` handles with a separate `ROOT_LEVEL_ROOTS` list
 * rather than by stretching a root. Reaching them would take a third root, and would add two more
 * spellings that no locale-scoped surface shares: `app/not-found.tsx`'s
 * `font-heading text-3xl font-bold` (no `text-foreground` — it renders outside the locale layout
 * and its providers) and `app/global-error.tsx`'s `<h1>` with an inline `style` and NO `className`
 * at all, which would enter the count as the `(no className attribute)` marker. Both are
 * last-resort shells with different constraints from a reading page, so folding them into a
 * "converge the page heading" counter would give the adoption task two targets it cannot
 * legitimately move onto the hub/detail tiers. Left out on purpose, named here so the omission is
 * a decision and not an oversight.
 */
const RENDER_ROOT_FILENAMES = ["page.tsx", "error.tsx", "not-found.tsx"] as const;

/**
 * WHOLE BASENAME, never a suffix. `endsWith("page.tsx")` would swallow a `my-page.tsx` helper and
 * `endsWith("not-found.tsx")` a `shared-not-found.tsx`, silently moving every counter below. Its
 * own test runs on synthetic paths rather than on the walk's output, because an assertion made
 * over files that already passed this filter re-derives the filter and cannot fail.
 */
export function isRenderRootPath(path: string): boolean {
  return RENDER_ROOT_FILENAMES.some((name) => basename(path) === name);
}

export function walkRenderRoots(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter(isRenderRootPath)
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
 *
 * SCOPE. This is a literal `className="…"` string scan, not a rendered-DOM or computed-style
 * check, and `PAGE_BODY_SPELLINGS` reading 0 is a claim about that scan only. Three shapes carry
 * the same width intent and are invisible to it:
 *
 *   - a template-literal className, `className={`max-w-7xl …`}` — the pattern only opens
 *     inside a `"…"` literal, so an interpolated class string never reaches it;
 *   - a `cn("max-w-7xl …")` call — the token sits inside a function-call argument, not a bare
 *     `className="…"` attribute, for the same reason;
 *   - any width token other than `max-w-7xl` / `container` — `max-w-6xl`, `max-w-screen-xl`,
 *     `max-w-[1280px]` would all carry a page body past this scanner unnoticed.
 *
 * Not hypothetical: 14 template-literal classNames already exist on these exact pages today
 * (`turkiye/[slug]/page.tsx:351`, `dunya/[slug]/page.tsx:295`, and twelve more across
 * `deprem/fay-hatlari`, `dunya/kita` and `dunya/kita/[slug]`) — the idiom that evades this
 * scanner is one the surface it scans already writes, there for a theme/gradient hole rather
 * than a width one, but the shape is identical and nothing here would catch it wearing a width
 * token instead.
 *
 * `walkPages()` below adds a second, independent scope limit: it visits files named `page.tsx`
 * only. `loading.tsx`, `layout.tsx`, `error.tsx` and `not-found.tsx` in these same route groups,
 * and every `components/v2` wrapper a page composes, are never read, regardless of what their
 * className looks like. A future `loading.tsx` skeleton task is out of this counter's reach for
 * that reason — the walk, not the regex — so a body-shaped className landing there would need
 * its own check, not an extension of this one.
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
 * body-width elements in the 37 pages (three `(play)` `page.tsx` files carry none THEMSELVES —
 * not because the play surface has no body wrapper, but because `walkPages()` reads `page.tsx`
 * only, and all three compose `V2GameScreen` instead of writing the wrapper inline. That
 * component's own `<main>` (`components/v2/v2-game-screen.tsx:665`) carries the identical
 * `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6` spelling for all three
 * `(play)` pages — invisible to this scanner for the `components/v2` reason the SCOPE note
 * above already names, not because it is absent. `PAGE_BODY_SPELLINGS` reading 0 is a claim
 * about `page.tsx` files only, never about whether the play surface carries a body wrapper).
 * Not the 8 guessed before the scan ran. See task-1-report.md for the full list; every entry
 * was checked by hand against its source line to confirm it is a real `className` on an
 * element carrying the container width — including the sticky quicknav/tab-strip wrappers in
 * `turkiye/bolge/[slug]`, `turkiye/bolge` and `dunya/[slug]`, which align to the same edges as
 * the body content and carry the same `container`/`max-w-7xl` tokens, not just the primary
 * content wrapper.
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
 *
 * MUTATION-CHECKED 2026-09-17, against this ZERO target specifically (`docs/conventions.md`:
 * a source-text assertion that has never failed has not been shown to work). Every earlier
 * check ran against 17; the target then moved 17 → 15 → 7 → 0 across three tasks with no
 * re-check, so passing at 17 proved nothing about passing at 0. Reintroduced
 * `max-w-7xl mx-auto` on a real page (`araclar/page.tsx`'s header wrapper) — went RED, message
 * `1x max-w-7xl mx-auto space-y-4: expected 1 to be +0`; reverted — back to GREEN. The message
 * names the spelling and how many files carry it but NOT which file(s) — `nonExemptBodySpellings()`
 * has the file list in hand (it is the map value) and the assertion message simply does not
 * print it. Left as found: fixing the message is a behaviour change to a test this task's scope
 * (docblock plus mutation check) does not cover.
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

/**
 * Ruling 8 re-spelled the three nav bars to byte-match `PageContainer`'s base string by hand —
 * `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`, read here straight out of
 * `components/patterns/page-container.tsx` rather than retyped, so this cannot drift from the
 * component the way a second hard-coded copy could. `BODY_WRAPPER_EXEMPTIONS` above already
 * binds the OTHER direction — editing a nav's spelling fails "every exemption is still live" —
 * but editing `PageContainer`'s base does not touch this file at all and slipped through
 * silently until now. If the base's width/padding tokens ever change, this goes red and names
 * which nav fell out of alignment, instead of the drift being caught only by eye at x=32.
 */
const CONTAINER_BASE_TOKENS = (() => {
  const source = sourceOf(join(repoRoot, "components/patterns/page-container.tsx"));
  const base = source.match(/cn\(\s*"([^"]+)"/)?.[1] ?? "";
  return base.split(/\s+/).filter(Boolean);
})();

describe("the sticky navs stay aligned to PageContainer's base", () => {
  it("read a real, non-empty base string out of page-container.tsx — positive control", () => {
    // Guards the regex above: if `cn(` were restructured or the base became a template literal,
    // this list would silently go empty and every assertion below would pass vacuously.
    expect(CONTAINER_BASE_TOKENS).toEqual([
      "mx-auto",
      "w-full",
      "max-w-7xl",
      "px-4",
      "sm:px-6",
      "lg:px-8",
    ]);
  });

  it.each(BODY_WRAPPER_EXEMPTIONS)("%s's nav still carries every base token", (file, spelling) => {
    const words = spelling.split(" ");
    for (const token of CONTAINER_BASE_TOKENS) {
      expect(words, `${file}: missing "${token}" from PageContainer's base`).toContain(token);
    }
  });
});

/**
 * Both capitalisations, on purpose. The hand-written navs write `aria-label="Breadcrumb"`; the
 * primitive in `components/ui/breadcrumb.tsx` writes `aria-label="breadcrumb"`. A counter
 * matching only the capital spelling would read zero the moment every page migrated to the
 * primitive AND would have read zero if someone had merely lowercased their own hand-written
 * nav without adopting the primitive, so it could not tell the real fix from the typo that
 * looks like one.
 */
const BREADCRUMB_NAV = /aria-label="[Bb]readcrumb"/;

/**
 * The primitive is where this nav is SUPPOSED to be written, so it is excluded from the
 * surface a "hand-written nav" counter scans.
 *
 * `components/patterns/breadcrumbs.tsx` (Task 6) is deliberately NOT listed here, though it
 * was reserved as a placeholder before that task existed. This exemption exists for files
 * that legitimately WRITE the `<nav aria-label="…">` markup themselves; `Breadcrumbs`
 * delegates that entirely to `Breadcrumb` (`components/ui/breadcrumb.tsx:9`), which already
 * owns the exemption above. Its own source contains no `aria-label` literal at all — adding
 * one there would be markup written only to keep this list's liveness check green, not
 * because the component needs it. Since `components/patterns/breadcrumbs.tsx` sits outside
 * `SURFACE_ROOTS` (`PAGE_ROOTS` + `components/v2`) anyway, leaving it off this list changes
 * nothing about what the counters below scan.
 */
const BREADCRUMB_OWNERS = ["components/ui/breadcrumb.tsx"] as const;

/**
 * The reading/play page roots plus every `components/v2` file — a wider walk than
 * `walkPages()`, which visits only `page.tsx`. Two `components/v2` files render the breadcrumb
 * nav on behalf of seven pages that never write it themselves: `v2-sea-basin-detail-view.tsx`
 * (the four `deniz/{akdeniz,karadeniz,marmara,ege}` basin pages) and `v2-game-screen.tsx` (the
 * three `(play)/oyun/*` screens). A scan limited to `page.tsx` would silently miss the nav on
 * all seven of those pages; walking `components/v2` too is how it is still seen.
 */
const SURFACE_ROOTS = [...PAGE_ROOTS, "components/v2"] as const;

function surfaceFiles(): string[] {
  return SURFACE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => !BREADCRUMB_OWNERS.some((owner) => path.endsWith(owner)))
    .sort();
}

/** Every surface file whose stripped source writes the nav, in either capitalisation. */
function breadcrumbNavFiles(): string[] {
  return surfaceFiles().filter((path) => BREADCRUMB_NAV.test(sourceOf(path)));
}

/**
 * SCOPE. All three counters below are built on `breadcrumbNavFiles()`, i.e. on `BREADCRUMB_NAV`
 * matched against `sourceOf()` (comment-stripped literal source, not rendered DOM). That scan
 * cannot see:
 *
 *   - a breadcrumb nav built without an `aria-label` at all, or with a different string
 *     (`aria-label="Yol izi"`, `aria-label="Sayfa konumu"`) — it would carry none of the
 *     three gaps this file measures and also never be counted as a hand-written nav needing
 *     fixing, because the pattern never fires on it in the first place;
 *   - `aria-current` applied through a variable, a spread, or a conditional expression rather
 *     than the literal token `aria-current` appearing in the source text — e.g.
 *     `{...(isLast ? currentPageProps : {})}` where `currentPageProps` is defined elsewhere and
 *     holds `{ "aria-current": "page" }` — the literal token `aria-current` never appears in
 *     the file that renders the crumb. Counter 2 would count that file as missing `aria-current`
 *     even though the rendered DOM carries it;
 *   - the same indirection on `breadcrumbJsonLd`: a page that imports it under an alias
 *     (`import { breadcrumbJsonLd as crumbSchema } from "@/lib/seo/json-ld"`) or re-exports a
 *     wrapper around it would not contain the literal substring `breadcrumbJsonLd` and would be
 *     counted by counter 3 as lacking the schema even though it emits it;
 *   - the split this file's own tree already contains between where the nav is WRITTEN and
 *     where a page's JSON-LD is EMITTED. `v2-sea-basin-detail-view.tsx` and `v2-game-screen.tsx`
 *     are where `BREADCRUMB_NAV` fires — they are the files `breadcrumbNavFiles()` returns — but
 *     `breadcrumbJsonLd` is called from the *page.tsx* files that compose those components, not
 *     from the components themselves (confirmed by reading both component files: neither
 *     contains the string). So counter 3 flags `v2-sea-basin-detail-view.tsx` as lacking
 *     JSON-LD even on the four `deniz/*` pages that DO emit `breadcrumbJsonLd` today — the
 *     counter is right about `v2-game-screen.tsx` (none of its three pages emit it either) and
 *     wrong, in the conservative direction, about `v2-sea-basin-detail-view.tsx`. A per-page
 *     check would need to follow the import graph from `page.tsx` to the component it renders;
 *     this file does not, and a file-level match is the honest limit of what it can claim.
 *   - a server `page.tsx` that imports `BreadcrumbsNav` from
 *     `components/patterns/breadcrumbs-nav.tsx` directly instead of `Breadcrumbs` from
 *     `components/patterns/breadcrumbs.tsx` (added after Task 6/7's split gave a server page a
 *     way to do that — see that split's own docblocks). It renders the exact same `<nav
 *     aria-label="breadcrumb">` markup `BREADCRUMB_NAV` matches, but the literal string lives in
 *     `components/ui/breadcrumb.tsx` — the file `BREADCRUMB_OWNERS` exempts — not in the page
 *     that imports `BreadcrumbsNav`, so the page's own source is invisible to all three counters
 *     below regardless of whether it emits `BreadcrumbList` JSON-LD or `aria-current`. Proven by
 *     adding a probe page under `(site)` that rendered `BreadcrumbsNav`: every assertion in this
 *     file stayed green. Not closed by widening `BREADCRUMB_NAV` — the markup is correct, the
 *     PROBLEM is which half of the split a server file reaches for — so it is closed separately,
 *     by an IMPORT scan rather than a markup scan: see "no server page imports the client-only
 *     breadcrumb nav" below.
 *
 * All three counters also inherit `walk()`'s own scope: it visits `.tsx` files only (no `.ts`
 * helpers), and `SURFACE_ROOTS` visits `PAGE_ROOTS` plus `components/v2` only — a breadcrumb
 * rendered from `components/patterns/**`, `components/ui/**` (other than the primitive itself,
 * which is deliberately excluded as an owner) or any other directory is outside this walk
 * entirely.
 *
 * Measured 2026-09-17 against the real tree, not the brief's pre-dispatch guess (the brief was
 * written before PR1 touched 34 page files, and says so): 27 files hand-write the nav — 25
 * `page.tsx` files plus `v2-sea-basin-detail-view.tsx` and `v2-game-screen.tsx`, which write it
 * on behalf of seven pages that never write their own. All 27 of those files are ALSO missing
 * `aria-current` — the brief's claim that the attribute occurs nowhere on the product surface
 * (its only two repo-wide occurrences being `components/ui/breadcrumb.tsx` and the showcase
 * specimen `components/showcase/specimens/duzen.tsx`, neither in `SURFACE_ROOTS`) checks out
 * exactly, so this counter and the nav counter above read the same number for a real reason, not
 * a coincidence. The JSON-LD counter differs from the brief's stale 24: 7 of the 27 nav files
 * (`deniz/kiyi-tipleri`, `deprem/fay-hatlari`, `deprem/hazirlik`, `turkiye/bolge`,
 * `turkiye/bolge/[slug]`, `dunya/kita`, `dunya/kita/[slug]`) already call `breadcrumbJsonLd`
 * themselves, so the real count is 20, not 24 — see the scope note above for why the four
 * `deniz/{akdeniz,karadeniz,marmara,ege}` pages that also call it do NOT subtract from this
 * counter: their call lives in their own `page.tsx`, but their nav lives in
 * `v2-sea-basin-detail-view.tsx`, a different file, and this counter is per-file.
 *
 * Task 7 (2026-09-17) moved `v2-sea-basin-detail-view.tsx` and `v2-game-screen.tsx` onto
 * `Breadcrumbs` (`components/patterns/breadcrumbs.tsx`, Task 6), so both stop hand-writing
 * the nav: 27 → **25**, exactly the 25 `page.tsx` files left, none of them touched by this
 * task (Task 8's scope). `BREADCRUMBS_WITHOUT_ARIA_CURRENT` moves with it, 27 → **25**, same
 * file list, for the same reason (`Breadcrumbs` is the file that owns `aria-current` on
 * behalf of both). `BREADCRUMBS_WITHOUT_JSONLD` drops by the same two files, 20 → **18**:
 * `Breadcrumbs` now emits `breadcrumbJsonLd` internally (gated on the `surface` each caller
 * passes), so a file that only rendered the nav through it no longer needs to call the
 * builder itself to leave this list — which is also why the four `deniz/{akdeniz,karadeniz,
 * marmara,ege}` pages each had their own manual `breadcrumbJsonLd([...])` call DELETED in
 * this task: `V2SeaBasinDetailView` renders `Breadcrumbs` with `surface="trOnly"` now, and a
 * second call in the page itself would have published the identical `BreadcrumbList` schema
 * twice. Those four pages were never members of `breadcrumbNavFiles()` to begin with (their
 * nav lived in the component, not the page), so removing their own call does not change
 * either counter — it only stops a live duplicate-JSON-LD bug the adoption would otherwise
 * have introduced. The three `(play)/oyun/*` pages needed no such removal: none of them ever
 * called `breadcrumbJsonLd` (their surface is `"noindex"` in every case, so `Breadcrumbs`
 * still emits nothing there, exactly as before). See `task-7-report.md` for the full
 * before/after file lists.
 *
 * Task 8 (2026-09-18) adopted `Breadcrumbs` at the remaining 25 `page.tsx` files (the exact
 * list `breadcrumbNavFiles()` printed at the start of the task, confirmed against the brief's
 * own count rather than assumed): 25 → **0**. Seven of the 25 already called `breadcrumbJsonLd`
 * by hand (`deniz/kiyi-tipleri`, `deprem/fay-hatlari`, `deprem/hazirlik`, `turkiye/bolge`,
 * `turkiye/bolge/[slug]`, `dunya/kita`, `dunya/kita/[slug]`) — each had that call DELETED (and,
 * where it left the import with no other use, the `breadcrumbJsonLd` import dropped too), for
 * the identical double-publish reason Task 7 already fixed on the four `deniz/*` pages: the
 * component now emits the same schema from the same array. Two pages (`dunya/[slug]`,
 * `turkiye/[slug]`) carried a middle crumb whose destination was a dynamic route
 * (`"/dunya/kita/[slug]"`, `"/turkiye/bolge/[slug]"`) rendered via next-intl's
 * `{pathname, params}` href form; `BreadcrumbTrailItem.href` takes only a concrete,
 * already-interpolated `AppPathname`, so each became a template-literal path
 * (`` `/dunya/kita/${continentSlug}` ``) cast `as AppPathname` — the same "computed href,
 * typed `Link` rejects it" shape this component's own docblock already names, not a new
 * exception. `BREADCRUMBS_WITHOUT_ARIA_CURRENT` and `BREADCRUMBS_WITHOUT_JSONLD` move with it,
 * 25 → **0** and 18 → **0**, for the same reasons Task 7 recorded at 27 → 25 and 20 → 18: every
 * remaining hand-written nav is gone, so both derived lists (built by filtering
 * `breadcrumbNavFiles()`) are empty by construction, not by a separate fix. See
 * `task-8-report.md` for the full per-file surface list and before/after detail.
 */
const HAND_WRITTEN_BREADCRUMBS = 0;

describe("breadcrumbs are rendered by one component", () => {
  it("the hand-written nav count is exactly the recorded number", () => {
    const files = breadcrumbNavFiles().map(label).sort();
    expect(
      files,
      `files still writing their own breadcrumb nav:\n${files.map((f) => `  ${f}`).join("\n")}`,
    ).toHaveLength(HAND_WRITTEN_BREADCRUMBS);
  });

  it("the pattern fires on source that carries one — positive control", () => {
    expect(BREADCRUMB_NAV.test('<nav aria-label="Breadcrumb">')).toBe(true);
    expect(BREADCRUMB_NAV.test('<nav aria-label="breadcrumb">')).toBe(true);
  });

  it("the pattern does not fire on an unrelated aria-label — negative control", () => {
    expect(BREADCRUMB_NAV.test('<nav aria-label="Site navigation">')).toBe(false);
  });

  it("a docblock quoting the attribute does not count — comment stripping applied", () => {
    const stripped = stripComments('// aria-label="Breadcrumb" — legacy note, not live markup');
    expect(BREADCRUMB_NAV.test(stripped)).toBe(false);
  });
});

/**
 * FINDING (PR2 final review). The three counters above all filter `breadcrumbNavFiles()`, i.e.
 * files whose OWN source matches `BREADCRUMB_NAV`. A server `page.tsx` that imports
 * `BreadcrumbsNav` from `components/patterns/breadcrumbs-nav.tsx` — the client-safe half of the
 * Task 6/7 split — never matches that pattern itself: the literal `aria-label="breadcrumb"`
 * lives inside `components/ui/breadcrumb.tsx`, an exempted owner, not in the page. Proven, not
 * assumed: a probe page under `(site)` rendering `BreadcrumbsNav` directly left every assertion
 * above green. That page would ship a visible trail with NO `BreadcrumbList` JSON-LD — the exact
 * 20-file defect `BREADCRUMBS_WITHOUT_JSONLD` was built to close — through the one door the
 * counters above cannot see, because it is a markup scan and this bypass produces no distinctive
 * markup of its own on the page that has the bug.
 *
 * The fix is an IMPORT scan instead of a markup scan. `components/patterns/breadcrumbs-nav.tsx`
 * exists for Client Components that structurally cannot render `Breadcrumbs` (it reaches
 * `server-only`, see that file's own docblock and `components/patterns/rsc-boundary.test.ts`).
 * Every file under `PAGE_ROOTS` is a Server Component by default and can always reach
 * `Breadcrumbs` instead, so it has no legitimate reason to import the nav-only half directly —
 * doing so is either a mistake (this bypass) or dead code, never a case this scanner should
 * tolerate silently. `components/v2` is deliberately OUT of this scan, unlike `SURFACE_ROOTS`
 * above: `v2-sea-basin-detail-view.tsx` and `v2-game-screen.tsx` are genuine Client Components
 * and their `BreadcrumbsNav` import is the legitimate case this check exists to distinguish
 * from the illegitimate one — a `page.tsx` reaching for it when `Breadcrumbs` was always
 * available.
 */
const BREADCRUMBS_NAV_IMPORT = "@/components/patterns/breadcrumbs-nav";

const PAGE_ROOT_FILES_IMPORTING_BREADCRUMBS_NAV = 0;

function pageRootFiles(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel))).sort();
}

function pageRootFilesImportingBreadcrumbsNav(): string[] {
  return pageRootFiles().filter((path) => sourceOf(path).includes(BREADCRUMBS_NAV_IMPORT));
}

describe("no file under PAGE_ROOTS imports the client-only breadcrumb nav", () => {
  it("the count of PAGE_ROOTS files importing breadcrumbs-nav is exactly the recorded number", () => {
    const files = pageRootFilesImportingBreadcrumbsNav().map(label).sort();
    expect(
      files,
      `PAGE_ROOTS files importing components/patterns/breadcrumbs-nav directly (use Breadcrumbs instead — it renders the same nav plus the JSON-LD a server file can always emit):\n${files.map((f) => `  ${f}`).join("\n")}`,
    ).toHaveLength(PAGE_ROOT_FILES_IMPORTING_BREADCRUMBS_NAV);
  });

  it("the walk found a real, non-trivial slice of PAGE_ROOTS — positive control against the live tree", () => {
    // Guards against a broken `pageRootFiles()` (an empty walk, a bad join) reading as "zero
    // offenders" for the wrong reason.
    expect(pageRootFiles().length).toBeGreaterThan(30);
  });

  it("the check fires on source that imports breadcrumbs-nav — positive control", () => {
    const source = 'import { BreadcrumbsNav } from "@/components/patterns/breadcrumbs-nav";';
    expect(source.includes(BREADCRUMBS_NAV_IMPORT)).toBe(true);
  });

  it("does not fire on an import of the server Breadcrumbs component — negative control", () => {
    const source = 'import { Breadcrumbs } from "@/components/patterns/breadcrumbs";';
    expect(source.includes(BREADCRUMBS_NAV_IMPORT)).toBe(false);
  });

  it("a docblock mentioning the import does not count — comment stripping applied", () => {
    const stripped = stripComments(
      '// import { BreadcrumbsNav } from "@/components/patterns/breadcrumbs-nav";',
    );
    expect(stripped.includes(BREADCRUMBS_NAV_IMPORT)).toBe(false);
  });
});

/**
 * Files that write the nav but never tell assistive technology which crumb is the current
 * page. `aria-current` is checked as a bare token, not `aria-current="page"` specifically,
 * because any value (`"page"`, `"location"`, `"true"`) answers the accessibility gap this
 * counts; see the SCOPE note above for what a variable- or spread-applied `aria-current` still
 * misses.
 *
 * NOT A CLAIM ABOUT THE SURFACE. This counter, like counter 1 above, is filtered from
 * `breadcrumbNavFiles()` — the hand-written subset, currently empty. Its title says "breadcrumbs
 * mark the current page" but what it actually measures is "hand-written breadcrumb navs mark the
 * current page"; with `HAND_WRITTEN_BREADCRUMBS` at 0, it filters an empty list and passes
 * vacuously for every file on the reading/play surface that reaches `aria-current` through
 * `Breadcrumbs`/`BreadcrumbsNav` instead of writing its own nav. MUTATION-CHECKED alongside
 * counter 1's own zero-target check (reintroducing `max-w-7xl mx-auto` on `araclar/page.tsx`,
 * see `PAGE_BODY_SPELLINGS`'s docblock — a different mutation, the breadcrumb one is this file's
 * own "the hand-written nav count is exactly the recorded number" going non-zero the moment a
 * hand-written nav exists): a newly hand-written nav is caught by COUNTER 1
 * (`HAND_WRITTEN_BREADCRUMBS`), which goes red naming that file; if it also lacks
 * `aria-current`, this counter goes red on the SAME file, but has never once caught a case
 * counter 1 did not already catch first. This counter and counter 3 below exist to keep the two
 * gaps individually visible and individually regression-proof once a hand-written nav exists
 * again, not because either can detect a regression counter 1 misses.
 */
const ARIA_CURRENT = /aria-current/;

const BREADCRUMBS_WITHOUT_ARIA_CURRENT = 0;

function breadcrumbsWithoutAriaCurrent(): string[] {
  return breadcrumbNavFiles().filter((path) => !ARIA_CURRENT.test(sourceOf(path)));
}

describe("hand-written breadcrumb navs mark the current page for assistive technology", () => {
  it("the count of navs missing aria-current is exactly the recorded number", () => {
    const files = breadcrumbsWithoutAriaCurrent().map(label).sort();
    expect(
      files,
      `hand-written navs with no aria-current anywhere in the file:\n${files.map((f) => `  ${f}`).join("\n")}`,
    ).toHaveLength(BREADCRUMBS_WITHOUT_ARIA_CURRENT);
  });

  it("the pattern fires on source that carries aria-current — positive control", () => {
    expect(ARIA_CURRENT.test('<span aria-current="page">Turkiye</span>')).toBe(true);
  });

  it("the primitive is the file that actually carries aria-current today", () => {
    // Independent of the counter above: proves aria-current exists SOMEWHERE in the tree, so a
    // bug that made ARIA_CURRENT never match anything would not read as "zero gaps everywhere".
    const primitive = sourceOf(join(repoRoot, "components/ui/breadcrumb.tsx"));
    expect(ARIA_CURRENT.test(primitive)).toBe(true);
  });
});

/**
 * Files that render a visible breadcrumb trail but never emit the matching `BreadcrumbList`
 * structured data, so a search engine sees the trail a user sees but not the machine-readable
 * one. `breadcrumbJsonLd` is `lib/seo/json-ld.tsx`'s real exported symbol name (confirmed by
 * reading the file, not assumed) — checked as a literal substring, so an aliased import defeats
 * it; see the SCOPE note above.
 *
 * NOT A CLAIM ABOUT THE SURFACE, same limit as `BREADCRUMBS_WITHOUT_ARIA_CURRENT` immediately
 * above and for the identical reason: this filters `breadcrumbNavFiles()`, the hand-written
 * subset. Its title says "visible breadcrumbs carry matching JSON-LD" but it only ever inspects
 * whatever still hand-writes a nav — today nothing, so it filters an empty list and passes
 * vacuously. A page rendering `Breadcrumbs` (which emits the JSON-LD itself, gated by
 * `breadcrumbListSchema`) or a server page that reaches for `BreadcrumbsNav` directly (Finding 1
 * above, closed by the import scan below, not by this counter) never enters this filter either
 * way. Counter 1 (`HAND_WRITTEN_BREADCRUMBS`) is what actually catches a newly hand-written nav;
 * this counter, mutation-checked the same way, has never caught a regression counter 1 did not
 * already catch first — it exists to keep the JSON-LD gap individually visible and individually
 * regression-proof if a hand-written nav ever returns, not as an independent detector.
 */
const BREADCRUMB_JSONLD_SYMBOL = "breadcrumbJsonLd";

const BREADCRUMBS_WITHOUT_JSONLD = 0;

function breadcrumbsWithoutJsonLd(): string[] {
  return breadcrumbNavFiles().filter((path) => !sourceOf(path).includes(BREADCRUMB_JSONLD_SYMBOL));
}

describe("hand-written breadcrumb navs that render a trail carry matching JSON-LD", () => {
  it("the count of navs with no breadcrumbJsonLd call is exactly the recorded number", () => {
    const files = breadcrumbsWithoutJsonLd().map(label).sort();
    expect(
      files,
      `hand-written navs with no breadcrumbJsonLd anywhere in the file:\n${files.map((f) => `  ${f}`).join("\n")}`,
    ).toHaveLength(BREADCRUMBS_WITHOUT_JSONLD);
  });

  it("the pattern fires on source that calls breadcrumbJsonLd — positive control", () => {
    expect("const schema = breadcrumbJsonLd(items);".includes(BREADCRUMB_JSONLD_SYMBOL)).toBe(true);
  });

  it("a docblock mentioning the symbol does not count — comment stripping applied", () => {
    const stripped = stripComments("// TODO: call breadcrumbJsonLd here once designed");
    expect(stripped.includes(BREADCRUMB_JSONLD_SYMBOL)).toBe(false);
  });

  it("at least one real file already calls it — positive control against the live tree", () => {
    // Was `deniz/akdeniz/page.tsx`, then (after Task 7 deleted that call)
    // `deniz/kiyi-tipleri/page.tsx` — Task 8 migrated `kiyi-tipleri`, and every other remaining
    // hand-written nav, onto `Breadcrumbs`, deleting each page's own `breadcrumbJsonLd` call in
    // the same move (the component now emits the identical schema from the same array). With
    // `HAND_WRITTEN_BREADCRUMBS` at 0, no `page.tsx` in `breadcrumbNavFiles()` calls the symbol
    // by hand any more — that is the point of the migration, not an oversight here. The ONE
    // real file left in the tree that still calls it directly is the component itself:
    // `Breadcrumbs`'s JSON-LD block (`components/patterns/breadcrumbs.tsx`) builds the schema
    // from `breadcrumbJsonLd(...)`, so the control moves there rather than to a page.
    const withJsonLd = sourceOf(join(repoRoot, "components/patterns/breadcrumbs.tsx"));
    expect(withJsonLd.includes(BREADCRUMB_JSONLD_SYMBOL)).toBe(true);
  });
});

describe("the breadcrumb owner exemptions", () => {
  it.each(BREADCRUMB_OWNERS)("%s still writes the nav, or does not exist yet", (owner) => {
    // Same liveness idea as "every exemption is still live" above: a stale exemption hides a
    // real regression. The existsSync tolerance is kept generic (rather than asserting the
    // primitive is always present) so this describe block still means the same thing if a
    // future owner is ever added ahead of the file that creates it, the way
    // `components/patterns/breadcrumbs.tsx` once was here.
    const path = join(repoRoot, owner);
    if (!existsSync(path)) return;
    expect(
      BREADCRUMB_NAV.test(sourceOf(path)),
      `${owner} no longer writes the breadcrumb nav; drop the exemption`,
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------------------------
 * PR3 — the page heading. Three counters, pinned at what the scanner below actually found.
 * ---------------------------------------------------------------------------------------- */

/**
 * THE RENDER GRAPH. A heading is credited to a render root only where it is RENDERED, never
 * merely where its module is reachable.
 *
 * ## The false positive this shape exists to close
 *
 * The first version of this walk was a plain transitive import closure and it was WRONG in the
 * one direction this task cannot afford. PR3's review proved it in two lines: an UNUSED
 * `import { H2 } from "@/components/patterns/typography"` added to `giris/page.tsx`, no markup
 * changed, dropped `PAGES_WITHOUT_H1` from 5 to 4. `typography.tsx` exports `H1`, `H2`, `H3`,
 * `H4`, `Lede`, `Muted` and `Kbd` from one module, so importing ANY of them credited the page
 * with `H1`'s `<h1>`.
 *
 * That is not a blind spot a SCOPE note can carry. Task 3 adopts a heading component by IMPORTING
 * it into the very pages these counters measure: under a module-granularity closure,
 * `PAGES_WITHOUT_H1` would fall to 0 because imports landed, not because headings landed, and
 * `H1_SPELLINGS` would start crediting spellings to pages that never render them. The counter
 * would read "fixed" while the three `(play)` screens still start their outline at `<h3>` — the
 * exact "claim a win it did not make" this whole task exists to prevent.
 *
 * ## The rule
 *
 * Walk NODES, not files. A node is a file plus the name of one declaration inside it (`null` for
 * the whole file, which is what a render root itself is). From a node's own source span:
 *
 *   1. count the `<h1>` elements that lie inside that span, and no others;
 *   2. collect the JSX element names actually written in it (`<X`, `<X.Y`, `<X/>`) — an
 *      identifier that is imported and never rendered contributes NOTHING;
 *   3. for each such name, resolve it to a node: an import binding (following `as` aliases and
 *      skipping `import type`) gives `{ that module, the imported name }`; a local declaration
 *      gives `{ this file, that name }`;
 *   4. a `dynamic(() => import("…"))` literal in the span enqueues that module's `default`,
 *      because the heavy-widget idiom is how several of these pages mount a component at all.
 *
 * Two details that are easy to get wrong and were, once each. The span is read from
 * {@link maskLiterals}' output, so a component name sitting in a STRING is prose and not a render
 * — the comment-stripping rule this repo already wrote a scanner for, one door over. And a render
 * ROOT is entered at its `default` export rather than as a whole file, because Next renders the
 * default export and nothing else in that module: a helper declared beside it and never written as
 * JSX renders nothing, and counting it moved `PAGES_WITHOUT_H1` in precisely the five files Task 3
 * will edit.
 *
 * `reexportTargetsOf` and the `dynamic()` branch fire on NO file in the tree today. They are kept
 * and exercised by injection against real modules, because the rule worth enforcing is "never ship
 * a branch nothing has executed", not "delete what no file exercises" — deleting them would
 * guarantee that the first barrel-exported or lazily-mounted heading component drops silently out
 * of every count, which is this programme's whole failure mode arriving by a different door.
 *
 * So `hakkimizda/page.tsx:99` writing `<H1>` reaches `typography.tsx`'s `H1` declaration and its
 * `<h1>`; a page importing `H2` from the same module reaches `H2`'s declaration, which contains an
 * `<h2>` and no `<h1>`, and stays on the offender list where it belongs.
 *
 * ## What is reused and what is new
 *
 * `resolveSpecifier` — the `@/`-alias-and-relative-path half of
 * `lib/test-support/import-closure.ts`, shared with `components/ui/orphan.test.ts` and
 * `components/patterns/rsc-boundary.test.ts` — is imported, not re-implemented. What is new here
 * is the layer ABOVE it: that module answers "which FILES does this file import", and this walk
 * needs "which NAME is bound to which module, and is it rendered". No shared helper answers that,
 * and the module-level answer is precisely the one that produced the false positive above.
 *
 * Seven of the 39 render roots are thin wrappers that never write an `<h1>` themselves (all
 * seven are `page.tsx`; `(site)/error.tsx` and `(site)/not-found.tsx` each write their own) —
 * `hesabim` takes its heading from `components/v2/v2-member-hub.tsx`, the four
 * `deniz/{akdeniz,karadeniz,marmara,ege}` basin pages from
 * `components/v2/v2-sea-basin-detail-view.tsx`, `/` from `components/v2/v2-hero.tsx`, and
 * `hakkimizda` from `components/patterns/typography.tsx`'s `H1`. Following into components is
 * therefore not optional; following into them at MODULE granularity is what was wrong.
 */
type RenderNode = { readonly file: string; readonly name: string | null };

/**
 * Source as every scanner below sees it: comment-stripped, and overridable so a test can ask
 * "what would the counters read if this page had one more import" without touching the tree.
 * {@link withInjectedSource} is the only writer.
 */
let sourceOverrides: ReadonlyMap<string, string> | null = null;

function readSource(file: string): string {
  const override = sourceOverrides?.get(file);
  return override === undefined ? sourceOf(file) : stripComments(override);
}

/**
 * The same text with the CONTENTS of every string, template and regex literal blanked to spaces —
 * same length, so every index into it still addresses the original source.
 *
 * `readSource` strips comments but copies literals through verbatim, by design (a `//` inside a
 * URL is not a comment). That leaves prose-shaped text in the scan surface, which is the oldest
 * failure in this repo's test suite: `docs/conventions.md` records four independent arrivals at
 * "a docblock quoting the thing you grep for satisfies the grep". A JSX name is the same shape one
 * door over — `const USAGE = "<PageHero title={x} />"` credited that module's `<h1>` to a page that
 * renders nothing, because {@link JSX_ELEMENT} ran over the raw text. Latent, not live: no string
 * literal in `app/`, `components/` or `lib/` contains a JSX-looking component name today.
 *
 * Also what makes {@link TOP_LEVEL_BOUNDARY}'s column-0 rule true rather than nearly true — see
 * that constant's own docblock for the template-literal case it used to get wrong.
 */
function maskLiterals(source: string): string {
  const out = source.split("");
  let i = 0;
  let previous = "";
  while (i < source.length) {
    const ch = source[i]!;
    const opensRegex =
      ch === "/" &&
      source[i + 1] !== "/" &&
      source[i + 1] !== "*" &&
      "(,=:[!&|?;{+-*%^~".includes(previous);
    if (ch !== '"' && ch !== "'" && ch !== "`" && !opensRegex) {
      if (!/\s/.test(ch)) previous = ch;
      i += 1;
      continue;
    }
    const quote = ch;
    let j = i + 1;
    let inClass = false;
    while (j < source.length) {
      const inner = source[j]!;
      if (inner === "\\") {
        out[j] = " ";
        if (j + 1 < source.length) out[j + 1] = " ";
        j += 2;
        continue;
      }
      if (opensRegex) {
        if (inner === "\n") break;
        if (inClass) {
          if (inner === "]") inClass = false;
        } else if (inner === "[") inClass = true;
        else if (inner === "/") break;
      } else if (inner === quote) {
        break;
      }
      out[j] = " ";
      j += 1;
    }
    i = j + 1;
    previous = quote;
  }
  return out.join("");
}

const maskedCache = new Map<string, string>();

function maskedSource(file: string): string {
  const hit = maskedCache.get(file);
  if (hit !== undefined) return hit;
  const masked = maskLiterals(readSource(file));
  maskedCache.set(file, masked);
  return masked;
}

const bindingCache = new Map<string, Map<string, RenderNode>>();
const declarationCache = new Map<string, Map<string, readonly [number, number]>>();
const h1Cache = new Map<string, readonly H1Occurrence[]>();
/**
 * `h1SitesOf(root)` memo. Unlike the per-file caches this one depends on the WHOLE graph, so it is
 * dropped in full whenever a source override changes anything. Without it the three counters each
 * re-walk all 39 roots, and the whole-surface control below does nine full walks.
 */
const sitesCache = new Map<string, H1Site[]>();
const fallbacksSeen = new Map<string, string>();

function resetScannerCaches(): void {
  sitesCache.clear();
  maskedCache.clear();
  bindingCache.clear();
  declarationCache.clear();
  h1Cache.clear();
  fallbacksSeen.clear();
}

/**
 * Runs `fn` with each named file's source replaced.
 *
 * Only the OVERRIDDEN files' cache entries are dropped, either side — not the whole cache. Every
 * cached analysis (`maskedSource`, `importBindingsOf`, `declarationRegions`, `h1OccurrencesOf`) is
 * a pure function of one file's own `readSource`, so nothing else can be stale. `fallbacksSeen` is
 * the exception: it is an accumulator across a walk, not a per-file cache, so it is reset in full.
 *
 * Not an optimisation for its own sake. Clearing everything made each injected walk re-read and
 * re-mask all ~180 reachable files; the whole-surface control does three walks and timed out at
 * vitest's 5s default under full-suite parallelism while passing comfortably when the file ran
 * alone. A test that depends on machine load is worse than no test.
 */
function withInjectedSource<T>(
  overrides: ReadonlyArray<readonly [string, string]>,
  fn: () => T,
): T {
  const touched = overrides.map(([file]) => file);
  const invalidate = () => {
    for (const file of touched) {
      maskedCache.delete(file);
      bindingCache.delete(file);
      declarationCache.delete(file);
      h1Cache.delete(file);
    }
    sitesCache.clear();
    fallbacksSeen.clear();
  };
  invalidate();
  sourceOverrides = new Map(overrides);
  try {
    return fn();
  } finally {
    sourceOverrides = null;
    invalidate();
  }
}

/**
 * Every name a file binds from another FILE in this repo, mapped to the node it names.
 *
 * `import type …` clauses and `type`-prefixed members are dropped — they compile to nothing and
 * so cannot render a heading, the same erasure `runtimeImportsOf` performs one level down.
 * Package specifiers resolve to `null` and never enter the map. `import * as Ns` binds `Ns` to the
 * whole module (name `"*"`), which {@link nodeSpan} then cannot isolate — see
 * {@link MODULE_SCOPE_FALLBACKS}.
 */
const IMPORT_CLAUSE = /^import\s+([^;]*?)\s+from\s*["']([^"']+)["']/gm;

function importBindingsOf(file: string): Map<string, RenderNode> {
  const hit = bindingCache.get(file);
  if (hit) return hit;

  const bindings = new Map<string, RenderNode>();
  const source = readSource(file);
  for (const match of source.matchAll(IMPORT_CLAUSE)) {
    const clause = match[1]!.trim();
    if (/^type\b/.test(clause)) continue;
    const target = resolveSpecifier(file, match[2]!);
    if (target === null) continue;

    const braceAt = clause.indexOf("{");
    const head = (braceAt === -1 ? clause : clause.slice(0, braceAt)).replace(/,\s*$/, "").trim();
    if (head.length > 0) {
      const namespace = head.match(/^\*\s+as\s+([A-Za-z0-9_$]+)$/);
      if (namespace) bindings.set(namespace[1]!, { file: target, name: "*" });
      else if (/^[A-Za-z0-9_$]+$/.test(head)) bindings.set(head, { file: target, name: "default" });
    }
    if (braceAt !== -1) {
      const inner = clause.slice(braceAt + 1, clause.lastIndexOf("}"));
      for (const raw of inner.split(",")) {
        const member = raw.trim();
        if (member.length === 0 || /^type\b/.test(member)) continue;
        const aliased = member.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
        if (aliased) bindings.set(aliased[2]!, { file: target, name: aliased[1]! });
        else if (/^[A-Za-z0-9_$]+$/.test(member))
          bindings.set(member, { file: target, name: member });
      }
    }
  }
  bindingCache.set(file, bindings);
  return bindings;
}

/**
 * Top-level declarations in a module, name → `[start, end)` in its source.
 *
 * A SCANNER, NOT A PARSER — the same contract `lib/test-support/strip-comments.ts` states for
 * itself. Boundaries are lines that BEGIN AT COLUMN 0 with a declaration keyword. A declaration's
 * region runs to the next such boundary, so `typography.tsx`'s `export function H1` region ends
 * exactly where `export function H2` begins. That is what makes "crediting an `H2` importer with
 * `H1`'s markup" — the same bug one level down from the module-granularity one — impossible here.
 *
 * WHY PRETTIER IS NOT THE WHOLE REASON. An earlier version of this docblock claimed the column-0
 * rule is "exact because Prettier is enforced (`docs/conventions.md`) — a nested `const` inside a
 * function body is indented". That is true of CODE and false of TEMPLATE LITERALS: Prettier does
 * not reindent what is inside backticks, so
 *
 *     const note = `line one
 *     const fake = 1;
 *     line three`;
 *
 * puts `const` at column 0 in the middle of a declaration and used to END that declaration's
 * region early. Review demonstrated it on `v2-hero.tsx` and the homepage lost its heading. The
 * direction was SAFE — a truncated region finds FEWER `<h1>`s, so `PAGES_WITHOUT_H1` goes UP and
 * the mistake can never be used to claim a win — and it went red loudly. It is closed anyway, by
 * running this pattern over {@link maskLiterals}' output rather than raw source, so a keyword
 * inside a literal is spaces by the time the regex sees it. Prettier now only has to guarantee
 * what it actually guarantees: that real top-level code starts at column 0.
 */
const TOP_LEVEL_BOUNDARY =
  /^(?:export|import|function|async|const|let|var|class|type|interface|declare|enum)\b/gm;

function declarationRegions(file: string): Map<string, readonly [number, number]> {
  const hit = declarationCache.get(file);
  if (hit) return hit;

  const source = readSource(file);
  // Masked: a `const` at column 0 INSIDE a template literal is not a declaration, and Prettier
  // does not reindent template interiors, so the column-0 rule is exact only over masked text.
  const boundaries = [...maskedSource(file).matchAll(TOP_LEVEL_BOUNDARY)].map(
    (match) => match.index,
  );
  const regions = new Map<string, readonly [number, number]>();

  boundaries.forEach((start, position) => {
    const end = boundaries[position + 1] ?? source.length;
    const head = source.slice(start, Math.min(end, start + 200));
    const span = [start, end] as const;

    if (/^export\s+default\b/.test(head)) {
      regions.set("default", span);
      const named = head.match(
        /^export\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/,
      );
      if (named) regions.set(named[1]!, span);
      return;
    }
    const destructured = head.match(/^export\s+(?:const|let|var)\s*\{([^}]*)\}/);
    if (destructured) {
      for (const raw of destructured[1]!.split(",")) {
        const name = raw
          .trim()
          .split(/\s*:\s*/)
          .pop()
          ?.trim();
        if (name && /^[A-Za-z0-9_$]+$/.test(name)) regions.set(name, span);
      }
      return;
    }
    const declared = head.match(
      /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/,
    );
    if (declared) regions.set(declared[1]!, span);
  });

  declarationCache.set(file, regions);
  return regions;
}

/** `export { A, B as C } from "…"` and `export * from "…"` — the forwarding a name can hide behind. */
const REEXPORT_NAMED = /^export\s+\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm;
const REEXPORT_STAR = /^export\s*\*\s*from\s*["']([^"']+)["']/gm;

function reexportTargetsOf(file: string, name: string): RenderNode[] {
  const source = readSource(file);
  const targets: RenderNode[] = [];
  for (const match of source.matchAll(REEXPORT_NAMED)) {
    const target = resolveSpecifier(file, match[2]!);
    if (target === null) continue;
    for (const raw of match[1]!.split(",")) {
      const member = raw.trim();
      if (member.length === 0 || /^type\b/.test(member)) continue;
      const aliased = member.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      if (aliased) {
        if (aliased[2] === name) targets.push({ file: target, name: aliased[1]! });
      } else if (member === name) {
        targets.push({ file: target, name });
      }
    }
  }
  for (const match of source.matchAll(REEXPORT_STAR)) {
    const target = resolveSpecifier(file, match[1]!);
    if (target !== null) targets.push({ file: target, name });
  }
  return targets;
}

/**
 * The modules this walk could NOT isolate a declaration in, and so scanned WHOLE — the honest
 * residue of the render-granularity rule, given a number so a reviewer can watch it instead of
 * it being invisible.
 *
 * A fallback is not a defect on its own: it means the walk is being conservative, crediting a
 * render root with every `<h1>` in the module rather than risking a false negative. It IS the
 * shape that produced the original HIGH, though, so the list is pinned to an exact length and an
 * exact membership below. If it ever grows long, the isolation rule is too weak and needs another
 * pass — the fallback must never become the common path.
 *
 * Measured 2026-09-18 over all 39 render roots. Each entry is `file — name`, the node that could
 * not be isolated.
 */
export const MODULE_SCOPE_FALLBACKS: ReadonlyArray<readonly [string, string]> = [];

function recordFallback(file: string, name: string): void {
  fallbacksSeen.set(`${label(file)} — ${name}`, name);
}

/**
 * The source span a node contributes. `null` name = the whole file (a render root, or a module
 * scanned as a fallback). A named node whose declaration cannot be found is first chased through
 * re-exports; only if that fails does it fall back to module scope, RECORDED.
 */
type NodeSpan =
  | { readonly kind: "span"; readonly from: number; readonly to: number }
  | { readonly kind: "forward"; readonly nodes: readonly RenderNode[] };

function nodeSpan(node: RenderNode): NodeSpan {
  const source = readSource(node.file);
  const whole = { kind: "span", from: 0, to: source.length } as const;
  if (node.name === null) return whole;

  const region = declarationRegions(node.file).get(node.name);
  if (region) {
    // A region that is nothing but `export default Identifier;` is a FORWARD, not a body. Final
    // review found this shape degrading SILENTLY: `const Page = () => (…); export default Page;`
    // produced a `default` region holding only the export statement, so the walk entered, found no
    // JSX, returned no sites — and, because a region HAD been found, never reached
    // `recordFallback`. That is a hole in the one guarantee the recorder exists to make, which is
    // why it is closed in code rather than described more accurately in SCOPE note 8. Follow the
    // identifier to its own declaration (or to the module it is imported from); if it resolves to
    // neither, fall back to module scope AND record it. Never neither.
    const bare = readSource(node.file)
      .slice(region[0], region[1])
      .trim()
      .match(/^export\s+default\s+([A-Za-z0-9_$]+)\s*;?$/);
    if (bare) {
      const target = bare[1]!;
      if (target !== node.name && declarationRegions(node.file).has(target)) {
        return { kind: "forward", nodes: [{ file: node.file, name: target }] };
      }
      const imported = importBindingsOf(node.file).get(target);
      if (imported) return { kind: "forward", nodes: [imported] };
      recordFallback(node.file, node.name);
      return whole;
    }
    return { kind: "span", from: region[0], to: region[1] };
  }

  const forwarded = reexportTargetsOf(node.file, node.name);
  if (forwarded.length > 0) return { kind: "forward", nodes: forwarded };

  recordFallback(node.file, node.name);
  return whole;
}

/** Component names actually WRITTEN as JSX in a span. `<Ns.Thing>` yields `Ns`. */
const JSX_ELEMENT = /<([A-Z][A-Za-z0-9_$]*)(?:\.[A-Za-z0-9_$]+)*(?=[\s/>])/g;

/** `dynamic(() => import("…"))` and any other literal dynamic import inside a span. */
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Reads the `className` off every `<tag …>` in a file, in ALL THREE forms this surface writes.
 *
 * A `className="…"` regex is not enough here, and that is not a hypothetical: it is the mistake
 * that produced a wrong figure twice during PR1 and PR2. All three forms are live on the pages
 * this walk visits, each provable against a real file (the positive controls below run on these
 * exact files, not on synthetic strings):
 *
 *   - `className="…"`          — `app/[locale]/(site)/araclar/page.tsx:90`, and 25 more `<h1>`s;
 *   - `className={cn("…", …)}` — `components/patterns/typography.tsx:25`, the `H1` component
 *                                `app/[locale]/(site)/hakkimizda/page.tsx` renders. This is the
 *                                page whose heading a literal-only scan cannot see AT ALL;
 *   - ``className={`…`}``      — `app/[locale]/(site)/dunya/kita/[slug]/page.tsx:108`. No `<h1>`
 *                                wears this form TODAY (it is on a `<section>` there), which is
 *                                exactly why the extractor must already handle it: the idiom is
 *                                native to these files, so the first heading written in it would
 *                                otherwise drop silently out of every count below.
 *
 * Mechanics, in two passes rather than one regex, because a regex cannot balance braces:
 * {@link tagTextAt} walks from `<tag` to the `>` that closes it, tracking brace depth and string
 * state so a `>` inside `{…}` (an arrow function, a comparison in a template hole) does not end
 * the tag early; {@link classNameLiteralsIn} then pulls every string/template literal out of the
 * attribute value and joins them. For `cn("a b", className)` that yields `"a b"` — the fixed part,
 * which is the spelling being counted; the caller-supplied `className` argument is a variable and
 * contributes nothing, correctly. For a template literal the `${…}` hole is kept VERBATIM inside
 * the spelling, so a computed class reads as its own distinct, obviously-unconverged spelling
 * rather than collapsing into a neighbouring one.
 */
function tagTextAt(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quote !== null) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/** Every string/template literal inside an attribute expression, contents only. */
function classNameLiteralsIn(expression: string): string[] {
  const literals: string[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i]!;
    if (ch !== '"' && ch !== "'" && ch !== "`") {
      i += 1;
      continue;
    }
    let j = i + 1;
    let buffer = "";
    while (j < expression.length) {
      const inner = expression[j]!;
      if (inner === "\\") {
        buffer += inner + (expression[j + 1] ?? "");
        j += 2;
        continue;
      }
      if (inner === ch) break;
      buffer += inner;
      j += 1;
    }
    literals.push(buffer);
    i = j + 1;
  }
  return literals;
}

/**
 * Two markers, not one, so an element with no class list and an element with a FULLY COMPUTED one
 * never merge into a single "spelling". They are different defects with different fixes — the
 * first is an unstyled heading, the second is a heading whose treatment this scanner cannot read
 * at all — and collapsing them would let a computed `<h1 className={headingClass}>` hide inside
 * the same bucket as a genuinely bare one, so `H1_SPELLINGS` would report one where the real
 * answer is two distinct treatments.
 */
const NO_CLASSNAME = "(no className attribute)";
const COMPUTED_CLASSNAME = "(className with no string literal)";

function classNameOfTag(tag: string): string {
  const at = tag.indexOf("className=");
  if (at === -1) return NO_CLASSNAME;
  let i = at + "className=".length;
  while (i < tag.length && /\s/.test(tag[i]!)) i += 1;
  const opener = tag[i];

  if (opener === '"' || opener === "'") {
    const end = tag.indexOf(opener, i + 1);
    return tag.slice(i + 1, end === -1 ? tag.length : end);
  }

  if (opener === "{") {
    let depth = 0;
    let quote: string | null = null;
    let j = i;
    for (; j < tag.length; j += 1) {
      const ch = tag[j]!;
      if (quote !== null) {
        if (ch === "\\") j += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth += 1;
      else if (ch === "}" && (depth -= 1) === 0) break;
    }
    const literals = classNameLiteralsIn(tag.slice(i + 1, j));
    return literals.length > 0 ? literals.join(" ") : COMPUTED_CLASSNAME;
  }

  return COMPUTED_CLASSNAME;
}

/** One normalised spelling per `<tag>` element in `source`, in source order. */
export function classNamesOf(source: string, tag: string): string[] {
  const opener = new RegExp(`<${tag}[\\s>]`, "g");
  return [...source.matchAll(opener)].map((match) =>
    classNameOfTag(tagTextAt(source, match.index)).trim().replace(/\s+/g, " "),
  );
}

/**
 * One `<h1>` element in one file: where it starts in the source (so a declaration region can say
 * whether it is inside it), its ordinal within the file (so the same element reached from two
 * render roots is ONE element) and its normalised spelling.
 */
type H1Occurrence = { readonly index: number; readonly ordinal: number; readonly spelling: string };

function h1OccurrencesOf(file: string): readonly H1Occurrence[] {
  const hit = h1Cache.get(file);
  if (hit) return hit;
  const occurrences: H1Occurrence[] = [];
  if (file.endsWith(".tsx")) {
    const source = readSource(file);
    [...source.matchAll(/<h1[\s>]/g)].forEach((match, ordinal) => {
      occurrences.push({
        index: match.index,
        ordinal,
        spelling: classNameOfTag(tagTextAt(source, match.index)).trim().replace(/\s+/g, " "),
      });
    });
  }
  h1Cache.set(file, occurrences);
  return occurrences;
}

/** A single `<h1>` element in the tree: the file that writes it and its ordinal within that file. */
type H1Site = { readonly key: string; readonly file: string; readonly spelling: string };

/**
 * Every `<h1>` element a render root actually RENDERS, found by walking the render graph described
 * above. The `key` is `file#ordinal`, so one element reached from four pages stays one element.
 */
function h1SitesOf(root: string, onVisit?: (node: RenderNode) => void): H1Site[] {
  // The memo is bypassed when a caller wants the traversal itself (`renderNodesVisited`).
  const memo = onVisit ? undefined : sitesCache.get(root);
  if (memo) return memo;
  const sites = new Map<string, H1Site>();
  const visited = new Set<string>();
  // ENTER AT THE ROOT'S RENDERED ENTRY, not at its whole file. Next.js renders a render root's
  // DEFAULT export and nothing else in the module, so a helper component declared beside it and
  // never written as JSX renders nothing — yet the whole-file entry counted its `<h1>` anyway,
  // moving `PAGES_WITHOUT_H1` with no markup rendered. That is the original HIGH surviving in the
  // one place the graph still degraded to module scope, and in exactly the five files Task 3 will
  // edit. A local helper that IS rendered is still counted: it is reached as JSX, like any other
  // component. If a root has no isolatable `default`, `nodeSpan` falls back to module scope and
  // RECORDS it in `MODULE_SCOPE_FALLBACKS` rather than degrading silently.
  const queue: RenderNode[] = [{ file: root, name: "default" }];

  while (queue.length > 0) {
    const node = queue.shift()!;
    const visitKey = `${node.file}::${node.name ?? "*whole*"}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    onVisit?.(node);

    const span = nodeSpan(node);
    if (span.kind === "forward") {
      queue.push(...span.nodes);
      continue;
    }
    const { from, to } = span;

    for (const occurrence of h1OccurrencesOf(node.file)) {
      if (occurrence.index < from || occurrence.index >= to) continue;
      const key = `${label(node.file)}#${occurrence.ordinal}`;
      sites.set(key, { key, file: label(node.file), spelling: occurrence.spelling });
    }

    // MASKED. A component name inside a string literal is prose, not a render — see
    // `maskLiterals`. Indices are preserved, so the dynamic-import scan below can ask the mask
    // whether a given `import(` really is code rather than text inside a quoted string.
    const masked = maskedSource(node.file).slice(from, to);
    const bindings = importBindingsOf(node.file);
    const locals = declarationRegions(node.file);
    for (const match of masked.matchAll(JSX_ELEMENT)) {
      const tag = match[1]!;
      const imported = bindings.get(tag);
      if (imported) queue.push(imported);
      else if (locals.has(tag)) queue.push({ file: node.file, name: tag });
    }
    // Dynamic imports are followed only from a NAMED node's span, never from a whole-file one.
    // `const Heavy = dynamic(() => import("…"))` is reached because `<Heavy>` is rendered, which
    // puts the walk inside `Heavy`'s own declaration region; a `dynamic()` call sitting unrendered
    // at module level is therefore gated exactly like an unused import.
    if (node.name !== null) {
      const slice = readSource(node.file).slice(from, to);
      for (const match of slice.matchAll(DYNAMIC_IMPORT)) {
        if (!masked.startsWith("import", match.index)) continue; // inside a string literal
        const target = resolveSpecifier(node.file, match[1]!);
        if (target !== null) queue.push({ file: target, name: "default" });
      }
    }
  }

  const result = [...sites.values()];
  if (!onVisit) sitesCache.set(root, result);
  return result;
}

/** How many distinct render nodes the walk visits across the whole surface — anti-vacuity. */
/**
 * Per render root: the component names its entry declaration WRITES as JSX, and how many nodes the
 * walk actually RESOLVED beyond that entry.
 *
 * The entry node itself is excluded from the resolved count — every root trivially visits
 * `{root, "default"}`, so counting it would make the property below true by construction.
 *
 * The names are what make the property honest in the other direction. A root that renders no
 * component at all resolves nothing and is RIGHT to: `app/[locale]/(site)/not-found.tsx` writes
 * only `<div>`, `<p>` and its own `<h1>`, and its docblock says why it deliberately has no link.
 * Comparing resolved-count against names-written exempts that case by construction rather than by
 * a named exemption that would go stale.
 */
function rootResolution(): { root: string; names: string[]; resolved: number }[] {
  return walkRenderRoots().map((page) => {
    const nodes = new Set<string>();
    h1SitesOf(page, (node) => nodes.add(`${node.file}::${node.name ?? "*whole*"}`));

    let span = nodeSpan({ file: page, name: "default" });
    if (span.kind === "forward" && span.nodes[0]) span = nodeSpan(span.nodes[0]);
    const masked = maskedSource(page);
    const text = span.kind === "span" ? masked.slice(span.from, span.to) : masked;

    return {
      root: label(page),
      names: [...new Set([...text.matchAll(JSX_ELEMENT)].map((match) => match[1]!))].sort(),
      resolved: nodes.size - 1,
    };
  });
}

/** Every distinct `<h1>` element rendered by any render root, grouped by spelling. */
function h1SitesBySpelling(): Map<string, string[]> {
  const seen = new Set<string>();
  const bySpelling = new Map<string, string[]>();
  for (const page of walkRenderRoots()) {
    for (const site of h1SitesOf(page)) {
      if (seen.has(site.key)) continue;
      seen.add(site.key);
      bySpelling.set(site.spelling, [...(bySpelling.get(site.spelling) ?? []), site.key]);
    }
  }
  return bySpelling;
}

function pagesWithNoH1(): string[] {
  return walkRenderRoots()
    .filter((page) => h1SitesOf(page).length === 0)
    .map(label)
    .sort();
}

/** Every module-scope fallback the walk hit over the whole surface, as `file — name`. */
function moduleScopeFallbacks(): string[] {
  resetScannerCaches();
  for (const page of walkRenderRoots()) h1SitesOf(page);
  return [...fallbacksSeen.keys()].sort();
}

/**
 * Render roots that reach more than one `<h1>` and are NOT exempt, in the same named-with-a-reason
 * shape `BODY_WRAPPER_EXEMPTIONS` above uses for the three sticky nav bars: path, the two source
 * conditions that make it legitimate, and a liveness assertion so the exemption cannot outlive its
 * reason.
 *
 * ONE member, VERIFIED IN THE SOURCE rather than asserted. `app/[locale]/(site)/profil/page.tsx`
 * reaches two `<h1>` elements, and they can never render together:
 *
 *   line  82  {result.kind === "ok" && result.profile.accountRole === "TEACHER" && (
 *   line  89      <h1 className="text-xl font-bold tracking-tight text-foreground">   <- the page's own
 *   line 103  {result.kind === "ok" && result.profile.accountRole === "STUDENT" && (
 *   line 105      <V2ProfileForm locale={locale} profile={result.profile} />
 *
 * and `components/v2/v2-profile-form.tsx:220` renders the second `<h1>` unconditionally inside
 * that component. One `accountRole` cannot be both `"TEACHER"` and `"STUDENT"`, `V2ProfileForm` is
 * rendered from exactly one place in the file (line 105, inside the STUDENT branch — the only
 * other reference is its import on line 11), and the page's own `<h1>` occurs exactly once, inside
 * the TEACHER branch. So the rendered DOM carries exactly ONE `<h1>` on every request. The
 * reachability scan cannot evaluate a condition (SCOPE note 4) and sees two; the exemption is
 * where that difference is recorded, so `PAGES_WITH_MULTIPLE_H1` can be pinned at the number of
 * pages that really ship two, which is 0.
 *
 * The liveness check below fails if either guard disappears from the source, which is exactly what
 * would happen if someone unified the two branches — at which point the exemption is wrong and
 * must be dropped rather than carried.
 */
const MULTIPLE_H1_EXEMPTIONS: ReadonlyArray<{
  readonly file: string;
  readonly guards: readonly [string, string];
  readonly why: string;
}> = [
  {
    file: "app/[locale]/(site)/profil/page.tsx",
    guards: [
      'result.profile.accountRole === "TEACHER"',
      'result.profile.accountRole === "STUDENT"',
    ],
    why: "Mutually exclusive accountRole branches: the page's own h1 (:89) renders only for TEACHER, V2ProfileForm's (v2-profile-form.tsx:220) only for STUDENT. One h1 ever reaches the DOM.",
  },
];

/** `page — n: file, file` for each non-exempt render root whose closure holds >1 `<h1>`. */
function pagesWithMultipleH1(): string[] {
  const exempt = new Set(MULTIPLE_H1_EXEMPTIONS.map((exemption) => exemption.file));
  return walkRenderRoots()
    .map((page) => ({ page, sites: h1SitesOf(page) }))
    .filter(({ page, sites }) => sites.length > 1 && !exempt.has(label(page)))
    .map(
      ({ page, sites }) =>
        `${label(page)} — ${sites.length}: ${sites.map((s) => s.key).join(", ")}`,
    )
    .sort();
}

/**
 * SCOPE — what the three counters below CANNOT see.
 *
 * They are a source-text scan over a static RENDER graph — see the walk's own docblock for why
 * "render" and not "import": a plain import closure is the HIGH this file already shipped once.
 * They are not a render, not a DOM, and not a route. Every number they print is a claim about
 * `<h1` literals lying inside declaration spans a render root actually writes as JSX, and nothing
 * more. Specifically:
 *
 *   1. AN `h1` FROM A COMPONENT THE WALK CANNOT REACH. A name is followed only when it is written
 *      as a JSX element, so anything that renders a component WITHOUT naming it in JSX is
 *      invisible: a heading passed as `children` from a layout, `React.createElement(Heading)`,
 *      `{slots.map((C) => <C/>)}` over a component array, a render prop, or a
 *      `dynamic(() => import(someVariable))` whose specifier is not a string literal. `import
 *      type` edges are dropped on purpose (they compile to nothing), so a component imported ONLY
 *      as a type — and therefore never rendered — correctly contributes no heading.
 *
 *   2. A COMPUTED HEADING LEVEL. `const Tag = level === 1 ? "h1" : "h2"; return <Tag …>` renders
 *      an `h1` whose source contains no `<h1` at all. So does `React.createElement("h1", …)` and
 *      any `as`/`asChild`-style level prop. `components/ui/*` primitives that take a heading level
 *      as a prop would land here. None of the 32 elements found today is of this shape — every one
 *      is a literal `<h1` — but nothing below would notice the first one that is.
 *
 *   3. A className ASSEMBLED FROM VARIABLES. {@link classNameOfTag} reads the LITERAL parts of an
 *      attribute value. `className={headingClass}`, `className={cn(tierClass, className)}` and
 *      `className={styles.title}` contribute no literal and report as
 *      `"(className with no string literal)"` — a SEPARATE marker from `"(no className
 *      attribute)"`, so a genuinely unstyled heading and a fully computed one never merge into one
 *      spelling. A template literal's `${…}` holes are kept verbatim in the spelling for the same
 *      reason: the counter can show that a spelling is computed; it cannot resolve it. In the
 *      other direction the reading is a UNION, not the first argument: every string literal in the
 *      expression is joined, so `cn("a b", extra)` reports `"a b"` (a caller's variable
 *      contributes nothing, so two call sites differing only in what the caller passes read as one
 *      spelling) but `cn("a b", isActive && "c")` reports `"a b c"` — a class list no single
 *      render necessarily produces. No live `<h1>` is of that second shape today.
 *
 *   4. WHICH BRANCH ACTUALLY RENDERS. This is a REACHABILITY count, not an occurrence count, and
 *      `PAGES_WITH_MULTIPLE_H1` is where that bites. `/profil` is the only render root reaching
 *      two, and its two `<h1>`s are MUTUALLY EXCLUSIVE at runtime (`accountRole === "TEACHER"` vs
 *      `=== "STUDENT"`, both verified in the source — see `MULTIPLE_H1_EXEMPTIONS` above for the
 *      line-by-line reading). The rendered DOM carries exactly one. The scan sees two, because it
 *      cannot evaluate a condition, so the difference is recorded as a NAMED EXEMPTION with a
 *      liveness check rather than folded into the number: a page that genuinely ships two `<h1>`s
 *      in one DOM and a page that merely holds two branches look identical from here, and the
 *      exemption is where a human tells them apart once. Any OTHER page reaching two goes red.
 *      The mirror of this is `PAGES_WITHOUT_H1`: a page with a conditionally-rendered heading that
 *      is absent on every real request still counts as HAVING one.
 *
 *   5. ANYTHING `walkRenderRoots()` DOES NOT VISIT. It returns `page.tsx`, `error.tsx` and
 *      `not-found.tsx` under `PAGE_ROOTS` — the three counters below use it, NOT `walkPages()`.
 *      Still outside: `app/not-found.tsx` (spelling `font-heading text-3xl font-bold`, no
 *      `text-foreground` — it renders outside the locale layout) and `app/global-error.tsx` (an
 *      `<h1>` with an inline `style` and no `className` at all), both app-ROOT files above
 *      `app/[locale]`; see `walkRenderRoots()`'s own docblock for why folding those two
 *      chrome-less shells into a page-heading counter would give the adoption task targets it
 *      cannot legitimately move onto the hub/detail tiers. `layout.tsx` is likewise never read,
 *      so a heading that moved into one would leave its page reading "no h1". There is no
 *      `loading.tsx` or `template.tsx` anywhere in the tree today, and no `(play)` `error.tsx` or
 *      `not-found.tsx`; the walk would pick them up automatically if any were added.
 *
 *   6. A LITERAL `<h1` IN A STRING. `sourceOf()` strips comments — a docblock quoting an `<h1>` is
 *      already handled — but it copies string and template literals through verbatim, by design.
 *      An `<h1` inside a quoted string (a fixture, a docs snippet, `dangerouslySetInnerHTML`
 *      markup) would be counted as an element. No such string exists on this surface today.
 *      The RELATED hole — a COMPONENT name in a string (`const USAGE = "<PageHero />"`) pulling
 *      that module's heading in — is CLOSED, not scoped: the JSX scan runs over
 *      {@link maskLiterals}' output. Only the `<h1` literal scan above still reads raw text,
 *      because that is where the className has to be read from.
 *
 *   7. WHETHER THE HEADING IS CORRECT. Nothing here reads the heading's TEXT, its position in the
 *      document, whether it precedes an `h2`, or whether the page's `<title>` agrees with it.
 *      "Has exactly one `h1`" is not "has a correct heading outline".
 *
 *   8. WHERE A DECLARATION CANNOT BE ISOLATED. Crediting a heading to the declaration that writes
 *      it needs that declaration's span. `import * as Ns` and any shape
 *      {@link declarationRegions} does not recognise fall back to the WHOLE module — the old
 *      module-granularity behaviour, for that one module. Conservative (it over-credits, never
 *      under-credits) and NEVER SILENT: every fallback is recorded and pinned by
 *      {@link MODULE_SCOPE_FALLBACKS}, which is EMPTY on today's tree.
 *
 *      "Never silent" is a guarantee, so the two ways it was leaking are closed rather than
 *      described. A render root is no longer entered as a whole file but at its `default` export,
 *      so an unrendered helper declared beside the page component contributes nothing; that was
 *      the last place the graph degraded to module scope, and it degraded in the five files Task 3
 *      will edit. And a `default` region that holds nothing but `export default Identifier;` is
 *      now FOLLOWED to that identifier's own declaration (or to the module it is imported from)
 *      rather than entered and found empty — `const Page = () => (…); export default Page;`
 *      previously returned no sites AND recorded no fallback, which is the one combination this
 *      mechanism exists to make impossible. If the identifier resolves to neither, the fallback is
 *      recorded. Both halves are pinned by controls: one asserting the arrow form resolves, one
 *      asserting an unresolvable default is recorded. Never neither.
 *
 *   9. A LOCAL SHADOW OF AN IMPORTED NAME. `h1SitesOf` checks import bindings before local
 *      declarations, so `import { V2Hero }` plus a function-body `const V2Hero = () => null` plus
 *      `<V2Hero />` credits the IMPORTED component's heading. Not closed here on purpose: `pnpm
 *      lint` exits 1 on that shape (`'V2Hero' is defined but never used`, plus React's
 *      "Cannot create components during render"), so the gate already blocks it and a second guard
 *      in a scanner would be the weaker of the two.
 */

/**
 * EXACT, not a ceiling — the same doctrine `PAGE_BODY_SPELLINGS` above records, and for the same
 * reason: a ceiling drifts upward unnoticed, an exact number makes both directions a visible diff.
 *
 * Measured 2026-09-18 against the real tree: **13** distinct spellings across **32** distinct
 * `<h1>` elements, reachable from the 39 render roots `walkRenderRoots()` returns (37 `page.tsx`
 * plus `(site)/error.tsx` and `(site)/not-found.tsx`).
 *
 * That number moved during this task, and the history is the point rather than noise. The first
 * scan used `walkPages()` and read 12 across 30, against a plan that said 13 across 32. The gap
 * was not an error in either: `(site)/error.tsx:41` and `(site)/not-found.tsx:28` share one
 * spelling (`font-heading text-3xl font-bold text-foreground`) that no `page.tsx` closure reaches,
 * so 12 + that one = 13 and 30 + those two = 32, exactly. A reader who lands on a thrown error or
 * an unknown slug sees a real page with a real heading, so the counters were widened onto
 * `walkRenderRoots()` and RE-MUTATION-CHECKED at the new value — `walkPages()` itself untouched,
 * because PR1's and PR2's counters are pinned against it (see `walkRenderRoots()`'s docblock).
 *
 * The distribution, which is the point of pinning it: ONE spelling covers 14 of the 32 elements
 * (`font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight`, the
 * terracotta hub tier) and a second covers 3 (`font-heading text-4xl sm:text-6xl font-extrabold
 * tracking-tight text-foreground`, the neutral detail tier). Those two are the RULED end state —
 * both tiers survive, so this counter's floor is 2, never 1. The other 11 spellings cover 15
 * elements between them and are the drift a later task removes.
 *
 * UNCHANGED BY THE RENDER-GRANULARITY FIX. The walk underneath these counters was rebuilt in fix
 * round 2 — from a transitive import closure to the JSX-gated render graph above, after review
 * proved an UNUSED import could move `PAGES_WITHOUT_H1` — and every number came back identical:
 * 13 spellings, 32 elements, the same 5 with none, the same one with two. Not a coincidence:
 * every heading on this surface is rendered by the module that reaches it, at depth 0 or 1, with
 * zero module-scope fallbacks. The old walk was right by luck about today's tree and wrong by
 * construction about the tree Task 3 will create.
 *
 * MUTATION-CHECKED 2026-09-18 AT THIS VALUE, not at the 12 it was first pinned to, and re-checked
 * after the render-graph rebuild rather than carried over: a fourteenth spelling introduced on
 * `app/[locale]/(site)/araclar/page.tsx` takes it RED with the spelling AND its file printed;
 * reverted, GREEN. See `task-1-report.md` for the verbatim output of all three rounds.
 */
export const H1_SPELLINGS = 13;

/**
 * The denominator: how many distinct `<h1>` ELEMENTS those spellings cover. Pinned separately so
 * a change that swaps one heading for another (element count steady, spelling count steady) is
 * still visible, and so the anti-vacuity control has something exact to assert. Its failure
 * message prints every element as `file#ordinal`, one per line — it is usually the FIRST thing to
 * go red on a heading change, so a bare number there would be the papercut PR1's review recorded.
 */
export const H1_ELEMENTS = 32;

/**
 * Render roots whose entire closure holds no `<h1>` element. Measured 2026-09-18 over
 * `walkRenderRoots()`: **5**, matching the plan's number and UNCHANGED by the widening —
 * `(site)/error.tsx` and `(site)/not-found.tsx` both carry their own heading, so adding them to
 * the walk added no offenders. Worth naming WHICH five, because two different defects are mixed
 * in this list:
 *
 *   - the three `(play)/oyun/*` screens, which compose `components/v2/v2-game-screen.tsx`; that
 *     component's highest heading is an `<h3>`. A fullscreen game screen arguably wants no page
 *     title, but starting the outline at `h3` is a defect either way;
 *   - `giris` and `kayit`, which start at `<h2>` — `components/v2/v2-login-card.tsx:169` and
 *     `components/v2/v2-register-card.tsx:359`. Both are ordinary `(site)` reading-surface pages
 *     with a breadcrumb trail and metadata, and neither has a top-level heading.
 *
 * Recorded, not fixed: this task is the counter. The list is printed one path per line on failure
 * so the adoption task can act on it without re-deriving it.
 *
 * THE COUNTER TASK 3 WILL PUSH ON, and therefore the one the render-granularity rule exists for.
 * Adopting a heading component means IMPORTING it into these five files; under the import closure
 * this file first shipped, that import ALONE would have emptied this list. "An import that renders
 * nothing changes no counter" below is the standing regression test for exactly that, and it must
 * survive this number finally moving.
 *
 * MUTATION-CHECKED 2026-09-18 at this value, including once on `(site)/not-found.tsx` — a file the
 * pre-Ruling-F walk could not see — and re-checked after the render-graph rebuild. See
 * `task-1-report.md`.
 */
export const PAGES_WITHOUT_H1 = 5;

/**
 * NON-EXEMPT render roots whose closure holds more than one `<h1>` element. Measured 2026-09-18:
 * **0**.
 *
 * Exactly one render root reaches two — `app/[locale]/(site)/profil/page.tsx` — and it is a NAMED
 * EXEMPTION (`MULTIPLE_H1_EXEMPTIONS` above), not a defect: its two headings sit on mutually
 * exclusive `accountRole` branches, read line by line out of the source there, so the rendered DOM
 * carries one. Pinning at 0 rather than at 1 is what makes the counter mean "no page ships two
 * headings" instead of "the number of pages that happen to contain two `<h1>` literals" — and the
 * exemption's own liveness test is what stops that reasoning outliving the code it describes.
 *
 * MUTATION-CHECKED 2026-09-18 at this value — see `task-1-report.md`.
 */
export const PAGES_WITH_MULTIPLE_H1 = 0;

describe("the heading scanner itself", () => {
  // ANTI-VACUITY. Every assertion in the three describe blocks below would also pass against a
  // closure that never crossed a file boundary, an extractor that never matched, or a walk that
  // returned nothing. These run against the live tree and prove otherwise first.

  it("the render graph crosses file boundaries on the real tree — anti-vacuity", () => {
    // A PROPERTY, not an identity. The earlier version pinned `hakkimizda -> typography.tsx` and
    // `/ -> v2-hero.tsx` by name; those are files Task 3 exists to change, so the control would
    // have died on the work it is meant to survive. "Some root takes its heading from another
    // file" can only become MORE true as pages adopt a shared heading component.
    const crossing = walkRenderRoots().filter((root) =>
      h1SitesOf(root).some((site) => site.file !== label(root)),
    );
    expect(crossing.length).toBeGreaterThan(0);
  }, 20000);

  it("every render root resolves at least one node beyond its own entry — anti-vacuity", () => {
    // Every counter below reports a SMALL number, which a walk that never got anywhere would also
    // report. This was a global floor (`> 120` against 183) until final review measured that 176
    // nodes would still be visited with all five `<h1>`-bearing modules unreached — so it caught
    // only a fully collapsed walk. A tighter global number would be worse: it would drift on every
    // adoption task and teach the next implementer to re-pin it without thinking.
    //
    // The PER-ROOT property is what was actually wanted. It cannot pass on a collapsed walk, it
    // cannot pass on a walk that resolves for some roots and not others, and it does not move when
    // pages change what they render.
    const resolution = rootResolution();
    const stalled = resolution.filter(({ names, resolved }) => names.length > 0 && resolved === 0);
    expect(
      stalled.map(({ root }) => root),
      `render roots that write a component but resolved none of it:\n${stalled
        .map(({ root, names }) => `  ${root} — writes ${names.join(", ")}`)
        .join("\n")}`,
    ).toEqual([]);

    // Anti-vacuity for the property itself: it would also pass if NO root wrote any component.
    expect(resolution).toHaveLength(39);
    expect(resolution.filter(({ names }) => names.length > 0).length).toBeGreaterThan(30);
  }, 20000);

  it("drops `import type` edges — a type-only import renders nothing, on the real tree", () => {
    // `lib/auth/submit.client.ts:5` writes `import type { AuthBffCode } from "./transport.server"`
    // and nothing else from it — the live fixture `components/patterns/rsc-boundary.test.ts`
    // depends on too. Both the shared resolver and this file's binding parser must erase it.
    const submit = join(repoRoot, "lib/auth/submit.client.ts");
    expect(readFileSync(submit, "utf8")).toContain('import type { AuthBffCode } from "./transport');
    expect(runtimeImportsOf(submit).map(label)).not.toContain("lib/auth/transport.server.ts");
    expect([...importBindingsOf(submit).keys()]).not.toContain("AuthBffCode");
  });

  it("found a real, non-trivial number of h1 elements", () => {
    const sites = [...h1SitesBySpelling().values()].flat().sort();
    expect(
      sites,
      `every <h1> element rendered by a render root, as file#ordinal:\n${sites
        .map((s) => `  ${s}`)
        .join("\n")}`,
    ).toHaveLength(H1_ELEMENTS);
  });

  it("walkRenderRoots() adds the two special files and nothing else", () => {
    const roots = walkRenderRoots().map(label);
    expect(roots).toHaveLength(39);
    expect(roots).toContain("app/[locale]/(site)/error.tsx");
    expect(roots).toContain("app/[locale]/(site)/not-found.tsx");
    // Never reaches the app-ROOT shells above `app/[locale]` — see its docblock for the cost.
    expect(roots).not.toContain("app/not-found.tsx");
    expect(roots).not.toContain("app/global-error.tsx");
  });

  it("isRenderRootPath matches a whole basename, never a suffix — the mechanism, not its output", () => {
    // NOT `expect(roots.every(...))`: every path that survives the filter trivially satisfies any
    // predicate weaker than the filter, so such an assertion re-derives the filter's own output and
    // cannot fail whatever the filter does. Proven during review: degrading the filter to
    // `path.endsWith(name)` left all 45 tests green. These run on synthetic paths, so they hold
    // regardless of what happens to be in the tree.
    expect(isRenderRootPath("/a/b/page.tsx")).toBe(true);
    expect(isRenderRootPath("/a/b/error.tsx")).toBe(true);
    expect(isRenderRootPath("/a/b/not-found.tsx")).toBe(true);
    expect(isRenderRootPath("/a/b/my-page.tsx")).toBe(false);
    expect(isRenderRootPath("/a/b/shared-not-found.tsx")).toBe(false);
    expect(isRenderRootPath("/a/b/zz-error.tsx")).toBe(false);
  });

  /**
   * THE FIXTURE ROOT. Every scanner control below runs against synthetic source at a path that
   * does not exist on disk, instead of injecting on top of a real page.
   *
   * They used to be built on `giris/page.tsx`, and each assumed that file renders no `<h1>`.
   * `giris` is one of the five files `PAGES_WITHOUT_H1` exists to drive to zero, so the moment
   * Task 3 gives it a heading — which it must — five scanner controls would have gone red
   * alongside the two counters that are SUPPOSED to move, and the cheapest green would be to
   * delete them. One of the five is the standing guard against the HIGH. That is how a guard
   * actually dies: not disabled on purpose, but rewritten by the task it was pointed at.
   *
   * The path is under `(site)` so `@/`-relative resolution behaves identically, but
   * `walkRenderRoots()` lists the real directory and never sees it, so nothing here can leak into
   * a counter. The modules it imports are REAL (`typography.tsx`, `v2-hero.tsx`), which is what
   * keeps these controls exercising production code rather than a toy graph.
   */
  const FIXTURE_ROOT = join(repoRoot, "app/[locale]/(site)/__scanner-fixture__/page.tsx");

  const fixture = (body: string, head = "") =>
    `${head}\nexport default function FixturePage() {\n  return (\n    <main>\n${body}\n    </main>\n  );\n}\n`;

  const fixtureSites = (source: string) =>
    withInjectedSource([[FIXTURE_ROOT, source]], () =>
      h1SitesOf(FIXTURE_ROOT).map((site) => site.key),
    );

  it("an import that renders nothing contributes no heading — the guarantee, on a fixture", () => {
    // THE REGRESSION TEST FOR THE HIGH, in its tree-independent form. PR3's review added an unused
    // `import { H2 } from "@/components/patterns/typography"` to a page with no heading, changed no
    // markup, and watched `PAGES_WITHOUT_H1` fall 5 -> 4 — `typography.tsx` also exports `H1` and
    // the closure was module-granular. Same import here, same real module, nothing rendered.
    expect(
      fixtureSites(
        fixture(
          "      <p>nothing</p>",
          'import { H1, H2 } from "@/components/patterns/typography";',
        ),
      ),
    ).toEqual([]);
  });

  it("the same import RENDERED does contribute one — positive control for the gate above", () => {
    // Without this, a gate that rejected everything would make the test above pass vacuously.
    expect(
      fixtureSites(
        fixture("      <H1>probe</H1>", 'import { H1 } from "@/components/patterns/typography";'),
      ),
    ).toEqual(["components/patterns/typography.tsx#0"]);
  });

  it("a JSX name inside a STRING LITERAL contributes nothing", () => {
    // The comment-stripping rule one door over: `readSource` strips comments but copies string
    // literals verbatim, so `const USAGE = "<V2Hero />"` used to credit that module's <h1> to a
    // page rendering nothing. Latent, not live — no string in the tree holds a component name —
    // and closed by `maskLiterals` rather than left to SCOPE.
    const head = 'import { V2Hero } from "@/components/v2/v2-hero";';
    expect(
      fixtureSites(
        fixture(
          '      <p>{"usage: <V2Hero title={x} />"}</p>\n      <p>{`also <V2Hero/> in a template`}</p>',
          head,
        ),
      ),
    ).toEqual([]);
    // And the mask has not blinded the scanner to the real thing sitting next to the prose.
    expect(fixtureSites(fixture('      <p>{"<V2Hero />"}</p>\n      <V2Hero />', head))).toEqual([
      "components/v2/v2-hero.tsx#0",
    ]);
  });

  it("an UNRENDERED local helper in the root's own file contributes nothing", () => {
    // The last place the graph degraded to module scope: a render root used to be entered as its
    // whole file, so a helper declared beside the page component and never written as JSX still
    // counted. It moved `PAGES_WITHOUT_H1` with nothing rendered — the original HIGH surviving in
    // the five files Task 3 will edit. Now the walk enters at the root's `default` export.
    const helper = 'function UnusedHeading() {\n  return <h1 className="zz-never">x</h1>;\n}';
    expect(fixtureSites(fixture("      <p>nothing</p>", helper))).toEqual([]);
  });

  it("an arrow-assigned `export default` resolves rather than degrading silently", () => {
    // `const Page = () => (…); export default Page;` used to produce a `default` region holding
    // only the export STATEMENT: the walk entered, found no JSX, returned nothing — and recorded
    // no fallback, because a region HAD been found. Silent degradation in the exact mechanism
    // built so degradation cannot be silent. Next's page convention means no real root is written
    // this way today, which is why it went unnoticed; it resolves now.
    const source =
      'import { V2Hero } from "@/components/v2/v2-hero";\n' +
      "const Page = () => (\n  <main>\n    <V2Hero />\n  </main>\n);\nexport default Page;\n";
    const result = withInjectedSource([[FIXTURE_ROOT, source]], () => ({
      keys: h1SitesOf(FIXTURE_ROOT).map((site) => site.key),
      fallbacks: [...fallbacksSeen.keys()],
    }));
    expect(result.keys).toEqual(["components/v2/v2-hero.tsx#0"]);
    expect(result.fallbacks).toEqual([]);
  });

  it("an unresolvable `export default` is RECORDED — never resolves-nor-records", () => {
    // The other half of the same guarantee, and the one that matters: whatever the shape, a
    // `default` the walk cannot follow must appear in `MODULE_SCOPE_FALLBACKS`. Neither-nor is the
    // failure mode; it is what LOW 1 actually was.
    const result = withInjectedSource(
      [[FIXTURE_ROOT, "export default SomethingUndeclared;\n"]],
      () => ({
        keys: h1SitesOf(FIXTURE_ROOT).map((site) => site.key),
        fallbacks: [...fallbacksSeen.keys()],
      }),
    );
    expect(result.keys).toEqual([]);
    expect(result.fallbacks).toEqual([
      "app/[locale]/(site)/__scanner-fixture__/page.tsx — default",
    ]);
  });

  it("a RENDERED local helper in the root's own file still counts — positive control", () => {
    const helper = 'function UsedHeading() {\n  return <h1 className="zz-used">x</h1>;\n}';
    expect(fixtureSites(fixture("      <UsedHeading />", helper))).toEqual([
      "app/[locale]/(site)/__scanner-fixture__/page.tsx#0",
    ]);
  });

  it("follows a rendered component through a re-export barrel", () => {
    // `reexportTargetsOf` fires on NO file in the tree today — `lib/game/target.ts` is the only
    // `export … from` and it forwards values, not components. Kept anyway: the rule worth
    // enforcing is "never ship a branch nothing has executed", not "delete what no file exercises",
    // and deleting it would guarantee the first barrel-exported heading component drops silently
    // out of every count. Exercised by injection until the tree has a live case.
    const barrel = join(repoRoot, "lib/game/target.ts");
    const sites = withInjectedSource(
      [
        [FIXTURE_ROOT, fixture("      <Hero />", 'import { Hero } from "@/lib/game/target";')],
        [
          barrel,
          `${readFileSync(barrel, "utf8")}\nexport { V2Hero as Hero } from "@/components/v2/v2-hero";\n`,
        ],
      ],
      () => h1SitesOf(FIXTURE_ROOT).map((site) => site.key),
    );
    expect(sites).toEqual(["components/v2/v2-hero.tsx#0"]);
  });

  it("follows a rendered dynamic() component, and records the module-scope fallback", () => {
    // `next/dynamic` appears nowhere in the tree today; kept and injected for the same reason as
    // the barrel above. It also exercises the fallback recorder end to end: `v2-hero.tsx` has no
    // `export default`, so `{ v2-hero.tsx, default }` cannot be isolated and the walk falls back
    // to module scope — conservative, and NAMED rather than silent.
    const head =
      'import dynamic from "next/dynamic";\nconst Heavy = dynamic(() => import("@/components/v2/v2-hero"));';
    const injected = [[FIXTURE_ROOT, fixture("      <Heavy />", head)]] as const;

    expect(withInjectedSource(injected, () => h1SitesOf(FIXTURE_ROOT).map((s) => s.key))).toEqual([
      "components/v2/v2-hero.tsx#0",
    ]);
    expect(
      withInjectedSource(injected, () => {
        h1SitesOf(FIXTURE_ROOT);
        return [...fallbacksSeen.keys()];
      }),
    ).toEqual(["components/v2/v2-hero.tsx — default"]);
  });

  it("an UNRENDERED dynamic() at module level is gated too — negative control", () => {
    const head =
      'import dynamic from "next/dynamic";\nconst Heavy = dynamic(() => import("@/components/v2/v2-hero"));\nvoid Heavy;';
    expect(fixtureSites(fixture("      <p>nothing</p>", head))).toEqual([]);
  });

  it("a namespace import rendered as JSX falls back to module scope, recorded", () => {
    // `import * as Typo` binds one name to a whole module, so no declaration can be isolated. The
    // walk stays conservative (credits every <h1> in the module) and RECORDS the imprecision,
    // which is what `MODULE_SCOPE_FALLBACKS` exists to keep countable. Proof the recorder is not
    // dead code sitting behind an empty pinned list.
    const injected = [
      [
        FIXTURE_ROOT,
        fixture("      <Typo.H1 />", 'import * as Typo from "@/components/patterns/typography";'),
      ],
    ] as const;
    const result = withInjectedSource(injected, () => {
      const keys = h1SitesOf(FIXTURE_ROOT).map((site) => site.key);
      return { keys, fallbacks: [...fallbacksSeen.keys()] };
    });
    // TWO sites, not one, since T-035 PR3 added the detail-tier `H1Display` beside `H1` in the
    // same module: "credits every <h1> in the module" is exactly what the fallback promises, and
    // the module now holds two. The counters are untouched — nothing on the real surface imports
    // this module as a namespace (see `MODULE_SCOPE_FALLBACKS`, pinned below).
    expect(result.keys).toEqual([
      "components/patterns/typography.tsx#0",
      "components/patterns/typography.tsx#1",
    ]);
    expect(result.fallbacks).toEqual(["components/patterns/typography.tsx — *"]);
  });

  it("neither an unused import nor an unrendered helper moves ANY counter — whole-surface", () => {
    // The fixture controls above prove the mechanism; this proves the mechanism is the one the
    // counters actually run on. Both injections go into a REAL render root, and the assertion is
    // BEFORE-equals-AFTER rather than a pinned list, so it holds whatever heading state that page
    // is in — including after Task 3 gives it one.
    const target = join(repoRoot, "app/[locale]/(site)/giris/page.tsx");
    const raw = readFileSync(target, "utf8");
    const snapshot = () => ({
      spellings: [...h1SitesBySpelling().keys()].sort(),
      without: pagesWithNoH1(),
      multiple: pagesWithMultipleH1(),
    });
    const before = snapshot();
    for (const prefix of [
      'import { H1, H2 } from "@/components/patterns/typography";',
      'function UnusedHeading() {\n  return <h1 className="zz-never">x</h1>;\n}',
    ]) {
      expect(withInjectedSource([[target, `${prefix}\n${raw}`]], snapshot)).toEqual(before);
    }
  }, 20000);

  it("isolates one declaration inside a multi-export module — H2's region holds no h1", () => {
    const typography = join(repoRoot, "components/patterns/typography.tsx");
    const regions = declarationRegions(typography);
    expect([...regions.keys()]).toEqual([
      "H1",
      "H1Display",
      "H2",
      "H3",
      "H4",
      "Lede",
      "Muted",
      "Kbd",
    ]);
    const source = readSource(typography);
    const [h1From, h1To] = regions.get("H1")!;
    const [h2From, h2To] = regions.get("H2")!;
    expect(source.slice(h1From, h1To)).toContain("<h1");
    expect(source.slice(h2From, h2To)).not.toContain("<h1");
    expect(source.slice(h2From, h2To)).toContain("<h2");
  });

  it("the module-scope fallback list is exactly the recorded one", () => {
    // The honest residue of the isolation rule: modules the walk could not resolve a declaration
    // in and therefore scanned whole. Pinned by membership AND length so a new one is a failure,
    // not a silent widening back toward the module granularity that caused the HIGH.
    const seen = moduleScopeFallbacks();
    expect(
      seen,
      `module-scope fallbacks the walk hit:\n${seen.map((f) => `  ${f}`).join("\n")}`,
    ).toEqual(MODULE_SCOPE_FALLBACKS.map(([file, name]) => `${file} — ${name}`));
  }, 20000);

  it("walkPages() is UNCHANGED by the widening — PR1/PR2's counters keep their scope", () => {
    // The whole reason `walkRenderRoots()` is a second function. If these two ever read the same
    // number, the split has been collapsed and three landed counters have silently moved.
    expect(walkPages()).toHaveLength(37);
    expect(walkRenderRoots().length).toBeGreaterThan(walkPages().length);
    expect(walkPages().map(label)).not.toContain("app/[locale]/(site)/error.tsx");
  });

  it("reads a double-quoted className — real file, app/[locale]/(site)/araclar/page.tsx", () => {
    const araclar = sourceOf(join(repoRoot, "app/[locale]/(site)/araclar/page.tsx"));
    expect(classNamesOf(araclar, "h1")).toEqual([
      "font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight",
    ]);
  });

  it("reads a cn() className — real file, components/patterns/typography.tsx", () => {
    // The `H1` component `hakkimizda` renders. A literal-only scan reads NOTHING here, which is
    // how a page loses its heading from the count entirely.
    const typography = sourceOf(join(repoRoot, "components/patterns/typography.tsx"));
    // Two entries since T-035 PR3: `H1` is the hub tier and `H1Display` the detail tier, the two
    // spellings the 17 live heroes actually write. The extractor's job here is unchanged — read
    // a `cn()` className out of a real file — and the fixture moved because the file did, not
    // because any counter did.
    expect(classNamesOf(typography, "h1")).toEqual([
      "font-heading text-[1.9rem] sm:text-5xl font-bold tracking-tight text-primary leading-tight",
      "font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground",
    ]);
  });

  it("reads a template-literal className — real file, app/[locale]/(site)/dunya/kita/[slug]/page.tsx", () => {
    // No `<h1>` wears this form today, so the proof is taken on the element that does: the hero
    // `<section>` in a real page file. The extractor is tag-agnostic, so this IS the h1 path.
    const kita = sourceOf(join(repoRoot, "app/[locale]/(site)/dunya/kita/[slug]/page.tsx"));
    expect(classNamesOf(kita, "section")).toContain(
      "relative isolate border-b border-border bg-gradient-to-b ${theme.gradient} pt-8 pb-14 overflow-hidden",
    );
  });

  it("a `>` inside a brace expression does not end the tag early", () => {
    expect(classNamesOf('<h1 onClick={() => go()} className="a b">x</h1>', "h1")).toEqual(["a b"]);
  });

  it("an h1 with no className reports as such rather than vanishing", () => {
    expect(classNamesOf("<h1>Plain</h1>", "h1")).toEqual([NO_CLASSNAME]);
  });

  it("a fully computed className gets its OWN marker, not the bare-heading one", () => {
    // Two different defects with different fixes; merging them would let a computed
    // `<h1 className={headingClass}>` hide inside the same "spelling" as a genuinely unstyled
    // heading, so `H1_SPELLINGS` would read one where the real answer is two treatments.
    expect(classNamesOf("<h1 className={headingClass}>x</h1>", "h1")).toEqual([COMPUTED_CLASSNAME]);
    expect(classNamesOf("<h1 className={cn(tierClass, extra)}>x</h1>", "h1")).toEqual([
      COMPUTED_CLASSNAME,
    ]);
    expect(NO_CLASSNAME).not.toBe(COMPUTED_CLASSNAME);
  });

  it("reads EVERY literal in the expression, not just the first — SCOPE note 3's union clause", () => {
    // `cn("a b", isActive && "c")` reports `a b c`, a class list no single render necessarily
    // produces. No live <h1> is of this shape; pinned so the note stays true of the code.
    expect(classNamesOf('<h1 className={cn("a b", isActive && "c")}>x</h1>', "h1")).toEqual([
      "a b c",
    ]);
  });

  it("does not fire on h2/h3 — negative control", () => {
    expect(classNamesOf('<h2 className="a">x</h2><h3 className="b">y</h3>', "h1")).toEqual([]);
  });

  it("a docblock quoting an h1 does not count — comment stripping applied", () => {
    const stripped = stripComments('const a = 1; /* <h1 className="text-3xl">old</h1> */');
    expect(classNamesOf(stripped, "h1")).toEqual([]);
  });
});

describe("page headings converge on the two ruled tiers", () => {
  it("the number of distinct h1 spellings is exactly the recorded number", () => {
    const bySpelling = [...h1SitesBySpelling()].sort(([a], [b]) => a.localeCompare(b));
    const message = `distinct h1 classNames reachable from a render root (page/error/not-found):\n${bySpelling
      .map(
        ([spelling, files]) =>
          `  ${files.length}x ${spelling}\n${files.map((f) => `      ${f}`).join("\n")}`,
      )
      .join("\n")}`;
    expect(
      bySpelling.map(([spelling]) => spelling),
      message,
    ).toHaveLength(H1_SPELLINGS);
  });
});

describe("every page has a top-level heading", () => {
  it("the count of pages with no h1 is exactly the recorded number", () => {
    const pages = pagesWithNoH1();
    expect(
      pages,
      `pages whose render closure holds no <h1>:\n${pages.map((p) => `  ${p}`).join("\n")}`,
    ).toHaveLength(PAGES_WITHOUT_H1);
  });
});

describe("no page reaches more than one h1", () => {
  it("the count of pages with multiple h1 elements is exactly the recorded number", () => {
    const pages = pagesWithMultipleH1();
    expect(
      pages,
      `render roots holding more than one <h1> and not named in MULTIPLE_H1_EXEMPTIONS:\n${pages.map((p) => `  ${p}`).join("\n")}`,
    ).toHaveLength(PAGES_WITH_MULTIPLE_H1);
  });
});

describe("the multiple-h1 exemptions", () => {
  // Same liveness idea as "every exemption is still live" above: a stale exemption hides a real
  // regression just as effectively as a missing rule. Here the stakes are higher than for the
  // sticky nav bars, because this exemption is the ONLY thing holding PAGES_WITH_MULTIPLE_H1 at 0.

  it.each(MULTIPLE_H1_EXEMPTIONS.map((e) => [e.file, e] as const))(
    "%s still reaches two h1 elements",
    (file, exemption) => {
      const path = join(repoRoot, file);
      expect(existsSync(path), `${file} no longer exists; drop the exemption`).toBe(true);
      expect(
        h1SitesOf(path).length,
        `${file} no longer reaches two <h1> elements; drop the exemption — ${exemption.why}`,
      ).toBeGreaterThan(1);
    },
  );

  it.each(MULTIPLE_H1_EXEMPTIONS.map((e) => [e.file, e] as const))(
    "%s still guards them with the two mutually exclusive conditions",
    (file, exemption) => {
      // The reason, not just the symptom. If the branches are ever unified — which is exactly what
      // would make the page really ship two headings — these literals vanish and this goes red,
      // so the exemption cannot survive the condition that justified it.
      const source = sourceOf(join(repoRoot, file));
      for (const guard of exemption.guards) {
        expect(
          source,
          `${file}: guard \`${guard}\` is gone; re-verify or drop the exemption`,
        ).toContain(guard);
      }
    },
  );

  it("an exemption only silences its own file — negative control", () => {
    // `pagesWithMultipleH1()` filters by exact label, so a second offender elsewhere is still
    // reported. Proven by asking for the unfiltered list and confirming profil is really in it.
    const allWithTwo = walkRenderRoots().filter((page) => h1SitesOf(page).length > 1);
    expect(allWithTwo.map(label)).toEqual(["app/[locale]/(site)/profil/page.tsx"]);
    expect(pagesWithMultipleH1()).toEqual([]);
  });
});
