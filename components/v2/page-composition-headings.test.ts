import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { resolveSpecifier, runtimeImportsOf } from "@/lib/test-support/import-closure";
import {
  COMPUTED_CLASSNAME,
  FIXTURE_ROOT,
  HOLE_MARKER,
  NO_CLASSNAME,
  type RenderNode,
  classNameOfTag,
  classNamesOf,
  declarationRegions,
  graphCache,
  importBindingsOf,
  isRenderRootPath,
  label,
  maskLiterals,
  maskedSource,
  nodeKey,
  perFileCache,
  readSource,
  reexportTargetsOf,
  repoRoot,
  resetScannerCaches,
  sourceOf,
  surfaceFiles,
  tagTextAt,
  walk,
  walkPages,
  walkRenderRoots,
  withInjectedSource,
} from "@/lib/test-support/composition-scan";

/* -------------------------------------------------------------------------------------------
 * T-035 PR3 — the page heading. Three counters, pinned at what the scanner found.
 *
 * T-045 split the original `page-composition.test.ts` three ways and moved the scanner itself to
 * `lib/test-support/composition-scan.ts`. What is imported from there: the walkers, `sourceOf` /
 * `readSource`, the injection harness (`withInjectedSource`, `FIXTURE_ROOT`, and the cache
 * factories this file registers its own three memos through), the ONE literal extractor behind
 * `classNameOfTag`, and the binding resolver (`importBindingsOf`, `declarationRegions`,
 * `reexportTargetsOf`). What stays here: the render graph, the tier switch, the counters, their
 * docblocks, their mutation records and their exemption tables. The container and breadcrumb
 * counters are in `components/v2/page-composition-containers.test.ts`, the card and stat-grid
 * counters in `components/v2/page-composition-cards.test.ts`.
 *
 * THE MERGE THAT CAME WITH THE SPLIT. PR3 and PR4 shipped two extractors; PR4's cross-scanner
 * guard measured them disagreeing about 22 `<div>`s, with PR3's side MANGLING every template hole
 * it read. T-045 adopted PR4's `${…}` marker and DELETED PR3's hole handling rather than porting
 * it. No counter in this file moved: 0 of the 13 `H1_SPELLINGS` rows contains a hole, which "no h1
 * spelling is partly uncountable" at the bottom of this file still asserts. The three manglings
 * are pinned as executable evidence in `lib/test-support/composition-scan.test.ts`.
 * ---------------------------------------------------------------------------------------- */

/*
 * EVIDENCE LIVES HERE, NOT IN A `task-*.md`. The mutation checks below state what was mutated, what
 * the assertion printed, and that reverting went green — inline. The task reports those checks were
 * originally run in live under `.superpowers/sdd/`, whose `.gitignore` is `*`, so `git ls-files`
 * returns nothing for them: on a fresh clone every such citation resolves to no file at all. That
 * is the `ENGINEERING.md §N` pattern the workspace `CLAUDE.md` tells us not to recreate, and it is
 * worse here than there, because these citations were the evidence for the branch's headline
 * numbers rather than background rationale.
 */

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
 * `lib/test-support/import-closure.ts`, shared with `components/orphan.test.ts` and
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
/**
 * `RenderNode` — a file plus the name of one declaration inside it, `null` for the whole file — is
 * declared in `lib/test-support/composition-scan.ts` beside the binding resolver that produces it.
 */

/** The heading walk's own caches, registered with the injection harness by the factory that
 * builds them — see `perFileCache` / `graphCache` in `lib/test-support/composition-scan.ts`. A
 * cache built any other way is invisible to `withInjectedSource` and is failed by
 * `lib/test-support/composition-scan.test.ts`. */
const h1Cache = perFileCache<readonly H1Occurrence[]>();

/**
 * `h1SitesOf(root)` memo. Unlike a per-file cache this one depends on the WHOLE graph, so it is
 * dropped in full whenever a source override changes anything. Without it the three counters each
 * re-walk all 39 roots, and the whole-surface control below does nine full walks.
 */
const sitesCache = graphCache<H1Site[]>();

/** The module-scope fallbacks seen during one walk. An accumulator, not a per-file memo, so it is
 * reset in full alongside the graph memos above. */
const fallbacksSeen = graphCache<string>();

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
 * How one node reached another. `jsx` is a component NAME written as an element in the parent's
 * span — a render. `forward` is the walk chasing a bare `export default X` or an
 * `export { X } from "…"` re-export, which renders nothing itself and merely relays.
 *
 * The distinction exists for {@link tierPrimitiveWriters}: the file that WRITES `<H1>` is the one
 * at the tail of a `jsx` edge, and any `forward` edges after it are plumbing, not a second render.
 */
type RenderEdge = (from: RenderNode, to: RenderNode, kind: "jsx" | "forward") => void;

/**
 * Every `<h1>` element a render root actually RENDERS, found by walking the render graph described
 * above. The `key` is `file#ordinal`, so one element reached from four pages stays one element.
 *
 * `onEdge` reports every edge the walk traverses, at the moment it traverses it. It exists so that
 * a caller needing PROVENANCE — which file rendered a given element — reads the walk's own
 * resolution instead of re-deriving it. A parallel resolver is exactly what review found wrong in
 * the first Ruling Z fix: it was weaker than this walk (no `as` aliases, no re-exports), and a
 * resolver weaker than the walk it explains hides the cases the walk can see.
 */
function h1SitesOf(
  root: string,
  onVisit?: (node: RenderNode) => void,
  onEdge?: RenderEdge,
): H1Site[] {
  // The memo is bypassed when a caller wants the traversal itself (`renderNodesVisited`) or its
  // edges (`tierPrimitiveWriters`) — neither is reconstructible from the returned site list.
  const memo = onVisit || onEdge ? undefined : sitesCache.get(root);
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
    const visitKey = nodeKey(node);
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    onVisit?.(node);

    const span = nodeSpan(node);
    if (span.kind === "forward") {
      for (const next of span.nodes) {
        onEdge?.(node, next, "forward");
        queue.push(next);
      }
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
      // `importBindingsOf` has already folded `as` aliases away, so `<Heading>` from
      // `import { H1 as Heading }` resolves to `{ typography.tsx, H1 }` here — the reason
      // provenance has to be read off THIS edge rather than off the tag's spelling.
      if (imported) {
        onEdge?.(node, imported, "jsx");
        queue.push(imported);
      } else if (locals.has(tag)) {
        const local = { file: node.file, name: tag };
        onEdge?.(node, local, "jsx");
        queue.push(local);
      }
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
        if (target !== null) {
          const lazy = { file: target, name: "default" };
          // A `jsx` edge: `<Heavy/>` IS the render, the `dynamic()` call only names the module.
          onEdge?.(node, lazy, "jsx");
          queue.push(lazy);
        }
      }
    }
  }

  const result = [...sites.values()];
  if (!onVisit && !onEdge) sitesCache.set(root, result);
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
 * THE TIER SWITCH — ONE component-level ambiguity, recorded once instead of on 22 render roots.
 *
 * `components/patterns/page-hero.tsx` picks its heading with
 * `tier === "hub" ? <H1>…</H1> : <H1Display>…</H1Display>`. Both names are written as JSX, so the
 * walk reaches BOTH `<h1>` elements in `typography.tsx`; it cannot evaluate `tier` (SCOPE note 4),
 * so every page adopting `PageHero` reads as reaching two headings while rendering exactly one.
 *
 * WHY THE TERNARY IS WRITTEN OUT RATHER THAN HIDDEN. The component shipped as
 * `const Heading = tier === "hub" ? H1 : H1Display;` + `<Heading>`, which is invisible to this
 * walk — `Heading` is neither an import binding nor a top-level declaration — and measured
 * `PAGES_WITHOUT_H1` UP, 5 → 6, on the first page converted, with the heading rendering perfectly
 * well in a browser. That direction is the one this programme cannot afford in reverse: MEASURED,
 * 22 render roots read "no h1" while shipping one under the alias form. Naming both components makes the heading countable,
 * and trades an under-count the walk cannot see for an OVER-count it can, which is then resolved
 * here, in the open.
 *
 * NOT A PER-PAGE EXEMPTION. `MULTIPLE_H1_EXEMPTIONS` below names a FILE whose own two branches are
 * mutually exclusive; listing 17 files here would make the counter mean nothing and would grow by
 * one line per page adopted. This names the MECHANISM: the two alternatives are always the same two
 * elements, and the check below proves that `page-hero.tsx` is the only file on the scanned surface
 * that renders `<H1` and `<H1Display` together — so "a root reaching both tiers reaches them
 * through this switch" is measured, not assumed. A root reaching the two tiers PLUS any third
 * `<h1>` still reports as an offender, which is the property the collapse must not destroy.
 *
 * ## THE COLLAPSE IS KEYED ON THE PATH, NOT ON THE TWO KEYS BEING PRESENT (Ruling Z)
 *
 * The first version of {@link effectiveH1Sites} fired whenever both tier keys were in a root's site
 * set, and review proved that narrows the counter. `h1SitesOf` keys by `file#ordinal`, so a SECOND
 * render of an element already in the set adds no key: a page that renders `PageHero` (contributing
 * both keys) and ALSO renders `<H1>` or `<H1Display>` directly still holds exactly `{#0, #1}`, the
 * collapse fired, and the counter read ONE heading for a page that ships TWO. Demonstrated on
 * `turkiye/page.tsx` with either primitive — 66/66 green both ways — and that same shape WAS
 * reported as an offender before the collapse existed, so it was a regression in coverage rather
 * than an inherited limit.
 *
 * Narrow, but narrow in the wrong direction. `/hakkimizda` is the one live page that renders `<H1>`
 * directly (`hakkimizda/page.tsx:99`) and is the obvious next adoption; the day it gains a
 * `PageHero` without dropping its `<H1>` it would have shipped two headings with every counter
 * green — the exact failure mode this programme exists to end, arriving through the mechanism built
 * to prevent it.
 *
 * So the collapse now requires that `page-hero.tsx` is the ONLY node in the root's closure that
 * writes a tier primitive as JSX ({@link tierPrimitiveWriters}). A tier element reached by any
 * other path keeps its own site and still counts. The two directions are pinned by tests below:
 * `PageHero` + a direct `<H1>` on the same page is an OFFENDER, and an ordinary `PageHero` page is
 * still silent.
 *
 * The runtime half is asserted where it can actually be rendered:
 * `components/patterns/page-hero.test.tsx` renders both tiers and pins `<h1>` at exactly one each.
 */
