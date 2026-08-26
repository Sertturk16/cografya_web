# `cografya_web` Engineering Ground Truth (Provider-Neutral, Binding)

> **Binding on repo specifics.** This file is the authoritative engineering handbook for
> the `cografya_web` repo. Once it exists it **overrides the Vera persona and the
> orchestrator SOP on web-repo specifics** (per `ATLAS.md` "Delivery and canonical homes",
> which names the relevant `ENGINEERING.md` as the on-demand home for repo engineering
> gates). It does not restate the whole persona — it pins the rules a change in THIS repo
> must satisfy. When this file and a review finding conflict, this file (and the SEO
> non-negotiables in `CONVENTIONS.md` §6) win.
>
> Sibling handbook: `cografya_api/ENGINEERING.md` (Deniz). The two share one review shape
> (severity taxonomy, Critical Architect Filter, output contract, roster) — keep them in
> sync; change the shape only through Atlas, never unilaterally.

---

## 1. Identity & authority

- **Single writer: Vera.** No one else commits to this repo. The api repo
  (`cografya_api`) is Deniz's; never edit it. The web↔api boundary is the OpenAPI
  contract (api = source of truth via `@nestjs/swagger`, web codegens types from the
  committed spec via `openapi-typescript`, → `CONVENTIONS.md` §3). Contract changes route
  through Atlas — never edit the api repo to "fix" a type.
- **SEO is the sacred boundary.** Every rule in §4 below is non-negotiable: never ship an
  indexable page that violates it, the way a multi-tenant engineer never ships an
  unscoped query. When in doubt, stop and ask — do not guess (95% rule).
- **Ground-truth order:** this file → `CONVENTIONS.md` (§2 gates / §6 SEO) →
  `SEO-POLICY.md` (the ONE canonical SEO document, → DEC 2026-07-18) → the Vera persona.
  Higher wins on conflict. The founding SEO brief
  (`Owner's Inbox/founding-research/ferrumone-analysis-and-seo.md`, Bölüm 4) is
  background reading, not an authority.

## 2. Stack (locked, → `CONVENTIONS.md` §3)

- **Next.js 16 App Router · React 19 · TypeScript** — full `strict: true` +
  `noUncheckedIndexedAccess`. No `any` in shipped code; no unvalidated `process.env`
  reads. Public `NEXT_PUBLIC_*` values flow through `lib/env.ts`; server-only values
  such as API credentials flow through `lib/env.server.ts`.
- **Node 24** (`.nvmrc`) · **pnpm** (pinned via `packageManager`).
- **next-intl 4** — sub-path routing (TR at `/`, EN at `/en`), `localePrefix: "as-needed"`,
  `localeDetection: false`; localized pathnames + localized slugs. Config lives in
  `i18n/{routing,request,navigation}.ts`; middleware is `proxy.ts` (renamed from
  `middleware.ts` in Next 16). Messages: `messages/{tr,en}.json`.
- **Terra** visual identity — token layer in `app/globals.css` `:root`; fonts via
  `next/font` (`lib/fonts.ts`, self-hosted, `latin` + `latin-ext` for Turkish glyphs).
  Full design system + data-viz color doctrine: **`DESIGN.md`** (binding for UI/color).
- **zod** env validation · **ESLint** flat (`eslint-config-next`) + **Prettier** ·
  **husky** + **lint-staged** + **commitlint** (Conventional Commits).
- Styling = **CSS Modules** + the global token layer. No CSS-in-JS runtime, no MUI.

## 3. Rendering per page type (SEO §6 #1 — never client-only for content)

- **Programmatic content** (province/country/landform/concept/blog detail + hub indexes)
  = **SSG + ISR**. Full HTML in the first response; `generateStaticParams` for known
  slugs; ISR revalidate for freshness.
- **Live-data feeds** (earthquake/AQI/SST, Faz-2+) = SSR or short-ISR shell with a client
  live-numbers island — the indexable shell is still server-rendered HTML.
