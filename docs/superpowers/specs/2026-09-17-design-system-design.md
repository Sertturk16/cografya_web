# Terra design system — design (T-034)

Status: approved, ready for implementation planning.

## 1. Goal

Turn `components/ui` from a partial shadcn install into a deliberate component system with
Terra's character, and give it a living showcase at `/design-system` that displays every
component in both themes.

The showcase is not documentation written after the fact. It is the delivery surface: a
component is not done until its section renders there, and a test enforces that.

## 2. Why now, and why in this order

The original request was T-031, dark mode. Two things fall out of doing this first.

**A showcase is the only practical way to verify a dark palette.** T-031b redefines every
neutral and surface token. Checking that across 33 routes by hand is not verification, it is
sampling. One page showing 25 components in both themes side by side is.

**Components built before the palette get judged against a palette we have already decided
to discard.** `.dark` today is shadcn's stock achromatic grey — `oklch(x 0 0)`, chroma
exactly 0. The owner chose a deep-petrol "night sea" direction for dark mode (TASKS.md
T-031). Building fifteen components against the grey means designing their dark state twice.

So the theme layer lands between the showcase shell and the components:

```
A  Showcase shell + existing demos rebound to tokens
B  T-031a — theme mechanism (next-themes, three states, no flash)
C  T-031b — the "night sea" token layer, verified on A
D  Fifteen new components + five extensions, each verified in both themes as it lands
```

T-031c (categorical palette) and T-031d (dark maps) stay out of scope, as does T-032.

## 3. What the inventory actually says

Measured, not assumed. Counts are V2 files that hand-roll the pattern:

| Pattern                            | Files |
| ---------------------------------- | ----- |
| `<nav aria-label="Breadcrumb">`    | 27    |
| stat-number (`text-3xl font-bold`) | 48    |
| `border-t border-border` divider   | 24    |
| empty-state copy                   | 10    |
| `title=` used as a tooltip         | 8     |
| map legend                         | 4     |
| Ctrl+K hint                        | 3     |

Two findings worth stating separately:

**`title=` is not a tooltip.** It does not appear on keyboard focus, does not appear on
touch at all, and cannot be styled. Eight files rely on it. A real `Tooltip` is an
accessibility fix, not a nicety.

**No V2 map carries attribution.** All seven of V2's map components lack it;
`docs/design.md` requires "© OpenStreetMap katkıcıları, ODbL" beside every map, and V1's
`components/map/turkey-map-section.tsx` has it. This is ODbL licence compliance, not a style
rule — OSM requires attribution on derived maps. `MapAttribution` exists to close it.

**`docs/design.md` is stale about `Button`.** It documents variants
`secondary | emerald | amber | outline` and sizes `icon-sm | icon-lg` that the `cva` does not
define. The real set is `default | primary | sky | teal | ghost | destructive | link` and
`sm | md | default | lg | icon`. Correct the doc in this task rather than leaving a spec
readers will trust.

## 4. Scope: what is built, what is not

The original list came from a general-purpose prompt. Curated against consumers in this repo:

### Dropped, with reasons

| Component                      | Why not                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| DatePicker, DateRangePicker    | No date input exists anywhere in the app; earthquake windows are fixed server-side. The largest single cost on the list, zero consumers. |
| Slider / Range                 | No continuous-range input. Map zoom is buttons; magnitude filters are discrete buckets.                                                  |
| Radio / RadioGroup             | Every choice in the app is a card grid, a select or a checkbox. Add it when a consumer appears.                                          |
| Input Group                    | One consumer (search), already fine inline. Not a system need.                                                                           |
| Drawer as a separate component | `Sheet` is the drawer.                                                                                                                   |
| Skeleton variants              | Its thirteen lines are a shape, not a system.                                                                                            |

Dropping these is reversible and cheap. Building a DatePicker nobody calls is not.

### Built: fifteen new

**Generic primitives** — added through the shadcn CLI in `base-nova` style, then given
Terra's character:

1. `Tooltip` — closes the `title=` accessibility gap
2. `Popover` — richer than Tooltip; map hover cards, legend explainers
3. `Progress` — game progress, video progress
4. `Pagination` — leaderboard, earthquake list
5. `Breadcrumb` — 27 hand-rolled copies collapse into one
6. `Separator` — 24 hand-rolled dividers
7. `Spinner` — loading outside a button

**Bespoke** — no registry equivalent, written here:

8. `Typography` — heading scale, prose, and `Kbd`
9. `StatTile` — the 48-file stat-number pattern
10. `EmptyState` — illustration slot, explanation, optional action
11. `Callout` — editorial aside
12. `FormField` — label, control, helper text, error, wired for a11y
13. `MetricValue` — a data value with a unit and an explicit absent state
14. `MapAttribution` — the licence line
15. `MapLegend` — classed and categorical variants

### Extended: five existing

