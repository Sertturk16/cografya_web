# V1 retirement — design (T-032)

Status: approved, ready for implementation planning.

## 1. Goal

Delete V1 entirely. V2 loses its `/v2` prefix, drops `noindex`, and becomes the public,
indexed site.

This unblocks three things that are currently shaped around V1's existence: the dark-mode
programme (T-031), the design port of the components V2 still borrows from V1 (T-033), and
the per-component `.dark` scoping machinery none of us want to build twice.

## 2. Why this comes first

T-031 (dark mode) was the original request. Investigation found that doing it while V1 lives
costs work that V1's removal immediately throws away:

- `.dark` today lands on `<html>` globally. Mounting a real `ThemeProvider` with
  `defaultTheme: "system"` would hand every V1 visitor whose OS prefers dark a **broken**
  V1 page: `body` picks up `--background` from the `.dark` block while V1's frozen CSS
  modules keep their light values. V1 is the live indexed site, so that is a production
  regression, not a cosmetic one.
- Avoiding that regression means a theme boundary — a `/v2` route marker, or split root
  layouts, or a `:has(.v2-app)` scope — plus a `.v1-scope` custom-property shim applied to
  every V1 component rendered inside a V2 page. All of it is scaffolding with a known
  expiry date.

With V1 gone, T-031's mechanism work reduces to "mount the provider, put `.dark` on
`<html>`".

## 3. Route inventory

V1 has 26 routes; V2 has 33. Twenty of V1's routes already have a V2 counterpart **at the
same path**, so the migration is mostly a move rather than a redirect.

Six V1 routes have no V2 counterpart:

| V1 route                | Decision                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| `/hakkimizda`           | Port to V2. Carries T-030's team/mission/contact copy (PR #147). |
| `/e-posta-dogrulama`    | Port to V2. Landing page for the SES verification mail.          |
| `/sifre-sifirlama`      | Port to V2. Path is hard-coded in the API.                       |
| `/sifre-sifirlama/yeni` | Port to V2. Reads `?token=`; path hard-coded in the API.         |
| `/araclar/[...rest]`    | **Delete.** Superseded by a root `not-found` — see §7.           |
| `/design-system`        | **Delete.** Internal; `docs/design.md` is the source of truth.   |

V2's login and registration are already built (`v2-login-card`, `v2-register-card`), so only
the three mail-driven auth flows need porting.

## 4. URL migration

`/v2/*` → `/*`. Every V2 route keeps its localized segment map; only the prefix disappears.
Scope: 99 `pathnames` entries in `i18n/routing.ts`, 758 occurrences of `/v2` across 74
non-test source files.

**V2 route files move up into the paths their V1 counterparts vacate.** Delete the V1 file
and move the V2 file into place in the same commit so Git's rename detection has the best
chance of preserving blame.

Redirects:

- `/v2/:path*` → `/:path*` and `/en/v2/:path*` → `/en/:path*`, permanent (308). The prefix
  was `noindex`, but it is in the sitemap twice today and is bookmarked by the owner and by
  QA. A permanent redirect costs one table entry and avoids dead links.
- No redirect for the twenty paths V2 inherits — the URL does not change, only what serves it.
- `/design-system` gets no redirect. It was never linked publicly or listed in the sitemap;
  a 404 is the honest answer.

`next.config.ts` already carries a `redirects()` table (one entry) guarded by
`lib/seo/redirects.test.ts`, whose docblock states that its `toHaveLength(1)` assertion must
be updated when a second entry lands. Extend that table and that assertion; do not invent a
parallel mechanism.

Also update: `app/sitemap.ts` (the two `/v2/dunya/kita` entries normalize), `app/robots.ts`,
`lib/seo/routes.fixture.ts` (`NOINDEX_ROUTE` and the V2 fixtures), and the `noindex` metadata
block in the V2 layout, which is deleted outright.

## 5. Cross-repo contract

`cografya_api/src/auth/mail/mail-copy.ts` hard-codes three web paths and says so in its own
docblock:

```
/sifre-sifirlama/yeni   ·  /en/reset-password/new
/sifre-sifirlama        ·  /en/reset-password
/giris                  ·  /en/login
```

