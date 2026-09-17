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
- Fluid scale in V1 globals: h1 `clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem)`, h2
  `clamp(1.4rem, 1rem + 1.4vw, 1.8rem)`. In V2 use Tailwind sizes but keep the same
  hierarchy: one `h1` per page, headings in document order.

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
- Not yet themed, and known: the categorical accent system in 34 V2 files (T-031c) and map
  surfaces (T-031d). `--chart-*` and `--sidebar-*` remain shadcn's achromatic stock; nothing
  reads them.
- The showcase at `/design-system` shows every component in both themes side by side. A
  component is not done until its specimen renders there, and
  `components/showcase/registry.test.ts` fails if one is missing.

## Accessibility floor (WCAG 2.1 AA)

- Focus visible everywhere: `:focus-visible` = 3px `--color-accent` outline, 2px offset.
  Never remove without a compliant replacement. Elements with `tabindex="-1"` are exempt.
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

## Components (V2)

- `components/ui/button.tsx`: `cva`, renders a real `<button>`, no `asChild`. Variants
  `default | primary | secondary | emerald | sky | teal | amber | outline | ghost |
destructive | link`; sizes `sm | md | default | lg | icon | icon-sm | icon-lg`; props
  `isLoading`, `leftIcon`, `rightIcon`. Button-styled link:
  `<Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>`.
- Primitives on Base UI: accordion, alert, avatar, badge, card, checkbox, dialog,
  dropdown-menu, input, label, select, sheet, skeleton, sonner, switch, table, tabs,
  textarea. Add new ones with the shadcn CLI (`base-nova` style) and fix the token bridge
  if the generated file introduces raw oklch values.
- Fully clickable card: wrap the whole card in one `Link` (one target, one accessible
  name). The `::after` stretched-link trick exists only in V1 `/araclar`; do not add a
  third variant.
- Map hover/selection chrome uses `--province-*`, `--map-*`, `--game-*` tokens.
  Attribution ("© OpenStreetMap katkıcıları, ODbL") renders beside every map.

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
| Regions              | `--region-marmara` … `--region-guneydogu-anadolu` (Okabe-Ito, 7 of 8) | game region mode, `v2/turkiye/bolge/[slug]`                  |
| Earthquake magnitude | `--eq-mag-1..5` (purple ramp)                                         | earthquake lists/maps                                        |
| Game states          | `--game-correct`, `--game-wrong`, `--game-reveal` + `*-edge`          | `components/game/` (stroke pattern + glyph reinforce colour) |
| Hypsometric          | `--map-1..6`                                                          | reserved for elevation choropleths                           |

A new chart adds only the tokens it needs, next to these, and records why the choice
satisfies the five rules. A general scales module is deliberately unbuilt.

## Review ritual for visible changes

Before calling a UI task done: light and dark screenshots at 390 px and desktop, no
horizontal scroll at 320 px, focus ring visible on every new control, contrast checked on
the real surface colour, and the affected `*.structure.test.tsx` updated.