const TIER_SWITCH = {
  component: "components/patterns/page-hero.tsx",
  guard: 'tier === "hub" ? <H1>{heading}</H1> : <H1Display>{heading}</H1Display>',
  /** `H1` and `H1Display`, in `typography.tsx` source order — checked, see the tests below. */
  sites: ["components/patterns/typography.tsx#0", "components/patterns/typography.tsx#1"],
  /** The module the two tier primitives are declared in. */
  tierModule: "components/patterns/typography.tsx",
  /** The exported names of the two tiers, in that module's source order. */
  tierNames: ["H1", "H1Display"],
  why: "PageHero's `tier` prop selects one of the two heading tiers; the walk cannot evaluate it and reaches both.",
} as const;

/**
 * THE SPLIT, PINNED — how many render roots reach two `<h1>` sites, and which mechanism accounts
 * for each. Measured 2026-09-18 over `walkRenderRoots()`.
 *
 * These exist because `PAGES_WITH_MULTIPLE_H1 = 0` is a number AFTER two reconciliations, and until
 * now nothing observed the number BEFORE them. That is the same defect the reconciliation itself was
 * written to correct, one level up: SCOPE note 4 and `PAGES_WITH_MULTIPLE_H1`'s docblock were both
 * rewritten from "`/profil` is the only root reaching two" to the measured 23/22/1 — and left as
 * PROSE THAT NO TEST OBSERVED. Adopting `PageHero` on a page that has no heading (the `giris` /
 * `kayit` shape this branch shipped twice) moves the raw count and nothing else: `H1_ELEMENTS` does
 * not move, because both tier elements are already in the set; `PAGES_WITHOUT_H1` does not move once
 * it is 0; `PAGES_WITH_MULTIPLE_H1` does not move, because the collapse correctly fires. The
 * paragraph correcting the false number would have gone stale inside itself.
 *
 * `RECONCILED_BY_TIER_SWITCH + RECONCILED_BY_EXEMPTION === REACHING_TWO` is asserted too, so the
 * three cannot be re-pinned independently into a set that does not add up.
 */
// 23 until T-061 deleted `/profil` — the one root that reached two DIFFERENT headings.
const ROOTS_REACHING_TWO_H1 = 22;
/** Roots reaching both TIER elements through `PageHero`'s one unevaluable `tier` switch. */
const ROOTS_RECONCILED_BY_TIER_SWITCH = 22;
/**
 * Roots reaching two DIFFERENT headings on branches the walk cannot evaluate —
 * `MULTIPLE_H1_EXEMPTIONS`. **0 since T-061**: its one member, `/profil`, is gone, and the page
 * that replaced it puts its single `<h1>` outside both of its branches on purpose.
 */
const ROOTS_RECONCILED_BY_EXEMPTION = 0;

/**
 * `tierPrimitiveWriters(root)` memo. Keyed by root and dropped wherever {@link sitesCache} is,
 * because it is a function of the whole graph rather than of one file.
 */
const tierWriterCache = graphCache<string[]>();

/**
 * Every file in `root`'s render closure that RENDERS one of the two tier primitives.
 *
 * This is the provenance {@link effectiveH1Sites} needs and that a set of site KEYS cannot carry:
 * two different renders of the same element are one key but two writers. A page reaching the tiers
 * only through `PageHero` yields exactly `["components/patterns/page-hero.tsx"]`.
 *
 * ## READ OFF THE WALK'S OWN EDGES, NOT RE-DERIVED (Ruling AB)
 *
 * The first version compared the JSX TAG'S SPELLING to `TIER_SWITCH.tierNames` and used
 * `importBindingsOf` only to reject a local shadow. That is strictly weaker than the walk it
 * exists to explain, and review reproduced the gap twice on the real tree with the whole suite
 * green — a page rendering `PageHero` plus either
 *
 *   - `import { H1 as Heading }` + `<Heading>`, or
 *   - `import { H1 }` from a module that re-exports `./typography`,
 *
 * yielded `writers = ["page-hero.tsx"]`, so the collapse fired and a page shipping TWO `<h1>` read
 * as one. The walk resolves both of those correctly — `importBindingsOf` folds `as` aliases away
 * (so the tag may be spelled anything) and `nodeSpan` chases re-exports through
 * `reexportTargetsOf`. Comparing spellings could never see either.
 *
 * Both failures are one edit from live. `/hakkimizda` is named below as the obvious next adoption,
 * and an alias is the NATURAL way to write that import once `PageHero` is also imported; and
 * `reexportTargetsOf` is deliberately kept alive against the day a heading component is
 * barrel-exported — on that day a spelling comparison is the mechanism that hides it.
 *
 * So provenance is now read from {@link h1SitesOf}'s own `onEdge` stream. A file is a tier writer
 * when it sits at the tail of a `jsx` edge whose head reaches a tier declaration through zero or
 * more `forward` edges. `forward` edges are excluded from the tail because a re-export barrel
 * relays a component, it does not render one. By construction this cannot drift from the walk: it
 * IS the walk's resolution, not a copy of it.
 *
 * Still correctly EXCLUDED, all three verified — and the list is three, not two, because a list
 * that sounds exhaustive and is not is the same defect as a docblock overstating a guarantee:
 *
 *   1. a local `function H1()` in the page. It resolves to that page's OWN declaration, not to
 *      `typography.tsx`, so it is not a tier writer — and its own `<h1>` is a third site that keeps
 *      the page an offender anyway. Pinned by its own test below.
 *   2. a component that legitimately renders BOTH tiers. It is recorded as a second writer, so the
 *      collapse does not fire. Pinned by check 3.
 *   3. `import * as T from "…/typography"` + `<T.H1>` beside a `PageHero`. This one IS outside the
 *      writer list — `JSX_ELEMENT` yields the namespace `T`, which binds to the whole module rather
 *      than to a tier declaration — so `writers` reads `["page-hero.tsx"]` and the collapse fires.
 *      NOT SILENT, which is why it is an exclusion rather than a hole: `nodeSpan` cannot isolate a
 *      declaration in a namespace binding, so the same resolution records
 *      `components/patterns/typography.tsx — *` in `fallbacksSeen`, and
 *      {@link MODULE_SCOPE_FALLBACKS} is pinned exact-EMPTY. The suite goes red naming the file
 *      before this collapse is ever consulted. Closed by a different mechanism, on purpose:
 *      namespace-importing a component module is the thing to stop, not a case to special-case here.
 */
