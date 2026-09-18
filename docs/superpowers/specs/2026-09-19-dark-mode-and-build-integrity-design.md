# Dark mode and build integrity — design (T-048, T-033, T-031c/d)

Status: approved, ready for implementation planning.

## 1. Goal

Three tasks that a 2026-09-19 audit confirmed are open, taken at their full recorded scope
rather than a reduced "make it shippable" cut:

- **T-048** — an API-less production build exits 0 and silently prerenders almost nothing.
  The shipped image is built exactly that way.
- **T-033** — the eight surviving CSS modules read raw Terra tokens that `.dark` never
  redefines, so they render at light-mode values on a dark page.
- **T-031c/d** — 865 raw Tailwind palette classes across 43 files, no test holding the
  number; then dark map surfaces.

They share one prerequisite and almost nothing else, which is what makes the sequence below
possible.

## 2. What the measurements actually say

Measured on the tree at `95a291e` (web) / `28a460e` (api), not assumed.

### 2.1 T-048

| Build                             | Exit  | Prerendered routes | `/tr/turkiye/istanbul` |
| --------------------------------- | ----- | ------------------ | ---------------------- |
| `API_BASE_URL=http://127.0.0.1:9` | **0** | **124**            | absent                 |
| API reachable                     | 0     | **980**            | present                |

856 routes vanish without a single non-zero exit code. `/tr/turkiye/*` collapses to one
entry (`bolge`); `/tr/kitaplar/*` to zero.

Two numbers appear below and they measure different things: `next build` reports **992**
static pages generated, while `prerender-manifest.json` lists **980** prerendered routes. The
guard in §5.1 reads the manifest, so 980 is the figure its floors derive from.

The production image is built under the left-hand column's conditions:

- `Dockerfile` declares no `ARG` or `ENV` for `API_BASE_URL`.
- `docker-compose.prod.yml` supplies `API_BASE_URL: http://api:3001` under `environment:`
  only, which is runtime, not build time.
- `lib/env.server.ts` **defaults** `API_BASE_URL` to `http://localhost:3001`, so the build
  does not even fail validation — it points at nothing and proceeds.
- The 16 `*Resilient`/`*Safe` wrappers keyed on `NEXT_PHASE === PHASE_PRODUCTION_BUILD`
  (`lib/api/provinces.ts:53`) swallow every failure to `[]`, so all six
  `generateStaticParams` return zero rows.
- `.github/workflows/ci.yml`'s Build job has no `services:` block, so CI reproduces the same
  broken build on every run.
- `"build": "next build"` — no threshold assertion, no manifest check, nothing downstream.

Two further facts that constrain the fix:

- The `api` service in `docker-compose.prod.yml` **publishes no host ports**. It is reachable
  only on the `cografya-net` bridge. The deploy runs `docker compose build web` on the host.
- `apiGet` attaches `INTERNAL_REQUEST_TOKEN` (`lib/api/client.ts:95`), which is what lets a
  992-page build past the throttler (`THROTTLE_TTL_MS=60_000`, `THROTTLE_LIMIT=120`, per
  handler). A build without that secret does not merely lose the exemption; it hits 429.

**Build flake, reproduced.** Three consecutive API-reachable builds: two failed at 248/992
and 744/992 with `ECONNRESET` (`/api/reference/districts/06`, then
`/tr/turkiye/bolge/karadeniz`), the third exited 0. The second failure happened with no
browser open, so the "an open Playwright session holds the API busy" attribution recorded in
TASKS.md T-044(4) is not the whole trigger; 19 build workers against one API instance is
enough on its own. The API's real concurrency ceiling was not measured (a probe without the
internal token only measured the throttler).

### 2.2 T-033

On `/tr/turkiye/istanbul` in dark mode, of 181 text elements carrying a CSS-module class,
**111 measure below 3:1** against their effective background. Worst: **1.14:1** — `#2b2622`
(`--color-ink`) on `#121e21`. The marine section renders as a white card on a dark page.

