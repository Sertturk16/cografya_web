import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseMapResponse } from "@/lib/map/base-map-svg";

/**
 * Every URL these components hard-code must have a route behind it.
 *
 * Five new handlers serve five URL literals held in two component files, and nothing bound
 * either side to the other. Next's route URLs are derived from directory names and carry no
 * type — the `as const satisfies` on `BASE_MAP` types the record's SHAPE, not the existence of
 * a handler behind each string — so `tsc`, eslint, `next build` and every other test file stay
 * green while the two sides drift apart. The rendered result is an empty locator frame on 280
 * pages, or a broken flag on 199.
 *
 * The realistic trigger is not a typo. `app/maps/world-countries.en.svg/` has a dot in its
 * directory name ON PURPOSE: `proxy.ts`'s matcher skips any path containing a dot, and that is
 * what stops next-intl rewriting these URLs into a locale prefix. It reads like an accident,
 * which makes it exactly the kind of thing a later tidy-up "fixes".
 *
 * Derivation, not duplication: the expected directory is computed from the URL the component
 * actually ships, so this cannot pass by having been updated in step with a rename.
 */

function tsxCode(url: URL): string {
  return readFileSync(url, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const locator = tsxCode(new URL("./map/locator-map.tsx", import.meta.url));
const flagCard = tsxCode(new URL("./country/country-flag.tsx", import.meta.url));

/** Every `/maps/...svg` literal the locator component ships. */
const mapUrls = [...locator.matchAll(/"(\/maps\/[^"]+\.svg)"/g)].map((m) => m[1]!);

describe("map route URLs", () => {
  it("ships exactly the four base-map URLs (two maps × two locales)", () => {
    expect(new Set(mapUrls).size).toBe(4);
  });

  it.each([
    ["/maps/tr-provinces.svg"],
    ["/maps/tr-provinces.en.svg"],
    ["/maps/world-countries.svg"],
    ["/maps/world-countries.en.svg"],
  ])("still ships %s", (url) => {
    expect(mapUrls).toContain(url);
  });

  it("has a route handler behind every URL it ships", () => {
    for (const url of mapUrls) {
      const route = new URL(`../app${url}/route.ts`, import.meta.url);
      expect(existsSync(route), `${url} -> app${url}/route.ts`).toBe(true);
    }
  });

  it("keeps the dot in the EN directory names, which is what skips the locale rewrite", () => {
    // Not cosmetic: proxy.ts's matcher excludes any path containing a dot. Rename these to
    // `world-countries-en` and next-intl rewrites the URL into a locale prefix.
    for (const url of mapUrls.filter((u) => u.includes(".en."))) {
      expect(url).toMatch(/\.en\.svg$/);
    }
  });
});

describe("flag route URL", () => {
  it("builds its src from the /flags/{ISO}.svg template the route serves", () => {
    // The route's param carries the extension (see its docblock), and `dynamicParams = false`
    // now means a URL outside `generateStaticParams` is a hard 404 rather than an on-demand
    // render — so the case and the suffix are load-bearing, not cosmetic.
    expect(flagCard).toMatch(/src=\{`\/flags\/\$\{isoCode\.trim\(\)\.toUpperCase\(\)\}\.svg`\}/);
  });

  it("has the dynamic route directory behind it", () => {
    expect(existsSync(new URL("../app/flags/[flag]/route.ts", import.meta.url))).toBe(true);
  });
});

describe("baseMapResponse headers", () => {
  // The only thing the four map routes add on top of the tested builders, and untested until
  // now. A dropped Content-Type means browsers refuse the SVG inside `<img>` and every locator
  // map on 280 pages goes blank with CI green; the other three are the caching and containment
  // decisions this range made deliberately.
  const response = baseMapResponse("<svg/>");

  it.each([
    ["Content-Type", "image/svg+xml; charset=utf-8"],
    ["Cache-Control", "public, max-age=604800"],
    ["X-Content-Type-Options", "nosniff"],
  ])("sets %s", (header, value) => {
    expect(response.headers.get(header)).toBe(value);
  });

  it("sandboxes the SVG it serves", () => {
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });
});
