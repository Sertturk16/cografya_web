import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * The flag card's GATE and its accessible contract, plus catalogue totality for the strings
 * this package added.
 *
 * The gate is the point: a country row with no asset must render NOTHING — not an empty
 * `<img>`, not a placeholder, not a broken-image icon. No seeded row takes that path today:
 * the package-backed set plus the local override cover all 199. The test still asserts the
 * MECHANISM rather than freezing current membership.
 *
 * Source-read rather than render, for the repo's usual reason: vitest runs in node with no
 * jsdom and the call sites are async server components. Comments are stripped first so the
 * component's own prose about the fail-soft path cannot satisfy an assertion about the code.
 */

function code(url: URL): string {
  return readFileSync(url, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const flagComponent = code(new URL("./country-flag.tsx", import.meta.url));
const countryPage = code(
  new URL("../../app/[locale]/(site)/dunya/[slug]/page.tsx", import.meta.url),
);

describe("flag card fail-soft gate", () => {
  it("returns null for a row with no asset, before rendering anything", () => {
    expect(flagComponent).toMatch(/if \(!hasFlag\(isoCode\)\) return null;/);
  });

  it("never renders an <img> whose src could resolve to a missing asset", () => {
    // The only <img> in the file sits after the guard above; there is no second, ungated one.
    expect(flagComponent.match(/<img\b/g)).toHaveLength(1);
  });
});

describe("flag card accessibility and CLS", () => {
  it('carries a real alt (informative image), never alt=""', () => {
    expect(flagComponent).toMatch(/alt=\{alt\}/);
    expect(flagComponent).not.toMatch(/alt=""/);
  });

  it("states explicit dimensions — the CLS half of the ENGINEERING §4 #9 exception", () => {
    expect(flagComponent).toMatch(/width=\{4\}/);
    expect(flagComponent).toMatch(/height=\{3\}/);
  });

  it("is no longer what the country page renders — the contract moved with the markup", () => {
    /**
     * The V2 country page inlines its own `<img>` instead of using this component, and T-032
     * PR4 deletes `components/country/` outright. Asserting a call site that does not exist
     * would just fail; asserting nothing would quietly drop a real contract on the way past.
     *
     * So the flag's page-level contract — one call site, behind `showsFlag`, a localized alt
     * from the catalogue, explicit dimensions — moved to `lib/geo/sovereignty.test.ts`, which
     * is where the gate it hangs on is already tested and which survives PR4. Inlining a
     * component silently drops whatever the component guaranteed: here it had already cost the
     * page its localized alt, which read `${name} bayrağı` on the English page.
     *
     * What is left here is the component's own fail-soft contract, above, for as long as the
     * component exists. This assertion is the marker that the two halves were separated
     * deliberately rather than one of them being forgotten.
     */
    expect(countryPage).not.toContain("<CountryFlag");
    const sovereigntyTest = readFileSync(
      new URL("../../lib/geo/sovereignty.test.ts", import.meta.url),
      "utf8",
    );
    expect(sovereigntyTest, "the page-level flag contract has no home").toContain(
      'alt=\\{t\\("flagAlt", \\{ name \\}\\)\\}',
    );
  });
});

describe("catalogue totality for this package's new keys", () => {
  // next-intl logs console.error on a missing key and ships the dotted key string into live
  // markup with CI green, so every key this package introduced is enumerated here.
  const catalogues = { tr: trMessages, en: enMessages } as const;

  const EXPECTED = {
    ProvinceDetail: { withPlaceholder: ["locationHeading", "locationAlt"], plain: [] },
    CountryDetail: {
      withPlaceholder: ["locationHeading", "locationAlt", "flagAlt"],
      // `sovereigntyHeading` is deliberately in the PLAIN list: it carries no entity name,
      // by ruling (→ DEC 2026-08-08l B1). An entity-named H2 exists to be independently
      // extractable, which on a contested row is exactly what turns a section marker into a
      // standalone possessive claim — see lib/geo/sovereignty.ts.
      plain: ["locationHeadingPlain", "flag", "sovereigntyHeading"],
    },
    About: { withPlaceholder: [], plain: ["dataOsmOffer", "dataFlagsLabel", "dataFlagsCredit"] },
  } as const;

  for (const [locale, messages] of Object.entries(catalogues)) {
    for (const [namespace, keys] of Object.entries(EXPECTED)) {
      const bag = (messages as Record<string, Record<string, unknown>>)[namespace] ?? {};

      for (const key of keys.withPlaceholder) {
        it(`${locale}.json ${namespace}.${key} exists and interpolates {name}`, () => {
          expect(typeof bag[key]).toBe("string");
          expect(bag[key] as string).toContain("{name}");
        });
      }

      for (const key of keys.plain) {
        it(`${locale}.json ${namespace}.${key} exists and has no unresolved placeholder`, () => {
          expect(typeof bag[key]).toBe("string");
          expect((bag[key] as string).length).toBeGreaterThan(0);
          expect(bag[key] as string).not.toContain("{");
        });
      }
    }
  }
});