`app/globals.css:632` already states the cause in the repo's own words: `--color-ink` is a
raw Terra token that `.dark` never redefines globally.

Raw Terra token reads per surviving module:

| Module          | Lines | `var(--color-*)` reads |
| --------------- | ----- | ---------------------- |
| `marine`        | 713   | 51                     |
| `air-pollution` | 307   | 24                     |
| `climate`       | 416   | 22                     |
| `book-detail`   | 511   | 20                     |
| `site-search`   | 317   | 20                     |
| `book-video`    | 464   | 19                     |
| `earthquake`    | 153   | 16                     |
| `locator-map`   | 97    | 6                      |

### 2.3 T-031c/d

865 raw palette occurrences across 43 files. Of the 455 source lines carrying them, 137 also
carry a `dark:` and 318 do not.

By hue: amber 219, emerald 150, cyan 107, teal 99, rose 57, orange 45, red 33, sky 30,
yellow 29, stone 29, blue 24, slate 18.

The top four hues (575 of 865) are decorative and semantic accent, not categorical data.
Categorical data is already tokenised and already carries a measured contrast table in
`app/globals.css`: `--region-*` (Okabe-Ito, 7 of 8), `--eq-mag-1..5`, `--game-*`, `--map-1..6`,
and the per-chart tokens. This makes T-031c a rebinding and deletion task, not the
from-scratch palette design the card implies.

`components/ui/token-binding.test.ts` enforces the escape rule only; the raw palette count
appears in a comment. It moved from 749 to 895 to today's 865 without any test noticing.

Dark map surfaces (T-031d): on `/tr/oyun/81-il` in dark, land `rgb(18,30,33)` against sea
`rgb(18,43,61)` measures **1.17:1**, far under the 3:1 non-text floor of WCAG 1.4.11 that
`app/globals.css`'s own contrast tables are written against.

### 2.4 The shared blocker

`lib/theme/contrast.ts` throws on any input that is not a 6-digit sRGB hex. The `.dark`
palette is oklch. **Dark mode is currently unmeasurable with the repo's own instrument**, and
`docs/design.md` names that instrument as the one to use rather than recalling a ratio.

### 2.5 Collision surface

The T-033 file set and the T-031c file set intersect in exactly one file:
`app/[locale]/(site)/turkiye/[slug]/page.tsx`. Both may also touch `app/globals.css`.

## 3. Sequence

```
PR0  measurement layer (oklch + CVD)        [blocks all three]
  |
  +-- T-048   build integrity               [parallel]
  +-- T-033   eight CSS modules             [parallel]
  +-- T-031c  865 decorative decisions      [parallel]
                |
                +-- T-031d  dark maps
```

PR0 first because all three verify against it and two of them cannot state their result
without it. T-031d after T-031c because they collide on 8 files carrying 38% of T-031c's work,
and because `globals.css`'s contrast tables are derived from `--region-*` values that T-031c
may move.

Each box above gets its **own implementation plan**; this document is the design for the
programme, not for one branch. The single file both T-033 and T-031c touch
(`app/[locale]/(site)/turkiye/[slug]/page.tsx`) belongs to **T-033**, which rewrites its
climate markup wholesale; T-031c leaves that file alone and picks up whatever raw palette
classes survive after T-033 merges. Neither branch edits `app/globals.css` except T-031c/d,
which own the token layer.

## 4. PR0 — measurement layer

**Scope:** `lib/theme/contrast.ts`, new `lib/theme/cvd.ts`, new `lib/theme/delta-e.ts`, tests
for each.

- Extend `contrast.ts` to accept `oklch(L C H)` alongside hex, converting to sRGB. The hex
  path keeps its current behaviour byte for byte; existing callers do not change.
