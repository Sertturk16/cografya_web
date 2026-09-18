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

|                                                  | Measured                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Distinct `h1` classNames                         | **13** across 32 call sites                                                            |
| Pages with no `h1` at all                        | **5** — `giris`, `kayit`, and the 3 `(play)` screens                                   |
| Pages shipping TWO `h1`s                         | **1** — `/profil`                                                                      |
| Hero wrapper `relative z-10 max-w-3xl space-y-4` | **14**, exactly one spelling, no near-variant exists                                   |
| `components/patterns/typography.tsx` consumers   | **1** (`hakkimizda`)                                                                   |
| Hand-drawn cards                                 | ~~596 / 80 / 328~~ → **490** / **77** files / **254** spellings — corrected, see below |
| `components/ui/card.tsx`                         | 9 importers, ~~88~~ **93** `<Card*>` elements                                          |
| Stat grids                                       | ~~28 / 25~~ **29** grids / **108** tiles / **24** files, **0** using `StatTile`        |

### ⚠️ The card figures above were wrong and were re-counted independently (2026-09-18)

A second agent re-measured every card claim with a brace-balancing parser that reads
double-quoted, template-literal and `cn()` classNames, and reconciled to 100% — all 5404 post-mask
`className` attributes attached to an element except 9, each a `className = ""` destructuring
default. Three of six claims were wrong.

- **490 occurrences / 77 files / 254 raw spellings** (253 normalised — sorting tokens merges
  exactly one pair, so class order is not a real duplicate source here). The distinct
  `(file, spelling)` pair count is **318**, which is most likely where the bogus 328 came from.
- **596 is unreachable under any rule tried.** Eight predicates, a structure-free "any string
  literal" method and a whole-repo scope all cap out around 496; the loosest predicate reaches 582
  but lands on 85 files / 302 spellings, so the published triple is not internally consistent with
  any single definition.
- **The 13 Metric Strips are NOT byte-identical.** They are **7 distinct skeletons**. Five vary the
  value colour and three do it with raw palette tokens that have no dark-mode pair. One of the
  thirteen is a structurally different component. Details in Task 6.
- Confirmed exactly: the seven top-spelling counts, 108 tiles, `StatTile` usage 0, and that the
  `kitaplar/page.tsx` comment claiming "9 sibling metric strips" really has **12**.

**Every number in the PR4 tasks below is from that re-count, and all of them predate PR3 landing.
Task 4 pins what it measures, not what is written here.**

### The two heading tiers already exist in the data

- **Hub tier — 13 sites, one spelling**, `font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight`, on `araclar` ×4, `oyun`, `deprem` ×3, `deniz` ×2, `dunya`, `turkiye`, plus `v2-sea-basin-detail-view.tsx` (which serves 4 more pages). Terracotta.
- **Detail tier — 3 sites, one spelling**, `font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground`, on `turkiye/[slug]`, `turkiye/bolge/[slug]`, `dunya/[slug]`. Neutral, larger.

Those two account for 16 of the 32 sites. The other 11 spellings are one-offs, and the owner's
recorded decision is that the split is deliberate: on a hub the heading is brand, on a detail
page the heading is data.

### The single biggest card win is not the long tail

13 files render a 4-tile "Metric Strip" — `grid-cols-2 sm:grid-cols-4` with tiles
spelled `p-4 rounded-2xl bg-card border border-border shadow-2xs`. That is 52 of the 108
stat tiles and the #1 card spelling at 52 of 490. `kitaplar/page.tsx:141` carries a 2-tile
variant whose own comment says it is "byte-identical to the 9 sibling metric strips" — there
are 12 siblings, not 9, which is the problem this task exists to end, written down in the
codebase by someone who was already trying.

**And "identical" is itself wrong**, which is the more useful half: compared as ordered
`tag|className` skeletons, the 13 files are **7 distinct shapes**, and only 7 of them share the
majority skeleton. A zero-prop `<MetricStrip />` would change six pages. See Task 6.

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

## Task 4: Pin the card, well and stat-grid counters

**Files:** Modify `components/v2/page-composition.test.ts`

