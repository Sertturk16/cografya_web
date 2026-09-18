import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageContainer } from "@/components/patterns/page-container";
import { stripComments } from "@/lib/test-support/strip-comments";
import {
  BREADCRUMB_OWNERS,
  FIXTURE_ROOT,
  importBindingsOf,
  label,
  pageRootFiles,
  repoRoot,
  resolvesTo,
  sourceOf,
  surfaceFiles,
  topLevelRenderNodes,
  walkPages,
  walkRenderRoots,
  withInjectedSource,
  type RenderTreeNode,
} from "@/lib/test-support/composition-scan";

/* -------------------------------------------------------------------------------------------
 * T-035 PR1 + PR2 — the page container and the breadcrumb trail. Five counters, pinned at what
 * the scanner found.
 *
 * T-045 split this file three ways along the families the describes already drew, and moved the
 * scanner itself to `lib/test-support/composition-scan.ts`. The walkers, `sourceOf`, `label`,
 * `surfaceFiles`, `pageRootFiles` and `BREADCRUMB_OWNERS` are imported from there; everything
 * below — the patterns, the exemption tables, the counters, their docblocks and their mutation
 * records — stays with the family that owns it. The heading counters are in
 * `components/v2/page-composition-headings.test.ts` and the card counters in
 * `components/v2/page-composition-cards.test.ts`.
 * ---------------------------------------------------------------------------------------- */

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

/* =============================================================================================
 * T-046 — THE COUNTER `PAGE_BODY_SPELLINGS` CANNOT BE
 * ========================================================================================== */

