import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectArbitraryColorOccurrences,
  collectInlineColorOccurrences,
  inlinesAColor,
  collectPaletteOccurrences,
  EXCLUDED,
  hexOf,
  INLINE_EXEMPT,
  isInlineExempt,
  RAW_PALETTE,
} from "../../scripts/palette-inventory.mjs";

/**
 * Raw Tailwind palette classes still in the product tree.
 *
 * ## Why a number and not just the escape rule
 *
 * `token-binding.test.ts` has enforced "no raw palette class" on a narrow surface for a long
 * time while this count moved 749 -> 895 -> 865 with nobody noticing, because it lived in a
 * comment. A comment is not a guard. This goes to 0; every step down is a commit.
 *
 * ## The one exclusion
 *
 * `turkiye/[slug]/page.tsx` belongs to T-033, which rewrites its climate markup wholesale.
 * Listing it here rather than silently skipping it is deliberate: when T-033 merges, this
 * test fails on the exclusion being stale, which is the reminder to delete it.
 *
 * ## The last step, and what it bought
 *
 * 740 -> 568 was T-031c Task 5, the continent palette: `lib/map/continent-theme.ts` 112 -> 0,
 * `components/v2/v2-world-continents.tsx` 55 -> 0, `dunya/kita/[slug]/page.tsx` 3 -> 0 and
 * `dunya/kita/page.tsx` 2 -> 0, all four bound to `--continent-*` through
 * `lib/theme/continent-identity.ts`.
 *
 * 568 -> 438 is T-031c Task 6, the marine cluster, and it clears FIVE files at once because a
 * basin's colour was spelled in four of them and the fifth painted a sea it never named:
 * `components/v2/v2-marine-map-explorer.tsx` 61 -> 0, `deniz/kiyi-tipleri/page.tsx` 24 -> 0,
 * `components/v2/v2-marine-basin-cards.tsx` 21 -> 0, `lib/marine/sea-basins-detail.ts` 16 -> 0,
 * and 8 of `turkiye/bolge/[slug]/page.tsx`'s (57 -> 49) — its four per-sea chips, which were
 * one cyan for four different seas, plus the coastal-count badge above them, which named no sea
 * at all. 80 of the 130 are the `--basin-*` rows the inventory derived; 12 are `--sst-band-*`;
 * the rest are the decoration and warning rows on the same lines.
 *
 * The arbitrary-colour arm moved for the first time on this branch: 75 -> 72, and all three
 * are the marine map's temperature LEGEND (`bg-[#ea580c]`, `bg-[#0d9488]`, `bg-[#2563eb]`),
 * now a `bg-[...]` arbitrary value wrapping the band token. That legend was the SST ramp's
 * THIRD spelling in one file —
 * after the SVG pins and the table chips — and the one a reader actually uses to decode the
 * map, so it could have gone on describing a scale the pins no longer painted.
 *
 * A FALL here alongside a fall in the first arm is the good case; the failure this pairing
 * exists to catch is a fall in one WITH A RISE in the other. Two things that could have
 * produced such a rise did not: the three raw SVG pin hexes this task deleted were never
 * counted here (a bare hex in a TS string is not a bracketed class), and the three
 * `var(--sst-band-*, #hex)` fallbacks it added in their place are not either (a `var()`
 * fallback is stripped before the arm counts). Those fallbacks are pinned instead by
 * `components/ui/token-binding.test.ts`, in both directions.
 *
 * 438 -> 352 is T-031c Task 7, the earthquake cluster, and it clears four files:
 * `lib/earthquake/fault-lines-data.ts` 24 -> 0, `components/v2/v2-earthquake-explorer.tsx`
 * 21 -> 0, `deprem/page.tsx` 21 -> 0 and `deprem/fay-hatlari/page.tsx` 20 -> 0. 48 of the 86
 * are the `--fault-*` rows the inventory derived, 17 are the magnitude ramp binding to the
 * `--eq-mag-*` set that already existed, 9 are class names quoted inside one explanatory
 * comment (the literal spelling goes, the ruling stays), and the rest are semantic rows on the
 * same lines.
 *
 * `fault-lines-data.ts` is the file that made `lib/` a root in the first place: the hue lived
 * in `lib/`, invisible to a counter that walked only `components/` and `app/`, so the call
 * sites could have reached zero while the definition went on shipping the palette. Its 24 move
 * in the same commit as the 41 that spend them.
 *
 * The arbitrary arm does NOT move on this task — 72 before, 72 after — and that is the
 * interesting half. The explorer's marker ripple carried FOUR raw hexes in an SVG `stroke`
 * prop, a second spelling of the magnitude ramp that neither arm could see (a bare hex in a
 * prop is not a bracketed class), and they are gone without either number noticing. Nothing
 * replaced them with a fallback, because the ripple carries its step as a bracketed stroke
 * utility around the token now rather than as an SVG attribute, so no new entry joins the
 * `token-binding.test.ts` fallback census either.
 *
 * WRITING THAT SENTENCE THE OBVIOUS WAY 500'D EVERY ROUTE, for the second time on this branch.
 * The first draft spelled the utility out, with an ellipsis where the token name goes. Tailwind
 * scans source TEXT, so it compiled the prose into a real rule whose declaration read that
 * ellipsis verbatim, PostCSS failed on the delimiter, and `app/globals.css` stopped compiling
 * entirely. Typecheck, lint and 5599 tests stayed green throughout. The guard in
 * `components/ui/token-binding.test.ts` was widened in the same commit: it used to catch only a
 * `*` inside the token name, and now catches any bracketed utility whose `var()` argument is
 * not a custom-property name at all.
 *
 * A FALL here alongside a fall in the first arm is the good case; the failure this pairing
 * exists to catch is a fall in one WITH A RISE in the other.
 *
 * 352 -> 301 is T-031c Task 8's first half: `dunya/[slug]/page.tsx` 51 -> 0, and it is the first
 * file on this branch with NO data row in it at all — 22 semantic, 29 decoration, zero identity.
 * The whole file is chrome. The 22 are one flag with three spellings (a hero chip, a card at
 * section scale, and the same chip again on two neighbour branches) plus its affirmative twin,
 * all four now on the warning/success bridge pair; the 29 are topic tints and metric-tile icons
 * that name nothing, removed rather than re-tokenised.
 *
 * The neighbour chips are where the measurement mattered. They sit on a link whose REST surface
 * is the card and whose HOVER surface is a 60% muted wash over the page background, and only the
 * hovered state is close: 5.19 light and 7.06 dark against 5.87 / 7.36 at rest. Measuring the
 * rest state alone would have reported a figure the reader never sees while pointing at the row.
 *
 * The arbitrary arm does not move: 72 before, 72 after. Nothing here was rewritten as a literal,
 * and nothing gained a var() fallback.
 *
 * 301 -> 252 is T-031c Task 8's second half: `turkiye/bolge/[slug]/page.tsx` 49 -> 0, and with
 * it the heaviest file in the inventory reaches zero. Its other 64 went earlier -- 56 to
 * `--region-*` in Task 3 and 8 to `--basin-*` in Task 6 -- so what was left here is the part
 * that never encoded anything: 36 decoration, 13 semantic, no data.
 *
 * The 13 are the disaster-risk section, which is the one place on this page where the hue is
 * the message. It binds to the destructive bridge, NOT to a fault identity: the prose is
 * regional hazard, it names no fault zone, and `--fault-*` is a categorical set for KAF / DAF /
 * BAFS. Its hand-written dark pair goes with it, including a dark-only 950-weight background
 * wash that existed because the light tint underneath it was never theme-aware.
 *
 * The 36 are three topic-tint pillar badges with their heading icons, two elevation/economy
 * callouts whose surfaces were a mood rather than a scale, and five metric-tile icons. The two
 * callouts take the neutral surfaces this page already uses for the same job one section over,
 * rather than a second tint: a 30% muted panel for the banner that sits beside three of them,
 * and the card surface for the one nested inside a muted panel.
 *
 * The arbitrary arm does not move: 72 before, 72 after.
 *
 * 252 -> 237 is T-031c Task 9's first file: `components/v2/v2-world-stats-spotlight.tsx`
 * 15 -> 0, all fifteen decoration, all removed rather than re-tokenised. Five superlative rows
 * -- highest point, deepest trench, lowest land, hottest and coldest record -- each wore its own
 * hue on a glyph and again on the reading beside it, and each row already names itself in full
 * next to a distinct glyph. No scale, no map and no chart reads any of the five.
 *
 * THE BACKDROP IS THE ROW PANEL, NOT THE CARD. All five rows sit inside a 40% muted panel over
 * `--card`, which resolves to #f9f6f2 light and #162327 dark. Measured against that panel the
 * readings were 2.96 (amber-600), 3.42 (cyan-600), 3.48 (teal-600), 4.48 (red-600) and 4.80
 * (blue-600) in light -- four of the five under the 4.5:1 floor -- and the five icon tints were
 * 1.99 to 3.49, three of them under even the 3:1 graphical floor. Inheriting `--foreground`
 * instead measures 13.89 light and 13.93 dark on the same panel. The readings deleted their
 * `dark:` pairs; the icons never had one, so their light figures were what dark rendered too.
 *
 * The arbitrary arm does not move: 72 before, 72 after.
 *
 * 237 -> 221 is T-031c Task 9's second file: `components/v2/v2-tool-workbench.tsx` 16 -> 0.
 * The inventory calls all sixteen semantic and it is right about fourteen of them: the
 * self-intersection toast that floats over the measuring map, the caution strip that repeats
 * the same warning in the results column, and the save confirmation. Their backdrops, named:
 * the toast is its own opaque surface, now a solid `--warning` carrying `--warning-foreground`
 * at 5.54 light and 7.46 dark; the strip is a 10% warning tint over `--card` (#faf3e7 light,
 * #262b24 dark) carrying `--warning-strong` at 6.18 and 8.18; the strip's escape button sets
 * its own `--background` fill, where the same token measures 6.43 and 10.56; the save
 * confirmation is bare `--card`, 7.50 light and 8.78 dark against 3.77 for the raw emerald it
 * replaces.
 *
 * TWO ROWS WERE CORRECTED BEFORE THEY WERE APPLIED, both by naming the surface.
 *
 * The two `Check` glyphs are NOT `text-success-strong`. They sit inside a filled
 * `variant="secondary"` button, so their backdrop is `--secondary`, and that token measures
 * 1.27 light / 1.62 dark against it -- a different failure from the 1.56 / 1.20 the raw
 * emerald was already scoring, not a fix. The glyph inherits `--secondary-foreground` instead
 * (5.89 / 5.37), and the "copied" state keeps both non-colour carriers it always had: the
 * glyph swaps from Copy to Check and the label swaps to "Kopyalandi!".
 *
 * The toast's action pill is an INVERSION, not an opaque card chip, and the hovered state is
 * why. On a solid `--warning` panel a `--card` pill separates by 3.04:1 at rest but only
 * **2.53:1** once it hovers to `--muted`, under the 3:1 graphical floor -- the sixth time on
 * this branch that a chip measured fine at rest and failed hovered. `--warning-foreground` as
 * the fill with `--warning` as the label measures 5.54 / 7.46 at rest and 4.84 / 6.27 hovered,
 * so it is authored against the worst state rather than patched after it.
 *
 * BOTH OPTIONS WERE THEN PAINTED, because the trap is the thing this branch keeps getting
 * wrong. The toast renders only after four map clicks a headless run could not land, so the two
 * class strings were injected as a probe into the live page -- the page's own compiled CSS,
 * Chromium's own compositing, only the trigger synthetic. Painted, the rejected `--card` pill
 * separates 3.04 rest / **2.53 hovered** in light, reproducing the model to two decimals; the
 * shipped inversion separates 5.54 / 4.84 light and 7.46 / 6.27 dark, and its label carries
 * the same figures. `blendOver` and paint agree to one byte at the pill's 90% hover alpha
 * (#322718 modelled, #322618 painted). The toast's rim is
 * `--warning-foreground/25` rather than the inventory's literal `border-warning`, because a rim
 * the same value as its own fill draws no line at all; inverting the panel inverts the rim.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The ten bracketed map hexes in this
 * file are the dark map surface and stay T-031d's.
 *
 * 221 -> 202 is T-031c Task 9's third file: `components/v2/v2-header.tsx` 19 -> 0, and it is
 * the one file on this branch that renders on EVERY route.
 *
 * The file settles a question the inventory could not see from a row: its hue population was
 * ALREADY bridge-bound, with three stragglers. Fourteen of its sixteen icon glyphs wear
 * `--primary`, `--accent`, `--secondary` or `--destructive`; seven of its eight mega-menu icon
 * plates wear a 10% tint of one of those. The raw classes were the leftovers -- one emerald
 * plate, one emerald glyph, two amber glyphs. Removing them, which is what `decoration` says
 * literally, would have left a bare plate beside three tinted ones and two bare glyphs in a row
 * of tinted ones: that deletes a convention rather than a meaningless hue. They join the set
 * instead, and the inventory rows record it.
 *
 * FIGURES, EACH WITH THE SURFACE IT IS A RATIO TO, and hovered where the surface moves:
 *
 *   - The plate is a 16px glyph on a 10% tint, i.e. a graphical object at the 3:1 floor. On
 *     `--card` it measures 5.12 light / 4.69 dark; the row hovers to `--muted`, and over that
 *     it is 4.33 / 4.04. The three plates already shipping measure 4.45-5.32 rest and
 *     3.77-4.46 hovered, so the new member is not the worst of its own set -- it is the
 *     second best. It replaces a raw pairing that measured 3.43 light.
 *   - The active Kitaplar link is on the nav bar, which is `--background/90` over whatever
 *     scrolls beneath: #faf7f1 to #fbf9f4 light, #0b1416 to #0d1619 dark. THE INVENTORY'S
 *     `text-primary` on a 15% tint measures 3.93 to 3.99 there and would have shipped a new
 *     failure. The spelling every other active nav item already uses -- `--primary-strong` on
 *     a 10% tint -- measures 6.89 to 6.96 light and 7.91 to 8.09 dark, against 4.03 to 4.10
 *     for the raw amber pairing it replaces.
 *
 *     THE NAV BAR IS NOT ONE SURFACE, so that range needs its conditions. It is
 *     `--background/90` over whatever is scrolled beneath it, so the figure moves with the
 *     page and the scroll position. The range above is the model over the three surfaces this
 *     site puts there (`--card`, `--muted`, `--background`); painted on `/kitaplar` at 1280 it
 *     is 6.95 to 6.96 light and 8.04 to 8.11 dark, stable across scroll-top, 400px and 1200px.
 *     A review of this branch painted 9.54 in dark at scroll-top on its own run and this
 *     implementer could not reproduce it at any of those three positions; the difference is
 *     what sat behind the bar, every observed value is far above the 4.5:1 floor, and the
 *     verdict does not turn on which end of the range is right.
 *   - The signed-in dot is a solid fill inside a pill that hovers from `--card` to a 50% muted
 *     wash: 5.82 rest / 5.32 hovered light, 5.49 / 5.09 dark. The raw emerald-500 measured
 *     2.54 / 2.32 in light, under the 3:1 graphical floor in both states.
 *   - The "Aktif" badge sits on that same moving row: 6.56 rest / 6.02 hovered light, 7.61 /
 *     7.03 dark, against 3.43 / 3.15 for the raw emerald.
 *
 * One row IS removed as written: the mobile Kitaplar row's amber surface. There the set argues
 * the other way -- its two sibling rows carry no surface at all, so the tint was the odd one
 * out and dropping it joins the convention. Its `Badge variant="primary"` still marks it.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The wordmark's one bracketed hex is
 * the dark brand tone and is not this task's row.
 *
 * 202 -> 180 is T-031c Task 9's fourth file: `components/v2/v2-sea-basin-detail-view.tsx`
 * 22 -> 0, the sixth frozen colour recorded in T-044(3). 5 semantic, 17 decoration, no data.
 *
 * The five semantic are the "Maksimum Derinlik" reading and the submarine-fault callout, and
 * their backdrops are not the ones a card-shaped guess would name. The depth figure sits on a
 * BARE `--card` metric tile, where `--info-strong` paints 8.16 light / 8.68 dark; the
 * inventory's 7.07 / 7.50 is that token on a tint of its own, which is not what this tile is.
 * The callout's icon plate is a 10% destructive tint over the callout's own
 * `from-destructive/5 via-card to-card` gradient, and `--destructive-strong` on it paints
 * 5.81 light / 7.58 dark. Both figures are from pixels, not from the model.
 *
 * The 17 decoration are removed as written, with two carriers kept and one element deleted.
 *
 *   - The two flat telemetry columns (SST, wave height) were one colour for every value, so
 *     they named the column and the `<th>` already does. They take `--foreground` like the
 *     wind column beside them. The table row hovers to a 20% muted wash, so the backdrop was
 *     painted in both states -- #ffffff rest / #fcfbf8 hovered light, #121e21 / #132123 dark --
 *     and the ratio computed against the painted backdrop: 14.97 / 14.46 and 14.73 / 14.31.
 *     Light rose-600 measured 4.70 and cyan-600 3.68 on the same tile.
 *   - Two chip sets -- coastal types and river names -- take `Badge variant="outline"`, the
 *     primitive whose own definition is `border border-border bg-card text-foreground`. THE
 *     FIRST ATTEMPT SPELLED THAT BY HAND and fired a different ratchet:
 *     `page-composition-cards.test.ts` counts a hand-drawn card surface as rounded + bg-card +
 *     border-border, and the two chips took it 189 -> 191 elements, 234 -> 236 spellings and
 *     358 -> 360 in total, +2 on each, which is exactly the two elements. Reaching for the
 *     primitive put all three back to 189 / 234 / 358 -- the arithmetic proved in both
 *     directions, and no ratchet stepped. Trading one census against another is not progress.
 *   - THE PULSING DOT IS DELETED, NOT UNCOLOURED. `bg-cyan-500` was the whole of that
 *     element; stripping the class alone leaves an 8px transparent span still running an
 *     `animate-pulse`, which is markup that renders nothing. Its heading's first word is
 *     "Canli", which is the carrier the verdict relies on.
 *
 * Three section-card eyebrows lose their hue and five keep theirs, and that asymmetry is
 * deliberate rather than overlooked: the five that keep it are already bridge tokens
 * (`--primary`, `--secondary`, `--destructive`), the three raw ones had a recorded reason to
 * go (`lib/marine/coastal-types-detail.ts` carries no colour field at all), and the cards
 * stack full width rather than in a grid, so no plain eyebrow sits beside a coloured one.
 * Confirmed in both themes at 1280 before committing.
 *
 * The arbitrary arm does not move: 72 before, 72 after.
 *
 * 180 -> 168 is T-031c Task 9's fifth file: `components/v2/v2-world-map-explorer.tsx` 27 -> 15,
 * and it is the first file on this branch that does NOT reach zero. The 12 that go are the
 * file's whole semantic half; the 15 that stay are its whole data half, and they are the dark
 * map surface T-031d owns.
 *
 * The 12: `SpecialStatusBadge`, which this file exports and renders in five places, and the
 * continent-filter banner that is `v2-turkey-map-explorer:1024` character for character. The
 * badge has FIVE different backdrops and every one is named and measured, because it is the
 * same chip on a card, on a table row that hovers, on a mini-card, and twice on a translucent
 * panel floating over a navy map: `--card` 5.87 light / 7.36 dark; a 40% muted wash 5.48 /
 * 6.96; the 50% wash this table's rows actually use 5.42 / 6.78; a 20% wash 5.67 / 7.17;
 * `--card/95` over the ocean gradient's mid stop 5.41 / 7.27 and over its black bottom stop
 * 5.31 / 7.48. All six are computed. PAINTED on `/dunya`, where seven of these badges render,
 * the first one measures 5.62 rest / 5.13 hovered in light and 8.41 / 7.06 in dark, and its
 * painted hovered backdrop (#ecdec4) is darker than any of the six modelled ones -- so 5.13
 * light is the figure of record, not 5.31. The hovered trap did not bite here, and the reason
 * is worth recording: `--warning-strong` is a strong member with roughly a point of headroom,
 * where the sets that failed hovered at ~4.4 were tuned to the floor.
 *
 * WHY 15 STAY, isolated and quantified rather than asserted.
 *
 * All 17 `--map-*` / `--province-*` / `--land-*` tokens are declared in `:root` and `.dark`
 * redefines ZERO of them -- they are the light parchment map's values. This map is not that
 * map: its container is a bracketed navy in BOTH themes and its ocean is a three-stop gradient
 * from #0b192c through #1e3e62 to black, so a theme-aware light token painted on it is wrong in
 * light mode by construction. Today's not-published country fill reads 1.27 to 1.75 against
 * those three stops, which is a deliberate recede; `--land-inert`, the token the inventory
 * names, is an alias of `--province-fill` (#ffffff) and at the same 65% would read 5.62 to
 * 8.63, making the countries with no page the most prominent objects on the map.
 * `--province-inert` reads 6.77 to 4.83 to 7.26 and does the same thing one shade down. Neither
 * is an application of a token; both are a redesign of the surface. (An earlier draft gave
 * `--province-inert` as 1.12 to 1.21 on the grounds that it is #1b2b2f in dark. It is not: the
 * `--color-surface: var(--muted)` remapping that would make it so is scoped to
 * `.dark .climate-dark-scope`, whose only consumer is the one file this branch excludes, so the
 * token is #f1e9de in both themes. The conclusion is unchanged; the discarded half of the
 * argument was a scoped override read as a global one.)
 *
 * None of the 17 is a graticule line either, and the hover/selected row carries a worse
 * problem: the highlight has a SECOND spelling that neither arm counts. `floodColor="#f59e0b"`
 * at :650 -- Tailwind amber-500 exactly -- is the glow drawn around the same hovered country.
 * Binding the class and leaving the flood is the two-spellings bug this branch exists to close,
 * and fixing both is the map-surface work.
 *
 * So these 15 are recorded rather than bound, the way `v2-turkey-map-explorer`'s eleven
 * bracketed map hexes and `v2-game-screen`'s land/sea pair already are in the inventory. They
 * are visible in this count instead of invisible only because they are spelled as classes
 * rather than as brackets. Task N+1's exemption list is where they belong if T-031d has not
 * landed by then.
 *
 * The arbitrary arm does not move: 72 before, 72 after.
 *
 * 168 -> 126 is T-031c Task 9's sixth file: `components/v2/v2-tools-hub.tsx` 42 -> 0, and it is
 * the heaviest single file left on the branch.
 *
 * The 12 semantic are the "Var" cells of the comparison table, emerald in all three columns
 * and therefore affirmative rather than tool identity. They take `--success-strong`: 7.50 light
 * / 8.78 dark on `--card`, 7.09 / 8.41 with the row hovered to a 30% muted wash, against 3.77 /
 * 3.56 and 4.52 / 4.33 for the raw emerald-600 they replace. Light was failing in both states.
 *
 * The 30 decoration are the tool-identity rows, and the verdict stands exactly as the inventory
 * ruled it after two rounds of argument: nothing is carried by colour alone, because all three
 * surfaces -- the card, the audience-card icon plate and the `<th>` -- name their tool in
 * adjacent text; and a set holding brand members cannot be a data set. What CHANGED is only
 * what "removed" does to a decoration hue whose own set is already half brand, and this file is
 * the clearest case of it on the branch. Card 1 is `--primary` from its gradient to its ticks;
 * cards 2 and 3 are that same markup with emerald and sky substituted -- AND THEIR OWN CTAs
 * ALREADY RESOLVE TO BRIDGE TOKENS, because `components/ui/button.tsx` defines
 * `variant="emerald"` as `bg-secondary` and `variant="sky"` as `bg-info`. Deleting the tints
 * would have left two grey cards with a green and a blue button still at the bottom of them,
 * which is less coherent than what ships today, while card 1 stayed fully terracotta.
 *
 * AND THE BINDING FIXED A DISAGREEMENT THE REMOVAL WOULD HAVE PRESERVED. Card 2 painted a
 * bright emerald chrome above an olive `--secondary` button, and card 3 a bright sky chrome
 * above a dark teal `--info` button -- each card contradicting its own call to action. After
 * binding, all three cards read terracotta, olive and teal from gradient to button. Confirmed
 * in both themes at 1280.
 *
 * So emerald becomes `--secondary` and sky becomes `--info` -- a mapping this repo had already
 * made, not a new one -- across all three surfaces per tool, which is what the inventory means
 * by collapsing them together. The `decoration` verdict is what LICENSES this: `docs/design.md`
 * rule 1 forbids brand chrome that encodes data, and the whole finding here is that these
 * encode nothing.
 *
 * Measured, with the surface each figure is a ratio to. `<th>` cells are TEXT at 4.5:1 on
 * `--card`: `--secondary` 5.89 light / 5.42 dark and `--info` 6.13 / 5.44, beside the
 * `--primary` header already there at 5.13 / 4.99 -- where raw emerald-600 measured 3.77 and
 * sky-600 4.10 in light, both failing. The ticks are glyphs at 3:1 on the card's own
 * `to-<hue>/5` gradient end: 5.52 / 5.09 and 5.73 / 5.10, against `--primary`'s shipping 4.79 /
 * 4.72. The icon plates are glyphs on their own 15% tint: 4.79 / 4.34 and 4.96 / 4.35, both
 * BETTER than the `--primary` plate beside them at 4.18 / 4.15. The two hand-drawn badges
 * become `Badge variant="secondary"` and `variant="info"`, so no new spelling joins the
 * hand-drawn card census -- the lesson the previous file paid for.
 *
 * The arbitrary arm does not move: 72 before, 72 after.
 *
 * 126 -> 113 is T-031c Task 10's first file: `components/v2/v2-favorite-button.tsx` 13 -> 0,
 * all thirteen decoration, all removed rather than re-tokenised. The button already carries
 * `role="switch"`, `aria-checked`, a filled versus outline `Heart`, a label that flips between
 * "Favoriye Ekle" and "Favorilerde", and -- the tell -- a `variant` that is already chosen from
 * the favourited flag. The rose was an override of a variant that encodes the state correctly.
 *
 * THE HOVERED STATE IS WHY THIS FILE IS NOT A ONE-LINE DELETION, and it is the seventh time on
 * this branch that a surface measured fine at rest and failed once hovered. Deleting the rose
 * hands the favourited button back to the primary variant, whose own hover is the base token at
 * 90% over the parent surface: the label measures 5.13 light and 4.94 dark at REST but 4.28 and
 * 4.24 HOVERED, under the 4.5:1 floor in both themes, and worse than the opaque rose-700 hover
 * it replaces (6.03). The favourited branch therefore sets its own hover fill, the primary
 * strong member, which deepens in light and lifts in dark: 8.36 and 8.13. No state of this
 * button is now below 4.5.
 *
 * The other figures, each against the surface it is a ratio to. The un-favourited labelled
 * button is an 80% card wash over `--background` at rest (#fefefd light, #111c1f dark) and bare
 * `--card` hovered; its `Heart` inherits `--foreground` there -- 14.83 / 14.97 light and
 * 15.02 / 14.73 dark -- where the raw rose-500 measured 3.72 / 3.75 and 4.62 / 4.53, failing
 * light in both states. The icon-only button keeps the outline variant's own pair,
 * `--muted-foreground` on `--card` at rest (7.92 / 7.79) and `--foreground` on `--muted`
 * hovered (12.44 / 12.67). The favourited fill itself is a graphical mark on `--card`:
 * `--primary` 5.13 / 4.99 against rose-600's 4.53 / 3.76, which was under the 3:1 floor in
 * neither theme but under 4.5 in dark. The post-toggle `Sparkles` was amber-300 on the rose
 * fill, 3.13; it inherits `--primary-foreground` now, 5.13 / 4.94.
 *
 * The two `Heart` glyphs and the label stop spelling white directly and inherit the variant's
 * own foreground, because a fixed white on a fill that lifts in dark is the failure the rose
 * was already making.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 before,
 * 16 after. Nothing here was rewritten as a bracketed literal, an SVG attribute or an inline
 * style, and nothing gained a `var()` fallback.
 *
 * Both figures are read from these collectors, not arithmetic.
 */