function tierPrimitiveWriters(root: string): string[] {
  const hit = tierWriterCache.get(root);
  if (hit) return hit;

  const tierModulePath = join(repoRoot, TIER_SWITCH.tierModule);
  const isTier = (node: RenderNode) =>
    node.file === tierModulePath &&
    node.name !== null &&
    (TIER_SWITCH.tierNames as readonly string[]).includes(node.name);

  const jsxEdges: Array<{ fromFile: string; toKey: string; toIsTier: boolean }> = [];
  /** `forward` edges, head-key → tail-keys, so a relay chain can be walked backwards. */
  const forwardedBy = new Map<string, string[]>();
  const tierKeys = new Set<string>();

  h1SitesOf(root, undefined, (from, to, kind) => {
    const toKey = nodeKey(to);
    if (isTier(to)) tierKeys.add(toKey);
    if (kind === "jsx") jsxEdges.push({ fromFile: label(from.file), toKey, toIsTier: isTier(to) });
    else forwardedBy.set(toKey, [...(forwardedBy.get(toKey) ?? []), nodeKey(from)]);
  });

  // Every node key that RELAYS to a tier declaration: the tier nodes themselves, plus anything
  // that forwards (transitively) to one. A `jsx` edge landing on any of these is a real render.
  const relaysToTier = new Set(tierKeys);
  const pending = [...tierKeys];
  while (pending.length > 0) {
    const key = pending.shift()!;
    for (const tail of forwardedBy.get(key) ?? []) {
      if (relaysToTier.has(tail)) continue;
      relaysToTier.add(tail);
      pending.push(tail);
    }
  }

  const writers = new Set<string>();
  for (const edge of jsxEdges) {
    if (edge.toIsTier || relaysToTier.has(edge.toKey)) writers.add(edge.fromFile);
  }

  const result = [...writers].sort();
  tierWriterCache.set(root, result);
  return result;
}

/**
 * A root's `<h1>` sites with the tier switch's two alternatives collapsed to the ONE it renders.
 *
 * Used ONLY by `pagesWithMultipleH1()`. `H1_ELEMENTS` deliberately keeps both: each tier really is
 * rendered by some page on the surface, so dropping one from the whole-surface element count would
 * hide a real element rather than a counting artefact.
 */
function effectiveH1Sites(root: string): H1Site[] {
  const sites = h1SitesOf(root);
  const present = TIER_SWITCH.sites.filter((key) => sites.some((site) => site.key === key));
  if (present.length < TIER_SWITCH.sites.length) return sites;
  // BOTH tiers are reachable. Collapse ONLY if `PageHero`'s one `tier` switch is the whole reason —
  // see Ruling Z in the docblock above. Anything else rendering a tier primitive means the page
  // really does reach a heading by a second path, and that path keeps its site.
  const writers = tierPrimitiveWriters(root);
  if (writers.length !== 1 || writers[0] !== TIER_SWITCH.component) return sites;
  return sites.filter((site) => site.key !== TIER_SWITCH.sites[1]);
}

/**
 * Render roots that reach more than one `<h1>` and are NOT exempt, in the same named-with-a-reason
 * shape `BODY_WRAPPER_EXEMPTIONS` uses in `components/v2/page-composition-containers.test.ts` for
 * the three sticky nav bars: path, the two source conditions that make it legitimate, and a
 * liveness assertion so the exemption cannot outlive its reason.
 *
 * **EMPTY since T-061, and the way it emptied is the point.** Its one member was
 * `app/[locale]/(site)/profil/page.tsx`, which reached two `<h1>` elements on mutually exclusive
 * `accountRole` branches — the page's own for a TEACHER, `V2ProfileForm`'s for a STUDENT. T-061
 * deleted both: the page is now a `next.config.ts` redirect to `/hesabim/ayarlar` and the form
 * component is gone. The liveness check below went red naming the missing guards the moment the
 * file disappeared, which is exactly what "the exemption cannot outlive its reason" was written
 * to do, and the exemption was dropped rather than rewritten.
 *
 * What replaced it carries one `<h1>` outright: `/hesabim/ayarlar` has a single page heading and
 * four `<h2>` section headings, for a teacher and a student alike. There is no longer a page on
 * the surface whose heading count depends on a condition the scanner cannot evaluate.
 */
const MULTIPLE_H1_EXEMPTIONS: ReadonlyArray<{
  readonly file: string;
  readonly guards: readonly [string, string];
  readonly why: string;
}> = [];