/**
 * `PAGE_BODY_SPELLINGS` counts body-wrapper SPELLINGS. A page with **no wrapper at all**
 * contributes no spelling, so it reads 0 and certifies the surface — which is exactly what
 * happened. T-032 (`d2039b6`) de-nested the `<main>` landmark into `(site)/layout.tsx` and deleted
 * five pages' `<main className="container mx-auto px-4 max-w-7xl py-10 space-y-12|14">` without
 * replacing the width, the padding or the rhythm. Their body content became a direct child of the
 * route fragment inside a `<main>` whose only rule is `flex: 1 0 auto`, so it rendered edge to
 * edge at viewport width with zero horizontal padding and zero space between sections, on ~96
 * routes, for four PRs, under a green counter.
 *
 * So this counter asks the question the spelling scan structurally cannot: **for every render
 * root, does each top-level node of what it returns sit inside a `PageContainer`?** An absent
 * wrapper is not a missing spelling here, it is a node in the offender list.
 *
 * WHAT IT IS BUILT NOT TO BE SATISFIED BY — each one something this programme has already been
 * bitten by, each with its own control below, and each stated as a claim about CODE THAT EXISTS
 * rather than about intent.
 *
 * RULING BM. The first version of this list had five items and TWO OF THEM WERE FALSE. The T-046
 * review defeated both on a real render root, each leaving the counter at 0 with the body
 * full-bleed, and the finding was not the two bugs but the asymmetry: the limits list below was
 * exemplary while the guarantees beside it overstated. Both are repaired in code, both attacks are
 * pinned as controls, and both repairs are mutation-recorded. A guard that overstates itself is
 * worse than one that understates, because a reader who checks the docblock stops looking.
 *
 *   1. **A container reached through a name the walk does not follow.** The tag is never compared
 *      as text. Every tag is resolved through {@link importBindingsOf} and {@link resolvesTo}, so
 *      `import { PageContainer as Shell }` and a barrel re-export both count, and a LOCAL
 *      component that merely happens to be called `PageContainer` does not. This is the door PR4
 *      found open on `StatTile` one component over from `StatGrid`.
 *   2. **A `PageContainer` that renders nothing because the body sits BESIDE it.** That is the
 *      defect itself: all five offenders already render `<PageContainer space="band">` inside
 *      their hero, so "container and body under one wrapper" is one refactor away from being
 *      written for real. WAS FALSE: the first version asked `subtree.some(isContainer)` over a
 *      flat tag list, which says "a container exists somewhere below" — true of
 *      `<div><PageContainer/><section>loose body</section></div>`. The defence stopped one level
 *      above the shape it named. {@link containmentOf} DESCENDS now: a node is contained when it is
 *      an unconditional container, or when every element child of it is contained, with a
 *      non-container leaf as the base case.
 *   3. **A dead reference — a container written but not rendered.** WAS FALSE: the first version
 *      answered this by pointing at the rendered-output pin in item 4, which proves something
 *      DIFFERENT — that the component still renders a box, not that this element is ever on the
 *      page. `{false && <PageContainer/>}` certified a full-bleed body. This is the FOURTH arrival
 *      in this programme at "a source token is not a rendered thing", after PR3's Ruling Z/AB,
 *      PR4 Task 4's `.map()` blind spot and PR4's Ruling BA, and the first where the docblock
 *      cited the earlier three three lines above reproducing them.
 *      {@link certifiesContainment} now refuses any container written inside a `{…}` expression,
 *      which covers `&&`, `?:` and a `.map()` callback in one rule.
 *   4. **A gutted `PageContainer`.** A separate guarantee from item 3, not the same one: this is
 *      about the component, that one is about the element. "Inside a `PageContainer`" only means
 *      anything while `PageContainer` renders a padded `max-w-7xl` box, so that is pinned as
 *      RENDERED OUTPUT below, as the whole class string in emission order — the `StatGrid` lesson,
 *      where `cn("grid", …)` assigned to an unused const satisfied two source pins while
 *      collapsing thirteen metric strips to one column.
 *   5. **A control anchored on markup a later task will legitimately change.** Every behavioural
 *      control runs against injected source at {@link FIXTURE_ROOT}, never against a real page —
 *      T-045's harness exists because PR3's controls were built on `giris/page.tsx` and the task
 *      contracted to give it an `<h1>` would have turned five of them red.
 *
 * WHERE IT IS DELIBERATELY WRONG, in the loud direction. `certifiesContainment` refuses a
 * container behind `{isTr && …}` although it renders on most requests, and {@link isOutOfFlow}
 * accepts only an unconditional `absolute`/`fixed`, not `sm:absolute`. Both cost a false RED that
 * names the file; the alternative costs a false GREEN over a full-bleed body, which is the defect
 * this counter exists for.
 *
 * WHAT IT STILL CANNOT SEE — the honest limits, none of them closed by this file:
 *
 *   - **Geometry. This is the limit, not depth.** Nothing here runs a browser. T-046's own two
 *     overflow defects were `climate.module.css`'s `min-width: 300px` and a `shrink-0` badge in a
 *     non-wrapping flex row: neither is in the JSX tree at ANY depth — one is in a stylesheet, the
 *     other an intrinsic-min-content consequence of two Tailwind classes meeting at one viewport —
 *     so walking deeper would have found neither, and a later task should not try. The division is
 *     that **this counter pins the SHAPE that produced the defect; a geometry sweep pins the
 *     CONSEQUENCE**, and neither substitutes for the other. The sweep that caught both
 *     (`scrollWidth === clientWidth` at 320/360/390) lives in `t046_shots/shoot.mjs` and is run by
 *     hand; promoting it to something that runs on its own is recorded as the open follow-up in
 *     `.superpowers/sdd/t-046-body-container-report.md`.
 *   - **Anything inside an out-of-flow branch.** {@link isOutOfFlow} stops the descent at an
 *     `absolute`/`fixed` element, so an absolutely positioned wrapper with real content under it
 *     takes that whole branch out of the walk. It exists because all five heroes write a
 *     decorative glow beside their container and without it the counter reports every hero —
 *     measured: neutering the rule reports exactly 5 nodes, every one of them a hero `<section>`
 *     flagged for its glow and nothing else. Walking through this door means putting the page body
 *     in a `position: absolute` element, which contributes no height and overlaps the hero and the
 *     footer, so it produces a louder defect than the one guarded. Such a node is
 *     `not-applicable`, not `contained` (Ruling BN), so it cannot certify the subtree it sits in.
 *   - **A body assembled in a helper.** `{renderBody()}` is a call expression, not an element:
 *     one top-level node, and whatever sections the helper writes are invisible. Moving a page's
 *     body into a same-file helper would take it out of this counter's reach without changing a
 *     pixel — see {@link topLevelRenderNodes}'s own SCOPE note.
 *   - **What the container is around.** It counts containment, not correctness: a body wrapped in
 *     `space="band"` (no page padding, `space-y-6`) passes exactly as `default` does. Ruling BK's
 *     rhythm choice is a review judgement, not something measured here.
 *   - **Layout that a stylesheet, not a wrapper, imposes.** A page whose body were widened by a
 *     CSS Module or a `@layer` rule would read as an offender though it renders correctly, and a
 *     `PageContainer` whose tokens were overridden by a later-layer rule would read as fine.
 *   - **`components/**` render roots.** {@link walkRenderRoots} visits `page.tsx`, `error.tsx` and
 *     `not-found.tsx` under `PAGE_ROOTS` only — the same scope limit `PAGE_BODY_SPELLINGS` has one
 *     walker over, and the reason `V2GameScreen` needs a named exemption below rather than being
 *     read directly.
 */
const PAGE_CONTAINER_MODULE = join(repoRoot, "components/patterns/page-container.tsx");

/** The tag's own name, with a member expression (`Foo.Bar`) reduced to the binding it starts at. */
const bindingNameOf = (tag: string) => tag.split(".")[0] ?? tag;

