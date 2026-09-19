import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PM25_NOTICE_SLOTS } from "@/lib/air/notice-keys";
import { gatesGoverning, ungatedRenderSite } from "@/lib/testing/jsx-gate";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * This repo's vitest environment is `node` and the section is an async server component, so
 * it cannot be RENDERED here. The honest guard at this level is the source symbol, scoped
 * tightly to the obligations that must not silently disappear from these three files.
 *
 * Every assertion below is about STRUCTURE — a licence obligation, a gate, an a11y
 * attribute, a ruled absence. None is about a fact or a wording choice.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * Source with COMMENTS REMOVED.
 *
 * Every "this string must be absent" assertion below runs against this, and the reason is a
 * mistake this file made on its first CI run: the docblocks explain WHY there is no
 * `nofollow`, no `"use client"` and no `--color-taupe` — so they contain those very words,
 * and five absence checks failed on the prose that documents the rule they enforce. Prose
 * about a rule is not the rule. JSX comments (`{/* … *\/}`) are block comments, so the same
 * strip covers them.
 *
 * The strip is the shared scanner, not a pair of `String.replace` calls: `docs/conventions.md`.
 */
const code = stripComments;

/**
 * THE HOISTED TAILWIND CLASS CONSTANTS, WITH THEIR CLASS STRINGS BLANKED.
 *
 * Used by the guideline scan below, which reads bare numbers as candidate concentrations.
 * Until T-033 every presentation constant lived in `air-pollution.module.css`, so the only
 * numbers in `pm25-chart.tsx` were geometry and that scan could read the file whole. The
 * conversion moved stroke widths, ink alphas and font sizes into class strings, and counting
 * those would have forced the allow-list open to `15`, `1` and `0.6` — `15` being a plausible
 * PM2.5 interim target, i.e. exactly the value the scan exists to stop.
 *
 * THE FIRST ATTEMPT AT THIS STRIPPED EVERY STRING LITERAL IN THE FILE, AND THAT WAS A NET
 * LOSS. A number in a CLASS string cannot place a line; a number in an ATTRIBUTE string can,
 * and blanking those hid `<path d="M 60 15 L 700 15" />` — a WHO guideline at 5 µg/m³ drawn on
 * the truncated axis, the precise thing the scan exists to stop — with the suite fully green.
 * `<polyline points="60,15 …">`, `<line y1="15">` and `transform="translate(0 15)"` went the
 * same way, and the `<line\b` count pin catches only the third of those spellings.
 *
 * So the strip is surgical on THREE axes, each closing a hole the previous version left open:
 *
 *  1. ONLY `const NAME = …;` declarations at the top level. Everything else in the file — every
 *     attribute, every JSX expression — is scanned whole.
 *  2. Inside them, only the quoted strings. A hoisted `const THRESHOLD = 15;` keeps its number,
 *     because the number is not in a string.
 *  3. And only strings that are CLASS-SHAPED. Hoisting a constant in SCREAMING_CASE is this
 *     file's own convention, so `const GUIDE_PATH = "M 60 15 L 700 15";` with
 *     `<path d={GUIDE_PATH} />` is the spelling an author adding a guideline would actually
 *     reach for — and rules 1 and 2 alone blanked it. `const GUIDE_POINTS = "60,15 700,15";`
 *     went the same way. Both are controls below.
 *
 * CLASS-SHAPED means every whitespace-separated token carries a letter and is longer than one
 * character. That admits all six of the chart's real class strings, including `p-1`,
 * `[stroke-width:0.6]` and the `${AXIS}` template halves, and rejects `"M 60 15 L 700 15"` (the
 * lone `M`), `"60,15 700,15"` (no letters) and `"translate(0 15)"` (the trailing `15)`).
 *
 * THE PREDICATE IS A HEURISTIC AND IT FAILS CLOSED, DELIBERATELY. It is not a Tailwind parser
 * and cannot be one; it is a cheap question — "could this string be a coordinate?" — answered
 * conservatively. A legitimate class string that is one short token, or that carries a bare
 * number as a token, will NOT be blanked, its numbers will reach the scan, and this test will
 * red naming them. That is the intended direction: a false red costs one reader one minute and
 * is resolved by re-spelling the class or justifying the number in the allow-list, whereas a
 * false green ships a WHO reference line onto 81 province pages against a ruling that was made
 * twice. If you are here because of such a red, this paragraph is the answer: it is working.
 *
 * Every control below runs through THIS function rather than re-spelling it, so editing the
 * strip cannot leave the controls passing on a scan that no longer exists.
 */