/** `page — n: file, file` for each non-exempt render root whose closure holds >1 `<h1>`. */
function pagesWithMultipleH1(): string[] {
  const exempt = new Set(MULTIPLE_H1_EXEMPTIONS.map((exemption) => exemption.file));
  return walkRenderRoots()
    .map((page) => ({ page, sites: effectiveH1Sites(page) }))
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
 *      as a prop would land here. None of the 17 elements found today is of this shape — every one
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
 *      `PAGES_WITH_MULTIPLE_H1` is where that bites — HARD. **23 of the 39 render roots reach two
 *      `<h1>` sites** on today's tree. Not one: 23. A page that genuinely ships two headings and a
 *      page that merely holds two branches look identical from here, so every one of those 23 is
 *      reconciled by a named mechanism rather than by the counter, and there are TWO of them:
 *
 *        · 22 roots reach BOTH heading tiers because they render `PageHero`, whose
 *          `tier === "hub" ? <H1> : <H1Display>` the walk cannot evaluate. Reconciled by
 *          {@link TIER_SWITCH} / {@link effectiveH1Sites} — see that block for the mechanism, its
 *          six checks, and the provenance keying that stops it collapsing a page which reaches a
 *          tier by a SECOND path. This is by far the largest reachability-vs-render gap on the
 *          surface and it governs 56% of the roots; a reader who takes
 *          `PAGES_WITH_MULTIPLE_H1 = 0` to rest on one named exemption has the wrong picture.
 *        · 1 root, `/profil`, reaches two DIFFERENT headings on mutually exclusive `accountRole`
 *          branches (`=== "TEACHER"` vs `=== "STUDENT"`, both verified in the source — see
 *          `MULTIPLE_H1_EXEMPTIONS` above for the line-by-line reading). Reconciled by that named
 *          exemption with its own liveness check.
 *
 *      WHAT EACH WOULD HIDE IF IT WERE WRONG. The exemption would hide exactly one page shipping
 *      two headings. The collapse would hide one heading on any of the 22 — and, before the
 *      provenance keying, did exactly that for a page that rendered `PageHero` plus a tier
 *      primitive of its own. That is the failure this file exists to prevent, arriving through the
 *      mechanism built to prevent it, which is why the collapse carries six checks and four
 *      injected second-render shapes rather than a docblock. Any root reaching two that neither
 *      mechanism accounts for still goes red.
 *
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
 *      "Has exactly one `h1`" is not "has a correct heading outline". For the three `(play)`
 *      screens the level half of that question is answered at the bottom of this file ("the
 *      (play) outline steps one level at a time"); for the reading surface it is not.
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
 * EXACT, not a ceiling — the same doctrine `PAGE_BODY_SPELLINGS` records in
 * `components/v2/page-composition-containers.test.ts`, and for the same
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
 * reverted, GREEN.
 *
 * TASK 3 (2026-09-18) moved the 14 hub heroes onto `PageHero tier="hub"`, deleting all 14 of their
 * literal `<h1>`s: 13 → **12**. The spelling they carried
 * (`font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight`) is the
 * one that left; it is REPLACED by `H1`'s, which differs by 0.4px below `sm` (`text-[1.9rem]` vs
 * `text-3xl`) and is identical everywhere else — the 1.9rem floor `typography.tsx` records, kept in
 * the one place it is sub-perceptual. That spelling was already counted, from `/hakkimizda`, so the
 * distribution changed from "one spelling covering 14 elements" to "one spelling covering the ONE
 * element those 14 pages share". The three DETAIL heroes moved in the same task and cost this
 * counter nothing: `H1Display`'s spelling is byte-identical to the one they wrote.
 *
 * Then 12 → **13**, because the same task gave the three `(play)/oyun/*` screens the heading they
 * never had, and `sr-only` is a thirteenth spelling.
 *
 * THE NUMBER DID NOT FALL, AND THE ACCOUNTING IS −1 / +1. Exactly one row LEFT — the 14× hub page
 * literal, whose spelling no element carries any more — and exactly one ARRIVED,
 * `v2-game-screen.tsx`'s `sr-only`. The other two moves cost this counter nothing and are the
 * reason it is easy to miscount: `typography.tsx#0` was ALREADY in the map, from `/hakkimizda`, so
 * the hub tier did not arrive; and the detail literal never LEFT the map, because `H1Display`'s
 * spelling is byte-identical to the one the three detail pages wrote, so that row only changed
 * owner from three page elements to one `typography.tsx#1` element. 13 − 1 + 1 = 13.
 *
 * A fix round briefly rewrote this as −2 / +2 on review feedback; a later review checked the three
 * detail pages at `a2b3d61` against `typography.tsx`'s `H1Display` byte for byte and showed −1 / +1
 * was right, and that −2 / +2 contradicted the paragraph six lines above. Recorded so the same
 * correction is not made a third time. What actually moved is {@link H1_ELEMENTS}, 32 → 17, which is
 * why the two are pinned separately.
 *
 * ## THE THIRTEEN, EACH ONE NAMED
 *
 * TWO TIERS — the ruled end state, this counter's floor, never 1:
 *   1. `…text-[1.9rem] sm:text-5xl font-bold …text-primary…`  `typography.tsx#0`, the hub tier.
 *      REACHED BY 23 RENDER ROOTS — the 22 that render `PageHero` (either tier reaches both, see
 *      {@link TIER_SWITCH}) plus `/hakkimizda`, which renders `<H1>` directly. Counting hero CALL
 *      SITES instead gives 16 and is wrong twice over: it misses the four `deniz/*` basin pages
 *      behind one call site, and it misses the three detail roots that reach this element through
 *      the same unevaluable ternary. "Reaches" is not "renders", which is the distinction this
 *      whole file exists to keep, so it is not one to be loose about here of all places.
 *   2. `…text-4xl sm:text-6xl font-extrabold …text-foreground` `typography.tsx#1`, the detail tier.
 *      REACHED BY 22 RENDER ROOTS — every `PageHero` adopter, for the same reason. RENDERED by the
 *      three detail heroes; the other 19 reach it and render the hub tier instead.
 *
 * TWO DELIBERATE NON-TIERS — decided in this task, not left over:
 *   3. `font-heading text-3xl font-bold text-foreground` — `(site)/error.tsx` and
 *      `(site)/not-found.tsx`. THEY KEEP THEIR OWN, and the reason is the one
 *      `walkRenderRoots()`'s docblock already gives for their app-ROOT siblings: a last-resort
 *      shell is not a reading page. `typography.tsx` defines the two tiers as "the h1 of a section
 *      landing page" and "the h1 of one province, country or sea"; neither describes "something
 *      went wrong" or "this does not exist", and the hub tier would additionally paint an error
 *      heading in the brand terracotta. They already agree with EACH OTHER on one spelling, so
 *      there is no drift here to remove — this is the shells' tier, one spelling for the two files
 *      that are shells, and a third shell joining it would be right to use it.
 *   4. `sr-only` — `v2-game-screen.tsx`, serving the three `(play)` screens. A heading that is
 *      never painted cannot carry a type treatment, so giving it a tier's className would be dead
 *      tokens inside a 1px clip rect written only to hold this number down. See the element's own
 *      comment for why the play surface gets a hidden heading rather than a visible one.
 *
 * NINE REMAINDERS, all OUTSIDE the 17 heroes this task adopts — the drift the paragraph above has
 * always said a later task removes, listed so "a later task" has the list:
 *   5. `…text-2xl font-bold text-foreground mb-2` ×3 — `e-posta-dogrulama`, `sifre-sifirlama`,
 *      `sifre-sifirlama/yeni`. Three transactional auth screens already converged on ONE spelling.
 *   6. `…text-2xl sm:text-3xl font-bold …` — `v2-member-hub.tsx` (`/hesabim`).
 *   7. `…text-2xl sm:text-4xl font-extrabold …leading-tight` — `kitaplar/[slug]`.
 *   8. `…text-2xl sm:text-4xl lg:text-5xl font-black …leading-[1.15]` — `dunya/kita`.
 *   9. `…text-3xl sm:text-4xl font-extrabold …` — `oyun/bolge-bolge-il`.
 *  10. `…text-3xl sm:text-4xl lg:text-5xl font-black …leading-[1.15]` — `dunya/kita/[slug]`.
 *  11. `…text-3xl sm:text-5xl font-extrabold …text-primary…` — `turkiye/bolge`. TWO tokens from the
 *      hub tier, not one, and the second is the interesting one:
 *
 *        hub  : font-heading  text-[1.9rem]  sm:text-5xl  font-bold       tracking-tight …
 *        bolge: font-heading  text-3xl       sm:text-5xl  font-extrabold  tracking-tight …
 *
 *      `font-bold` vs `font-extrabold` is a rename. `text-[1.9rem]` vs `text-3xl` is the 0.4px
 *      FLOOR TOKEN Ruling V spent a decision refusing to concede — so converging this page means
 *      accepting the floor, which is a decision and not a rename. Still the cheapest of the nine;
 *      not free, and the next task should be told which half is which.
 *  12. `…text-3xl sm:text-5xl lg:text-6xl font-bold …leading-[1.12] text-balance` — `v2-hero.tsx`,
 *      the home page. T-068 dropped the smallest step a size and added `text-balance`: the new
 *      slogan is one long sentence rather than two short clauses, and at 320px the old 4xl set it
 *      as six lines and 242px of heading.
 *  13. `text-xl font-bold tracking-tight text-foreground` ×2 — `profil` and `v2-profile-form`, the
 *      two branches of the `MULTIPLE_H1_EXEMPTIONS` entry below; card headings, not heroes.
 *
 * MUTATION-CHECKED 2026-09-18 AT 13, not carried over from 12 nor from the original 13. A
 * fourteenth spelling (`<h1 className="zz-fourteenth-spelling">`) added to
 * `app/[locale]/(site)/turkiye/page.tsx` — a `PageHero` adopter, so the mutation lands inside the
 * collapse's reach — takes this RED naming the spelling and the file
 * (`1x zz-fourteenth-spelling / app/[locale]/(site)/turkiye/page.tsx`), takes {@link H1_ELEMENTS}
 * RED at 18, and takes {@link PAGES_WITH_MULTIPLE_H1} RED too, which is the property the collapse
 * must not destroy. Reverted: GREEN.
 */
// T-061: 13 → **12**. Deleting `/profil` and `v2-profile-form.tsx` removed the two
// `text-xl font-bold tracking-tight text-foreground` card headings that were the 13th
// spelling's only carriers. `/hesabim/ayarlar` adds NO spelling: it renders `H1`, the hub tier
// this set already holds.
export const H1_SPELLINGS = 12;

/**
 * The denominator: how many distinct `<h1>` ELEMENTS those spellings cover. Pinned separately so
 * a change that swaps one heading for another (element count steady, spelling count steady) is
 * still visible, and so the anti-vacuity control has something exact to assert. Its failure
 * message prints every element as `file#ordinal`, one per line — it is usually the FIRST thing to
 * go red on a heading change, so a bare number there would be the papercut PR1's review recorded.
 *
 * TASK 3 (2026-09-18): 32 → **19**. The 14 hub heroes' own `<h1>` elements are gone (−14), and
 * `typography.tsx#1` — `H1Display`, which nothing rendered before — becomes reachable (+1), because
 * `PageHero` writes both tiers as JSX and the walk cannot evaluate `tier`. See `TIER_SWITCH` below
 * for why that over-count is resolved at the multiplicity counter and NOT here: both tier elements
 * really do render on this surface, so removing one from a whole-surface element count would hide
 * an element rather than a counting artefact.
 *
 * Step 2 of the same task: 19 → **16**. The three detail heroes (`turkiye/[slug]`,
 * `turkiye/bolge/[slug]`, `dunya/[slug]`) moved onto `PageHero tier="detail"`, deleting their own
 * `<h1>` elements (−3). `H1_SPELLINGS` does NOT move with them: `H1Display`'s spelling is
 * byte-identical to the one those three pages wrote, so the spelling survives with a new owner
 * while three elements collapse into the one they now share.
 *
 * Step 4 of the same task: 16 → **17**. `v2-game-screen.tsx` gained the `sr-only` `<h1>` the three
 * `(play)` screens had never had. `giris` and `kayit` gained a heading too and added NO element:
 * they render `PageHero tier="hub"`, i.e. the tier element 16 other roots already reach.
 *
 * 32 → 17 across the task. This is the counter that carries the result — 17 heroes that each wrote
 * their own heading now share two, and five render roots that rendered none now render one.
 */
// T-061: 17 → **15**. `/profil`'s own `<h1>` and `v2-profile-form.tsx`'s both went with the
// files. `/hesabim/ayarlar` adds no element either — it renders `typography.tsx`'s `H1`, an
// element 16 other roots already reach.
export const H1_ELEMENTS = 15;

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
 * pre-Ruling-F walk could not see — and re-checked after the render-graph rebuild: deleting a
 * render root's heading takes this RED and prints that root's path.
 *
 * TASK 3 (2026-09-18): 5 → **0**. Each of the five was decided on its own evidence, and the SEO
 * half of the argument turned out not to apply to ANY of them — all five are `noindex` in both
 * locales, which is why each entry below leads with what it checked:
 *
 *   - `giris` and `kayit`. `AUTH_PATHNAMES` members, so `buildAuthMetadata` ships `AUTH_SURFACE`
 *     = `"noindex"` in both locales (`lib/auth/auth-metadata.ts`, resolved through
 *     `lib/seo/indexing.ts`) — NOT the indexable pages the brief assumed. The a11y defect is
 *     untouched by that: both are ordinary reading-surface pages with a breadcrumb trail, and both
 *     began their outline at `<h2>` inside a card. Each now renders `PageHero tier="hub"` with the
 *     string its own `<title>` already uses, so the page's heading matches the site's every other
 *     reading page and cannot drift from its title. VISIBLE, because a de-indexed page is still a
 *     document a person reads.
 *   - the three `(play)/oyun/*` screens. `surface: "noindex"` in each page's own `buildMetadata`
 *     call (DEC 2026-07-30p: "application screens, not documents"). They share
 *     `v2-game-screen.tsx`, which now renders ONE `sr-only` `<h1>` carrying the `modeName` each
 *     page already passes to its breadcrumb and its title. HIDDEN, because there is no crawler to
 *     give a title to and a visible heading would take a band above the map on a screen whose
 *     whole point is the map. `sr-only` is Tailwind's visually-hidden utility; read in the browser
 *     on `/oyun/81-il`, this project's Tailwind v4 emits `position: absolute; width: 1px;
 *     height: 1px; overflow: hidden; clip-path: inset(50%)` (NOT the older `clip: rect(0,0,0,0)`,
 *     which stays `auto`) with `display: block` and `visibility: visible` — in the accessibility
 *     tree and reachable by heading navigation, never `display: none`.
 *
 * Not claimed HERE: that these five have a CORRECT OUTLINE (SCOPE note 7). What is claimed is that
 * no render root on this surface leaves a reader with no level-1 heading. The play screens' levels
 * are held separately, at the bottom of this file.
 *
 * RE-MUTATION-CHECKED 2026-09-18 AT 0 — a zero target that has never failed has not been shown to
 * work, the doctrine `PAGE_BODY_SPELLINGS` records in
 * `components/v2/page-composition-containers.test.ts`. Turning `v2-game-screen.tsx`'s `sr-only`
 * `<h1>` into a `<p>` takes this RED and names all three `(play)` screens
 * (`oyun/81-il`, `oyun/bolge-bolge-il/[bolge]`, `oyun/bolge-bulma`) — one component, three roots,
 * which is also the proof the three share it. Reverted: GREEN.
 */
export const PAGES_WITHOUT_H1 = 0;

/**
 * NON-EXEMPT render roots whose closure holds more than one `<h1>` element. Measured 2026-09-18:
 * **0**.
 *
 * **23 OF THE 39 RENDER ROOTS REACH TWO `<h1>` SITES.** The zero is what is left after two named
 * mechanisms reconcile them, and stating it as "one exemption" — as this docblock and SCOPE note 4
 * both did until review measured it — describes a tree that stopped existing when `PageHero` was
 * adopted:
 *
 *   · **22 roots** reach both heading TIERS because they render `PageHero`, and the walk cannot
 *     evaluate its `tier` prop. Reconciled by {@link TIER_SWITCH} / {@link effectiveH1Sites}: the
 *     13 hub `page.tsx` files, the four `deniz/*` basin pages served by one call site in
 *     `v2-sea-basin-detail-view.tsx`, the three detail pages, `giris` and `kayit`. Six dedicated
 *     checks, including four injected second-render shapes and a positive control that the
 *     collapse still fires on an ordinary page.
 *   · **1 root**, `app/[locale]/(site)/profil/page.tsx`, reaches two DIFFERENT headings on mutually
 *     exclusive `accountRole` branches, read line by line out of the source in
 *     `MULTIPLE_H1_EXEMPTIONS` above, so the rendered DOM carries one. Reconciled by that named
 *     exemption and its liveness check.
 *
 * Pinning at 0 rather than at 23 is what makes the counter mean "no page ships two headings"
 * instead of "the number of pages that happen to reach two `<h1>` literals" — and the two
 * mechanisms' own tests are what stop that reasoning outliving the code it describes. What each
 * would hide if it were wrong is spelled out in SCOPE note 4.
 *
 * RE-MUTATION-CHECKED 2026-09-18 AT 0 AGAINST THE CURRENT MECHANISM. The earlier citation pointed
 * at Task 1's check, which predates `PageHero` and therefore ran on a tree where the collapse did
 * not exist — evidence for a different counter. Redone here: a second `<h1>` added to
 * `turkiye/page.tsx` (a `PageHero` adopter, i.e. inside the collapse's reach) takes this RED,
 * naming the page and both sites; reverted, GREEN. The collapse is separately mutation-checked in
 * its own describe block, in both directions and in all four second-render spellings.
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
    // 39 → 40 in T-073: `/kullanim-sartlari` is the 38th `(site)` page, and the two
    // special files (`error.tsx`, `not-found.tsx`) still sit on top of the count.
    // 40 → 41 in T-101: `/gizlilik` is the 39th.
    expect(resolution).toHaveLength(41);
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
    expect(roots).toHaveLength(41);
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

  // `FIXTURE_ROOT` and the rule it exists for — no control may depend on markup a later task in
  // the plan is contracted to delete — are in `lib/test-support/composition-scan.ts`.
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
    expect(walkPages()).toHaveLength(39);
    expect(walkRenderRoots().length).toBeGreaterThan(walkPages().length);
    expect(walkPages().map(label)).not.toContain("app/[locale]/(site)/error.tsx");
  });

  it("reads a double-quoted className — real file, app/[locale]/(site)/not-found.tsx", () => {
    // RE-ANCHORED, not deleted. This control was taken on `araclar/page.tsx`, whose literal
    // `<h1 className="…">` the adoption task replaced with `<PageHero tier="hub">` — the control
    // would have read `[]` and the cheapest green would have been to drop it. It is a control on
    // the EXTRACTOR ("reads a double-quoted className off a real file"), not on araclar, so it
    // moves to the one render root this programme has RULED keeps its own literal heading:
    // `(site)/not-found.tsx`, which with `(site)/error.tsx` shares the shells' spelling and is
    // deliberately not a hub or detail tier (see `H1_SPELLINGS`).
    const notFound = sourceOf(join(repoRoot, "app/[locale]/(site)/not-found.tsx"));
    expect(classNamesOf(notFound, "h1")).toEqual([
      "font-heading text-3xl font-bold text-foreground",
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
    //
    // THE HOLE READS AS A MARKER, AND THAT IS THE ONE EXPECTATION T-045 MOVED. This asserted
    // `${theme.gradient}` — the hole's own text, copied through — until the two extractors in the
    // old `page-composition.test.ts` were merged onto PR4's `${…}` marker. The element is credited
    // with what it literally writes and never with whatever the interpolation may produce, which
    // is the rule PR3's own docblock stated and its implementation did not achieve (see
    // `literalsIn` in `lib/test-support/composition-scan.ts` for the three ways it mangled a hole
    // instead). No counter in this file moved with it: no `<h1>` carries a hole, asserted at the
    // bottom of this file.
    const kita = sourceOf(join(repoRoot, "app/[locale]/(site)/dunya/kita/[slug]/page.tsx"));
    expect(classNamesOf(kita, "section")).toContain(
      `relative isolate border-b border-border bg-gradient-to-b ${HOLE_MARKER} pt-8 pb-14 overflow-hidden`,
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

  it("the exemption filter silences nothing it was not given — negative control", () => {
    // This control used to prove that naming `profil` silenced `profil` AND NOTHING ELSE, by
    // showing the unfiltered list held exactly that one file while the filtered list was empty.
    // T-061 deleted `/profil`, so `MULTIPLE_H1_EXEMPTIONS` is empty and there is no file left to
    // demonstrate the filter against.
    //
    // It is rewritten rather than deleted, because with an empty exemption list there is a
    // STRONGER property available: the filtered and unfiltered lists must be IDENTICAL. Nothing
    // is being silenced, so nothing may differ. If a page reaching two `<h1>` elements comes
    // back, this case goes red alongside `PAGES_WITH_MULTIPLE_H1` and says which file — and if
    // someone adds an exemption without a reason, the two lists diverge and this case is where
    // that shows.
    //
    // Read off `effectiveH1Sites`, not `h1SitesOf`: 22 render roots reach BOTH heading tiers
    // through `PageHero`'s one `tier` switch, which the tier-switch block below collapses and
    // separately proves. The uncollapsed number is pinned by "the split" immediately below.
    expect(MULTIPLE_H1_EXEMPTIONS).toEqual([]);
    const allWithTwo = walkRenderRoots().filter((page) => effectiveH1Sites(page).length > 1);
    expect(pagesWithMultipleH1()).toEqual(allWithTwo.map(label));
    expect(allWithTwo.map(label)).toEqual([]);
  });

  it("the 22/22/0 split is exactly what both docblocks claim — the uncollapsed number", () => {
    // THE ONE ASSERTION THAT READS `h1SitesOf` RATHER THAN `effectiveH1Sites`. Without it the raw
    // count is observed nowhere: a later task adopting `PageHero` on a headingless page moves it
    // and no other counter notices, so SCOPE note 4 and `PAGES_WITH_MULTIPLE_H1`'s docblock — both
    // rewritten from a false "only `/profil`" to this measured split — would go stale in silence.
    const reachingTwo = walkRenderRoots().filter((page) => h1SitesOf(page).length > 1);
    expect(
      reachingTwo.map(label),
      `render roots reaching two <h1> sites BEFORE either reconciliation:\n${reachingTwo
        .map((p) => `  ${label(p)}`)
        .join("\n")}`,
    ).toHaveLength(ROOTS_REACHING_TWO_H1);

    // Which mechanism accounts for each. `effectiveH1Sites` collapsing to one means the tier
    // switch took it; still holding two means only the named exemption can.
    const byTierSwitch = reachingTwo.filter((page) => effectiveH1Sites(page).length === 1);
    const byExemption = reachingTwo.filter((page) => effectiveH1Sites(page).length > 1);
    expect(byTierSwitch, "roots reconciled by the tier switch").toHaveLength(
      ROOTS_RECONCILED_BY_TIER_SWITCH,
    );
    expect(byExemption.map(label), "roots left for the named exemption").toEqual(
      MULTIPLE_H1_EXEMPTIONS.map((exemption) => exemption.file),
    );
    expect(byExemption).toHaveLength(ROOTS_RECONCILED_BY_EXEMPTION);

    // The three pins must account for each other, so they cannot be re-pinned one at a time into
    // a set that does not add up.
    expect(ROOTS_RECONCILED_BY_TIER_SWITCH + ROOTS_RECONCILED_BY_EXEMPTION).toBe(
      ROOTS_REACHING_TWO_H1,
    );
  }, 20000);
});

describe("the PageHero tier switch", () => {
  it("still writes both tiers as JSX in the one component that owns the choice", () => {
    // The liveness half. If the ternary is ever refactored back to a `const Heading = …` alias,
    // the walk stops seeing ANY heading through this component and 17 pages silently rejoin
    // `PAGES_WITHOUT_H1`; if it is refactored to render one tier, this collapse is wrong and
    // must be dropped rather than carried.
    const source = sourceOf(join(repoRoot, TIER_SWITCH.component));
    expect(
      source,
      `${TIER_SWITCH.component}: the tier ternary is gone — ${TIER_SWITCH.why}`,
    ).toContain(TIER_SWITCH.guard);
  });

  it("the two collapsed sites are typography.tsx's two h1s, in the tiers' declaration order", () => {
    // Pins the keys against the file rather than trusting two hand-typed strings.
    //
    // THE ORDINAL HALF USED TO BE A TAUTOLOGY. This asserted
    // `occurrences.map(o => \`…#${o.ordinal}\`)` against `TIER_SWITCH.sites`, and
    // `h1OccurrencesOf` always yields ordinals `0..n-1` in source order — so for any two-`<h1>`
    // file it compared `["#0","#1"]` to `["#0","#1"]` and passed whatever the declarations were.
    // Review swapped `H1` and `H1Display` and this check stayed green (three OTHER tests went
    // red, so the property was never unguarded — but a tautology inside the mechanism that
    // records a counter hole is the worst place in the file for one, because it is part of the
    // evidence that the hole is narrow).
    //
    // What actually has to hold is that `sites[0]` is the HUB tier's element and `sites[1]` the
    // DETAIL tier's, so resolve each `<h1>` to the DECLARATION whose region contains it and
    // assert those names. Swapping the two declarations now fails here.
    const typography = join(repoRoot, TIER_SWITCH.tierModule);
    const occurrences = h1OccurrencesOf(typography);
    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((o) => `${TIER_SWITCH.tierModule}#${o.ordinal}`)).toEqual([
      ...TIER_SWITCH.sites,
    ]);

    const regions = [...declarationRegions(typography)];
    const ownerOf = (index: number) =>
      regions.find(([, [from, to]]) => index >= from && index < to)?.[0] ?? null;
    expect(
      occurrences.map((o) => ownerOf(o.index)),
      "the declaration each collapsed <h1> belongs to, in source order",
    ).toEqual([...TIER_SWITCH.tierNames]);
  });

  /**
   * THE HOLE THE PROVENANCE KEYING CLOSES, in all four spellings a second render can take.
   *
   * `h1SitesOf` keys by `file#ordinal`, so a page rendering `PageHero` AND a tier primitive
   * directly still holds exactly `{#0, #1}` — under a presence-only collapse it read as ONE
   * heading while shipping TWO. `/hakkimizda` renders `<H1>` directly today and is the obvious
   * next adoption, so this is one edit from live.
   *
   * The first two rows were closed by Ruling Z. The ALIAS and BARREL rows are Ruling AB: the
   * first fix compared the JSX tag's SPELLING to `TIER_SWITCH.tierNames`, which neither of them
   * matches, so both slipped through with the whole suite green — the same defect one door along.
   * Provenance now comes off the walk's own `jsx`/`forward` edges, which resolve aliases and
   * re-exports by construction, so all four are one case rather than four.
   */
  const SECOND_RENDER_SHAPES: ReadonlyArray<{
    readonly name: string;
    readonly imports: string;
    readonly markup: string;
    readonly barrel?: string;
  }> = [
    {
      name: "the hub primitive, imported plainly",
      imports: 'import { H1 } from "@/components/patterns/typography";',
      markup: "<H1>second</H1>",
    },
    {
      name: "the detail primitive, imported plainly",
      imports: 'import { H1Display } from "@/components/patterns/typography";',
      markup: "<H1Display>second</H1Display>",
    },
    {
      name: "an ALIASED import — the natural way to write it beside a PageHero import",
      imports: 'import { H1 as Heading } from "@/components/patterns/typography";',
      markup: "<Heading>second</Heading>",
    },
    {
      name: "a RE-EXPORT BARREL — the case reexportTargetsOf is kept alive for",
      imports: 'import { H1 } from "@/lib/game/target";',
      markup: "<H1>second</H1>",
      barrel: 'export { H1 } from "@/components/patterns/typography";',
    },
  ];

  it.each(SECOND_RENDER_SHAPES.map((s) => [s.name, s] as const))(
    "does NOT collapse a second render via %s",
    (_name, shape) => {
      const target = join(repoRoot, "app/[locale]/(site)/turkiye/page.tsx");
      const barrelPath = join(repoRoot, "lib/game/target.ts");
      const raw = readFileSync(target, "utf8");

      const injected = raw
        .replace(
          'import { PageHero } from "@/components/patterns/page-hero";',
          `import { PageHero } from "@/components/patterns/page-hero";\n${shape.imports}`,
        )
        .replace("<PageHero", `${shape.markup}\n            <PageHero`);
      expect(injected).not.toBe(raw);

      const overrides: Array<readonly [string, string]> = [[target, injected]];
      if (shape.barrel) {
        overrides.push([barrelPath, `${readFileSync(barrelPath, "utf8")}\n${shape.barrel}\n`]);
      }

      const { offenders, writers } = withInjectedSource(overrides, () => ({
        offenders: pagesWithMultipleH1(),
        writers: tierPrimitiveWriters(target),
      }));
      expect(writers, "the page itself must be recorded as a tier writer beside PageHero").toEqual(
        [TIER_SWITCH.component, "app/[locale]/(site)/turkiye/page.tsx"].sort(),
      );
      expect(offenders, "a second render beside PageHero must report as an offender").toHaveLength(
        1,
      );
      expect(offenders[0]).toContain("app/[locale]/(site)/turkiye/page.tsx");
    },
    20000,
  );

  it("a LOCAL component named H1 is not a tier writer — the exclusion, still correct", () => {
    // The mirror of the four above: resolution must not fire on the NAME. A page-local
    // `function H1()` resolves to that page's own declaration, so it is not a tier writer — and
    // the page is still an offender, because its own `<h1>` is a genuine THIRD site. Getting this
    // wrong in the other direction would make every page with a local `H1` stop collapsing.
    const target = join(repoRoot, "app/[locale]/(site)/turkiye/page.tsx");
    const raw = readFileSync(target, "utf8");
    const injected = raw
      .replace(
        "export default async function",
        'function H1() {\n  return <h1 className="zz-local-shadow">x</h1>;\n}\n\nexport default async function',
      )
      .replace("<PageHero", "<H1 />\n            <PageHero");
    expect(injected).not.toBe(raw);

    const { offenders, writers, sites } = withInjectedSource([[target, injected]], () => ({
      offenders: pagesWithMultipleH1(),
      writers: tierPrimitiveWriters(target),
      sites: h1SitesOf(target).map((s) => s.key),
    }));
    expect(writers, "a local H1 must NOT be recorded as rendering the tier primitive").toEqual([
      TIER_SWITCH.component,
    ]);
    expect(sites).toHaveLength(3);
    expect(offenders).toHaveLength(1);
  }, 20000);

  it("still collapses an ordinary PageHero page — the other half of Ruling Z", () => {
    // Without this, a collapse that never fired would make the test above pass vacuously and
    // would take all 22 adopting render roots back to being offenders.
    const target = join(repoRoot, "app/[locale]/(site)/turkiye/page.tsx");
    expect(tierPrimitiveWriters(target)).toEqual([TIER_SWITCH.component]);
    expect(
      h1SitesOf(target)
        .map((s) => s.key)
        .sort(),
    ).toEqual([...TIER_SWITCH.sites]);
    expect(effectiveH1Sites(target)).toHaveLength(1);
    expect(pagesWithMultipleH1()).toEqual([]);
  }, 20000);

  it("PageHero is the ONLY surface file rendering both tiers — the collapse's premise, measured", () => {
    // Turns "a root reaching both tiers reached them through PageHero" from an assumption into
    // a checked fact. If any other file starts writing `<H1` and `<H1Display` together, its
    // pages would be collapsed by a rule that says nothing about them, so this goes red first.
    const both = surfaceFiles()
      .concat(walk(join(repoRoot, "components/patterns")))
      .filter((path) => {
        const masked = maskLiterals(sourceOf(path));
        return /<H1[\s/>]/.test(masked) && /<H1Display[\s/>]/.test(masked);
      })
      .map(label)
      .sort();
    expect(
      both,
      `files rendering BOTH heading tiers:\n${both.map((f) => `  ${f}`).join("\n")}`,
    ).toEqual([TIER_SWITCH.component]);
  });

  it("collapses only the pair, never a third heading — negative control", () => {
    // The property the collapse must not destroy. A page that renders PageHero AND ships another
    // `<h1>` of its own is still an offender; only the pair itself is an artefact.
    const target = join(repoRoot, "app/[locale]/(site)/turkiye/page.tsx");
    const raw = readFileSync(target, "utf8");
    const withExtra = raw.replace(
      "<PageHero",
      '<h1 className="zz-second-heading">x</h1>\n            <PageHero',
    );
    expect(withExtra).not.toBe(raw);
    const offenders = withInjectedSource([[target, withExtra]], () => pagesWithMultipleH1());
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain("app/[locale]/(site)/turkiye/page.tsx");
  }, 20000);
});

