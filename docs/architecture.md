# cografya_web — architecture

Read before adding a route, a data fetch, or touching i18n / SEO / build config.

## Routing

- No root `app/layout.tsx`. `app/[locale]/layout.tsx` is the root layout and is now only the
  document shell: `<html>`/`<body>`, `ThemeProvider`, `NextIntlClientProvider`, `<Toaster />`.
  Consequence: a URL that matches no segment falls to Next's unstyled 404, so `app/not-found.tsx`
  exists for that case.
- **Two route groups, and they are load-bearing.** `(site)` holds the 34 reading surfaces and its
  layout owns the chrome — skip link, `V2Header`, ONE `<main id="main-content">`, `V2Footer`,
  `V2AuthDialog`. `(play)` holds the three fullscreen game screens and gives them the bare
  minimum. A page gets the chrome by WHERE IT LIVES, never by importing it: before T-032 PR3,
  `V2Header` was copied into 37 pages, two had lost the footer, and 24 nested a second `<main>`
  inside the root layout's. `components/v2/v2-a11y-navigation-polish.test.ts` walks the tree and
  fails if any page carries its own `id="main-content"`.
- `app/[locale]/design-system/**` is in NEITHER group: internal tooling that brings its own
  full-page chrome, and it carries its own `noindex` (both in `buildMetadata` and the layout's
  `robots`) — the blanket `/v2` de-indexing that used to cover it is gone.
- Unlocalized: `app/api/**` (BFF), `app/flags/[flag]`, `app/maps/*.svg`, `app/llms.txt`,
  `robots.ts`, `sitemap.ts`, `manifest.ts`.
- **V1 IS DELETED** (T-032). There is no `/v2` prefix, no `.v2-app` wrapper and no chrome
  suppression rule. **No `*.module.css` remains either**: T-033 converted the last eight
  (`earthquake`, `marine`, `climate`, `air-pollution`, `book-video`, `locator-map`, `site-search`,
  `book-detail`) to Tailwind and bridge tokens and deleted the files. `components/orphan-stylesheets.test.ts`,
  which used to hold their reachability, went with them — a reachability claim over an empty
  population cannot fail; its `reachable.size` parser anchor moved intact to
  `components/orphan.test.ts`. The one guard left is `components/css-module-dark-safety.test.ts`,
  which walks `app/` and `components/` and reds if a module returns. One of the earlier deletions,
  `components/map/map.module.css`, was 876 lines whose four consumers PR4 deleted; its own orphan
  test could not see it, because a substring match let `locator-map.module.css` answer for it.
- **Loading states (T-037).** A route gets a `loading.tsx` only when it is `force-dynamic`, its
  page decides neither `notFound()` nor `redirect()` before its first return, AND its segment is a
  leaf (no descendant `page.tsx`) — a `loading.tsx` wraps every child route in a Suspense boundary,
  which commits those routes to a 200 before their own `notFound()` runs and, measured in T-037,
  made four `[slug]` families build fully dynamic with zero prerendered params. One route today
  (`/kayit`). `/turkiye` and `/dunya` stream their hero and sections but carry no route-level
  skeleton because they parent the detail routes. Every other server fetch renders behind
  `<Suspense>` with a piece of `components/patterns/page-skeleton.tsx` as its fallback, and the
  section component is a top-level `async function` in the same `page.tsx` — the composition
  scanners pin exact page paths, and an in-file declaration is followed by their render walk while
  a new file is not. `components/v2/page-composition-loading.test.ts` holds all these rules. The
  FAQ scanner follows JSX nesting inside one function only, so a gated `<FaqSection>` inside a
  section component repeats the gate.

## i18n (next-intl 4)

