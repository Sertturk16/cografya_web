# T-035 — Page composition: a template layer, and getting it adopted

Status: approved, not yet implemented.
Surface: `cografya_web`.
Supersedes the T-035 entry on the workspace board, whose figures were measured before T-032
moved the tree and are wrong in seven places (recorded in full below).

## 1. The problem

T-034 built 36 components. T-036 deleted eight primitives nobody used. What neither closed is
the layer above: how pages ARRANGE those components. The same job is done a different way on
almost every page, and the cost is not only aesthetic — three of the inconsistencies are live
defects.

The task exists because of one measured fact. `components/patterns/stat-tile.tsx` carries this
in its own docblock: it replaces "the shape 48 V2 files were writing by hand as
`text-3xl font-bold` plus a caption." It has **zero** consumers. The component was built for a
measured need and then nobody adopted it. That is the whole thesis of this task: pulling a
thing into a component genuinely ends the inconsistency, but it does not happen by itself.

## 2. Measurements (2026-09-17, on the post-T-032 tree)

Surface: 34 pages under `app/[locale]/(site)/**`, 3 under `app/[locale]/(play)/**`,
50 components under `components/v2/**`. 32,058 lines of TSX. Test baseline: 209 files /
4,544 tests green.

### 2.1 Where the board is wrong

| Claim                    | Board                                    | Measured                                           |
| ------------------------ | ---------------------------------------- | -------------------------------------------------- |
| Hand-drawn cards         | 457 / 67 files / 212 spellings           | **592 / 73 files / 335 spellings**                 |
| Zero-consumer components | 13                                       | **6**                                              |
| Page skeleton variants   | 4                                        | **1 real residue**                                 |
| `overflow-x-clip`        | behavioural difference between pages     | **0 occurrences in the repo**                      |
| FAQ                      | 12 files / 3 mechanisms / 87 occurrences | **11 files / 2 mechanisms / 58 pairs**             |
| `h1` variants            | 7                                        | **11 — and 6 pages have none at all**              |
| Hero wrapper             | 14                                       | **17, and a single spelling — already consistent** |

Two of the board's "zero consumer" entries are false positives: `sonner` is mounted as
`<Toaster />` in `app/[locale]/layout.tsx:83`, and `theme-pair` is consumed by
`components/showcase/specimen.tsx` — it is showcase infrastructure, not a product component.
The board's paths (`app/[locale]/v2`) refer to a tree T-032 deleted.

### 2.2 What is actually there

**Page shell.** 29 of 37 pages already return a Fragment; `(site)/layout.tsx` owns
`min-h-screen flex flex-col justify-between bg-background text-foreground`. Five pages carry a
redundant duplicate of that wrapper. `PageShell` as the board imagined it is dead. The real
variation is one level down, in the container: family A
`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 …` on 29 pages with **six** tail variants
(`pt-6 sm:pt-10`, `pb-20` present or not, `space-y-8/10/12/14/16`), and family B
`container mx-auto px-4 max-w-7xl …` on 5 pages — the same intent with the tokens reversed.
The job is page RHYTHM, not page skeleton.

**Breadcrumbs — the largest finding, and the board does not mention it.** 27 files hand-write
`<nav aria-label="Breadcrumb">` (25 pages plus two shared components covering 7 more); the
`components/ui/breadcrumb` primitive that already exists is used by **4** pages. 32 to 4.

Worse, and separately: **31 files render a visible breadcrumb, 11 emit `breadcrumbJsonLd`.**
24 files show a trail to the reader and tell search engines nothing. Unlike FAQ rich results,
BreadcrumbList rich results are NOT restricted by Google and are widely shown — the trail
replaces the raw URL in the result. This is a measurable loss, not a speculative one. (Several
of the 24 are `noindex` auth/account pages where it does not matter; each is to be checked
against `lib/seo/indexing.ts` during implementation.)