function stripHoistedClassStrings(source: string): string {
  /** Could this string be a coordinate list rather than a class list? See the docblock. */
  const isClassShaped = (literal: string): boolean => {
    const body = literal.slice(1, -1).trim();
    if (body === "") return false;
    return body.split(/\s+/).every((token) => /[A-Za-z]/.test(token) && token.length > 1);
  };
  return source.replace(/^const [A-Z][A-Z0-9_]* =[\s\S]*?;$/gm, (declaration) =>
    declaration.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, (literal) =>
      isClassShaped(literal) ? '""' : literal,
    ),
  );
}

/** The numbers a source carries outside the allow-list — the guideline scan, as a function. */
function unexplainedNumbers(source: string): string[] {
  const scanned = stripHoistedClassStrings(source);
  return (scanned.match(/(?<![\w.-])\d+(?:\.\d+)?(?![\w.])/g) ?? []).filter(
    (n) => !["2.8", "4", "6", "20", "0"].includes(n),
  );
}

/**
 * SVG tags this chart has no business drawing.
 *
 * The number scan above asks "is there a bare number?". The question it is standing in for is
 * "is there a horizontal line?", and those two come apart. Three ways past the number scan were
 * found that never write a bare numeric literal at all:
 *
 *   - `const GUIDE = "fill-ink/80 [x:60px] [y:15px] [width:640px] [height:1px]"` on a `<rect/>`;
 *   - `const GUIDE = "stroke-ink/80 [d:path('M_60_15_L_700_15')]"` on a `<path/>`;
 *   - `<rect y={20 - 20 / 4} height={4} />` — arithmetic over allow-listed numbers, since
 *     20 − 20/4 is 15.
 *
 * The first two are class-shaped by construction, so `stripHoistedClassStrings` blanks them and
 * is RIGHT to: they are perfectly ordinary Tailwind. They render, too — SVG2 makes `x`, `y`,
 * `width`, `height` and `d` real CSS properties, and headless Chromium gives that rect a
 * bounding box of 640×1 at y=15, i.e. the WHO AQG level on the truncated axis.
 *
 * **The third one does not involve the strip at all.** Its mechanism is the ALLOW-LIST, which
 * predates T-033 and which this branch never widened: `20` and `4` were already explained
 * numbers, and no scan that filters by value can see that subtracting one from the other lands
 * on a threshold. So this assertion closes a pre-existing gap rather than one the conversion
 * opened — worth saying, so a later reader does not go looking for the regression that let it in.
 *
 * Hence a SHAPE question beside the number question, in the same idiom as the `<line\b` count
 * pin: the chart legitimately draws `<line>`, `<polyline>`, `<circle>` and `<text>` and nothing
 * else, every one of the three attacks needs a tag outside that set, and a tag cannot be
 * arithmetic'd into existence. A chart that genuinely needs one of these is a chart whose
 * "no reference line" ruling should be re-read first (DEC 2026-08-20d md.1/md.2), which is the
 * conversation this red is meant to start.
 */
function unexpectedShapeTags(source: string): string[] {
  return source.match(/<(?:rect|path|polygon|image)\b/g) ?? [];
}

/** Whether a source reaches a CSS Module at all — shared with its own controls, same reason. */
function looksUpAModuleClass(source: string): boolean {
  return /\.module\.css/.test(source) || /styles\./.test(source);
}

/**
 * The JSX each `className="climate-dark-scope"` wrapper in `page.tsx` encloses, found by
 * counting `<div` against `</div>` from the wrapper's own close bracket.
 */
function climateDarkScopeSubtrees(page: string): string[] {
  const subtrees: string[] = [];
  const marker = /className="climate-dark-scope"/g;
  for (let hit = marker.exec(page); hit !== null; hit = marker.exec(page)) {
    const start = page.indexOf(">", hit.index) + 1;
    let cursor = start;
    let depth = 1;
    while (depth > 0) {
      const open = page.indexOf("<div", cursor);
      const close = page.indexOf("</div>", cursor);
      if (close === -1) break;
      if (open !== -1 && open < close) {
        depth += 1;
        cursor = open + "<div".length;
      } else {
        depth -= 1;
        cursor = close + "</div>".length;
      }
    }
    subtrees.push(page.slice(start, cursor));
  }
  return subtrees;
}

