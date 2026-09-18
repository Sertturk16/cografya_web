# cografya_web — design (Terra)

Read before any visible UI change. Tokens live in `app/globals.css` `:root`; this file says
what they mean and which rules bind. Never duplicate a hex here or in a component.

## Identity

Earth / topographic. Warm terracotta primary, olive secondary, water-teal accent on a
warm-stone parchment field. Serif display (Fraunces) over humanist sans (Nunito Sans).
Authoritative, natural-science, calm. Not edtech neon, not generic SaaS grey.

The one rule that governs everything: **brand chrome ≠ data.** Terra tokens colour UI
(header, buttons, cards, links). They never encode a data value on a map or chart.

## Tokens (`:root`)

| Group            | Tokens                                                                                                                                                                         | Notes                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Brand            | `--color-primary` #b0522e, `--color-primary-dark` #7e3a1e, `--color-secondary` #4f6d30, `--color-accent` #276b70, `--color-on-primary` #fff                                    | primary-dark for links/hover; accent for focus ring and info                                                            |
| Neutrals         | `--color-ink` #2b2622, `--color-ink-dark` #211c19, `--color-slate` #57504a, `--color-taupe` #8a8078, `--color-border` #ddd5cc, `--color-surface` #f1e9de, `--color-bg` #fbf8f3 | ink-dark is the only neutral that clears 3:1 as a line over every data fill; use it for borders on data, never for text |
| Chips / semantic | `--color-chip-bg` #ede3d5, `--color-chip-ink` #7e3a1e, `--color-success` #496f35, `--color-warning` #c9860f, `--color-danger` #b23b2e, `--color-info` #276b70                  |                                                                                                                         |
| Layout           | `--container-max` 1120px, `--radius` 0.625rem, `--radius-lg` 16px, `--header-height` 3.5rem                                                                                    | `--radius-lg` also exists in `@theme inline` as 10px; prefer Tailwind `rounded-*` in V2                                 |
| Fonts            | `--font-heading` (Fraunces), `--font-body` (Nunito Sans)                                                                                                                       | loaded in `lib/fonts.ts` via `next/font`, `latin` + `latin-ext` for İ ı ğ ş ç ö ü; never a Google Fonts `<link>`        |

shadcn bridge tokens (`--background`, `--foreground`, `--card`, `--primary`, `--muted`,
`--accent`, `--destructive`, `--border`, `--input`, `--ring`, ...) map onto Terra in
`:root` and are re-exported by `@theme inline`, so in V2 write `bg-primary`,
`text-muted-foreground`, `border-border`, `ring-ring`, `font-heading`.

## Typography

- Headings Fraunces, body Nunito Sans, body 16px / 1.6. `h2` renders in primary-dark.
- Fluid scale in `app/globals.css`'s base layer: h1 `clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem)`,
  h2 `clamp(1.4rem, 1rem + 1.4vw, 1.8rem)`. Use Tailwind sizes on the page but keep the same
  hierarchy: one `h1` per page, headings in document order.
- A HERO `h1` has exactly TWO tiers, both in `components/patterns/typography.tsx`; a third HERO
  spelling is a defect. The site as a whole ships more, and they are named and justified one by one
  in `components/v2/page-composition.test.ts` (`H1_SPELLINGS`, pinned exact): the two tiers, two
  deliberate non-tiers — the shared `(site)/error.tsx` + `not-found.tsx` shell spelling, and the
  `sr-only` heading on the three `(play)` game screens — and nine pre-existing spellings on pages
  no adoption has reached yet. An ADDITIONAL spelling that is not named there is the defect; a shell
  or a hidden heading is not a hero and must not be converged onto a hero tier without a decision.
  `H1` is the hub tier, 14 of the 17 heroes —
  `font-heading text-[1.9rem] sm:text-5xl font-bold tracking-tight text-primary leading-tight`.
  `H1Display` is the detail tier (one province, one country, one sea) —
  `font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground`.
  The hub tier writes `text-[1.9rem]` rather than the pages' `text-3xl` because the 1.9rem floor
  is not negotiable and `text-3xl` is 0.4px under it; an arbitrary size carries no paired
  line-height, so `leading-tight` is load-bearing. `PageHero` renders the tier plus the measured
  hero shape (badges, h1, notice, lede, tail).
