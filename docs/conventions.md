# cografya_web — conventions

Read before writing a component, a test, or a commit.

## Code style

- Prettier: double quotes, semicolons, trailing commas, width 100. ESLint: `eslint-config-next`
  (core-web-vitals + TS) with prettier last. `pnpm lint` is plain `eslint`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `paths { "@/*": ["./*"] }`, bundler
  resolution, `allowImportingTsExtensions`. `.mjs` scripts are not typechecked.
- Server code says `import "server-only"` at the top. Client components say `"use client"`
  and never import `lib/env.server.ts`, `lib/api/client.ts` or `lib/*/transport.server.ts`.
- `cn()` from `lib/utils.ts` for class merging. `lucide-react` for icons. Toasts via
  `sonner` (`components/ui/sonner.tsx`).
- Comments explain a measured reason. Do not cite `ENGINEERING.md`, `CONVENTIONS.md`,
  `DEC ...` ids or reviewer tags; those documents are gone (`../CLAUDE.md`).

## Building a V2 page

1. Add TR + EN entries to `pathnames` in `i18n/routing.ts`.
2. `app/[locale]/(site)/<route>/page.tsx` — or `(play)/` for a fullscreen game screen;
   the group decides which chrome the page gets. Server component, `setRequestLocale(locale)`,
   `generateMetadata` via `buildMetadata()`, data via `apiGet` or a `lib/<domain>` loader,
   `notFound()` on unknown slug.
3. Presentational pieces in `components/v2/v2-<name>.tsx`; interactive parts as small
   `"use client"` islands. Heavy widgets (maps, games) via `dynamic(..., { ssr: false })`
   inside a fixed-size box.
4. Use `components/ui/*` primitives and Tailwind theme keys (`bg-primary`, `text-muted-
foreground`, `border-border`, `font-heading`). Colours per `docs/design.md`.
5. Links: `Link` from `@/i18n/navigation`; button-looking links use `buttonVariants`.
6. Co-locate a `*.test.tsx` structure test under `components/v2/` if the component has
   branching or a11y-relevant structure (see existing `*.structure.test.tsx`).

## Tests (vitest, node environment)

- Co-located next to source: `foo.test.ts`, or a qualified suffix (`*.structure.test.tsx`,
  `*.contract.test.ts`, `*.<scope>.test.ts`). No `__tests__` folders.
- Included globs: `lib/**`, `components/**`, `tools/**`. Nothing under `app/` runs.
- No jsdom; component tests render with React and assert on the tree/markup. `server-only`
  is stubbed via `test/stubs/server-only.ts`; `next-intl` is inlined so `getPathname` is real.
- **A test that greps source text strips comments first.** Nothing under `app/` runs, so page
  guarantees are asserted by reading source — and prose is the thing most likely to contain the
  string you are searching for. A docblock explaining why a credit is required satisfies a naive
  search for that credit, so the test passes on the explanation after someone deletes the markup,
  and the "fix" for a false positive is to delete the explanation. This has now been arrived at
  independently four times (`locator-attribution.test.ts`, `orphan-stylesheets.test.ts` — retired
  with the last CSS Module in T-033, `lib/map/tr-inland-water-jrc.test.ts`,
  `components/v2/footer-source-badges.test.ts`), the last
  of which shipped green against a comment in `i18n/routing.ts` — a module reachable from every
  page through `Link` and rendering nothing. Strip with `lib/test-support/strip-comments.ts`, not
  a pair of `String.replace` calls: a `/*` inside a line comment (`messages/*.json`) makes the
  block-comment regex eat everything to the next delimiter — 220 lines of `v2-sources-section.tsx`,
  including the scope a `not.toContain` was asserting about — and swapping the two replaces only
  moves the hole. A stylesheet gets `stripCssComments` from the same module instead: `//` is not a
  comment in CSS, so the JS scanner would eat the rest of any `url(https://…)` line. A check that
  reports `file:line` or an offset reads `maskComments` (same module, comments blanked in place)
  instead: `stripComments` collapses a block comment to one space, so its line numbers drift. Exclude
  routing and config modules from an import-graph walk; then **mutation-check it** — break the
  thing the test exists to catch and watch it go red, because a source-text assertion that has
  never failed has not been shown to work.