**`h1`.** 11 distinct spellings, split by colour: 19 pages terracotta (`text-primary`, hub and
index pages), 12 neutral (`text-foreground`, and the detail pages are also larger:
`text-4xl sm:text-6xl font-extrabold`). Six pages have **no `h1` at all** — `hakkimizda`,
`giris`, `kayit` and the three `(play)` screens. `hakkimizda` has no `h2` either; its title
exists only as a `<BreadcrumbPage>` label. `docs/design.md` requires one `h1` per page.

**Hero.** `relative z-10 max-w-3xl space-y-4`, 17 occurrences, exactly one spelling, and the
same 17 pages as `h1` group 1. Already consistent; extraction is trivial.

**Cards.** 592 hand-rolled card-signature classNames across 73 files, in 335 distinct
spellings. The top ten spellings account for 147 occurrences — under a quarter. The remaining
~456 are spread over 325 spellings, i.e. almost all one-offs. Some are not cards at all:
`flex items-center p-2 rounded-xl hover:bg-muted transition-colors` (×8) is a list row.
Meanwhile `components/ui/card.tsx` renders 93 elements across 9 files.

**Stat grids.** 12 grids, 48 tiles, 11 pages, none using `StatTile`.

**FAQ.** 9 route files plus 2 shared components. Two mechanisms, not three: a real `Accordion`
on `/deniz` only, plain cards everywhere else. No `<details>` is used for Q&A anywhere. 58
fixed pairs plus API-sourced pairs on `/turkiye/bolge/[slug]`. Exactly one page renders FAQ
content and emits no FAQ JSON-LD: `/deniz`.

### 2.3 Two rules that cannot see what they exist to catch

**`components/ui/orphan.test.ts` lists `components/patterns` in `PRODUCT_ROOTS`.** Every
patterns file is therefore a root and is automatically "reachable", so no patterns file can
ever fail the orphan rule. Five have zero product consumers — `Callout`, `EmptyState`,
`MapLegend`, `MapAttribution`, `StatTile` — and a sixth, `MetricValue`, has exactly one
consumer: `StatTile`, which itself has none. It is transitively orphaned, which is the case
the test's own docblock is proudest of catching for `components/ui` (the `skeleton` → `table`
chain) and cannot catch here.

The sixth zero-consumer component, `components/ui/tabs.tsx`, is a different situation: it IS
caught, and is recorded by name on `KNOWN_SHOWCASE_ONLY` with T-036's decision to keep it. PR6
removes it from that list by adopting it.

