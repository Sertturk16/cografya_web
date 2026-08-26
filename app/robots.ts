import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // De-indexing is done with a `noindex` robots META on crawlable pages, NOT
      // with Disallow (the ferrumone pattern, CONVENTIONS §6 #8). Disallow is only
      // for api/raw paths.
      //
      // The web app now has two routes of its own under this prefix:
      // `/api/search-index/{locale}` (the header search's data file) and
      // `/api/auth/[...action]` (the server-only auth transport, UYELIK-03). Disallowing
      // the prefix is correct rather than a de-indexing trick for either — neither is a
      // page, and `SEO-POLICY.md` §B6 6.6/6.7's scope conditions do not reach `/api/**` at
      // all (those clauses audit whether a PAGE was de-indexed with Disallow instead of
      // `noindex`; no `noindex` page is involved here — `CODE84-M7`). The authorising rule
      // is the one already paraphrased above: `robots.txt` Disallow is for api/raw-file
      // paths, not pages (`ENGINEERING.md` §4 #8 / `CONVENTIONS.md` §6 #8). The auth routes
      // additionally answer `Cache-Control: no-store` and set/clear only `HttpOnly`
      // cookies, so nothing under `/api/auth/**` renders content a crawler could want.
      // Nothing links to either surface, so both are undiscoverable in the first place.
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
