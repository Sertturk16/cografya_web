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
 * `AUTH_PATHNAMES` is the SINGLE canonical list of auth routes — `lib/seo/auth-routes.test.ts`
 * derives its own page-file scan from this array rather than hand-maintaining a second one
 * (review `TEST85-M1`/`C3`), so adding a route HERE is the only place-of-record edit a new
 * auth screen needs on the SEO side. PR-1 shipped `/giris` + the two `/sifre-sifirlama`
 * screens; PR-2 added `/kayit` and `/e-posta-dogrulama` here and to `i18n/routing.ts`
 * together, in the same PR that built their pages.
 */
export const AUTH_PATHNAMES = [
  "/giris",
  "/sifre-sifirlama",
  "/sifre-sifirlama/yeni",
  "/kayit",
  "/e-posta-dogrulama",
  // The v2 post-registration profile-completion route (DEC 2026-09-03a md.1).
  // Joined to AUTH_PATHNAMES so the personal-data route receives audited
  // noindex/canonical/hreflang test coverage in lib/seo/auth-routes.test.ts.
  // Note: /v2/giris and /v2/kayit remain outside AUTH_PATHNAMES today (D-4)
  // because their v2 shells were introduced before this centralization.
  "/v2/profil",
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