const RAW_PALETTE_BUDGET = 113;

describe("the raw palette is being retired, and the number is held", () => {
  it("finds no more than the budget", () => {
    const found = collectPaletteOccurrences();
    const byFile = new Map<string, number>();
    for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    const worst = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    expect(
      found.length,
      `budget ${RAW_PALETTE_BUDGET}, found ${found.length}. Heaviest: ${worst
        .map(([f, n]) => `${f} (${n})`)
        .join(", ")}`,
    ).toBeLessThanOrEqual(RAW_PALETTE_BUDGET);
  });

  it("collects something at all — positive control", () => {
    // Narrow root, deliberately hand-spelled: proves the collector finds real hits on a
    // smaller tree, not just an empty result that would trivially satisfy any budget.
    expect(collectPaletteOccurrences(["components"]).length).toBeGreaterThan(0);
  });

  it("still has a reason for every exclusion", () => {
    // When T-033 merges and this file no longer carries any raw palette class, this fails,
    // which is the reminder to delete the exclusion.
    for (const path of EXCLUDED) {
      const hits = readFileSync(path, "utf8").match(RAW_PALETTE) ?? [];
      expect(
        hits.length,
        `${path} is excluded but carries no raw palette class any more — T-033 has landed, delete the exclusion`,
      ).toBeGreaterThan(0);
    }
  });
});