/**
 * RULING AM, CARRIED FORWARD THROUGH T-045.
 *
 * T-035 PR4 measured that its brace-balancing scanner and PR3's regex path disagreed about 22
 * `<div>`s, all of them template-hole classNames, and that PR3's side was MANGLED rather than
 * merely verbose — it stripped the hole's quotes, welded both branches of a ternary together,
 * dropped a branch entirely in `v2-game-history-stats.tsx`, and in the since-deleted sources card
 * welded a CONDITIONAL `lg:grid-cols-3` in as unconditional. That was harmless for THESE counters only
 * because no `<h1>` on the surface carries a template hole, and nothing asserted it.
 *
 * T-045 then merged the two extractors onto PR4's `${…}` marker rather than porting PR3's hole
 * handling, and the assertion below is what made that migration free: 0 of the 13 `H1_SPELLINGS`
 * rows contains a hole, so no counter here moved. The three manglings are now executable evidence
 * in `lib/test-support/composition-scan.test.ts` rather than prose.
 *
 * It is KEPT, not retired with the merge it justified. A hole reaching an `<h1>` would make a
 * heading spelling partly uncountable — `H1_SPELLINGS` would gain a row nobody can converge — and
 * that is worth knowing about on the day it happens, which is what this says.
 *
 * MUTATION-CHECKED 2026-09-18: `typography.tsx`'s detail-tier `<h1>` given a template hole
 * (`` `… tracking-tight ${tone}` ``) — RED, `h1 spellings containing a template hole: expected
 * [ Array(1) ] to deeply equal []`. Reverted.
 */
