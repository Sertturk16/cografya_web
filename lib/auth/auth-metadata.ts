import type { Metadata } from "next";
import type { AppPathname, Locale } from "@/i18n/routing";
import type { ContentSurface } from "@/lib/seo/indexing";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The auth page shell's SEO mechanism (plan §4.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`) — a helper, so a page
 * cannot get the surface wrong by forgetting an argument. Every auth page calls
 * {@link buildAuthMetadata} and NEVER calls `buildMetadata` directly (gate G1 pins this).
 *
 * `AUTH_PATHNAMES` carries only the three routes PR-1 ships (`/giris`,
 * `/sifre-sifirlama`, `/sifre-sifirlama/yeni`); PR-2 adds `/kayit` and
 * `/e-posta-dogrulama` to `i18n/routing.ts` and to this list together, in the same PR that
 * builds their pages.
 */
export const AUTH_PATHNAMES = [
  "/giris",
  "/sifre-sifirlama",
  "/sifre-sifirlama/yeni",
] as const satisfies readonly AppPathname[];

export type AuthPathname = (typeof AUTH_PATHNAMES)[number];

/**
 * De-indexed in BOTH locales, `noindex,follow`, self-canonical, no hreflang cluster, no
 * sitemap entry — `roadmap.md` UYELIK-04's SEO line and `DEC 2026-08-20i` md.5 (plan §4.2).
 */
export const AUTH_SURFACE = "noindex" as const satisfies ContentSurface;

export interface BuildAuthMetadataArgs {
  readonly locale: Locale;
  readonly pathname: AuthPathname;
  readonly title: string;
  readonly description: string;
}

export function buildAuthMetadata(args: BuildAuthMetadataArgs): Metadata {
  const { locale, pathname, title, description } = args;
  return buildMetadata({
    locale,
    hrefForLocale: () => pathname,
    title,
    description,
    surface: AUTH_SURFACE,
  });
}