This migration **preserves all three**, so the API needs no change. Nothing in CI enforces
that, though — `openapi:check` covers DTOs, not route names — so the preservation must stop
being a coincidence.

Extend `lib/seo/auth-routes.test.ts` with a tripwire asserting that `i18n/routing.ts` still
maps those three routes to exactly those six localized paths, with a comment naming
`mail-copy.ts` as the reason. A future rename then fails a test instead of silently breaking
password-reset mail for real users.

## 6. What is deleted, and what V2 actually borrows

The earlier framing — "ten directories are adopted" — was wrong. Measured by what V2 imports:

### Group A — V2 takes one type or helper; the rest is V1 and goes

| Directory           | What V2 uses                          | Action                                                            |
| ------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `components/game/`  | `region-labels.ts` (33 lines, helper) | Move helper to `lib/game/`; delete 24 files and 5 CSS modules.    |
| `components/home/`  | `FeaturedCardItem` (type only)        | Move type to `lib/home/`; delete the 133-line component.          |
| `components/tools/` | `ProvinceArea` (type only)            | Move type to `lib/tools/`; delete `tool-island.tsx` (1235 lines). |

`components/game/game-island.tsx` is already recorded as dead in T-015's completion note.

### Group B — a parallel implementation V2 replaced but never removed

`components/map/` (16 files, 3 CSS modules). V2's map explorers import none of it; they use
`lib/map/v2-zoom-pan` and `lib/map/continent-theme`. Consumers:

```
turkey-map-section   → V1 pages + game/game-map + marine/marine-map   (all V1)
world-map-section    → V1 /dunya only
map-zoom-pan         → game/game-map + tools/tool-map                 (both V1)
inland-water-layer   → V1 consumers only
map-hover-card       → nobody; dead today
locator-map          → V1 pages + country/country-flag + /v2/dunya/[slug]
```

Only `locator-map` has a V2 consumer, and V2 already ships three locator components of its
own. Migrate `/v2/dunya/[slug]` to a V2 locator and the directory goes entirely. The same
applies to `components/marine/marine-map.tsx` and `components/tools/tool-map.tsx`, both
superseded by `v2-marine-map-explorer` and `v2-tool-workbench`.

If the `/dunya/[slug]` migration turns out to need real work, adopt `locator-map` alone and
hand it to T-033 rather than blocking this task — but check first, because the expected
outcome is deletion.

Note for T-031: `components/map/map.module.css` is the reader of several measured contrast
tables documented in `app/globals.css`. Once it is gone, those tokens lose their only
consumer and the dark-map work (T-031d) shrinks to V2's own SVG explorers.

### Group C — genuinely rendered, adopted for now

`air`, `book`, `climate`, `earthquake`, `marine` (only `vintage-line` and
`province-marine-section`), `site-search`.

These stop being "frozen V1" and become code V2 owns. **Their design is pre-V2 and will be
brought up to the V2 language in T-033** — adoption here is a holding position, not an
endorsement. Do not invest in restyling them in this task.

### Also deleted

