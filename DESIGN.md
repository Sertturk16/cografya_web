# DESIGN — Terra design system + data-viz color doctrine (`cografya_web`)

> **Authority & scope.** This is the single source of truth for the platform's visual
> identity and the **binding color doctrine** for data visualization. The locked identity
> is **Direction B "Terra"** (→ DEC 2026-07-07). The **owner is the design authority**:
> every user-visible change ships with **rendered samples (screenshots/preview) before AND
> after merge** for the owner to eyeball — nothing visible merges unseen.
>
> **Doc now, code Faz-2** (→ DEC 2026-07-08). This document ships the _doctrine_. The data
> scales / map-color module is **not** built in this repo yet — it lands in Faz-2 when the
> maps and live feeds arrive. The token layer this doc describes already exists in
> `app/globals.css`; do not duplicate hex values anywhere else.
>
> Binding companions: `ENGINEERING.md` (§4 SEO, §5 a11y floor), `CONVENTIONS.md` §6.

---

## 1. Terra identity — what it is

Earth / topographic. Warm terracotta primary, olive secondary, water-teal accent, on a
warm-stone parchment neutral field. Serif display (Fraunces) over a humanist sans body
(Nunito Sans). The feel is authoritative, natural-science, calm — not "edtech neon."

**The one hard identity rule that governs everything below: brand chrome ≠ data.** Terra's
warm palette is for UI _chrome_ (header/footer/buttons/links/cards). It must **never** be
the palette used to encode _data values_ on maps/charts (§6). This separation is a
correctness boundary, not a preference.

## 2. Color tokens (source: `app/globals.css` `:root` — reference `var(--token)` only)

**Brand**

| Token                  | Hex       | Use                                           |
| ---------------------- | --------- | --------------------------------------------- |
| `--color-primary`      | `#b0522e` | terracotta — primary buttons, active brand    |
| `--color-primary-dark` | `#7e3a1e` | links, hover, headings emphasis, skip-link bg |
| `--color-secondary`    | `#4f6d30` | olive — secondary brand accents               |
| `--color-accent`       | `#276b70` | water-teal — focus ring, info                 |
| `--color-on-primary`   | `#ffffff` | text/marks on brand fills                     |

**Warm-stone neutrals**

| Token             | Hex       | Use                                                       |
| ----------------- | --------- | --------------------------------------------------------- |
| `--color-ink`     | `#2b2622` | body text, headings                                       |
| `--color-slate`   | `#57504a` | secondary/essential text (lede, nav, footer, captions)    |
| `--color-taupe`   | `#8a8078` | **placeholder / secondary-UI / decorative ONLY** (see §5) |
| `--color-border`  | `#ddd5cc` | hairlines, card borders                                   |
| `--color-surface` | `#f1e9de` | raised surfaces, hero band                                |
| `--color-bg`      | `#fbf8f3` | parchment page background                                 |

**Chips / semantic**

| Token                                  | Hex                   | Use                                         |
| -------------------------------------- | --------------------- | ------------------------------------------- |
| `--color-chip-bg` / `--color-chip-ink` | `#ede3d5` / `#7e3a1e` | pill chips                                  |
| `--color-success`                      | `#496f35`             | success (AA on every Terra bg — see §5)     |
| `--color-warning`                      | `#c9860f`             | warning (e.g. placeholder-note left border) |
| `--color-danger`                       | `#b23b2e`             | error/destructive                           |
| `--color-info`                         | `#276b70`             | info (= accent)                             |

**Hypsometric map ramp** (`--map-1 … --map-6`, `#e8efce → #6e3a1c`) — reserved for
elevation/choropleth data; **Faz-2 code**. See §6 for why it is a green→brown _sequential_
ramp and not the Terra brand hues.

**Layout tokens:** `--container-max: 1120px`, `--radius: 10px`, `--radius-lg: 16px`.

## 3. Typography

