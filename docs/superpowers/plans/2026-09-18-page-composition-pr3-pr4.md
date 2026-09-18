# T-035 Page Composition Implementation Plan — PR3 and PR4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the surface one hero block with two deliberate heading tiers, and make the `Card` primitive able to absorb the hand-drawn cards instead of the pages absorbing the primitive's look.

**Architecture:** Two new `components/patterns/` pieces (`PageHero`, `StatGrid`) and one widened primitive (`Card` gains variants carrying the site's real spellings). Every component is adopted at all its call sites in the PR that introduces it. New counters join `components/v2/page-composition.test.ts`, each pinned at its measured value first and mutation-checked at that value before being tightened.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4 (CSS-first), shadcn `base-nova` on Base UI, next-intl 4, vitest (node env, no jsdom).

**Spec:** `docs/superpowers/specs/2026-09-17-page-composition-design.md`
**Prior plan:** `docs/superpowers/plans/2026-09-17-page-composition.md` (PR1 and PR2, both landed on `dev`)

## Scope of THIS plan

PR3 (`PageHero` + the two heading tiers) and PR4 (`Card` variants + `StatGrid`). PR5
(`FaqSection`) and PR6 (cleanup) get their own plan, for the same reason PR3-6 were not
written into the first plan: PR4 changes which card spellings survive, and writing PR5's
steps against today's tree would mean inventing them.

**PR6 is now partly superseded.** Its "close the `orphan.test.ts` hole" half became board task
T-042 when the hole turned out to hide three entirely dead `components/tools/` components as
well as six `components/patterns/` ones. Fold, do not duplicate.

## Measurements (2026-09-18, on `dev` at `a2b3d61`)

Taken after PR1, PR2 and T-041 landed. Every figure below was re-measured on this tree; the
figures in the spec are from 2026-09-17 and several have moved.

|                                                  | Measured                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Distinct `h1` classNames                         | **13** across 32 call sites                                          |
| Pages with no `h1` at all                        | **5** — `giris`, `kayit`, and the 3 `(play)` screens                 |
| Pages shipping TWO `h1`s                         | **1** — `/profil`                                                    |
| Hero wrapper `relative z-10 max-w-3xl space-y-4` | **14**, exactly one spelling, no near-variant exists                 |
| `components/patterns/typography.tsx` consumers   | **1** (`hakkimizda`)                                                 |
| Hand-drawn cards                                 | **596** occurrences / **80** files / **328** distinct spellings      |
| `components/ui/card.tsx`                         | 9 importers, 88 `<Card*>` elements                                   |
| Stat grids                                       | **28** grids / ~**108** tiles / **25** files, **0** using `StatTile` |

### The two heading tiers already exist in the data

- **Hub tier — 13 sites, one spelling**, `font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight`, on `araclar` ×4, `oyun`, `deprem` ×3, `deniz` ×2, `dunya`, `turkiye`, plus `v2-sea-basin-detail-view.tsx` (which serves 4 more pages). Terracotta.
- **Detail tier — 3 sites, one spelling**, `font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground`, on `turkiye/[slug]`, `turkiye/bolge/[slug]`, `dunya/[slug]`. Neutral, larger.

Those two account for 16 of the 32 sites. The other 11 spellings are one-offs, and the owner's
recorded decision is that the split is deliberate: on a hub the heading is brand, on a detail
page the heading is data.

### The single biggest card win is not the long tail

13 files render an identical 4-tile "Metric Strip" — `grid-cols-2 sm:grid-cols-4` with tiles
spelled `p-4 rounded-2xl bg-card border border-border shadow-2xs`. That is 52 of the ~108
stat tiles and the #1 card spelling at 52 of 596. `kitaplar/page.tsx:141` carries a 2-tile
variant whose own comment says it is "byte-identical to the 9 sibling metric strips" — there
are 12 siblings, not 9, which is the problem this task exists to end, written down in the
codebase by someone who was already trying.

## Global Constraints

From `CLAUDE.md`, `docs/conventions.md` and `docs/design.md`. Every task's requirements
implicitly include these.

- Import `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation`,
  **never** from `next/link` or `next/navigation`.
- Colour comes from a bridge token. No brand hex, no `bg-[var(--color-x,#hex)]` escape, no raw
  Tailwind palette class, no hand-written `dark:`. `components/ui/token-binding.test.ts`
  enforces all four in `components/ui`, `components/patterns` and `components/showcase/specimens`.
- `Button` has no `asChild`. A link styled as a button is
  `<Link className={cn(buttonVariants({ variant, size }))}>`.
- Tests are co-located. Vitest globs are `lib/**`, `components/**`, `tools/**`; nothing under
  `app/` runs, though a test elsewhere may read those files.
- No jsdom. Render with `renderToStaticMarkup` from `react-dom/server`.
- A test that greps source text strips comments first via `lib/test-support/strip-comments.ts`
  — `stripComments` for TS/TSX, `stripCssComments` for stylesheets.
- **A counter is pinned at its MEASURED value first and mutation-checked AT THAT VALUE, then
  tightened.** PR1 shipped a counter mutation-checked only at its starting number; its final
  review found that the intermediate targets were never re-checked.
- **A grep that counts classNames must catch template literals and `cn()` calls.** A
  double-quoted-string pattern misses `className={\`…\`}`, which is a live idiom here — 14
  such classNames exist on these pages, and a literal-only count produced a wrong figure twice
  during PR1-PR2.
- Every new component in `components/ui` or `components/patterns` needs a specimen at
  `/design-system` and an entry in `components/showcase/registry.ts`.
- Prettier: double quotes, semicolons, trailing commas, width 100.
- Conventional Commits, scope = surface, each commit ending with
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Gate: `pnpm typecheck`, `pnpm lint`, `pnpm test` as **separate commands**, each exit code read
  on its own, never chained behind `&&` — plus `pnpm build`. Read the build correctly: a
  deterministic compile error is yours; a random province or country page failing with a fetch
  abort is the environmental flake now recorded in `docs/architecture.md`'s "Known gaps".

## File Structure

| File                                                                 | Responsibility                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/patterns/typography.tsx`                                 | **Modify.** `H1` retuned to the hub tier; new `H1Display` for the detail tier.                                                                                |
| `components/patterns/page-hero.tsx`                                  | **Create.** The `relative z-10 max-w-3xl space-y-4` block: a breadcrumb slot, the heading at a named tier, an optional lede. Takes `tier`, never a className. |
| `components/patterns/page-hero.test.tsx`                             | **Create.**                                                                                                                                                   |
| `components/patterns/stat-grid.tsx`                                  | **Create.** The responsive grid wrapper only; tiles stay `StatTile`.                                                                                          |
| `components/patterns/stat-grid.test.tsx`                             | **Create.**                                                                                                                                                   |
| `components/ui/card.tsx`                                             | **Modify.** A closed `variant` union carrying the site's real spellings.                                                                                      |
| `components/ui/card-variants.test.tsx`                               | **Create.** Guards the variants against a `shadcn add card` overwrite.                                                                                        |
| `components/v2/page-composition.test.ts`                             | **Modify.** New counters for h1 spellings, pages without an h1, hand-drawn cards and non-`StatTile` stat grids.                                               |
| `components/showcase/registry.ts`, `components/showcase/specimens/*` | **Modify.** Specimens for `PageHero`, `StatGrid`, and the `Card` variants.                                                                                    |
| 16 page files + `v2-sea-basin-detail-view.tsx`                       | **Modify.** Adopt `PageHero`.                                                                                                                                 |
| 13 Metric Strip files + 12 more                                      | **Modify.** Adopt `StatGrid` + `StatTile`.                                                                                                                    |

---

# PR3 — `PageHero` and two heading tiers

## Task 1: Pin the heading counters at today's values

**Files:** Modify `components/v2/page-composition.test.ts`

**Interfaces:** Consumes `walkPages()`, `sourceOf()` from the existing file. Produces
`H1_SPELLINGS`, `PAGES_WITHOUT_H1`, `PAGES_WITH_MULTIPLE_H1`.

- [ ] **Step 1: Add three counters pinned at the measured values**

Measured on `dev` at `a2b3d61`: **13** distinct `h1` classNames, **5** pages with none, **1**
page with two. Run them and pin what you actually find — these numbers are from 2026-09-18 and
the tree may have moved. The pattern must catch template-literal and `cn()` classNames, not
only double-quoted strings; a literal-only scan gave a wrong answer twice during PR1-PR2.

Follow into components: a page is a thin wrapper often enough that a page-file-only walk will
report a false "no h1" — `hesabim` gets its h1 from `v2-member-hub.tsx`, the four sea pages
from `v2-sea-basin-detail-view.tsx`, the homepage from `v2-hero.tsx`.

- [ ] **Step 2: Write the SCOPE paragraph before the counters are useful**

State what the patterns cannot see. At minimum: an `h1` rendered by a component the walk does
not follow into; a heading whose level is computed (`<Tag>` where `Tag = "h1"`); a className
assembled from variables. Be specific. "This test has limitations" does not count — PR1's
final review rejected exactly that.

- [ ] **Step 3: Mutation-check all three at today's values**

For each: break the thing it exists to catch, confirm RED, confirm the message names the file,
revert, confirm GREEN. Record verbatim. The counters that print their file list one path per
line are the model to copy — the older body-wrapper counter prints only a count, which the
final review recorded as a papercut.

- [ ] **Step 4: Gate and commit**

```bash
pnpm typecheck
pnpm lint
pnpm test
git add components/v2/page-composition.test.ts
git commit -m "test(v2/layout): pin the h1 spellings and the pages missing one"
```

## Task 2: `H1`, `H1Display` and `PageHero`

**Files:** Modify `components/patterns/typography.tsx`; create `components/patterns/page-hero.tsx` and `page-hero.test.tsx`; modify `components/showcase/registry.ts` and a specimen.

**Interfaces:** Produces `H1` (hub tier), `H1Display` (detail tier), and
`PageHero` with props `{ tier: "hub" | "detail"; heading: string; lede?: string; breadcrumbs?: ReactNode; badges?: ReactNode; className?: never }`.

- [ ] **Step 1: Retune `H1` and add `H1Display`**

`H1` currently renders `text-foreground` at a fluid clamp and has ONE consumer
(`hakkimizda`). The hub tier it must become is the 13-site spelling:
`font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight`.

`app/globals.css` records that a previous round lowered the h1 floor to fix a 320px wrap and
that the lowering was itself the defect the next review caught — `text-3xl` is 1.875rem
against the recorded 1.9rem floor. Resolve that explicitly: either keep the clamp and accept
that 13 pages change size, or take the 13-site spelling and record why the floor moved. Do not
leave the contradiction unstated; whichever you choose, write the reason beside it.

`H1Display` is the detail tier: `font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground`.

- [ ] **Step 2: Write the failing test for `PageHero`**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHero } from "./page-hero";

describe("PageHero", () => {
  it("renders the hub tier's heading in the brand colour", () => {
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="CBS Araçları" />);
    expect(html).toContain("<h1");
    expect(html).toContain("text-primary");
  });

  it("renders the detail tier larger and neutral", () => {
    const html = renderToStaticMarkup(<PageHero tier="detail" heading="İstanbul" />);
    expect(html).toContain("text-foreground");
    expect(html).toContain("sm:text-6xl");
  });

  it("renders exactly one h1 whichever tier is used", () => {
    // `/profil` ships two `<h1>` today — one in the page, one in the component it renders.
    // A hero that could emit a second would make that class of defect easier, not harder.
    for (const tier of ["hub", "detail"] as const) {
      const html = renderToStaticMarkup(<PageHero tier={tier} heading="x" lede="y" />);
      expect(html.match(/<h1/g)).toHaveLength(1);
    }
  });

  it("omits the lede entirely when there is none", () => {
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="x" />);
    expect(html).not.toContain("<p");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run components/patterns/page-hero.test.tsx`
Expected: FAIL — `Cannot find module './page-hero'`.

- [ ] **Step 4: Write the component**

The wrapper is the measured spelling, `relative z-10 max-w-3xl space-y-4`, which already
appears 14 times with no variant. `tier` selects `H1` or `H1Display`. No `className` prop —
the open passthrough is what let six container tails grow in PR1.

- [ ] **Step 5: Register a specimen, gate and commit**

```bash
pnpm vitest run components/showcase/registry.test.ts
pnpm typecheck
pnpm lint
pnpm test
git add components/patterns components/showcase
git commit -m "feat(v2/layout): add PageHero with a hub tier and a detail tier"
```

## Task 3: Adopt `PageHero` on the 16 hero pages and close the h1 defects

**Files:** Modify the 13 hub pages, `v2-sea-basin-detail-view.tsx`, the 3 detail pages, `profil/page.tsx`, `v2-profile-form.tsx`, `giris/page.tsx`, `kayit/page.tsx`; modify `components/v2/page-composition.test.ts`.

- [ ] **Step 1: Adopt on the 13 hub pages and the sea view**

Those 14 sites already share both the wrapper and the h1 spelling, so this is the mechanical
half. Replace the wrapper and the `<h1>` with one `PageHero tier="hub"`.

- [ ] **Step 2: Adopt on the 3 detail pages**

`turkiye/[slug]`, `turkiye/bolge/[slug]`, `dunya/[slug]` use a structurally different,
full-bleed hero and do NOT use the `max-w-3xl` wrapper. Check each before assuming `PageHero`
fits; if the badge row or the backdrop makes it awkward, that is a finding for the report, not
a reason to add a `className`. Task 3 of the PR1 plan hit the same shape and solved it at the
source with `isolate` on the section and `-z-10` on the glow — reuse that.

- [ ] **Step 3: Fix `/profil`'s two `h1`s**

`profil/page.tsx:89` and `v2-profile-form.tsx:220` both render one. `docs/design.md` requires
one per page. Decide which is the page's real heading — the form's is almost certainly a
section heading — and demote the other to `h2`, keeping document order.

- [ ] **Step 4: Give the five pages with no `h1` one**

`giris` and `kayit` render `V2LoginCard` / `V2RegisterCard`, which use `<h2>` and never an
`h1`. The three `(play)` screens have none at all. An indexable page with no `h1` is an SEO
and a11y defect; check each against `lib/seo/indexing.ts` first, and where a page is
`noindex` say so and decide deliberately rather than adding a heading for the counter's sake.

- [ ] **Step 5: Drive the counters, run the gate, visual round**

Set `H1_SPELLINGS` to what remains (target 2 plus whatever error/not-found pages legitimately
keep), `PAGES_WITHOUT_H1` and `PAGES_WITH_MULTIPLE_H1` to 0 — or to the number actually there,
with each remainder listed and justified.

Then the visual round, because this changes type size on 16 pages: Playwright at 320, 360, 390
and desktop, both themes, `localStorage.theme` set via `addInitScript` BEFORE navigation.
**Persist the PNGs** to `*_shots/` and give their paths — a visual claim with no artifact was
sent back once in this programme and should not be again.

---

# PR4 — `Card` variants and `StatGrid`

## Task 4: Pin the card and stat-grid counters

**Files:** Modify `components/v2/page-composition.test.ts`

- [ ] **Step 1: Add two counters at their measured values**

Measured: **596** hand-drawn card occurrences across **80** files in **328** distinct
spellings; **28** stat grids across **25** files, **0** using `StatTile`. The card scan must
use a brace-balancing parser, not a naive regex — nested `cn()` calls undercount otherwise, a
mistake made and corrected during the 2026-09-18 measurement.

- [ ] **Step 2: SCOPE paragraph, mutation check, gate, commit**

Same standard as Task 1. The card counter will never reach zero; say so in the docblock and
say what it IS for — a ratchet that can only fall.

## Task 5: `Card` variants

**Files:** Modify `components/ui/card.tsx`; create `components/ui/card-variants.test.tsx`; modify the showcase.

- [ ] **Step 1: Derive the variants from the measured spellings, not from taste**

The owner's decision is that the site wins and the primitive adapts. The top spellings are the
evidence for which variants exist:

| Occurrences | Spelling                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 52          | `p-4 rounded-2xl bg-card border border-border shadow-2xs`                                                                         |
| 13          | `relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg` |
| 13          | `rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4`                                                         |
| 12          | `p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1`                                     |
| 12          | `p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3`                                                             |
| 11          | `rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6`                                                         |
| 10          | `rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs`                                                   |

A spelling that appears once does not earn a variant. Entries 9 and 10 in the top ten
(`flex items-center p-2 rounded-xl hover:bg-muted …`) are list rows, not cards — do not build a
variant for them.

- [ ] **Step 2: Guard the variants against the CLI**

`docs/design.md` records that `shadcn add` overwrites files in the `ui` alias and that it asked
to overwrite `button.tsx` during T-034. `button.tsx`'s own hand-added variants are the
precedent for putting these here. Write a contract test that fails if the variants disappear,
so an overwrite cannot be silent.

- [ ] **Step 3: Specimen, gate, commit**

## Task 6: Migrate the Metric Strip family and adopt `StatGrid`

**Files:** Create `components/patterns/stat-grid.tsx` + test; modify the 13 Metric Strip files and the 12 other stat-grid files; modify the counters.

- [ ] **Step 1: Build `StatGrid`**

The grid wrapper only. Tiles stay `StatTile`, which already composes `MetricValue` and
therefore inherits its required `absent` prop — that is deliberate: `MetricValue.absent` is
T-024's defect made impossible, and routing ~108 tiles through it is how that guarantee finally
reaches the pages.

- [ ] **Step 2: Migrate the 13 identical Metric Strips first**

They share one shell and one tile spelling, so they are one edit repeated 13 times and they
carry 52 of the ~108 tiles. `kitaplar/page.tsx:141` is a 2-tile variant of the same shape whose
comment claims 9 siblings; correct that comment as you go — it is wrong, and it is evidence.

- [ ] **Step 3: Migrate the remaining 12 grids, drive the counter to 0**

- [ ] **Step 4: Full gate plus the visual round**

`pnpm build` included. Playwright at 320/360/390/desktop in both themes, PNGs persisted. The
claim this PR will want to make is "no card changed appearance" — that has to be measured
against before/after screenshots on a representative set, not asserted. Stock `Card` is
`rounded-xl` + `ring-1 ring-foreground/10`; the site's language is `rounded-2xl` + `border` +
`shadow`. If the variants are written wrong the difference is visible and no test can see it.

---

## After both PRs

Write the PR5-PR6 plan against the tree as it stands then, not as it stands now. Carry into it:

- **T-042** — the `orphan.test.ts` blind spot and the dead `components/tools/` components. It
  replaces or absorbs the old PR6 scope.
- **The composition divergence** — `dunya/kita` and `dunya/kita/[slug]` use two sibling
  containers (a `band` hero plus a `loose` body), which is the better shape; `turkiye/[slug]`,
  `turkiye/bolge`, `turkiye/bolge/[slug]` and `dunya/[slug]` use a band hero and then no body
  container at all, two of them still carrying an empty `{/* BODY CONTENT CONTAINER */}`
  marker. `PAGE_BODY_SPELLINGS = 0` currently certifies that surface.
- **The `surface` duplication** — most pages hand-type the `ContentSurface` twice, once in
  `buildMetadata` and once on `<Breadcrumbs>`, with nothing asserting they agree. All pairs
  agree today. `araclar/*` shows the fix: one shared `TOOLS_SURFACE` constant.
