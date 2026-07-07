import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Always import `Link`, `redirect`,
 * `usePathname`, `useRouter`, `getPathname` from here (never from `next/link` /
 * `next/navigation` directly) so locale prefixes and localized `pathnames` are
 * applied automatically. `getPathname` is also the single source for building
 * hreflang alternates in `lib/seo/metadata.ts`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
