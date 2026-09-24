import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * `apiGet` passes an `AbortSignal` on every call, and Next's `dedupe-fetch` returns the raw
 * `fetch` when a signal is present — so two sections of one page that each call
 * `getProvincesResilient()` make TWO requests unless something above `apiGet` memoizes. React
 * `cache()` is that something: per request, shared by `generateMetadata` and every Suspense
 * child. React's `cache` is a passthrough outside a server render, so this cannot be shown at
 * runtime under vitest; the wrap is pinned in source instead, comments stripped.
 */
const SHARED_LOADERS: Record<string, readonly string[]> = {
  "provinces.ts": [
    "getProvinces",
    "getMapSummary",
    "getProvincesResilient",
    "getMapSummaryResilient",
  ],
  "countries.ts": [
    "getCountries",
    "getCountryMapSummary",
    "getCountriesResilient",
    "getCountryMapSummaryResilient",
  ],
  "regions.ts": ["getRegionsResilient"],
  "books.ts": ["getBooksResilient"],
  "marine.ts": ["getMarinePointsSafe", "getMarineLayersSafe", "getMarineOverviewSafe"],
  "earthquakes.ts": ["getEarthquakeMetaSafe"],
};

const source = (file: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8"));

describe("loaders read by more than one Suspense boundary are wrapped in React cache()", () => {
  for (const [file, names] of Object.entries(SHARED_LOADERS)) {
    it(`${file} imports cache from react`, () => {
      expect(source(file)).toMatch(/import \{[^}]*\bcache\b[^}]*\} from "react"/);
    });
    for (const name of names) {
      it(`${file}: ${name} is a cache(...) constant`, () => {
        expect(source(file)).toMatch(new RegExp(`export const ${name} = cache\\(`));
        expect(source(file)).not.toMatch(new RegExp(`export async function ${name}\\b`));
      });
    }
  }

  it("the runtime re-throw of the Resilient wrappers survived the wrap", () => {
    // The wrap must not swallow: `isProductionBuild()` decides `return []` vs `throw error`.
    const provinces = source("provinces.ts");
    const resilient = provinces.slice(provinces.indexOf("export const getProvincesResilient"));
    expect(resilient).toMatch(
      /if \(isProductionBuild\(\)\) \{[\s\S]*?return \[\];[\s\S]*?\}\s*throw error;/,
    );
  });
});
