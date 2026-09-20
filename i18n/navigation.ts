/**
 * Locale-aware navigation primitives. Always import `Link`, `redirect`,
 * `usePathname`, `useRouter`, `getPathname` from here (never from `next/link` /
 * `next/navigation` directly) so locale prefixes and localized `pathnames` are
 * applied automatically. `getPathname` is also the single source for building
 * hreflang alternates in `lib/seo/metadata.ts`.
 *
 * `Link` AND `useRouter` ARE WRAPPED (T-062): before a navigation starts they ask
 * `lib/forms/unsaved-changes.ts` whether a form on the page is holding unsaved edits, and if one
 * is, the navigation is held and `components/v2/v2-unsaved-changes-dialog.tsx` asks the member
 * first. The props, the typed hrefs and the behaviour when nothing is dirty are unchanged, which
 * is the point of wrapping here: 56 files import from this module and not one of them changed.
 *
 * `redirect`, `usePathname` and `getPathname` are next-intl's own, unwrapped — a server redirect
 * has no form to protect and `getPathname` navigates nothing.
 */
export { redirect, usePathname, getPathname } from "./navigation-primitives";
export { Link, useRouter } from "@/i18n/guarded-navigation.client";