- One JSX scanner, not one per suite. `lib/test-support/composition-scan.ts` owns the walkers, the
  literal extractor, the binding resolver and the source-injection harness that the three
  `components/v2/page-composition-*.test.ts` suites (containers/breadcrumbs, headings, cards) count
  with. T-035 shipped two extractors in one module and they disagreed about 22 real elements, with
  the older one mangling every template hole it read; a second extractor is where a counter hides.
  Memos go through that module's `perFileCache()` / `graphCache()` so the harness invalidates them —
  a bare `new Map()` cache fails `composition-scan.test.ts`.
- Re-pointing a citation after a deletion: check the cited IDENTIFIER still exists, not just the
  filename — `git grep <symbol>` before writing the new sentence.
- Fixtures: `test/fixtures/{marine,books}`. Do not add network calls to tests.
- Playwright is a library here, not a runner: no `playwright.config`, no e2e suite. Ad-hoc
  audits live in `scripts/` and `tools/dev-fixtures/`. One of them is not ad-hoc —
  `pnpm sweep:overflow`, below — and it is still not in CI.

## The overflow sweep (`pnpm sweep:overflow`)

`scripts/sweep-overflow.mjs` asserts `documentElement.scrollWidth <= clientWidth` on one route
per SHAPE, at 320/360/390/**768**/desktop, in light and dark, and exits non-zero naming the
route, the viewport, the theme, the overflow in pixels and the offending element with its
computed `min-width` / `flex-shrink` / `white-space`.

It exists because every other tripwire in this repo counts SOURCE TEXT, and the defect class
that keeps recurring is not in the JSX tree at any depth: the ECMWF licence notice overflowing
at 320 (T-038), `climate.module.css`'s bare `min-width: 300px` (T-046), and a `shrink-0` badge
row on seven region routes (T-046). Two CSS-Module declarations and a flex child's shrink
behaviour — no scanner would ever have found them, and all three were caught by this
comparison run by hand.

- **Point it at a production server, and REBUILD FIRST.** `pnpm build` then `pnpm start`, and
  `pnpm sweep:overflow -- --base-url=http://localhost:3000`. A `pnpm dev` server works and
  will usually be what you have, but it re-renders every navigation — so it is slower, it
  holds the API open for the whole run (the recorded `ECONNRESET` flake), and it can serve a
  404 for a route that exists after enough HMR. The sweep checks HTTP status for exactly that
  reason; a `LOAD FAILURE` line is not a pass.
  The rebuild is not ceremony: a `.next` left from someone else's probe reports a defect that
  is not in the tree. T-047's own five-viewport run went red on `/hakkimizda` at four
  viewports naming `div.dark:min-w-[900px]` — a class absent from source and baked into a
  build made two rounds earlier. Stale dev serves a false NEGATIVE (a 404 has no overflow);
  stale production serves a false POSITIVE. Check the selector against the source before you
  believe either.
- **Done means, for any task with a visible UI change:** `pnpm sweep:overflow` green, or the
  filtered run covering the routes you touched (`-- --filter=turkiye`). Never widen the
  tolerance to get there — a tolerance that hides a real overflow is worse than no sweep.
- The route list is `lib/overflow-sweep/routes.ts`, and `routes.test.ts` holds it to one rule
  in plain vitest: every entry is a live key of `routing.pathnames` (a renamed route must not
  leave the sweep measuring 404s). It had a second — every surviving `*.module.css` is named by
  at least one route — which T-033 deleted along with `SweepShape.modules` when the last
  stylesheet went, because a coverage claim over an empty population cannot fail. That keeps the
  list from going BROKEN, not from going INCOMPLETE: **a new route lands in the "not swept"
  footer and nothing fails.** If you add a route, decide out loud whether it is a variant of a
  listed shape or a new one.
- The browser-free half of this used to be `components/css-module-fixed-widths.test.ts`, a census
  of every fixed-`px` inline-axis declaration in the CSS Modules, so changing
  `min-width: min(300px, 100%)` back to `min-width: 300px` would red `pnpm test`. T-033 retired the
  last module and deleted the census with it. The rule it stood for did not go: when a conversion
  deletes a pinned CSS value, the pin moves to the consumer's own test rather than evaporating
  into the sweep. `lib/test-support/converted-floor.ts` carries it, and `book-detail-floors`,
  `bench.structure`, `earthquake.structure` and `locator-map-floors` are the tests that hold the
  values. It covered one of the three recorded defects, not all three — the other two are a text
  node with no wrapping opportunity and a Tailwind class in JSX.
