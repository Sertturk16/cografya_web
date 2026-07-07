import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl reads its per-request config from ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // SEO non-negotiable (CONVENTIONS §6 #10): trailing slash pinned in config so
  // canonical/hreflang/sitemap URLs are stable and never depend on an implicit default.
  trailingSlash: false,

  // next/image conventions (CONVENTIONS §6 #9). No images ship yet, so no remote
  // sources are allowlisted. When the first remote image source lands, add it here
  // via `images.remotePatterns` (NOT the deprecated `images.domains`). Local images
  // go in `/public` and are always rendered through `next/image` with explicit
  // width/height (or `fill` + a fixed-size container) to hold CLS < 0.1.
};

export default withNextIntl(nextConfig);