The 26 V1 route directories; `components/site-header*`, `site-footer*`, `site-nav/`,
`auth/`, `country/`, `entity-index/`, `favorites/`, `province/`; their CSS modules; the
`AuthMount` mounted in the root layout (V2 has `V2AuthDialog`); `components/breadcrumb.tsx`;
and every V1 utility class in `app/globals.css` — `.container`, `.page`, `.section`, `.lede`,
`.card`, `.chip`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.hero`, `.hero-actions`,
`.province-grid`, `.province-card`, `.breadcrumb`, `.placeholder-note`, `.wrap-long-tokens`,
`.skip-link`. Each was checked as a standalone class token across `components/v2` and
`app/[locale]/v2`: all zero. `.skip-link` is on the list because the skip link's markup moves
into the `(site)` layout (§8) and is restyled in Tailwind there. The
`body:has(.v2-app) > header, footer` suppression rule goes with them, as do the `--btn-sm-*`
tokens, whose only readers are `.btn-sm` and the deleted `site-nav` module.

## 7. Error boundaries

V2 has no `not-found.tsx` and no `error.tsx`. Today a V2 page calling `notFound()` renders
the V1-styled 404 **with V1 header and footer**, because the not-found subtree replaces
`children`, so `.v2-app` never renders and the suppression rule never matches. That is a live
bug this task closes.

The fix is structural rather than another catch-all. `app/[locale]/araclar/[...rest]/page.tsx`
exists because a genuinely unmatched URL reaches no `[locale]` segment and therefore falls to
Next's own unstyled, unlocalized 404; its docblock notes that a root `app/not-found.tsx`
would be the real fix but would need its own `<html>/<body>` shell.

Build that shell. It is the standard App Router answer and it scales: every future path gets
the branded 404 without anyone remembering to add a catch-all to their subtree.

- **`app/not-found.tsx`** (new) — minimal own `<html>/<body>`, bilingual TR + EN copy. It
  renders outside `[locale]`, so it cannot resolve a locale from the request without
  forcing dynamic rendering; showing both languages is honest and static.
- **`app/[locale]/not-found.tsx`** — restyled to V2 (it currently uses deleted V1 classes).
  Still the boundary for in-locale `notFound()` throws, which is the common case.
- **`app/[locale]/error.tsx`** and **`app/global-error.tsx`** — restyled to V2, V1 imports removed.
- **`app/[locale]/araclar/[...rest]/page.tsx`** — deleted, superseded.

Keep the existing behaviour that a real 404 status is returned, and keep the recorded
limitation about the 404's `<title>`; neither is changed by this task.

## 8. Layout consolidation

`V2Header` and `V2Footer` take no props and are called identically — 30 and 28 times, copied
into each page. Three routes omit them on purpose (the game play surfaces, which T-015 gave
fullscreen and a landscape lock); two more omit the footer by apparent oversight
(`/oyun/bolge-bolge-il`, `/turkiye/[slug]`), and 13 routes render no `<main>` at all while
the root layout already wraps `children` in one — so the 20 that do render `<main>` nest it.

Since every page file is being touched anyway, hoist the chrome into layouts and make the
fullscreen exemption structural instead of a thing to remember:

```
app/[locale]/
  layout.tsx          root: <html>/<body>, providers, Toaster
  (site)/
    layout.tsx        skip link · V2Header · <main id="main-content"> · V2Footer
    page.tsx, turkiye/, dunya/, deniz/, deprem/, kitaplar/, araclar/,
    oyun/page.tsx, oyun/bolge-bolge-il/page.tsx, giris/, kayit/, ...
  (play)/
    layout.tsx        bare wrapper, no chrome
    oyun/bolge-bulma/, oyun/81-il/, oyun/bolge-bolge-il/[bolge]/
