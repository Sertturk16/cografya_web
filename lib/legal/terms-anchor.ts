import type { ComponentProps } from "react";
import type { Link } from "@/i18n/navigation";

/**
 * WHERE THE PLATFORM'S TERMS LIVE, AND WHERE THEIR KVKK SECTION IS — written once (T-073).
 *
 * The terms of use and the privacy/KVKK text are ONE page, `/kullanim-sartlari` (`/en/terms`),
 * because the privacy half of a platform this size is a section rather than a document and two
 * routes would be two legal texts to keep in step. The register card's consent line still names
 * both, as a reader expects to read them, so the second link needs this fragment.
 *
 * A MODULE OF ITS OWN, not an export from the page, and that is the point of the file: the
 * register card is a `"use client"` component, and importing a constant out of a server page
 * would pull `next-intl/server` and everything below it into the client bundle. The precedent
 * is `lib/marine/attribution-anchor.ts`, which exists for the same reason.
 *
 * `hash` is not part of next-intl's typed `href` union for a localized pathname, so the object
 * is widened through the escape `CLAUDE.md` prescribes for exactly this case — never `as any`.
 */
export const PRIVACY_FRAGMENT = "gizlilik";

export const PRIVACY_ANCHOR = {
  pathname: "/kullanim-sartlari",
  hash: PRIVACY_FRAGMENT,
} as unknown as ComponentProps<typeof Link>["href"];