- 768 is in the list because without it `md:min-w-[900px] lg:min-w-0` passes every check —
  inactive below 768, harmless at 1440. It closes the widest part of that band (any `sm:`- or
  `md:`-scoped width above 768 now overflows a swept viewport); 390–768 and 768–1440 stay
  open, and `SWEEP_VIEWPORTS`' docblock says what lives in each.
- Report goes to `.tmp-scratch/overflow-sweep.json` as well as stdout. 22 URLs × 5 viewports ×
  2 themes = 220 checks in **85s** against a production build, four browser contexts in
  parallel. `-- --concurrency=1` gives a stable order at roughly 3.5× the wall clock (measured
  at four viewports: 198s against 57s).
- **It is not a CI job today, but the reason it wasn't one is gone.** The blocker was never
  the 85s — it was that CI had no API on :3001, so the build CI swept would not have been the
  build production ships. The degradation is not in `lib/env.server.ts` (that file throws; it
  only carries a comment pointing here) — it is the 16 `*Resilient`/`*Safe` wrappers in
  `lib/api/*.ts`, each gated on `isProductionBuild()`
  (`NEXT_PHASE === PHASE_PRODUCTION_BUILD`): swallow to `[]` during `next build`, re-throw at
  runtime. That asymmetry is what produced the 500s. Measured on an API-less build:
  `API_BASE_URL` pointed at a dead port builds **136 pages instead of 992**, exit 0, in 19s
  instead of 110 — and several of the 136 bake an empty state rather than being absent, which
  `docs/architecture.md` calls the worse failure. A server from that build answers **HTTP 500
  on 8 of the 22 URLs**: `/turkiye`, `/turkiye/istanbul` (both locales), `/turkiye/bolge/
marmara`, `/dunya`, `/dunya/almanya` and both book routes. A sweep over that build would have
  been permanently red, or green over fourteen pages of which only five render what production
  renders.
- **What T-048 changed.** `ci.yml`'s `Build` job now stands a real API up from the committed
  seeds before `pnpm build`, and `scripts/assert-prerender-floor.mjs` asserts the build
  actually prerendered its ~980 routes. So a CI build is now the production build, and the
  sweep could run in that same job against `next start` over its output while the API is still
  listening. **It is deliberately not wired up as part of T-048** — that branch's scope is
  build integrity, and adding a browser matrix to a job whose wall clock is already the thing
  being watched is a separate decision. What is left to weigh is now only cost and tolerance:
  a Playwright browser download on the runner, the 85s of sweep, and the bullets above about
  the sweep going INCOMPLETE rather than BROKEN. The API argument no longer applies.

## Generated artifacts

| File                                   | Regenerate                                  | Gate                        |
| -------------------------------------- | ------------------------------------------- | --------------------------- |
| `lib/api/schema.ts`                    | `pnpm codegen` (after copying the API spec) | `codegen:check`             |
| `lib/map/tr-provinces.generated.ts`    | `pnpm generate:map`                         | `generate:map:check`        |
| `lib/map/world-countries.generated.ts` | `pnpm generate:world-map`                   | `generate:world-map:check`  |
| `lib/map/tr-inland-water.generated.ts` | `pnpm generate:water`                       | `generate:water:check`      |
| `lib/map/tr-context.generated.ts`      | `pnpm generate:tr-context`                  | `generate:tr-context:check` |
| `lib/map/tr-context-tall.generated.ts` | `pnpm generate:tr-context` (same run)       | `generate:tr-context:check` |

Every entry must be in `.prettierignore` AND `eslint.config.mjs` `globalIgnores`, otherwise
lint-staged rewrites it on commit and the gate goes red on an untouched file.

## Git

- Conventional Commits, scope = surface (`feat(v2/header):`, `fix(deploy):`, `feat(v2/oyun):`).
- Pre-commit: `eslint --fix` + `prettier --write` on staged `ts/tsx`, prettier on
  json/css/md/yml, then a project-wide `tsc --noEmit`. Commit-msg: commitlint.
- `feature/*` → `dev` squash PR; CI must be green. `dev` → `main` deploys.
- Screenshot dirs (`*_shots/`, `*_verified/`), `.tmp-scratch/`, `.jrc-cache/` and
  `inspect_deprem.js` are gitignored scratch; do not reference them from tracked code.