```

Route groups do not affect URLs, so paths are unchanged. `<main>` and the skip link are
defined once; the 20 nested `<main>` elements and the two missing footers are fixed as a
side effect. A new page gets correct chrome by default, and opting out is a deliberate
choice of directory.

Verify during implementation that no page passes props to the header or footer once V1 is
out of the way; the current call sites say they do not.

## 9. Pre-launch product work

**Data-gated pages.** `MARINE_ENABLED`, `AIR_QUALITY_ENABLED`, `EARTHQUAKE_ENABLED` and
`ELEVATION_ENABLED` are all `false` in production. Publishing V2 makes these pages public:

- Editorial, no live data, safe as-is: `/deniz/kiyi-tipleri`, `/deprem/fay-hatlari`,
  `/deprem/hazirlik`, `/dunya/kita`, `/turkiye/bolge`.
- Data-dependent: `/deniz/karadeniz`, `/deniz/ege`, `/deniz/marmara`, `/deniz/akdeniz`,
  `/deprem`.

Apply T-024's pattern to the five data-dependent pages: conditional copy driven by whether
real values are present, no claim of live telemetry when there is none, a neutral
"source not connected yet" state instead of empty tables. Never a fabricated number. When a
flag is switched on, the values fill in with no further copy change.

**English content.** `lib/seo/indexing.ts` already carries `EN_CONTENT_READY = false`, which
drives per-surface index decisions. V1 tells English readers the truth on seven pages via
`EnWorkInProgressNotice`; V2 says nothing. Port the notice to V2 as a Tailwind component and
**drive it from `EN_CONTENT_READY`**, not from a per-page import. Today seven pages each
remember to render it; binding the notice and the indexing decision to one flag means the
two cannot drift, and flipping the flag retires the notice everywhere at once.

**Launch gating.** The work accumulates on `dev`. The merge to `main` — which is the launch —
happens after T-019 delivers a domain and TLS. Launching before that would introduce the new
site with login, favourites and every game mode broken, because `Secure` cookies and
`crypto.randomUUID` both require a secure context.

## 10. Out of scope

- **T-033** — porting Group C to the V2 design language (~37 files, ~6,100 lines of TSX and
  2,583 lines of CSS modules, before this task's deletions shrink it).
- **T-031** — the dark-mode programme, which follows T-033 so it lands on a codebase with no
  CSS modules left.
- **T-031c** — the categorical-palette redesign is independent of all of the above (34 files,
  all under `components/v2` and `components/ui`) and may be scheduled at any point without
  wasting work.
- Restyling Group C, adding features to ported routes, and the `viewport.themeColor`
  light/dark pair (T-031a's business).

## 11. PR decomposition

Four PRs. The first two are independent of each other.

```
PR1  Port the six routes to V2            (still under /v2; V1 still standing)
PR2  Product work + error boundaries      (conditional copy, EN notice, 404/error)
        ↓
PR3  URL migration                        (/v2 dropped, V1 routes deleted, redirects,
                                           noindex removed, layout consolidation)
        ↓
PR4  Dead-code removal                    (site-*, auth, country, entity-index, favorites,
                                           province, map, Group A remnants, V1 CSS)
```

PR3 must be atomic: the prefix removal, the V1 route deletion and the redirect table land
together or the site is briefly inconsistent. PR4 is deliberately separate so PR3's diff
stays reviewable.

## 12. Verification

Per PR: `pnpm typecheck && pnpm lint && pnpm test`, and `pnpm build` for every PR that
touches routing or SEO (PR1, PR2, PR3).

Specific gates:

- `lib/seo/redirects.test.ts` — updated entry count, invariants still hold.
- `lib/seo/auth-routes.test.ts` — new cross-repo tripwire (§5) passes.
- `components/route-urls.test.ts` and the `lib/seo/*` route tests — updated for the new paths.
- Sitemap output diffed before and after PR3; no `/v2` URL survives, no path 404s.
- A live `curl -I` on a sample of migrated and redirected URLs, since a source-text test
  cannot prove the server actually 308s — the honesty `redirects.test.ts` already writes into
  its own docblock.
- Playwright at 320, 360, 390 px and desktop on the ported routes and the new 404.
- `pnpm codegen:check` and the `generate:*:check` gates if any input is touched.

## 13. Risks

- **The migration's size.** 758 occurrences across 74 files is mechanical but wide; a missed
  reference is a 404 in production. The sitemap diff and the build are the net.
- **Auth mail paths.** Preserved by design, but the only thing that will keep them preserved
  is the tripwire in §5. It is not optional.
- **`/dunya/[slug]`'s locator map.** Expected to be replaceable by a V2 component; if not,
  adopt and defer rather than expanding this task.
- **`--header-height` changes meaning.** It is `3.5rem`, measured against the V1 sticky
  header, and `app/globals.css` documents five readers. Three of them are deleted here
  (`/turkiye`'s letter jump, `game-map.module.css`, `site-nav.module.css`); the surviving two
  are the marine and climate anchor offsets inside adopted Group C modules. After V1 goes,
  the header those offsets must clear is `V2Header`, whose height is not necessarily
  `3.5rem`. Re-measure it and update the token, or a followed `#fragment` on a province page
  lands underneath the sticky header — a silent failure no test currently catches.
  `components/anchor-offset-token.test.ts` is the existing tripwire for this token family and
  should be extended rather than bypassed.
- **Launch timing depends on T-019**, which depends on a domain that is not yet in hand. The
  work is sequenced so that none of it is blocked by that, only the final merge.
