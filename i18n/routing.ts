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
    // The book tier: the `/kitaplar` hub + the book detail page (→ DEC 2026-08-15c; IA row
    // in `CONVENTIONS.md` §5 + `SEO-POLICY.md` §B4). LOCALIZED segment, governed by the
    // `/hakkimizda ↔ /en/about` and `/deniz ↔ /sea` precedent rather than the
    // `/turkiye`/`/dunya` one: "kitaplar" does not read as English at all.
    //
    // BOTH EN URLS ARE PERMANENTLY `noindex` (`surface: "trOnly"`, `lib/seo/indexing.ts`) —
    // the detail twin by DEC 2026-08-15c, the hub by DEC 2026-08-15g V-4. Declaring the
    // segments here is still mandatory, for exactly the reason the `/deniz` entry above
    // gives: a `noindex` page must still resolve to exactly ONE correct URL per locale, and
    // changing that URL later owes a redirect. Canonical, hreflang, the sitemap entry and
    // every internal link derive from these two lines through `getPathname` — none of them
    // is ever hand-written.
    //
    // The dynamic `[slug]` VALUE is the localized slug (`slugTr` / `slugEn`) supplied
    // per-locale by the caller from the api payload. They are two separate columns even
    // though today's only book carries the same string in both — a product name is not
    // translated, which is a consequence rather than a rule — and the web derives neither
    // from the other (`SEO-POLICY.md` §B4 4.5, BLOCKER).
    "/kitaplar": {
      tr: "/kitaplar",
      en: "/books",
    },
    "/kitaplar/[slug]": {
      tr: "/kitaplar/[slug]",
      en: "/books/[slug]",
    },
    // The CBS tool tier (→ DEC 2026-08-19a md.3/md.4). LOCALIZED segment, governed by the
    // `/hakkimizda ↔ /en/about`, `/deniz ↔ /en/sea` and `/kitaplar ↔ /en/books` precedent
    // rather than the `/turkiye`/`/dunya` one: "araçlar" does not read as English at all.
    //
    // FOUR STATIC ROUTES RATHER THAN ONE `[slug]` ROUTE (plan-web.md §2.2, Atlas ruling
    // V-1); the direct precedent is `/oyun`'s three mode screens above. It also makes
    // `SEO-POLICY.md` §B4 4.5 unbreakable here — there is no slug value to derive per
    // locale — and it turns an unknown tool path into Next's own 404 rather than something
    // a page has to remember to call `notFound()` for.
    //
    // The EN twins are `noindex` (`surface: "trNarrative"`, md.6, the `/deniz` pattern).
    // Declaring the segments is still mandatory, for the reason the `/deniz` and
    // `/kitaplar` entries give above: a `noindex` page must resolve to exactly ONE correct
    // URL per locale, and changing that URL later owes a redirect.
    //
    // A TOOL SEGMENT LANDS WITH ITS PAGE, NOT BEFORE IT
    // (→ `Owner's Inbox/cbs-p2/pr-b/TASK-CONTEXT.md` md.7). `plan-web.md` §2.1 lists all four
    // pathnames at once because it describes the finished tier; the recorded deviation is that
    // each tool's segment arrived in the PR that built it — distance in PR-B, coordinate lookup
    // in PR-C, area calculation in PR-D, which is the one that completes the table. A declared
    // pathname with no page behind it is a 404 the hub would have to link to or the sitemap
    // would have to carry, and A4/3 rates a dead link a BLOCKER. The cost of adding a segment
    // late is one line here; the cost of declaring it early is a broken URL in the index.
    //
    // The TR segments are `GLOSSARY.md` §4.3's canonical tool names put through §5's folding
    // (`ölçme → olcme`, `bulma → bulma`, `hesaplama → hesaplama`); `tool-registry.test.ts` pins it to
    // `[a-z0-9-]+` in both locales.
    "/araclar": {
      tr: "/araclar",
      en: "/tools",
    },
    "/araclar/mesafe-olcme": {
      tr: "/araclar/mesafe-olcme",
      en: "/tools/distance",
    },
    "/araclar/koordinat-bulma": {
      tr: "/araclar/koordinat-bulma",
      en: "/tools/coordinates",
    },
    "/araclar/alan-hesaplama": {
      tr: "/araclar/alan-hesaplama",
      en: "/tools/area",
    },
    // The tool tier's 404 BOUNDARY, not a fourth tool (fix round, İRİS post-merge live-audit
    // finding A1 — `app/[locale]/araclar/[...rest]/page.tsx`'s own docblock has the full
    // diagnosis). Declared here, symmetric in both locales, so next-intl's middleware can
    // reverse-map an unknown EN path (`/en/tools/anything`) back to this canonical
    // `/araclar/…` segment before Next's router matches it — without this entry the EN alias
    // alone (undeclared) would stay untranslated and never reach the catch-all page at all,
    // verified empirically (curl) both ways during this fix.
    "/araclar/[...rest]": {
      tr: "/araclar/[...rest]",
      en: "/tools/[...rest]",
    },
    // The auth page shell — login, password reset, registration and e-mail verification
    // (UYELIK-04, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md` §4.1;
    // PR-1 shipped the first three, PR-2 added the last two). LOCALIZED segments, on the
    // `/hakkimizda ↔ /en/about` precedent: none of these Turkish words reads as English,
    // unlike `/turkiye`/`/dunya`.
    //
    // `/giris` and `/kayit` are `GLOSSARY.md` §7's canonical routes verbatim.
    //
    // ALL FIVE ARE `surface: "noindex"` (`lib/auth/auth-metadata.ts`'s `AUTH_SURFACE`) —
    // `noindex, follow` in both locales, never `Disallow` (`ENGINEERING.md` §4 #8). A
    // `noindex` page still must resolve to exactly ONE correct URL per locale, which is why
    // the segments are declared here even though nothing links to `/en/*` twins from an
    // indexable page.
    "/giris": {
      tr: "/giris",
      en: "/login",
    },
    // `sifre sıfırlama` folded per `GLOSSARY.md` §5 (`ş→s`, `ı→i`). The confirm step is
    // `/sifre-sifirlama/yeni`, NOT `/sifre-sifirlama/onay` — `GLOSSARY.md` §7 records that
    // *onay* carries a different, KVKK-specific meaning and must not be reused here.
    "/sifre-sifirlama": {
      tr: "/sifre-sifirlama",
      en: "/reset-password",
    },
    "/sifre-sifirlama/yeni": {
      tr: "/sifre-sifirlama/yeni",
      en: "/reset-password/new",
    },
    // `/kayit` lands with the register page (PR-2) — the same "a segment lands with its
    // page" rule the CBS tool tier records for itself above; the footer's `Üye ol` link
    // (`components/site-footer.tsx`) lands in the same PR.
    "/kayit": {
      tr: "/kayit",
      en: "/register",
    },
    // `e-posta doğrulama` folded per `GLOSSARY.md` §5 (no `ş`/`ğ`/`ı`/`ö`/`ü` to fold here;
    // only the spaces become hyphens). The bare noun, not `…-kodu`: `SEO-POLICY.md` §B4 4.7
    // penalises a needless segment, not a needed one — "doğrulama" alone would not say what
    // is verified, but "kodu" adds nothing "e-posta-dogrulama" doesn't already say (plan §4.1).
    "/e-posta-dogrulama": {
      tr: "/e-posta-dogrulama",
      en: "/verify-email",
    },
    // The earthquake hub (AFAD, → DEC 2026-08-29a; `SEO-POLICY.md` §B4's own IA row). LOCALIZED
    // segment, on the `/hakkimizda ↔ /en/about` / `/deniz ↔ /en/sea` precedent: "deprem" does
    // not read as English at all. `/en/earthquakes` is plain and descriptive — no `ş`/`ğ`/`ı`/
    // `ö`/`ü`/`ç` to fold (`GLOSSARY.md` §5). Singular-noun hub, like `/deniz` and `/oyun`, not
    // a plural catalogue like `/kitaplar`/`/araclar`: "deprem" names the subject, not an
    // enumerable list of separate items. `surface: "localized"` (§5.14) — fully indexable in
    // both locales from day one, so this segment is never a permanent `noindex` twin the way
    // `/kitaplar/[slug]` is.
    "/deprem": {
      tr: "/deprem",
      en: "/earthquakes",
    },
    "/v2": {
      tr: "/v2",
      en: "/v2",
    },
    "/v2/turkiye": {
      tr: "/v2/turkiye",
      en: "/v2/turkey",
    },
    "/v2/turkiye/[slug]": {
      tr: "/v2/turkiye/[slug]",
      en: "/v2/turkey/[slug]",
    },
    "/v2/dunya": {
      tr: "/v2/dunya",
      en: "/v2/world",
    },
    "/v2/dunya/[slug]": {
      tr: "/v2/dunya/[slug]",
      en: "/v2/world/[slug]",
    },
    "/v2/deniz": {
      tr: "/v2/deniz",
      en: "/v2/sea",
    },
    "/v2/oyun": {
      tr: "/v2/oyun",
      en: "/v2/game",
    },
    "/v2/oyun/bolge-bulma": {
      tr: "/v2/oyun/bolge-bulma",
      en: "/v2/game/find-the-region",
    },
    "/v2/oyun/81-il": {
      tr: "/v2/oyun/81-il",
      en: "/v2/game/81-provinces",
    },
    "/v2/oyun/bolge-bolge-il": {
      tr: "/v2/oyun/bolge-bolge-il",
      en: "/v2/game/provinces-by-region",
    },
    "/v2/oyun/bolge-bolge-il/[bolge]": {
      tr: "/v2/oyun/bolge-bolge-il/[bolge]",
      en: "/v2/game/provinces-by-region/[bolge]",
    },
    "/v2/deprem": {
      tr: "/v2/deprem",
      en: "/v2/earthquakes",
    },
    "/v2/araclar": {
      tr: "/v2/araclar",
      en: "/v2/tools",
    },
    "/v2/araclar/mesafe-olcme": {
      tr: "/v2/araclar/mesafe-olcme",
      en: "/v2/tools/distance",
    },
    "/v2/araclar/koordinat-bulma": {
      tr: "/v2/araclar/koordinat-bulma",
      en: "/v2/tools/coordinates",
    },
    "/v2/araclar/alan-hesaplama": {
      tr: "/v2/araclar/alan-hesaplama",
      en: "/v2/tools/area",
    },
    "/v2/kitaplar": {
      tr: "/v2/kitaplar",
      en: "/v2/books",
    },
    "/v2/kitaplar/[slug]": {
      tr: "/v2/kitaplar/[slug]",
      en: "/v2/books/[slug]",
    },
    "/v2/giris": {
      tr: "/v2/giris",
      en: "/v2/login",
    },
    "/v2/kayit": {
      tr: "/v2/kayit",
      en: "/v2/register",
    },
    // The v2 post-registration profile-completion step (`DEC 2026-09-03a` md.1's destination
    // half). LOCALIZED segment on the `/v2/giris ↔ /v2/login` · `/v2/kayit ↔ /v2/register`
    // precedent: "profil" is a Turkish word that does not read as English, so the governing
    // rule is `/hakkimizda ↔ /en/about`, not `/turkiye`'s shared segment.
    //
    // `surface: "noindex"` in BOTH locales (`lib/auth/auth-metadata.ts`'s `AUTH_SURFACE`) —
    // this is an authenticated personal-data page. A `noindex` page still must resolve to
    // exactly ONE correct URL per locale, which is why the segment is declared here.
    "/v2/profil": {
      tr: "/v2/profil",
      en: "/v2/profile",
    },
    "/design-system": {
      tr: "/design-system",
      en: "/design-system",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
