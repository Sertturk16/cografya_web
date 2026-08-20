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