- Retuning `H1` to the hub tier is a VISIBLE change to `/hakkimizda`, the one page outside the 17
  heroes that renders `<H1>` directly: its heading becomes terracotta and grows 6.4px on desktop.
  Recorded here because that page is not covered by the hero adoption and the change is easy to
  make again by accident.

## Dark mode — "Night Sea"

- Mechanism: `next-themes` is mounted in `app/[locale]/layout.tsx` via
  `components/theme-provider.tsx` — `attribute="class"`, `defaultTheme="system"`,
  `storageKey="theme"`. Its blocking script sets the class before hydration, so there is no
  light flash; `<html>` carries `suppressHydrationWarning` for that reason.
  `components/v2/theme-toggle.tsx` cycles light → dark → system → light, with a polite live
  region. `sonner` reads the real theme.
- Character: a cool deep petrol field in the `--color-accent` water-teal family, carrying the
  warm terracotta accent — the atlas reading the site already uses for water. It is
  deliberately NOT shadcn's stock ramp, which was `oklch(x 0 0)`: chroma zero, i.e. a
  different brand from light mode's warmth.
- Every value in `.dark` is measured, and the table lives in `app/globals.css` beside it.
  `lib/theme/contrast.ts` is what produces those figures — use it rather than recalling a
  ratio. `blendOver` matters as much as `contrastRatio`: a tinted chip's real contrast is
  against the BLEND, and measuring against the untinted token hides failures.
- **Colour in a component comes from a bridge token.** No `bg-[var(--color-x,#hex)]` escape,
  no raw Tailwind palette class, no brand hex, and no hand-written `dark:`. A component that
  needs a `dark:` is bound to the wrong token. `components/ui/token-binding.test.ts` enforces
  all four; two exemptions are listed there with reasons (a `mix-blend-mode`, and one
  per-theme alpha), and a further assertion fails if an exemption goes stale.
- Semantic families have two members. The base is the FILL; the `-strong` member is text on a
  tint of that fill. They are not interchangeable — the base measures 2.62:1 as text on its
  own 15% tint for warning, and 3.98-4.17:1 for the others.
- Not yet themed, and known: the categorical accent system (T-031c) and map surfaces (T-031d).
  Measured 2026-09-17: **895 raw palette classes across 42 files**, not the 34 recorded earlier —
  and nothing holds that number, so it moved without anyone noticing. `--chart-*` and
  `--sidebar-*` remain shadcn's achromatic stock (chroma exactly 0, unlike the rest of the dark
  palette) and nothing reads them.
- The showcase at `/design-system` shows every component in both themes side by side. A
  component is not done until its specimen renders there, and
  `components/showcase/registry.test.ts` fails if one is missing.

## Accessibility floor (WCAG 2.1 AA)

- Focus visible everywhere: `:focus-visible` = 3px `var(--ring)` outline, 2px offset.
  Never remove without a compliant replacement. Elements with `tabindex="-1"` are exempt.
  It is `--ring` and not a raw Terra token on purpose: raw tokens are frozen at their light
  values, so `--color-accent` measured 3.04:1 in dark mode. `app/globals.css` records the
  working against the alternatives beside the rule.
- Skip link exists; `<main>` is focusable.
- Text contrast 4.5:1 measured on **`--color-surface`** (the darkest light-mode panel),
  not only on `--color-bg`. Taupe is 3.9:1 on white: placeholder / decorative only, never
  body, nav, footer or labels. Use slate for secondary text.
- Touch targets ≥ 24×24 CSS px; generous controls take 44×44. Map province shapes are the
  one exemption (zoom is the remedy, not bigger shapes).
- `prefers-reduced-motion: reduce` disables transitions globally; do not re-enable.
- State changes announce: error boundaries move focus to the heading; last-resort
  boundaries use `role="alert"`.
