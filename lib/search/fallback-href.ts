import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PROVINCE_INDEX_SECTION_ID } from "@/lib/geo/hub-index";

/**
 * Where the header search points when JavaScript has not (or cannot) take over.
 *
 * The search box is server-rendered as a real `<a>` before the island upgrades it, so this
 * href is the difference between a dead control and a working one for a reader on a failed
 * bundle, a text browser or a crawler. It aims at the alphabetical province index, which is
 * the closest thing the site has to "the list of everything" and — since PR #44 — is real
 * server-rendered content rather than a promise.
 *
 * The hub path itself is resolved through `getPathname`, never concatenated by hand
 * (`SEO-POLICY.md` §B4.5); only the fragment is appended, and a fragment is not part of the
 * route. The result is `/turkiye#iller` in Turkish and `/en/turkiye#iller` in English.
 */
export function searchFallbackHref(locale: Locale): string {
  return `${getPathname({ locale, href: "/turkiye" })}#${PROVINCE_INDEX_SECTION_ID}`;
}