/**
 * The second arm, and the hole it closes.
 *
 * `RAW_PALETTE` matches a NOTATION. `bg-orange-600` and `bg-[#ea580c]` are the same colour, and
 * only the first is counted — so a file can reach zero by rewriting one as the other, and
 * `RAW_PALETTE_BUDGET = 0` at the end of this branch would assert something materially weaker
 * than it reads. `v2-marine-map-explorer.tsx` already does this three times.
 *
 * A hex is not the only way to spell it. `LAUNDERING_SPELLINGS` below is the list this arm is
 * written against, and the first version of it caught only the plain-hex form.
 *
 * ## Why a pinned COUNT and not a colour classifier
 *
 * The obvious guard is "no arbitrary hex may BE a palette colour". It does not work. A NEGATIVE
 * RESULT WITH DATA, recorded so nobody rebuilds it: rank all 28 distinct arbitrary hexes in the
 * tree by CIEDE2000 to the nearest of the 230 Tailwind values the FIRST arm actually counts, and
 * there is no separating threshold.
 *
 *     #0d9488   0.76   teal-600     <- LAUNDERED
 *     #201c18   1.69   stone-900       legitimate Terra ink
 *     #070e17   1.67   gray-950        legitimate map tone
 *     #2563eb   2.68   blue-600     <- LAUNDERED, above two legitimate tones
 *     #ea580c   3.20   orange-600   <- LAUNDERED
 *
 * A cut at 0.76 catches one of the three and misses two; a cut above 2.68 condemns two measured
 * map surfaces. Maximum byte distance is worse still — the laundered three land 13-17 bytes from
 * Tailwind v4's oklch values (v4 states the palette in oklch; the laundered hexes are the v3
 * literals) while genuine map tones land 6.
 *
 * SCOPE MATTERS AND COST ME A FIGURE. An earlier version of this note put `#1a2529` at 2.4,
 * nearest `mist-800`. It is 6.20, nearest `zinc-800`. Tailwind 4.3's `theme.css` ships
 * `mauve`/`olive`/`mist`/`taupe` beyond the 22 classic families, and none of them is in
 * `FAMILIES`, so none is a laundering target — including them made a project-adjacent tone look
 * like a near-palette match. The comparison the argument rests on is unaffected.
 *
 * A pinned count needs no classifier and closes the route for every spelling in
 * `LAUNDERING_SPELLINGS`: moving an occurrence from `bg-orange-600` to any of them DECREASES
 * the first arm and INCREASES this one, so the second budget reds. What it does NOT do is
 * decide whether a bracketed value IS a palette colour — nothing here does, and the negative
 * result above says why. The two arms stay separate because most of these 72 are legitimate map
 * surfaces (sea, neighbour land, inland water) measured against fixed backdrops and owned by
 * T-031d's `--map-*` / `--province-*` work; one number mixing them would be a number nobody
 * could act on.
 */
