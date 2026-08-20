import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PM25_NOTICE_SLOTS } from "@/lib/air/notice-keys";

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
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const section = read("./air-pollution-section.tsx");
const chart = read("./pm25-chart.tsx");
const table = read("./pm25-table.tsx");
const css = read("./air-pollution.module.css");
const page = read("../../app/[locale]/turkiye/[slug]/page.tsx");
const sectionCode = code(section);
const chartCode = code(chart);
const tableCode = code(table);
const cssCode = code(css);
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
    expect(pageCode).toMatch(/\{pm25Annual !== null && \(\s*<AirPollutionSection/);
  });

  it("cites the source in Kaynaklar only when the section renders", () => {
    // A source cited for content that is not on the page is the UX-tour B5 defect.
    expect(pageCode).toMatch(
      /if \(pm25Annual !== null\)\s*\n?\s*extraSources\.push\(t\("sourcesPm25"/,
    );
  });

  it("adds the JSON-LD PropertyValue only when the QUALIFYING NOTICE renders", () => {
    // SEO-POLICY §B5 5.7/5.8: structured data may not carry what the page does not show,
    // and a null field is never filled in. The node's name carries "il merkezi hücresi" /
    // "province-centre cell", and those words are on a province page ONLY inside
    // `notice.provinceCentrePoint` — a sentence the api gates through `noticeKeys`,
    // independently of `pm25Annual !== null`. So the node is gated on that same flag and
    // DROPS when the sentence does not render (→ PR #76 review FENER76R2-I1 + CODE76R2-I1).
    // Whitespace-normalised rather than pattern-matched line by line: the assertion is about
    // which expression the gate is, not about how Prettier wrapped it.
    const flatPage = pageCode.replace(/\s+/g, " ");
    expect(flatPage).toContain(
      "const pm25ShowsCentreNotice = pm25Annual !== null && " +
        "pm25NoticeFlags(pm25Annual.attribution.noticeKeys).provinceCentrePoint;",
    );
    expect(flatPage).toContain(
      "if (pm25Annual !== null && pm25ShowsCentreNotice) { additionalProperty.push(",
    );
  });

  it("names the node with the reading-point label, never the bare value label", () => {
    // FENER76-I1: `additionalProperty` describes the ENTITY, so a node named with the visible
    // `valueLabel` asserts a provincial average — the reading DEC 2026-08-19d md.1 rejected —
    // and a `PropertyValue` travels without the caveat printed beneath it. Scoped to the PM2.5
    // branch, because `valueLabel` is correct everywhere else it appears.
    // The branch is captured by its FULL gate — which stands exactly once in this file — and
    // to its own closing brace rather than to the first `}` in it; that one belongs to a
    // template call.
    const branch = /if \(pm25Annual !== null && pm25ShowsCentreNotice\) \{([\s\S]*?)\n {2}\}/.exec(
      pageCode,
    )?.[1];
    expect(branch).toBeDefined();
    // Bound by IDENTITY, not by position: an absence check ("no `valueLabel` here") reports
    // clean for free if the capture read some other block, so the capture states which block
    // it is before asserting anything about it (→ PR #76 review FENER76R2-M3).
    expect(branch).toContain("additionalProperty.push");
    expect(branch).toContain('tAir("jsonLdLabel"');
    expect(branch).not.toContain('tAir("valueLabel"');
  });

  it("puts the SAME rounded number in the structured data as on the page", () => {
    expect(pageCode).toMatch(/value: roundPm25\(pm25Annual\.latestValueUgM3\)/);
    expect(section).toMatch(/roundPm25\(pm25\.latestValueUgM3\)/);
  });

  it("emits no unitCode — the UN/CEFACT code for µg/m³ is unverified", () => {
    // Scoped to the PM2.5 branch: `unitCode` is correct on the km²/°C/mm properties beside
    // it, so a whole-file check would say nothing. Same capture as above: the full gate, to
    // the branch's own closing brace.
    const branch = /if \(pm25Annual !== null && pm25ShowsCentreNotice\) \{([\s\S]*?)\n {2}\}/.exec(
      pageCode,
    )?.[1];
    expect(branch).toBeDefined();
    expect(branch).toContain("additionalProperty.push");
    expect(branch).toContain("unitText");
    expect(branch).not.toContain("unitCode");
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
    // No constant concentration anywhere in the chart's code — the AQG level or any of the
    // four interim targets would appear as one. Coordinates come from the scale module and
    // the marker radius is the only literal the chart owns.
    const numericLiterals = (chartCode.match(/(?<![\w.-])\d+(?:\.\d+)?(?![\w.])/g) ?? []).filter(
      (n) => !["2.8", "4", "6", "20", "0"].includes(n),
    );
    expect(numericLiterals).toEqual([]);
    expect(chartCode).not.toMatch(/whoGuideline/);
  });

  it("keeps the guideline sentence in the SECTION, under the chart", () => {
    expect(section).toMatch(/whoGuideline/);
    // …and after the chart in document order, which is where the ruling put it.
    expect(section.indexOf("<Pm25Chart")).toBeLessThan(section.indexOf('t("whoGuideline")'));
  });

  it("uses the dedicated data token, with no raw colour but the shared white plot", () => {
    expect(cssCode).toContain("var(--chart-pm25-line)");
    // An annual mean has no index membership, so a green→maroon AQI band would claim a
    // standing the number does not have (DESIGN §6.2, violated from the other direction).
    // The ONE permitted literal is the plot background the climate chart already uses; every
    // other colour must come from the token layer.
    const hexes = cssCode.match(/#[0-9a-f]{3,8}/gi) ?? [];
    expect(hexes).toEqual(["#fff"]);
  });

  it("keeps Terra chrome tokens out of the data marks (DESIGN §6.1 rule 1)", () => {
    const dataRules = cssCode.slice(cssCode.indexOf(".line {"), cssCode.indexOf(".axisLabelLeft,"));
    expect(dataRules).not.toMatch(/--color-primary|--color-secondary|--color-accent/);
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
    expect(css).toMatch(/\.heading\s*\{[^}]*scroll-margin-top/);
  });

  it("gives the collapsed table a real label and real table semantics", () => {
    expect(table).toMatch(/<summary className=\{styles\.summary\}>\{t\("tableSummary"/);
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

  it("uses --color-slate and never --color-taupe for text (the PR#2 trap)", () => {
    expect(cssCode).toContain("var(--color-slate)");
    expect(cssCode).not.toContain("--color-taupe");
  });

  it("declares every class the components look up, so no lookup renders `undefined`", () => {
    const used = new Set(
      [...`${sectionCode}${chartCode}${tableCode}`.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map(
        (m) => m[1],
      ),
    );
    const declared = new Set([...cssCode.matchAll(/^\.([A-Za-z0-9_]+)/gm)].map((m) => m[1]));
    expect([...used].filter((name) => name !== undefined && !declared.has(name))).toEqual([]);
  });
});

describe("zero client JavaScript", () => {
  it('ships no "use client" in the section, the chart or the table', () => {
    for (const source of [sectionCode, chartCode, tableCode]) {
      expect(source).not.toMatch(/["']use client["']/);
    }
  });
});