describe("no h1 spelling is partly uncountable", () => {
  it("no h1 on the surface carries a template hole", () => {
    const holed = [...h1SitesBySpelling()].filter(([spelling]) => spelling.includes(HOLE_MARKER));
    expect(
      holed.map(([spelling, files]) => `${spelling} — ${files.join(", ")}`),
      "h1 spellings containing a template hole",
    ).toEqual([]);
    expect(h1SitesBySpelling().size).toBe(H1_SPELLINGS);
  });
});

/**
 * THE `(play)` OUTLINE — NO SKIPPED LEVEL. The counters above answer "is there exactly one `<h1>`"
 * (SCOPE note 7); this block answers the next question for the three fullscreen game screens:
 * does the outline under that `<h1>` step down one level at a time.
 *
 * It reuses the render walk rather than a second resolver: every node `h1SitesOf` visits from a
 * `(play)` root contributes the `<h1>`–`<h6>` elements written inside its own span, read from
 * {@link maskedSource} so a heading inside a string literal is prose.
 *
 * TWO OUTLINES, NOT ONE. A modal dialog is announced as its own context and its title is its top
 * heading, so a dialog's headings are not measured against the page's:
 *
 *   - the PAGE outline — every explicit heading outside a dialog — must be exactly 1..N;
 *   - a DIALOG outline — the explicit headings in a declaration that renders one of
 *     {@link IMPLICIT_H2_TITLES} — sits under that implicit `<h2>` and must be exactly 3..N (or
 *     empty).
 *
 * The dialog title never appears as a literal `<h2` in this repo: `DialogTitle` / `SheetTitle`
 * wrap Base UI's `Dialog.Title`, which renders the `<h2>` itself. The table below names those
 * wrappers, and its liveness check reads both the wrapper and the installed Base UI source, so a
 * wrapper that stops rendering `Dialog.Title` or a Base UI upgrade that changes the tag goes red
 * here instead of quietly moving a dialog's outline.
 *
 * Granularity is the declaration, the walk's own unit: a component rendered INSIDE a dialog but
 * declared elsewhere is measured against the page outline. None exists on the play surface.
 *
 * WHY THERE IS ALSO AN EXACT PIN. The two rules above read level SETS, and a set cannot see
 * mutually exclusive branches. `V2GameScreen`'s two `<h2>` panels are alternatives (ready to start
 * vs round finished), and so are the leaderboard's two `<h3>` empty states: turn ONE of either pair
 * back to its old level and the set still reads `1,2,3` / `3,4`, green, while that branch renders
 * a skip. {@link PLAY_OUTLINE} therefore pins every heading's level per declaration, in source
 * order, so any single element moving goes red and has to be re-decided here.
 *
 * Not measured: anything mounted by `app/[locale]/layout.tsx` (the auth and unsaved-changes
 * dialogs), which no render root's walk reads — SCOPE note 5.
 *
 * MUTATION-CHECKED: on the tree before this block, the page outline read `1,3` on all three roots
 * and the leaderboard dialog read `4`; both rules were RED, naming the file. With the fix in place,
 * reverting ONE leaderboard `<h3>` to `<h4>`, or ONE game-screen `<h2>` to `<h3>`, leaves both
 * set rules green and takes the {@link PLAY_OUTLINE} pin RED; reverted, GREEN.
 */
