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
      // The web app now has exactly one route of its own under this prefix:
      // `/api/search-index/{locale}`, the header search's data file. Disallowing it is
      // correct rather than a de-indexing trick — it is a JSON document, not a page, and
      // it is NOT required to render anything, because the search control ships as a real
      // `<a>` link in the server HTML with or without it. Nothing links to it either, so
      // it is undiscoverable in the first place.
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