- `lib/theme/cvd.ts` simulates deuteranopia, protanopia and tritanopia, returning sRGB.
- `lib/theme/delta-e.ts` computes CIEDE2000, because **WCAG contrast ratio is the wrong
  instrument for a categorical set**. Measured before writing this: 20 of the 21 pairs of the
  seven `--region-*` tints are already below 3:1 today, worst 1.02:1 (`ege` / `akdeniz`).
  That is not a defect — Okabe-Ito separates by hue and chroma, not luminance, and a
  luminance-ratio assertion over it could never go green. WCAG ratio stays the instrument for
  text on a surface and for adjacent steps of an ordered ramp (`--map-1..6`, `--eq-mag-1..5`);
  categorical separation is measured as colour difference.
- A test asserts every pair of the seven tints stays at **ΔE00 ≥ 10** under normal vision and
  all three simulations, and carries a **positive control**: a known-failing pair the same
  assertion rejects. A simulation that silently returned its input would otherwise pass
  everything.

Measured floors the test pins, and the numbers T-031d's dark set has to match or beat:

| Vision       | Worst pair ΔE00                | Pairs below 10 |
| ------------ | ------------------------------ | -------------- |
| normal       | 21.7 (`ege` / `ic-anadolu`)    | 0 of 21        |
| protanopia   | 12.2 (`marmara` / `karadeniz`) | 0 of 21        |
| deuteranopia | 11.6 (`ege` / `ic-anadolu`)    | 0 of 21        |
| tritanopia   | 10.9 (`ege` / `karadeniz`)     | 0 of 21        |

**TDD:** the first commit feeds `contrastRatio` an oklch value and is red because the current
implementation throws. No product file is touched in PR0.

## 5. T-048 — build integrity

Branch `feature/t048-build-integrity`. Three parts, in this order.

### 5.1 The guard, proven red first

`"build": "next build && node scripts/assert-prerender-floor.mjs"`.

Not a `postbuild` lifecycle script: pnpm ships `enable-pre-post-scripts` disabled by default,
so a `postbuild` guard could silently never run. That is this programme's recurring defect
class, and the fix is not to remember the setting but to put the guard where it cannot be
skipped.

The script reads `.next/prerender-manifest.json` and asserts **named subsets, not a total**:
provinces, books, regions, continents, design-system categories. A total-only floor lets a
partial collapse hide inside a healthy sum — the same shape as `PAGE_BODY_SPELLINGS = 0`
reading a missing wrapper as compliance.

The total floor is today's 980. The per-subset floors are counted from the same manifest in
the implementing commit and written down there, so each one is a measured number rather than
a guess carried from this document. The guard is pinned failing against a `127.0.0.1:9` build
before it is allowed to go green, in its own commit, with no other file touched.

### 5.2 Give the build the API

- `ARG API_BASE_URL` in `Dockerfile`, defaulted so a local `docker build` still works.
- `INTERNAL_REQUEST_TOKEN` **must not be an `ARG`** — build args are recorded in image
  history, which would leak the shared secret into every image layer listing. It goes through
  a BuildKit `--mount=type=secret` read at build time only.
- Network: two candidates, decided by a local spike, not by assumption (§8).

### 5.3 CI

CI builds what production builds, so the Build job stands up a real API.

An earlier draft of this section said "add `services:` (postgres, redis, api)". That was
wrong and the plan caught it: **`cografya_api` publishes no image anywhere** — its deploy
builds on the host — so there is nothing for a `services:` entry to pull. What makes this
feasible instead is that the seed data is committed in-repo (1.7 MB under
`src/database/seeds/`, with `db:seed:{geography,regions,world,books,reference}` CLIs).

The Build job therefore: runs `postgres` and `redis` as services, checks out
`Sertturk16/cografya_api` beside the web checkout, runs `migration:run`, runs the five seed
CLIs, boots the API with `start:prod`, and only then builds the web with the floor guard
armed. Cost: roughly 3-5 minutes added per PR, growing with the seeds. Accepted deliberately
(owner, 2026-09-19) over the cheaper alternatives, because a build job that cannot build the
real thing is the defect this task exists to remove.

