import type { HrefForLocale } from "@/lib/seo/sitemap-entries";

/**
 * Shared route fixtures for the SEO policy tests.
 *
 * These are SYNTHETIC routes, not real entities. `CONVENTIONS.md` §2 bars tests from
 * asserting facts about any particular province or country — the contract under test is
 * structural ("a de-indexed locale never appears in the urlset or the hreflang cluster"),
 * and it must hold for any entity, so the fixtures deliberately use placeholder slugs.
 *
 * Three shapes are covered because they exercise different `getPathname` paths:
 * a STATIC route (same segment in both locales), a LOCALIZED-SEGMENT route (a different
 * static pathname per locale, `/hakkimizda ↔ /en/about`), and a LOCALIZED-SLUG dynamic
 * route (a different `[slug]` value per locale — where a one-legged hreflang is actually
 * possible).
 *
 * `/oyun ↔ /en/game` is the second localized-segment entry rather than a fourth shape: it
 * is here because it is a REAL route whose two URLs are asymmetric, so the policy matrix
 * runs against the actual `pathnames` table, not only against a representative shape.
 */
export interface RouteFixture {
  readonly name: string;
  readonly hrefForLocale: HrefForLocale;
}

export const ROUTE_FIXTURES: readonly RouteFixture[] = [
  {
    name: "static route (/)",
    hrefForLocale: () => "/",
  },
  {
    name: "localized-segment route (/hakkimizda ↔ /en/about)",
    hrefForLocale: () => "/hakkimizda",
  },
  {
    name: "localized-segment route (/oyun ↔ /en/game)",
    hrefForLocale: () => "/oyun",
  },
  // The marine hub — a real localized-segment route that is ALSO the first STATIC route
  // carried on the `"trNarrative"` surface. Until now that surface was exercised only by
  // the two localized-SLUG routes, so the policy matrix never checked that a de-indexed
  // static segment (`/en/sea`) drops out of the urlset and the hreflang cluster the same
  // way a de-indexed slug does.
  {
    name: "localized-segment route (/deniz ↔ /en/sea)",
    hrefForLocale: () => "/deniz",
  },
  {
    name: "localized-slug province route (/turkiye/[slug])",
    hrefForLocale: (locale) => ({
      pathname: "/turkiye/[slug]",
      params: { slug: `fixture-province-${locale}` },
    }),
  },
  {
    name: "localized-slug country route (/dunya/[slug])",
    hrefForLocale: (locale) => ({
      pathname: "/dunya/[slug]",
      params: { slug: `fixture-country-${locale}` },
    }),
  },
];

/**
 * The INDEXABLE surfaces, so every test runs the full policy matrix over them.
 *
 * `"noindex"` is deliberately NOT in this list. The matrix asserts things that only make
 * sense for a page some locale indexes — "one urlset entry per indexable locale", "the
 * cluster contains x-default" — and a fully de-indexed surface has no such locale. It gets
 * its own block in each policy test instead, asserting the opposite properties (no robots
 * silence, no `languages` map, no sitemap entry at all).
 */
export const SURFACES = ["localized", "trNarrative"] as const;

/**
 * A route of the fully de-indexed class — today the game's play screens (→ DEC
 * 2026-07-30p). Real, not synthetic, for the same reason `/oyun` is above: the assertion
 * should run against the actual `pathnames` table.
 */
export const NOINDEX_ROUTE: RouteFixture = {
  name: "game play screen (/oyun/81-il ↔ /en/game/81-provinces)",
  hrefForLocale: () => "/oyun/81-il",
};
