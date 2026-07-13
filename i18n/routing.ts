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
 * - `pathnames`: route segments. `/hakkimizda` ↔ `/en/about` stays a LOCALIZED
 *   segment. `/turkiye` and `/turkiye/[slug]` (the map hub + province detail, IA
 *   restructure → DEC 2026-07-13) use a SINGLE segment for both locales on purpose:
 *   "Türkiye" is a proper noun the site already uses verbatim in its English copy
 *   (see `Home.metaTitle` en), so `/turkiye` ↔ `/en/turkiye` reads correctly in both
 *   languages, keeps the URL free of any "harita" word, and reserves a clean,
 *   collision-free symmetry for the future `/dunya` world hub (→ DEC 2026-07-13). The
 *   dynamic `[slug]` VALUE is still the localized slug (`slug_tr` / `slug_en`) supplied
 *   per-locale by the caller — resolution lives in the page + `lib/api`, not here.
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
    "/turkiye": "/turkiye",
    "/turkiye/[slug]": "/turkiye/[slug]",
    // `/dunya` + `/dunya/[slug]` (the world map hub + country detail, → DEC 2026-07-13)
    // mirror `/turkiye` one level up. Like "Türkiye", "dünya" reads correctly in the
    // English copy too, so a SINGLE segment serves both locales (no "world"/"harita"
    // word, no future naming collision — the reserved symmetry now realised). The
    // dynamic `[slug]` VALUE is still the localized slug (`slug_tr` / `slug_en`).
    "/dunya": "/dunya",
    "/dunya/[slug]": "/dunya/[slug]",
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
