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
      // for api/raw paths. The web app has no /api of its own (that's the api repo),
      // but the exclusion is pinned defensively.
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
