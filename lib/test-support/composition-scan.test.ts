import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
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
   * executable. If a counter ever reaches for it the merge has been undone, so the escape hatch is
   * pinned to this file by name.
   */
  it("no counter passes `balanceHoles: false` — the pre-merge branch is test-only", () => {
    const UNBALANCED_CALL = /literalsIn\([^()]*,\s*false\s*\)/;
    // Positive control first: a pattern that fires on nothing proves nothing about the files.
    expect(UNBALANCED_CALL.test("const x = literalsIn(expression, false);")).toBe(true);
    expect(UNBALANCED_CALL.test("const x = literalsIn(expression, true);")).toBe(false);

    const callers = [
      "lib/test-support/composition-scan.ts",
      "components/v2/page-composition-containers.test.ts",
      "components/v2/page-composition-headings.test.ts",
      "components/v2/page-composition-cards.test.ts",
    ];
    const sources = callers.map(
      (file) => [file, stripComments(readFileSync(join(repoRoot, file), "utf8"))] as const,
    );
    // Anti-vacuity: the files really were read and really do call the extractor.
    expect(sources.filter(([, source]) => source.includes("literalsIn(")).length).toBeGreaterThan(
      0,
    );

    const usingFalse = sources
      .filter(([, source]) => UNBALANCED_CALL.test(source))
      .map(([file]) => file);
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
 * The number 22 did not disappear with it: the population it named — `<div>`s whose className
 * carries a template hole — is still there and still 22, so it is pinned directly rather than as a
 * difference between two rules. A new hole-bearing `<div>` moves it exactly as it moved the
 * disagreement count before.
 */
const TEMPLATE_HOLE_DIVS = 22;

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
    // The 22 that USED to be the disagreement, measured directly now that nothing disagrees.
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
 * the duration, so nothing here depends on what either file contains.
 */
describe("the binding resolver chases re-exports and terminates on a cycle", () => {
  const TYPOGRAPHY = join(repoRoot, "components/patterns/typography.tsx");
  const outer = join(repoRoot, "components/patterns/empty-state.tsx");
  const middle = join(repoRoot, "components/patterns/theme-pair.tsx");

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
      chase('export { Heading as H } from "./theme-pair";\n', "H", [
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
    expect(chase('export { Callout } from "./callout";\n', "H1")).toBe(false);
  });

  it("terminates on a cycle rather than recursing forever — two barrels re-exporting each other", () => {
    // Legal to write and an infinite walk without the `seen` guard. Asserted here because no
    // counter can reach this shape, so nothing else would ever execute the guard.
    expect(
      chase('export { H1 } from "./theme-pair";\n', "H1", [
        [middle, 'export { H1 } from "./empty-state";\n'],
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
    const FILES = [
      "lib/test-support/composition-scan.ts",
      "components/v2/page-composition-containers.test.ts",
      "components/v2/page-composition-headings.test.ts",
      "components/v2/page-composition-cards.test.ts",
    ];
    /** Module-scope `const X … = new Map…`, which is what an unregistered memo looks like. */
    const DECLARED_MAP = /^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::[^=\n]*)?=\s*new\s+Map\b/gm;
    /** Anything whose name says cache, whatever it is assigned. */
    const DECLARED_CACHE =
      /^(?:export\s+)?const\s+([A-Za-z0-9_$]*[Cc]ache[A-Za-z0-9_$]*)\s*(?::[^=\n]*)?=\s*([A-Za-z0-9_$]+)/gm;
    /** Module-scope Maps that are fixtures, not memos. A new one has to be argued for here. */
    const NOT_A_CACHE = new Set(["STAT_GRID_BINDING"]);

    const offenders: string[] = [];
    for (const file of FILES) {
      const source = stripComments(readFileSync(join(repoRoot, file), "utf8"));
      for (const match of source.matchAll(DECLARED_MAP)) {
        const name = match[1]!;
        if (!NOT_A_CACHE.has(name)) {
          offenders.push(`${file} — ${name} = new Map(): use perFileCache() or graphCache()`);
        }
      }
      for (const match of source.matchAll(DECLARED_CACHE)) {
        const factory = match[2]!;
        if (factory !== "perFileCache" && factory !== "graphCache") {
          offenders.push(`${file} — ${match[1]!} = ${factory}(…): not a registered cache`);
        }
      }
    }
    expect(
      offenders,
      `caches the injection harness cannot see:\n${offenders.map((row) => `  ${row}`).join("\n")}`,
    ).toEqual([]);
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