const ARBITRARY_COLOR_BUDGET = 72;

/**
 * Every spelling of one colour that must not slip past both arms, with orange-600 as the
 * payload throughout.
 *
 * This list is the arm's real specification. The first version of it matched `-[#` only, and
 * ELEVEN of these lowered the raw-palette count without raising this one — including
 * `bg-[oklch(0.646 0.222 41.116)]`, which is Tailwind v4's OWN notation for orange-600 straight
 * out of its `theme.css`, and therefore the most natural laundering of the lot.
 *
 * Exposure to all eleven is zero in the tree today, so none of them moves the pinned number.
 * That is exactly why they are asserted here instead: a guard whose coverage rests on nothing
 * in the tree exercising it is a guard nobody will notice losing.
 */
const LAUNDERING_SPELLINGS: readonly string[] = [
  "bg-[#ea580c]",
  "dark:fill-[#ea580c]",
  "bg-[rgb(234 88 12)]",
  "bg-[rgb(234,88,12)]",
  "bg-[rgb(234 88 12 / 1)]",
  "bg-[rgba(234,88,12,1)]",
  "bg-[hsl(21 88% 48%)]",
  "bg-[oklch(0.646 0.222 41.116)]",
  "bg-[oklab(0.55 0.13 0.11)]",
  "bg-[lab(60 40 50)]",
  "bg-[lch(60 60 40)]",
  "bg-[color-mix(in_srgb,#ea580c_50%,white)]",
  "shadow-[0_0_0_2px_#ea580c]",
  "ring-[1px_solid_#ea580c]",
  "[color:#ea580c]",
  "[--tw-x:#ea580c]",
  // A `var()` beside the payload, not instead of it. These escaped the first TWO versions of
  // this arm: the second excluded a bracket whenever `var(` appeared anywhere inside it, so one
  // decorative `var(--ring)` immunised the whole utility and the palette value next to it.
  "bg-[color-mix(in_oklab,var(--x),#ea580c)]",
  "bg-[color-mix(in_oklab,#ea580c,var(--x))]",
  "bg-[rgb(var(--y)_88_12)]",
  "bg-[color-mix(in_srgb,var(--a)_50%,oklch(0.646_0.222_41.116))]",
  "shadow-[0_0_0_2px_#ea580c,0_0_0_4px_var(--ring)]",
  "[color:#ea580c;--x:var(--y)]",
  "bg-[linear-gradient(var(--a),#ea580c)]",
];

