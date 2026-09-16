# cografya_web — architecture

Read before adding a route, a data fetch, or touching i18n / SEO / build config.

## Routing

- No root `app/layout.tsx`. `app/[locale]/layout.tsx` renders `<html>`/`<body>` and is the
  root layout. Consequence: a URL that matches no segment falls to Next's unstyled 404, not
  `app/[locale]/not-found.tsx`. Only `/araclar/[...rest]` has a catch-all to fix that.
- No route groups. Unlocalized: `app/api/**` (BFF), `app/flags/[flag]`, `app/maps/*.svg`,
  `app/llms.txt`, `robots.ts`, `sitemap.ts`, `manifest.ts`.
- **V1** (`/`, `/turkiye`, `/dunya`, `/deniz`, `/deprem`, `/oyun`, `/kitaplar`, `/araclar`,
  auth pages): CSS Modules + global `.btn`/`.card` classes, `components/site-*`. Frozen.
- **V2** (`app/[locale]/v2/**`, 33 pages): mirrors V1 plus `profil`, `hesabim`, sea basins,
  continents. Tailwind + shadcn. `v2/layout.tsx` sets `robots { index: false }` and wraps
  in `<div class="v2-app">`; a CSS rule `body:has(.v2-app) > header, > footer { display:none }`
  hides V1 chrome, which still renders. Keep the `.v2-app` wrapper.
- `app/[locale]/design-system/page.tsx` is a 1200-line client component gallery.

## i18n (next-intl 4)

- `i18n/routing.ts`: locales `tr` (default, unprefixed) / `en` (`/en`),
  `localePrefix: "as-needed"`, `localeDetection: false`, 69 `pathnames` entries including
  every `/v2/*` route with an EN twin. `type AppPathname` derives from it.
- `i18n/request.ts` pins `timeZone: "UTC"` (the API publishes instants in UTC).
- `i18n/navigation.ts` is the only source of `Link`/`redirect`/`getPathname`.
- `proxy.ts` (Next 16 name for middleware) wraps `createMiddleware(routing)`; the matcher
  excludes `api`, `_next`, files with extensions and metadata-image leaf segments.
- `messages/{tr,en}.json`, 30 namespaces each. `lib/seo/indexing.ts` has
  `EN_CONTENT_READY = false` and a `ContentSurface` type (`localized | trNarrative |
noindex | trOnly`) that decides which locales a page is indexable in.
- V2 copy is mostly hardcoded Turkish (13 of 81 V2 files use translations). `/en/v2/*`
  resolves but renders Turkish. Do not add a new hardcoded string to a file that already
  uses `useTranslations`.

## Data access

- `lib/env.ts` (public, zod): `NEXT_PUBLIC_SITE_URL` default `http://localhost:3000`.
  `lib/env.server.ts` (`server-only`): `API_BASE_URL` default `http://localhost:3001`,
  `INTERNAL_REQUEST_TOKEN` optional (min 32 visible-ASCII).
- `lib/api/client.ts` (`server-only`): `apiGet<T>(path, { revalidate })`, ISR default
  `CONTENT_REVALIDATE_SECONDS = 3600`, 15 s abort budget, sends `x-internal-request-token`
  (throttle exemption on the API, GET only), throws `ApiError(status)`. `*Resilient` /
  `*Safe` wrappers degrade build-time failures to empty so `next build` stays green.
- Mutations / auth: `app/api/**/route.ts` (22 routes, all `force-dynamic` +
  `force-no-store` + `runtime: nodejs`) delegate to `lib/<domain>/transport.server.ts`.
  Helpers in `lib/http/bff-helpers.server.ts`, `lib/http/same-origin.ts`.
- Contract: `openapi/openapi.json` is a manual copy of the API repo's spec; `pnpm codegen`
  emits `lib/api/schema.ts` (committed, ESLint/Prettier ignored). Alias types in
  `lib/api/types.ts`.
- **When to pick `force-dynamic` over `revalidate` + a resilient empty fallback.** The
  production Docker build has no network access to the api container, so any build-time
  fetch through `*Resilient`/`*Safe` always degrades to empty — and on a `revalidate`-only
  route that empty result gets baked into the static/ISR output and served to real users
  until a post-deploy request finally lands after the revalidate window and triggers a
  background refresh. If that empty-fallback state would leave a route or page looking
  broken after every deploy — a required form field with nothing to pick, a BFF route with
  no dynamic segment (or one whose `generateStaticParams` enumerates every possible value,
  which bakes it in just the same), or a hub page whose map/index both go empty and lose
  their links — use `export const dynamic = "force-dynamic"` instead, and let the route's own
  `Cache-Control` header (or nothing, for a low-traffic authenticated flow) carry the caching
  benefit. Keep the `revalidate` + resilient-empty-fallback pattern only where the empty
  fallback is genuinely graceful: the primary content still renders, and the missing piece
  degrades legibly (a thinner list, a map that loses only hover stats, a section that omits
  itself instead of rendering with nothing under a heading) — and prefer a shorter window
  over a needlessly long one even then.