CI's API runs with `NODE_ENV=development` and a CI-local `INTERNAL_REQUEST_TOKEN`; the
production-only secrets are not needed and are not put in web CI.

T-047's overflow sweep becomes addable as a fourth job once this API exists, but stays out of
this task.

## 6. T-033 — eight CSS modules

Branch `feature/t033-css-modules`. One PR per module, ordered by dead-class ratio so deletion
precedes conversion — T-041 already migrated 11 call sites inside files that were entirely
dead, and that is not repeated.

Each module's PR closes with: a dark-mode contrast measurement through PR0's harness,
`pnpm sweep:overflow`, and screenshots at 320/360/390/desktop in both themes.

**Permanent guard:** a test asserting that no surviving `*.module.css` reads a raw Terra token
that `.dark` does not redefine. Pinned red against today's violations first, then driven to
green by the conversions. Without it the next module added re-opens the hole, exactly as
`marine-attribution.module.css` shipped a mandated licence notice at 2.34:1 under a
"do not touch" rule.

## 7. T-031c, then T-031d

Branch `feature/t031c-decorative`.

### 7.1 Inventory before edits

All 865 occurrences are classified and committed as a reviewable inventory: **data**,
**semantic**, or **pure decoration**. This is what makes "case by case" tractable — it turns
575 scattered judgements into one document a reviewer can disagree with in one pass, instead
of 575 diffs to re-litigate.

### 7.2 Application

- Semantic occurrences bind to the existing bridge tokens (`--warning`, `--success`,
  `--accent`, `--destructive` and their `-strong` members).
- Pure decoration is removed rather than re-tokenised.
- Data occurrences that duplicate an existing token set bind to it; the recorded defect that
  region badge colour does not match region map colour is closed here.

### 7.3 The counter

The count is pinned by a test and driven 865 → 0 with named exemptions. The card's own
complaint is that nothing held this number while it moved twice; a comment is not a guard.

### 7.4 T-031d

Dark map surfaces, and a dark-adapted seven-tint region set whose CVD safety is proven with
PR0's harness rather than asserted: the new set has to hold ΔE00 ≥ 10 across all 21 pairs
under all three simulations, the floor §4 measured on the light set. `globals.css`'s WCAG
1.4.11 contrast tables are re-measured against the new values — those tables are about fills
against labels and against the map surface, which is a luminance question and stays WCAG.

## 8. Open questions, resolved by spike not assumption

**How does the Docker build reach the API?** The `api` service publishes no host ports and
the build runs on the production host. Two candidates:

1. `build.network: cografya-net` in compose, so the builder joins the app bridge and `api`
   resolves. Cleanest if BuildKit accepts a named network here.
2. Publish the API on `127.0.0.1:3001` and build with `build.network: host`, pointing
   `API_BASE_URL` at loopback. Well-supported, at the cost of a loopback-bound published port.

Decided by trying both locally before writing the deploy change. Nothing about the Hetzner
host is assumed from here.

**Build concurrency.** The `ECONNRESET` flake is reproducible but its ceiling is unmeasured.
Whether the fix is `experimental.cpus`, an API-side concurrency limit, or retry is decided
after measuring with the internal token attached, inside T-048.

## 9. Out of scope

T-019, T-039, T-025, T-040, T-037, T-050, T-051, T-052, T-049, T-043, T-044, T-030b. T-047's
sweep stays a local script; adding it to CI waits on T-048 landing an API service.

## 10. Done means

Per branch: typecheck, lint and test green; `pnpm build` green with the new floor guard;
`pnpm sweep:overflow` green for anything visible; screenshots at the four mandated widths in
both themes; and every contrast or CVD figure quoted in a PR produced by PR0's harness rather
than recalled.