/** Does `tag`, as `file` binds it, resolve to `name` exported by `module`? */
function tagResolvesTo(file: string, tag: string, module: string, name: string): boolean {
  const binding = importBindingsOf(file).get(bindingNameOf(tag));
  return binding !== undefined && resolvesTo(binding, module, name);
}

/**
 * Top-level nodes that are not body content at all, named by the component they resolve to.
 *
 * Each row carries EVIDENCE — a pattern its module's source must still match — rather than only a
 * path, so an exemption cannot outlive its reason. `existsSync` alone would keep certifying
 * `V2GameScreen` as "owns its own width wrapper" long after that wrapper was deleted; the four
 * patterns below are the sentence each row is actually claiming.
 */
const OUTSIDE_THE_BODY: ReadonlyArray<readonly [string, string, RegExp, string]> = [
  [
    "JsonLd",
    "lib/seo/json-ld.tsx",
    /<script type="application\/ld\+json"/,
    "Renders a <script>; structured data has no box and no width.",
  ],
  [
    "V2LiveTicker",
    "components/v2/v2-live-ticker.tsx",
    /className="w-full border-b/,
    "Full-bleed telemetry bar. Site chrome above the reading body, edge-to-edge by design.",
  ],
  [
    "V2RegionThumbDefs",
    "components/v2/v2-region-thumb.tsx",
    /<svg className="hidden"/,
    "An <svg> defs sprite rendered `hidden`. No box.",
  ],
  [
    "V2GameScreen",
    "components/v2/v2-game-screen.tsx",
    /<main className="max-w-7xl mx-auto/,
    "The (play) fullscreen shell. It owns the width wrapper for all three game screens itself.",
  ],
];

/**
 * Per-file top-level nodes that are deliberately NOT inside the body container, with the exact
 * spelling fragment that keeps each row honest.
 *
 * The three sticky bars are DERIVED from {@link BODY_WRAPPER_EXEMPTIONS} rather than retyped, so
 * the two tables cannot name different files. Ruling BL: the body container opens AFTER the nav.
 * Wrapping a sticky section-index bar in a padded container changes what it sticks to and makes
 * that exemption's own stated reason ("they align to the body's edges and so still carry
 * max-w-7xl/mx-auto") false — the bar carries its own aligned row precisely because it is
 * full-bleed.
 */
const NOT_BODY_CONTENT: ReadonlyArray<readonly [string, string, string, string]> = [
  ...BODY_WRAPPER_EXEMPTIONS.map(
    ([file]) =>
      [
        file,
        "nav",
        "sticky top-",
        "Sticky section-index bar (Ruling BL). Full-bleed, with its own PageContainer-aligned row inside it; the body container opens after it.",
      ] as const,
  ),
  [
    "app/[locale]/(site)/error.tsx",
    "div",
    "max-w-2xl mx-auto px-4",
    "Last-resort message column, deliberately narrower than the reading body. PageContainer's width is closed at max-w-7xl and has no narrow member.",
  ],
  [
    "app/[locale]/(site)/not-found.tsx",
    "div",
    "max-w-2xl mx-auto px-4",
    "Same narrow message column as error.tsx, for the same reason.",
  ],
];

function isOutsideTheBody(file: string, node: RenderTreeNode): boolean {
  return OUTSIDE_THE_BODY.some(([name, module]) =>
    tagResolvesTo(file, node.tag, join(repoRoot, module), name),
  );
}

function isExemptNode(file: string, node: RenderTreeNode): boolean {
  return NOT_BODY_CONTENT.some(
    ([exemptFile, tag, evidence]) =>
      exemptFile === label(file) &&
      tag === node.tag &&
      (node.spelling ?? "").replace(/\s+/g, " ").includes(evidence),
  );
}

/**
 * Is this element THE `PageContainer`, and is it actually going to be there?
 *
 * `inExpression` is half of the predicate, not a detail. `{false && <PageContainer/>}`,
 * `{cond ? <A/> : <PageContainer/>}` and `{rows.map(() => <PageContainer/>)}` all put the tag in
 * the source and none of them puts a box on the page unconditionally. A counter that reads a tag
 * as PROOF must refuse every one of them; the T-046 review certified a full-bleed body with the
 * first, three lines under a docblock citing the three earlier arrivals at the same bug.
 *
 * It is deliberately CRUDE in the safe direction: a container behind `{isTr && …}` renders on most
 * requests and is still refused, because this scanner evaluates nothing and "sometimes" is not
 * containment. The cost is a false RED naming the file, which is loud; the alternative is a false
 * GREEN over a full-bleed body, which is the defect this whole counter exists for.
 */
function certifiesContainment(file: string, node: RenderTreeNode): boolean {
  return (
    !node.inExpression && tagResolvesTo(file, node.tag, PAGE_CONTAINER_MODULE, "PageContainer")
  );
}

