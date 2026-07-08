# cografya_web — Engineering Ground-Truth (Vera)

> **Binding on repo specifics.** This file is the authoritative engineering handbook for
> the `cografya_web` repo. Once it exists it **overrides the Vera persona and the
> orchestrator SOP on web-repo specifics** (per the orchestrator `CLAUDE.md`
> "Engineering Ground-Truth"). It does not restate the whole persona — it pins the rules
> a change in THIS repo must satisfy. When this file and a review finding conflict, this
> file (and the SEO non-negotiables in `CONVENTIONS.md` §6) win.
>
> Sibling handbook: `cografya_api/CLAUDE.md` (Deniz). The two share one review shape
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
- **Ground-truth order:** this file → `CONVENTIONS.md` (§2 gates / §6 SEO) → the founding
  SEO brief (`Owner's Inbox/founding-research/ferrumone-analysis-and-seo.md`, Bölüm 4) →
  the Vera persona. Higher wins on conflict.

## 2. Stack (locked, → `CONVENTIONS.md` §3)

- **Next.js 16 App Router · React 19 · TypeScript** — full `strict: true` +
  `noUncheckedIndexedAccess`. No `any` in shipped code; no unvalidated `process.env`
  reads (env goes through the zod schema in `lib/env.ts`).
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
8. **noindex ≠ Disallow.** Auth/panel pages stay crawlable with `<meta robots
noindex,follow>`. `robots.txt` Disallow is only for api/raw-file paths.
9. **CWV budget: LCP < 2.5s · INP < 200ms · CLS < 0.1.** Maps/embeds lazy + fixed-size
   containers; `next/image` (explicit `width`/`height` or `fill` + sized box) +
   `next/font` always; third-party embeds (YouTube, Windy) behind facades.
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

- **NO local test execution — CI is the ONLY test gate.** Locally run ONLY
  `npx tsc --noEmit` + `eslint` on changed files (**no `--fix`**). Verify tests by reading
  the PR's CI, never by running them locally.
- **CI green is the single merge gate.** Never merge while red; never weaken or skip a
  test/SEO/a11y check to go green — diagnose and fix.
- Standalone `tsc --noEmit` + `lint` pass as their own CI job (`.github/workflows/ci.yml`:
  `typecheck-and-lint` + `build`). No deploy job until the hosting decision.
- **Verify before "done":** typecheck + lint clean on changed files; then **curl-check the
  rendered HTML** of at least one new/changed indexable page — confirm `h1`, `<title>`,
  canonical, hreflang set, and JSON-LD are present in the first response (empirical, not
  code-reading — this is how PR#2 caught a real 500 hiding inside a "one-line" fix).
- **Rendered samples** (screenshots / preview output) to the owner before AND after merge
  for every user-visible change. Never merge a visible UI change the owner hasn't seen.

## 7. Branch flow & PR

- Branch `feature/*` off `origin/dev`; **squash PR into `dev`**; Conventional Commit
  messages (commitlint-enforced). `main` is a placeholder until the hosting /
  prod-promotion model lands. Deploy jobs are NOT wired until then.
- End commit messages with the co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Every PR runs the **Autonomous PR-Review Loop** (§8). Reviewer role assets live in
  `.claude/reviewers/` (committed); Atlas runs the fan-out, Vera runs the filter.

## 8. Autonomous PR-Review Loop — the author's half (Critical Architect Filter)

The loop has two halves. **Atlas runs the reviewer fan-out on the main thread** — Vera
(and Deniz) have no `Agent` tool by design, so an engineer cannot spawn reviewers; this
keeps review independent of the author (fresh-context reviewers can't be biased by the
person who wrote the code). The reviewer role prompts, per-repo checklists, roster, and
severity taxonomy Atlas loads are in **`.claude/reviewers/`**. Vera owns the **filter**.

**Severity taxonomy (shared with api — do not diverge):**

- **CRITICAL** — blocks merge: correctness / security / data-loss / SEO-breaking. A
  concrete failure scenario is required to call something critical.
- **IMPORTANT** — a real defect or standards violation (a11y, SEO-correctness, validation)
  that must be fixed before merge, but is not catastrophic.
- **MINOR** — cleanup / nit / deferrable (filter's discretion).

**The flow:** every PR → Atlas runs the fan-out on the main thread → reviewers (read-only,
anchored to the PR diff) each write findings to `pr-reviews/{PR#}-{role}.md` and return a
distilled severity-tagged summary → CRITICAL findings get per-finding adversarial
validation → **the author engineer (Vera) runs the Critical Architect Filter** →
re-loop until no Critical/Important remains → Atlas archives `pr-reviews/{PR#}.md` to
`Owner's Inbox/pr-review-archive/{repo}-{PR#}.md`.

**Critical Architect Filter protocol (BINDING — shared with api):** for **every** finding,
assess **Criticality · Blast Radius · Cost/Benefit · Architectural Fit (YAGNI?)**, then
decide **Accept / Discuss & Decide / Reject / False Positive**:

- **Accept** → apply now (Critical/Important first).
- **Discuss & Decide** (genuine dilemma) → _steel-man_ the finding's real problem;
  _counter-argue_ the current code's rationale; weigh the _trade-off_; state a clear
  **"Winner: [Suggestion / Current Code] — Because…"**.
- **Reject** → YAGNI / unnecessary. · **False Positive** → misread context.

Take action ONLY on findings affecting **correctness / security / SEO-correctness / a
stated requirement** — the scope brake. **Annotate every skipped item** with a short
English reason (False Positive / YAGNI / trade-off lost / nitpick) in the PR body or
filter notes. Never act on a finding you cannot justify. Then **commit & push**; if any
Critical/Important item was fixed, Atlas re-runs the fan-out and Vera re-filters. Zero
conventions violations: a finding that conflicts with this file / `CONVENTIONS.md` §6
resolves in favour of the conventions. Deep security/privacy findings → flag to Atlas for
the security-privacy-reviewer pass. New follow-up tasks → hand to Atlas (Vera does not
edit `TASKS.md`).

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

- **`.env`:** copy `.env.example` → `.env.local`; all vars validated at boot by `lib/env.ts`
  (zod). `NEXT_PUBLIC_SITE_URL` drives `metadataBase` / canonical / hreflang / sitemap and
  MUST be the real domain in production.

## 10. Out of scope / do-NOT

- Do NOT ship an indexable page that is client-only rendered, returns 200 for an unknown
  slug, or lacks canonical / hreflang / JSON-LD (§4).
- Do NOT use `robots.txt` Disallow to de-index auth/panel pages — use `noindex,follow`.
- Do NOT hardcode brand hex outside the `app/globals.css` token layer; do NOT bleed Terra
  chrome tokens into data-viz scales, and do NOT recolor public-safety semantic colors
  (AQI/earthquake/SST) — see `DESIGN.md`.
- Do NOT run tests locally as a gate; do NOT merge on red CI; do NOT weaken a check to go
  green.
- Do NOT grant engineers the `Agent` tool / attempt to self-run the reviewer fan-out
  (§8 — review independence is a design choice, not an accident).
- Data-viz / map color code is **Faz-2** — `DESIGN.md` ships the doctrine as documentation
  now; no scales module lands in this repo yet.