- `Button` — add `secondary` and `outline` (the doc already claims them)
- `Badge` — semantic `success` / `danger` naming alongside the existing set
- `Tabs` — `line` and `pills` variants
- `Table` — sorting affordance, row selection, and the `overflow-x: auto` wrapper
  `docs/design.md` mandates for narrow viewports
- `Select` — multi-select (the existing `custom-select` is searchable but single)

## 5. Two boundaries that carry weight

### `Callout` is not `Alert`

`Alert` reports **system state**: a request failed, an email is unverified, a flag is off.
`Callout` is an **editorial aside** inside teaching copy: a definition, a caution about a
common misconception, a note on where a figure comes from.

They are kept apart because the failure mode is one-directional and silent. Reaching for
`Alert` to typeset a pedagogical note gives that note `role="alert"` semantics, so assistive
technology interrupts the reader for something that is not an event — and the visual language
of "something went wrong" gets attached to ordinary teaching material. `Callout` has no
`role`, exactly as `EnWorkInProgressNotice` already reasons about its own note.

### `MetricValue` makes T-024's defect impossible

T-024 was a page promising live hourly telemetry over data that was not there. The fix was
per-page copy conditioning, which works until the next page forgets.

`MetricValue` moves the guarantee into the type:

```ts
interface MetricValueProps {
  readonly value: number | null | undefined;
  readonly unit?: string;
  readonly precision?: number;
  /**
   * What to render when there is no reading. REQUIRED — there is no default that is
   * safe. A caller cannot forget to decide.
   */
  readonly absent: { readonly label: string; readonly hint?: string };
}
```

When `value` is `null` or `undefined` it renders `absent.label` as muted text. It never
renders `0`, and it never renders a bare dash: a dash sits in the same visual slot a number
would and reads as a measurement. That is the distinction `docs/design.md`'s data doctrine
already draws when it forbids painting an absent value with a ramp.

## 6. Where components live

Two directories, with a boundary that is operational rather than taxonomic:

- **`components/ui/`** — output of `shadcn add`, Terra-themed. CLI-managed.
- **`components/patterns/`** — written here. `Typography` (which also exports `Kbd`),
  `StatTile`, `EmptyState`, `Callout`, `FormField`, `MetricValue`, `MapAttribution`,
  `MapLegend`.

The reason is concrete: `shadcn add` **overwrites** files in the configured `ui` alias. A
bespoke component living there is one `shadcn add` away from being silently clobbered.
Keeping the two apart means the CLI can be re-run on any registry component without risking
anything hand-written.

`components.json` already points `ui` at `@/components/ui`; `patterns` needs no alias
registration, only an import path.

## 7. The showcase

`/v2/design-system` during this task; the `/v2` prefix disappears with T-032 like every other
route. `noindex` — the current V1 page has no `generateMetadata` at all, so it is technically
indexable today; that is fixed on the way through.

**This supersedes a decision in the T-032 spec**, which listed `/design-system` under "delete,
internal". That was wrong on inspection: the V1 page is not V1 cruft but a 1,235-line showcase
of the V2 `components/ui` primitives — the right idea with the wrong implementation. It binds
colour through escapes like `text-[var(--color-primary-dark,#7e3a1e)]`, a raw token read with
a hex fallback, which is light-only by construction and bypasses the token bridge entirely.
(An earlier audit reported zero such escapes in V2; that grep was scoped to `components/v2`
and `app/[locale]/v2`, and this page is under neither.)

So: its specimens are ported into the new showcase in step A, and the V1 route is deleted by
T-032 along with every other V1 route — superseded, not discarded. T-032's spec and
`TASKS.md` are corrected to say so.

An index page plus one route per category, rather than one page carrying twenty-five
components:

| Route             | Contents                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `/design-system`  | Index: category cards, palette strip, type scale at a glance         |
| `…/temeller`      | Colour tokens, Typography, Kbd, Separator, radius and spacing scales |
| `…/aksiyonlar`    | Button (every variant × size × state), Spinner                       |
| `…/formlar`       | FormField, Input, Textarea, Checkbox, Switch, Select                 |
| `…/veri`          | Table, StatTile, MetricValue, Pagination, Progress                   |
| `…/geri-bildirim` | Alert, Callout, Toast, EmptyState, Tooltip, Popover, Skeleton        |
| `…/duzen`         | Card, Dialog, Sheet, Tabs, Accordion, Breadcrumb, Avatar, Badge      |
| `…/harita`        | MapAttribution, MapLegend                                            |

### Side-by-side themes

Each specimen renders twice — once in the ambient theme, once inside a `.dark` wrapper:

```tsx
<ThemePair>
  <Button variant="primary">Kaydet</Button>
</ThemePair>
```

This works without a second page because `app/globals.css` declares
`@custom-variant dark (&:is(.dark *))`, so Tailwind's `dark:` variant matches any descendant
of a `.dark` element, and the custom properties in the `.dark` block cascade the same way.
The wrapper sets `bg-background text-foreground` itself, since `body` normally supplies those.

