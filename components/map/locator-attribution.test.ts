import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCATOR_DESKTOP_PRELOAD_MEDIA, shouldPreloadLocator } from "@/lib/map/locator-preload";

/**
 * The PAGE-LEVEL half of the ODbL obligation.
 *
 * `lib/map/base-map-svg.test.ts` pins the credit DRAWN INSIDE the shared SVG file — the layer
 * that answers "someone opened /maps/tr-provinces.svg on its own". This file pins the other
 * layer: the visible HTML chip beside the figure, which is what a reader sees on the page and
 * what survives the image failing to load. Two failure modes, two layers, two tests; neither
 * substitutes for the other (plan §12 md.1).
 *
 * The assertions read SOURCE rather than rendering, for the same reason
 * `attribution-separation.test.ts` does: `LocatorMap` is an async server component that reaches
 * for `getTranslations`, and this repo's vitest environment is node with no jsdom.
 *
 * Comments are stripped first. That is not a detail — this component's docblock discusses the
 * credit at length, so a naive scan would pass on the prose after someone deleted the real
 * `<figcaption>` (the exact trap `attribution-separation.test.ts` documents).
 */

function code(url: URL): string {
  return readFileSync(url, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const locator = code(new URL("./locator-map.tsx", import.meta.url));
const provincePage = code(
  new URL("../../app/[locale]/(site)/turkiye/[slug]/page.tsx", import.meta.url),
);
const countryPage = code(
  new URL("../../app/[locale]/(site)/dunya/[slug]/page.tsx", import.meta.url),
);

describe("LocatorMap carries its own credit", () => {
  it("renders the attribution string in a figcaption", () => {
    expect(locator).toMatch(/<figcaption[^>]*>\{t\("attribution"\)\}<\/figcaption>/);
  });

  it("reads that string itself instead of accepting it as a prop", () => {
    // If the caller supplied it, an edit at ONE of two call sites could drop the credit from
    // 81 or 199 pages without touching this file. Reading it here makes the chip travel with
    // the figure by construction.
    expect(locator).toMatch(/getTranslations\(\s*kind === "province" \? "Map" : "WorldMap"\s*\)/);
    expect(locator).not.toMatch(/\battribution\s*[:?]/);
  });

  it("keeps the base map an <img> with explicit dimensions (the CLS half of the §4 #9 exception)", () => {
    expect(locator).toMatch(/width=\{bounds\.width\}/);
    expect(locator).toMatch(/height=\{bounds\.height\}/);
  });

  it("keeps the image natively lazy and emits the shared server-side preload query", () => {
    expect(locator).toMatch(/loading="lazy"/);
    expect(locator).toMatch(/rel="preload"/);
    expect(locator).toMatch(/as="image"/);
    expect(locator).toMatch(/media=\{LOCATOR_DESKTOP_PRELOAD_MEDIA\}/);
    expect(locator).not.toMatch(/["']use client["']/);
    expect(LOCATOR_DESKTOP_PRELOAD_MEDIA).toBe("(min-width: 70rem) and (min-height: 45rem)");
  });

  it.each([
    [390, 844, false],
    [1120, 720, true],
    [1120, 768, true],
    [1366, 768, true],
    [1440, 900, true],
    [1119, 900, false],
    [1366, 719, false],
  ])("classifies %d × %d preload eligibility as %s", (width, height, expected) => {
    expect(shouldPreloadLocator(width, height)).toBe(expected);
  });

  it("names the composite once for assistive tech and hides both children", () => {
    expect(locator).toMatch(/role="img"\s*\n?\s*aria-label=\{alt\}|role="img" aria-label=\{alt\}/);
    expect(locator).toMatch(/alt=""/);
    expect(locator).toMatch(/aria-hidden="true"/);
  });
});

/**
 * THE PROVINCE PAGE USES A DIFFERENT COMPONENT NOW.
 *
 * V1 rendered `LocatorMap` on both detail pages. The V2 province page draws its own inline SVG
 * (`V2ProvinceLocatorMap`) from the same generated shapes; the country page still uses
 * `LocatorMap`. That is a legitimate design choice and not this file's business.
 *
 * What IS this file's business is that the obligation did not travel with the swap. The new
 * component shipped with no credit at all, over `tr-provinces.generated.ts` / `tr-context.generated.ts`
 * — both projected from `data/tr-il-boundaries.geojson`, © OpenStreetMap contributors, ODbL,
 * per their own generated headers. It also hardcoded a Turkish accessible name while
 * `ProvinceDetail.locationAlt` sat unused in both catalogues, so the EN page announced the map
 * in Turkish. Both were restored in T-032 PR3 and are pinned here.
 *
 * So the assertions below moved from "does this page contain `<LocatorMap`" to "does whatever
 * this page uses to draw OSM geometry carry the credit and a catalogue alt" — which is the
 * obligation, and is what the old assertion was a proxy for.
 */
const v2Locator = code(new URL("../v2/v2-province-locator-map.tsx", import.meta.url));

describe("both detail pages render a locator that carries its obligations", () => {
  it("is on the province page", () => {
    expect(provincePage).toContain("<V2ProvinceLocatorMap");
    expect(provincePage).toContain('from "@/components/v2/v2-province-locator-map"');
  });

  it("is on the country page", () => {
    expect(countryPage).toContain("<LocatorMap");
    expect(countryPage).toMatch(/kind="country"/);
  });

  it("passes an alt text from the catalogue, never a literal", () => {
    // The country page passes it in; the province component reads it itself. Either is fine —
    // what is not fine is a literal, which is what the V2 component shipped with.
    expect(countryPage).toMatch(/alt=\{t\("locationAlt"/);
    expect(v2Locator).toMatch(
      /aria-label=\{tProvince\("locationAlt", \{ name: provinceName \}\)\}/,
    );
    expect(v2Locator).not.toMatch(/aria-label=\{`/);
  });

  it("credits OSM on the province locator, in the markup and not only in a comment", () => {
    // `code()` has already stripped comments — this component's docblock argues the credit at
    // length, so a naive scan would pass on the prose after someone deleted the <figcaption>.
    expect(v2Locator).toMatch(/<figcaption[^>]*>\{t\("attribution"\)\}<\/figcaption>/);
    // Read in the component, not accepted as a prop: a caller-supplied credit can be dropped at
    // the call site and stops travelling with the figure (the same rule `LocatorMap` follows).
    expect(v2Locator).toMatch(/getTranslations\("Map"\)/);
  });

  it("names the province composite once for assistive tech and hides the drawing", () => {
    expect(v2Locator).toMatch(/role="img"/);
    expect(v2Locator).toMatch(/<svg[^>]*aria-hidden="true"|aria-hidden="true"/);
  });
});
