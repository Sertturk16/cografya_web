# T-037 — Loading states: `loading.tsx`, Suspense at every data section, one skeleton pattern

**Status:** implemented on `feature/t037-loading-states`; loading.tsx rule amended twice during
execution (status-code commit; leaf segments) — see Decisions. Owner decision recorded on
2026-09-24: the widest streaming scope — `loading.tsx` plus a Suspense boundary at **every**
section that consumes server-fetched data, not only the five heavy surfaces.

## The problem

Measured on `dev` at `451b4cb`: 46 `page.tsx`, **0 `loading.tsx`, 0 `Suspense`**. Every page
that reads the API does it at the top of its default export — `await Promise.all([...])`, then
one return of the whole tree. Nothing streams: the hero, the breadcrumbs and the JSON-LD wait for
the slowest fetch. A cold `/deprem` render took 2.8 s locally with the navigation completely
silent.

Thirty-two pages read the API on the server (29 in `(site)`, 3 in `(play)`). Fourteen do not and
are left alone. Both lists are in Section 4.

Two facts from the inventory change the shape of the fix:

1. **`apiGet` opts out of React's fetch memoization.** It passes an `AbortSignal` on every call,
   and Next's `dedupe-fetch` returns the raw `fetch` when a signal is present. Two sections that
   each call `getProvincesResilient()` in one render make **two** network requests, saved only by
   the data cache when an entry already exists. Splitting a page into sections without fixing this
   would multiply API load. `getSession()` is the one loader already wrapped in React `cache()`.
2. **Only five routes are dynamic at request time.** `/turkiye`, `/dunya`, `/hesabim`,
   `/hesabim/ayarlar` and `/kayit` export `force-dynamic`. Every other data page is ISR (`revalidate`)
   or static-by-default, and every `[slug]` route enumerates its params. Next prefetches static
   routes in full, so on those a `loading.tsx` is never seen on client navigation; it matters on
   a cold, uncached render, which is also exactly when the Suspense boundaries stream. On the five
   dynamic routes `loading.tsx` is what makes the click instant: Next prefetches the route down to
   its loading boundary and paints it before the server answers.

## Decisions

| Question                                            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where do the Suspense boundaries go?                | Around every JSX region that consumes a server fetch, per the inventory in Section 4. Static markup — breadcrumbs, headings, ledes, literal stat tiles, prose, cross-link cards, FAQ built from constants — stays outside and renders immediately.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Which routes get a `loading.tsx`?                   | Amended twice during execution. Ruling A (task-14-addendum.md): a rendered `loading.tsx` commits the response to 200 the instant it renders, so a later `notFound()` or `redirect()` can only become a `<meta>` tag — and this repo's hard rule "unknown slug → real 404" outranks the original plan below. Ruling B (Task 15's finding): a `loading.tsx` wraps its segment's `page.tsx` AND every child route below it in a Suspense boundary, so a `loading.tsx` on a non-leaf segment commits its child `[slug]` routes to a 200 too — Task 15's production build showed exactly this: `turkiye/[slug]`, `turkiye/bolge/[slug]`, `dunya/[slug]` and `dunya/kita/[slug]` built fully dynamic (zero prerendered params) and soft-404'd (200 for an unknown slug) under the `/turkiye` and `/dunya` loading boundaries, despite each page's own `notFound()` firing. A route gets a `loading.tsx` only when it is `force-dynamic`, its page decides neither `notFound()` nor `redirect()` before its first return, AND its segment is a leaf (no descendant `page.tsx`). One route today (`/kayit`); `/turkiye` and `/dunya` no longer carry one because they parent the `[slug]` detail routes, and the `[slug]` details and the account pages deliberately have none and keep their real 404/307. |
| What does a `loading.tsx` render?                   | The same skeleton pieces the page uses as its Suspense fallbacks, in the same composition. Swapping from `loading.tsx` to the page shell must move nothing on screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| How are skeletons written?                          | One pattern, `components/patterns/page-skeleton.tsx`, built from the existing `Skeleton` primitive and the T-035 layout components. Pages never write `animate-pulse`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| How do sections share one fetch?                    | Loaders that more than one boundary reads are wrapped in React `cache()` inside `lib/api/*`. Each boundary calls the loader itself; the first call fetches, the rest await the same promise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| What happens when a fetch throws inside a boundary? | ISR routes: unchanged — a throw during regeneration fails the regeneration and Next keeps serving the last good page. The five `force-dynamic` routes: the shell has already streamed as 200, so `(site)/error.tsx` replaces the page client-side instead of the pre-T-037 server 500. Accepted (playground risk posture): the alternative is to re-block the shell on the primary loader on every request to protect a total-API-outage crawl. Reversible with one `await` before the return.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Where does `notFound()` run?                        | Before the first `return`, never inside a boundary. A `notFound()` thrown after the shell has streamed cannot change the HTTP status, and this repo's SEO rule is a real 404 for an unknown slug.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Where does `redirect()` run?                        | Same: before the first `return`, on `/hesabim`, `/hesabim/ayarlar` and via `getSession()` in general.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Is JSON-LD allowed to stream?                       | Yes, when it is derived from fetched data (`itemListJsonLd` on `/turkiye`, `/dunya`, `/kitaplar`; `faqPageJsonLd` on `/turkiye/bolge`). It stays server-rendered; it arrives in the same stream chunk as the data it describes. Googlebot and Bingbot execute the DOM. Entity JSON-LD on detail pages is outside any boundary because the entity is resolved before return.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Section 1 — `PageSkeleton` and its pieces