- **Heavy interactive** (Leaflet/MapLibre maps, the game, CBS tools) = a **server-rendered
  static shell** + `dynamic(() => …, { ssr: false })` for the client widget, inside a
  **fixed-size container** (CLS). The shell carries the crawlable content; the widget is
  progressive enhancement.
- Never flip a programmatic route SSG→SSR to fix a cosmetic issue (this is exactly the
  PR#2 404-title trade-off: forcing SSR for a 404 `<title>` that is never indexed loses
  the CWV/SSG budget for zero SEO benefit — the current SSG state won).

## 4. SEO non-negotiables — in-repo checklist (`CONVENTIONS.md` §6 is the source)

Scan **every** PR against this. A page that fails any item does not ship.

1. **Full HTML first response** for every indexable page (SSG/ISR/SSR — never client-only).
2. **`generateMetadata()` on every dynamic route**, built through the central
   `buildMetadata(entity, locale)` helper (`lib/seo/metadata.ts`) — templated
   title/description from data, never hand-assembled per page. `metadataBase` set once at
   the root layout.
3. **Self-referencing canonical** on every page (`alternates.canonical`).
4. **hreflang `tr` / `en` / `x-default`** on every page via `alternates.languages` —
   generated from `getPathname` (never hand-written), **symmetric both directions**, and
   mirrored in the sitemap.
5. **JSON-LD server-rendered** (`lib/seo/json-ld.tsx`, never client-injected) per the
   schema map: `Country`/`AdministrativeArea`/`Place` + `GeoCoordinates` + `PropertyValue`
   for geo; `FAQPage` + `LearningResource` + `BreadcrumbList` layers preserved;
   `Article`(+`HowTo`) for blog; `VideoObject` for video solutions.
6. **Unknown slug → `notFound()`** — real 404, never a 200 soft-404.
7. **Sitemap architecture** (`app/sitemap.ts` / `app/robots.ts` file conventions) with
   real `lastmod` from `updated_at`. Flat urlset is acceptable ONLY below all three of:
   province×locale ≤ ~150, one content hub, total urlset ≤ ~10k — split to
   `generateSitemaps()` per hub at the **first** of these crossed (→ §6 split trigger),
   not at the 50k hard limit.
   **STANDING EXCEPTION — do NOT split today (→ DEC 2026-07-13).** The trigger IS crossed,
   and the flat urlset in `app/sitemap.ts` is a knowingly-approved deviation: Next 16's
   `generateSitemaps()` serves shards at `/sitemap/{id}.xml` but exposes **no index at
   `/sitemap.xml`** — the exact URL `robots.ts` advertises — so splitting now would 404 the
   sitemap entrypoint entirely. Following this rule literally BREAKS the sitemap. The flat
   file stays until a Next-16-verified index mechanism lands (tracked follow-up with Atlas);
   revisit only against the 50k hard limit in the meantime.
