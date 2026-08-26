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
      // The web app has several routes of its own under this prefix (the header search's
      // data file, the server-only auth transport, the registration form's reference-data
      // reads — enumerated in each route's own file, not here, on purpose:
      // `SEC84R2-M1`/`CODE84R2-M2` already had to un-write a comment that hand-listed them
      // once and drifted). Disallowing the prefix is correct rather than a de-indexing trick
      // for any of them — none is a page, and `SEO-POLICY.md` §B6 6.6/6.7's scope conditions
      // do not reach `/api/**` at all (those clauses audit whether a PAGE was de-indexed with
      // Disallow instead of `noindex`; no `noindex` page is involved here — `CODE84-M7`). The
      // authorising rule is the one already paraphrased above: `robots.txt` Disallow is for
      // api/raw-file paths, not pages (`ENGINEERING.md` §4 #8 / `CONVENTIONS.md` §6 #8). The
      // auth and reference routes additionally answer with no user-specific state a crawler
      // could want (`no-store`+`HttpOnly` cookies for auth; a public, cookie-free cache for
      // reference data), and nothing links to any of them, so all are undiscoverable in the
      // first place.
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