**Known limitation, to be stated on the page rather than discovered.** Components that
portal to `document.body` — `Dialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`, toasts —
render their content outside the wrapper and therefore pick up the **global** theme, not the
pair's. `ThemePair` cannot show those in two themes at once. Those specimens are marked as
"toggle to compare" and verified with the global theme switch. Pretending otherwise would
mean shipping a showcase that silently lies about half the feedback layer.

### The staleness tripwire

The standard failure mode of a design system is a showcase that drifts from the code. A test
enumerates `components/ui/*.tsx` and `components/patterns/*.tsx` and asserts each exports a
component that appears in exactly one showcase category. Adding a component without a
specimen fails the suite.

`components/patterns/theme-pair.tsx` and the showcase's own helpers are exempt by an explicit
allowlist, not by a pattern match — an exemption nobody wrote down is how these tests decay.

## 8. Prerequisites B and C

These are T-031a and T-031b, whose design decisions are already recorded in `TASKS.md`. They
are sequenced inside this flow because C is what D is designed against, and A is what C is
verified on.

**B — theme mechanism.** Mount `next-themes` (`^0.4.6`, already a dependency) in the root
layout with `attribute="class"`, `defaultTheme="system"`, `storageKey="theme"` — the key the
current toggle already writes, so nobody loses their preference — and
`disableTransitionOnChange`. Rewrite `components/v2/theme-toggle.tsx` on `useTheme()` with
three states. `components/ui/sonner.tsx`'s `useTheme()` starts returning a real value instead
of always `"system"`. `viewport.themeColor` becomes a light/dark pair.

`components/v2/v2-header-search-theme.test.ts` asserts the current implementation's internals
(`classList.add("dark")`, `localStorage.setItem`). Those assertions are rewritten, not
deleted — the behaviour they guard still matters, only its mechanism changes.

**V1 breaks here, and that is accepted.** With a provider mounted and `defaultTheme="system"`,
a V1 page rendered for an OS-dark visitor picks up `--background` from the `.dark` block while
V1's CSS modules keep their light values. The owner's position (2026-09-17): the site is on a
bare IP, unannounced, with no audience; V1 is being deleted in T-032 regardless. No theme
boundary, no `.v1-scope` shim, no route marker — that scaffolding was the thing worth avoiding.

**C — the night-sea token layer.** Rewrite the `.dark` block in `app/globals.css` so dark mode
reads as the same brand as light: a cool deep-petrol field in the `--color-accent` water-teal
family, carrying the warm terracotta accent. Map surfaces read as a lit panel above the darker
page (land lighter than sea, preserving the atlas convention).

The direction was chosen from an illustrative preview:

```
bg #0b1416 · card #121e21 · muted #1b2b2f · border #2a3f44 · ink #e8f0f1
map sea #1f3a40 · map land #2c4a4e
primary oklch(0.65 0.13 40.65)   ← kept from T-018
```

**Those hexes are a direction, not measured values.** They were written to communicate a
character and have not been checked against anything. Every one is re-derived and measured
during implementation: 4.5:1 for normal text and 3:1 for graphical objects, on the actual
surface each token lands on — the same standard the light palette's tokens are documented
against in `app/globals.css`. Do not paste them in as final.

`--primary`, `--secondary` and `--accent` keep the hues T-018 measured; only the neutrals and
surfaces move.

## 9. Testing

Vitest runs in node with **no jsdom**, so there is no component rendering. Tests are structure
tests over source text (`readFileSync` + assertions, this repo's house form) and pure unit
tests over `lib/`. Nothing under `app/` is collected, so a test about a route reads the file.

Per component: a structure test asserting it builds on semantic tokens and carries its
accessibility contract. Concretely — no raw palette classes (`bg-emerald-500`), no brand hex,
no `var(--color-*)` escape with a hex fallback of the kind the current showcase page uses;
and for interactive components the attributes their behaviour depends on (`aria-invalid` and
`aria-describedby` on fields, `role` and focus management on overlays).

System-wide: the showcase coverage tripwire (§7), and a token-escape test over
`components/ui`, `components/patterns` and the showcase routes.

Visual: every specimen checked at 320, 360, 390 px and desktop, in both themes, before its
task closes.

## 10. Risks

- **`shadcn add` writes raw `oklch` values.** `CLAUDE.md` already warns about this. Every CLI
  import is read and rebound to the token bridge before it is committed; the token-escape test
  is what keeps it rebound.
- **`ThemePair` cannot show portalled components in both themes.** Stated on the page and in
  §7 rather than left for someone to notice. If it is ever worth fixing, the fix is a portal
  container inside the wrapper, which is a larger change than this task should absorb.
- **The night-sea hexes above are unmeasured.** The single most likely way this work ships
  something wrong is by treating an illustrative preview as a measured palette.
- **The showcase can still rot in content while passing its coverage test.** The test proves a
  specimen exists, not that it exercises every variant. That gap is accepted; the alternative
  is asserting over rendered output, which this test setup cannot do.