const section = read("./air-pollution-section.tsx");
const chart = read("./pm25-chart.tsx");
const table = read("./pm25-table.tsx");
const page = read("../../app/[locale]/(site)/turkiye/[slug]/page.tsx");
const sectionCode = code(section);
const chartCode = code(chart);
const tableCode = code(table);
const pageCode = code(page);

describe("the licence block travels with the values", () => {
  it("prints the provider's caveat FROM THE PAYLOAD, with no copy in this repo", () => {
    expect(section).toMatch(/attribution\.methodNoticeText/);
    expect(sectionCode).not.toContain("primarily intended to aid");
  });

  it('marks THE CAVEAT ITSELF `lang="en"`, not merely something on the page', () => {
    // Asserting `lang="en"` appears somewhere in the file would keep passing if the
    // attribute migrated to the Turkish intro paragraph and the English caveat lost it —
    // the exact failure the attribute prevents (a screen reader on the TR page reading
    // English with Turkish phonemes, WCAG 3.1.2).
    expect(section).toMatch(/lang="en"[\s\S]{0,120}attribution\.methodNoticeText/);
  });

  it("keeps the Turkish explanation ALONGSIDE the caveat, never instead of it", () => {
    expect(section).toMatch(/noticeIntro/);
    expect(section).toMatch(/notice\.gridResolution/);
  });

  it("prints every attribution element the licence names", () => {
    for (const field of [
      "providerName",
      "workTitle",
      "licenceName",
      "licenceUrl",
      "datasetUrl",
      "referenceCitation",
      "referenceUrl",
    ]) {
      expect(section).toContain(`attribution.${field}`);
    }
  });

  it("links the citations as editorial references, never `nofollow`", () => {
    // `nofollow` is for untrusted / paid / UGC links; using it on a real attribution would
    // understate it (SEO-POLICY §B8, the climate source line's own reasoning).
    expect(sectionCode).not.toContain("nofollow");
    expect(sectionCode).toMatch(/rel="noopener noreferrer"/);
  });
});

/**
 * THE CAVEATS THEMSELVES, not just their catalogue entries (→ PR #76 review TEST76-I1).
 *
 * The catalogue tests pin that each notice string EXISTS in both locales; none of them pins
 * that a component ever PRINTS it. Before this block, three of the four render sites had no
 * assertion at all, so deleting the pair under the value line — a plausible
 * `CONTENT-STYLE.md` §7 "caveat pile" tidy-up, since the section's own docblock frames
 * placement as an editorial judgement — left 124 test files, `tsc`, `eslint` and the build
 * green while 81 indexable pages lost the sentence saying the number is not a provincial
 * average (DEC 2026-08-19d md.1).
 *
 * Structural, and it loops over the whitelist the code already exports rather than a list
 * written here, so a fifth slot arrives with its own render assertion for free.
 */
describe("every notice slot the code can render is actually rendered", () => {
  it.each(PM25_NOTICE_SLOTS)("prints notice.%s somewhere in the section", (slot) => {
    // `sectionCode`, not `section`: the docblock NAMES two of these keys while explaining
    // where they go, so the raw source would satisfy this on prose alone.
    expect(sectionCode).toContain(`notice.${slot}`);
  });

  it("POSITIVE CONTROL — the same check reports a slot the section does not render", () => {
    // Without this, a source that stopped printing every notice would still pass if the
    // substring happened to appear for another reason. The fabricated slot is held here and
    // written into no file this suite measures.
    expect(sectionCode).not.toContain("notice.aSlotTheSectionNeverPrints");
  });
});