/**
 * Spellings that must NOT match, and every one of them is a deliberate decision rather than a
 * limitation. `[var(--x)]` is the GOAL state — `lib/theme/region-identity.ts` binds all seven
 * regions that way — and `var(--x, #hex)` is a token reference whose hex sits INSIDE the
 * `var()` as that token's own fallback, not beside it.
 *
 * Those fallbacks are not governed by `token-binding.test.ts`'s escape rule, whatever an earlier
 * version of this comment claimed: that rule is `var\(--color-[a-z-]+,\s*#hex\)` and all ten
 * live occurrences name `--map-sea`, so it never matches them. Their real exposure is DRIFT, and
 * it is pinned to `app/globals.css` by "every var() fallback still equals its token" in that same
 * file — the same fix `fillValue` gets in `region-identity.test.ts`.
 *
 * The rest are ordinary bracketed values that are not colours at all.
 */
const NOT_A_LAUNDERED_COLOUR: readonly string[] = [
  "bg-[var(--region-marmara)]",
  "fill-[var(--region-marmara)]/80",
  "bg-[var(--map-sea,#dbe7e8)]",
  "text-[var(--color-success,#496f35)]",
  // Nested, to prove the strip loops rather than running once.
  "bg-[var(--a,var(--b,#fff))]",
  "min-h-[380px]",
  "aspect-[2.33/1]",
  "text-[10px]",
  "[&_h4]:text-inherit",
  'REGION_IDENTITY["ic-anadolu"]',
  "bg-[collab(1)]",
];

