import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * The flag card's GATE and its accessible contract, plus catalogue totality for the strings
 * this package added.
 *
 * The gate is the point: a country row with no asset must render NOTHING — not an empty
 * `<img>`, not a placeholder, not a broken-image icon. Today exactly one seeded row takes
 * that path (`QN`), and that asymmetry is a surfaced owner decision, not something a test
 * should freeze in place — so this file asserts the MECHANISM and never the membership.
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
const countryPage = code(new URL("../../app/[locale]/dunya/[slug]/page.tsx", import.meta.url));

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

  it("is rendered by the country page with catalogue strings, not literals", () => {
    expect(countryPage).toContain("<CountryFlag");
    expect(countryPage).toMatch(/label=\{t\("flag"\)\}/);
    expect(countryPage).toMatch(/alt=\{t\("flagAlt"/);
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
