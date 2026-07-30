import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { indexableLocales, isIndexable } from "./indexing";
import { buildAlternates } from "./metadata";
import { NOINDEX_ROUTE, ROUTE_FIXTURES, SURFACES } from "./routes.fixture";
import { alternateLanguagesFor, sitemapEntriesFor } from "./sitemap-entries";
import { absoluteUrl } from "./site";

/**
 * Structural guards for the sitemap CONSUMER of the indexing policy.
 *
 * Expectations are derived from `indexableLocales()` rather than hardcoded, and the route
 * fixtures are synthetic — no province or country is named (CONVENTIONS §2).
 */
describe("sitemapEntriesFor — indexing policy contract", () => {
  const lastModified = new Date("2026-01-01T00:00:00.000Z");

  for (const surface of SURFACES) {
    for (const route of ROUTE_FIXTURES) {
      const label = `${surface} · ${route.name}`;

      it(`emits exactly one entry per indexable locale — ${label}`, () => {
        const entries = sitemapEntriesFor(route.hrefForLocale, lastModified, 0.7, surface);
        const expected = indexableLocales(surface).map((locale) =>
          absoluteUrl(getPathname({ locale, href: route.hrefForLocale(locale) })),
        );
        expect(entries.map((entry) => entry.url)).toEqual(expected);
      });

      it(`omits every de-indexed locale's URL from the urlset — ${label}`, () => {
        const entries = sitemapEntriesFor(route.hrefForLocale, lastModified, 0.7, surface);
        const urls = entries.map((entry) => entry.url);
        for (const locale of routing.locales) {
          if (isIndexable(locale, surface)) continue;
          // A sitemap entry is a request to index; listing a `noindex` URL would send the
          // crawler two opposite signals for the same URL.
          const deIndexedUrl = absoluteUrl(
            getPathname({ locale, href: route.hrefForLocale(locale) }),
          );
          expect(urls).not.toContain(deIndexedUrl);
        }
      });

      it(`annotates every entry with the indexable alternates + x-default — ${label}`, () => {
        const entries = sitemapEntriesFor(route.hrefForLocale, lastModified, 0.7, surface);
        const expectedKeys = [...indexableLocales(surface), "x-default"].sort();
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
          expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(expectedKeys);
          expect(entry.lastModified).toBe(lastModified);
        }
      });

      it(`keeps sitemap alternates absolute and never de-indexed — ${label}`, () => {
        const languages = alternateLanguagesFor(route.hrefForLocale, surface);
        for (const value of Object.values(languages)) {
          expect(value.startsWith("http")).toBe(true);
        }
        for (const locale of routing.locales) {
          if (!isIndexable(locale, surface)) {
            expect(Object.keys(languages)).not.toContain(locale);
          }
        }
      });

      /**
       * The drift guard. Search Central treats sitemap `xhtml:link` annotations as
       * EQUIVALENT to the in-`<head>` tags, so if these two sets ever disagree the site
       * contradicts itself across surfaces. Both derive from `indexableLocales()` today;
       * this asserts that they still do.
       */
      it(`agrees with the in-head hreflang cluster — ${label}`, () => {
        const sitemapKeys = Object.keys(alternateLanguagesFor(route.hrefForLocale, surface)).sort();
        // Compare against the head cluster of an INDEXABLE locale: a de-indexed page
        // carries no cluster at all, so the default locale is the meaningful comparand.
        const head = buildAlternates(routing.defaultLocale, route.hrefForLocale, surface);
        expect(Object.keys(head.languages ?? {}).sort()).toEqual(sitemapKeys);
      });
    }
  }

  it("defaults an unspecified surface to fully indexable (fail-safe direction)", () => {
    const entries = sitemapEntriesFor(() => "/", lastModified, 1);
    expect(entries.length).toBe(routing.locales.length);
  });

  // A fully de-indexed page contributes NOTHING to the sitemap — not a stripped-down
  // entry, not a TR-only one (→ DEC 2026-07-30p). A sitemap entry is a request to index.
  it("emits no entry at all for a noindex surface", () => {
    expect(sitemapEntriesFor(NOINDEX_ROUTE.hrefForLocale, lastModified, 0.5, "noindex")).toEqual(
      [],
    );
  });
});