## SEO (`lib/seo/`)

- `site.ts` (`siteConfig`, `getSiteUrl`, `absoluteUrl`), `metadata.ts` (`buildMetadata`,
  `buildAlternates` → canonical + hreflang tr/en/x-default), `json-ld.tsx` (typed builders,
  server-rendered), `indexing.ts` (surface → indexable locales), `sitemap-entries.ts` +
  `book-sitemap.ts` (per-hub entry builders), `redirects.ts`.
- `app/robots.ts`: allow-all + `Disallow: /api/`. `next.config.ts`: `trailingSlash: false`,
  `output: "standalone"`, one permanent redirect, no `images.remotePatterns` by policy (the
  single remote image is hotlinked), no `typedRoutes`.
- Rendering per page type: content pages SSG/ISR with full HTML; live feeds SSR/short-ISR
  shell + client island; maps/games/tools = server shell + `dynamic(..., { ssr: false })`
  widget in a fixed-size container. Never flip a content route to SSR for cosmetics.

## Maps and geodata

- `data/*.geojson` (build-time only, ODbL/OSM; attribution must render beside every map,
  ledger in `data/README.md`). `scripts/generate-*.mjs` project them through the pinned
  frame in `scripts/lib/tr-frame.mjs` into the four `lib/map/*.generated.ts` artifacts.
  `scripts/fetch-*.mjs` are manual network steps, deliberately not pnpm scripts.
- `lib/map/` holds projection, zoom-pan (`v2-zoom-pan.ts`), measurement and geometry.
  `components/map/`, `components/game/`, `components/tools/` consume it.
- Flags: `flag-icons` at runtime via `app/flags/[flag]/route.ts`; `assets/flags/qn.svg`
  is a local override. Both are in `outputFileTracingIncludes` and copied by the
  Dockerfile.

## Styling stack

`app/globals.css` (~1040 lines): `@import "tailwindcss"`, `tw-animate-css`,
`shadcn/tailwind.css`; `@custom-variant dark (&:is(.dark *))`; `:root` Terra tokens plus
shadcn bridge tokens; `@theme inline` re-exports them as Tailwind keys; `.dark` block;
`@layer base`; then V1 global classes. `components.json`: style `base-nova`, base colour
neutral, CSS variables on, aliases `@/components`, `@/lib`, `@/hooks` (the last does not
exist). Dark mode is hand-rolled in `components/v2/theme-toggle.tsx` (class on `<html>` +
`localStorage`); `next-themes` is installed but no provider is mounted. Details and the
open dark-mode bugs: `docs/design.md`.

## Build, CI, deploy

- `Dockerfile`: alpine, `pnpm build` in a builder stage, runner copies `.next/standalone`,
  `.next/static`, `public/`, `assets/`, `node_modules/flag-icons`; runs as `nextjs`.
- `ci.yml` on PR/push to `dev`/`main`: typecheck, lint, four `generate:*:check`,
  `codegen:check`, `pnpm test`, `pnpm build`.
- `deploy.yml` on push to `main`: repeats the gate, then SSH → `git reset --hard origin/main`
  in `/opt/cografya/cografya_web` → compose build/up `web` → `sleep 5`. No health check.

## Known gaps (recorded, not fixed)

- `NEXT_PUBLIC_SITE_URL` and `API_BASE_URL` reach the container only at runtime, not in the
  Docker build stage. This works today (verified on prod 2026-09-15: canonicals, hreflang and
  a 307-URL sitemap all carry the real origin) because `lib/env.ts` parses `process.env` as
  an object at runtime instead of referencing `process.env.NEXT_PUBLIC_*` directly, which
  Next would inline at build. Keep it that way, or add build `ARG`s before changing it.
- `/v2/**` is `noindex` but `/v2/dunya/kita/*` is emitted into the sitemap.
- `--radius-lg` is `16px` in `:root` and `var(--radius)` (10px) in `@theme inline`.
- `lib/map/tr-context.generated.ts` is Prettier-ignored but missing from ESLint ignores.
- Dark users get a light-theme flash (no blocking theme script); `.dark` overrides only
  shadcn greys, no Terra token (TASKS T-016 / T-018).
- `components.json` `aliases.hooks` points to a non-existent `@/hooks`.
- `.env.example` lacks `INTERNAL_REQUEST_TOKEN`.
- `scripts/` mixes durable generators with ad-hoc Playwright audits; `scripts/verify_*.mjs`
  is gitignored yet two such files are tracked.
- Prod is plain HTTP on a bare IP; the internal token rides every web→api call in clear.
