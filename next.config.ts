import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl reads its per-request config from ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // SEO non-negotiable (CONVENTIONS §6 #10): trailing slash pinned in config so
  // canonical/hreflang/sitemap URLs are stable and never depend on an implicit default.
  trailingSlash: false,

  // The flag route reads `flag-icons`' manifest/SVGs and local overrides from disk during
  // prerendering and first on-demand generation (`lib/geo/flag-set.ts`). Declaring all three
  // inputs here makes that server-only dependency explicit for output tracing instead of
  // leaving it to `process.cwd()` paths the tracer cannot follow. Turbopack still emits one
  // "whole project was traced" warning for that route; this repo has no deploy/bundling job yet
  // (ENGINEERING §6). BOTH consumers need the package manifest, complete 4x3 directory and
  // local root: the country page constructs the catalogue through `hasFlag()`, while the flag
  // route both constructs it and reads final bytes. Missing or partial traced inputs now throw
  // rather than publishing a partial catalogue or cacheable absence.
  outputFileTracingIncludes: {
    "/flags/[flag]": [
      "./node_modules/flag-icons/country.json",
      "./node_modules/flag-icons/flags/4x3/**",
      "./assets/flags/**",
    ],
    "/[locale]/dunya/[slug]": [
      "./node_modules/flag-icons/country.json",
      "./node_modules/flag-icons/flags/4x3/**",
      "./assets/flags/**",
    ],
  },

  // next/image conventions (CONVENTIONS §6 #9). No images ship yet, so no remote
  // sources are allowlisted. When the first remote image source lands, add it here
  // via `images.remotePatterns` (NOT the deprecated `images.domains`). Local images
  // go in `/public` and are always rendered through `next/image` with explicit
  // width/height (or `fill` + a fixed-size container) to hold CLS < 0.1.
};

export default withNextIntl(nextConfig);
