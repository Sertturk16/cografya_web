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
    // No constant concentration anywhere in the chart's GEOMETRY — the AQG level or any of
    // the four interim targets would appear as one. Coordinates come from the scale module
    // and the marker radius is the only literal the chart owns.
    //
    // Scanned with string literals removed, and that is a SHARPENING rather than a let-off.
    // Until T-033 every presentation constant lived in `air-pollution.module.css`, so the
    // only numbers in this file were geometry and the scan could read the file whole. The
    // conversion moved stroke widths, alphas and font sizes into Tailwind class strings, and
    // counting those would have forced the allow-list open to `15`, `1` and `0.6` — `15`
    // being a plausible PM2.5 interim target, i.e. exactly the value this test exists to
    // stop. A number inside a class string cannot place a line; `y={15}` can, and still trips.
    const geometry = chartCode.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
    const numericLiterals = (geometry.match(/(?<![\w.-])\d+(?:\.\d+)?(?![\w.])/g) ?? []).filter(
      (n) => !["2.8", "4", "6", "20", "0"].includes(n),
    );
    expect(numericLiterals).toEqual([]);
    // POSITIVE CONTROL — a threshold written as a coordinate is still visible after the strip.
    const poisoned = 'const GUIDE = "stroke-ink/15";\n<line y1={15} y2={15} />';
    expect(poisoned.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""')).toMatch(/\{15\}/);
    expect(chartCode).not.toMatch(/whoGuideline/);
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
      expect(source).not.toMatch(/\.module\.css/);
      expect(source).not.toMatch(/styles\./);
    }
    // POSITIVE CONTROL — the same scan reports a lookup that is written down.
    expect("const x = styles.heading;").toMatch(/styles\./);
  });
});

describe("zero client JavaScript", () => {
  it('ships no "use client" in the section, the chart or the table', () => {
    for (const source of [sectionCode, chartCode, tableCode]) {
      expect(source).not.toMatch(/["']use client["']/);
    }
  });
});