/**
 * Out of the flow the body container governs, so not body content in it.
 *
 * Every one of the five heroes this task touched writes a decorative glow beside its
 * `<PageContainer space="band">`:
 *
 *     <div className="absolute -z-10 top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl
 *                     pointer-events-none" />
 *
 * That is a real container-with-a-sibling, and it is not the defect: an absolutely positioned box
 * is out of normal flow, so the width and padding a body container imposes were never going to
 * reach it. Without this the descent below reports all five heroes and the counter becomes noise,
 * which is how a counter gets weakened rather than fixed.
 *
 * UNCONDITIONAL TOKENS ONLY. A variant-scoped `sm:absolute` is static below `sm` — in flow at
 * exactly the widths this task's defect was worst — so it is NOT accepted here and such an element
 * reads as body content. Wrong in the loud direction, on purpose.
 *
 * This is also a real hole, named in the limits list: an `absolute` wrapper with genuine content
 * under it takes that whole branch out of the descent.
 */
function isOutOfFlow(node: RenderTreeNode): boolean {
  const tokens = (node.spelling ?? "").split(/\s+/);
  return tokens.includes("absolute") || tokens.includes("fixed");
}

/**
 * THREE STATES, because "not applicable" is not "contained" (Ruling BN, L2).
 *
 * A `<script>` and an absolutely positioned glow are not evidence that anything is inside a
 * container; they are evidence that the question does not arise. Collapsing them into `contained`
 * — which the first version of {@link containmentOf} did with a bare `return true` — let such a node
 * CERTIFY a subtree: `<div><div className="absolute"/></div>` read as contained on the strength of
 * a decorative child. No behavioural difference on today's tree, where all five uses are childless
 * glows, and that is exactly why it is worth separating now rather than the first time someone
 * nests something under one.
 */
type Containment = "contained" | "uncontained" | "not-applicable";

/**
 * DESCENT, not "does my subtree contain one".
 *
 * A node is contained when it IS an unconditional container, or when every element child of it is
 * contained and at least one of them answers the question at all. The recursion is what separates
 * the two shapes a flat `subtree.some(isContainer)` welds together:
 *
 *     <section class="hero"><PageContainer …>…</PageContainer></section>   contained ✓
 *     <div><PageContainer …>side</PageContainer><section>body</section></div>   NOT ✗
 *
 * Both have a container somewhere below; only the first has one around everything. The second is
 * "the defect itself, one level deeper" — the review's own words — and is one refactor away from
 * being written for real, because all five pages this task fixed already render a
 * `<PageContainer space="band">` inside their hero.
 *
 * A LEAF THAT IS NOT A CONTAINER IS NOT CONTAINED, and this is the line that stops the whole
 * recursion being vacuous rather than a refinement of it: `children.every(…)` is vacuously TRUE
 * over an empty list, so making a leaf "contained" does not merely rescue the childless
 * `<V2SourcesSection />` — it cascades, and every node whose descendants bottom out in leaves
 * (which is every node) reads as contained. Measured, not reasoned: see the mutation record on
 * {@link RENDER_ROOTS_WITH_UNCONTAINED_BODY}, where flipping it takes the counter to 0 of 5.
 *
 * AN ALL-NOT-APPLICABLE NODE IS UNCONTAINED, for the same reason one level up. A node whose only
 * element children are scripts and glows has answered nothing about its own in-flow content, and
 * the vacuous-truth trap is identical. Loud direction.
 */
function containmentOf(file: string, node: RenderTreeNode): Containment {
  if (certifiesContainment(file, node)) return "contained";
  if (isOutsideTheBody(file, node) || isOutOfFlow(node)) return "not-applicable";
  if (node.children.length === 0) return "uncontained";
  const children = node.children.map((child) => containmentOf(file, child));
  if (children.some((state) => state === "uncontained")) return "uncontained";
  return children.some((state) => state === "contained") ? "contained" : "uncontained";
}

/** Every top-level node of `file` that is body content sitting outside any `PageContainer`. */
function uncontainedNodesIn(file: string): string[] {
  return topLevelRenderNodes(file)
    .filter((node) => containmentOf(file, node) === "uncontained" && !isExemptNode(file, node))
    .map((node) => `<${node.tag}> ${node.spelling ?? "(no className attribute)"}`);
}

function rootsWithUncontainedBody(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walkRenderRoots()) {
    const loose = uncontainedNodesIn(file);
    if (loose.length > 0) found.set(label(file), loose);
  }
  return found;
}

