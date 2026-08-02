import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * `/llms.txt` — a concise, machine-readable map of the site for LLM-based crawlers and
 * agents (the emerging llms.txt convention, https://llmstxt.org). Served as a route
 * handler (Next has no native metadata-file convention for it, unlike `robots.ts` /
 * `sitemap.ts` / `manifest.ts`); a folder literally named `llms.txt` maps to `/llms.txt`,
 * and the leading dot makes `proxy.ts` skip locale rewriting on it (same bypass as
 * `/sitemap.xml` / `/robots.txt`).
 *
 * Fully static: content derives only from build-time constants + `NEXT_PUBLIC_SITE_URL`,
 * so `force-static` lets it be cached/emitted at build like `robots.ts`. This is a
 * STRUCTURAL document, not a per-request feed — no api calls, no dynamic data.
 *
 * Single, locale-neutral file (llms.txt has no locale variants): the descriptive prose is
 * in English (the lingua franca these agents read) and clearly states the site is
 * Turkish-first, while linking BOTH the TR (`/`) and EN (`/en`) roots so neither locale is
 * hidden from an ingesting agent. All links are built through `getPathname` + `absoluteUrl`
 * — the same helpers as canonicals/sitemap — so the localized slugs (e.g. `/en/about`)
 * can never drift from the routing table. The sitemap pointer is the authoritative set of
 * INDEXABLE URLs; this file is the human/agent-legible overview, not a crawl index.
 *
 * The prose below must not over-claim the sitemap's contents. Detail pages are currently
 * indexable in Turkish only (`lib/seo/indexing.ts` — EN detail pages are `noindex` until
 * real EN narrative content lands), so the sitemap is NOT "every URL in both locales".
 * This file ships to LLM crawlers as published text, not as a comment — keep it true.
 */

export const dynamic = "force-static";

type Href = Parameters<typeof getPathname>[0]["href"];

function url(locale: (typeof routing.locales)[number], href: Href): string {
  return absoluteUrl(getPathname({ locale, href }));
}

function buildLlmsTxt(): string {
  const sitemapUrl = absoluteUrl("/sitemap.xml");

  return `# Coğrafya Platformu

> Free, open geography education platform for Türkiye and the world. Turkish-first (TR at the root, English under /en), with source-grounded content on the 81 provinces of Türkiye, world countries, landforms and geography concepts.

Coğrafya Platformu is an education project. All content is free to read, grounded in authoritative sources, and passes an independent verification step before publication. Every page is served as fully server-rendered HTML. This file is a concise structural overview; use the sitemap for the complete set of indexable URLs. Note: detail pages (provinces, countries) are currently published in Turkish only — their English counterparts are served with a "noindex" directive until English narrative content is written.

## Main sections (Turkish, default locale)

- [Ana Sayfa (Home)](${url("tr", "/")}): Overview and entry point to the province and country hubs.
- [Türkiye](${url("tr", "/turkiye")}): Interactive map hub linking the detail pages for all 81 provinces of Türkiye.
- [Dünya (World)](${url("tr", "/dunya")}): World map hub linking country detail pages.
- [Deniz (Sea)](${url("tr", "/deniz")}): Marine hub for the coasts of Türkiye — offshore reference points, the measurement catalogue, and explanatory blocks on wave height, wind and sea-surface temperature. Turkish only; its English counterpart is served with "noindex".
- [Oyun (Map Game)](${url("tr", "/oyun")}): A map game for locating the provinces of Türkiye. The hub page describes the game; the individual play screens are application screens and are served with "noindex".
- [Hakkımızda (About)](${url("tr", "/hakkimizda")}): What the platform is and how its content is sourced and verified.

## Main sections (English)

- [Home](${url("en", "/")})
- [Türkiye](${url("en", "/turkiye")})
- [World](${url("en", "/dunya")})
- [Map Game](${url("en", "/oyun")})
- [About](${url("en", "/hakkimizda")})

## Full crawl discovery

- [Sitemap](${sitemapUrl}): Every indexable URL, with hreflang annotations and real last-modified dates. Sections listed above appear in both locales; detail pages appear in Turkish only for now.
`;
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Metadata document — safe to cache aggressively at the edge/CDN. Mirrors the
      // long-lived, rarely-changing nature of robots/sitemap structural files.
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