**Interfaces:** Consumes `walkRenderRoots()`, `sourceOf()`, `stripComments`. Produces
`HAND_DRAWN_CARDS`, `HAND_DRAWN_WELLS`, `STAT_GRIDS_WITHOUT_STATTILE`.

- [ ] **Step 1: Write the scanner, and say what a card IS before counting one**

The strict predicate is: a `className` on an element that is not a `<Card*>` from
`components/ui/card.tsx`, carrying a rounding token (`rounded-xl` / `rounded-2xl` /
`rounded-3xl`) together with a card surface (`bg-card`, `bg-card/NN`) and/or a `border-border`
edge. Under it the tree holds 490 occurrences. **That number is two populations, and they must
be counted separately or the variant list will be designed from the wrong one:**

|                                                                                             | occurrences |
| ------------------------------------------------------------------------------------------- | ----------- |
| Strict predicate                                                                            | **490**     |
| of which have a real `bg-card` surface → `HAND_DRAWN_CARDS`                                 | **308**     |
| of which have no `bg-card` at all, qualifying only via `border-border` → `HAND_DRAWN_WELLS` | **182**     |

Of the 182, **124 are `bg-muted*`**, 33 `bg-gradient-to-b`, 7 carry no background token at all.
They read as insets and wells, not cards. Dropping them from the count entirely would hide real
duplication behind a definition — which is PR1's defect in a new costume — so they get their own
ratchet rather than an exclusion.

The scan must use a **brace-balancing parser**, not a regex: nested `cn()` calls undercount
otherwise. It must read `className="…"`, ``className={`…`}`` and `className={cn(…)}`. And it
must read **attribute expressions**, not only element children: `turkiye/page.tsx:218` passes a
complete hand-drawn card into `<V2TurkeyMapExplorer regionsSection={…}>`, and a children-only
walk reports a falling number while the cards move into props.

- [ ] **Step 2: Name the exclusions, with counts, in the docblock**

Each of these is excluded because it is not a card, and each is a number a reader can check:

- **8 design-system primitives** wearing card chrome — `<Input>` ×2
  (`v2-earthquake-explorer.tsx:439`, `v2-marine-map-explorer.tsx:765`), `<select>` ×2
  (`v2-register-card.tsx:539`, `:570`), `<input>` (`v2-books-hub.tsx:60`), `<DialogContent>`
  (`v2-auth-dialog.tsx:49`), `<SheetTrigger>` (`v2-header.tsx:472`), `<Button>`
  (`v2-hero.tsx:468`). `components/ui/{input,select,tabs,dialog,custom-select}.tsx` carry these
  strings in their `cva()` bases. **PR4 must not touch them.**
- **11 map viewports** — `rounded-2xl … border-border` around an `aspect-[…]` canvas is a
  viewport, not a surface, and several set their own background
  (`bg-[var(--map-sea,…)]`, `bg-[#0d1b2a]`). A `Card` variant would fight them.
- **38 interactive carriers** — `<Link>` ×28, `<a>` ×5, `<button>` ×5. Card-shaped, but they need
  focus-visible, hover and `group` behaviour a static panel must not carry. Out of scope for PR4;
  if they ever get a variant it is a distinct `interactive` one, and it stays
  `<Link className={…}>` because `Button` has no `asChild` here.

- [ ] **Step 3: The stat-grid counter**

**29** grids across **24** files, **108** tiles, **0** using `StatTile`. Pin all three.

- [ ] **Step 4: SCOPE paragraph, mutation check, gate, commit**

Same standard as Task 1, plus two rules this file learned the hard way:

- **Neither card counter will ever reach zero.** Say so in the docblock and say what they ARE:
  ratchets that can only fall. A counter whose name implies an end state it cannot reach is the
  defect PR3 spent four review rounds removing.
- **Do not compute a line number from `stripComments` output.** It collapses every comment to a
  single space by design, so every line derived from it is shifted after any multi-line
  `{/* … */}`. It already produced one wrong `file:line` during the measurement (a strip reported
  at 126 that is at 141). Boarded as T-043; do not be its first live case.

## Task 5: `Card` variants

