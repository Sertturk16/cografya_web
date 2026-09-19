import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSpecifier } from "@/lib/test-support/import-closure";
import {
  CARD_FIXTURE,
  COMPUTED_CLASSNAME,
  HOLE_MARKER,
  NO_CLASSNAME,
  classNameOfTag,
  classNamesOf,
  declarationRegions,
  graphCache,
  importBindingsOf,
  innermostElementAt,
  jsxElementsOf,
  label,
  literalsIn,
  maskedSource,
  perFileCache,
  readSource,
  registeredCaches,
  reexportTargetsOf,
  repoRoot,
  resolvesTo,
  scanJsx,
  tagTextAt,
  walkCardSurface,
  withInjectedSource,
} from "@/lib/test-support/composition-scan";

/* -------------------------------------------------------------------------------------------
 * T-045 — the shared layer under the three `components/v2/page-composition-*.test.ts` suites.
 *
 * Those three files own counters. THIS file owns the scanner they are counted with, and covers
 * the three things the split could break without any counter noticing: the extractor's hole
 * semantics, the binding resolver's re-export chase and cycle guard, and the injection harness's
 * cache invalidation.
 * ---------------------------------------------------------------------------------------- */

/* =============================================================================================
 * THE GUARDED POPULATION — DERIVED, NOT WRITTEN (RULING BJ)
 *
 * Two source guards below grep the scanner's consumers: one for `literalsIn(…, false)`, one for a
 * module-scope cache built outside the factories. Both first shipped iterating a hand-written
 * four-file list, and review reproduced the hole in one edit: a FIFTH file importing `literalsIn`
 * and calling it with `false` left the suite green at 29 passed.
 *
 * The exposure was small. The SHAPE is why it is fixed: this is the third appearance in this
 * programme of a guard whose population is written rather than derived — Task 4 pinned the
 * exclusion populations by COUNT rather than membership, Task 6's `isGridShell` resolved ONE hop
 * rather than chasing re-exports, and now this. Each was correct on the day it was written and
 * blind to the next arrival, and each was found by someone re-deriving what the guard should have
 * derived itself.
 *
 * So the population is computed the way the scanner computes everything else: **every file in the
 * repo whose import specifiers resolve to `composition-scan.ts`**, plus the module itself. A fifth
 * suite is covered by the act of importing the scanner, which is the only way it can use it — so
 * the guards self-extend and there is no list to forget. `readSource` is the reader throughout, so
 * the derivation and both guards are drivable by injection, and "the guarded population is DERIVED
 * from the import" below drives exactly the fifth-file case review reproduced.
 * ========================================================================================== */

const SCANNER_MODULE = join(repoRoot, "lib/test-support/composition-scan.ts");

/** This file: the one legitimate `balanceHoles: false` caller, and the only exemption there is. */
const THIS_FILE = join(repoRoot, "lib/test-support/composition-scan.test.ts");

/**
 * Every `.ts`/`.tsx` in the repo, TEST FILES INCLUDED. `import-closure.ts`'s own `walk` drops
 * anything matching `.test.`, which is exactly wrong here: every consumer of this module is a test
 * file. Build output and dependencies are skipped by name rather than by a list of roots, so a
 * consumer added in a directory nobody thought of is still found.
 */
const NOT_SOURCE = new Set([".git", ".next", "node_modules", "public", "coverage", "dist"]);

function walkSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return NOT_SOURCE.has(entry.name) ? [] : walkSources(join(dir, entry.name));
    }
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : [];
  });
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

/** Does `file` import the scanner? Read through `readSource`, so a fixture can be injected. */
function importsScannerModule(file: string): boolean {
  return [...readSource(file).matchAll(SPECIFIER)].some(
    (match) => resolveSpecifier(file, match[1]!) === SCANNER_MODULE,
  );
}

/**
 * The scanner plus every file that imports it — what both guards below cover.
 *
 * The raw-text prefilter is a speed measure and cannot narrow the answer: any specifier that
 * resolves to this module must spell `composition-scan` in the specifier itself. It runs on RAW
 * text while {@link importsScannerModule} runs on comment-stripped text, so a commented-out import
 * passes the prefilter and is then correctly rejected.
 */
function guardedFiles(): string[] {
  const importers = walkSources(repoRoot)
    .filter((file) => file !== SCANNER_MODULE)
    .filter((file) => readFileSync(file, "utf8").includes("composition-scan"))
    .filter(importsScannerModule)
    .sort();
  return [SCANNER_MODULE, ...importers];
}

/** `literalsIn(expr, false)` — the pre-merge branch, legitimate only in this file. */
const UNBALANCED_CALL = /literalsIn\([^()]*,\s*false\s*\)/;

function unbalancedCallers(files: readonly string[]): string[] {
  return files.filter((file) => UNBALANCED_CALL.test(readSource(file))).map(label);
}