/**
 * Every explicit heading the play roots render, per declaration, in source order. `page` or
 * `dialog` is the outline it belongs to (see above). Declarations with no heading are omitted.
 */
const PLAY_OUTLINE: Readonly<Record<string, { scope: "page" | "dialog"; levels: number[] }>> = {
  // sr-only h1, then the two mutually exclusive overlay panels (ready to start / round result).
  "components/v2/v2-game-screen.tsx — V2GameScreen": { scope: "page", levels: [1, 2, 2] },
  // The two mutually exclusive empty states under the dialog's implicit `<h2>` title.
  "components/v2/v2-leaderboard-modal.tsx — V2LeaderboardModal": {
    scope: "dialog",
    levels: [3, 3],
  },
};
const IMPLICIT_H2_TITLES: ReadonlyArray<{
  readonly file: string;
  readonly name: string;
  readonly primitive: string;
}> = [
  { file: "components/ui/dialog.tsx", name: "DialogTitle", primitive: "DialogPrimitive" },
  { file: "components/ui/sheet.tsx", name: "SheetTitle", primitive: "SheetPrimitive" },
];

/** Base UI's `Dialog.Title`, whose default element is what the table above relies on. */
const BASE_UI_DIALOG_TITLE = "node_modules/@base-ui/react/dialog/title/DialogTitle.js";

