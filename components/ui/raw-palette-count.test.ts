import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARBITRARY_PINNED,
  collectArbitraryColorOccurrences,
  collectInlineColorOccurrences,
  inlinesAColor,
  collectPaletteOccurrences,
  hexOf,
  INLINE_EXEMPT,
  INLINE_PINNED,
  isInlineExempt,
  isInlinePinned,
  isRawExempt,
  RAW_EXEMPT,
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
 * 113 -> 100 is Task 10's second file: `components/v2/v2-leaderboard-modal.tsx` 13 -> 0, all
 * thirteen decoration. Nine of them are the gold/silver/bronze tints on ranks 1-3, and each of
 * those cells renders a medal emoji AND sits in a column whose other rows spell the rank as a
 * number -- the hue restates a glyph that is already the message. With the tints gone the three
 * branches differ only by which emoji they print, so they collapse into one.
 *
 * SELECTED AND HOVERED, NOT REST, AND BOTH WERE WORSE. A leaderboard row is `--primary`/10 when
 * it is the reader's own row and `--muted`/40 when hovered, so the rank chip's real backdrop is
 * a tint over a tint. Rank 1 measured 4.48 light on a bare card but 4.01 on the reader's own
 * row -- under the floor only in the state a reader is most likely to look at. Inheriting
 * `--foreground` measures 14.97 on `--card`, 13.89 hovered and 12.18 on the reader's own row.
 * The dark pairs were not the failing half here (7.61 / 8.12 / 8.40) and go with their light
 * halves.
 *
 * The badge is a VARIANT SWAP, not a deletion: a hand-drawn tinted badge standing beside a
 * declared `variant="secondary"` one. Deleting its three classes would leave an untinted badge
 * where a tinted one was and keep a hand-drawn spelling in the census. The declared default
 * badge is the same shape -- a 12% brand tint carrying the strong member -- at 7.10 rest and
 * 6.32 hovered, against 2.96 light for the amber it replaces. The inventory row records it.
 *
 * The trigger's `Trophy` is the clearest hovered case in the file and the smallest. Its button
 * is the outline variant in both call sites, so the glyph sat on `--card` at rest and `--muted`
 * hovered: amber-500 measured 2.13 and then **1.77** in light, under the 3:1 graphical floor in
 * both states and worse in the one that involves a pointer. It inherits `--foreground`: 14.97
 * and 12.44.
 *
 * THE TRIGGER IS PAINTABLE AND THE TASK REPORT SAID IT WAS NOT. `Computed, not painted -- the
 * modal needs a session` is true of the modal's own rows and false of the trigger, which renders
 * on `/oyun` to a logged-out visitor. Painted at branch close it reads 14.97 rest / 12.44 hovered
 * in light and 14.73 / 12.67 in dark, matching the computed light pair to the decimal. The
 * figures were right; the label was not.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 100 -> 90 is Task 10's third file: `components/v2/v2-marine-layer-catalogue.tsx` 10 -> 0,
 * five decoration and five semantic.
 *
 * The five are one glyph per catalogue row, and they cannot be the identifier: two of the five
 * rows draw the SAME glyph (a compass, for wave direction and wind direction) and two share a
 * hue, while every row is named in the cell beside it and no map mark reads any of them. Their
 * backdrop is a 60% muted plate over the row, and the row hovers -- 3.37 / 3.25 / 3.29 / 2.18
 * and 4.11 light at rest, each about 0.1 worse hovered, four of the five under the 3:1
 * graphical floor. The plate already declares `--foreground`; the glyphs stop overriding it and
 * measure 13.44 rest and 12.99 hovered.
 *
 * The status badge is availability -- one of the five meanings -- and takes the DECLARED
 * success badge rather than a hand-spelled tint, for the reason the previous file settled: the
 * design system already ships this exact shape, and a second hand-drawn spelling of it is a
 * spelling somebody has to keep in step. On the row it measures 6.09 light / 7.05 dark at rest
 * and 5.71 / 6.66 hovered, where the emerald it replaces was 4.87 and then **4.54** hovered at
 * 10px -- a third of a point from failing in the state a reader is pointing at. Its dark pair
 * goes with it.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 90 -> 81 is Task 10's fourth file: `components/v2/v2-game-history-stats.tsx` 9 -> 0, all
 * nine decoration. Four achievement tiles, three of them amber, emerald and orange and the
 * fourth ALREADY the brand tint -- which is the tell, because a set of four where one member is
 * chrome is not encoding anything. Unlocked versus locked is carried three other ways on the
 * same tile: a text badge reading "Kazanildi" or "Kilitli", a dashed border and a 60% opacity.
 *
 * "REMOVED" HERE MEANS THE HUE, NOT THE TILE, and the inventory row now says so. With the three
 * hues gone the colour field is one constant repeated four times, so it leaves the data
 * altogether and the unlocked branch names its treatment once.
 *
 * The glyph's backdrop is not the tile: it is an 80% `--background` plate over the tile, which
 * is itself a 10% tint over the card's own muted gradient end. Measured there the three raw
 * glyphs were 2.99, 3.39 and 3.35 in light -- one under the 3:1 graphical floor and all three
 * under 4.5 -- against 4.74 light and 5.26 dark for the brand glyph already shipping beside
 * them. That pair is the MODEL, and the re-probe below confirms it: painted on the real page
 * the same glyph reads 4.74 / 5.31. The tile edge moves from 1.91 to 4.33 light, which is the difference between a tint
 * with no edge and a tile.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 81 -> 56 is Task 10's fifth step and its only multi-file one: the four AUTH surfaces, which
 * belong together because three of them render the SAME success alert.
 * `components/v2/v2-register-card.tsx` 9 -> 0, `components/v2/v2-login-card.tsx` 7 -> 0,
 * `components/v2/v2-profile-form.tsx` 5 -> 0 and `components/v2/v2-auth-benefits-plate.tsx`
 * 4 -> 0. Twenty-one semantic, four decoration.
 *
 * MOST OF THESE FIGURES ARE COMPUTED, NOT PAINTED, and the reason is the shape this branch has
 * already met four times. A success alert renders only after a successful POST, the login
 * card's confirmation plate renders only for a signed-in visitor, and `cg_has_session=1` alone
 * does not buy that -- the BFF answers 401, so the signed-in branch is reachable in the model
 * and not on a headless route. The register card's password rules are the exception and are
 * painted. Every figure below says which it is.
 *
 * TWO OF THEM WERE MISLABELLED, and the label was the only thing wrong. `V2AuthBenefitsPlate`
 * renders on `/kayit` to a LOGGED-OUT visitor, so its glyphs never needed a session; painted on
 * the real page at branch close they read 5.13 light / 4.99 dark, the computed figures exactly.
 * Its trust-footer shield paints 13.78 light / 15.17 dark against a computed 14.15 light -- the
 * 0.37 is where on the 30% wash the backdrop is sampled, and the dark half was never recorded.
 * Both are far above every floor that binds them.
 *
 * The alert, COMPUTED, on a 10% success tint over the auth card (itself `--card`/95 over
 * `--background`): `--success-strong` 6.56 light and 7.62 dark, against emerald-700's 4.87 and
 * **2.71** -- the dark pair was doing the work in dark and the light half was failing on its
 * own. The login card's confirmation plate, COMPUTED on the same tint: 6.56 / 7.61 against
 * 3.32 / 3.97. The four password rules, PAINTED on the card: 7.49 light and 8.79 dark against
 * 3.65 and 4.66, failing light. Each of the three alerts drops its hand-written dark pair.
 *
 * The benefits plate is the fourth file and the only decoration in the group. Its three raw
 * glyphs are BOUND rather than deleted, because the FOURTH row of the same array is already
 * `--primary`: deleting three of four leaves one tinted glyph in a column of four. On the row's
 * own card plate they measured 2.13, 2.47 and 3.75 light, at or under the 3:1 graphical floor,
 * against 5.13 / 4.99. The trust-footer shield is a singleton beside foreground prose rather
 * than a member of that set, so it inherits: 2.34 light before, 14.15 after. The inventory row
 * is split in two and records both.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 56 -> 48 is Task 10's sixth file: `components/v2/v2-game-hub.tsx` 8 -> 0, all decoration,
 * and it is the file the inventory used to WRITE its second ruling -- a hue that varies per
 * card is card identity, not meaning. That ruling stands. What the file shows on contact is the
 * same thing `v2-tools-hub` showed: each of the three mode cards ALREADY carries a per-card
 * bridge identity in three declared places -- its icon plate, its badge variant and its hover
 * edge are `--primary`, `--secondary` and `--accent` respectively -- and the emerald, teal and
 * cyan ticks were a fourth, raw spelling of exactly that. Deleting them leaves grey ticks in
 * three cards whose chrome is coloured; they join the identity the card already declares.
 *
 * On the card, which is an 80% card wash over the panel at rest and opaque `--card` hovered:
 * 5.08 / 5.13 light and 4.94 / 4.99 dark for card 1, 5.84 / 5.89 and 5.36 / 5.42 for card 2,
 * 6.08 / 6.13 and 5.38 / 5.44 for card 3 -- against 3.62, 3.64 and 3.59 in light for the three
 * raw hues, every one of them failing 4.5 and two of them within 0.6 of the graphical floor.
 *
 * The other two are a `Sparkles` inside a filled secondary badge, whose backdrop is that fill:
 * amber-500 measured 2.76 light and **1.47** dark on it, and it inherits the badge's own
 * foreground at 5.89 / 5.37. And a `Brain` in a two-item strip whose other glyph is already
 * `--primary`: 4.61 light, down from purple-600's 4.98 but far above the 3:1 a glyph is held
 * to, and 4.57 dark, up from 2.82, which was below it.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 48 -> 40 is Task 10's seventh file: `components/v2/v2-member-hub.tsx` 8 -> 0, all decoration,
 * and it is three separate sets that all have the SAME shape. The favourite-entity glyphs are
 * four cases of one switch and the `province` case is already the brand token; the quick-stats
 * glyphs are four tiles and the "Izlenen Video" tile is already brand; the measurement-type
 * glyphs are three arms and the distance arm is already brand. In each set the raw members were
 * the minority, so deleting them leaves one brand glyph beside two or three grey ones.
 *
 * Binding also keeps a ruling the inventory made on this file: the emerald glyph on the "Bolge"
 * row is NOT a region identity -- all seven regions share it -- and must not take `--region-*`.
 * A brand token is the only thing it can take without saying something false.
 *
 * COMPUTED, NOT PAINTED. This is the member hub; everything measured here is behind a session,
 * and `cg_has_session=1` does not buy one because the BFF answers 401. On the favourites and
 * measurements plate (60% muted over `--card`) the three raw glyphs measured 2.43, 2.22 and
 * 1.92 in light -- the worst readings in this task and all far under the 3:1 graphical floor --
 * against `--primary` at 4.61. On the quick-stats tiles (60% background over `--card`) they
 * were 3.64, 2.07 and 4.43 against 4.97. Dark moves the other way for these -- 5.77 / 6.31 /
 * 7.31 down to 4.57 -- and that is the trade the set makes: every glyph in a set clears the
 * floor in both themes and agrees with the one that was already brand, instead of three of them
 * failing light to be bright in dark.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 40 -> 33 is Task 10's eighth file: `components/v2/v2-learning-paths.tsx` 7 -> 0, six
 * decoration and one semantic.
 *
 * The six are three card-header washes, and this is the one place in the task where "removed"
 * COULD NOT mean deleted: the header is a white-on-colour plate, so a gradient with no stops
 * leaves white text on no background at all. What the verdict removes is the VARIETY -- three
 * different hues for three cards that are already named in the header they sit behind -- so the
 * three collapse into one brand wash running from the base to the strong member, a pair that is
 * declared in both themes and needs no alpha.
 *
 * AND THE PLATE'S OWN WHITE UTILITIES HAD TO GO WITH THEM, which is the part a row cannot see.
 * A fixed white on a fill that lifts in dark is the same failure this task already found on the
 * favourite button, and on the amber card it was failing in LIGHT too: the title measured 3.20,
 * the 80%-alpha eyebrow 2.57 and the 20%-white badge 2.54, none of them within reach of the
 * floor they are held to. The plate now carries `--primary-foreground` throughout. Measured at
 * the from-end of the gradient, where the badge and the glyph actually sit: title and eyebrow
 * 5.13 light / 4.94 dark, badge 5.13 / 4.94 as a solid inverse chip rather than a 20% wash
 * (which would have measured 3.54 / 3.64 and failed at 10px), and the play glyph 3.54 / 3.64 on
 * its 20% plate, which is a graphical object and clears 3:1. The to-end is 8.36 / 8.13.
 *
 * The seventh is a single affirmative tick, emerald throughout the component rather than per
 * card, so it is semantic: `--success-strong` on `--card`, 7.50 light and 8.78 dark against
 * 3.65 and 4.66.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 33 -> 21 is Task 10's ninth step, the three remaining SITE PAGES:
 * `app/[locale]/(site)/deniz/page.tsx` 5 -> 0, `app/[locale]/(site)/deprem/hazirlik/page.tsx`
 * 5 -> 0 and `app/[locale]/(site)/turkiye/bolge/page.tsx` 2 -> 0. Nine semantic, three
 * decoration, one of which is prose.
 *
 * The sea page's submarine-fault banner is the same markup `v2-sea-basin-detail-view` already
 * carries and takes the same destructive family: the glyph measures 6.14 light and 6.83 dark on
 * a 10% tint over the banner, against red-600's 3.86 and **3.19**, failing both. The banner's
 * own 30% edge is 1.49 after and was 1.44 before -- a decorative rim on a card whose heading
 * identifies it, under 3:1 in both spellings, recorded rather than claimed as a fix.
 *
 * The page's fifth is not markup at all: a comment recording why a metric tile was converted
 * quoted the raw class name literally. The literal spelling goes and the ruling stays, which is
 * what the inventory's comment rows say -- and Tailwind scans comment text, so the quote was
 * compiling into a real rule as well as sitting in the count.
 *
 * The preparedness page's caution is a warning, not a band: it is advice on a public-safety
 * page, not a value on the AQI, MMI or SST scales that stay standard. On a 10% tint over
 * `--card` it measures 6.18 light and 8.18 dark. The pair it replaces was doing half the job
 * in each theme -- amber-900 8.39 light but **1.60** dark, its amber-200 partner 11.65 dark but
 * **1.15** light -- and the glyph beside them 2.96 light, under the graphical floor.
 *
 * The region index's two dots are the smallest rows in the task and the only ones where the
 * figure falls. They are `aria-hidden` bullets with the word beside them, and the ternary's
 * THIRD arm was already the neutral bullet, so the other two take that value rather than being
 * deleted -- deleting a fill leaves an 8px invisible box. 1.95 light and 2.36 dark -- RE-PAINTED
 * at branch close and confirmed, against the 2.34 in Task 10's report, which had labelled the
 * same pair `rest / hovered` instead of `light / dark`; painted, the hovered pair is 1.93 / 2.33
 * -- against teal-500's 2.42 and amber-500's 2.13: all three spellings are under 3:1, and a mark that is
 * `aria-hidden` next to its own label is not held to it. With the fills equal the three arms
 * differ only by label and collapse into one.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * 21 -> 15 is Task 10's tenth and last step, the TOPIC TINTS:
 * `components/v2/v2-tool-educational-content.tsx` 3 -> 0 and the three one-occurrence guides,
 * `v2-game-pedagogy-guide`, `v2-gis-methodology-guide` and `v2-study-strategy-guide`, 1 -> 0
 * each. All six decoration, and five of the six are the same shape one more time: a rotation of
 * `--primary` / `--secondary` / `--accent` with a single raw straggler in it. The educational
 * panel already rotates those three across FOURTEEN other headings of the same shape, and its
 * three audience plates already begin with the brand one; both guides hold a four-item array
 * whose first three are the rotation. In each case the straggler joins rather than being
 * deleted, because deleting it leaves one grey mark in a row of coloured ones.
 *
 * Figures, on the surface each sits on. The heading, on `--card`: 6.13 light / 5.44 dark, from
 * 3.20 / 5.32. The two plates, on a 30% muted wash: 5.57 / 5.20 and 5.80 / 5.21, from 3.45 /
 * 4.47 and 3.80 / 4.06 -- both failing 4.5 in light. The two guide glyphs, on a 60% muted
 * plate: 4.61 light, down from purple-600's 4.98 but well clear of the 3:1 a glyph is held to,
 * and 4.57 dark, up from 2.82, which was under it.
 *
 * THE SIXTH RENDERS NOWHERE, and that is the fourth time on this branch that a row had to be
 * checked against what actually paints before it could be baselined.
 * `v2-study-strategy-guide`'s `topics[].color` is never read by the component: the card draws a
 * title, a badge and a paragraph and never touches the field. There is no backdrop to name and
 * no ratio to quote, computed or painted. The whole field goes, all four values, because
 * rebinding the fourth would have left three dead strings beside it. The inventory row is
 * corrected rather than annotated.
 *
 * WITH THIS THE COUNT IS THE DEFERRAL. All 15 remaining occurrences are the dark map surfaces
 * in `components/v2/v2-world-map-explorer.tsx`, confirmed and recorded for T-031d by Task 9 and
 * unchanged by this task. No product file outside that one carries a raw palette class.
 *
 * The arbitrary arm does not move: 72 before, 72 after. The inline arm does not move: 16 and 16.
 *
 * A NOTE THE PAINT ADDED, AFTER THE COUNT HAD ALREADY REACHED 15. The learning-path header's
 * title did not inherit the plate's colour the way its spans did: `app/globals.css`'s base
 * layer sets a colour on `h3` and `h4` directly, so a heading reaches that rule rather than its
 * parent's utility. Modelled, the title was 5.13; PAINTED with the explicit class removed it
 * was **2.88** light and **2.92** dark, on a wash the model said was fine. The `<h3>` carries
 * the class itself now, and painted it reads **5.13** / 5.01 at the from-end and 7.03 / 7.05 at
 * the to-end, with the eyebrow the same, the badge at 5.13 / 4.94 and the play glyph at
 * 4.37 / 4.64 on its 20% plate.
 *
 * TWO CORRECTIONS HERE AT BRANCH CLOSE, both re-painted. The from-end is **5.13**, not the 5.20
 * that drifted into the record: 5.13 is the exact `--primary-foreground` on `--primary` pair,
 * which is why the badge -- the same pair, inverted -- reads 5.13 too, and a sample taken a few
 * pixels into a `to-br` gradient reads slightly higher because the gradient has already moved.
 * And the PRE-FIX pair was recorded only at the from-end. The title sits at the TO-end, where
 * the base layer's `--foreground` measured **2.13 light / 2.07 dark** -- the worse half, and it
 * was not in the record at all.
 *
 * The same rule is why the educational panel's heading row never carried its hue on the
 * HEADING: painted, the `<h4>` is `--foreground` at 14.97 / 14.73 and only the glyph beside it
 * takes the rotation token, 6.13 / 5.44. That was true of the amber it replaces too, so the row
 * moved exactly one mark.
 *
 * ONE FIGURE THAT WAS WRONG, AND THE RULE THAT WAS DRAWN FROM IT, WITHDRAWN. Commit `9b8589b`
 * recorded the achievement glyph's 80% plate as 4.49 light / 4.63 dark against a model of
 * 4.74 / 5.26, and generalised that gap into standing prose: that 80% is where `blendOver` and
 * paint part, by a quarter point light and a whole point dark. **It does not reproduce, and
 * there is no such rule.**
 *
 * RE-PROBED on the real stack: a real achievement tile on `/oyun`, flipped to the unlocked
 * branch in place in the page's own flow, with the plate's backdrop read from screenshot PIXELS
 * (30 of 30 identical in both themes) and the glyph — opaque `--primary`, so computed is
 * painted — converted to sRGB by the browser's own engine. It paints **4.74 light and 5.31
 * dark**, against a model of 4.73 / 5.36. The two agree to 0.01 and 0.05, which is the ±1-byte
 * quantisation band this file already documents at 5% and 15%. Eighty per cent is not special.
 *
 * WHAT THE FIRST PROBE WAS ACTUALLY STANDING ON, because the number was not noise. It named a
 * dark backdrop of `#212322`, a NEUTRAL grey; this page's dark `--background` paints `#0b1416`,
 * teal-tinted. `ratio(--primary-dark #d0714e, #212322)` is **4.63 exactly** — the recorded
 * "painted" dark figure is the flat grey's own ratio, and the light 4.49 falls on a neutral near
 * `#f0f0f0` rather than on this page's `#fbf8f3`. The probe injected the tile's class strings
 * into a stack that was not this one. Direction was conservative, so nothing shipped under a
 * floor, and no other figure on this branch depends on it.
 *
 * (`opacity-60` is not the explanation either: the locked tile's treatment reads 2.44 / 2.62.)
 *
 * A SECOND-ORDER TRAP THE RE-PROBE HIT, worth one line because it is how a probe measures the
 * wrong element while believing otherwise: written and read inside ONE `page.evaluate`,
 * Chromium hands back the PRE-mutation computed style. The first run of the re-probe reported a
 * `bg-muted/20` tile at 0.2 alpha after setting `bg-primary/10` on it. The flip and the read
 * have to be separate round trips.
 *
 * Both collector figures are read from these collectors, not arithmetic.
 */
/**
 * THE END STATE OF THIS ARM, AND WHY THE NUMBER IS GONE.
 *
 * `toBeLessThanOrEqual(15)` was the shape this arm carried for its whole life, and at 15 it
 * stops being a guard. It cannot fail when the count FALLS, and it cannot say WHICH 15 are
 * allowed — a new `text-rose-500` in a new component satisfied it as long as somebody deleted
 * a graticule stroke in the same commit. A budget only trips on growth, and growth is the one
 * thing that is not going to happen now that every file but one reads 0.
 *
 * So the arm now says what it means, in the shape the inline arm already used: a NAMED
 * exemption list — `RAW_EXEMPT`, one entry — asserted with `toBe` for that file and `toBe(0)`
 * for every other file in the tree. T-031d ends this arm by deleting the entry rather than by
 * editing a digit, and what is left behind is a literal zero.
 *
 * Three ways it fails, and all three are things that should fail:
 *   - a raw palette class appears in any file that is not named        -> the zero assertion
 *   - the named file's count moves in EITHER direction                 -> the `toBe` assertion
 *   - the named file stops existing (renamed, split, deleted)          -> the staleness assertion
 *
 * There was a FOURTH, and it has done its job and gone. `EXCLUDED` held the one file this branch
 * did not own — `turkiye/[slug]/page.tsx`, whose 65 occurrences T-033 was rewriting — and an
 * assertion demanded that it still carry raw palette classes, so that T-033 landing would turn
 * this suite red and say so. On the merge it did exactly that (`expected 0 to be greater than
 * 0`, with its own instruction in the message). The exclusion, its filter and that assertion are
 * all deleted now; the scope is the whole tree and the file is inside it, counted like any
 * other. An assertion that looped over an empty list would have been the alternative, and a
 * guard that cannot fail is not a guard.
 */
describe("the raw palette is retired everywhere but one named file", () => {
  const found = collectPaletteOccurrences();
  const byFile = new Map<string, number>();
  for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);

  it("has none at all outside the named deferrals", () => {
    const stray = [...byFile.entries()].filter(([file]) => !isRawExempt(file));
    expect(
      stray,
      `every file outside \`RAW_EXEMPT\` must read 0. Found: ${stray
        .map(([f, n]) => `${f} (${n})`)
        .join(", ")}`,
    ).toEqual([]);
  });

  /**
   * THE PER-ROW CASES ARE DELETED, NOT STEPPED TO ZERO. `it.each(RAW_EXEMPT)` ("$file is
   * deferred for exactly $count", asserting the count in BOTH directions and that the reason
   * was more than 20 characters) and the staleness loop over the same list ("names only files
   * that still exist") both survived into the commit that emptied `RAW_EXEMPT`, where the first
   * registered ZERO test cases and the second ran its `for` body zero times. An `it.each` over
   * an empty list is a green case that looked at nothing, which is this branch's own signature
   * defect turned on its own guards — the same ruling `components/css-module-dark-safety.test.ts`
   * recorded when its `reduce` and its `it.each` reached an empty population.
   *
   * WHAT REPLACED THEM. The zero itself is now held in two places, neither of which can go
   * vacuous: the stray assertion above (`toEqual([])` over files the collector actually walked,
   * naming any file that comes back) and the emptiness assertion at the foot of this file
   * (`expect(RAW_EXEMPT).toEqual([])`, which reds on a row being added back). The machinery the
   * deleted cases exercised — that the collector still sees a raw palette class, and that the
   * walk still reaches real files — is proved by the synthetic control below and by the
   * arbitrary arm, which shares `sourceFiles` with this one.
   *
   * A row added back to `RAW_EXEMPT` reds at the foot of this file and names itself. If a
   * deferral list is ever genuinely needed again, restore these two cases WITH it, in one
   * commit, so neither exists without a population.
   */

  /**
   * THE ANTI-VACUITY CONTROL IS SYNTHETIC, AND IT HAD TO BECOME SO.
   *
   * It used to read `collectPaletteOccurrences(["components"]).length > 0`, and at the end of
   * this branch that was satisfied by exactly one thing: the 15 deferred occurrences in
   * `v2-world-map-explorer.tsx`. So the control was due to go RED on the very commit that
   * closes this arm — T-031d deletes those classes and deletes the `RAW_EXEMPT` row — and the
   * obvious response, deleting the control, would leave arm 1 asserting zero with nothing
   * proving the collector can still see anything at all. That is this branch's own signature
   * defect (a guard that is green because it did not look), aimed at its own future.
   *
   * Arms 2, 3 and 4 already work this way: `LAUNDERING_SPELLINGS`, `seenIn()` and
   * `compileProbe()` all feed the collector input they own. Arm 1 now does too, so it survives
   * reaching a literal zero in the tree.
   *
   * The two halves are separated on purpose. The NOTATION is proved against a tree this test
   * writes, which nothing in the repo can empty. The SCOPE — that `sourceFiles` still walks
   * real files rather than returning nothing — is proved against the real tree through the
   * arbitrary arm, which shares `sourceFiles` with this one ("one reader for the scope", see
   * `scripts/palette-inventory.mjs`). Arm 1's own population is the thing being driven to zero
   * and therefore cannot be the evidence that the walk works.
   */
  const seenIn = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "t11-raw-"));
    try {
      for (const [name, source] of Object.entries(files)) {
        const full = join(dir, name);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, source, "utf8");
      }
      return collectPaletteOccurrences([dir]).map((o) => o.cls);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("sees a raw palette class on a tree it owns — synthetic positive control", () => {
    expect(seenIn({ "probe.tsx": 'const a = <div className="text-rose-500" />;' })).toEqual([
      "text-rose-500",
    ]);
    // A variant prefix and an alpha suffix are the same class; both spellings must be counted,
    // and 42 of the 939 this branch removed were written one of those two ways.
    expect(
      seenIn({ "probe.tsx": 'const a = <div className="dark:bg-amber-600/15 fill-slate-700" />;' }),
    ).toEqual(["bg-amber-600", "fill-slate-700"]);
    // It recurses, and it reads `.ts` as well as `.tsx` — `lib/map/continent-theme.ts` alone
    // held 112, and a collector that only walked its root would have reported this branch done.
    expect(seenIn({ "nested/deep/theme.ts": 'export const C = "border-teal-500";' })).toEqual([
      "border-teal-500",
    ]);
  });

  it("does not see what it must not — synthetic negative control", () => {
    // A test file is not product code, which is why the 939 is not the 1017 the regex matches.
    expect(seenIn({ "probe.test.tsx": 'const a = "text-rose-500";' })).toEqual([]);
    // A bracketed literal is the SAME colour and is deliberately arm 2's, not arm 1's: the two
    // arms partition the population, and folding them would make one number nobody can act on.
    expect(seenIn({ "probe.tsx": 'const a = <div className="bg-[#ea580c]" />;' })).toEqual([]);
    // A bridge token, a shade that is not in the palette scale, and a token that merely ends
    // like one. None of these is a raw palette class.
    expect(
      seenIn({
        "probe.tsx":
          'const a = <div className="bg-primary text-warning-strong fill-[var(--region-marmara)] border-teal-550 bg-my-rose-500" />;',
      }),
    ).toEqual([]);
  });

  it("walks real files, not an empty scope — real-tree control", () => {
    // Deliberately NOT `collectPaletteOccurrences(["components"]).length > 0`: that is the
    // population this arm exists to drive to zero, so it would have gone red on the commit that
    // finished the job. The arbitrary arm used to be the witness here, but T-031d Task 11 fixed
    // the header wordmark -- the tree's last bracketed colour literal -- so that arm's real
    // population is now 0 too, for the same reason. The inline arm shares `sourceFiles` with
    // both, and its painted map-surface pins and canvas fills (`INLINE_PINNED`) are not going
    // anywhere, so the witness moves there.
    expect(collectInlineColorOccurrences(["components"]).length).toBeGreaterThan(0);
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
/**
 * THE END STATE OF THIS ARM. `ARBITRARY_COLOR_BUDGET = 72` had not moved for twelve commits,
 * so a `<=` on it was a tripwire armed against the least likely failure this repo has.
 *
 * AND 72 DID GO TO ZERO, in this very commit. An earlier version of this note said it would
 * not — "these are painted map surfaces, and a sea plate measured against a fixed backdrop is
 * not a decoration anybody is retiring" — and that was true of the SURFACES and false of the
 * spellings. T-031d did not retire the surfaces; it gave them names. Every one of the 72
 * bracketed literals became a `--map-*` token reference, which `inlinesAColor` does not count,
 * and the last row of `ARBITRARY_PINNED` went with the header wordmark's hex.
 *
 * What changed is WHAT IT COUNTS. `ARBITRARY_PINNED` names every file that legitimately holds
 * a bracketed colour and the exact number it holds; every other file must read 0. A new
 * `bg-[#ea580c]` in a component now fails by name, where before it was absorbed by a 72-wide
 * allowance that also covered eight map files. With the table empty, that is a literal zero
 * across the tree, held by the stray assertion below and by the emptiness assertion at the
 * foot of this file.
 */

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

  const byFile = new Map<string, number>();
  for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
  const pinned = new Set(ARBITRARY_PINNED.map((e) => e.file));

  it("has no bracketed colour value in any file that is not a named surface", () => {
    const stray = [...byFile.entries()].filter(([file]) => !pinned.has(file));
    expect(
      stray,
      `a bracketed colour outside \`ARBITRARY_PINNED\` is a palette class rewritten as a ` +
        `literal value, not progress. Found: ${stray.map(([f, n]) => `${f} (${n})`).join(", ")}`,
    ).toEqual([]);
  });

  /**
   * `it.each(ARBITRARY_PINNED)` ("$file holds exactly $count", plus the reason-length and
   * still-in-the-tree checks) IS DELETED for the reason the raw arm's two cases above are:
   * `ARBITRARY_PINNED` is `[]`, so it registered zero test cases in the commit that emptied it.
   * The `pinned` set it fed is kept — it is what makes the stray assertion above say "any file
   * at all", and an empty set is a meaningful input there where an empty `it.each` is not.
   * Restore this case together with any row that goes back into the table.
   */

  it("collects something at all — positive control", () => {
    // The same anti-vacuity guard the first arm carries: a budget satisfied by an empty result
    // is not a budget. This one had to go synthetic for the reason arm 1's own real-tree
    // control did: T-031d Task 11 fixed the header wordmark, the tree's last bracketed colour
    // literal, so `collectArbitraryColorOccurrences` is now 0 on every real root, including
    // `["components"]`. A temp file this test writes and deletes proves the actual collector
    // function -- not just `inlinesAColor` in isolation, which the launder-spelling cases above
    // already cover -- sees a real match end to end.
    const dir = mkdtempSync(join(tmpdir(), "t11-arb-"));
    try {
      writeFileSync(join(dir, "probe.tsx"), 'const a = <div className="bg-[#ea580c]" />;', "utf8");
      expect(collectArbitraryColorOccurrences([dir]).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
/**
 * THE END STATE OF THIS ARM, and it was already half-built: `INLINE_EXEMPT` pinned each
 * no-stylesheet file's count with `toBe`, and then a separate `<=` budget of 16 covered
 * everything else as one number. That number was the sum over six files, so a new `fillStyle`
 * in a seventh passed as long as a dead gradient stop went in the same commit — the same hole
 * the other two arms had, in the arm that had already solved it once.
 *
 * The global budget is gone. Every occurrence is now either a no-stylesheet row
 * (`INLINE_EXEMPT`, **22**) or a painted-surface row (`INLINE_PINNED`, **11**) — 33 in total;
 * the split was 22/11 and not the 17/16 it started as, because `base-map-svg.ts`'s five moved
 * from the live half into the exempt one where they belonged. Each row carries a file, an
 * exact count and a reason; anything else is a failure. The LIVE count is therefore **0 by
 * construction** rather than 16 by allowance, and it is asserted as a literal zero below.
 *
 * `lib/map/base-map-svg.ts` moved from the live half into `INLINE_EXEMPT` while this was
 * written, and it belonged there from the start: it builds standalone SVG documents served
 * through `<img src>`, which cannot see the page's CSS — the same reason `lib/brand/glyph.ts`
 * was already exempt — and `base-map-svg.test.ts` pins each of its five hexes byte-for-byte to
 * the globals.css token it transcribes.
 *
 * T-031d Task 10 dropped `INLINE_PINNED`'s three-count `v2-world-map-explorer.tsx` row — the
 * dead ocean gradient's stops, deleted along with the gradient — so the live split is 22/8,
 * 30 in total, not 22/11/33 any more.
 */

describe("a colour cannot hide outside a class either", () => {
  const found = collectInlineColorOccurrences();
  const named = (o: { file: string }) => isInlineExempt(o.file) || isInlinePinned(o.file);
  const live = found.filter((o) => !named(o));
  const byFile = new Map<string, number>();
  for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);

  it("leaves nothing unnamed — the live count is zero, not a budget", () => {
    const stray = new Map<string, number>();
    for (const o of live) stray.set(o.file, (stray.get(o.file) ?? 0) + 1);
    expect(
      [...stray.entries()],
      `a colour written into an SVG attribute, a prop, a canvas call or a module constant is ` +
        `still a colour, and neither other arm can see it. Give it a row in \`INLINE_EXEMPT\` ` +
        `(no stylesheet can reach it) or \`INLINE_PINNED\` (a painted surface, with the figure ` +
        `it was measured at), or remove it. Found: ${[...stray.entries()]
          .map(([f, n]) => `${f} (${n})`)
          .join(", ")}`,
    ).toEqual([]);
  });

  it.each(INLINE_PINNED)("$file is pinned at exactly $count", (entry) => {
    expect(
      byFile.get(entry.file) ?? 0,
      `${entry.file} is pinned for ${entry.count} (${entry.why}) but carries ${
        byFile.get(entry.file) ?? 0
      }`,
    ).toBe(entry.count);
    expect(entry.why.length, `${entry.file} is pinned without a reason`).toBeGreaterThan(20);
    expect(existsSync(entry.file), `${entry.file} is pinned but is not in the tree`).toBe(true);
  });

  it("collects something at all, and the halves add up — positive control", () => {
    expect(collectInlineColorOccurrences(["components"]).length).toBeGreaterThan(0);
    // Not three numbers nobody reconciles: exempt + pinned + live IS the whole, and live is 0.
    const exempt = found.filter((o) => isInlineExempt(o.file)).length;
    const pinnedCount = found.filter((o) => isInlinePinned(o.file)).length;
    expect(exempt + pinnedCount + live.length).toBe(found.length);
    expect(exempt).toBe(INLINE_EXEMPT.reduce((n, e) => n + e.count, 0));
    expect(pinnedCount).toBe(INLINE_PINNED.reduce((n, e) => n + e.count, 0));
    // No file may sit in both tables: the two reasons are mutually exclusive, and a file in
    // both would be counted twice by the reconciliation above and hide a real occurrence.
    expect(INLINE_EXEMPT.filter((e) => isInlinePinned(e.file))).toEqual([]);
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

/**
 * T-031d Task 11 emptied both deferral tables: the raw-palette arm's `RAW_EXEMPT` and the
 * arbitrary-colour arm's `ARBITRARY_PINNED` each held their last row (the world map's 15
 * classes, the header wordmark's one bracketed hex) and both are now `[]`. This is the
 * checkable version of that fact — a literal zero on the tables themselves, not just on the
 * trees the other describes above walk, so a row added back to either fails here by name.
 */
it("the deferral tables are empty — the arm is closed, not budgeted", () => {
  expect(RAW_EXEMPT).toEqual([]);
  expect(ARBITRARY_PINNED).toEqual([]);
});
