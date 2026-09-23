import type { ComponentProps } from "react";
import type { Link } from "@/i18n/navigation";

/**
 * WHERE THE C3S / ERA5-LAND LICENCE NOTICE LIVES — the climate twin of
 * `lib/marine/attribution-anchor.ts`.
 *
 * ERA5-Land is CC BY 4.0, and §3(a)(2) permits the required information to be carried by "a URI
 * or hyperlink to a resource that includes" it. So the verbatim C3S notice is published once, in
 * `ClimateAttribution` on `/hakkimizda` (`/en/about`), and every `ClimateSection` carries a
 * "Lisans" link to it beside its source line. The fragment is shared by the block's `id` and that
 * link, so neither can drift from the other; `lib/climate/attribution-notice.test.ts` checks both
 * ends.
 *
 * `hash` is not part of next-intl's typed `href` union for a localized pathname, so the object is
 * widened through the escape `CLAUDE.md` prescribes for exactly this case — never `as any`.
 */
export const CLIMATE_LICENCE_FRAGMENT = "iklim-verisi";

export const CLIMATE_LICENCE_ANCHOR = {
  pathname: "/hakkimizda",
  hash: CLIMATE_LICENCE_FRAGMENT,
} as unknown as ComponentProps<typeof Link>["href"];
