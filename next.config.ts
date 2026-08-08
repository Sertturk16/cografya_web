import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl reads its per-request config from ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // SEO non-negotiable (CONVENTIONS §6 #10): trailing slash pinned in config so
  // canonical/hreflang/sitemap URLs are stable and never depend on an implicit default.
  trailingSlash: false,

  // The flag route reads `flag-icons`' SVGs from disk at build time (`lib/geo/flag-set.ts`).
  // Declaring the directory here is what makes that dependency EXPLICIT for output file
  // tracing instead of leaving it to a `process.cwd()` path the tracer cannot follow. Turbopack
  // still emits one "whole project was traced" warning for that route — it is a tracing-scope
  // warning, not a build error, and this repo has no deploy/bundling step for it to affect
  // (ENGINEERING §6: no deploy job until the hosting decision). Removing it would mean
  // codegenning 271 SVGs into TS modules, which the plan rejected as a second artifact.
  outputFileTracingIncludes: {
    "/flags/[flag]": ["./node_modules/flag-icons/flags/4x3/**"],
  },

  // next/image conventions (CONVENTIONS §6 #9). No images ship yet, so no remote
  // sources are allowlisted. When the first remote image source lands, add it here
  // via `images.remotePatterns` (NOT the deprecated `images.domains`). Local images
  // go in `/public` and are always rendered through `next/image` with explicit
  // width/height (or `fill` + a fixed-size container) to hold CLS < 0.1.
};

export default withNextIntl(nextConfig);
