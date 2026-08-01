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
    // The marine hub (→ DEC 2026-08-01, owner answer S2). LOCALIZED segment for the same
    // reason as `/oyun` below and NOT for the reason `/turkiye`/`/dunya` stay single: the
    // word "deniz" does not read as English at all, so the governing precedent is
    // `/hakkimizda ↔ /en/about`. The EN page is `noindex` today (its seven explainer blocks
    // are TR-only), and a localized segment is still required — a `noindex` page must
    // resolve to exactly ONE correct URL per locale, and changing that URL later would owe
    // a redirect. Canonical, hreflang, the sitemap entry, the nav link and the `/turkiye`
    // cross-link all derive from this one line via `getPathname`.
    "/deniz": {
      tr: "/deniz",
      en: "/sea",
    },
    // The map game hub (→ DEC 2026-07-30c, owner answer S1). LOCALIZED segment, unlike
    // `/turkiye` and `/dunya`: those two survive untranslated because "Türkiye" and
    // "dünya" already read correctly inside the site's English copy, whereas "oyun" does
    // not read as English at all. So the governing precedent here is `/hakkimizda` ↔
    // `/en/about`. Canonical, hreflang and the sitemap entry all derive from this one
    // line via `getPathname` — the two URLs are never hand-written anywhere.
    "/oyun": {
      tr: "/oyun",
      en: "/game",
    },
    // One page per game mode (→ DEC 2026-07-30p, reversing the earlier single-page
    // answer). `/oyun` is the shop window; each of these is a screen you play on, and
    // they are born `noindex` (`surface: "noindex"`), so they carry a self-canonical, no
    // hreflang cluster and no sitemap entry. The localized segments are still declared
    // here — a `noindex` page must still resolve to ONE correct URL per locale, and every
    // link to it is built from this table, never hand-written.
    "/oyun/bolge-bulma": {
      tr: "/oyun/bolge-bulma",
      en: "/game/find-the-region",
    },
    "/oyun/81-il": {
      tr: "/oyun/81-il",
      en: "/game/81-provinces",
    },
    "/oyun/bolge-bolge-il": {
      tr: "/oyun/bolge-bolge-il",
      en: "/game/provinces-by-region",
    },
    // The chosen region's round. The `[bolge]` VALUE is the region's own identifier slug
    // and is the SAME string in both locales (`lib/game/region-slug.ts`) — unlike
    // `/turkiye/[slug]`, whose per-locale slug exists to give each locale its own
    // indexable URL. There is no indexable URL here to localize, and one identifier means
    // one `notFound()` rule and one `generateStaticParams` list instead of two.
    "/oyun/bolge-bolge-il/[bolge]": {
      tr: "/oyun/bolge-bolge-il/[bolge]",
      en: "/game/provinces-by-region/[bolge]",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