- **English is withdrawn behind ONE switch** (T-105): `ENGLISH_ENABLED` in `i18n/routing.ts`. Off,
  `routing.locales` is `["tr"]` (EN hreflang, sitemap rows and `Link` header vanish with it) and
  `proxy.ts` 301s every `/en/...` to its TR path via `lib/i18n/english-redirect.ts`; EN pathnames,
  messages and tests stay. `ALL_LOCALES`/`Locale` still include `en`; tests pin both positions by
  mocking the module (`lib/test-support/english-switch.ts`). Flip it to `true` to restore EN.
- `i18n/routing.ts`: locales `tr` (default, unprefixed) / `en` (`/en`, served only when switched on),
  `localePrefix: "as-needed"`, `localeDetection: false`, **39** `pathnames` entries, none of
  which says `v2`. `type AppPathname` derives from it. English segments are `/turkiye/...`, not
  `/turkey/...` — the table's own recorded decision, which the V2 entries had contradicted.
- `i18n/request.ts` pins `timeZone: "UTC"` (the API publishes instants in UTC).
- `i18n/navigation.ts` is the only source of `Link`/`redirect`/`getPathname`.
- `proxy.ts` (Next 16 name for middleware) wraps `createMiddleware(routing)`; the matcher
  excludes `api`, `_next`, files with extensions and metadata-image leaf segments.
- `messages/{tr,en}.json`, 30 namespaces each. `lib/seo/indexing.ts` has
  `EN_CONTENT_READY = false` and a `ContentSurface` type (`localized | trNarrative |
noindex | trOnly`) that decides which locales a page is indexable in.
- Much of the V2 copy is hardcoded Turkish, so `/en/*` resolves and renders Turkish in places.
  Do not add a new hardcoded string to a file that already uses `useTranslations`. The cost is
  tracked, not tolerated: `Tools.{alan,koordinat,map,mesafe}`, ten `BookDetail` keys and the
  marine layer catalogue lost their only consumer to inline copy, and each sits on an EXACT
  orphan list in its own messages test, so an eleventh orphan fails and re-adopting one without
  shortening the list fails too. `lib/i18n/key-existence.test.ts` catches the other direction —
  a key the code asks for that no catalogue has (next-intl renders the dotted string rather than
  throwing, so a build used to be the first thing that noticed).

## Data access

- `lib/env.ts` (public, zod): `NEXT_PUBLIC_SITE_URL` default `http://localhost:3000`.
  `lib/env.server.ts` (`server-only`): `API_BASE_URL` default `http://localhost:3001`,
  `INTERNAL_REQUEST_TOKEN` optional (min 32 visible-ASCII).
- `lib/api/client.ts` (`server-only`): `apiGet<T>(path, { revalidate })`, ISR default
  `CONTENT_REVALIDATE_SECONDS = 3600`, 15 s abort budget, sends `x-internal-request-token`
  (throttle exemption on the API, GET only), throws `ApiError(status)`. `*Resilient` /
  `*Safe` wrappers degrade build-time failures to empty so `next build` stays green.
- Mutations / auth: `app/api/**/route.ts` (21 routes) delegate to
  `lib/<domain>/transport.server.ts`. Most carry `force-dynamic` (18) + `force-no-store` (13) +
  `runtime: nodejs` (15), but "all" is not true and reading it as a rule will mislead you:
  `earthquakes/route.ts` and `marine/overview/route.ts` export none of the three, and
  `reference/districts/[plateCode]/route.ts` deliberately does the opposite (`revalidate = 3600`).
  Check the route you are editing rather than assuming the directive is already there.
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
- **Shared loaders are `cache()`-wrapped.** `apiGet` passes an `AbortSignal`, and Next's fetch
  memoization returns the raw `fetch` when a signal is present — so two Suspense sections calling
  the same loader would fetch twice. The loaders read by more than one boundary (or by
  `generateMetadata` and the body) are `export const x = cache(async () => …)` in `lib/api/*`;
  `lib/api/request-dedupe.test.ts` pins the list. A page-local composite loader follows the same
  form (`const loadX = cache(async (plateCode) => …)` at module scope in the page).