8. **noindex ≠ Disallow.** Auth/panel pages stay crawlable with `<meta robots
noindex,follow>`. `robots.txt` Disallow is only for api/raw-file paths.
9. **CWV budget: LCP < 2.5s · INP < 200ms · CLS < 0.1.** Maps/embeds lazy + fixed-size
   containers; `next/image` (explicit `width`/`height` or `fill` + sized box) +
   `next/font` always; third-party embeds (YouTube, Windy) behind facades.
   **ONE EXCEPTION — build-emitted static SVG (→ DEC 2026-08-08a md.3).** A `.svg` asset this
   repo emits at build (`/maps/*.svg`, `/flags/*.svg`) may be rendered with a plain `<img>`,
   provided it carries explicit `width`/`height` **and** sits in a fixed `aspect-ratio` box.
   Rationale, and the reason this is narrow rather than a general licence: `next/image` cannot
   optimise SVG — it passes the bytes through unchanged, or refuses them without
   `dangerouslyAllowSVG` — so on these assets it adds a runtime wrapper and a client component
   for zero byte saving, while the CLS guarantee it exists to provide is already held by the
   viewBox's intrinsic ratio plus the explicit dimensions. The exception does **not** extend to
   raster images, to remote images, or to any SVG that arrives from outside the build.
   **A SECOND EXCEPTION — a remote image whose provider forbids byte copies (→ DEC
   2026-08-15c).** A remote image whose provider's own policy bars us from copying, caching or
   transforming its bytes — today exactly one class, the YouTube video thumbnail on the book
   detail page — is rendered with a plain `<img>` at the address the api publishes
   (`BookVideoYoutubeDto.thumbnailUrl`, hotlinked, **never** constructed from the video id),
   carrying the explicit `width`/`height` the same payload publishes, inside a fixed-ratio
   box, and `loading="lazy"` **unless the image is the page's LCP candidate** — lazy-loading
   the largest above-the-fold image delays the very metric this item exists to protect. Rationale, and why this is a second NARROW exception rather than a
   widening of the first: `next/image` serves an optimised copy from our own origin, so the
   optimiser fetches the remote bytes and writes them under `.next/cache/images` — that stored
   copy is precisely what YouTube Developer Policies III.E.1 forbids without prior written
   approval, and III.E.5 separately bars replacing API Data with independently computed data.
   The provider policy wins over the "always" in this item. The CLS guarantee the rule exists
   to provide is untouched: it comes from the two dimensions the contract publishes, not from
   the loader. `unoptimized` is not the answer — it keeps the wrapper and removes the only
   thing the wrapper buys. The exception covers **only** an image whose provider bars byte
   copies. It does **not** reach our own raster assets (the book covers in `public/kitaplar/`
   are our files and go through `next/image` like every other local image), and it grants no
   general "remote images are exempt" licence.
10. **Trailing-slash pinned** in `next.config.ts` (`trailingSlash: false`); breadcrumbs
    (visual + JSON-LD) on every detail page; hub-and-spoke internal links (neighbors /
    same-climate / related-concept blocks).

**Data-viz color is a correctness boundary too** (treated like SEO): see `DESIGN.md` §
data-viz doctrine — colorblind-safe, no rainbow/jet, brand ≠ data, and public-safety
semantic colors (AQI / earthquake intensity / SST) stay STANDARD, never recolored to Terra.

## 5. Accessibility floor (WCAG 2.1 AA — non-negotiable for shipped UI)

- Semantic HTML first (landmarks, real headings in order, `<button>` vs `<a>` correctly);
  every non-decorative image has meaningful `alt`, decorative ones `alt=""`.
- **Text contrast ≥ 4.5:1** (≥ 3:1 large/UI). The token `--color-taupe` is
  **placeholder/secondary-UI/decorative only** — never body or nav text (PR#2 lesson:
  taupe on white = 3.86:1, sub-AA; use `--color-slate`).
- Visible keyboard focus everywhere (`:focus-visible`), skip-link whose target is
  programmatically focusable (`tabIndex={-1}` on `<main>` — Safari/VoiceOver need it).
- **State changes announce to AT** (WCAG 4.1.3): error boundaries move focus to the error
  heading (`tabIndex={-1}` + `focus()`), last-resort boundaries use `role="alert"` (PR#3
  lesson). Respect `prefers-reduced-motion`.
- Iconography must not read as an unintended signal (PR#3 lesson: the ◭ placeholder read
  like a warning triangle — replaced with a neutral globe). Brand marks stay single-sourced
  (`lib/brand/glyph.ts`; `app/icon.svg` mirrors it by hand — keep them in step).

## 6. Gates & discipline (`CONVENTIONS.md` §2 — BINDING)

- **Local execution is the test gate** (→ `DEC 2026-08-26u`). Run `npx tsc --noEmit` +
  `eslint` on changed files (**no `--fix`**), then the **full** `pnpm test` suite, locally,
  before returning. Report exact counts (`X files / Y tests passed`) and quote any failure
  verbatim — a claimed "clean" with no numbers is not evidence. (The vitest harness landed
  in PR #15; CI runs the same commands as its own `typecheck-and-lint`, `test` / "Unit
  Tests", and `build` jobs and remains available as a secondary, independent record when it
  is reachable, but is not required to block a merge decision.) Tests live at
  `lib/**/*.test.ts` + `components/**/*.test.{ts,tsx}` per `vitest.config.ts`.