describe("the section is gated on the payload, in both directions", () => {
  it("renders only when the api published a series", () => {
    /**
     * This pinned the V1 spelling `{pm25Annual !== null && (<AirPollutionSection`. The V2 page
     * renders the air-quality and marine sections from ONE three-branch ternary, so the section
     * has two render sites and neither is written `&&`. The invariant is unchanged; only the
     * expression is. Asserted as the property — every render site is governed by the payload —
     * rather than as the shape (`lib/testing/jsx-gate.ts`).
     */
    expect(gatesGoverning(pageCode, "<AirPollutionSection").length).toBeGreaterThan(0);
    expect(ungatedRenderSite(pageCode, "<AirPollutionSection", "pm25Annual")).toBeNull();
  });

  it("cites the source in Kaynaklar only when the section renders", () => {
    // A source cited for content that is not on the page is the UX-tour B5 defect.
    //
    // V1 built a per-page `extraSources` list and pushed a string onto it. V2 renders a
    // bibliography component whose `turkiye` scope already carries the PM2.5 source for every
    // province, so the same defect appears as an OMISSION rather than a push: the province
    // drops the citation when it has no series to show. Same guarantee, opposite mechanic —
    // and the V2 rewrite had neither until T-032 PR3, which is what this assertion now pins.
    // The prop is a spread of per-source clauses since `era5` gained the counterpart it
    // never had (the climate block renders on no English province page while ERA5-Land was
    // cited on all 81). This assertion owns the PM2.5 clause and nothing else, so a third
    // conditional source cannot break it.
    expect(pageCode).toMatch(/\.\.\.\(pm25Annual \? \[\] : \["acag-pm25"\]\)/);
  });

  /**
   * THE PM2.5 STRUCTURED-DATA NODE, AND WHY THE NEXT FOUR TESTS ARE CONDITIONAL.
   *
   * V1's province page pushed a `PropertyValue` for the PM2.5 reading onto `additionalProperty`,
   * under a gate that is subtler than it looks: not `pm25Annual !== null`, but ALSO the notice
   * flag, because the node's name says "il merkezi hücresi" and those words appear on the page
   * only inside `notice.provinceCentrePoint`. Four rules hang off that node — the gate, the
   * label, the rounding, the absent `unitCode`.
   *
   * The V2 rewrite emits NO PM2.5 node at all. `additionalProperty` carries plate code, area,
   * district count, density and elevation, and stops. So all four rules are vacuously satisfied,
   * and the tempting repairs are both bad: deleting them throws away the reasoning that produced
   * them, and rewriting them against a node that does not exist asserts nothing.
   *
   * They are kept as a CONDITIONAL contract instead. Each one says: if the node is here, it obeys
   * this rule; if it is not, then it is properly absent and no partial version has leaked in. The
   * day someone re-adds PM2.5 structured data to V2, all four rules bind again on the spot
   * instead of having to be remembered — which is the whole reason they were written down.
   */
  const PM25_NODE_GATE = /if \(pm25Annual !== null && pm25ShowsCentreNotice\) \{([\s\S]*?)\n {2}\}/;
  const pm25NodeBranch = PM25_NODE_GATE.exec(pageCode)?.[1] ?? null;

  /**
   * "Absent" must mean absent, not "renamed". A node re-added under a different gate, or a
   * half-migrated one that keeps the label helper, would otherwise slip through every `if
   * (branch === null) return` below.
   */
  const expectNoPm25StructuredData = () => {
    const flatPage = pageCode.replace(/\s+/g, " ");
    expect(
      flatPage,
      "additionalProperty carries a PM2.5 node under an unrecognised gate",
    ).not.toMatch(/additionalProperty\.push\(\{[^}]*pm25/i);
    expect(pageCode, "PM2.5 JSON-LD label helper is used with no node to name").not.toContain(
      "jsonLdLabel",
    );
  };

  it("adds the JSON-LD PropertyValue only when the QUALIFYING NOTICE renders", () => {
    // SEO-POLICY §B5 5.7/5.8: structured data may not carry what the page does not show,
    // and a null field is never filled in. The node's name carries "il merkezi hücresi" /
    // "province-centre cell", and those words are on a province page ONLY inside
    // `notice.provinceCentrePoint` — a sentence the api gates through `noticeKeys`,
    // independently of `pm25Annual !== null`. So the node is gated on that same flag and
    // DROPS when the sentence does not render (→ PR #76 review FENER76R2-I1 + CODE76R2-I1).
    if (pm25NodeBranch === null) {
      expectNoPm25StructuredData();
      return;
    }
    // Whitespace-normalised rather than pattern-matched line by line: the assertion is about
    // which expression the gate is, not about how Prettier wrapped it.
    const flatPage = pageCode.replace(/\s+/g, " ");
    expect(flatPage).toContain(
      "const pm25ShowsCentreNotice = pm25Annual !== null && " +
        "pm25NoticeFlags(pm25Annual.attribution.noticeKeys).provinceCentrePoint;",
    );
  });

  it("names the node with the reading-point label, never the bare value label", () => {
    // FENER76-I1: `additionalProperty` describes the ENTITY, so a node named with the visible
    // `valueLabel` asserts a provincial average — the reading DEC 2026-08-19d md.1 rejected —
    // and a `PropertyValue` travels without the caveat printed beneath it.
    if (pm25NodeBranch === null) {
      expectNoPm25StructuredData();
      return;
    }
    // Bound by IDENTITY, not by position: an absence check ("no `valueLabel` here") reports
    // clean for free if the capture read some other block, so the capture states which block
    // it is before asserting anything about it (→ PR #76 review FENER76R2-M3).
    expect(pm25NodeBranch).toContain("additionalProperty.push");
    expect(pm25NodeBranch).toContain('tAir("jsonLdLabel"');
    expect(pm25NodeBranch).not.toContain('tAir("valueLabel"');
  });

  it("puts the SAME rounded number in the structured data as on the page", () => {
    // The section half of this holds whatever the page does: the visible figure is rounded in
    // one place, by one helper, and that is what the structured data would have to match.
    expect(section).toMatch(/roundPm25\(pm25\.latestValueUgM3\)/);
    if (pm25NodeBranch === null) {
      expectNoPm25StructuredData();
      return;
    }
    expect(pageCode).toMatch(/value: roundPm25\(pm25Annual\.latestValueUgM3\)/);
  });

  it("emits no unitCode — the UN/CEFACT code for µg/m³ is unverified", () => {
    // Scoped to the PM2.5 branch: `unitCode` is correct on the km²/°C/mm properties beside
    // it, so a whole-file check would say nothing.
    if (pm25NodeBranch === null) {
      expectNoPm25StructuredData();
      return;
    }
    expect(pm25NodeBranch).toContain("additionalProperty.push");
    expect(pm25NodeBranch).toContain("unitText");
    expect(pm25NodeBranch).not.toContain("unitCode");
  });
});

describe("the chart carries no reference line and no index colouring", () => {
  it("draws no horizontal guideline (→ DEC 2026-08-20d md.1/md.2)", () => {
    // Searched by what such a line WOULD BE, not by a name it might carry. A guideline is a
    // rule drawn at a constant concentration, so it needs two things this source must not
    // have: a `<line>` element beyond the two documented gridline families, and a bare
    // numeric threshold to place it at. Both are checked structurally.
    const lineElements = chartCode.match(/<line\b/g) ?? [];
    expect(lineElements).toHaveLength(2);
    // …and no tag outside the four this chart draws. `unexpectedShapeTags` carries the three
    // attacks this closes and why the number scan below cannot see any of them.
    expect(unexpectedShapeTags(chartCode)).toEqual([]);
    // No constant concentration anywhere in the chart — the AQG level or any of the four
    // interim targets would appear as one. Coordinates come from the scale module and the
    // marker radius is the only literal the chart owns. Everything but the hoisted class
    // constants is scanned, `stripHoistedClassStrings` says why, and the four controls below
    // are what stop that narrowing from becoming a hole.
    expect(unexplainedNumbers(chartCode)).toEqual([]);
    expect(chartCode).not.toMatch(/whoGuideline/);
  });

  /**
   * FOUR CONTROLS ON THE SCAN ABOVE, EACH A GUIDELINE SPELLED A DIFFERENT WAY.
   *
   * Every one runs through `unexplainedNumbers`, not through a re-spelled copy of its regex,
   * so an edit to the scan reds these instead of leaving them green on maths that no longer
   * runs. Cases 2-4 are the ones an earlier, broader strip let through with the suite green.
   */
  it.each([
    [
      "a coordinate in a JSX expression",
      'const GUIDE = "stroke-ink/15";\n<line y1={15} y2={15} />',
    ],
    [
      "a path `d` attribute",
      'const GRID = "stroke-ink/15";\n<path className={GRID} d="M 60 15 L 700 15" />',
    ],
    ["a polyline `points` attribute", '<polyline points="60,15 700,15" />'],
    [
      "a hoisted numeric threshold",
      "const THRESHOLD = 15;\n<line y1={THRESHOLD} y2={THRESHOLD} />",
    ],
    [
      "a hoisted path `d`, this file's own SCREAMING_CASE convention",
      'const GUIDE_PATH = "M 60 15 L 700 15";\n<path className={GRID} d={GUIDE_PATH} />',
    ],
    [
      "a hoisted `points` list, the same convention",
      'const GUIDE_POINTS = "60,15 700,15";\n<polyline className={GRID} points={GUIDE_POINTS} />',
    ],
  ])("POSITIVE CONTROL — the scan rejects a guideline written as %s", (_label, poisoned) => {
    expect(unexplainedNumbers(poisoned)).toContain("15");
  });

  it.each([
    [
      "an SVG2 geometry rect, entirely in class-shaped Tailwind",
      'const GUIDE = "fill-ink/80 [x:60px] [y:15px] [width:640px] [height:1px]";\n<rect className={GUIDE} />',
    ],
    [
      "an SVG2 `d:path()` on a <path>, same trick",
      "const GUIDE = \"stroke-ink/80 [d:path('M_60_15_L_700_15')]\";\n<path className={GUIDE} />",
    ],
    [
      "arithmetic over allow-listed numbers and no string at all",
      "<rect y={20 - 20 / 4} height={4} />",
    ],
  ])("POSITIVE CONTROL — the shape scan rejects a guideline drawn as %s", (_label, poisoned) => {
    // Deliberately asserted on the SHAPE scan, not the number scan: all three of these are
    // invisible to `unexplainedNumbers` by construction, which is the whole reason the tag
    // assertion exists. A control that passed through the number scan would be claiming a
    // coverage this file does not have.
    expect(unexplainedNumbers(poisoned)).not.toContain("15");
    expect(unexpectedShapeTags(poisoned)).not.toEqual([]);
  });

  it("NEGATIVE CONTROL — the shape scan clears the four tags the chart really draws", () => {
    // Anti-vacuity for the assertion above: a regex that matched nothing would agree with the
    // real chart just as happily. These are the tags that must NEVER start reading as attacks.
    expect(unexpectedShapeTags("<line /><polyline /><circle /><text /><svg><title><desc>")).toEqual(
      [],
    );
  });

  it("NEGATIVE CONTROL — and still blanks a real hoisted class string", () => {
    // The other half of the strip, pinned directly rather than inferred from the main scan
    // being green: narrowing `isClassShaped` until it blanks nothing would satisfy every
    // control above, and the chart's own `15px`/`700px` would then red the assertion with no
    // explanation of why. This says which half broke, in one line, with the real constants.
    for (const real of [
      'const AXIS = "font-sans fill-ink/80 text-[15px] max-[700px]:text-[19px]";',
      'const FRAME = "max-w-[720px] aspect-[720/300] rounded-lg p-1 bg-white border border-ink/15";',
      'const GRID_YEAR = "stroke-ink/8 [stroke-width:0.6]";',
      "const AXIS_LABEL_LEFT = `${AXIS} [text-anchor:end]`;",
    ]) {
      expect(unexplainedNumbers(real), real).toEqual([]);
    }
  });

  it("keeps the guideline sentence in the SECTION, under the chart", () => {
    expect(section).toMatch(/whoGuideline/);
    // …and after the chart in document order, which is where the ruling put it.
    expect(section.indexOf("<Pm25Chart")).toBeLessThan(section.indexOf('t("whoGuideline")'));
  });

  it("uses the dedicated data token, with NO colour literal at all", () => {
    // T-033 deleted `air-pollution.module.css`, so this moved from the stylesheet to the
    // chart component. It got STRICTER on the way: the stylesheet was allowed exactly one
    // literal (`#fff`, the plot background), and the component is allowed none — the plot is
    // `bg-white`, a theme key, so a hex anywhere in this file is now a defect.
    expect(chartCode).toContain("var(--chart-pm25-line)");
    // An annual mean has no index membership, so a green→maroon AQI band would claim a
    // standing the number does not have (DESIGN §6.2, violated from the other direction).
    expect(chartCode.match(/#[0-9a-f]{3,8}/gi) ?? []).toEqual([]);
  });

  it("keeps Terra chrome tokens out of the data marks (DESIGN §6.1 rule 1)", () => {
    // The marks are the polyline and the markers — the two things that carry the series.
    // Scoped to the constants that draw them, so the scaffolding around them (gridlines and
    // axis numbers, which encode nothing) is not what this measures.
    const marks = chartCode.slice(
      chartCode.indexOf("const LINE ="),
      chartCode.indexOf("const AXIS ="),
    );
    expect(marks).toContain("--chart-pm25-line");
    expect(marks).not.toMatch(/--color-primary|--color-secondary|--color-accent|primary|accent/);
  });

  it("keeps the plot LIGHT, because the series token has no dark value", () => {
    // The one rule in this section that is deliberately NOT bound to the theme, and the
    // reason is measured: `--chart-pm25-line` is 9.86:1 on the white plot and 1.73:1 on
    // `--card`, so painting the frame with a bridge token would take the only mark the
    // figure exists to show below WCAG 1.4.11's 3:1 floor. If a dark-adapted PM2.5 token is
    // ever added, this assertion is the one to come back to.
    expect(chartCode).toMatch(/bg-white/);
    expect(chartCode).not.toMatch(/bg-card|bg-background|bg-muted/);
    // …and the scaffolding inside it stays on the same frozen ground, never on a bridge
    // token that moves out from under it (`--foreground` is 1.10:1 on this plot in dark).
    expect(chartCode).not.toMatch(/fill-foreground|fill-muted-foreground|stroke-border/);
  });
});

describe("the truncated axis shows the reader where it starts", () => {
  it("prints EVERY axis tick, so the truncated floor is always a visible number", () => {
    // The axis does not start at zero (→ DEC 2026-08-20c md.2 as applied 2026-08-20), and a
    // truncated axis that hides its own floor reads as a zero-based one — the exact
    // misreading the printed floor exists to prevent. Searched by shape, not by a name a
    // label might carry: the tick collection must be mapped whole, with nothing dropping
    // entries on the way to the `<text>` elements.
    expect(chartCode).toMatch(/geometry\.ticks\.map\(/);
    expect(chartCode).not.toMatch(/geometry\.ticks\s*\.\s*(slice|filter|shift|pop)/);
    expect(chartCode).not.toMatch(/ticks\.slice\(/);
    // …and the labels come from the tick VALUE, never re-derived from an index.
    expect(chartCode).toMatch(/\{tick\(axisTick\.value\)\}/);
  });
});

describe("accessibility contract", () => {
  it("gives the chart a text equivalent through title AND desc", () => {
    expect(chart).toMatch(/role="img"/);
    expect(chart).toMatch(/aria-labelledby=\{`\$\{titleId\} \$\{descId\}`\}/);
    expect(chart).toMatch(/<title id=\{titleId\}>/);
    expect(chart).toMatch(/<desc id=\{descId\}>/);
  });

  it("keeps the chart ids unique per page via the plaka suffix", () => {
    expect(chart).toMatch(/pm25-chart-title-\$\{idSuffix\}/);
    expect(pageCode).toMatch(/plateCode=\{province\.plateCode\}/);
  });

  it("makes the fragment target programmatically focusable and clear of the sticky header", () => {
    expect(section).toMatch(/<h2 id=\{headingId\} tabIndex=\{-1\}/);
    // `scroll-margin-top` moved from `.heading` into the component when T-033 deleted the
    // stylesheet. Without it a followed fragment scrolls the h2 flush to the top and under
    // the opaque sticky header, which is the whole reason the rule exists.
    expect(sectionCode).toMatch(/scroll-mt-\[calc\(var\(--header-height\)\+1rem\)\]/);
  });

  it("gives the collapsed table a real label and real table semantics", () => {
    expect(table).toMatch(/<summary className=\{SUMMARY\}>\{t\("tableSummary"/);
    expect(table).toMatch(/<caption/);
    expect(table).toMatch(/<th scope="col"/);
    expect(table).toMatch(/<th scope="row"/);
  });

  it("renders one row per payload year — the series length is never written down", () => {
    // The contract promises "at least one entry", not 27 (plan §16 V-2), so nothing may key
    // off the number.
    expect(tableCode).toMatch(/pm25\.years\.map/);
    for (const source of [tableCode, chartCode, sectionCode]) {
      expect(source).not.toMatch(/\b27\b/);
    }
  });

  it("reads no frozen Terra token for text, in any of the three files (T-033)", () => {
    // This used to say "uses --color-slate and never --color-taupe" — the PR#2 trap, which
    // was about picking the RIGHT frozen neutral. T-033 made the whole question obsolete in
    // this section: `.dark` redefines neither, so on a `--card` panel `--color-slate` was
    // 2.15:1 and `--color-ink` 1.14:1. The quiet voice is `text-muted-foreground` (7.79:1 in
    // dark, 7.92:1 in light — slate's own light figure) and the loud one `text-foreground`.
    for (const source of [sectionCode, tableCode]) {
      expect(source).not.toMatch(/var\(--color-[a-z-]+\)/);
      expect(source).toContain("text-muted-foreground");
    }
    expect(sectionCode).toContain("text-foreground");
    // The chart is the documented exception and reads exactly one token family: its own.
    expect(chartCode.match(/var\(--color-[a-z-]+\)/g) ?? []).toEqual([]);
  });

  it("looks up no CSS Module class at all, so no lookup can render `undefined`", () => {
    // The original form of this compared `styles.x` lookups against the classes
    // `air-pollution.module.css` declared. With the stylesheet gone that comparison is two
    // empty sets and passes for free — the vacuous green this repo keeps getting bitten by.
    // Restated as the property that replaced it: these three files import no stylesheet and
    // perform no `styles.` lookup, so there is nothing left that CAN resolve to `undefined`.
    for (const source of [sectionCode, chartCode, tableCode]) {
      expect(looksUpAModuleClass(source)).toBe(false);
    }
    // POSITIVE CONTROLS — through the SAME predicate, so editing it reds these too. Both
    // halves are exercised: the lookup and the import that would make one resolve.
    expect(looksUpAModuleClass("const x = styles.heading;")).toBe(true);
    expect(looksUpAModuleClass('import styles from "./air-pollution.module.css";')).toBe(true);
    expect(looksUpAModuleClass("<p className={NOTICE}>text</p>")).toBe(false);
  });
});

/**
 * THE ONE TOKEN IN THIS SECTION THAT DARK MODE *DOES* SHADOW, AND THE SUBTREE WHERE IT BITES.
 *
 * `pm25-chart.tsx` draws the plot's scaffolding with `fill-ink/80`, `stroke-ink/15` and
 * `border-ink/15` — Tailwind utilities over the frozen `--color-ink`, chosen because the plot
 * is a frozen white data ground and a bridge token there measures 2.19:1 (`--muted-foreground`)
 * or 1.16:1 (`--foreground`). See the component's docblock for why the plot cannot follow the
 * theme: `--chart-pm25-line` is 9.86:1 on white and 1.73:1 on `--card`.
 *
 * `--color-ink` is frozen GLOBALLY but not UNCONDITIONALLY. `app/globals.css` carries
 * `.dark .climate-dark-scope { --color-ink: var(--color-bg); … }`, a subtree shadow T-018 added
 * so the frozen climate stylesheet survives dark mode. Inside that subtree the chart's axis
 * numbers would resolve to `--color-bg` #fbf8f3 — **1.06:1 on its own white plot**, i.e.
 * invisible, which is the defect this whole task removed from everywhere else in the section.
 *
 * Today the two never meet: the province page renders `<AirPollutionSection>` inside its own
 * sibling `<Card>`, several hundred lines from the climate wrapper. That is PAGE STRUCTURE, not
 * a rule — one refactor that tucks the air section under the climate block reintroduces the
 * defect with every other guard green. T-033 task 4 owns `climate-dark-scope`, so this is
 * asserted here rather than left as a note for it to find.
 */
describe("the chart's frozen ink is never rendered inside climate-dark-scope", () => {
  const subtrees = climateDarkScopeSubtrees(pageCode);

  it("finds the scope wrapper it claims to check, holding the block it exists for", () => {
    // Anti-vacuity, both ways: an extractor that found nothing, or that grabbed the wrong
    // subtree, would satisfy the absence check below perfectly.
    expect(subtrees).toHaveLength(1);
    expect(subtrees[0]).toContain("<ClimateSection");
  });

  it("renders no AirPollutionSection inside it", () => {
    for (const subtree of subtrees) {
      expect(
        subtree,
        "the PM2.5 chart's axis ink resolves to 1.06:1 in this subtree",
      ).not.toContain("<AirPollutionSection");
    }
    // …and the section really is on the page, so the check has a subject.
    expect(pageCode).toContain("<AirPollutionSection");
  });

  it("POSITIVE CONTROL — the same extractor reports a section moved inside the scope", () => {
    const poisoned = [
      '<div className="climate-dark-scope">',
      "  <ClimateSection />",
      "  <div>",
      "    <AirPollutionSection />",
      "  </div>",
      "</div>",
    ].join("\n");
    const found = climateDarkScopeSubtrees(poisoned);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("<AirPollutionSection");
  });

  it("POSITIVE CONTROL — and does NOT report a sibling that merely follows the scope", () => {
    // The nesting count is what this rests on, so the negative half is pinned too: a section
    // AFTER the wrapper closes is exactly today's arrangement and must read as outside.
    const sibling = [
      '<div className="climate-dark-scope">',
      "  <ClimateSection />",
      "</div>",
      "<AirPollutionSection />",
    ].join("\n");
    expect(climateDarkScopeSubtrees(sibling)[0]).not.toContain("<AirPollutionSection");
  });
});

describe("zero client JavaScript", () => {
  it('ships no "use client" in the section, the chart or the table', () => {
    for (const source of [sectionCode, chartCode, tableCode]) {
      expect(source).not.toMatch(/["']use client["']/);
    }
  });
});