/**
 * Arbitrary hexes that ARE a Tailwind palette value, by hand and by name — a list, not a
 * heuristic, because no heuristic separates them (see above).
 *
 * EMPTY, AND THAT IS THE RESULT RATHER THAN THE ABSENCE OF ONE. It held three entries until
 * T-031c Task 6: `v2-marine-map-explorer.tsx`'s sea-surface-temperature legend swatches
 * (`bg-[#ea580c]`, `bg-[#0d9488]`, `bg-[#2563eb]` — orange-600, teal-600 and blue-600 spelled
 * as literals). The `--sst-band-*` set they were waiting for now exists, the legend reads
 * the band tokens through a `bg-[...]` arbitrary value, and the assertion below did exactly
 * what its comment promised: it
 * went RED naming all three, which is how the entries came to be deleted instead of going
 * stale.
 *
 * The list stays, and stays asserted in both directions. A future laundering gets named here
 * and has to be removed by the task that fixes it, rather than counted and forgotten.
 */
const LAUNDERED: ReadonlyArray<{ file: string; cls: string; was: string }> = [];

describe("the palette cannot be laundered into brackets", () => {
  const found = collectArbitraryColorOccurrences();

  it.each(LAUNDERING_SPELLINGS)("%s is seen", (cls) => {
    expect(inlinesAColor(cls)).toBe(true);
  });

  it.each(NOT_A_LAUNDERED_COLOUR)("%s is deliberately not seen", (cls) => {
    expect(inlinesAColor(cls)).toBe(false);
  });

  it("finds no more than the pinned number of bracketed colour values", () => {
    const byFile = new Map<string, number>();
    for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    expect(
      found.length,
      `pinned ${ARBITRARY_COLOR_BUDGET}, found ${found.length}. A RISE here with a fall in the ` +
        `raw-palette budget is a palette class rewritten as a literal value, not progress. By file: ${[
          ...byFile.entries(),
        ]
          .sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} (${n})`)
          .join(", ")}`,
    ).toBeLessThanOrEqual(ARBITRARY_COLOR_BUDGET);
  });

  it("collects something at all — positive control", () => {
    // The same anti-vacuity guard the first arm carries: a budget satisfied by an empty result
    // is not a budget.
    expect(collectArbitraryColorOccurrences(["components"]).length).toBeGreaterThan(0);
    expect(hexOf("bg-[#EA580C]")).toBe("#ea580c");
    expect(hexOf("fill-[#abc]")).toBe("#aabbcc");
    // A colour function has no hex to report, and the caller has to cope with that.
    expect(hexOf("bg-[rgb(234 88 12)]")).toBeNull();
  });

  it("still has a reason for every named laundered value", () => {
    // Vacuous while LAUNDERED is empty, and deliberately kept: it is the half that fires when
    // a named entry is FIXED, and it fired for all three of the marine legend swatches in
    // T-031c Task 6. The other direction — a laundering that arrives unnamed — is the budget
    // assertion above, which is not vacuous.
    for (const entry of LAUNDERED) {
      expect(
        found.some((o) => o.file === entry.file && o.cls === entry.cls),
        `${entry.cls} (${entry.was}) is gone from ${entry.file} — delete this entry`,
      ).toBe(true);
    }
  });
});

/**
 * The THIRD arm, and the hole the first two leave.
 *
 * Arm one counts a class NOTATION. Arm two counts a literal inside a bracketed utility. A
 * colour written where Tailwind never looks — an SVG presentation attribute, a `stopColor` or
 * `floodColor` prop, a canvas `fillStyle`, a module constant, the arm of a ternary — is
 * invisible to both, so a file can report 0 on both while still shipping a palette value.
 *
 * IT WAS NOT HYPOTHETICAL. The live population when this arm was written was **40**, and seven
 * of them were Tailwind palette values: `v2-world-map-explorer`'s hover glow (amber-500),
 * `v2-marine-map-explorer`'s two dead gradient stops (cyan-500, sky-600), its selected station
 * pin (amber-500) and a label plate written as `rgba(15, 23, 42, 0.85)` (slate-900), and
 * `v2-tool-workbench`'s drawn area polygon — `rgba(5, 150, 105, 0.25)` plus `#059669`,
 * emerald-600 twice, **in a file the first arm had already reported as 0**. That is the branch
 * shipping a zero that is not a zero, which is the exact defect it exists to remove, one
 * notation further out.
 *
 * ## Why an exemption list and not a smaller scope
 *
 * 17 of the 40 are in contexts where a token CANNOT resolve, because no stylesheet is loaded:
 * the root error boundary that replaces the document, the Satori-rendered OG card, the web app
 * manifest, the `themeColor` meta pair, and the standalone favicon SVG builder. Each of those
 * files says so in its own docblock; `INLINE_EXEMPT` transcribes the reason rather than
 * deciding it, and carries the COUNT, so an exemption cannot quietly grow — the assertion below
 * fires in both directions.
 *
 * Narrowing the collector's roots instead would have hidden them, and this branch's founding
 * sentence is that a number living outside a guard is not a guard.
 *
 * ## The last step
 *
 * 23 -> 16 is T-031c Task 9 fix round 1: the seven launderings above, closed, and NONE of them
 * closed with a `var(--token, #hex)` fallback.
 *
 * That was the first attempt and this repo's own guards refused it, correctly. Two of the three
 * files are on the V2 surface where `token-binding.test.ts` forbids exactly that escape, and its
 * `MAP_SURFACE_FILES` exemption would have had to be widened to admit them; the same change also
 * reddened the per-token fallback census (`--color-accent` 0 -> 2, `--color-ink-dark` 7 -> 8,
 * `--color-primary` 4 -> 6). Widening an exemption and re-recording a census to land a fix that
 * has a cheaper form is how an exemption goes stale. The cheaper form:
 *
 *   - two Tailwind classes where the value is static -- the workbench's drawn area polygon takes
 *     `fill-accent/25 stroke-accent`, the marine temperature plate a bracketed utility around
 *     `--color-ink-dark`. A class is not a value, so neither other arm sees it either.
 *   - a BARE `var()` where the value is dynamic -- the marine selected pin and the world map's
 *     hover glow are one arm of a ternary and a `floodColor` prop. `var(--x)` with no fallback
 *     is not an escape, joins no census, and was verified IN THE BROWSER rather than assumed:
 *     `flood-color` on the live `#country-glow` resolves to rgb(176, 82, 46) in light and
 *     lab(58.43 36.17 36.80) in dark, and a probe `fill="var(--primary)"` on the live page does
 *     the same.
 *   - two DELETED with the `marine-pulse` radial gradient that held them, which nothing in the
 *     tree references.
 *
 * `--primary` AND NOT `--color-primary`, and the browser is why. `@theme inline` does not emit
 * its own custom properties, so `var(--color-primary)` resolves to the light #b0522e in BOTH
 * themes; that drops the marine selected pin to 3.17:1 on the dark sea where the bridge token
 * gives 4.77. The raw amber-500 it replaces measured 1.70:1 on the LIGHT sea, under the 3:1
 * graphical floor, so this closes a contrast failure as well as a laundering.
 *
 * THE COST, WITH ITS TIGHT FIGURE WRITTEN DOWN. `--sst-band-cool/warm/hot` are `:root`-only --
 * `.dark` redefines only their `-text` variants -- so the pin moves per theme while the bands do
 * not. Against the nearest band it measures deltaE00 13.6 in light and **10.3 in dark**, 0.3
 * above `CATEGORICAL_MIN` 10, where amber-500 scored 25.3. It passes with almost no room, and
 * retuning either `--primary` or `--sst-band-hot` means re-running that pair.
 *
 * A FALL here with a rise in either other arm would be the failure this trio exists to catch.
 * Neither moved: the raw-palette budget is unchanged at 126 and the arbitrary budget at 72.
 */
const INLINE_COLOR_BUDGET = 16;

describe("a colour cannot hide outside a class either", () => {
  const found = collectInlineColorOccurrences();
  const live = found.filter((o) => !isInlineExempt(o.file));

  it("finds no more than the pinned number of inlined colour values", () => {
    const byFile = new Map<string, number>();
    for (const o of live) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    expect(
      live.length,
      `pinned ${INLINE_COLOR_BUDGET}, found ${live.length}. A colour written into an SVG ` +
        `attribute, a prop, a canvas call or a module constant is still a colour, and neither ` +
        `other arm can see it. By file: ${[...byFile.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} (${n})`)
          .join(", ")}`,
    ).toBeLessThanOrEqual(INLINE_COLOR_BUDGET);
  });

  it("collects something at all, and the two halves add up — positive control", () => {
    expect(collectInlineColorOccurrences(["components"]).length).toBeGreaterThan(0);
    // Not a third number nobody reconciles: the exempt half plus the live half IS the whole.
    expect(live.length + found.filter((o) => isInlineExempt(o.file)).length).toBe(found.length);
  });

  it("exempts a named file and nothing that merely ends like one", () => {
    // `endsWith` was the first spelling and it is a trap: `lib/app/manifest.ts` ends with
    // `app/manifest.ts`. The count assertion below catches it, but a guard whose first line of
    // defence is a second guard is one edit away from being neither.
    expect(isInlineExempt("app/manifest.ts")).toBe(true);
    expect(isInlineExempt("lib/app/manifest.ts")).toBe(false);
    expect(isInlineExempt("components/v2/manifest.ts")).toBe(false);
    expect(isInlineExempt("app/global-error.tsx")).toBe(true);
    expect(isInlineExempt("vendor/app/global-error.tsx")).toBe(false);
  });

  it("still has a reason for every exemption, and the reason is still the right size", () => {
    // Both directions. A file that stops carrying its colours has a stale exemption; a file that
    // grows new ones has an exemption covering something nobody read.
    for (const entry of INLINE_EXEMPT) {
      const n = found.filter((o) => o.file.endsWith(entry.file)).length;
      expect(n, `${entry.file} is exempt for ${entry.count} (${entry.why}) but carries ${n}`).toBe(
        entry.count,
      );
      expect(entry.why.length, `${entry.file} is exempt without a reason`).toBeGreaterThan(20);
    }
  });
});

/**
 * What the third arm must and must not see. Every one of these is a shape the tree really
 * contains, and two of them are bugs this arm had before it was pinned.
 */
describe("the third arm reads values, not prose and not token references", () => {
  /** Run the arm over one synthetic file's worth of text, through the real collector path. */
  const seenIn = (source: string) => {
    const dir = mkdtempSync(join(tmpdir(), "t9-inline-"));
    writeFileSync(join(dir, "probe.tsx"), source, "utf8");
    try {
      return collectInlineColorOccurrences([dir]).map((o) => o.cls);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("sees an SVG presentation attribute", () => {
    expect(seenIn('const a = <circle fill="#059669" />;')).toEqual(["#059669"]);
  });

  it("sees a colour function, and a module constant", () => {
    expect(seenIn('const a = "rgba(5, 150, 105, 0.25)";')).toEqual(["rgba("]);
    expect(seenIn('const PIN = "#f59e0b";')).toEqual(["#f59e0b"]);
  });

  it("does NOT see a fragment id — the greedy-hex trap this arm was born with", () => {
    // `#[0-9a-fA-F]{3,8}` matches `#afe` inside `#afet`. Inside brackets it never bit, because
    // a bracketed value ends at `]`; outside them the tree is full of fragment links.
    expect(seenIn('const a = <a href="#afet">x</a>;')).toEqual([]);
  });

  it("does NOT see prose — comments are stripped", () => {
    expect(seenIn("/* the old value was #ea580c, orange-600 */\nconst a = 1;")).toEqual([]);
    expect(seenIn("// a raw #059669 used to live here\nconst a = 1;")).toEqual([]);
  });

  it("does NOT see a var() fallback — that is a token reference, pinned elsewhere", () => {
    expect(seenIn('const a = "var(--map-sea, #dbe7e8)";')).toEqual([]);
  });

  it("does NOT double-count what the arbitrary arm already counts", () => {
    // The two arms partition the population; they do not overlap it.
    expect(seenIn('const a = <div className="bg-[#ea580c]" />;')).toEqual([]);
    expect(inlinesAColor("bg-[#ea580c]")).toBe(true);
  });

  it("still sees a colour sitting BESIDE a token reference on one line", () => {
    // The shape that defeated the second arm's first two versions, one notation out.
    expect(seenIn('const a = <rect fill="var(--map-sea)" stroke="#059669" />;')).toEqual([
      "#059669",
    ]);
  });
});
