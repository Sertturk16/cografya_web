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

  // next/image conventions (CONVENTIONS §6 #9 / ENGINEERING §4 #9). Local images live in
  // `/public` — `public/kitaplar/` (the book covers) and `public/marka/` (the YouTube
  // branding mark) — and are always rendered through `next/image` with explicit width/height
  // (or `fill` + a fixed-size container) to hold CLS < 0.1. The trap belongs to `public/`
  // itself and not to one directory in it: a file placed anywhere under it is served AHEAD
  // of the router, so each directory shadows whatever route shares its prefix. `kitaplar/`
  // shares one with `/kitaplar/[slug]`, `marka/` shares none today, and the next directory
  // added here is a route collision waiting to be checked. The note for whoever adds an
  // asset is `docs/public-kitaplar.md`. It sits in `docs/` rather than beside the files
  // because anything under `public/` is itself published.
  //
  // `images.remotePatterns` is deliberately absent, and the FIRST remote image this app
  // renders will not change that: the YouTube thumbnail on the book detail page is
  // hotlinked under ENGINEERING §4 #9's second exception, so it never reaches the image
  // optimiser and needs no allowlist entry. Read that item before adding a pattern here —
  // an entry added by reflex would authorise the optimiser to fetch and store the very byte
  // copy the provider's policy forbids. A future remote image we ARE permitted to copy
  // still belongs here, via `remotePatterns` (never the deprecated `images.domains`).
};

export default withNextIntl(nextConfig);