- **A genuine green local run is the merge gate.** Never merge on a red result you have
  seen; never weaken or skip a test/SEO/a11y check to go green — diagnose and fix. Prefer
  CI's evidence when it is available in reasonable time; do not wait indefinitely on it.
- Standalone `tsc --noEmit` + `lint` pass as their own CI job (`.github/workflows/ci.yml`:
  `typecheck-and-lint` + `build`). No deploy job until the hosting decision.
- **Verify before "done":** typecheck + lint clean on changed files; then **curl-check the
  rendered HTML** of at least one new/changed indexable page — confirm `h1`, `<title>`,
  canonical, hreflang set, and JSON-LD are present in the first response (empirical, not
  code-reading — this is how PR#2 caught a real 500 hiding inside a "one-line" fix).
- **Rendered samples** (screenshots / preview output) to the owner before AND after merge
  for every user-visible change. Never merge a visible UI change the owner hasn't seen.
- **Delete `.next` before capturing a sample that follows a data change** (→ `FU-SAMPLE-CACHE`,
  PR #54). Next persists a file-system data cache at `.next/cache/fetch-cache` that survives
  a dev-server restart, so a page can keep serving the pre-seed payload while the database
  already holds the new one. This was caught once, at the approval gate: the "after" frame of
  an api seed fix came back byte-identical to its "before" frame and would have certified the
  OLD text as new. `rm -rf .next`, restart, then capture — and
  **assert the frame against the database**, never against the fact that the server restarted.

## 7. Branch flow & PR

- Branch `feature/*` off `origin/dev`; **squash PR into `dev`**; Conventional Commit
  messages (commitlint-enforced). `main` is a placeholder until the hosting /
  prod-promotion model lands. Deploy jobs are NOT wired until then.
- Never hard-code a provider/model co-author identity. Use a truthful trailer only when
  the active authoring client requires one; otherwise omit it.
- Every PR runs the **Autonomous PR-Review Loop** (§8). Provider-neutral reviewer role
  rubrics currently live at the legacy `.claude/reviewers/` path; the canonical roster,
  severity, and workflow live in the orchestration-root `REVIEW-POLICY.md`. Atlas runs the fan-out; Vera
  runs the filter.

## 8. Autonomous PR-Review Loop — the author's half (Critical Architect Filter)

Atlas alone runs the independent reviewer fan-out. Vera has no subagent-spawn tool and
must never self-review.

When Atlas returns a consolidated report, read and apply the orchestration-root `REVIEW-POLICY.md` §9
completely. It is the single severity, author-filter, annotation, re-loop, and delivery
procedure.

Web-specific filter boundary:

- action-worthy classes are correctness, security, SEO correctness, accessibility
  correctness, and explicit requirements;
- this file, `CONVENTIONS.md` §6, `SEO-POLICY.md`, and `DESIGN.md` beat a conflicting
  review suggestion;
- route deep security/privacy findings back to Atlas;
- hand follow-ups to Atlas; the live board is `STATE.md` and it is Atlas-only — Vera never
  writes it.

## 9. Repo-init hygiene (reproduce on every clone / new repo) — D5

- **`.nvmrc` + pnpm:** `nvm use` then `corepack enable` (or install the pinned pnpm).
  `pnpm install` also wires the husky git hooks (`prepare` script).
- **Repo-local git credential helper (BINDING — pins the correct GitHub identity).** This
  repo commits under the `Sertturk16` account, which is **not** the machine's default
  active `gh` account. To make `git push/pull` always use the right token regardless of
  the globally-active account, the repo sets a **local** credential helper that resolves
  the token per-account:

  ```
  git config --local credential.helper \
    '!f() { echo "username=x-access-token"; echo "password=$(gh auth token --user Sertturk16)"; }; f'
  ```

  Set `user.name` / `user.email` locally too. This is standard repo init — re-run it after
  a fresh clone (it lives in `.git/config`, which is not cloned).

- **Known gap (surface, don't assume): the credential helper fixes `git`, NOT the `gh`
  CLI.** `gh` commands (`gh pr create`, `gh pr list`, `gh api`, …) act as the
  **globally-active** account, which other work on this machine can silently switch away.
  So **run `gh auth switch --hostname github.com --user Sertturk16` before every `gh`
  invocation** in this repo. A durable per-repo `gh` fix (e.g. a repo-scoped
  `GH_CONFIG_DIR`) is still open and tracked separately — this doc records current reality,
  it does not claim to solve `gh`.

- **`.env`:** copy `.env.example` → `.env.local`; public values are validated by
  `lib/env.ts`, server-only values by `lib/env.server.ts` (zod).
  `NEXT_PUBLIC_SITE_URL` drives `metadataBase` / canonical / hreflang / sitemap and MUST
  be the real domain in production.

## 10. Out of scope / do-NOT

- Do NOT ship an indexable page that is client-only rendered, returns 200 for an unknown
  slug, or lacks canonical / hreflang / JSON-LD (§4).
- Do NOT use `robots.txt` Disallow to de-index auth/panel pages — use `noindex,follow`.
- Do NOT hardcode brand hex outside the `app/globals.css` token layer; do NOT bleed Terra
  chrome tokens into data-viz scales, and do NOT recolor public-safety semantic colors
  (AQI/earthquake/SST) — see `DESIGN.md`.
- Do NOT run tests locally as a gate; do NOT merge on red CI; do NOT weaken a check to go
  green.
- Do NOT grant engineers the subagent-spawn tool / attempt to self-run the reviewer fan-out
  (§8 — review independence is a design choice, not an accident).
- **Map** colour/scale code is still **Faz-2** (no map scales module lands here yet), but
  CHART code is not: three data-viz surfaces have shipped, each carrying only the tokens its
  own chart needs (`DESIGN.md` §6.4/§6.5/§6.6), and a general scales module remains
  deliberately unbuilt rather than merely pending.

## Kim neyi okur — kapsam sözleşmesi

This table is the sole owner of this document's read scope. A role definition never
restates that scope — it carries only the anchor id in the last column, and
`Team/scripts/read-contract-lint.sh` verifies that each id still stands in the definition
file named beside it; `Team/scripts/tests/run.sh` binds it, and wind-down runs that suite
fail-closed. There is still no root `pre-commit` hook, so the gate fires at wind-down and
on demand, not on every commit. The rules themselves live in §§1–10 above; this table says
only who reads which of them, and when (→ DEC 2026-08-07a, DEC 2026-08-25m).

<!-- read-contract -->

| Rol                      | Okur                                                                                                                                                                                                                                                                                  | Ne zaman                                                                                                                                                                                                                        | Tanım dosyası                                                                                | Anchor                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- |
| **Vera** (single writer) | Mandatory: **§1** authority order · **§2** stack lock · **§4** SEO checklist · **§6** gates · **§7** branch/PR flow · **§10** do-NOT list. On demand: **§3** · **§5** · **§8** · **§9**                                                                                               | The mandatory set on every PR in this repo. §3 when a route or rendering mode changes; §5 whenever shipped UI changes; §8 when Atlas returns a consolidated review report; §9 on a fresh clone and before every `gh` invocation | `Team/roles/vera.md`                                                                         | `READ-ENG-WEB`          |
| Review legs              | **§1** ground-truth order · **§2** stack lock · **§3** rendering per page type · **§4** SEO checklist · **§5** a11y floor · **§6** gates · **§10** do-NOT list — the repo truth a finding is scored against. §8 is the author's half; a leg reads it for context and never acts on it | Every review leg on a `cografya_web` PR, before assigning a severity; §3 whenever the diff touches rendering mode or route shape                                                                                                | `Team/roles/reviewer-critical.md` `Team/roles/reviewer-routine.md` `Team/roles/validator.md` | `READ-ENG-WEB-REVIEWER` |

<!-- /read-contract -->

Readers with no definition file cannot be machine-checked and therefore carry no anchor:
Atlas reads §6/§7 when routing or merging, and the owner sees only the rendered samples
and the critical summary.
