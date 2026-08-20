import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the province page's AIR-POLLUTION section (the
 * `lib/climate/climate-messages.test.ts` pattern, for the same reason).
 *
 * next-intl logs a missing key and renders its dotted path rather than failing the build,
 * so a typo here puts "AirPollution.valueLabel" in front of a reader on an indexable page
 * with CI green. This section renders on all 81 province pages in BOTH locales, which makes
 * it the widest copy surface added by this change.
 *
 * Structural only (`CONVENTIONS.md` §2): it never asserts what the copy says. The one thing
 * it asserts about content is the ABSENCE of a phrase — see the last block.
 */

const AIR_KEYS = [
  "valueLabel",
  // Read by the province page's JSON-LD branch, not by a component — see the last block for
  // why it is a separate string from `valueLabel` and what binds it to the visible copy.
  "jsonLdLabel",
  "unit",
  "whoGuideline",
  "chartTitle",
  "chartDesc",
  "tableSummary",
  "tableCaption",
  "tableYear",
  "tableValue",
  "noticeIntro",
  "sourceLine",
  "licenceLine",
  "referenceLine",
] as const;

/** Placeholders each templated key must carry, so a message can never drop an interpolation. */
const REQUIRED_PLACEHOLDERS: Record<string, readonly string[]> = {
  valueLabel: ["year"],
  jsonLdLabel: ["year"],
  chartTitle: ["name", "start", "end"],
  chartDesc: ["min", "max", "unit", "minYear", "maxYear", "start", "end"],
  tableSummary: ["start", "end"],
  tableCaption: ["name", "unit", "start", "end"],
  tableValue: ["unit"],
  // The three attribution lines interpolate PAYLOAD elements and wrap them in ICU tags. A
  // dropped tag would print the element unlinked; a dropped element would print a label
  // with nothing after it.
  sourceLine: ["provider", "workTitle"],
  licenceLine: ["licenceName"],
  referenceLine: ["citation"],
};

/** ICU rich-text tags each attribution line must keep, because the component supplies them. */
const REQUIRED_TAGS: Record<string, readonly string[]> = {
  sourceLine: ["source"],
  licenceLine: ["licence"],
  referenceLine: ["ref"],
};

const catalogues = { tr: trMessages.AirPollution, en: enMessages.AirPollution } as const;

describe("air-pollution message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(AIR_KEYS)("resolves AirPollution.%s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect(String(value).length).toBeGreaterThan(0);
      });

      it.each(Object.entries(REQUIRED_PLACEHOLDERS))("keeps %s's placeholders", (key, names) => {
        const value = String((catalogue as Record<string, unknown>)[key]);
        for (const name of names) expect(value).toContain(`{${name}}`);
      });

      it.each(Object.entries(REQUIRED_TAGS))("keeps %s's rich-text tags", (key, tags) => {
        const value = String((catalogue as Record<string, unknown>)[key]);
        for (const tag of tags) {
          expect(value).toContain(`<${tag}>`);
          expect(value).toContain(`</${tag}>`);
        }
      });
    });
  }

  it("ships the province-page keys in both catalogues", () => {
    for (const catalogue of [trMessages.ProvinceDetail, enMessages.ProvinceDetail]) {
      const record = catalogue as Record<string, unknown>;
      expect(typeof record.airPollutionHeading).toBe("string");
      expect(String(record.airPollutionHeading)).toContain("{name}");
      // The Kaynaklar entry interpolates the version from the payload — never a literal.
      expect(typeof record.sourcesPm25).toBe("string");
      expect(String(record.sourcesPm25)).toContain("{version}");
    }
  });

  it("carries no key the components never read", () => {
    // Dead copy is a CONTENT-STYLE §22 problem, not just clutter: it survives review by
    // looking like something in use. The two sets are compared in both directions.
    const declared = new Set([...AIR_KEYS, "notice"]);
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      expect({ locale, keys: Object.keys(catalogue).filter((k) => !declared.has(k)) }).toEqual({
        locale,
        keys: [],
      });
    }
  });
});

/**
 * ONE CONTENT ASSERTION, and it guards a ruling rather than a style: the value is read from
 * the grid cell containing the province CENTRE and is not a provincial average
 * (→ DEC 2026-08-19d md.1, where both averaging options were offered to the owner and
 * rejected). The interface may not even imply otherwise, so the phrase that would imply it
 * may not appear in this section's copy in an affirmative form.
 */