## SEO (`lib/seo/`)

- `site.ts` (`siteConfig`, `getSiteUrl`, `absoluteUrl`), `metadata.ts` (`buildMetadata`,
  `buildAlternates` → canonical + hreflang tr/en/x-default), `json-ld.tsx` (typed builders,
  server-rendered), `indexing.ts` (surface → indexable locales), `sitemap-entries.ts` +
  `book-sitemap.ts` (per-hub entry builders). There is no `redirects.ts`: the redirect table is
  the `redirects()` block in `next.config.ts`, and `lib/seo/redirects.test.ts` reads it there.
- `FAQPage` JSON-LD has exactly ONE emitter: `components/patterns/faq-section.tsx`, from the same
  `items` array it renders, gated on `isIndexable(locale, structuredData)`. No page calls
  `faqPageJsonLd` (`components/v2/page-composition-faq.test.ts` pins that as an exact identity).
- `app/robots.ts`: allow-all + `Disallow: /api/`. `next.config.ts`: `trailingSlash: false`,
  `output: "standalone"`, one permanent redirect, no `images.remotePatterns` by policy (the
  single remote image is hotlinked), no `typedRoutes`.
- Rendering per page type: content pages SSG/ISR with full HTML; live feeds SSR/short-ISR
  shell + client island; maps/games/tools = server shell + `dynamic(..., { ssr: false })`
  widget in a fixed-size container. Never flip a content route to SSR for cosmetics.

## Maps and geodata

- `data/*.geojson` (build-time only, ODbL/OSM; attribution must render beside every map,
  ledger in `data/README.md`). `scripts/generate-*.mjs` project them through the pinned
  frame in `scripts/lib/tr-frame.mjs` into the five `lib/map/*.generated.ts` artifacts.
  `scripts/fetch-*.mjs` are manual network steps, deliberately not pnpm scripts.
- `lib/map/` holds projection, zoom-pan (`v2-zoom-pan.ts`), measurement and geometry.
  `components/map/`, `components/game/` and `components/v2/v2-tool-workbench.tsx` consume it.
- Flags: `flag-icons` at runtime via `app/flags/[flag]/route.ts`; `assets/flags/qn.svg`
  is a local override. Both are in `outputFileTracingIncludes` and copied by the
  Dockerfile.

## Styling stack

`app/globals.css` (~1060 lines): `@import "tailwindcss"`, `tw-animate-css`,
`shadcn/tailwind.css`; `@custom-variant dark (&:is(.dark *))`; `:root` Terra tokens plus
shadcn bridge tokens; `@theme inline` re-exports them as Tailwind keys; `.dark` block;
`@layer base`; then eight global classes (`.btn*`, `.card`, `.container`, `.section`,
`.scrollbar-none`) — T-032 PR4 removed the twenty V1-only rules, including a
`.placeholder-note` that had carried a rejected `border-left: 4px` side-tab for months with
zero consumers to review it. `components.json`: style `base-nova`, base colour neutral, CSS
variables on, aliases `@/components`, `@/lib`, `@/hooks` (the last does not exist).