**Files:** Modify `components/ui/card.tsx`; create `components/ui/card-variants.test.tsx`; modify the showcase.

- [ ] **Step 1: Derive the variants from the measured spellings — and notice the axis**

The owner's decision is that the site wins and the primitive adapts. The measured top spellings
are the evidence, and all seven counts below reproduced exactly on the re-count:

| n   | files | Spelling                                                                                                                          |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| 52  | 13    | `p-4 rounded-2xl bg-card border border-border shadow-2xs`                                                                         |
| 13  | 13    | `relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg` |
| 13  | 4     | `rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4`                                                         |
| 12  | 3     | `p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1`                                     |
| 12  | 1     | `p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3`                                                             |
| 11  | 4     | `rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6`                                                         |
| 10  | 2     | `rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs`                                                   |
| 8   | 1     | `rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs`                                                                   |
| 5   | 2     | `rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm`                                                                   |

**Read that list as axes, not as names.** Rows 3, 6, 8 and 9 are the _same panel_ at four
different `space-y` / shadow settings — 37 occurrences of one surface. Rows 1 and the
`p-3.5 rounded-2xl bg-card … shadow-2xs` entry (6 more) are the _same tile_ at two paddings. A
list of seven named card types would encode that accident permanently; the axis that actually
pays is **surface × spacing**.

So the API follows the precedent PR1 already set in this repo rather than inventing one:
`PageContainer` has a closed four-member rhythm union and `className?: never`. `Card` gets the
same shape — a closed `variant` for the surface and a closed `space` for the rhythm:

- `variant`: `panel` (`rounded-3xl border-border bg-card p-6 sm:p-8 shadow-sm`), `tile`
  (`rounded-2xl bg-card border-border p-4 shadow-2xs`), `glass`
  (`rounded-2xl border-border bg-card/85 backdrop-blur-md shadow-xs`), `feature`
  (`relative overflow-hidden rounded-3xl border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg`).
- `space`: `none` | `3` | `4` | `6`, mirroring the measured `space-y-*` settings.

**Ruling C applies to the 52-row: it does not become a `Card` variant.** That spelling IS the
Metric Strip tile, and Task 6 routes all 52 call sites through `StatTile`. A variant built for it
here would have zero consumers by the end of the PR. `tile` above exists for the other
`rounded-2xl bg-card` panels, not for the strip.

**Do not chase the tail.** 186 of the 254 spellings occur exactly once; only 21 spellings (197
occurrences) occur four or more times. Derive from those 21. The singletons are where a premature
variant becomes a prop explosion.

- [ ] **Step 1b: Two decisions while you are in `card.tsx`**

`CardAction` is exported and used **nowhere** in the tree. Either give it a call site or drop it —
`docs/design.md`'s rule from T-036 is that a component with no product call site gets deleted, not
kept alive for the showcase. And `v2-game-screen.tsx:989` (`bg-[#dbe8ee] dark:bg-[#15232d]`) and
`v2-world-map-explorer.tsx:531` (`bg-[#0d1b2a] dark:bg-[#070e17]`) carry hard-coded hex on
elements the strict predicate counts as cards — the same rule violation as the palette colours in
Task 6, in a different place. Record them; fix them only if they fall inside a file you are
already rewriting.

- [ ] **Step 2: Guard the variants against the CLI**

`docs/design.md` records that `shadcn add` overwrites files in the `ui` alias and that it asked
to overwrite `button.tsx` during T-034. `button.tsx`'s own hand-added variants are the
precedent for putting these here. Write a contract test that fails if the variants disappear,
so an overwrite cannot be silent.

- [ ] **Step 3: Specimen, gate, commit**

## Task 6: Migrate the Metric Strip family and adopt `StatGrid`

**Files:** Create `components/patterns/stat-grid.tsx` + test and a specimen + registry entry; modify `components/patterns/stat-tile.tsx`; modify the 13 Metric Strip files and the rest of the stat-grid files; modify the counters.

- [ ] **Step 1: Build `StatGrid`, and give `StatTile` the slot the data demands**

