import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { indexableLocales, isIndexable } from "./indexing";
import { buildAlternates, buildMetadata } from "./metadata";
import { NOINDEX_ROUTE, ROUTE_FIXTURES, SURFACES } from "./routes.fixture";

/**
 * Structural guards for the metadata CONSUMER of the indexing policy.
 *
 * `indexing.test.ts` proves the switch itself; this file proves the code that turns that
 * switch into shipped `<head>` behaviour — the surface `SEO-POLICY.md` §B6/§B7 rates
 * BLOCKER-tier. The assertions are parametrized over `routing.locales × ContentSurface ×
 * route shape` and derive their expectations from `indexableLocales()`, so they keep
 * asserting the right thing when `EN_CONTENT_READY` flips or a locale is added — and no
 * province or country is named anywhere (CONVENTIONS §2).
 */
describe("buildAlternates / buildMetadata — indexing policy contract", () => {
  for (const surface of SURFACES) {
    for (const route of ROUTE_FIXTURES) {
      for (const locale of routing.locales) {
        const indexable = isIndexable(locale, surface);
        const label = `${surface} · ${route.name} · ${locale} (${indexable ? "indexable" : "de-indexed"})`;

        it(`emits the correct robots directive — ${label}`, () => {
          const meta = buildMetadata({
            locale,
            hrefForLocale: route.hrefForLocale,
            title: "Fixture title",
            description: "Fixture description",
            surface,
          });

          if (indexable) {
            // An indexable page must emit NO robots meta at all (an absent directive is
            // the strongest "index me" signal; an explicit one invites drift).
            expect(meta.robots).toBeUndefined();
          } else {
            // `follow` is load-bearing: the page stays in the crawl graph so its internal
            // links keep passing signals. A bare `noindex` would be a regression.
            expect(meta.robots).toEqual({ index: false, follow: true });
          }
        });

        it(`builds the correct hreflang cluster — ${label}`, () => {
          const alternates = buildAlternates(locale, route.hrefForLocale, surface);
          const expectedCanonical = getPathname({ locale, href: route.hrefForLocale(locale) });

          // Self-referencing canonical, always — never cross-locale. Combining a
          // cross-locale canonical with `noindex` is the one shape Google warns about.
          expect(alternates.canonical).toBe(expectedCanonical);

          if (indexable) {
            const languages = alternates.languages ?? {};
            expect(Object.keys(languages).sort()).toEqual(
              [...indexableLocales(surface), "x-default"].sort(),
            );
            // x-default must resolve to the default locale's URL.
            expect(languages["x-default"]).toBe(
              getPathname({
                locale: routing.defaultLocale,
                href: route.hrefForLocale(routing.defaultLocale),
              }),
            );
          } else {
            // A de-indexed page belongs to NO cluster: no `languages` map at all, so the
            // annotation can never be one-legged in either direction.
            expect(alternates.languages).toBeUndefined();
          }
        });

        it(`never advertises a de-indexed locale as an alternate — ${label}`, () => {
          const alternates = buildAlternates(locale, route.hrefForLocale, surface);
          const advertised = Object.keys(alternates.languages ?? {});
          for (const candidate of routing.locales) {
            if (!isIndexable(candidate, surface)) {
              expect(advertised).not.toContain(candidate);
            }
          }
        });
      }
    }
  }

  it("never de-indexes the default locale on any surface or route shape", () => {
    for (const surface of SURFACES) {
      for (const route of ROUTE_FIXTURES) {
        const meta = buildMetadata({
          locale: routing.defaultLocale,
          hrefForLocale: route.hrefForLocale,
          title: "Fixture title",
          description: "Fixture description",
          surface,
        });
        // The catastrophic case: the TR corpus is the entire value of the site.
        expect(meta.robots).toBeUndefined();
      }
    }
  });

  it("defaults an unspecified surface to fully indexable (fail-safe direction)", () => {
    for (const locale of routing.locales) {
      const meta = buildMetadata({
        locale,
        hrefForLocale: () => "/",
        title: "Fixture title",
        description: "Fixture description",
      });
      // A new route must opt INTO de-indexing, never silently out of indexing.
      expect(meta.robots).toBeUndefined();
    }
  });

  // The fully de-indexed class (→ DEC 2026-07-30p): `noindex, follow` in EVERY locale, a
  // self-referencing canonical, and NO hreflang cluster on either side. That last part is
  // the DEC 2026-07-18c shape — a noindex member is dissolved OUT of a cluster rather than
  // annotated into one — applied to a page that is noindex in every locale at once.
  describe("a noindex surface", () => {
    for (const locale of routing.locales) {
      it(`emits noindex, follow and no languages map — ${locale}`, () => {
        const meta = buildMetadata({
          locale,
          hrefForLocale: NOINDEX_ROUTE.hrefForLocale,
          title: "Fixture title",
          description: "Fixture description",
          surface: "noindex",
        });

        expect(meta.robots).toEqual({ index: false, follow: true });
        expect(meta.alternates?.canonical).toBe(
          getPathname({ locale, href: NOINDEX_ROUTE.hrefForLocale(locale) }),
        );
        expect(meta.alternates?.languages).toBeUndefined();
      });
    }

    it("never cross-canonicals to another locale", () => {
      // `noindex` + a canonical pointing at a different URL is the one combination Google
      // warns about: it asks the indexer to consolidate onto a page it was told to skip.
      const tr = buildAlternates("tr", NOINDEX_ROUTE.hrefForLocale, "noindex");
      const en = buildAlternates("en", NOINDEX_ROUTE.hrefForLocale, "noindex");

      expect(tr.canonical).not.toBe(en.canonical);
    });
  });
});
