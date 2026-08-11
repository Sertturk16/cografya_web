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
const provincePage = code(new URL("../../app/[locale]/turkiye/[slug]/page.tsx", import.meta.url));
const countryPage = code(new URL("../../app/[locale]/dunya/[slug]/page.tsx", import.meta.url));

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

describe("both detail pages render the locator", () => {
  it("is on the province page", () => {
    expect(provincePage).toContain("<LocatorMap");
    expect(provincePage).toMatch(/kind="province"/);
  });

  it("is on the country page", () => {
    expect(countryPage).toContain("<LocatorMap");
    expect(countryPage).toMatch(/kind="country"/);
  });

  it("passes an alt text from the catalogue, never a literal", () => {
    expect(provincePage).toMatch(/alt=\{t\("locationAlt"/);
    expect(countryPage).toMatch(/alt=\{t\("locationAlt"/);
  });
});
