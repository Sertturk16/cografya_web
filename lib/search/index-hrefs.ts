import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { COUNTRY_INDEX_SECTION_ID, PROVINCE_INDEX_SECTION_ID } from "@/lib/geo/hub-index";

/**
 * The two alphabetical hub-index destinations the header search offers, resolved per locale.
 *
 * ## Why there are TWO of them now
 *
 * The panel used to end in a single row reading "Tüm il ve ülke listesi" that pointed only at
 * `/turkiye#iller`. The label promised both corpora and the link delivered one, so a reader
 * looking for a country was sent to the province list (owner live-tour finding #4). That row is
 * now two links, one per corpus, and each says exactly where it goes.
 *
 * ## The paths are RESOLVED, never written
 *
 * Each hub path comes from `getPathname`, so a change to the localized routing table moves
 * these with it (`SEO-POLICY.md` §B4.5); only the FRAGMENT is appended, and a fragment is not
 * part of the route. The fragment ids themselves live in `lib/geo/hub-index.ts`, which the hub
 * pages read too — so the jump and the section that answers it cannot drift apart.
 *
 * Neither is an SEO surface: a fragment carries no canonical, no hreflang and no sitemap row.
 */

/**
 * `/turkiye#iller` (tr) · `/en/turkiye#iller` (en) — the alphabetical province index.
 *
 * This is ALSO the header search's no-JavaScript fallback target, and that is a deliberate
 * choice rather than an accident of ordering. The control is server-rendered as a real `<a>`
 * before the island upgrades it, so this href is the difference between a dead control and a
 * working one for a reader on a failed bundle, a text browser or a crawler. The province index
 * is the closest thing the site has to "the list of everything" and — since PR #44 — is real
 * server-rendered content rather than a promise. The pre-hydration control therefore points
 * here; the country link appears with the panel, which only exists once JS runs.
 */
export function provinceIndexHref(locale: Locale): string {
  return `${getPathname({ locale, href: "/turkiye" })}#${PROVINCE_INDEX_SECTION_ID}`;
}

/** `/dunya#ulkeler` (tr) · `/en/dunya#ulkeler` (en) — the alphabetical country index. */
export function countryIndexHref(locale: Locale): string {
  return `${getPathname({ locale, href: "/dunya" })}#${COUNTRY_INDEX_SECTION_ID}`;
}