- Never encode meaning by colour alone: pair with text, icon, pattern or shape.
- Mandatory viewports for any header/layout change: 320, 360, 390 px and desktop.
  Await `document.fonts.ready` before measuring heights (fallback fonts are narrower).

## Components

Two directories, and the boundary is operational rather than taxonomic:

- **`components/ui/`** — output of `shadcn add` (`base-nova` style), Terra-themed. CLI-managed.
- **`components/patterns/`** — written here: `typography` (with `Kbd`), `stat-tile`,
  `metric-value`, `empty-state`, `callout`, `form-field`, `map-attribution`, `map-legend`,
  `theme-pair`, `page-container`.

The reason is concrete: `shadcn add` **overwrites** files in the configured `ui` alias — it
asked to overwrite `button.tsx` during T-034 and was declined. A hand-written component living
there is one CLI run away from being silently clobbered. Two files now carry hand-added variants
and must survive a CLI run: `button.tsx` and `card.tsx`. Card's are guarded by
`components/ui/card-variants.test.ts`, which asserts the exact class strings, because an overwrite
would revert 76 adopted sites to the stock `rounded-xl ring-1` card and nothing else would see it.

`Card` has two forms. Without `variant` it is the CLI's card, `className` and all. With one it is
the site's measured card language and `className` is `never`: `variant` (`panel` | `glass` |
`feature`) is the surface, `elevation` the shadow, `space` the vertical rhythm, `as` the element
(`div` | `section` | `article`) — closed unions, the shape `PageContainer` set. Reach for a new
card spelling only after checking whether it is one of these at a different setting.

Read every CLI import before committing it. The T-034 batch arrived with `import { cn } from
"cn"`, an unrelated npm package the CLI also installed, and with a `Tooltip` that had no
`role` and no `aria-describedby`.

### Rules that hold across every component

- Colour comes from a bridge token. No `bg-[var(--color-x,#hex)]` escape, no brand hex, no raw
  Tailwind palette class, no hand-written `dark:`. Know which of those is actually enforced
  where, because it is not uniform: `components/ui/token-binding.test.ts` applies **all four**
  to `components/ui`, `components/patterns` and `components/showcase/specimens`, but across
  `components/v2` and the pages it checks **only the escape rule**. Raw palette classes and
  hand-written `dark:` on that surface are the categorical accent system, which T-034 scoped out
  and T-031c owns. Its exemption lists are named in the file with a reason each, and every one is
  paired with an assertion that the exemption is still needed.
- A semantic family has two members: the base is the FILL, the `-strong` member is text on a
  tint of that fill. Not interchangeable — the base measures 2.62:1 as text on its own 15%
  tint for warning, 3.98–4.17:1 for the others.
- `Button` has no `asChild`. A link styled as a button is
  `<Link className={cn(buttonVariants({ variant, size }))}>`.
- A component is not done until its specimen renders at `/design-system`;
  `components/showcase/registry.test.ts` fails if one is missing. The converse holds too: a
  primitive whose only consumer is the showcase is DELETED, not maintained for the showcase's
  sake — `components/ui/orphan.test.ts` walks the import closure from the product surface and
  fails on one (T-036 deleted eight).

### Boundaries worth knowing before reaching for the wrong one

- **`Alert` vs `Callout`.** `Alert` reports SYSTEM STATE and resolves `role="alert"`/`"status"`
  for that reason. `Callout` is an editorial aside and carries NO role — typesetting a
  pedagogical note as an Alert interrupts assistive technology for something that is not an
  event. `FormErrorSummary` does carry `role="alert"`: a failed submission genuinely is one.
  **The visual rule follows the semantic one, and is structural rather than cosmetic: Alert
  HAS a box** — the whole surface tinted, body text included — **and Callout has none**, just a
  rule above it, the text's own colour, and its variant in the icon. Two earlier rounds tried
  to separate them by adding decoration to Callout (a side-tab, then a hairline plus a tint)
  and left them 2px of radius apart. Do not re-add a fill; `patterns-contract.test.ts` fails
  if you do.
- **`MetricValue.absent` is required.** There is no safe default. It never renders `0` and
  never a bare dash — a dash sits in the same slot a number would and reads as a measurement.
  This is T-024's defect made impossible rather than re-fixed per page.