const HEADING_ELEMENT = /<h([1-6])[\s>]/g;

type OutlineSite = { readonly key: string; readonly owner: string; readonly level: number };
type PlayOutline = { readonly page: OutlineSite[]; readonly dialogs: Map<string, OutlineSite[]> };

function rendersImplicitTitle(file: string, masked: string): boolean {
  const bindings = importBindingsOf(file);
  return [...masked.matchAll(JSX_ELEMENT)].some((match) => {
    const bound = bindings.get(match[1]!);
    return (
      bound !== undefined &&
      IMPLICIT_H2_TITLES.some(
        (title) => label(bound.file) === title.file && bound.name === title.name,
      )
    );
  });
}

function playOutlineOf(root: string): PlayOutline {
  const nodes: RenderNode[] = [];
  h1SitesOf(root, (node) => nodes.push(node));

  const page = new Map<string, OutlineSite>();
  const dialogs = new Map<string, OutlineSite[]>();
  for (const node of nodes) {
    if (!node.file.endsWith(".tsx")) continue;
    const span = nodeSpan(node);
    if (span.kind === "forward") continue;
    const masked = maskedSource(node.file).slice(span.from, span.to);
    const owner = `${label(node.file)} — ${node.name ?? "*whole*"}`;
    const sites = [...masked.matchAll(HEADING_ELEMENT)].map((match) => ({
      key: `${owner} @${span.from + match.index}`,
      owner,
      level: Number(match[1]),
    }));
    if (rendersImplicitTitle(node.file, masked)) dialogs.set(owner, sites);
    else for (const site of sites) page.set(site.key, site);
  }
  return { page: [...page.values()], dialogs };
}

function levelsOf(sites: readonly OutlineSite[]): number[] {
  return [...new Set(sites.map((site) => site.level))].sort((a, b) => a - b);
}

/** `from..max` with no gap, or `[]` for an outline that may be empty. */
function unbrokenFrom(from: number, levels: readonly number[]): number[] {
  const top = levels.length === 0 ? from - 1 : Math.max(from - 1, ...levels);
  return Array.from({ length: top - from + 1 }, (_, i) => from + i);
}

const playRoots = () => walkRenderRoots().filter((root) => label(root).includes("/(play)/"));

describe("the (play) outline steps one level at a time", () => {
  it("covers exactly the three game screens — anti-vacuity", () => {
    expect(playRoots().map(label)).toEqual([
      "app/[locale]/(play)/oyun/81-il/page.tsx",
      "app/[locale]/(play)/oyun/bolge-bolge-il/[bolge]/page.tsx",
      "app/[locale]/(play)/oyun/bolge-bulma/page.tsx",
    ]);
  });

  it("the page outline is 1..N with no skipped level", () => {
    const broken = playRoots().flatMap((root) => {
      const { page } = playOutlineOf(root);
      const levels = levelsOf(page);
      return levels[0] === 1 && levels.join() === unbrokenFrom(1, levels).join()
        ? []
        : [
            `${label(root)} — levels ${levels.join(",")}: ${page.map((s) => `h${s.level} ${s.key}`).join("; ")}`,
          ];
    });
    expect(broken, "play roots whose page outline skips a level").toEqual([]);
  });

  it("every dialog outline starts under its implicit h2, at 3..N", () => {
    const broken = new Set<string>();
    let dialogsSeen = 0;
    for (const root of playRoots()) {
      for (const [owner, sites] of playOutlineOf(root).dialogs) {
        dialogsSeen += 1;
        const levels = levelsOf(sites);
        if (levels.join() !== unbrokenFrom(3, levels).join()) {
          broken.add(`${owner} — levels ${levels.join(",")}`);
        }
      }
    }
    // The leaderboard dialog and the header's mobile-nav sheet, on each of the three roots.
    expect(dialogsSeen).toBe(6);
    expect([...broken], "dialogs whose outline does not sit at 3..N").toEqual([]);
  });

  it("every play heading sits at its pinned level — the per-element check the sets cannot make", () => {
    for (const root of playRoots()) {
      const { page, dialogs } = playOutlineOf(root);
      const actual: Record<string, { scope: "page" | "dialog"; levels: number[] }> = {};
      for (const site of page) {
        (actual[site.owner] ??= { scope: "page", levels: [] }).levels.push(site.level);
      }
      for (const [owner, sites] of dialogs) {
        if (sites.length > 0)
          actual[owner] = { scope: "dialog", levels: sites.map((s) => s.level) };
      }
      expect(actual, label(root)).toEqual(PLAY_OUTLINE);
    }
  });

  it("the implicit-title table is live: each wrapper renders Base UI's Dialog.Title, an h2", () => {
    for (const title of IMPLICIT_H2_TITLES) {
      const file = join(repoRoot, title.file);
      const region = declarationRegions(file).get(title.name);
      expect(region, `${title.file} declares ${title.name}`).toBeDefined();
      expect(readSource(file).slice(region![0], region![1])).toContain(`<${title.primitive}.Title`);
      expect(readSource(file)).toMatch(
        new RegExp(`import \\{ Dialog as ${title.primitive} \\} from "@base-ui/react/dialog"`),
      );
    }
    expect(readFileSync(join(repoRoot, BASE_UI_DIALOG_TITLE), "utf8")).toContain(
      "useRenderElement)('h2'",
    );
  });
});
