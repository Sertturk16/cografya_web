import { defineRouting } from "next-intl/routing";

/**
 * Central i18n routing config (CONVENTIONS §3 web foundations).
 *
 * - Sub-path routing: TR at root `/`, EN at `/en/...`.
 * - `localePrefix: "as-needed"` keeps the default locale (TR) unprefixed at `/`
 *   while EN gets a distinct `/en` prefix. It is deliberately NOT `"never"`:
 *   the SEO strategy requires a distinct, crawlable URL per locale (CONVENTIONS §6).
 * - `localeDetection: false`: no Accept-Language / cookie based auto-redirect on `/`.
 *   For an SEO-first site this keeps every URL deterministic for crawlers (Googlebot
 *   crawls from the US and must still land on the TR default at `/`, never be bounced
 *   to `/en`). hreflang — not header sniffing — is what points users at their language.
 * - `pathnames`: localized STATIC route segments (`/il` ↔ `/en/province`,
 *   `/iller` ↔ `/en/provinces`, `/hakkimizda` ↔ `/en/about`). The dynamic `[slug]`
 *   VALUE is the localized slug (`slug_tr` / `slug_en`) supplied per-locale by the
 *   caller — resolution lives in the page + `lib/geo`, not here.
 */
export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  localePrefix: "as-needed",
  localeDetection: false,
  pathnames: {
    "/": "/",
    "/hakkimizda": {
      tr: "/hakkimizda",
      en: "/about",
    },
    "/iller": {
      tr: "/iller",
      en: "/provinces",
    },
    "/il/[slug]": {
      tr: "/il/[slug]",
      en: "/province/[slug]",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
