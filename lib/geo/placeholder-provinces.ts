import type { Locale } from "@/i18n/routing";

/**
 * PLACEHOLDER routing fixture — NOT real content.
 *
 * These entries exist ONLY to exercise the localized-slug detail-page pattern
 * (slug_tr / slug_en resolution, hreflang symmetry, sitemap generation, and
 * `notFound()` on unknown slugs) end to end while the real `Province` entity is
 * built in the api repo (Deniz, PR-1a). They carry NO geographic facts
 * (no population / area / coordinates) on purpose — so nothing here needs
 * fact-checking. When real data lands, replace this module wholesale with the
 * typed API client; do NOT accrete facts onto this fixture.
 *
 * Note: `slug` is intentionally keyed per-locale. Turkish province slugs happen
 * to be identical in TR/EN, but the resolver + routing handle divergent slugs
 * (which concept/landform pages will have) without any change.
 */
export interface PlaceholderProvince {
  id: number;
  slug: Record<Locale, string>;
  name: Record<Locale, string>;
  /** ISO date standing in for the api `updated_at` (drives real sitemap lastmod). */
  updatedAt: string;
}

export const placeholderProvinces: readonly PlaceholderProvince[] = [
  {
    id: 34,
    slug: { tr: "istanbul", en: "istanbul" },
    name: { tr: "İstanbul", en: "Istanbul" },
    updatedAt: "2026-07-07",
  },
  {
    id: 6,
    slug: { tr: "ankara", en: "ankara" },
    name: { tr: "Ankara", en: "Ankara" },
    updatedAt: "2026-07-07",
  },
  {
    id: 35,
    slug: { tr: "izmir", en: "izmir" },
    name: { tr: "İzmir", en: "Izmir" },
    updatedAt: "2026-07-07",
  },
];

export function findProvinceBySlug(locale: Locale, slug: string): PlaceholderProvince | undefined {
  return placeholderProvinces.find((province) => province.slug[locale] === slug);
}