describe("the section's copy never claims a provincial average", () => {
  it("uses the phrase only inside the sentence that DENIES it", () => {
    const tr = JSON.stringify(trMessages.AirPollution);
    const en = JSON.stringify(enMessages.AirPollution);
    const trHits = tr.match(/il ortalaması/g) ?? [];
    const enHits = en.match(/provincial average/gi) ?? [];
    expect(trHits).toHaveLength(1);
    expect(enHits).toHaveLength(1);
    expect(trMessages.AirPollution.notice.provinceCentrePoint).toContain("il ortalaması");
    expect(enMessages.AirPollution.notice.provinceCentrePoint).toContain("provincial average");
  });
});

/**
 * §B5 5.7 GUARD FOR THE JSON-LD LABEL.
 *
 * The province page's `PropertyValue` node is named from `jsonLdLabel`, not from the visible
 * `valueLabel`, because `additionalProperty` describes the ENTITY and an unqualified "annual
 * mean PM2.5" node asserts a provincial average — the reading DEC 2026-08-19d md.1 rejected
 * (PR #76 review FENER76-I1). The qualification only works if it says nothing the page does
 * not already show, which is 5.7's own requirement, and 5.7 is a BLOCKER.
 *
 * WHAT THIS BLOCK PINS, STATED EXACTLY. It pins a CATALOGUE-TO-CATALOGUE pairing: the label's
 * qualifier vocabulary must also stand in `notice.provinceCentrePoint`, so editing either
 * string alone goes red. That is worth having, because the two live in different places and
 * move independently.
 *
 * It does NOT pin that the notice is ever RENDERED. That sentence is gated on the api's
 * `noticeKeys` — a third party no assertion in this file touches — and an earlier version of
 * this docblock claimed otherwise ("edit either side and this goes red"), which is the false
 * safety claim `PR #76` review FENER76R2-I1 + CODE76R2-I1 named. The render half is a
 * different guard in a different file: `air-pollution.structure.test.ts` pins that the page
 * gates the `PropertyValue` on the same flag the notice is gated on, so the node cannot
 * outlive the sentence that qualifies it. Neither guard implies the other.
 */
describe("the JSON-LD label says nothing the page does not show", () => {
  /**
   * Turkish-aware folding, and it is load-bearing rather than tidy: `"İl".toLowerCase()` is
   * `"i̇l"` (i + U+0307) on the default locale, so a naive fold would make every check below
   * pass vacuously for the wrong reason. Hyphens fold to spaces because the EN label carries
   * a compound modifier ("province-centre") that the notice writes open ("province centre") —
   * the same words, and English punctuation is not a vocabulary difference.
   */
  const fold = (value: string, locale: string) =>
    value.toLocaleLowerCase(locale).replaceAll("-", " ");

  /**
   * The words that make the node's name a QUALIFIED claim instead of a bare one. Listed once
   * and asserted against BOTH sides, so neither side can drop them alone.
   */
  const QUALIFIER_ROOTS = {
    tr: ["il merkezi", "hücre"],
    en: ["province centre", "cell"],
  } as const;

  for (const [locale, catalogue] of Object.entries(catalogues)) {
    const roots = QUALIFIER_ROOTS[locale as keyof typeof QUALIFIER_ROOTS];

    it(`${locale}: every qualifier word in the label is also in the visible notice`, () => {
      const label = fold(catalogue.jsonLdLabel, locale);
      const notice = fold(catalogue.notice.provinceCentrePoint, locale);
      for (const root of roots) {
        expect(label).toContain(root);
        expect(notice).toContain(root);
      }
    });

    it(`${locale}: the label's metric half IS the visible value label`, () => {
      // Derived, not restated: the part before the em-dash must be byte-identical to the
      // string the page prints above the figure, so the two can never name different metrics.
      const [metric] = catalogue.jsonLdLabel.split(" — ");
      expect(metric).toBe(catalogue.valueLabel.replace(" ({year})", ""));
    });

    it(`${locale}: POSITIVE CONTROL — the same check fails for a word the page does not show`, () => {
      // Without this, "every root found" would also pass for a fold that matched anything.
      // The fabricated root is held here only; it is written into neither catalogue.
      const invented = locale === "tr" ? "uydu yörüngesi" : "satellite orbit";
      expect(fold(catalogue.notice.provinceCentrePoint, locale)).not.toContain(invented);
    });
  }
});