`StatGrid` is the responsive grid wrapper only. Tiles stay `StatTile`, which already composes
`MetricValue` and therefore inherits its required `absent` prop — that is deliberate:
`MetricValue.absent` is T-024's defect made impossible, and routing 108 tiles through it is how
that guarantee finally reaches the pages.

`StatTile` today renders `flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4` —
the strip's spelling minus `shadow-2xs`. Add the `shadow-2xs`; the site wins. This is free:
`StatTile` has **zero product consumers** today, the only files naming it being its own source and
`components/showcase/specimens/veri.tsx`.

**It also needs a value-tone slot, because the strips are not identical.** Add a closed `tone`
union over bridge tokens — `primary` | `secondary` | `accent` | `destructive` — never a raw class.

`StatGrid` is a new `components/patterns` component, so it needs a `/design-system` specimen and a
`components/showcase/registry.ts` entry like every other one. `registry.test.ts` enforces it.

- [ ] **Step 2: Migrate the Metric Strips — 7 shapes, not 1**

The 13 files carrying a 4-tile strip (13 × 4 = 52 tiles):

```
araclar/alan-hesaplama:109   araclar/koordinat-bulma:110   araclar/mesafe-olcme:108
araclar/page:104             deniz/kiyi-tipleri:117        deniz/page:211
deprem/fay-hatlari:117       deprem/hazirlik:107           deprem/page:134
dunya/page:187               kitaplar/[slug]/page:251      oyun/page:98
turkiye/page:178
```

Seven share the majority skeleton: `araclar` ×4, `dunya/page`, `oyun/page`, `turkiye/page`.
The other six diverge, and how they diverge is what decides the API:

- `deniz/kiyi-tipleri` — tile 5 `text-secondary` → **`text-teal-600`**, tile 11 `text-primary` → `text-destructive`
- `deniz/page` — tile 5 `text-secondary` → **`text-cyan-600`**
- `deprem/fay-hatlari` — tile 2 → **`text-red-600`**, tile 5 → **`text-blue-600`**, tile 8 → **`text-emerald-600`**
- `deprem/hazirlik` — tile 5 → `text-destructive`, tile 8 → `text-secondary`
- `deprem/page` — tile 2 → `text-destructive`, tile 5 → `text-primary`, tile 8 → `text-secondary`
- `kitaplar/[slug]/page` — **structurally a different component**: it inverts the pair (small muted
  label above, bold value below) and drops `mt-8`

**⚠️ Five raw palette tokens with no dark-mode pair.** `text-teal-600`, `text-cyan-600`,
`text-red-600`, `text-blue-600` and `text-emerald-600` break the repo's colour rule and have no
`dark:` counterpart — the same class of defect as the `marine-attribution` contrast bug. Mapping
them onto `tone` bridge tokens is the reason to do this migration now: doing the rewrite without
fixing them would bake off-token colours into a shared component. **That makes this a visible
change, not a pure refactor, and this PR may not claim "no card changed appearance."**

**Leave `kitaplar/[slug]/page.tsx` out of this step.** It is a different component and folding it
in is a visual change with no upside. Say in the report that it is deliberately left; a later task
can decide whether the inverted pair earns its own tile.

`kitaplar/page.tsx:141` is a 2-tile variant of the same shell (its tiles carry an extra
`sm:col-span-2`) whose comment claims **9** siblings. It has **12**. Correct the comment as you go
— it is wrong, and it is the evidence this whole task rests on.

- [ ] **Step 3: Migrate the remaining grids, drive the counter down**

29 grids across 24 files, 108 tiles total. After the strips, what is left is the long tail: report
where each one lands and justify anything that does not become `StatGrid` + `StatTile` rather than
quietly leaving it out of the count.

- [ ] **Step 4: Full gate plus the visual round**

`pnpm build` included. Playwright at 320/360/390/desktop in both themes, PNGs persisted with their
paths given. Stock `Card` is `rounded-xl` + `ring-1 ring-foreground/10`; the site's language is
`rounded-2xl` + `border` + `shadow`. If a variant is written wrong the difference is visible and no
test can see it, so the before/after has to be measured on a representative set — and the five
re-toned strips have to be measured deliberately, in both themes, because those are the ones that
are _supposed_ to change.

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