**Dark mode is `next-themes`, mounted.** `app/[locale]/layout.tsx` renders `<ThemeProvider>`
(`attribute="class"`, `storageKey="theme"`, `defaultTheme="system"`), which is why `<html>`
carries `suppressHydrationWarning` — the library's blocking script sets the class before
paint. The earlier note here claimed the opposite ("installed but no provider is mounted",
"hand-rolled in `theme-toggle.tsx`") and it cost real time: forcing `.dark` onto
`documentElement` after load is silently undone when next-themes re-applies its own class,
which turned a whole browser contrast sweep into artifacts. To test a theme, set
`localStorage.theme` BEFORE navigation (Playwright's `addInitScript`), never after load.
Details and the open dark-mode bugs: `docs/design.md`.

## Build, CI, deploy

- `Dockerfile`: alpine, `pnpm build` in a builder stage, runner copies `.next/standalone`,
  `.next/static`, `public/`, `assets/`, `node_modules/flag-icons`; runs as `nextjs`.
- `ci.yml` on PR/push to `dev`/`main`: typecheck, lint, four `generate:*:check`,
  `codegen:check`, `pnpm test`, `pnpm build`.
- `deploy.yml` on push to `main`: repeats the gate, then SSH → `git reset --hard origin/main`
  in `/opt/cografya/cografya_web` → compose build/up `web` → `sleep 5`. No health check.
- To test the standalone output locally, run `node .next/standalone/server.js` with `PORT` set
  and WITHOUT `HOSTNAME=127.0.0.1` — an IPv4-only bind makes next-intl's proxy self-dispatch
  loop with 307s.

## Known gaps (recorded, not fixed)

- **The dev server on `:3000` is the `cografya-web-dev` container, bind-mounting this tree at
  `/app`; its `.next` is a named volume, and it hot-reloads host edits.** Two consequences a
  host `pnpm dev` does not announce: it silently takes `:3002` because `:3000` is held, so
  anything you point at `:3000` is still the container; and the tree then has two Turbopack
  watchers. Under load — `pnpm sweep:overflow` drives 183 page loads — the container has been
  observed writing `/app/.next/dev/prerender-manifest.json` twice without truncating, leaving a
  valid document followed by the tail of a second one. Next parses that manifest on every
  request, so **every route 500s with a `JSON.parse` "unexpected non-whitespace character"
  error that names no file of yours.** `docker restart cografya-web-dev` regenerates it. The
  signature to recognise: every route fails, including ones your change cannot reach, and the
  same byte offset repeats in each error.
  **The restart is not the whole repair.** Pages rendered during the broken window are written
  to the ISR route cache and then served from it for their full `revalidate` window — so
  `turkiye/bolge/[slug]` and `dunya/kita/[slug]`, both `revalidate = 86400`, kept returning 404
  for a day after the server itself was healthy, while `turkiye/[slug]` (`revalidate = 120`)
  had already healed itself. The tell is a 404 in ~30 ms with no API call, on a route whose
  endpoint answers 200 from inside the container. `rm -rf /app/.next/cache` before the restart;
  clearing only `fetch-cache` is not enough, because the poisoned artefact is the rendered page.
  Turbopack dev keeps the fetch Data Cache at `/app/.next/dev/cache/fetch-cache` inside the
  container; purge that path (not `/app/.next/cache`) to see a Suspense fallback with the API
  paused.

- **`V2LiveTicker` publishes AFAD and CMEMS/ECMWF values on 33 pages with no attribution.**
  It fetches `/api/earthquakes` and `/api/marine/overview` itself and renders a magnitude with
  a place name plus per-basin SST and wave height. Its only provenance is a
  `Copernicus & AFAD Aktif` badge — a status chip, not a credit: no verbatim CMEMS notice, no
  AFAD `disclaimerTr`. The rule everywhere else in this repo (see
  `components/marine/marine-attribution.tsx`) is that the notice is visible without a click on
  the page carrying the values, so under that reading all 33 pages owe it.
  **This is left open because every fix is a product decision, not a repair.** The three
  candidates, with what is actually wrong with each:
  1. _A licence block under the ticker._ Correct and absurd — two stacked licence blocks in the
     chrome of 33 pages, above the content, on a login form included.
  2. _A compact in-line credit in the ticker._ Works for Copernicus Marine, whose required
     notice is one short sentence that would fit. It does NOT work for ECMWF, whose notice is a
     paragraph and whose terms allow no "or similar" wording — and the wave field falls back to
     ECMWF where the regional model has no coverage. So this option only closes if the ticker
     also stops publishing wave height, which is option 3 by another name.
  3. _The ticker stops publishing values and becomes navigational._ Discharges the obligation
     completely and costs the feature.
     Recommendation: 3 for the marine half (the values are one click away on `/deniz`, which
     carries the full notice) and 2 for the earthquake half (AFAD's `disclaimerTr` — "not an early
     warning system" — is short, and it matters more beside a live magnitude than in a footer).
     Both change what 33 pages show. The exclusion is PINNED by an assertion in
     `components/marine/marine-attribution-coverage.test.ts`, so it cannot quietly outlive the
     question.
- `NEXT_PUBLIC_SITE_URL` and `API_BASE_URL` reach the container only at runtime, not in the
  Docker build stage. This works today (verified on prod 2026-09-15: canonicals, hreflang and
  a 307-URL sitemap all carry the real origin) because `lib/env.ts` parses `process.env` as
  an object at runtime instead of referencing `process.env.NEXT_PUBLIC_*` directly, which
  Next would inline at build. Keep it that way, or add build `ARG`s before changing it.
- ~~`/v2/**` is `noindex` but `/v2/dunya/kita/*` is emitted into the sitemap.~~ CLOSED by
  T-032 PR3 — and it was the smaller half of the problem. Moving V2 onto the canonical URLs
  carried the `/v2` layout's blanket `noindex` with it, so twelve routes `app/sitemap.ts`
  publishes were advertising themselves as de-indexed (SEO-POLICY §B6 6.8). Each is back on the
  surface its V1 counterpart had; `lib/seo/sitemap-surface-symmetry.test.ts` now fails if a
  statically-listed sitemap row and its page disagree, and all 307 sitemap URLs were verified
  200-and-indexable against a production build.
- `--radius-lg` is `16px` in `:root` and `var(--radius)` (10px) in `@theme inline`.
- ~~Dark users get a light-theme flash (no blocking theme script); `.dark` overrides only
  shadcn greys, no Terra token.~~ CLOSED (T-016 / T-018). `next-themes` ships the blocking
  script, and `.dark` redefines the bridge tokens with a measured contrast table beside it in
  `app/globals.css`. What is still true, and is the trap: the RAW Terra tokens
  (`--color-slate`, `--color-ink`, …) are frozen at their light values and never redefine, so
  anything reading one directly is a dark-mode defect waiting to be found — that is how a mandated
  licence notice shipped at 2.34:1 (T-032 PR3), and why one province page measured 111 text
  elements below 3:1 before T-033. The CSS Modules that did the reading are gone; the tokens are
  still frozen, so the rule outlives them. Bridge tokens (`text-foreground`,
  `text-muted-foreground`, `border-border`) redefine per theme; prefer them.
- `components.json` `aliases.hooks` points to a non-existent `@/hooks`.
- `scripts/` mixes durable generators with ad-hoc Playwright audits; `scripts/verify_*.mjs`
  is gitignored yet two such files are tracked.
- Prod is plain HTTP on a bare IP; the internal token rides every web→api call in clear.
- `pnpm build` against a live local API can fail on one province or country page (fetch abort /
  `ECONNRESET`, or `ApiError 500`) under Next's ~19 parallel prerender workers. It is load, not
  chance: it reproduces while something else is also loading the API — an open Playwright
  session failed `kilis` with `ApiError 500` twice in a row — and the same tree builds clean
  (992/992 pages) once that load is gone. `✓ Compiled successfully` prints either way; the failure
  is in prerender. **Before calling a red build a real failure, check whether anything else is
  hitting the API** (a Playwright/MCP browser, `pnpm sweep:overflow`, a dev server in use), stop
  it and rerun. CI reaches this path: since T-048, `ci.yml` stands up a real API from the
  committed seeds before `pnpm build`, and `scripts/assert-prerender-floor.mjs` runs on every
  build, so a build that cannot reach the API (or loses it mid-build) fails loudly instead of
  shipping partial output. No worker count is pinned.