- **`MapLegend` requires `bins` on the classed variant**, so an unlabelled classed legend
  cannot be built (data-viz rule 5 below).
- **`MapAttribution` beside every map** is ODbL compliance, not house style.
- **`Separator` takes `decorative`** for a rule that carries no meaning; Base UI announces
  every separator otherwise.

### Known warts

- `Button`'s `emerald`, `sky`, `teal` and `amber` are colour-named variants in an otherwise
  semantic set. This used to say "34 files call them, so renaming is its own change"; the real
  count is **three calls in two files** (`v2-tools-hub.tsx` ×2, `v2-tool-workbench.tsx` ×1), and
  `teal` and `amber` have no callers at all. The variants are already token-bound internally
  (`bg-secondary` / `bg-info` / `bg-accent` / `bg-warning`), so renaming them is cheap — the
  reason to leave them alone was a number that was never checked.
- `--chart-*` and `--sidebar-*` remain shadcn's achromatic stock. Nothing reads them.
- Row selection and multi-select were dropped from the T-034 scope: measured, zero consumers.
  Add them when one appears.
- Fully clickable card: wrap the whole card in one `Link` (one target, one accessible name), or
  end the card in a real CTA button inside a `Link` — which is what the tool hub does. The
  `::after` stretched-link trick is GONE (T-032 PR4 deleted `araclar/tools.module.css` with the
  V1 page): an invisible edge-to-edge pseudo-element is a click target nobody can see, and its
  focus ring had to be hand-scoped with `:has()` to avoid the `:focus-within` defect this repo
  already paid for once. Do not bring it back as a third variant.
- Map hover/selection chrome uses `--province-*`, `--map-*`, `--game-*` tokens.

## Data-viz colour doctrine (a correctness rule, not taste)

1. Brand ≠ data. Terra chrome tokens never encode values.
2. No rainbow / jet ramps. Perceptually uniform only.
3. Colourblind-safe by construction; reinforce hue with lightness, shape, label or pattern.
   Simulate deuteranopia / protanopia / tritanopia before shipping a new palette.
4. Scale type matches data type: sequential → monotonic-lightness ramp (`--map-1..6`,
   pale green → brown, hypsometric); diverging → two hues with neutral centre; categorical →
   qualitative set ≤ 8 (Okabe-Ito).
5. Classed maps state their breaks; legend always present; ≥ 3:1 between adjacent classes
   and against labels.

Public-safety scales stay **standard**, never restyled to Terra: AQI (EPA/EEA bands),
earthquake intensity (USGS MMI), SST and similar geophysical ramps. Conversely, do not paint
an AQI band on a value the authority does not band (annual-mean PM2.5 has no band).

Shipped data token sets (all in `:root`, separate from chrome):

| Set                  | Tokens                                                                | Used by                                                      |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Climate chart        | `--chart-temp-line` #c2410c, `--chart-precip-bar` #1b5f8a             | `components/climate/` (shape carries meaning: line vs bars)  |
| PM2.5                | `--chart-pm25-line` #4a3b6b                                           | `components/air/` (single series; no band, no WHO line)      |
| Regions              | `--region-marmara` … `--region-guneydogu-anadolu` (Okabe-Ito, 7 of 8) | game region mode, `/turkiye/bolge/[slug]`                    |
| Earthquake magnitude | `--eq-mag-1..5` (purple ramp)                                         | earthquake lists/maps                                        |
| Game states          | `--game-correct`, `--game-wrong`, `--game-reveal` + `*-edge`          | `components/game/` (stroke pattern + glyph reinforce colour) |
| Hypsometric          | `--map-1..6`                                                          | reserved for elevation choropleths                           |

A new chart adds only the tokens it needs, next to these, and records why the choice
satisfies the five rules. A general scales module is deliberately unbuilt.

## Review ritual for visible changes

Before calling a UI task done: light and dark screenshots at 390 px and desktop, no
horizontal scroll at 320 px, focus ring visible on every new control, contrast checked on
the real surface colour, and the affected `*.structure.test.tsx` updated.
