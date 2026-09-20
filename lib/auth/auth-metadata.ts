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
  // `/profil` was here until T-061 retired it. It is now a `next.config.ts` redirect with no
  // page behind it, so there is no metadata to audit — its personal data, and the audited
  // coverage that goes with it, moved to `/hesabim/ayarlar` below.
  // The dedicated member area / hub (UYE-P3).
  "/hesabim",
  // T-061: account management, moved off the hub and off `/profil` into its own route. It
  // carries more personal data than any other page on the site, so it belongs in this array
  // for exactly the reason `/profil` does — the audited noindex/canonical/hreflang coverage.
  "/hesabim/ayarlar",
  // T-032 PR3 retired the version prefix, so each route appears here exactly once. The old
  // D-4 note — that the prefixed login and register shells sat outside this array because
  // they predated the centralization — is resolved rather than carried: those shells now
  // serve `/giris` and `/kayit`, which were already members.
] as const satisfies readonly AppPathname[];

export type AuthPathname = (typeof AUTH_PATHNAMES)[number];

/**
 * De-indexed in BOTH locales, `noindex,follow`, self-canonical, no hreflang cluster, no
 * sitemap entry — `roadmap.md` UYELIK-04's SEO line and `DEC 2026-08-20i` md.5 (plan §4.2).
 *
 * EXPORTED, not private to {@link buildAuthMetadata}, because each of the seven auth pages types
 * the surface a SECOND time as `<Breadcrumbs surface={…}>` — the prop the breadcrumb JSON-LD's
 * indexability gate is computed from. They import this constant rather than writing `"noindex"`
 * there, the shape `TOOLS_SURFACE` (`lib/tools/tool-registry.ts`) already uses on `araclar/**`,
 * and `lib/seo/sitemap-surface-symmetry.test.ts` compares the two sides on every page.
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
