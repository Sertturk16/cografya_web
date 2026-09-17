import type { ComponentProps } from "react";
import type { Link } from "@/i18n/navigation";

/**
 * WHERE THE MARINE LICENCE TEXT LIVES — written down once, in one place.
 *
 * ECMWF Open Data is CC BY 4.0, and §3(a)(2) permits the required information to be carried by
 * "a URI or hyperlink to a resource that includes" it. The platform takes that option: the full
 * ECMWF and Copernicus Marine notices are published on `/hakkimizda` (`/en/about`) and every
 * surface that publishes a derived value links here.
 *
 * The consequence is that this anchor is load-bearing in the licence sense — a renamed `id` on
 * the About page, or a typo here, breaks the hyperlink that IS the attribution. So the fragment
 * is a constant shared by the About page's `id`, the value surfaces' notice and the footer's
 * source badges, and `components/marine/marine-attribution-coverage.test.ts` checks that the
 * page still carries it.
 *
 * `hash` is not part of next-intl's typed `href` union for a localized pathname, so the object
 * is widened through the escape `CLAUDE.md` prescribes for exactly this case — never `as any`.
 */
export const MARINE_SOURCES_FRAGMENT = "veri-kaynaklari";

export const MARINE_SOURCES_ANCHOR = {
  pathname: "/hakkimizda",
  hash: MARINE_SOURCES_FRAGMENT,
} as unknown as ComponentProps<typeof Link>["href"];