- **Display / headings:** Fraunces (variable serif) → `--font-heading`. **Body / UI:**
  Nunito Sans (variable sans) → `--font-body`. Loaded via `next/font` (`lib/fonts.ts`),
  self-hosted + preloaded, `latin` + **`latin-ext`** (Turkish glyphs İ ı ğ ş ç ö ü) — never
  a render-blocking Google Fonts `<link>` (CWV, `ENGINEERING.md` §4 #9).
- **Scale** (fluid `clamp`): `h1` `clamp(1.9rem, 1.2rem+2.6vw, 2.6rem)`/700 · `h2`
  `clamp(1.4rem, 1rem+1.4vw, 1.8rem)`/600 (primary-dark) · body `16px`/`1.6` · `.lede`
  `1.15rem` slate. Headings: `line-height 1.15`, `letter-spacing -0.01em`. One `h1` per
  page, headings in document order (a11y + SEO).

## 4. Spacing, layout & components

- **Rhythm:** page padding `40px 56px` (`.page`); section gap `40px` (`.section`); container
  `max 1120px`, inline padding `20px`. Radii: `10px` controls, `16px` cards/hero.
- **Components (all in `app/globals.css` / CSS Modules):** `.btn` (`.btn-primary` filled
  terracotta, `.btn-ghost` bordered), `.card`, `.hero` (surface→bg gradient), `.chip`,
  `.province-card` grid, `.breadcrumb` (visual, pairs with `BreadcrumbList` JSON-LD),
  `.placeholder-note` (dev-content flag, warning left-border). Component styling uses CSS
  Modules + the global token layer — **no hardcoded brand hex outside the token layer.**
- **One breakpoint: `64rem` (1024px).** Below it the header is a single compact row (brand +
  icon-only search trigger + hamburger) with the nav in a disclosure panel; from it up the nav
  is inline and the search trigger gains its text label. The number is chosen, not measured
  from the nav alone: the header collapses to one row at **850px in Turkish and 773px in
  English** (binary-searched on the running build), and a breakpoint must be
  locale-independent, so it sits above the later of the two — and on the value the repo
  already used. Do not add a second breakpoint without a measurement in both locales.
- **The single-row header is ENFORCED, and the wordmark is what gives way.** `.inner` is
  `flex-wrap: nowrap` below 64rem; the brand link is the one item allowed to shrink
  (`min-width: 0`) and its wordmark truncates with an ellipsis. Moving the nav out of the row
  was not sufficient on its own: the remaining three items need **351.5px** of viewport to sit
  whole, so between 320 and 351.5px the row still wrapped to 93.7px and `--header-height` —
  read by three anchor offsets and the game's viewport math — under-reported by 37.7px
  (PR #56 review FENER-I1). **320px and 360px are mandatory test viewports for any header
  change**, 320px because it is WCAG 1.4.10's reference width (and what 400% desktop zoom
  produces), 360px because a layout that fits at 390px can still break there.
- **Brand mark:** single-sourced neutral globe in `lib/brand/glyph.ts`; `app/icon.svg`
  mirrors it by hand (a static file can't import) — keep the two in step. Still a
  placeholder pending the brand/logo decision (K7).

## 5. Accessibility (WCAG 2.1 AA — binding; see `ENGINEERING.md` §5)

- **Skip-to-content link** (`.skip-link`) whose target `<main>` is programmatically
  focusable (`tabIndex={-1}` — Safari/VoiceOver need it).
- **Visible focus everywhere:** `:focus-visible` = `3px` accent (`#276b70`) outline,
  `2px` offset. Never remove focus without a compliant replacement. **One sanctioned
  exception** (→ ruling 2026-08-05): `:where([tabindex="-1"]):focus-visible` draws no ring —
  such an element is outside the sequential focus order, so Tab never lands on it and the ring
  can only outline the page-sized region the code jumped to (`<main>` after the skip link, a
  fragment section, the error `<h1>`). A module rule may still opt back in at (0,2,0), as the
  game does.
- **Touch targets: WCAG 2.2 §2.5.8 (AA) 24×24 CSS px is the floor**, and the header's own
  controls sit right on it for a measured reason — the search trigger and the hamburger are
  28×28 because anything taller than the brand link's 30.72px line box makes the header grow
  (`site-search.module.css` / `site-nav.module.css`). Controls with room to be generous take
  §2.5.5 (AAA) 44×44 instead: the disclosure panel's nav rows are 45.6px. **The one sanctioned
  exception is map geography.** A province shape is covered by 2.5.8's "Essential" clause —
  its presentation is required by the information it conveys, and enlarging Yalova to 24px
  stops it being Yalova — so map targets are not measured against this floor; the remedy for a
  small province is zoom, not a bigger shape.
- **`prefers-reduced-motion: reduce`** disables transitions / smooth-scroll globally.
- **State changes announce to AT** (WCAG 4.1.3): error boundaries move focus to the error
  heading (`tabIndex={-1}` + `focus()`); last-resort boundaries use `role="alert"`.
- **Contrast — verified AA/AAA table** (WCAG 2.x sRGB; foreground on the real background):

  | Pair                                              | Ratio       | Verdict                       |
  | ------------------------------------------------- | ----------- | ----------------------------- |
  | ink `#2b2622` on bg `#fbf8f3`                     | **14.13:1** | AAA                           |
  | ink on surface `#f1e9de`                          | 12.44:1     | AAA                           |
  | slate `#57504a` on bg                             | 7.48:1      | AAA                           |
  | slate on white                                    | 7.92:1      | AAA                           |
  | slate on surface                                  | 6.58:1      | AA (AAA large)                |
  | primary-dark `#7e3a1e` link on bg                 | 7.89:1      | AAA                           |
  | on-primary `#fff` on primary `#b0522e` (button)   | 5.13:1      | AA                            |
  | on-primary on primary-dark `#7e3a1e` (hover/skip) | 8.36:1      | AAA                           |
  | chip-ink on chip-bg                               | 6.59:1      | AA (AAA large)                |
  | success `#496f35` on surface `#f1e9de`            | 4.84:1      | AA                            |
  | success on bg                                     | 5.49:1      | AA                            |
  | danger `#b23b2e` on surface                       | 4.90:1      | AA                            |
  | **taupe `#8a8078` on white**                      | **3.86:1**  | **SUB-AA — placeholder only** |
  | **taupe on surface `#f1e9de`**                    | **3.21:1**  | **SUB-AA — placeholder only** |

  **The semantic-colour rule (hard, → PR #27):** a semantic text colour must clear 4.5:1 on
  **`--color-surface`**, the darkest Terra background — not merely on `--color-bg`. A token
  that passes on one panel and fails on the next is the taupe trap in a new colour, and it
  is invisible in review because both panels look the same in a screenshot. `--color-success`
  was `#4f7a3a` (4.18:1 on surface, 4.75:1 on bg) until the game HUD became its first real
  consumer; the token itself moved to `#496f35` rather than a scoped darker variant being
  added next to it, so there is no wrong choice left to make.

  **The taupe rule (hard):** `--color-taupe` is **decorative / placeholder / secondary-UI
  ONLY** — never body, nav, footer, or any essential text. Use `--color-slate` for
  essential secondary text. (PR#2 caught taupe in the live locale switcher at 3.86:1 and the
  footer at 3.21:1 — both moved to slate.) A purely decorative taupe mark (e.g. the
  breadcrumb `::after "/"` separator) is exempt under WCAG 1.4.3.

- Never encode meaning by color alone — pair with text/icon/pattern (ties into §6).

## 6. Data-viz color doctrine (A4 — a correctness boundary, treated like SEO)

Doctrine now; **map/chart color code is Faz-2** (no scales module in this repo yet). When
maps and live feeds arrive, data color MUST follow these rules. Violating them is a
correctness bug, not a style nit.

### 6.1 The five hard rules

1. **Brand ≠ data.** Terra chrome tokens (`--color-primary/secondary/accent`, neutrals)
   **never** encode data values. Reserve dedicated data ramps (below). This is the
   carried-forward mitigation from DEC 2026-07-07: Terra's warm chrome would otherwise
   collide with warm choropleth data — keep them physically separate token sets.
2. **No rainbow / jet.** The rainbow (and MATLAB "jet") scheme is **banned** for continuous
   data: it is not perceptually uniform (invents false boundaries, hides real ones) and is
   not colorblind-safe. Use perceptually-uniform ramps only.
3. **Colorblind-safe by construction.** Choose schemes that survive deuteranopia/
   protanopia/tritanopia (the ColorBrewer "colorblind safe" sets, or viridis-family for
   continuous). Verify with a simulator before shipping. **Never rely on hue alone** —
   reinforce with lightness, and add text/pattern/labels for categorical distinctions.
4. **Match the scale type to the data type.**
   - **Sequential** (ordered low→high: elevation, population density, temperature) →
     single-hue or multi-hue **monotonic-lightness** ramp. Elevation uses the **hypsometric
     ramp** `--map-1…--map-6` (pale green lowlands → tan → brown highlands) — a
     cartographic convention readers already decode, and deliberately NOT the brand hues.
   - **Diverging** (meaningful midpoint: anomaly vs a mean, +/− change) → two-hue diverging
     ramp with a neutral center; pick a colorblind-safe pair (avoid raw red–green).
   - **Categorical** (unordered classes: climate zones, region types) → a qualitative,
     colorblind-safe, limited (≤ ~8) set; distinguish further with labels/patterns.
5. **Legibility of the encoding:** classed choropleths state their class breaks; sufficient
   contrast between adjacent classes and against basemap/labels; a legend always present.

### 6.2 Public-safety semantic colors stay STANDARD — never recolored to Terra (HARD)

Some color scales are **externally standardized public-safety conventions**. They are
**reproduced exactly as their authorities define them** and are **never** restyled into the
Terra palette — recoloring them would misinform users:

- **Air quality index (AQI)** — EPA / EEA official band colors (green→maroon). Standard.
- **Earthquake intensity** — USGS MMI / ShakeMap intensity scale colors. Standard.
- **Sea-surface temperature (SST)** and comparable geophysical scales — their conventional
  scientific ramps. Standard.

Only **brand / chrome** tokens are Terra. The rule is explicit and non-negotiable: _if a
color carries a public-safety meaning the user must read correctly, it is not ours to
rebrand._ (→ DEC 2026-07-08.)

### 6.3 Faz-2 note

When the scales module is built (Faz-2, with maps/feeds): implement the ramps above as a
typed `lib` module (one place, tested), keep the brand token set and the data ramp set
physically separate, and add a colorblind-simulation check to the review pass. No such code
ships in PR-3 — this section is the specification it must satisfy.

### 6.4 Climate chart data ramps (İklim grafiği — W1, shipped)

The province climate chart (`components/climate/climate-chart.tsx`) is the first shipped
data-viz surface, so it is the first concrete application of §6.1. It defines **exactly two**
data token sets in `app/globals.css`, physically separate from the Terra chrome tokens
(§6.1 rule 1 — brand ≠ data) and used **only** by the chart. A full scales module remains
Faz-2 (§6.3); these two ramps are the minimum this one chart needs, deliberately not a
general system (that would be scope creep).

| Token                | Hex       | Encodes                                   |
| -------------------- | --------- | ----------------------------------------- |
| `--chart-temp-line`  | `#c2410c` | mean-temperature polyline + point markers |
| `--chart-precip-bar` | `#1b5f8a` | precipitation columns                     |

> **Retired with the MGM series (api #87 / DEC 2026-08-01o).** `--chart-temp-band`
> (`#f2cfa8`) and `--chart-temp-band-edge` (`#c9762f`) encoded the monthly mean-max/mean-min
> band and **no longer exist** in `app/globals.css`. ERA5-Land publishes only the core pair
> (mean temperature + total precipitation), so there is no envelope to draw. They are recorded
> here as retired rather than silently deleted: writing `var(--chart-temp-band)` against an
> undefined custom property does not error — it falls back to black and passes every check
> this repo runs.

**Why these choices are §6-compliant:**

- **Warm temperature, cool precipitation** — the universal climograph convention, and the
  orange/blue pairing is the classic colorblind-safe categorical split (survives
  deuteranopia via lightness). Temperature here is a single line series, so this is a
  **categorical** distinction (temp vs precipitation), not a sequential ramp — §6.1 rule 4.
- **Shape carries the meaning, never hue alone** (§6.1 rule 3 / §5 last bullet): the two
  series are distinguished by SHAPE first — `<rect>` bars vs a bold `<polyline>` — with color
  only reinforcing. The deuteranopia simulation run before the W1 ship covered three series
  (bars, line, band) and found all three distinct with color removed; dropping the band left
  the two most distinct shapes, so that verification still holds a fortiori — but it was run
  against the three-series chart, and this note says so rather than implying a fresh check.
- **Not brand tokens.** `--chart-temp-line` is a saturated vermillion, distinct from the
  muted terracotta chrome (`--color-primary #b0522e`); `--chart-precip-bar` is a clear blue,
  distinct from the greenish brand accent (`--color-accent #276b70`). Separate token set,
  separate hues.
- **Contrast (WCAG 1.4.11, graphical objects ≥ 3:1 on the white plot):**
  `--chart-temp-line` = **5.18:1**, `--chart-precip-bar` = **6.88:1** — both clear the floor.
  Every drawn series now clears it on its own; the one element that relied on the
  "supplementary" allowance (the band fill) is gone.
- **Not a public-safety scale** (§6.2) — climate normals carry no AQI/earthquake/SST
  standardized-color obligation, so the palette is ours to set within these rules.

### 6.5 Region palette — the game's Bölge Bulma map (Kâşif, shipped)

The second data-viz surface, and the first **categorical** one: in the game's region mode
(`/oyun/bolge-bulma`) the map is filled by coğrafi bölge, which is a nominal variable with
seven values. Tokens live in `app/globals.css`, physically separate from the Terra chrome
set (§6.1 rule 1) and read only by `components/game/game-map.module.css`.

| Token                        | Hex       | Region            |
| ---------------------------- | --------- | ----------------- |
| `--region-marmara`           | `#0072b2` | Marmara           |
| `--region-ege`               | `#e69f00` | Ege               |
| `--region-akdeniz`           | `#56b4e9` | Akdeniz           |
| `--region-ic-anadolu`        | `#f0e442` | İç Anadolu        |
| `--region-karadeniz`         | `#cc79a7` | Karadeniz         |
| `--region-dogu-anadolu`      | `#009e73` | Doğu Anadolu      |
| `--region-guneydogu-anadolu` | `#d55e00` | Güneydoğu Anadolu |

**Why these choices are §6-compliant:**

- **Okabe–Ito**, the published colorblind-safe qualitative palette, used unmodified. §6.1
  rule 4 asks for a qualitative set of ≤ ~8 for categorical data; this is seven of its eight
  members, so the set is at its designed size rather than stretched.
- **Not a ramp.** Bölge has no order, so a sequential or diverging scale would encode a
  ranking that does not exist. Hue-only separation is the correct encoding here — the
  opposite of §6.4's climate ramps, and for the opposite reason.
- **Not brand tokens.** None of the seven appears in the Terra chrome set; the map's own
  chrome (`--province-fill`, `--province-stroke`) is untouched, so a region fill can never be
  confused with a UI state.
- **Colour is not the only signal** (§6.1 rule 3). Province BOUNDARIES stay drawn inside a
  region, so the groups are readable as shapes; and the three answer states that sit on top
  of the tint each carry a distinct **stroke treatment** — solid / dotted / dashed — plus a
  ✓ / ✕ / ▸ glyph and the same statement in words in the live region above the map.
- **Never a public-safety scale** (§6.2) — regions carry no standardized-colour obligation.
- **Where it is NOT used:** the 81-province mode and the per-region rounds draw one neutral
  fill. Tinting by region there would hand the player the answer, which is the product
  reason; the doctrine reason is the same one — colour must encode the variable under
  discussion, and in those modes that variable is not the region.

## Kim neyi okur — kapsam sözleşmesi

This table is the sole owner of this document's read scope. A role definition never
restates that scope — it carries only the anchor id in the last column, and
`Team/scripts/read-contract-lint.sh` (run by the orchestration root's `pre-commit` hook
through `governance-lint.sh`) verifies that each id still stands in every definition file
named beside it. The doctrine itself lives in §§1–6 above; this table says only who reads
which of them, and when (→ DEC 2026-08-07a).

<!-- read-contract -->

| Rol      | Okur                                                                                               | Ne zaman                                                                                                                                        | Tanım dosyası                                                                        | Anchor               |
| -------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------- |
| **Vera** | §2 colour tokens · §3 typography · §4 spacing/components · §5 accessibility · §6 data-viz doctrine | Every visible UI change, before the component is written — in addition to, never instead of, the rendered-sample obligation in the header above | `.claude/agents/cografya-frontend-dev.md` `.codex/agents/cografya_frontend_dev.toml` | `READ-DESIGN-VISUAL` |

<!-- /read-contract -->

The owner is the design authority and reads rendered samples, not this file; that gate is
held by a person, so it carries no anchor.