/**
 * EXACT, and it is a number about RENDER ROOTS, not about nodes: a page is an offender once, no
 * matter how many of its sections are loose, because the fix is one container per page.
 *
 * Measured 2026-09-18 on `feature/t-046-body-container` at `67771af`, BEFORE any page was edited:
 * **5** — `turkiye/[slug]` (10 loose nodes), `turkiye/bolge/[slug]` (10), `turkiye/bolge` (6),
 * `dunya/[slug]` (5), `kitaplar/[slug]` (3), 34 loose nodes in all. Exactly the five the T-035
 * PR5/PR6 measurement named,
 * arrived at independently by this scan rather than read off that document — and `kitaplar/[slug]`,
 * the one the original plan text missed, is in the list on its own evidence.
 *
 * It was PINNED AT THE DEFECT first, on purpose: `20dd8d2` added this counter and changed no page,
 * so it landed GREEN at 5, which is the only state in which a counter can be shown to SEE the
 * thing it is for. T-046 then wrapped each of those five bodies in one `PageContainer`, opening
 * after the sticky nav on the three pages that have one (Ruling BL): 5 → **0**. All five took
 * `default` (Ruling BK); `turkiye/bolge` lost `space-y-14` and so is an exact restore, the other
 * four lost `space-y-12` and gain 8px they do not get a fifth union member for.
 *
 * MUTATION-CHECKED AT ZERO, which is the only value worth checking it at (`docs/conventions.md`:
 * a source-text assertion that has never failed has not been shown to work; and
 * `PAGE_BODY_SPELLINGS` records the cost of re-pinning 17 → 0 across three tasks with no
 * re-check). Removed the body `<PageContainer space="default">` wrapper from
 * `turkiye/bolge/page.tsx` again, leaving its six body nodes as direct fragment children exactly
 * as T-032 left them — RED, `expected 1 to be +0`, the message naming the file and all six loose
 * nodes (`<section> scroll-mt-28` ×4, `<div> flex items-center justify-between pt-2`,
 * `<div> scroll-mt-28`). Restored from a copy taken aside beforehand — GREEN. RE-RUN unchanged
 * after Ruling BM rewrote the predicate underneath it, because a mutation record made against a
 * different implementation proves nothing about this one.
 *
 * RULING BM (2026-09-18) rewrote `isContained` from a flat `subtree.some(isContainer)` to a
 * descent, and added `inExpression` to `certifiesContainment`. RULING BN then split "not
 * applicable" out of "contained" ({@link containmentOf}). **The before-measurement did not move
 * across either**: the five pages were restored from `20dd8d2` with the current predicate in place
 * and the counter read 5 — and not merely five FILES, the same 34 loose nodes, per file
 * `dunya/[slug]` 5, `kitaplar/[slug]` 3, `turkiye/[slug]` 10, `turkiye/bolge/[slug]` 10,
 * `turkiye/bolge` 6, matching this docblock's own original list node for node. So the stricter rule
 * is strictly better rather than differently scoped — it rejects shapes that were never on this
 * surface and accepts everything that was. Re-verified after Ruling BN, not carried over.
 *
 * FOUR MORE MUTATIONS, one per moving part, each reverted (counts against the 53 tests in this
 * file):
 *
 *   - `certifiesContainment` with `!node.inExpression` dropped — RED on "a DEAD container
 *     reference contains nothing" (its isolated `zz-dead-only` half) and on "a container in a
 *     TERNARY branch or a .map() callback", 2 failed / 51 passed;
 *   - `isContained` reverted to `certifiesContainment(n) || n.children.some(flat)`, the flat shape
 *     the review defeated — RED on "a container and a loose body as SIBLINGS INSIDE ONE NODE" and
 *     on the `sm:absolute` half of the out-of-flow control, 2 failed / 50 passed (run against the
 *     51-test file, before Ruling BN's control was added);
 *   - the `"not-applicable"` state collapsed back into `"contained"` — RED on "an out-of-flow node
 *     does not CERTIFY a subtree", 1 failed / 52 passed. The same single failure appears if the
 *     all-not-applicable branch returns `"contained"` instead of `"uncontained"`, which is the
 *     other half of that state being real;
 *   - the base case `children.length === 0` flipped to `"contained"`, run against the RESTORED
 *     pre-fix pages with the pin forced to `-1` — the counter reads **0** with an EMPTY offender
 *     list (`expected +0 to be -1`), not 5 minus something. 11 assertions red, 10 of them
 *     behavioural controls. Recorded here because the comment on that control previously said "3
 *     pages, not 5" from reasoning rather than measurement (Ruling BN, L1); the truth is that the
 *     base case is what stops the recursion being vacuous, so removing it takes the whole counter
 *     dark.
 *
 * Only the last of the four moves the whole-surface count, and only because it was deliberately run
 * against the pre-fix tree. The other three leave it at 0 — they are shapes this tree does not
 * contain today, and the controls are what keep them from arriving unnoticed.
 */