/** Module-scope `const X … = new Map…`, which is what an unregistered memo looks like. */
const DECLARED_MAP = /^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::[^=\n]*)?=\s*new\s+Map\b/gm;

/** Anything whose name says cache, whatever it is assigned. */
const DECLARED_CACHE =
  /^(?:export\s+)?const\s+([A-Za-z0-9_$]*[Cc]ache[A-Za-z0-9_$]*)\s*(?::[^=\n]*)?=\s*([A-Za-z0-9_$]+)/gm;

/** Module-scope Maps that are fixtures, not memos. A new one has to be argued for here. */
const NOT_A_CACHE = new Set(["STAT_GRID_BINDING"]);

function unregisteredCaches(files: readonly string[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    const source = readSource(file);
    for (const match of source.matchAll(DECLARED_MAP)) {
      const name = match[1]!;
      if (!NOT_A_CACHE.has(name)) {
        offenders.push(`${label(file)} — ${name} = new Map(): use perFileCache() or graphCache()`);
      }
    }
    for (const match of source.matchAll(DECLARED_CACHE)) {
      const factory = match[2]!;
      if (factory !== "perFileCache" && factory !== "graphCache") {
        offenders.push(`${label(file)} — ${match[1]!} = ${factory}(…): not a registered cache`);
      }
    }
  }
  return offenders;
}

/* =============================================================================================
 * THE ONE EXTRACTOR
 * ========================================================================================== */

/**
 * THE MERGE, AS EXECUTABLE EVIDENCE.
 *
 * T-035 PR3 and PR4 shipped two extractors that answered "what classes does this element write"
 * by different rules. PR4's cross-scanner guard measured the disagreement on the live tree: 22
 * `<div>`s, every one a template-hole className, and PR3's side was MANGLED rather than merely
 * verbose. Three shapes were recorded in prose. They are assertions now, reproduced through
 * `literalsIn`'s `balanceHoles: false` branch — which exists for exactly this and for nothing
 * else, as "no `balanceHoles: false` outside this file" below pins.
 */
