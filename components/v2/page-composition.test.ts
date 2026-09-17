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
 */
const HAND_WRITTEN_BREADCRUMBS = 25;

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
 * Files that write the nav but never tell assistive technology which crumb is the current
 * page. `aria-current` is checked as a bare token, not `aria-current="page"` specifically,
 * because any value (`"page"`, `"location"`, `"true"`) answers the accessibility gap this
 * counts; see the SCOPE note above for what a variable- or spread-applied `aria-current` still
 * misses.
 */
const ARIA_CURRENT = /aria-current/;

const BREADCRUMBS_WITHOUT_ARIA_CURRENT = 25;

function breadcrumbsWithoutAriaCurrent(): string[] {
  return breadcrumbNavFiles().filter((path) => !ARIA_CURRENT.test(sourceOf(path)));
}

describe("breadcrumbs mark the current page for assistive technology", () => {
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
 */
const BREADCRUMB_JSONLD_SYMBOL = "breadcrumbJsonLd";

const BREADCRUMBS_WITHOUT_JSONLD = 18;

function breadcrumbsWithoutJsonLd(): string[] {
  return breadcrumbNavFiles().filter((path) => !sourceOf(path).includes(BREADCRUMB_JSONLD_SYMBOL));
}

describe("visible breadcrumbs carry matching JSON-LD", () => {
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

  it("at least one real page already calls it — positive control against the live tree", () => {
    // Was `deniz/akdeniz/page.tsx` — Task 7 DELETED that page's own `breadcrumbJsonLd` call
    // (its nav and JSON-LD both moved into `V2SeaBasinDetailView`'s `Breadcrumbs` call, and a
    // second call here would have duplicated the schema), so it stopped being a member of
    // `breadcrumbNavFiles()` at all and can no longer serve as this control. `kiyi-tipleri` is
    // still a hand-written nav (Task 8's scope) that calls `breadcrumbJsonLd` itself.
    const withJsonLd = sourceOf(join(repoRoot, "app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx"));
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