export const RENDER_ROOTS_WITH_UNCONTAINED_BODY = 0;

describe("every render root's body sits inside a PageContainer", () => {
  it("the count of roots with body content outside any container is exactly the recorded number", () => {
    const offenders = rootsWithUncontainedBody();
    expect(
      offenders.size,
      `render roots whose body content sits outside any PageContainer:\n${[...offenders]
        .map(([file, nodes]) => `  ${file}\n${nodes.map((n) => `      ${n}`).join("\n")}`)
        .join("\n")}`,
    ).toBe(RENDER_ROOTS_WITH_UNCONTAINED_BODY);
  });

  it("PageContainer still renders the box this counter is claiming — rendered, not grepped", () => {
    // The counter's whole meaning is "this node is inside a padded max-w-7xl box". A source scan
    // can only ever prove the TAG was written. `StatGrid` is the recorded case where that gap was
    // exploitable: `cn("grid", COLUMNS[columns])` assigned to an unused const satisfied both
    // source pins while the element rendered `flex flex-col`. So the claim is pinned where it is
    // actually made, on the rendered element, as the whole class string in emission order.
    // `children` travels in the props bag rather than as `createElement`'s third argument because
    // `PageContainerProps.children` is REQUIRED and the third-argument form leaves it missing from
    // the props type, failing `tsc` — the same constraint `patterns-contract.test.ts` hits on
    // `StatGrid`. Passing the bag as a variable also keeps `react/no-children-prop` (a rule about
    // JSX authoring; there is no JSX in this `.ts` file) from firing, so no disable is needed.
    const classOf = (props: Parameters<typeof PageContainer>[0]) => {
      const markup = renderToStaticMarkup(createElement(PageContainer, props));
      return /class="([^"]*)"/.exec(markup)?.[1] ?? "(no class attribute rendered)";
    };
    expect(classOf({ children: "x" })).toBe(
      "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-20 sm:pt-10 space-y-14",
    );
    expect(classOf({ space: "band", children: "x" })).toBe(
      "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6",
    );
  });

  it("the walk found every render root and read a tree out of each — positive control", () => {
    // Guards the silent-pass direction. `topLevelRenderNodes` returns [] for a file whose `default`
    // region it cannot locate, and [] reads downstream as "no uncontained node". A broken walk, a
    // renamed export or a `return` Prettier stopped indenting at two spaces would all read as a
    // clean surface rather than as a failure, which is this programme's own founding mistake.
    const roots = walkRenderRoots();
    expect(roots.length).toBe(39);
    const empty = roots.filter((file) => topLevelRenderNodes(file).length === 0).map(label);
    expect(
      empty,
      `render roots whose returned JSX could not be read:\n${empty.join("\n")}`,
    ).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------------------------
 * THE CONTROLS — all four shapes, on injected fixture source, never on a real page.
 * ------------------------------------------------------------------------------------------ */

const FIXTURE_IMPORT = 'import { PageContainer } from "@/components/patterns/page-container";\n';

const fixture = (body: string, head = FIXTURE_IMPORT) =>
  withInjectedSource(
    [[FIXTURE_ROOT, `${head}export default function Page() {\n  return (\n${body}\n  );\n}\n`]],
    () => uncontainedNodesIn(FIXTURE_ROOT),
  );

describe("the uncontained-body scan", () => {
  it("a body INSIDE the container is contained — negative control", () => {
    expect(
      fixture(
        '    <PageContainer>\n      <section className="grid">x</section>\n    </PageContainer>',
      ),
    ).toEqual([]);
  });

  it("a body BESIDE the container is not — the defect's own shape", () => {
    // The five offenders all render `<PageContainer space="band">` INSIDE their hero and then put
    // the body next to it. A file-level "does this page import/render PageContainer" check reads
    // every one of them as fine; only a per-node check sees the sibling.
    expect(
      fixture(
        '    <>\n      <section className="hero">\n        <PageContainer space="band">h</PageContainer>\n      </section>\n      <section className="grid grid-cols-12">body</section>\n    </>',
      ),
    ).toEqual(["<section> grid grid-cols-12"]);
  });

  /**
   * T-046 REVIEW, ATTACK A — reproduced verbatim from the reviewer's probe.
   *
   * This ran GREEN against the first version of this counter, with the body full-bleed, because
   * the predicate asked `node.subtree.some(isContainer)` over a FLAT tag list and a container
   * anywhere below certified the whole node — including the sibling it does not wrap. The shape
   * named in the docblock as "the defect itself" was reachable one level deeper than the defence
   * reached. `containmentOf` descends now; this must be RED, naming the loose sibling only.
   */
  it("a container and a loose body as SIBLINGS INSIDE ONE NODE is not contained — review attack A", () => {
    expect(
      fixture(
        '    <div className="zz-sibling">\n      <PageContainer space="default"><span>side</span></PageContainer>\n      <section className="zz-loose-body">uncontained body</section>\n    </div>',
      ),
    ).toEqual(["<div> zz-sibling"]);
  });

  /**
   * T-046 REVIEW, ATTACK B — reproduced verbatim. Also GREEN before, for a different reason: the
   * rendered-output pin three assertions up proves `PageContainer` THE COMPONENT still renders a
   * padded box, and says nothing about whether the `<PageContainer>` found in a page's tree is
   * ever rendered at all. `{false && …}` is the fourth arrival in this programme at "a source
   * token is not a rendered thing" — after PR3's Ruling Z/AB, PR4 Task 4's `.map()` blind spot and
   * PR4's Ruling BA — and the first where the docblock cited the earlier three while reproducing
   * them. `certifiesContainment` refuses any container written inside a `{…}` expression.
   */
  it("a DEAD container reference contains nothing — review attack B", () => {
    // The reviewer's probe, verbatim.
    expect(
      fixture(
        '    <section className="zz-dead-ref">\n      {false && <PageContainer space="default">never</PageContainer>}\n      <p>loose body</p>\n    </section>',
      ),
    ).toEqual(["<section> zz-dead-ref"]);
    // And the same shape with NOTHING else under the node, which is what isolates the rule being
    // tested: the probe above is now caught twice over — by `inExpression` AND by the `<p>` that
    // the descent finds uncontained — so on its own it would stay green if `inExpression` were
    // dropped. This one goes green the moment it is, and that is the mutation recorded below.
    expect(
      fixture(
        '    <section className="zz-dead-only">\n      {false && <PageContainer space="default">never</PageContainer>}\n    </section>',
      ),
    ).toEqual(["<section> zz-dead-only"]);
  });

  it("a container in a TERNARY branch or a .map() callback contains nothing either", () => {
    // The same rule, at the other two shapes the review named. Neither is evaluated — `cond` may
    // be true on every real request — because "sometimes" is not containment and this scanner
    // evaluates nothing.
    //
    // BOTH TERNARY BRANCHES ARE CONTAINERS (Ruling BN, L3). The first version wrote
    // `{cond ? <span>a</span> : <PageContainer>b</PageContainer>}`, which reds whatever
    // `inExpression` does — the `<span>` is a non-container leaf and the base case catches it — so
    // it stayed GREEN under the `inExpression` mutation and was not a control for the rule it is
    // filed under. That is the argument this file already applied to the reviewer's own probe,
    // pointed at its own control. With both branches containers, nothing but `inExpression` can
    // make this red.
    expect(
      fixture(
        '    <section className="zz-ternary">\n      {cond ? <PageContainer>a</PageContainer> : <PageContainer>b</PageContainer>}\n    </section>',
      ),
    ).toEqual(["<section> zz-ternary"]);
    expect(
      fixture(
        '    <section className="zz-mapped">\n      {rows.map((r) => (\n        <PageContainer key={r}>{r}</PageContainer>\n      ))}\n    </section>',
      ),
    ).toEqual(["<section> zz-mapped"]);
  });

  it("an out-of-flow decorative sibling does not make a hero uncontained — and a variant-scoped one does", () => {
    // All five heroes write an `absolute -z-10 … pointer-events-none` glow beside their
    // `space="band"` container. An absolutely positioned box is out of the flow a body container
    // governs, so it is not the sibling defect above; without this the descent reports every hero
    // and the counter becomes noise. `sm:absolute` is static below `sm` — in flow at exactly the
    // widths this task's defect was worst — so it is NOT accepted, in the loud direction.
    expect(
      fixture(
        '    <section className="hero">\n      <div className="absolute -z-10 size-96 blur-3xl" />\n      <PageContainer space="band">h</PageContainer>\n    </section>',
      ),
    ).toEqual([]);
    expect(
      fixture(
        '    <section className="hero">\n      <div className="sm:absolute -z-10 size-96 blur-3xl" />\n      <PageContainer space="band">h</PageContainer>\n    </section>',
      ),
    ).toEqual(["<section> hero"]);
  });

  it("an out-of-flow node does not CERTIFY a subtree — the third state, not `contained`", () => {
    // Ruling BN, L2. `isOutOfFlow` used to `return true` ("contained"), so a node whose only
    // element child was a decorative glow read as contained on the strength of that glow. It is
    // `not-applicable` now, and a node with nothing but not-applicable children has answered
    // nothing about its own in-flow content, so it stays in the offender list. No behavioural
    // difference on today's tree — every real use is a childless glow — which is why it is worth
    // pinning before the first time someone nests something under one.
    expect(
      fixture(
        '    <div className="zz-glow-only">\n      <div className="absolute inset-0" />\n    </div>',
      ),
    ).toEqual(["<div> zz-glow-only"]);
  });

  it("a childless top-level component is not contained by having no children — base case", () => {
    // `children.every(…)` over an empty list is vacuously true, so without an explicit base case
    // a leaf is "contained" — and that does not merely rescue the childless `<V2SourcesSection />`
    // and `<MarineDataNotice />`, it CASCADES: every node whose descendants bottom out in leaves,
    // which is every node, reads as contained too.
    //
    // RULING BN, L1. This comment used to say "the counter would have measured 3 pages, not 5",
    // reasoning about the two named components rather than measuring. Re-measured against the
    // restored `20dd8d2` pages with the pin forced to `-1` so the count printed: **0**, with an
    // EMPTY offender list (`expected +0 to be -1`). The base case is not a refinement of the
    // recursion, it is the thing that stops the recursion being vacuous — flip it and the whole
    // counter goes dark rather than losing two pages. Caught loudly: 11 assertions red, 10 of them
    // behavioural controls including this one.
    expect(fixture("    <V2SourcesSection />")).toEqual([
      "<V2SourcesSection> (no className attribute)",
    ]);
  });

  it("an ALIASED import still counts — the binding resolver is doing the work", () => {
    expect(
      fixture(
        "    <Shell>\n      <section>x</section>\n    </Shell>",
        'import { PageContainer as Shell } from "@/components/patterns/page-container";\n',
      ),
    ).toEqual([]);
  });

  it("a LOCAL component merely named PageContainer does not count — positive control", () => {
    // The tag is never compared as text. With no import binding it to the real module, this is an
    // unrelated local wrapper of unknown width, and the node stays in the offender list.
    expect(
      fixture("    <PageContainer>\n      <section>x</section>\n    </PageContainer>", ""),
    ).toEqual(["<PageContainer> (no className attribute)"]);
  });

  it("an import of a DIFFERENT module's PageContainer does not count — positive control", () => {
    expect(
      fixture(
        "    <PageContainer>\n      <section>x</section>\n    </PageContainer>",
        'import { PageContainer } from "@/components/patterns/page-hero";\n',
      ),
    ).toEqual(["<PageContainer> (no className attribute)"]);
  });

  it("a container handed to a node as a PROP does not contain it", () => {
    // `subtree` follows children only. A container passed in an attribute expression is a sibling
    // panel the node renders somewhere of its own choosing, not a wrapper around its body.
    expect(
      fixture('    <section className="body" panel={<PageContainer>p</PageContainer>}>x</section>'),
    ).toEqual(["<section> body"]);
  });

  it("a commented-out container does not contain anything — comment stripping applied", () => {
    expect(
      fixture('    <section className="body">{/* <PageContainer>x</PageContainer> */}y</section>'),
    ).toEqual(["<section> body"]);
  });

  it("a `return` inside a callback is not a render tree — the column-2 rule", () => {
    // Without the indent rule every `.map(… => { return <li/> })` in the tree would enter the
    // count as a top-level node, and every table row on the surface would read as uncontained.
    expect(
      withInjectedSource(
        [
          [
            FIXTURE_ROOT,
            `${FIXTURE_IMPORT}export default function Page() {\n  return (\n    <PageContainer>\n      {rows.map((r) => {\n        return <li className="row">{r}</li>;\n      })}\n    </PageContainer>\n  );\n}\n`,
          ],
        ],
        () => uncontainedNodesIn(FIXTURE_ROOT),
      ),
    ).toEqual([]);
  });
});

describe("the uncontained-body exemptions", () => {
  it.each(OUTSIDE_THE_BODY)(
    "%s is still what the exemption says it is",
    (_name, module, evidence) => {
      const path = join(repoRoot, module);
      expect(existsSync(path), `${module} no longer exists; drop the exemption`).toBe(true);
      expect(
        evidence.test(sourceOf(path)),
        `${module} no longer matches ${evidence}; the exemption's reason is now false`,
      ).toBe(true);
    },
  );

  it.each(NOT_BODY_CONTENT)("%s's <%s> is still a live top-level node", (file, tag, evidence) => {
    const nodes = topLevelRenderNodes(join(repoRoot, file));
    const match = nodes.some(
      (node) => node.tag === tag && (node.spelling ?? "").replace(/\s+/g, " ").includes(evidence),
    );
    expect(
      match,
      `${file}: no top-level <${tag}> carrying "${evidence}" any more; drop or restate the exemption`,
    ).toBe(true);
  });

  it("every exempted file is one the walk actually visits", () => {
    // A row naming a path outside `walkRenderRoots()` would sit there forever exempting nothing.
    const visited = new Set(walkRenderRoots().map(label));
    for (const [file] of NOT_BODY_CONTENT)
      expect(visited, `${file} is not a render root`).toContain(file);
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