**`lib/marine/explainers.ts` is dead** — its only importers are its own two test files. It
carries the recorded rationale for `/deniz` not emitting FAQ JSON-LD ("Google has restricted
FAQ rich results to authoritative government and health sites since 2023"). The reasoning is
real; it is attached to a module that renders nothing, so the page it is about records nothing.
Its `Deniz.q1..q8`/`a1..a8` keys sit on an orphan list in `messages/tr.json`.

**`components/patterns/map-attribution.tsx`** (66 lines, 0 consumers) duplicates
`components/v2/v2-map-attribution.tsx` (102 lines, 10 consumers). `docs/design.md` lists
`map-attribution` as a patterns component; the file living there is the wrong one. ODbL
compliance is rendered by the copy that is not where the docs say it is.

## 3. Decisions (owner, 2026-09-17)

1. **Scope: template layer plus a tripwire.** Build the components, adopt each one in the same
   PR that introduces it, and do not chase the 335-spelling tail — freeze it at today's number
   so it can only fall. Defects are closed on the way.
2. **The site's card language wins; the primitive adapts.** `components/ui/card.tsx` gains
   variants carrying the site's real look (`rounded-2xl`/`rounded-3xl`, `border`, `shadow`), so
   no card changes appearance when it migrates. This is the same call already recorded for
   `Typography.H1` — the component is fitted to the site, not the pages to the component.
3. **`h1` has two tiers, deliberately.** Hub and index pages keep the terracotta `H1`; detail
   pages (country, province, region) get a larger neutral `H1Display`. The split that exists
   today has a rationale: on a hub the heading is brand, on a detail page the heading is data
   (the country's name). 11 spellings become 2, not 1.
4. **FAQ JSON-LD is emitted everywhere, from one source.** `FaqSection` derives both the
   visible accordion and `faqPageJsonLd` from a single array, so the drift risk that justified
   the refusal disappears by construction. `lib/seo/json-ld.tsx:113` already asks for exactly
   this: `FaqEntry.answer` is documented as "Plain text — must be the SAME text the page renders
   visibly." The `/turkiye/bolge` TR-only gate stays: its FAQ has no English counterpart and
   machine translation is barred. (Closing that gate is T-040, deliberately a separate task.)

## 4. What gets built

Seven parts. Nothing is on this list without a measured number behind it.

| #   | Component                        | Closes                                                                    | New            |
| --- | -------------------------------- | ------------------------------------------------------------------------- | -------------- |
| 1   | `PageContainer`                  | 34 pages, 2 families + 6 tails → 1                                        | yes            |
| 2   | `Breadcrumbs`                    | 27 hand-written + 4 primitive → 1; **and the 24 missing BreadcrumbLists** | yes            |
| 3   | `PageHero`                       | the already-identical 17-page hero; binds the `h1` tier                   | yes            |
| 4   | `Typography.H1` + `H1Display`    | 11 spellings → 2; **creates the 6 missing `h1`s**                         | Display is new |
| 5   | `FaqSection`                     | 11 files, 2 mechanisms → 1; emits JSON-LD from the same array             | yes            |
| 6   | `StatGrid` + existing `StatTile` | 12 grids / 48 tiles                                                       | grid is new    |
| 7   | `Card` variants                  | lets 592 cards migrate without changing appearance                        | existing file  |

**The shared idea in contracts 2 and 5:** one array in, two outputs out — the visible markup
and the structured data. Divergence between what a reader sees and what a crawler is told
becomes structurally impossible rather than a comment asking someone to remember.

Every new component needs a registry entry and a specimen at `/design-system`;
`components/showcase/registry.test.ts` fails otherwise.

### Contracts, to the level that stops two people building different things

- **`PageContainer`** owns horizontal width and padding and the top/bottom rhythm; it does NOT
  own `min-h-screen` or the background — `(site)/layout.tsx` already does. The six tail
  variants collapse to one default plus a small `space` union (not an open `className`
  override, which would reproduce the tails through the back door). The five pages carrying a
  redundant `min-h-screen …` wrapper lose it here. `(play)` pages keep their own wrapper: that
  group has no layout providing one.
- **`Breadcrumbs`** takes one `items` array and renders the `components/ui/breadcrumb`
  primitives, so the 4 pages already doing it correctly converge rather than being left alone.
  It emits `breadcrumbJsonLd` from the SAME array, gated on the page being indexable — the
  gate is read from `lib/seo/indexing.ts`, never hand-passed per page, or the 24-file gap
  simply reappears as a forgotten prop.
- **`PageHero`** is the `relative z-10 max-w-3xl space-y-4` block: a breadcrumb slot, the
  heading, and an optional lede. It takes the heading TIER (`hub` | `detail`) rather than a
  className, and renders `H1` or `H1Display` accordingly. It never renders an `h2`.
- **`FaqSection`** takes `entries: FaqEntry[]` — the type already exported by
  `lib/seo/json-ld.tsx` — and renders `Accordion` plus, by default, `faqPageJsonLd(entries)`.
  JSON-LD is suppressible for a locale gate, but suppression takes a reason argument so an
  unexplained one cannot be written. Answers are plain text: they land in a `<p>` and in
  `answer.text`, so markup in them would render literally in both.
- **`StatGrid`** is the responsive grid wrapper only; the tile stays `StatTile`, which already
  composes `MetricValue` and therefore inherits its required `absent` prop. That is deliberate:
  `MetricValue.absent` is T-024's defect made impossible, and routing all 48 tiles through it
  is how that guarantee finally reaches the pages.
- **`Card` variants** are a `variant` union on the existing primitive carrying the site's real
  spellings, not an open class passthrough. The top ten spellings (147 occurrences) are the
  evidence for which variants exist; a spelling that appears once does not earn one.

### Out of scope, with reasons

- **`MapLegend` adoption** → T-031d. Its call sites are inside the ~1,300-line map explorers,
  which the dark-map round opens anyway.
- **The explorers' `viewMode` segmented controls** → T-031d, same files, same reason.
- **`Tabs` in the two map explorers** → T-031d.
- **`Tabs` in `v2-auth-dialog` and `v2-member-hub` is IN scope.** T-036 handed this to T-035
  explicitly, and it closes a measured defect: both hand-roll correct `role="tablist"` /
  `aria-selected` / `aria-controls` wiring but neither implements arrow-key navigation
  (`onKeyDown`: 0 in both). ARIA APG requires Left/Right between tabs; a keyboard user can
  reach the widget and cannot move inside it. Base UI's `Tabs` ships that behaviour.
- **`Callout` / `EmptyState`** → measure real call sites during PR6. Adopt where one exists;
  otherwise delete, per the orphan rule T-036 established. A primitive is not kept alive so the
  showcase has something to list.

### Deleted on the way

- `lib/marine/explainers.ts` and its two test files; the 16 orphan `Deniz.q*/a*` keys in
  `messages/tr.json`, shortening the orphan list that pins them.
- `components/patterns/map-attribution.tsx` (0 consumers). `v2-map-attribution.tsx` moves into
  `components/patterns/`, where `docs/design.md` already says it lives. The showcase specimen
  in `harita.tsx` follows it.
- The five redundant `min-h-screen …` page wrappers.

## 5. The tripwire

`components/v2/page-composition.test.ts`. Precedent for walking the page tree from a component
directory: `components/v2/v2-a11y-navigation-polish.test.ts`. Vitest does not run anything
under `app/`, but a test elsewhere can read it.

**Exact equality, not a ceiling.** `docs/design.md` currently records its own failure of the
ceiling approach: "Measured 2026-09-17: 895 raw palette classes across 42 files, not the 34
recorded earlier — and nothing holds that number, so it moved without anyone noticing." The
number drifted from 749 to 895 because it lived only in a comment. A ceiling nobody lowers
stops meaning anything, so this follows `orphan.test.ts`'s idiom — an exact assertion that
ratchets in both directions, where raising OR lowering is a deliberate one-line change a
reviewer sees.

| Counter                                                 | Today                | Target             | Locked in |
| ------------------------------------------------------- | -------------------- | ------------------ | --------- |
| Hand-written `aria-label="Breadcrumb"`                  | 27 files             | 0                  | PR2       |
| Visible breadcrumb, no BreadcrumbList (indexable pages) | 24 files             | 0                  | PR2       |
| Page root wrapper spellings                             | 2 families + 6 tails | 1                  | PR1       |
| Distinct `h1` classNames                                | 11                   | 2                  | PR3       |
| Pages with no `h1`                                      | 6                    | 0                  | PR3       |
| Hand-rolled card spellings                              | 335                  | frozen; falls only | PR4       |
| Stat grids not using `StatTile`                         | 12                   | 0                  | PR4       |
| Files rendering FAQ outside `FaqSection`                | 11                   | 0                  | PR5       |

Three requirements from `docs/conventions.md`, all mandatory:

1. **Strip comments** with `lib/test-support/strip-comments.ts`. A docblock containing
   `aria-label="Breadcrumb"` would satisfy a naive counter — the trap this repo arrived at
   independently four times.
2. **Positive controls** per counter: that files were really read, and that the pattern really
   matches source that carries one. A counter reaching zero through a broken regex looks
   identical to success.
3. **Mutation-check every counter** before the PR lands: break the thing it exists to catch and
   watch it go red. "A source-text assertion that has never failed has not been shown to work."

## 6. PR sequence

Component and adoption ship together. This makes T-034's failure mode — 36 components, 13
without consumers — unrepeatable.

| PR  | Contents                                                                                                                                                                  | Why here                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `PageContainer` + 34 pages + the test file's skeleton and first counter                                                                                                   | Mechanical base, shallow touch on every page. **Unblocks T-037**: `loading.tsx` skeletons need a container measure to align to |
| 2   | `Breadcrumbs` (nav + BreadcrumbList from one array) + 27 hand-written + 4 primitive users + the 24 missing JSON-LDs                                                       | Largest single win; the only part with a measurable SEO return                                                                 |
| 3   | `Typography.H1` retune + `H1Display` + `PageHero` + the 6 missing `h1`s                                                                                                   | First visible change → Playwright round                                                                                        |
| 4   | `Card` variants + card migration + `StatGrid` + `StatTile` adoption (48 tiles)                                                                                            | Riskiest PR. Visible → Playwright round                                                                                        |
| 5   | `FaqSection` + 11 files + `/deniz`'s JSON-LD + deleting `lib/marine/explainers.ts` and its orphan keys                                                                    | Stands alone; carries the JSON-LD decision                                                                                     |
| 6   | `Tabs` in the two dialogs (arrow-key fix) · the `map-attribution` duplicate · `Callout`/`EmptyState` measure-then-adopt-or-delete · **closing the `orphan.test.ts` hole** | Cleanup, and making the rule durable                                                                                           |

**The last item is the most important and is deliberately last.** Removing
`components/patterns` from `PRODUCT_ROOTS` makes the orphan rule able to see the patterns
surface. Done after adoption, it correctly fails on anything still unadopted from that day
forward. Done first, it would fail on work this task has not done yet.

## 7. Verification

**Every PR**, per `CLAUDE.md`'s "Done means": `pnpm typecheck`, `pnpm lint`, `pnpm test` — run
as **separate commands**, each exit code read on its own, never chained behind `&&` where a
failure earlier in the chain hides what came after. `pnpm build` additionally on PR2 and PR5,
which touch SEO output.

**Visible PRs (3 and 4)**, per `docs/design.md`'s review ritual: 320 / 360 / 390 px and
desktop, light and dark, via Playwright MCP, with screenshots.

**PR4 carries a specific burden.** The claim will be "no card changes appearance." That has to
be measured, not asserted: before/after screenshots on a representative page set at two
viewports × two themes. Stock `Card` is `rounded-xl` + `ring-1 ring-foreground/10`; the site's
language is `rounded-2xl` + `border` + `shadow`. If the variants are written wrong the
difference is visible and no test can see it.

**After `main`.** The shared lesson of T-032 and T-038: a green deploy and a verified local
build both said "no problem" while the live sitemap served 31 URLs instead of 320. PR2's
JSON-LD is in exactly that class — it can render correctly locally and bake empty in
production. At least one page's BreadcrumbList and `/deniz`'s FAQPage get verified from real
production HTML.

## 8. Risks

- **`Card` variants put hand-written code in the shadcn CLI's zone.** `shadcn add card` can
  overwrite `components/ui/card.tsx`. There is precedent — `button.tsx`'s `emerald`/`sky`/
  `teal`/`amber` variants are hand-added the same way, and the CLI already asked to overwrite
  `button.tsx` during T-034 and was declined. Mitigation: a contract test that fails if the
  variants disappear, so an overwrite cannot be silent.
- **The 335-spelling tail is not finishable.** It is frozen rather than fixed. Anyone reading
  the counter should understand it as a ratchet, not a target; the docblock says so.
- **PR4 touches 73 files.** It is split from the rest for that reason and is the one PR where a
  visual regression is plausible.
- **T-031c owns colour on this surface.** Raw palette classes and hand-written `dark:` in
  `components/v2` are deliberately not asserted here; `components/ui/token-binding.test.ts`
  records why. This task must not start binding those tokens or it will collide with T-031c in
  the same files.