One file, `components/patterns/page-skeleton.tsx`. Server Component: no state, no client imports,
so a `loading.tsx` that renders it stays a Server Component and `rsc-boundary.test.ts` is
untouched.

### The pieces

Each piece mirrors one T-035 component's measured geometry so that the content that replaces it
lands in the same box. All colour through bridge tokens (`bg-muted` via `Skeleton`); no
`bg-card`/`border-border` on the skeleton surfaces themselves, so nothing here trips the
hand-drawn-card counters — and the file lives in `components/patterns/`, which is outside the
card walker's surface anyway.

| Piece                 | Mirrors                                     | Geometry                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BreadcrumbsSkeleton` | `Breadcrumbs`                               | One `text-xs` line: three short bars separated by gaps.                                                                                                                                                                     |
| `FormCardSkeleton`    | `V2RegisterCard`'s form shell on `/kayit`   | One full-width `h-[520px] rounded-3xl` box.                                                                                                                                                                                 |
| `StatTileSkeleton`    | `StatTile`                                  | `rounded-2xl` box, label bar + value bar at `text-2xl sm:text-3xl` height. Exported alone for pages whose hero is real and only its tiles wait.                                                                             |
| `PlateSkeleton`       | The map plates                              | `aspect` union: `map` (`aspect-[1270/580]`, the explorers and the tool workbench), `game` (`aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]`), `locator` (the province/region/country locator boxes — measured in the plan). |
| `ProseSkeleton`       | A prose section                             | Heading bar + `lines` bars, last one shorter.                                                                                                                                                                               |
| `CardGridSkeleton`    | A card grid                                 | `columns` union (`2`, `3`, `2-4`), `count` boxes of one height.                                                                                                                                                             |
| `TableSkeleton`       | already exists in `components/ui/table.tsx` | Reused, not duplicated.                                                                                                                                                                                                     |

### The compositions

`PageSkeleton` takes a closed `shape` union and renders the pieces the way that family of pages
renders its content. Each shape is a measurement of the live tree, not a design:

| `shape` | Composition                                                                                                                                                      | Pages                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `auth`  | `PageContainer` → breadcrumbs → one bare `H1`-height bar (the live page renders a bare `PageHero`, no card) → 12-col grid: `FormCardSkeleton` (6) + a plate (6)  | `/kayit`                   |
| `play`  | `max-w-7xl` main → sr-only heading is real text (see §3) → breadcrumb row → control bar box → arena box holding a 5-tile strip and `PlateSkeleton aspect="game"` | the three `(play)` screens |

The home page is its own case: `V2Hero` already renders with fallback counts when the numbers are
absent, so the hero is never skeletoned — only its stat line and the four data sections below are
(Section 4). No `home` shape.

`className?: never` on every export, the rule `PageContainer`, `PageHero`, `StatTile` and `Card`
already carry, and for the same reason: a passthrough is where a second spelling grows.

### Accessibility

The outermost element of `PageSkeleton` — and of any piece rendered as a Suspense fallback on its
own — is `<div role="status" aria-busy="true">` with an `sr-only` label from a new message key,
`Common.loading` ("Yükleniyor…" / "Loading…"). `Skeleton` bars are `aria-hidden`. The pulse
animation already stops under `prefers-reduced-motion: reduce`, which `app/globals.css` sets
globally; nothing re-enables it. Fallbacks nested inside a page that already announces (the member
hub's own `role="status"` region) do not add a second live region: the pieces take
`announce={false}` there.

### Showcase and roster

`page-skeleton` joins the `geri-bildirim` category in `components/showcase/registry.ts` with a
specimen showing the `auth` and `play` shapes, and the `components/patterns/`
roster bullet in `docs/design.md` gains `page-skeleton`. `registry.test.ts` reconciles both.

## Section 2 — Sharing one fetch across boundaries

`lib/api/{provinces,countries,regions,books,marine,earthquakes}.ts` export their loaders wrapped in
React `cache()` where the inventory shows more than one reader in a render:

- `getProvincesResilient`, `getMapSummaryResilient`, `getProvinces` — read by `generateMetadata`
  and the body on `/turkiye`; by the hero tiles, the explorer and the JSON-LD; by the neighbours
  card on province pages.
- `getCountriesResilient`, `getCountryMapSummaryResilient`, `getCountries` — same on `/dunya`,
  `/dunya/[slug]`, `/dunya/kita/[slug]`.
- `getRegionsResilient` — hero tiles, regions grid, comparison table and FAQ on `/turkiye/bolge`.
- `getBooksResilient` — stat tile, catalogue and JSON-LD on `/kitaplar`.
- `getMarinePointsSafe`, `getMarineOverviewSafe` — the deniz hero lede and the explorer; the home
  marine section.
- `getEarthquakeMetaSafe` — the province earthquake section and the page-foot attribution.

`cache()` is per request: `generateMetadata` and the page body share it, and so do the boundaries.
It sits above `apiGet`, so the `AbortSignal` opt-out below it no longer matters. The wrappers keep
their names and signatures; call sites change nothing. `cache` from `react` is a pass-through
outside a server render, so the existing vitest coverage of these modules runs unchanged.

A test in `lib/api/` asserts the wrap by calling a cached loader twice inside one `renderToString`
of a probe tree and counting `fetch` invocations — the mutation is unwrapping one loader.

## Section 3 — The page shape after the split

Every data page follows one skeleton:

```tsx
export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Entity lookups that decide notFound()/redirect() stay here, before the first return.
  return (
    <>
      <JsonLd … />                       {/* static schemas only */}
      <V2LiveTicker />
      <PageContainer>
        <Breadcrumbs … />
        <Card variant="feature">
          <PageHero … />                 {/* static heading/lede */}
          <StatGrid gutter="hero">
            <StatTile … />               {/* literal tiles */}
            <Suspense fallback={<StatTileSkeleton />}>
              <ProvinceCountTile />      {/* async: awaits the cached loader */}
            </Suspense>
          </StatGrid>
        </Card>
        <Suspense fallback={<PlateSkeleton aspect="map" />}>
          <TurkeyExplorerSection locale={locale} />   {/* async: loader → client explorer */}
        </Suspense>
        <section …>…static…</section>
      </PageContainer>
    </>
  );
}
```

The async section components are co-located: `app/[locale]/(site)/<route>/_sections/*.tsx`, or
where a section is already a `components/**` server component (the province climate, air, marine
and earthquake sections), that component grows an async loader sibling. They are Server
Components; a client island receives the awaited data as props exactly as today. Nothing crosses
the RSC boundary that did not before, and `rsc-boundary.test.ts` holds it.

The `(play)` screens are the one place the chrome moves: `V2GameScreen` renders `V2Header` and
`V2LiveTicker` itself, so a boundary around the screen would skeleton the header. The two chrome
components move out of the screen into the three pages, above the boundary; the screen keeps its
`min-h-screen` wrapper and sr-only `<h1>`. If the plan finds the screen hides the header in
fullscreen/landscape mode, the header instead stays inside and the `play` fallback renders the real
`V2Header` (no data, no state worth keeping).

## Section 4 — Per-page plan

Legend: **L** = gets `loading.tsx` (shape); **S** = Suspense boundaries; **blocking** = awaited
before the first return, by design.

### Hubs and home

| Page                    | Blocking | S                                                                                                                                                                                                                                                                                                       | L                                |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `/` (900)               | —        | Hero stat line (`V2Hero` gets a `stats` slot rendered by an async server child; fallback two short bars); Section 1 counts; Section 4 marine (cards + `VintageLine` + `MarineDataNotice` gate + fallback Alert); Section 5 featured provinces and countries.                                            | no                               |
| `/deprem` (120)         | —        | Explorer (`initialEvents`, `provinceMap`); page-foot `EarthquakeAttribution`.                                                                                                                                                                                                                           | no                               |
| `/deniz` (900)          | —        | Hero lede (`showValues` picks one of two ledes; fallback 2 bars); explorer; layer catalogue.                                                                                                                                                                                                            | no                               |
| `/turkiye` (dynamic)    | —        | Two hero tiles (İl sayısı, İlçe sayısı); explorer + `itemListJsonLd` + `collectionPageJsonLd` (description uses the count).                                                                                                                                                                             | no — parents the `[slug]` routes |
| `/dunya` (dynamic)      | —        | One hero tile; explorer (+ `V2WorldContinents` in its `middleSections`) + both JSON-LD.                                                                                                                                                                                                                 | no — parents the `[slug]` routes |
| `/kitaplar` (3600)      | —        | Stat tile; catalogue + `itemListJsonLd`.                                                                                                                                                                                                                                                                | no                               |
| `/turkiye/bolge` (3600) | —        | Two hero tiles + `figuresAreLive` caption; regions grid; comparison table; `FaqSection` (answer 4 is data-derived; JSON-LD travels with it). The static-fallback logic (`REGIONS_STATIC_FALLBACK`, `figuresAreLive`) moves into one `loadRegions()` helper the four boundaries share through `cache()`. | no                               |
| `/oyun/bolge-bolge-il`  | —        | The 7-card grid (thumbs need the summary; fallback `CardGridSkeleton columns="2-4" count={7}`).                                                                                                                                                                                                         | no                               |

### Detail pages

| Page                            | Blocking                                   | S                                                                                                                                                                                                                                                                                                                             | L                                           |
| ------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/turkiye/[slug]` (120)         | `getProvinceBySlug` → `notFound()`         | Locator card's neighbour + similar-climate chips (`getProvinces`); marine block — points → layers/conditions → `ProvinceMarineSection`, the air/marine row layout and `MarineDataNotice`, one boundary; earthquake block — list + meta → `ProvinceEarthquakeSection` and the page-foot `EarthquakeAttribution`, one boundary. | no — commits 404/307 before return          |
| `/turkiye/bolge/[slug]` (86400) | `getRegionBySlug` → `notFound()`           | None: the single fetch feeds every section. Nothing to stream.                                                                                                                                                                                                                                                                | no — commits 404/307 before return          |
| `/dunya/[slug]` (86400)         | `getCountryBySlug` → `notFound()`          | `#komsular` section and its sticky-nav pill, both async over the cached `getCountries` (the pill hides when the section would).                                                                                                                                                                                               | no — commits 404/307 before return          |
| `/dunya/kita/[slug]` (86400)    | static registry `notFound()` (synchronous) | Locator map; country directory. Same cached `getCountryMapSummaryResilient`. The stale "this page reads no api" comment is corrected.                                                                                                                                                                                         | no — nothing blocks before the first return |
| `/kitaplar/[slug]` (86400)      | `getBookBySlug` → `notFound()`             | None: single fetch.                                                                                                                                                                                                                                                                                                           | no — commits 404/307 before return          |
| `/deniz/{4 basins}` (900)       | —                                          | Telemetry section: `V2SeaBasinDetailView` takes a `telemetry` ReactNode slot instead of `marinePoints`; the page fills it with a boundary around an async loader that renders the existing telemetry markup as a small client component.                                                                                      | no                                          |

### Tools, account, auth

| Page                         | Blocking                                                | S                                                                                        | L                                  |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| `/araclar/{3 tools}` (86400) | —                                                       | Workbench (`provincePoints`, `provinceAreas`); fallback `PlateSkeleton aspect="map"`.    | no                                 |
| `/hesabim` (dynamic)         | `getSession` → `redirect`; `readProfileForPage`         | `V2MemberHub` behind an async loader for the four reference lists.                       | no — commits 404/307 before return |
| `/hesabim/ayarlar` (dynamic) | `readProfileForPage` → `redirect` / `unavailable` alert | `V2AccountSettings` behind an async loader for provinces.                                | no — commits 404/307 before return |
| `/kayit` (dynamic)           | —                                                       | `V2RegisterCard` behind an async loader (`getProvinces`, throws → `error.tsx` as today). | **L** `auth`                       |

### Attribution-only readers

`/deprem/fay-hatlari`, `/deprem/hazirlik` (`getEarthquakeMetaSafe`) and `/hakkimizda`
(`getMarineLayersSafe`, for one copyright year) fetch for a footer credit only. Each credit goes
behind a boundary with a two-line `ProseSkeleton` fallback. The page bodies return synchronously;
no `loading.tsx`.

### `(play)`

| Page                               | Blocking                               | S                                                                                                       | L                                                                               |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/oyun/81-il`, `/oyun/bolge-bulma` | —                                      | `V2GameScreen` behind an async loader (`getMapSummaryResilient`); fallback `PageSkeleton shape="play"`. | no — static route, body returns synchronously; the boundary is the whole screen |
| `/oyun/bolge-bolge-il/[bolge]`     | `regionFromSlug` → `notFound()` (sync) | same                                                                                                    | no                                                                              |

### Untouched (no server fetch)

`/oyun`, `/araclar`, `/dunya/kita`, `/giris`, `/sifre-sifirlama`, `/sifre-sifirlama/yeni`,
`/e-posta-dogrulama`, `/gizlilik`, `/kullanim-sartlari`, `/deniz/kiyi-tipleri`, `/hakkimizda`'s
body, the design-system route, `error.tsx`, `not-found.tsx`.

Totals after the split: **1 `loading.tsx`** (`kayit` — Ruling A, task-14-addendum.md, amended this
down from the plan above's nine to three; Ruling B, Task 15's finding, amended it again from three
to one, dropping `turkiye` and `dunya` because they are not leaf segments) and roughly
**35 Suspense boundaries** across 30 pages. The `play` shape is used only as a Suspense fallback.

## Section 5 — Guards

All in vitest, node environment, following `docs/conventions.md` (comments stripped before any
source-text assertion; one scanner; mutation-checked before trusted).

1. **`lib/test-support/composition-scan.ts`** gains `walkLoadingFiles()` (basename `loading.tsx`
   under `PAGE_ROOTS`). `RENDER_ROOT_FILENAMES` is not widened; its docblock sentence "no
   `loading.tsx` … anywhere" is replaced with the measured count and a pointer to the new walker.
2. **`components/v2/page-composition-loading.test.ts`**, three counters:
   - `LOADING_FILES_NOT_RENDERING_PAGESKELETON = 0` — every `loading.tsx` imports and renders
     `PageSkeleton` and nothing else (no local `Skeleton`, no `animate-pulse`).
   - `ROUTES_OWED_A_LOADING_FILE_WITHOUT_ONE = 0` — a route is owed one when its page exports
     `dynamic = "force-dynamic"` AND its default export calls neither `notFound()` nor
     `redirect()` before its first `return` AND its segment is a leaf (no descendant `page.tsx` —
     Ruling B). The one route today (`/kayit`) is the expected population and is named in the
     test so the list cannot drift silently; a new force-dynamic leaf without `loading.tsx` goes
     red.
   - `SKELETON_SPELLINGS_OUTSIDE_PATTERNS = 0` — `animate-pulse` and `<Skeleton` do not appear
     under `PAGE_ROOTS` or `components/v2` (the `TableSkeleton` in `components/ui/table.tsx` is
     outside that surface).
3. **`components/patterns/page-skeleton.test.tsx`** — renders every shape and every piece with
   `renderToStaticMarkup`; asserts `role="status"`, `aria-busy`, the sr-only label, `aria-hidden`
   on bars, the `PlateSkeleton` aspect classes byte-equal to the explorer plates they mirror (read
   from the explorer sources, comments stripped, so a plate that changes size fails here), and
   `className?: never` on every export.
4. **`lib/api/request-dedupe.test.ts`** — a source pin, not a behavioural assertion: React's
   `cache()` is a passthrough under vitest (no request scope to memoize within), so the test reads
   `lib/api/*` source for the `cache(async ...)` wrapping instead of asserting one fetch per
   render.
5. **`components/patterns/rsc-boundary.test.ts`** already walks every `"use client"` file's
   closure; the new `_sections/*.tsx` files are server, and `V2SeaBasinDetailView`'s new slot is a
   `ReactNode`, so the existing guard covers the change without edits. Verified by running it.
6. Existing counters must not move: `HAND_DRAWN_CARDS` 190 / `HAND_DRAWN_WELLS` 169 /
   `HAND_DRAWN_CARD_SPELLINGS` 235, `PAGES_WITHOUT_H1` 0, `PAGE_BODY_SPELLINGS` 0, the breadcrumb
   trio 0, `sitemap-surface-symmetry` 33 pairs. Moving a `<Breadcrumbs>` into a `_sections` file
   would break the last one — breadcrumbs stay in `page.tsx`.

## Section 6 — Verification before "done"

- `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm build` (routing and page structure
  changed) with `scripts/assert-prerender-floor.mjs` green.
- Seeing the skeletons: with the dev container serving `:3000`, `docker pause cografya-api-dev`
  for the duration of one screenshot round, navigate to `/kayit` (route-level `loading.tsx`) and
  client-side to `/turkiye`, `/turkiye/ankara`, `/oyun/81-il` (section fallbacks); then
  `docker unpause`. Screens at 320, 360, 390 and 1440 px, light and dark. This is the only local
  way to hold a fallback on screen long enough to measure; it is not a production procedure.
- Layout-shift check: for each `loading.tsx` route, the skeleton screenshot and the loaded
  screenshot are compared at the same viewport for the top edge of the hero card, the stat strip
  and the plate; a difference above 8 px on any of the three is a measurement failure, not a
  tolerance.
- `pnpm sweep:overflow` against the running server (visible surfaces changed).
- `docs/design.md` roster and `components/showcase/registry.ts` reconciled; `docs/architecture.md`
  gains one paragraph under Routing describing the two conventions and the `cache()` rule in Data
  access; `TASKS.md` T-037 moves to DONE with the measured counts.

## Out of scope, recorded

- Per-section error boundaries (`error.tsx` per segment or `ErrorBoundary` around a section).
  Changing failure semantics is a separate decision; today's whole-page `error.tsx` stays.
- Changing any route's caching mode (`revalidate` ↔ `force-dynamic`). The Known-gaps note about
  build-time empty fallbacks on ISR routes is real and unrelated to loading UI.
- `V2LiveTicker`, `V2Hero` search index and `V2EarthquakeExplorer` client fetches: they already
  load after mount and manage their own pending state.
- Cache Components / PPR (`cacheComponents`) — not enabled in this repo; the design works under the
  current `revalidate`/`force-dynamic` model and would carry over unchanged.