describe("the literal extractor's hole semantics", () => {
  it("balances a hole into ONE marker rather than reading its contents as classes", () => {
    expect(literalsIn("`rounded-3xl border ${fault.borderClass} bg-card p-6`", true)).toEqual([
      `rounded-3xl border ${HOLE_MARKER} bg-card p-6`,
    ]);
  });

  it("MANGLING 1 — a nested template welds both ternary branches together, quotes gone", () => {
    // `components/v2/v2-turkey-map-explorer.tsx` and `components/v2/v2-world-map-explorer.tsx`
    // write this shape. Unbalanced, the outer literal ends at the INNER backtick and the two
    // cursor branches are re-read as class fragments.
    const expression =
      '`select-none ${zoom > 1 ? `touch-none ${p ? "cursor-grabbing" : "cursor-grab"}` : "cursor-crosshair"}`';
    const welded = literalsIn(expression, false).join(" ");
    expect(welded).toContain("cursor-grabbing cursor-grab");
    expect(welded).not.toContain('"cursor-grabbing"');
    // Balanced, the whole hole is one marker and no branch is credited to the element.
    expect(literalsIn(expression, true)).toEqual([`select-none ${HOLE_MARKER}`]);
  });

  it("MANGLING 2 — a branch is deleted outright, the hole reducing to a bare `? :`", () => {
    // `components/v2/v2-game-history-stats.tsx`'s achievement tile.
    const expression =
      '`p-4 rounded-2xl border ${item.unlocked ? `${item.color} shadow-xs` : "border-dashed border-border"}`';
    const mangled = literalsIn(expression, false).join(" ");
    expect(mangled).toContain("? ");
    expect(mangled).not.toContain("shadow-xs");
    expect(literalsIn(expression, true)).toEqual([`p-4 rounded-2xl border ${HOLE_MARKER}`]);
  });

  it("MANGLING 3 — a CONDITIONAL grid-cols token is carried through as unconditional", () => {
    // `components/v2/v2-sources-section.tsx`, twice. `grid-cols-*` is exactly the token the
    // stat-grid predicate keys on, which is why this one was the most dangerous of the three.
    const expression = '`grid grid-cols-1 md:grid-cols-2 ${n > 2 ? "lg:grid-cols-3" : ""} gap-3.5`';
    expect(literalsIn(expression, false).join(" ")).toContain("lg:grid-cols-3");
    expect(literalsIn(expression, true)).toEqual([
      `grid grid-cols-1 md:grid-cols-2 ${HOLE_MARKER} gap-3.5`,
    ]);
  });

  it("reads EVERY literal in the expression, not just the first — the union clause", () => {
    // `cn("a b", isActive && "c")` reports `a b c`, a class list no single render necessarily
    // produces. Inherited from PR3's SCOPE note 3 and unchanged by the merge.
    expect(literalsIn('cn("a b", isActive && "c")', true)).toEqual(["a b", "c"]);
    expect(classNameOfTag('<h1 className={cn("a b", isActive && "c")}>')).toBe("a b c");
  });

  it("an escape is carried through rather than ending the literal", () => {
    expect(literalsIn('"a\\"b"', true)).toEqual(['a\\"b']);
  });

  it("the two markers stay distinct — no classes is not the same fact as unreadable classes", () => {
    expect(classNameOfTag("<h1>")).toBe(NO_CLASSNAME);
    expect(classNameOfTag("<h1 className={headingClass}>")).toBe(COMPUTED_CLASSNAME);
    expect(NO_CLASSNAME).not.toBe(COMPUTED_CLASSNAME);
  });

  it("a `>` inside a brace expression does not end the tag early — both entry points", () => {
    expect(classNamesOf('<h1 onClick={() => go()} className="a b">x</h1>', "h1")).toEqual(["a b"]);
    expect(scanJsx('<div onClick={() => go(a > b)} className="a b" />')[0]!.spelling).toBe("a b");
    expect(tagTextAt('<h1 onClick={() => go()} className="a b">x', 0)).toBe(
      '<h1 onClick={() => go()} className="a b">',
    );
  });

  /**
   * THE GUARD THAT KEEPS THE MERGE MERGED.
   *
   * `balanceHoles: false` is the pre-merge behaviour, kept only so the three manglings above stay
   * executable. If a counter ever reaches for it the merge has been undone. The population it
   * checks is DERIVED — see Ruling BJ at the top of this file — so a consumer that does not exist
   * yet is covered by the act of importing the scanner.
   */
  it("no counter passes `balanceHoles: false` — the pre-merge branch is test-only", () => {
    // Positive control first: a pattern that fires on nothing proves nothing about the files.
    expect(UNBALANCED_CALL.test("const x = literalsIn(expression, false);")).toBe(true);
    expect(UNBALANCED_CALL.test("const x = literalsIn(expression, true);")).toBe(false);

    const covered = guardedFiles().filter((file) => file !== THIS_FILE);
    // Anti-vacuity: the derivation really found the consumers, and they really call the extractor.
    expect(covered.map(label)).toContain("components/v2/page-composition-headings.test.ts");
    expect(covered.some((file) => readSource(file).includes("literalsIn("))).toBe(true);

    const usingFalse = unbalancedCallers(covered);
    expect(
      usingFalse,
      `files calling literalsIn(…, false) outside this test — the merge has been undone:\n${usingFalse
        .map((f) => `  ${f}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});

/**
 * THE TWO ENTRY POINTS, RECONCILED.
 *
 * PR3 reads a `className` with {@link classNameOfTag} — regex-found tag, {@link tagTextAt} to the
 * closing `>`, the extractor for the literals. PR4 reads it with {@link scanJsx}, a brace-balancing
 * walk that builds a parent/child tree. They remain two ENTRY POINTS, because they answer two
 * different questions (one tag at a time vs. the whole element tree); what they no longer are is
 * two EXTRACTORS. Both call {@link literalsIn} with `balanceHoles: true`, so the 22-row
 * disagreement PR4's guard measured is 0.
 *
 * The number did not disappear with it: the population it named — `<div>`s whose className
 * carries a template hole — is still there, so it is pinned directly rather than as a
 * difference between two rules. A new hole-bearing `<div>` moves it exactly as it moved the
 * disagreement count before.
 *
 * 22 -> 25, T-031c Task 7. `/deprem`'s three KAF/DAF/BAFS cards each spelled their border and
 * wash as literal hue classes and are now `border ${FAULT_IDENTITY.<id>.card}`. The population
 * grew because the markup changed shape, not only colour — which is the honest reading, and the
 * alternative would have been to keep a literal class alive to hold a number still.
 */
const TEMPLATE_HOLE_DIVS = 25;

function divSpellings(file: string): { byTag: string[]; byTree: string[] } {
  return {
    byTag: classNamesOf(readSource(file), "div"),
    byTree: jsxElementsOf(file)
      .filter((element) => element.tag === "div")
      .map((element) => (element.spelling ?? NO_CLASSNAME).trim().replace(/\s+/g, " ")),
  };
}

function divSpellingDisagreements(): string[] {
  const rows: string[] = [];
  for (const file of walkCardSurface()) {
    const { byTag, byTree } = divSpellings(file);
    if (byTag.length !== byTree.length) {
      rows.push(`${label(file)} — ${byTag.length} vs ${byTree.length} <div> elements`);
      continue;
    }
    byTag.forEach((spelling, index) => {
      const mine = byTree[index] ?? "";
      if (spelling !== mine) rows.push(`${label(file)} — [${index}] "${spelling}" vs "${mine}"`);
    });
  }
  return rows;
}

describe("the two entry points read every element the same way", () => {
  it("they agree on every div on the surface, template holes INCLUDED", () => {
    // Before T-045 this assertion had to normalise the hole on both sides first, and a second
    // assertion pinned the 22 rows it could not explain. One extractor, no normalisation.
    const rows = divSpellingDisagreements();
    expect(
      rows,
      `classNameOfTag vs scanJsx, every difference:\n${rows.map((row) => `  ${row}`).join("\n")}`,
    ).toEqual([]);
  });

  it("the template-hole population is exactly the recorded number", () => {
    // The rows that USED to be the disagreement, measured directly now that nothing disagrees.
    // Pinned so a new template-hole className is still a visible diff rather than a silent one.
    const holed: string[] = [];
    for (const file of walkCardSurface()) {
      divSpellings(file).byTree.forEach((spelling, index) => {
        if (spelling.includes(HOLE_MARKER)) holed.push(`${label(file)} — [${index}] "${spelling}"`);
      });
    }
    expect(
      holed.length,
      `<div> classNames carrying a template hole:\n${holed.map((row) => `  ${row}`).join("\n")}`,
    ).toBe(TEMPLATE_HOLE_DIVS);
  });

  /**
   * ANTI-VACUITY ON A FIXTURE, not on a live-tree floor.
   *
   * PR4's first version asserted `>1500` `<div>`s on the live surface against 1850 — a floor
   * inside the next adoption task's blast radius, i.e. the same "fails when the next task
   * succeeds" trap the fixture roots exist to avoid. The deterministic half is this: a known
   * source with a known number of `<div>`s, where both entry points must see all of them.
   */
  it("the comparison is not vacuous — both entry points see every div in a known source", () => {
    const source = [
      '<div className="a">',
      '  <div className={cn("b", x)}>',
      "    <span />",
      "    <div />",
      "  </div>",
      "  <div>{items.map((i) => (",
      '    <div key={i} className="c" />',
      "  ))}</div>",
      "</div>",
    ].join("\n");
    const scanned = scanJsx(source).filter((element) => element.tag === "div");
    expect(scanned).toHaveLength(5);
    expect(classNamesOf(source, "div")).toEqual(
      scanned.map((element) => (element.spelling ?? NO_CLASSNAME).trim().replace(/\s+/g, " ")),
    );
  });

  it("the live comparison ran on the real surface at all — a floor no adoption can cross", () => {
    // 1850 `<div>`s today; even deleting every counted card element leaves >1400. 500 is under a
    // third of that, so this can only fail if the walk or the scanner has stopped working.
    const divs = walkCardSurface().flatMap((file) =>
      jsxElementsOf(file).filter((element) => element.tag === "div"),
    );
    expect(divs.length).toBeGreaterThan(500);
  });
});

/* =============================================================================================
 * SPANS, CONTAINMENT AND ATTRIBUTES
 * ========================================================================================== */

/**
 * The position-to-element half of the scanner, pinned HERE rather than in the one counter file
 * that happens to use it today.
 *
 * `ScannedElement.start` / `.end`, {@link innermostElementAt} and `ScannedElement.attributes`
 * arrived with T-035 PR5's FAQ counters and were tested only there. This module has four
 * consumers; a counter file's tests answer for that counter's uses of the API, not for the API —
 * and the attribute walk in particular is now the ONLY one in this module family, so the thing
 * that used to be checked twice by two disagreeing readers must be checked properly once.
 *
 * Two invariants and one relationship:
 *
 *   - pre-order with nesting: every element opens after the previous one and lies inside its
 *     parent's span. That is the premise {@link innermostElementAt} reads when it calls the
 *     containing element with the LARGEST `start` the deepest one;
 *   - `attributes` is the opening tag's own, so a nested element's attributes are its own record;
 *   - `spelling` is DERIVED from `attributes.get("className")` by the one literal extractor, so
 *     the two views of the same attribute cannot drift.
 */
describe("element spans, containment and the attribute walk", () => {
  const SAMPLE = [
    '<section id="sss" aria-labelledby="h" tabIndex={-1} className="shell">',
    '  <h2 id="h" className={cn("title", size)}>t</h2>',
    '  <Explorer panel={<aside className="p">x</aside>} data={basin} hidden />',
    "</section>",
  ].join("\n");

  it("spans nest and arrive in source order, on the real surface", () => {
    for (const file of walkCardSurface()) {
      const elements = jsxElementsOf(file);
      let previous = -1;
      for (const element of elements) {
        expect(element.start, `${label(file)}: elements out of source order`).toBeGreaterThan(
          previous,
        );
        previous = element.start;
        expect(
          element.end,
          `${label(file)}: <${element.tag}> ends before it starts`,
        ).toBeGreaterThan(element.start);
        if (element.parent === null) continue;
        const parent = elements[element.parent]!;
        expect(
          element.start >= parent.start && element.end <= parent.end,
          `${label(file)}: <${element.tag}> is not inside its parent <${parent.tag}>`,
        ).toBe(true);
      }
    }
  });

  it("innermostElementAt answers with the deepest element, and null outside every one", () => {
    const elements = scanJsx(SAMPLE);
    const at = (needle: string) => innermostElementAt(elements, SAMPLE.indexOf(needle));
    expect(elements[at(">t<")!]!.tag).toBe("h2");
    expect(elements[at("tabIndex")!]!.tag).toBe("section");
    expect(innermostElementAt(elements, SAMPLE.length + 10)).toBeNull();
    // An element written inside an attribute expression lives inside its HOLDER'S header, so a
    // position inside it resolves to the prop-borne element rather than to the holder.
    expect(elements[at(">x<")!]!.spelling).toBe("p");
  });

  it("reads every top-level attribute of the opening tag, and only that tag's", () => {
    const elements = scanJsx(SAMPLE);
    const attributesOf = (tag: string) =>
      elements.find((element) => element.tag === tag)!.attributes;
    expect([...attributesOf("section").keys()]).toEqual([
      "id",
      "aria-labelledby",
      "tabIndex",
      "className",
    ]);
    expect(attributesOf("section").get("id")).toBe("sss");
    expect(attributesOf("section").get("tabIndex")).toBe("-1");
    // A hyphenated name is ONE attribute, not a fragment — the rule that makes `aria-labelledby`
    // readable at all, and the rule that stops `data-className` being read as a `className`.
    expect(attributesOf("section").has("aria-labelledby")).toBe(true);
    expect(attributesOf("section").has("labelledby")).toBe(false);
    // The `<h2>`'s own `id` belongs to the `<h2>`; the section does not inherit it.
    expect(attributesOf("h2").get("id")).toBe("h");
    // A braced value is its expression text; a bare attribute is the empty string.
    expect(attributesOf("Explorer").get("data")).toBe("basin");
    expect(attributesOf("Explorer").get("hidden")).toBe("");
    // A className inside a braced prop belongs to the nested element, not to its holder.
    expect(attributesOf("Explorer").has("className")).toBe(false);
    expect(attributesOf("aside").get("className")).toBe("p");
  });

  it("a data-className is not a className — the boundary rule, and its inertness", () => {
    const tricky = '<div data-className="not-a-class" className="real" />';
    const element = scanJsx(tricky)[0]!;
    expect(element.spelling).toBe("real");
    expect([...element.attributes.keys()]).toEqual(["data-className", "className"]);
    // BOTH ENTRY POINTS, because they are two readers of the same text and this is the shape that
    // splits them: `classNameOfTag` searched for the STRING `className=` and so read the tail of
    // `data-className=`. The cross-scanner guard above caught the divergence the moment
    // `readHeader` learned whole names, and the fix was to give both the same boundary rule.
    expect(classNameOfTag(tricky)).toBe("real");
    expect(classNamesOf(tricky, "div")).toEqual([element.spelling]);
    // INERT on today's tree, so the rule is a guard rather than a fix: no element anywhere writes
    // `className` immediately after a name character. Asserted, because an inert rule that nobody
    // checks is how a guard quietly starts mattering.
    //
    // OVER EVERY `.tsx` IN THE REPO, not over a walker. `walkCardSurface()` excludes
    // `components/ui/**`, and `components/ui/breadcrumb.tsx` is one of the files the container and
    // heading counters DO feed to `classNameOfTag` — so a walker-shaped sweep would have declared
    // the rule inert over a population narrower than the one the rule protects. The hazard is a
    // byte in a source file; the sweep is every source file.
    const offenders = walkSources(repoRoot)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => /[A-Za-z0-9_$:.-]className\s*=/.test(maskedSource(file)));
    expect(offenders.map(label)).toEqual([]);
    // Anti-vacuity for the sweep itself: it really visited the excluded directory the narrower
    // walk would have missed.
    const swept = walkSources(repoRoot)
      .filter((file) => file.endsWith(".tsx"))
      .map(label);
    expect(swept).toContain("components/ui/breadcrumb.tsx");
    expect(swept.length).toBeGreaterThan(walkCardSurface().length);
  });

  it("spelling is the className attribute read by the one extractor — never a second reading", () => {
    // THE VALUE RELATION, not merely null-ness. `attributes` records the attribute's own source
    // and `spelling` is what the one extractor makes of it, and the two written forms reduce
    // differently, so the relation is a disjunction rather than an equality:
    //
    //   - `className="a b"` records the CONTENTS `a b`, and the spelling is that string;
    //   - `className={…}` records the EXPRESSION, and the spelling is `literalsIn`'s join of its
    //     literals, or `COMPUTED_CLASSNAME` where it writes none.
    //
    // Asserting only "not null" would pass on a spelling read by some other rule entirely, which
    // is exactly the drift this field exists to make impossible.
    let checked = 0;
    for (const file of walkCardSurface()) {
      for (const element of jsxElementsOf(file)) {
        const written = element.attributes.get("className");
        if (written === undefined) {
          expect(element.spelling, `${label(file)}: <${element.tag}>`).toBeNull();
          continue;
        }
        const literals = literalsIn(written, true);
        const braced = literals.length > 0 ? literals.join(" ") : COMPUTED_CLASSNAME;
        expect(
          element.spelling === written || element.spelling === braced,
          `${label(file)}: <${element.tag}> spelling ${JSON.stringify(
            element.spelling,
          )} is neither the quoted contents nor the extractor's reading of ${JSON.stringify(
            written,
          )}`,
        ).toBe(true);
        checked += 1;
      }
    }
    // The loop really ran over a real population, not over zero elements with a className.
    expect(checked).toBeGreaterThan(1000);
  });
});

/* =============================================================================================
 * THE BINDING RESOLVER
 * ========================================================================================== */

/**
 * The chase and its cycle guard, on a NEUTRAL target.
 *
 * `components/v2/page-composition-cards.test.ts` exercises the same walk against `StatGrid` and
 * `StatTile`, which is where it is load-bearing for a counter. Here it is exercised against
 * `typography.tsx`'s `H1` so the mechanism has a test that does not move when either of those
 * components does — and so the cycle guard, which no counter can reach, has one at all.
 *
 * The two hosts are borrowed PATHS: {@link withInjectedSource} replaces their source entirely for
 * the duration, so nothing here depends on what either file CONTAINS — but both must EXIST, and
 * that is not the same freedom. `resolveSpecifier` answers `null` for a path with no file behind
 * it, so a host that is deleted makes `./<host>` resolve to nothing and the chase silently reads
 * as "no such re-export" — which is the answer three of these controls expect anyway. The hosts
 * were `empty-state.tsx` and `theme-pair.tsx`, both of which T-042 deleted or moved; they are now
 * `breadcrumbs-nav.tsx` and `form-field.tsx`, and the rule is the one PR4 wrote for fixtures one
 * level up: **no control may be hosted on a file a later task in the plan is contracted to
 * remove.**
 */
describe("the binding resolver chases re-exports and terminates on a cycle", () => {
  const TYPOGRAPHY = join(repoRoot, "components/patterns/typography.tsx");
  const outer = join(repoRoot, "components/patterns/breadcrumbs-nav.tsx");
  const middle = join(repoRoot, "components/patterns/form-field.tsx");

  const chase = (
    source: string,
    name: string,
    extra: ReadonlyArray<readonly [string, string]> = [],
  ) =>
    withInjectedSource([[outer, source], ...extra], () =>
      resolvesTo({ file: outer, name }, TYPOGRAPHY, "H1"),
    );

  it("a direct binding short-circuits without reading any source", () => {
    expect(resolvesTo({ file: TYPOGRAPHY, name: "H1" }, TYPOGRAPHY, "H1")).toBe(true);
    expect(resolvesTo({ file: TYPOGRAPHY, name: "H2" }, TYPOGRAPHY, "H1")).toBe(false);
    expect(resolvesTo({ file: TYPOGRAPHY, name: null }, TYPOGRAPHY, "H1")).toBe(false);
  });

  it("follows a plain named re-export, a default re-export and a star re-export", () => {
    expect(chase('export { H1 } from "./typography";\n', "H1")).toBe(true);
    expect(chase('export { H1 as default } from "./typography";\n', "default")).toBe(true);
    expect(chase('export * from "./typography";\n', "H1")).toBe(true);
  });

  it("follows an alias of an alias through two barrels", () => {
    expect(
      chase('export { Heading as H } from "./form-field";\n', "H", [
        [middle, 'export { H1 as Heading } from "./typography";\n'],
      ]),
    ).toBe(true);
  });

  it("does not turn into `anything reachable` — three negative controls", () => {
    // A barrel re-exporting a DIFFERENT symbol of the real module.
    expect(chase('export { H2 } from "./typography";\n', "H2")).toBe(false);
    // A same-named symbol from somewhere else entirely.
    expect(chase('export { H1 } from "./page-hero";\n', "H1")).toBe(false);
    // A barrel exporting nothing relevant.
    expect(chase('export { PageContainer } from "./page-container";\n', "H1")).toBe(false);
  });

  it("terminates on a cycle rather than recursing forever — two barrels re-exporting each other", () => {
    // Legal to write and an infinite walk without the `seen` guard. Asserted here because no
    // counter can reach this shape, so nothing else would ever execute the guard.
    expect(
      chase('export { H1 } from "./form-field";\n', "H1", [
        [middle, 'export { H1 } from "./breadcrumbs-nav";\n'],
      ]),
    ).toBe(false);
  });

  it("the injection really was temporary — the borrowed path resolves nothing once it is gone", () => {
    expect(resolvesTo({ file: outer, name: "H1" }, TYPOGRAPHY, "H1")).toBe(false);
  });

  it("reexportTargetsOf drops `export type` members — they compile to nothing", () => {
    const targets = withInjectedSource(
      [[outer, 'export { type H1Props, H1 } from "./typography";\n']],
      () => reexportTargetsOf(outer, "H1").map((node) => label(node.file)),
    );
    expect(targets).toEqual(["components/patterns/typography.tsx"]);
  });

  it("importBindingsOf folds `as` aliases away and drops `import type` — on a real file", () => {
    // `lib/auth/submit.client.ts` writes `import type { AuthBffCode } from "./transport.server"`
    // and nothing else from it — the live fixture `components/patterns/rsc-boundary.test.ts`
    // depends on too.
    const submit = join(repoRoot, "lib/auth/submit.client.ts");
    expect([...importBindingsOf(submit).keys()]).not.toContain("AuthBffCode");

    const bindings = withInjectedSource(
      [[outer, 'import { H1 as Heading } from "./typography";\n']],
      () => importBindingsOf(outer),
    );
    expect(bindings.get("Heading")).toEqual({ file: TYPOGRAPHY, name: "H1" });
  });

  it("declarationRegions isolates one declaration inside a multi-export module", () => {
    const regions = declarationRegions(TYPOGRAPHY);
    const source = readSource(TYPOGRAPHY);
    const [h1From, h1To] = regions.get("H1")!;
    const [h2From, h2To] = regions.get("H2")!;
    expect(source.slice(h1From, h1To)).toContain("<h1");
    expect(source.slice(h2From, h2To)).not.toContain("<h1");
  });
});

/* =============================================================================================
 * THE INJECTION HARNESS
 * ========================================================================================== */

/**
 * CACHE REGISTRATION, AND THE PROOF THAT FORGETTING ONE IS NO LONGER POSSIBLE.
 *
 * `withInjectedSource` used to name its caches by hand — six of them, in two places. PR4 added a
 * seventh and had to REMEMBER both places. It did; that is not a guarantee for the next one. A
 * memo added without the matching line would serve analysis of the file ON DISK to every injected
 * test, and every such test would pass while measuring the wrong thing.
 *
 * Three assertions close that, in the only order that actually works:
 *
 *   1. the harness invalidates EVERY registered cache, whatever is in the register — so a cache
 *      created through the factory is covered the moment it exists, with no second edit;
 *   2. an UNregistered memo demonstrably survives injection — the hazard, named rather than
 *      assumed, so the next reader knows what the factory buys;
 *   3. no module-scope cache in any of the four files is built any other way — so the escape
 *      hatch from (1) into (2) fails the suite instead of passing quietly.
 */
describe("the injection harness invalidates every registered cache", () => {
  it("a per-file cache created through the factory is invalidated without a second edit", () => {
    const probe = perFileCache<string>();
    probe.set(CARD_FIXTURE, "stale");
    probe.set("/some/other/file.tsx", "untouched");

    const inside = withInjectedSource([[CARD_FIXTURE, "<div />"]], () => ({
      touched: probe.get(CARD_FIXTURE),
      other: probe.get("/some/other/file.tsx"),
    }));
    expect(inside.touched, "the overridden file's entry must be gone").toBeUndefined();
    expect(
      inside.other,
      "an untouched file's entry must survive — that is the point of per-file",
    ).toBe("untouched");
  });

  it("a graph cache created through the factory is dropped IN FULL", () => {
    const probe = graphCache<string>();
    probe.set("anything", "stale");
    expect(withInjectedSource([[CARD_FIXTURE, "<div />"]], () => probe.size)).toBe(0);
  });

  it("every registered cache is reached — asserted over the register, not over a written list", () => {
    const { perFile, graph } = registeredCaches();
    expect(perFile.length + graph.length).toBeGreaterThan(3);
    for (const cache of perFile) cache.set(CARD_FIXTURE, "stale" as never);
    for (const cache of graph) cache.set(CARD_FIXTURE, "stale" as never);
    withInjectedSource([[CARD_FIXTURE, "<div />"]], () => {
      for (const cache of perFile) expect(cache.get(CARD_FIXTURE)).toBeUndefined();
      for (const cache of graph) expect(cache.size).toBe(0);
    });
  });

  it("an UNREGISTERED memo survives injection — the hazard the factory removes", () => {
    // Not a defence of the escape hatch: this is what the source guard below forbids, asserted so
    // the cost of forgetting is a measured fact rather than a warning in a docblock.
    const unregistered = new Map<string, string>();
    unregistered.set(CARD_FIXTURE, "stale");
    expect(
      withInjectedSource([[CARD_FIXTURE, "<div />"]], () => unregistered.get(CARD_FIXTURE)),
    ).toBe("stale");
  });

  /**
   * Comments stripped before the grep, the rule this repo has arrived at four separate times. No
   * line number is derived from the stripped text (T-043) — the message names the file and the
   * identifier, which is what a reader needs to find it.
   */
  it("no module-scope cache is built outside the two factories", () => {
    const covered = guardedFiles();
    // Anti-vacuity: the derivation really found the module and its consumers.
    expect(covered.map(label)).toContain("lib/test-support/composition-scan.ts");
    expect(covered.map(label)).toContain("components/v2/page-composition-cards.test.ts");

    const offenders = unregisteredCaches(covered);
    expect(
      offenders,
      `caches the injection harness cannot see:\n${offenders.map((row) => `  ${row}`).join("\n")}`,
    ).toEqual([]);
  });

  /**
   * RULING BJ, PINNED ON A FIXTURE — the derivation itself, not just its output today.
   *
   * Review reproduced the written list's hole by adding a FIFTH consumer, so the fifth consumer is
   * what this drives: a file that imports the scanner is in scope and both guards fire on it; a
   * file that imports something else is out of scope however it uses the name. The path does not
   * exist on disk and {@link withInjectedSource} supplies its source, so the real derivation, the
   * real classifier and both real guard functions execute — nothing here is a re-implementation of
   * the rule it is checking.
   */
  it("the guarded population is DERIVED from the import — a fifth consumer is covered by arriving", () => {
    const FIFTH = join(repoRoot, "components/v2/page-composition-fifth.test.ts");
    const importsScanner = 'import { literalsIn } from "@/lib/test-support/composition-scan";\n';
    const offending = `${importsScanner}const memo = new Map<string, string>();\nconst x = literalsIn(e, false);\n`;
    const clean = `${importsScanner}const x = literalsIn(e, true);\n`;
    // Same two offences, but it imports something else entirely — out of scope by derivation.
    const unrelated = `import { stripComments } from "@/lib/test-support/strip-comments";\nconst memo = new Map<string, string>();\nconst x = literalsIn(e, false);\n`;

    // The classifier: membership follows the import, and nothing else.
    expect(withInjectedSource([[FIFTH, offending]], () => importsScannerModule(FIFTH))).toBe(true);
    expect(withInjectedSource([[FIFTH, clean]], () => importsScannerModule(FIFTH))).toBe(true);
    expect(withInjectedSource([[FIFTH, unrelated]], () => importsScannerModule(FIFTH))).toBe(false);

    // Both guards fire on the fifth file — the case that was green before Ruling BJ.
    expect(withInjectedSource([[FIFTH, offending]], () => unbalancedCallers([FIFTH]))).toEqual([
      "components/v2/page-composition-fifth.test.ts",
    ]);
    expect(withInjectedSource([[FIFTH, offending]], () => unregisteredCaches([FIFTH]))).toEqual([
      "components/v2/page-composition-fifth.test.ts — memo = new Map(): use perFileCache() or graphCache()",
    ]);

    // …and neither fires on a consumer that behaves.
    expect(withInjectedSource([[FIFTH, clean]], () => unbalancedCallers([FIFTH]))).toEqual([]);
    expect(withInjectedSource([[FIFTH, clean]], () => unregisteredCaches([FIFTH]))).toEqual([]);

    // Both guards read through `readSource`, so a docblock quoting the offence is prose — the rule
    // this repo has arrived at four separate times, asserted rather than inherited silently now
    // that the stripping is implicit in the reader rather than a call at the grep site.
    const inProse = `${importsScanner}/** const memo = new Map(); literalsIn(e, false) */\nconst x = literalsIn(e, true);\n`;
    expect(withInjectedSource([[FIFTH, inProse]], () => unbalancedCallers([FIFTH]))).toEqual([]);
    expect(withInjectedSource([[FIFTH, inProse]], () => unregisteredCaches([FIFTH]))).toEqual([]);

    // The fixture path is synthetic and the real walk never sees it, so nothing here can leak
    // into the live population above.
    expect(guardedFiles()).not.toContain(FIFTH);
  });

  it("the injected source really reaches the scanners — end to end, through the caches", () => {
    const spelling = withInjectedSource(
      [[CARD_FIXTURE, '<div className="rounded-2xl bg-card" />']],
      () => jsxElementsOf(CARD_FIXTURE)[0]!.spelling,
    );
    expect(spelling).toBe("rounded-2xl bg-card");
    // …and it is gone again afterwards: the fixture path holds no file, so reading it now throws.
    expect(() => jsxElementsOf(CARD_FIXTURE)).toThrow();
  });

  it("maskedSource blanks literal CONTENTS while preserving every index", () => {
    const masked = withInjectedSource(
      [[CARD_FIXTURE, 'const USAGE = "<V2Hero />";\nconst real = 1;\n']],
      () => maskedSource(CARD_FIXTURE),
    );
    expect(masked).not.toContain("V2Hero");
    expect(masked).toContain("const USAGE");
    expect(masked).toHaveLength('const USAGE = "<V2Hero />";\nconst real = 1;\n'.length);
  });
});
