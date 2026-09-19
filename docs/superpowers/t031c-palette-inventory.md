# T-031c — raw palette inventory

**939 occurrences across 41 product files, one verdict each.** This table is the decision.
Tasks 3-N apply it; they do not re-open it. A row applied differently from its verdict means
the row is edited first and the change explained.

## How the number was produced

`scripts/palette-inventory.mjs` is the one reader. Run it:

```bash
node --input-type=module -e "
import { collectPaletteOccurrences } from './scripts/palette-inventory.mjs';
const all = collectPaletteOccurrences();
console.log('total', all.length);
"
```

Measured 2026-09-19, over `components/**`, `app/**` and `lib/**`, `.ts` and `.tsx`:

| Set                                                 | Occurrences | Files  |
| --------------------------------------------------- | ----------- | ------ |
| Everything the regex matches                        | 1017        | 46     |
| minus test files (`*.test.*`)                       | −13         | −4     |
| minus `app/[locale]/(site)/turkiye/[slug]/page.tsx` | −65         | −1     |
| **this branch's scope**                             | **939**     | **41** |

The four test files are `components/patterns/patterns-contract.test.ts` (5),
`components/v2/v2-map-pan-bounds.test.ts` (4), `components/v2/page-composition-cards.test.ts` (2)
and `components/v2/v2-batch6-a11y-polish.test.ts` (2) — assertions about the palette, not uses
of it. `lib/theme/*.test.ts` is filtered by the same rule. The excluded page is T-033's; its 65
occurrences are cleared there, not here.

**`lib/` is in the roots, and that is the whole of fix round 1.** The first cut scanned only
`components/**` and `app/**` and found 787 in 38 files. Three `lib/` modules hold the
**definitions** of hues those files merely spend: `lib/map/continent-theme.ts` (112),
`lib/earthquake/fault-lines-data.ts` (24) and `lib/marine/sea-basins-detail.ts` (16) — 152 more.
The first draft of this document named them in an aside as a blind spot the counter would never
see. An aside is a number living in a document, which is the exact defect this branch exists to
remove ("it moved 749 → 895 → 865 while living only in a comment"). They are in the count.

By hue: amber 223, emerald 167, teal 106, cyan 95, rose 76, sky 45, orange 40, red 39, blue 32,
purple 30, indigo 24, yellow 23, stone 23, slate 14, green 1, violet 1.

By line: 499 source lines carry them. 161 of those also carry a hand-written `dark:`; 338 do not,
so roughly two thirds of the affected lines have no dark-mode treatment at all. **Measured against
the full source line, not the collector's truncated `context` field** — `context` stops at 120
characters, and a `dark:` past that point reads as absent. The first cut of this document made
exactly that mistake and reported 117/298 over the 787-row scope where the real split was 123/292.
Every `semantic` row deletes its `dark:` pair in the same edit, so an applier working from the
wrong split leaves strays behind.

## The three verdicts

- **`data`** — encodes a value, a category or a safety band. Binds to a **data token set**
  (`--region-*`, `--eq-mag-1..5`, `--game-*`, `--map-*`, `--chart-*`, or one of the four sets
  named below that do not exist yet). Never to a bridge token: brand chrome does not encode data
  (`docs/design.md` rule 1). 500 rows.
- **`semantic`** — means success, warning, danger, information or brand accent. Binds to the
  matching bridge token (`--success` / `--warning` / `--destructive` / `--info` / `--primary` and
  their `-strong` members), and its hand-written `dark:` pair is deleted in the same edit.
  170 rows.
- **`decoration`** — means nothing. A topic tint, per-card variety, an ornamental wash, a bullet
  before a label that already says the thing. It is **removed**, not re-tokenised. 269 rows.

### Two rulings the brief left open, applied throughout

1. **Semantic beats decoration when the hue means one of the five.** `docs/design.md` rule 3 says
   a `decoration` verdict is only available where text, icon, pattern or shape already carries the
   meaning — and in almost every callout on this site an icon does. Read literally, that would let
   `decoration` swallow every warning banner on the site. It does not: if the hue means success,
   warning, danger, information or brand accent, the row is `semantic` and binds to the family that
   exists for it. `decoration` is reserved for hues that mean **nothing at all** — and those rows
   still name the carrier, because removing a tint must leave the meaning intact.
2. **A hue that varies per card is card identity, not meaning.** `v2-game-hub.tsx` paints its
   three feature checklists emerald, teal and cyan. A tick that meant "yes" would not change hue
   between cards. Those are `decoration`. A tick that is emerald everywhere on its page
   (`v2-tools-hub.tsx`'s "✓ Var" column) means yes, and is `semantic`.

### Data token sets that do not exist yet

Four sets are named by `data` rows below and have to be created before those rows can be applied.
None of them is a bridge token, and none may be satisfied by one:

Every `Rows` figure below is the sum of the `#` column of every row whose `Becomes` names that
set — derived from the table, never carried forward from a previous draft. `--basin-*` is the
reason the rule is written down: it was 49 in the first cut against a real 64, and the fix round
added 16 new `lib/` rows to the wrong base and produced 65 instead of 80. Re-derive on every
re-pin.

| Set             | Members                                                                   | Rows | Definition lives in                       | Derivation (`#` sums)                                                                                                          |
| --------------- | ------------------------------------------------------------------------- | ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--continent-*` | avrupa, asya, afrika, kuzey-amerika, guney-amerika, okyanusya, antarktika | 161  | `lib/map/continent-theme.ts` (112)        | `continent-theme` 112 + `v2-world-continents` 49. Five further files read `CONTINENT_META` without re-spelling a hue.          |
| `--basin-*`     | karadeniz, marmara, ege, akdeniz                                          | 80   | `lib/marine/sea-basins-detail.ts` (16)    | `v2-marine-map-explorer` 20 + `deniz/kiyi-tipleri` 20 + `v2-marine-basin-cards` 20 + `sea-basins-detail` 16 + `bolge/[slug]` 4 |
| `--fault-*`     | kaf, daf, bafs                                                            | 48   | `lib/earthquake/fault-lines-data.ts` (24) | `fault-lines-data` 24 + `deprem/page` 21 + `deprem/fay-hatlari` 3                                                              |
| `--sst-band-*`  | cool (<25 °C), warm (25-28 °C), hot (≥28 °C)                              | 12   | nowhere — inline in the component         | `v2-marine-map-explorer` 12                                                                                                    |

**Correction to the `--sst-band-*` row, made while applying it (Task 6).** "Nowhere — inline in
the component" undercounts the problem, and the `Rows` figure of 12 is right only because the
other two spellings are invisible to the raw-palette collector. The ramp shipped **three** times
inside `v2-marine-map-explorer.tsx`: the 12 rows above (the table chips, as utility classes), the
map station pins (raw SVG `fill` attributes `#2563eb` / `#0d9488` / `#ea580c` — Tailwind v3 hexes
the repo stopped shipping at the v4 upgrade, counted by NEITHER arm because a bare hex in a TS
string is not a class), and the legend strip that tells the reader what the pin colours mean
(`bg-[#ea580c]`, `bg-[#0d9488]`, `bg-[#2563eb]` — counted by the arbitrary arm, and named in
`raw-palette-count.test.ts`'s `LAUNDERED` list). All three carried the same two thresholds
independently. Task 6 binds all three to `lib/theme/sst-band.ts`; the arbitrary arm moves 75 → 72
for the legend's three.

Three of the four have their definition in `lib/`, which is why widening the roots mattered:
each set had a source file spelling the hue and a call site re-spelling it, and a count that saw
only the call site would have gone to zero while the definition still held the raw class.
`--basin-*` is the largest of the four by call sites and the one whose four spellings already
agree, so it is the cheapest to author and the easiest to get wrong by undercounting.

`--region-*-tint` and `--region-*-text` are the fifth and are already Task 3's; 161 rows below
depend on them, by the same derivation (`v2-turkey-map-explorer` 70 + `bolge/[slug]` 56 +
`v2-game-screen` 21 + `v2-turkey-regions` 14). The region set is the one whose definition is **already** a token —
`--region-*` is in `app/globals.css` — which is exactly why its four call sites contradict it and
the continent set does not.

## Measured figures the notes quote

Produced with `lib/theme/contrast.ts` (`ratio`, `blendOver`) and `lib/theme/delta-e.ts`
(`deltaE00`, `CATEGORICAL_MIN = 10`) on 2026-09-19. A tinted chip is measured against the blend,
not against the token.

**The raw mid hues fail as text, which is why most of this is a fix and not a preference.**
`text-*-600` on the light `--card` (#ffffff), against the 4.5:1 floor:

| amber-600 | yellow-600 | orange-600 | cyan-600 | teal-600 | emerald-600 | sky-600 | rose-600 | red-600 |
| --------- | ---------- | ---------- | -------- | -------- | ----------- | ------- | -------- | ------- |
| 3.19      | 2.94       | 3.56       | 3.68     | 3.74     | 3.77        | 4.10    | 4.70     | 4.83    |

`text-*-700` with no `dark:` pair, on the dark `--card` (#121e21): rose-700 2.71, emerald-700 3.10,
teal-700 3.11, cyan-700 3.18, amber-700 3.39. All fail. `text-*-500` icon tints on the light
`--card`: amber-500 2.15, emerald-500 2.54, sky-500 2.77, rose-500 3.67 — below even the 3:1
graphical floor, so the icons they tint are the least legible marks on their pages.

**What the bridge `-strong` members measure**, as text on a tint of their own base over `--card`
— the job these rows hand them:

| Family      | light /5 | light /10 | light /15 | dark /5 | dark /10 | dark /15 |
| ----------- | -------- | --------- | --------- | ------- | -------- | -------- |
| success     | 7.02     | 6.56      | 6.09      | 8.24    | 7.61     | 7.05     |
| warning     | 6.48     | 6.18      | 5.87      | 8.89    | 8.18     | 7.36     |
| info        | 7.63     | 7.07      | 6.60      | 8.14    | 7.50     | 6.95     |
| destructive | 7.11     | 6.58      | 6.12      | 7.66    | 7.18     | 6.75     |
| primary     | 7.81     | 7.32      | 6.81      | 7.77    | 7.31     | 6.82     |

Every cell clears 4.5:1 in both themes, which no raw pairing above does. The base member is not
interchangeable with `-strong`: `--color-warning` as text on its own 15% tint measures **2.62:1**.

**Solid fills** (a dot, a swatch, a filled badge) against `--card`, 3:1 graphical floor:
light success 5.82, danger 5.90, primary 5.13, warning 3.04; dark success 5.49, warning 7.53,
primary 4.99, destructive 4.89. `--warning-foreground` (`--color-ink-dark`) on a solid
`--color-warning` measures 5.54 light and 7.46 dark; white on it is 3.04 and is never used.

**Region set**, seven Okabe-Ito hues: worst pair ege/ic-anadolu ΔE00 **21.7**, well over
`CATEGORICAL_MIN` 10 — the hues are fine as fills. As _text_ on white they are not: ic-anadolu
1.32, ege 2.25, akdeniz 2.31, karadeniz 3.06, dogu-anadolu 3.42, guneydogu-anadolu 3.87,
marmara 5.19. Six of seven fail, which is what `--region-*-text` exists to fix (Task 3 Step 3).

**Earthquake ramp**, `--eq-mag-1..5`: adjacent ΔE00 8.1 / 7.8 / 9.2 / 10.0 — a sequential ramp, so
the categorical floor does not apply. On the light `--card` the five steps measure 4.69, 6.43,
9.01, 13.15, 17.21; on the **dark** `--card` they measure 3.63, 2.65, 1.89, 1.29, **1.01**. The
upper half of a public-safety magnitude scale is invisible in dark mode. Binding to the ramp is
still right and is what the rows below say; **re-lighting the dark ramp is T-031d's**, recorded
here so it is not lost.

## A row type the brief did not anticipate: 14 occurrences inside comments

Fourteen occurrences are not classes at all. They are class names quoted inside explanatory
comments — `deprem/fay-hatlari/page.tsx` (9), `deniz/kiyi-tipleri/page.tsx` (4) and
`deniz/page.tsx` (1) all record why a previous ruling went the way it did and cite the literal
spelling. Nothing renders them, so no bridge token and no data token applies; but the counter
counts them, so the branch cannot reach zero while they are spelled that way.

They are filed as `decoration` with a narrow meaning of "removed": the **literal spelling** goes,
the rationale stays. `` `text-red-600` `` becomes "a raw red-600 text class" in the same sentence.
The carrier is the comment's own prose. Deleting the comments would be the wrong reading of this
verdict and is not what these rows say.

---

### app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx (113)

The correctness bug lives in the first 56 rows: every region's badge, accent, gradient and border
is a hue unrelated to the `--region-*` token its own map fill uses. Six of seven disagree.

| Line      | Class(es)                                                                                                                                                  | #   | Verdict    | Becomes                                                           | Note                                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 62-65     | `bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30`, `from-amber-500/10`, `text-amber-600 dark:text-amber-400`, `border-amber-500/30` | 8   | data       | `--region-marmara-tint` / `-text`                                 | Marmara's badge, gradient, accent and border. `--region-marmara` is #0072b2 (blue) — the page says amber and paints blue. Task 3 fixes this.                                              |
| 71-74     | the teal set                                                                                                                                               | 8   | data       | `--region-ege-*`                                                  | `--region-ege` is #e69f00 (orange). Disagrees.                                                                                                                                            |
| 80-83     | the emerald set                                                                                                                                            | 8   | data       | `--region-akdeniz-*`                                              | `--region-akdeniz` is #56b4e9 (sky blue). Disagrees.                                                                                                                                      |
| 89-92     | the yellow set                                                                                                                                             | 8   | data       | `--region-ic-anadolu-*`                                           | `--region-ic-anadolu` is #f0e442 (yellow). Agrees, by coincidence; still binds.                                                                                                           |
| 98-101    | the cyan set                                                                                                                                               | 8   | data       | `--region-karadeniz-*`                                            | `--region-karadeniz` is #cc79a7 (reddish purple). Disagrees.                                                                                                                              |
| 107-110   | the stone set                                                                                                                                              | 8   | data       | `--region-dogu-anadolu-*`                                         | `--region-dogu-anadolu` is #009e73 (bluish green). Disagrees.                                                                                                                             |
| 116-119   | the orange set                                                                                                                                             | 8   | data       | `--region-guneydogu-anadolu-*`                                    | `--region-guneydogu-anadolu` is #d55e00 (vermillion). Nearest of the seven, still not it.                                                                                                 |
| 463       | `bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30`                                                                                       | 4   | decoration | removed                                                           | "N Denize Kıyı" count badge. The `Waves` glyph and the number carry it; cyan names no particular sea here.                                                                                |
| 510       | `text-teal-600`                                                                                                                                            | 1   | decoration | removed                                                           | `Maximize2` icon on the "Yüzölçümü" tile; the tile label is right beside it. 3.74:1 on the light card today.                                                                              |
| 527       | `text-amber-600`                                                                                                                                           | 1   | decoration | removed                                                           | `Mountain` icon on "Nüfus Yoğunluğu". 3.19:1.                                                                                                                                             |
| 542       | `text-rose-600`                                                                                                                                            | 1   | decoration | removed                                                           | `TrendingUp` icon on "GSYH Ağırlığı".                                                                                                                                                     |
| 731       | `bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25`                                                                                       | 4   | data       | `--basin-*` per sea                                               | These chips name a **specific** sea each (`region.coastalSeas`), all painted one cyan — while `v2-marine-basin-cards` paints Marmara amber and Ege teal. Two values, two colours: `data`. |
| 843-860   | `bg-amber-500/10 border-amber-500/25`, `text-amber-800 dark:text-amber-300`, `text-amber-600`, `text-amber-700 dark:text-amber-400`                        | 7   | decoration | removed                                                           | "Bölgenin En Yüksek Zirvesi" banner. The `Mountain` icon, the label and the `m` unit carry it; amber is an elevation _mood_, and the page has no elevation scale.                         |
| 880-885   | `bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30`, `text-amber-600`                                                                 | 5   | decoration | removed                                                           | "Jeomorfoloji & Dağlar" pillar badge + `Mountain`. Topic tint; badge text and icon carry it.                                                                                              |
| 900-905   | the teal pair                                                                                                                                              | 5   | decoration | removed                                                           | "Klimatoloji & Vejetasyon" pillar + `CloudSun`. Same shape.                                                                                                                               |
| 920-925   | the cyan pair                                                                                                                                              | 5   | decoration | removed                                                           | "Hidrografya & Su Ağı" pillar + `Droplets`. Same shape.                                                                                                                                   |
| 1005-1010 | `bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30`, `text-amber-600`                                                                 | 5   | decoration | removed                                                           | Economy pillar badge + `BarChart3`. Same shape.                                                                                                                                           |
| 1017-1019 | `bg-amber-500/10 border-amber-500/25`, `text-amber-800 dark:text-amber-300`                                                                                | 4   | decoration | removed                                                           | "Türkiye GSYH Tahmini Katkısı" callout; the label and the figure carry it, and the figure is already `text-foreground`.                                                                   |
| 1156      | `text-teal-600`                                                                                                                                            | 1   | decoration | removed                                                           | `Maximize2` on "En Geniş İl".                                                                                                                                                             |
| 1170      | `text-amber-600`                                                                                                                                           | 1   | decoration | removed                                                           | `BarChart3` on "Ortalama İl Nüfusu".                                                                                                                                                      |
| 1266      | `border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/15`                                                                                                     | 3   | semantic   | `border-destructive/30 bg-destructive/5`                          | The "Doğal Afet ve Deprem Riski" card. Hazard, not a fault identity — it is regional risk prose, not KAF/DAF/BAFS. `destructive-strong` on a /5 tint measures 7.11 light, 7.66 dark.      |
| 1268      | `border-rose-500/20`                                                                                                                                       | 1   | semantic   | `border-destructive/20`                                           | its header rule                                                                                                                                                                           |
| 1273      | `bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30`                                                                                       | 4   | semantic   | `bg-destructive/15 text-destructive-strong border-destructive/30` | "Doğal Afet & Depremsellik" badge; the `dark:` pair goes with it (rose-700 measures 2.71:1 on the dark card today).                                                                       |
| 1279      | `text-rose-600`                                                                                                                                            | 1   | semantic   | `text-destructive-strong`                                         | `ShieldAlert` in the h2                                                                                                                                                                   |
| 1298      | `border-rose-500/20`                                                                                                                                       | 1   | semantic   | `border-destructive/20`                                           | "Sismik & Afet Özeti" card edge                                                                                                                                                           |
| 1301      | `text-rose-600`                                                                                                                                            | 1   | semantic   | `text-destructive-strong`                                         | `ShieldAlert` in its heading                                                                                                                                                              |
| 1335      | `bg-rose-500`                                                                                                                                              | 1   | semantic   | `bg-destructive`                                                  | risk bullet; solid fill, 5.90:1 on the light card and 4.89 on the dark one                                                                                                                |
| 1350      | `text-rose-600`                                                                                                                                            | 1   | semantic   | `text-destructive-strong`                                         | "Acil: 112" — the one place on the page where the hue must not be softened                                                                                                                |

**Totals:** data 60, semantic 13, decoration 40.

### lib/map/continent-theme.ts (112)

The single heaviest definition in the branch, and the reason `lib/` is in the roots. `CONTINENT_META`
is the continent palette; five product files import it (`v2-world-map-explorer`, `v2-member-hub`,
`dunya/[slug]`, `dunya/kita/page`, `dunya/kita/[slug]`) and spend it without re-spelling a hue, so
every one of the 112 is a definition, not a use. All 112 are `data` → `--continent-*`.

Nine fields per continent, 16 occurrences each, identical in shape across all seven:

| Field         | Paints                                         | Occ. |
| ------------- | ---------------------------------------------- | ---- |
| `color`       | the country fill on `/dunya`'s map (+ `dark:`) | 2    |
| `hoverColor`  | its hover fill (+ `dark:`)                     | 2    |
| `strokeColor` | the country outline                            | 1    |
| `badgeClass`  | the continent badge (+ `dark:` text)           | 4    |
| `headerClass` | the card header gradient                       | 2    |
| `borderClass` | the card edge                                  | 1    |
| `textClass`   | continent text (+ `dark:`)                     | 2    |
| `gradient`    | the `/dunya/[slug]` hero wash                  | 1    |
| `glowColor`   | the hero glow backdrop                         | 1    |

`gradient` and `glowColor` are `data` rather than `decoration`, and the argument is **not** that
the file's type comments call them "derived from the hue above". That is an appeal to a comment,
in a branch whose founding sentence is that a comment is not a guard; it stops being true the
moment someone deletes the comment. Two things hold without it:

- **The brief's tiebreaker, applied directly.** Seven continents want seven different colours in
  that exact spot, and the field is interpolated per continent at `dunya/[slug]:298,302` and
  `dunya/kita/[slug]:108,112` (`bg-gradient-to-b ${theme.gradient}` and the glow `<div>`). Two
  values that could want two colours in one spot is `data`, without exception.
- **The set has a genuine data surface.** `color: "fill-indigo-600/85"` paints the country on
  `/dunya`'s world map, where the hue is the only thing saying "Europe" — no label, no glyph. The
  wash is the same identity at low alpha on a page that surface leads to. That is precisely what
  `v2-tools-hub` lacked: there the set had brand members and no data surface anywhere, so the same
  shape decided the other way.

The brief does name "a gradient wash" as a `decoration` archetype, and that is not a contradiction:
the archetype is a **constant** wash. One that changes with a categorical value is not a wash, it
is the value. They bind to a `--continent-*` tint; deleting them would leave the hero with no
continent signal but the badge.

**Four** of the nine fields carry a hand-written `dark:` — `color`, `hoverColor`, `badgeClass` and
`textClass`, seven occurrences each, so **28 of the 112** are the dark half of a pair.
`strokeColor`, `headerClass`, `borderClass`, `gradient` and `glowColor` carry none. Across all
three `lib/` files it is 38 of 152 (continent-theme 28, fault-lines-data 6, sea-basins-detail 4).

**Count the variant chain, not the prefix.** `hoverColor`'s dark half is
`dark:hover:fill-indigo-400` — `dark:` is not adjacent to the property. A count that looks for
`dark:` immediately before the class misses all seven of them and reports 21 where the answer is
28; an earlier cut of this document reported 31 by attributing the whole-`lib/` figure to this one
file. An applier walking these rows has to match `dark:` anywhere in the chain, or it will leave
the hover pairs behind after deleting the rest.

Those pairs do not survive the binding: a data token is redefined per theme in `app/globals.css`,
which is where the light/dark decision belongs. Removing them is the normal outcome of binding
correctly.

| Line    | Class(es)                    | #   | Verdict | Becomes                          | Note                                                                                                                                                                                                                              |
| ------- | ---------------------------- | --- | ------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39-48   | the nine indigo/blue fields  | 16  | data    | `--continent-avrupa` + tint/text | AVRUPA. `v2-world-continents.tsx:45-47` spells the same identity a second time in the same hue family but different stops (`from-indigo-600 to-blue-700` against this file's `from-indigo-700 to-blue-900`). One token ends both. |
| 53-62   | the nine amber/orange fields | 16  | data    | `--continent-asya`               | ASYA                                                                                                                                                                                                                              |
| 67-76   | the nine emerald fields      | 16  | data    | `--continent-afrika`             | AFRIKA                                                                                                                                                                                                                            |
| 81-90   | the nine sky/cyan fields     | 16  | data    | `--continent-kuzey-amerika`      | KUZEY_AMERIKA                                                                                                                                                                                                                     |
| 95-104  | the nine rose fields         | 16  | data    | `--continent-guney-amerika`      | GUNEY_AMERIKA                                                                                                                                                                                                                     |
| 109-118 | the nine purple fields       | 16  | data    | `--continent-okyanusya`          | OKYANUSYA                                                                                                                                                                                                                         |
| 123-132 | the nine teal fields         | 16  | data    | `--continent-antarktika`         | ANTARKTIKA. The seven-hue set must clear ΔE00 ≥ 10 pairwise under normal vision and all three CVD simulations before it is authored, the floor `--region-*` holds at 21.7.                                                        |

**Totals:** data 112, semantic 0, decoration 0.

**The bug this file already fixed once, one level up.** Its own docblock records `DES133-I1`: the
`[slug]` page used to keep a second, independently chosen continent palette whose hues disagreed
with the map's on six of seven continents. The fix was to move `CONTINENT_META` here and have both
consumers read it. `v2-world-continents.tsx` still holds a third spelling (49 rows, same hue
families, different stops). Binding the definition to a token is the same fix applied one level
deeper, and it is the reason a count that saw only call sites would have been misleading.

### components/v2/v2-turkey-map-explorer.tsx (78)

| Line    | Class(es)                                                                | #   | Verdict  | Becomes                                               | Note                                                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------ | --- | -------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 73-77   | `fill-amber-600`, badge/header/border/text amber set                     | 10  | data     | `--region-marmara` + its tint/text                    | `color` here **is** the map fill. It and the badge beside it are one region identity and must be one token. Same bug as `bolge/[slug]`, same fix.                                                                                                                                 |
| 83-87   | the teal set                                                             | 10  | data     | `--region-ege` + tint/text                            |                                                                                                                                                                                                                                                                                   |
| 93-97   | the emerald set                                                          | 10  | data     | `--region-akdeniz` + tint/text                        |                                                                                                                                                                                                                                                                                   |
| 103-107 | the yellow set (`from-yellow-800 to-amber-950`)                          | 10  | data     | `--region-ic-anadolu` + tint/text                     | the header gradient crosses two families, which is how far the raw set had drifted                                                                                                                                                                                                |
| 113-117 | the cyan set (`from-cyan-800 to-slate-900`)                              | 10  | data     | `--region-karadeniz` + tint/text                      |                                                                                                                                                                                                                                                                                   |
| 123-127 | the stone set                                                            | 10  | data     | `--region-dogu-anadolu` + tint/text                   |                                                                                                                                                                                                                                                                                   |
| 133-137 | the orange set                                                           | 10  | data     | `--region-guneydogu-anadolu` + tint/text              |                                                                                                                                                                                                                                                                                   |
| 1032    | `bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300` | 4   | semantic | `bg-warning/10 border-warning/30 text-warning-strong` | **[backdrop corrected — see "APPLIED, Task 4" note 1 below]** "…filtresi etkinken X bulunamadı" — a caution that a filter is suppressing results, not neutral information. The 6.18 light / 8.18 dark here is the figure over `--card`; the page paints this over `--background`. |
| 1034    | `text-amber-600`                                                         | 1   | semantic | `text-warning-strong`                                 | the `Info` glyph in that banner. **[backdrop corrected — see note 1 below]**                                                                                                                                                                                                      |
| 1048    | `border-amber-500/40 text-amber-800 dark:text-amber-200`                 | 3   | semantic | `border-warning/40 text-warning-strong`               | the "Tüm İllerde Ara" escape button inside it — an **opaque pair** on its own `bg-card`. **[see note 1 below]**                                                                                                                                                                   |

**Totals:** data 70, semantic 8, decoration 0.

**APPLIED, Task 4 — all 78, with two rows corrected before applying.**

1. **Rows 1032/1034/1048 named the wrong backdrop.** The `Becomes` column is unchanged and the
   figures 6.18 light / 8.18 dark are correct for `--card` — but this banner is a child of a bare
   `<section>`, so its tint composites over `--background`. Over the surface the page actually
   paints, `--warning-strong` on `--warning/10` measures **5.81:1 light and 9.19:1 dark** from
   painted pixels at 320 and 1280; the model (`blendOver`) says 5.86 / 9.10.

   **The cause of that gap, corrected.** An earlier version of this note and of the comment in
   the component blamed `color-mix(in oklab, …)`. That is wrong and the correction matters more
   than the row: mixing with `transparent` is PREMULTIPLIED, so the second colour contributes
   nothing and only alpha scales — in any interpolation space. Across 486 painted cases
   (9 fills x 6 backdrops x 9 alphas) `color-mix(in oklab, C P%, transparent)` and `rgb(C / P)`
   paint identically in 408 and differ by one byte in 76. The real gap is **±1 byte per channel
   from 8-bit alpha quantisation**, and its direction is **not systematic**: in the 2.5-8 band
   that decides pass/fail, 126 cases where the model flatters and 123 where it is harsher, max
   |Δratio| 0.113. Here it flatters by 0.05 in light and is conservative by 0.09 in dark.
   `blendOver` does not systematically flatter and **every analytic figure recorded in this
   branch stands**; painted figures are recorded where they exist because they are painted, not
   because the model leans.

   The escape button supplies its own `bg-card`, so its label is an **opaque pair** —
   `--warning-strong` on `--card`, no alpha anywhere, so the analytic 6.81 light / 9.64 dark is
   exact by construction (a paint confirmed 6.814).

2. **Rows 73-137 are single-sourced, not merely re-tokenised.** The verdict `--region-* + tint/text`
   is applied through `lib/theme/region-identity.ts`, which is now the ONE module that turns a
   `--region-*` token into a class; `bolge/[slug]`, `v2-turkey-regions` and `v2-game-screen` were
   folded into it in the same commit. Four tables that agree are not the property "one colour per
   region" — they are four chances to disagree again.
3. `headerClass` was a two-stop gradient under `text-white`. It becomes the same tint banner the
   deck uses, and its count chip moves to `bg-background` rather than `bg-card`, which would have
   been a 189th hand-drawn card surface against `page-composition-cards.test.ts`'s recorded 188.

### components/v2/v2-marine-map-explorer.tsx (61)

| Line        | Class(es)                                                                                  | #   | Verdict    | Becomes                                               | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------ | --- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 82-83       | `fill-cyan-600`, `bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30`      | 5   | data       | `--basin-karadeniz` + tint/text                       | map fill and badge for one basin, exactly the region pattern one level down. `--basin-*` does not exist yet.                                                                                                                                                                                                                                                                                                                                                                         |
| 89-90       | the amber pair                                                                             | 5   | data       | `--basin-marmara`                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 96-97       | the teal pair                                                                              | 5   | data       | `--basin-ege`                                         | teal is the site-wide Aegean encoding (recorded in `deniz/kiyi-tipleri/page.tsx`'s comment)                                                                                                                                                                                                                                                                                                                                                                                          |
| 103-104     | the rose pair                                                                              | 5   | data       | `--basin-akdeniz`                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 337         | `text-cyan-600`                                                                            | 1   | decoration | removed                                               | `Waves` in the floating mode indicator; the basin name and the station count sit in the same pill.                                                                                                                                                                                                                                                                                                                                                                                   |
| 551-552     | `bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200`, `text-amber-600` | 5   | semantic   | `bg-warning/10 border-warning/30 text-warning-strong` | `ShieldAlert` advisory about model data; a caution. 6.18 light / 8.18 dark on its own /10 tint.                                                                                                                                                                                                                                                                                                                                                                                      |
| 572,574,583 | `bg-cyan-500/10 border-cyan-500/20`, `text-cyan-600` ×2                                    | 4   | decoration | removed                                               | the "Dalga Boyu" panel. The heading names the measure; the panel beside it is identical in teal for wind, so the hue is panel variety, not an encoding.                                                                                                                                                                                                                                                                                                                              |
| 589,591,602 | `bg-teal-500/10 border-teal-500/20`, `text-teal-600` ×2                                    | 4   | decoration | removed                                               | the "10m Rüzgâr" panel, same shape                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 700,707     | `text-cyan-600` ×2                                                                         | 2   | decoration | removed                                               | the same two measures repeated in the hover tooltip, labelled again                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 717,724     | `text-teal-600` ×2                                                                         | 2   | decoration | removed                                               | the wind measure in the same tooltip, carried by its own `"10m Rüzgâr:"` label and the `Wind` glyph on line 717                                                                                                                                                                                                                                                                                                                                                                      |
| 891         | `bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30`                       | 4   | data       | `--sst-band-cool` + text                              | sea-surface temperature **under 25 °C**. A geophysical ramp: stays standard, never restyled to Terra.                                                                                                                                                                                                                                                                                                                                                                                |
| 894         | the orange set                                                                             | 4   | data       | `--sst-band-hot`                                      | ≥ 28 °C                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 897         | the teal set                                                                               | 4   | data       | `--sst-band-warm`                                     | 25-28 °C. Note the collision the set has to resolve: this teal is also the Ege basin hue two hundred lines up, in the same component.                                                                                                                                                                                                                                                                                                                                                |
| 934         | `bg-amber-500 ring-2 ring-amber-400`                                                       | 2   | semantic   | `bg-primary ring-primary/50`                          | the **selected** station dot. Selection is brand accent; the row already carries `aria-selected` and `bg-primary/10`, so the dot joins them instead of inventing a third colour.                                                                                                                                                                                                                                                                                                     |
| 934         | `bg-cyan-500`                                                                              | 1   | decoration | removed                                               | the resting dot on the same line. Split from the row above because the verdicts differ. **Removed means the class goes, not the `<span>`:** this is a `size-2 rounded-full` element whose only visible content is its background, so the unselected station is left with an invisible dot and its name alone. That is the intended outcome — the dot never said anything the name did not — but an applier must not delete the element, because the selected branch still paints it. |
| 942         | `bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30`                   | 4   | decoration | removed                                               | the "Boğaz" badge; the badge's own word is the whole content.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 984,990     | `text-cyan-600` ×2                                                                         | 2   | decoration | removed                                               | wave measure in the selected-station card, labelled                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1003,1010   | `text-teal-600` ×2                                                                         | 2   | decoration | removed                                               | wind measure in the same card, labelled                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Totals:** data 32, semantic 7, decoration 22.

**LEFT FOR T-031d, unchanged and deliberately so.** This component also carries 11 arbitrary map
hexes that the raw-palette arm never sees and the arbitrary arm counts: the dark sea
(`bg-[#152228]`, `fill-[#152228]`), the province and neighbour-land fills (`fill-[#f1ece3]`,
`fill-[#2d2822]`, `fill-[#201c18]`), their hairlines (`stroke-[#b8aea0]`, `stroke-[#50473e]`),
the inland water (`fill-[#6ec7d1]`) and the coastline pair (`fill-[#635a4e]`, `fill-[#a89e92]`).
They are the same dark map surface `/turkiye` and `/dunya` draw, the binding cases are already
measured — **Türkiye's provinces vs neighbour land 1.17:1, neighbour land vs inland water
1.01:1**, both against a 3:1 floor — and the fix is a retune of `--map-*` / `--province-*`, which
is T-031d's work. Binding them here would move lines whose justification is a measurement T-031d
is about to redo.

One more hex stays for a different reason: `#f59e0b` on the SELECTED station pin, and `#ffffff`
on its stroke. Selection is UI state rather than a temperature, it has to win over whatever SST
band the station is in, and it is not part of the ramp this task binds. Task 6 left it as the
only literal in that block after `sstBandStyleOf` took the three band branches; the dead
`#0284c7` default it used to sit beside is gone, because the if/else chain overwrote it on every
path. The `#0284c7` that remains in the file is a `<stop>` in the decorative `marine-pulse`
radial gradient and encodes nothing.

### components/v2/v2-world-continents.tsx (55)

| Line    | Class(es)                                                                                                                                 | #   | Verdict    | Becomes                          | Note                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 45-47   | `from-indigo-600 to-blue-700`, `bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30`, `hover:border-indigo-500/50` | 7   | data       | `--continent-avrupa` + tint/text | `CONTINENT_META` is shared: `v2-world-map-explorer` paints the map with `continentMeta.color`. Card hue and map fill are one identity. |
| 66-68   | the amber set                                                                                                                             | 7   | data       | `--continent-asya`               |                                                                                                                                        |
| 87-89   | the emerald set (`from-emerald-600 to-green-700`)                                                                                         | 7   | data       | `--continent-afrika`             |                                                                                                                                        |
| 108-110 | the sky set (`from-sky-600 to-cyan-700`)                                                                                                  | 7   | data       | `--continent-kuzey-amerika`      |                                                                                                                                        |
| 129-131 | the rose set (`from-rose-600 to-red-700`)                                                                                                 | 7   | data       | `--continent-guney-amerika`      |                                                                                                                                        |
| 150-152 | the purple set (`from-purple-600 to-violet-700`)                                                                                          | 7   | data       | `--continent-okyanusya`          |                                                                                                                                        |
| 171-173 | the teal set (`from-teal-600 to-cyan-800`)                                                                                                | 7   | data       | `--continent-antarktika`         | the new set must clear ΔE00 ≥ 10 pairwise under normal vision and all three CVD simulations, as `--region-*` does at 21.7              |
| 264     | `text-amber-600 dark:text-amber-400`                                                                                                      | 2   | decoration | removed                          | `Mountain` before the literal label "Zirve:"                                                                                           |
| 273     | `text-cyan-600 dark:text-cyan-400`                                                                                                        | 2   | decoration | removed                          | `Waves` before "Nehir:"                                                                                                                |
| 282     | `text-emerald-600 dark:text-emerald-400`                                                                                                  | 2   | decoration | removed                          | `TreePine` before "İklim:"                                                                                                             |

**Totals:** data 49, semantic 0, decoration 6.

### components/v2/v2-game-screen.tsx (51)

| Line      | Class(es)                                                                                  | #   | Verdict    | Becomes                                               | Note                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------ | --- | ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 101-109   | `REGION_COLOR_CLASSES` — seven `fill-*/80 hover:fill-*` + `border-*`                       | 21  | data       | `--region-*`                                          | the region-finding mode paints the map by region: the same identity as the two files above, a third spelling of it. **The dark land/sea separation measures 1.17:1 against a 3:1 floor and is T-031d's, not this branch's.**      |
| 873, 880  | `bg-orange-500/15 text-orange-600` ×2, `text-orange-600`                                   | 3   | decoration | removed                                               | the streak counter. `Flame`, the label "Seri (Streak)" and a 🔥 in the value carry it.                                                                                                                                            |
| 925       | `text-amber-500`                                                                           | 1   | decoration | removed                                               | `HelpCircle` inside the "İpucu" button, whose own label is the word                                                                                                                                                               |
| 983-984   | `bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200`, `text-amber-600` | 5   | semantic   | `bg-warning/15 border-warning/30 text-warning-strong` | the hint panel says the question's maximum score has dropped by half. That is a caution, not neutral information. 5.87 light / 7.36 dark.                                                                                         |
| 1003      | `bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300`           | 4   | semantic   | `bg-success/15 border-success/30 text-success-strong` | the "correct" feedback bar. Its third sibling on line 1007 is **already** `bg-destructive/15 … text-destructive-strong`, so this is finishing a conversion, not starting one. 6.09 light / 7.05 dark.                             |
| 1005      | `bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300`                   | 4   | semantic   | `bg-warning/15 border-warning/30 text-warning-strong` | the "revealed" feedback bar, same family                                                                                                                                                                                          |
| 1121-1130 | `fill-emerald-500/80`, `stroke-emerald-700` (twice)                                        | 4   | data       | `--game-correct` / `--game-correct-edge`              | a correct answer is game state, and the tokens already exist. The sibling `isFlashingWrong` branch uses `fill-destructive/80` — a bridge token doing a data job, out of scope here but worth fixing in the same edit.             |
| 1132-1133 | `fill-amber-400/80`, `stroke-amber-700`                                                    | 2   | data       | `--game-reveal` / `--game-reveal-edge`                | revealed answer, same set                                                                                                                                                                                                         |
| 1273      | `text-orange-600`                                                                          | 1   | decoration | removed                                               | "En İyi Seri" summary tile; label and 🔥 carry it                                                                                                                                                                                 |
| 1285      | `text-amber-500 fill-amber-500`                                                            | 2   | semantic   | `text-primary fill-primary`                           | the three-star rating. The **count** of filled stars is the value; the gold is brand accent on an earned mark. Not `decoration`: removing it would leave a filled star and the `text-muted/40` empty one separated by fill alone. |
| 1332      | `bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400`           | 4   | semantic   | `bg-success/15 border-success/30 text-success-strong` | "Skor profilinize kaydedildi"; its `saveStatus === "failed"` sibling is already on `destructive`.                                                                                                                                 |

**Totals:** data 27, semantic 19, decoration 5.

**APPLIED, Task 4 — all 51. Three notes the rows did not carry.**

1. **7 of the 21 in `REGION_COLOR_CLASSES` were dead.** Only `.fill` was ever read; `.border` had
   no reader anywhere in the file. It is not carried over to the identity module rather than
   re-tokenised into a member nothing uses.
2. **Row 1132-1133 changes what the reveal LOOKS like, and that is the verdict, not a slip.**
   `--game-reveal` is #3f3a36, a dark near-neutral, where the raw class was `fill-amber-400/80`.
   `app/globals.css` states why: the reveal marker is deliberately the one dark, low-hue value
   because it has to read as "look here" over all seven region tints at once.
3. **Row 1121-1130's aside is applied.** `isFlashingWrong` used `fill-destructive/80` /
   `stroke-destructive` — a bridge token doing a data job. It goes to `--game-wrong` /
   `--game-wrong-edge` in the same edit. It is not a raw palette occurrence, so it moves no
   number; it is the third of three states that had to agree.

**LEFT FOR T-031d, unchanged and deliberately so.** The dark land/sea separation on this map is
arbitrary hexes, so the counter never saw them and no row above covers them: the stage is
`bg-[#dbe8ee] dark:bg-[#15232d]`, neighbour countries are `fill-[#e8edea] dark:fill-[#202b33]`,
inland water is `fill-[#a9ccdf] dark:fill-[#122b3d]`, and Türkiye's own provinces rest on
`fill-card` (#121e21 in dark). PAIRS NAMED, dark, against WCAG 1.4.11's 3:1 floor:

| dark pair                                     | ratio |
| --------------------------------------------- | ----- |
| province base fill `--card` vs neighbour land | 1.17  |
| province base fill `--card` vs inland water   | 1.16  |
| neighbour land vs inland water                | 1.01  |
| neighbour land vs the sea stage               | 1.11  |
| province base fill `--card` vs the sea stage  | 1.06  |

The binding case is the 1.17 — Türkiye against everything beyond its border — and the 1.01 means
a lake and a neighbouring country are the same tone in dark. These belong to the map token sets
(`--map-*`, `--province-*`), not to `--region-*` or `--game-*`, and T-031d redesigns that surface,
so binding them here would move lines whose justification is a measurement T-031d is about to
redo. The same applies to `v2-turkey-map-explorer`'s `fill-[#f1ece3] dark:fill-[#2d2822]` context
land and its `dark:bg-[#1a2529]` sea.

### app/[locale]/(site)/dunya/[slug]/page.tsx (51)

| Line            | Class(es)                                                                                                      | #   | Verdict    | Becomes                                                                                 | Note                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------- | --- | ---------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 378             | `bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30`                                   | 4   | decoration | removed                                                                                 | the `entityType` label badge. Purple appears nowhere else on this page or its map, and the badge's text **is** the status. Nothing compares it to anything.                  |
| 386             | `bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30`                                       | 4   | semantic   | `bg-warning/15 text-warning-strong border-warning/30`                                   | the special-status flag. Amber is this flag's site-wide spelling — `v2-world-map-explorer.tsx:57` renders the same chip — and it means "this claim is qualified": a caution. |
| 393             | `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20`                               | 4   | semantic   | `bg-success/10 text-success-strong border-success/20`                                   | the sovereign-entity flag, the affirmative branch of the same ternary. 6.56 light / 7.61 dark.                                                                               |
| 402             | `bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30`                                           | 4   | decoration | removed                                                                                 | "island" chip; `Waves` plus the chip's own label. Its sibling branch is already `bg-muted text-muted-foreground`.                                                            |
| 471,494,513     | `text-teal-600`, `text-amber-600`, `text-rose-600`                                                             | 3   | decoration | removed                                                                                 | `Maximize2` / `Building2` / `Scroll` on three metric tiles, each with its label beside it                                                                                    |
| 622,634,643,661 | `text-rose-600`, `text-amber-600`, `text-teal-600`, `text-rose-600`                                            | 4   | decoration | removed                                                                                 | quick-fact icons (`MapPin`, `Coins`, `Languages`, `Scroll`), each followed by its `t(...)` label                                                                             |
| 751             | `bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20`                                           | 4   | decoration | removed                                                                                 | "İklim & Hidrografya" section badge — a topic tint; the badge text is the topic                                                                                              |
| 772             | `text-amber-500`                                                                                               | 1   | decoration | removed                                                                                 | `CloudSun` beside the climate heading. 2.15:1 on the light card today.                                                                                                       |
| 792             | `text-cyan-600`                                                                                                | 1   | decoration | removed                                                                                 | `Waves` beside the hydrography heading                                                                                                                                       |
| 800             | `bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20`                                           | 4   | decoration | removed                                                                                 | the hydrography-resources badge, labelled                                                                                                                                    |
| 840,845         | `border-amber-500/30 bg-amber-500/5`, `bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30` | 6   | semantic   | `border-warning/30 bg-warning/5`, `bg-warning/15 text-warning-strong border-warning/30` | the sovereignty-note card, with `ShieldAlert`. Same flag as line 386 at card scale. `warning-strong` on a /5 tint: 6.48 light, 8.89 dark.                                    |
| 930             | `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20`                               | 4   | decoration | removed                                                                                 | "Ekonomi" section badge. Same shape as 751 — a topic tint that happens to be green; it does not mean success.                                                                |
| 1150, 1185      | `bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30` ×2                                    | 8   | semantic   | `bg-warning/15 text-warning-strong border-warning/30`                                   | the same special-status flag on neighbour chips, twice (linked and unlinked branch). Must stay identical to line 386.                                                        |

**Totals:** data 0, semantic 22, decoration 29.

### components/v2/v2-tools-hub.tsx (42)

The three tools are identified by emerald / sky / `primary` across **three** surfaces that must
agree with one another: the cards (93-129, 151-187), the compact-list icon plates (258, 283) and
the comparison-table column headers (330, 331). That agreement is real, and it is not what decides
this.

Two things decide it. First, every one of those surfaces names the tool in adjacent text — the
card heading, the list row's title, the `<th>` cell's own words — so nothing here is carried by
colour alone and removing the hue removes nothing. Second, the set already contains brand tokens:
the third column and the third card are `text-primary`, and the two CTAs spell `variant="emerald"`
and `variant="sky"`, which resolve to `bg-secondary` and `bg-info` in `components/ui/button.tsx`.
A data set cannot have brand members — `docs/design.md` rule 1 — so a set with three of them is
not a data set, it is card variety that grew a convention. All three surfaces collapse onto the
same treatment together, which is what keeps them agreeing.

| Line                                            | Class(es)                                                                   | #   | Verdict    | Becomes               | Note                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- | --- | ---------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 93, 96, 102, 109, 121, 125, 129                 | card wash, icon plate, badge, hover heading, three `CheckCircle2` — emerald | 12  | decoration | removed               | the "Koordinat & Konum Bulucu" card. Heading, icon and the three feature lines all carry text.                                                                                                                                                           |
| 151, 154, 160, 167, 179, 183, 187               | the same seven slots in sky                                                 | 12  | decoration | removed               | the "Çokgen Alan Hesaplama" card. The third card in this row is already `primary`, unchanged.                                                                                                                                                            |
| 258                                             | `bg-emerald-600/15 text-emerald-600`                                        | 2   | decoration | removed               | icon plate in the compact list below                                                                                                                                                                                                                     |
| 283                                             | `bg-sky-600/15 text-sky-600`                                                | 2   | decoration | removed               | the same icon plate for the area tool; the row's tool name and its glyph sit immediately beside it                                                                                                                                                       |
| 330, 331                                        | `text-emerald-600`, `text-sky-600`                                          | 2   | decoration | removed               | comparison-table column headers; the header cell names the tool                                                                                                                                                                                          |
| 355,358,361,369,370,371,375,378,381,389,392,395 | `text-emerald-600` ×12                                                      | 12  | semantic   | `text-success-strong` | the "✓ Var" cells. Here emerald is constant across all three columns and means **yes** — affirmative, not tool identity. The ✓ glyph carries it too; `semantic` wins because the meaning is one of the five. 3.77:1 today on the light card, 6.56 after. |

**Totals:** data 0, semantic 12, decoration 30.

### components/v2/v2-world-map-explorer.tsx (27)

| Line          | Class(es)                                                                                                                                            | #   | Verdict  | Becomes                                               | Note                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 57            | `bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30`                                                                             | 4   | semantic | `bg-warning/15 text-warning-strong border-warning/30` | `SpecialStatusBadge`, the shared component behind `dunya/[slug]:386`. Both move together or the flag changes colour between pages.                                  |
| 673, 679, 688 | `stroke-sky-500/15`, `stroke-sky-400/40`, `stroke-sky-400/30`                                                                                        | 3   | data     | a map-furniture token in the `--map-*` set            | the graticule: equator, tropics, prime meridian. Not a bridge token — this is the map's own surface, and `decoration` would delete the grid rather than re-bind it. |
| 693           | `fill-sky-400/50`                                                                                                                                    | 1   | data     | the same map-furniture token                          | the graticule's text labels                                                                                                                                         |
| 719           | `fill-slate-600/65 dark:fill-slate-700/70 stroke-slate-400/45 dark:stroke-slate-500/40`                                                              | 4   | data     | `--land-inert` / `--province-stroke` equivalents      | a country with no entry — the "not published" fill. `--province-inert` and `--land-inert` already exist for exactly this on the Turkey map.                         |
| 728           | the same four plus `hover:fill-slate-500/75`                                                                                                         | 5   | data     | as above                                              | the filtered-out variant                                                                                                                                            |
| 733           | `stroke-yellow-400 fill-yellow-500/90`                                                                                                               | 2   | data     | the map hover/selected token                          | hover and selection on the map surface; `--map-hover-width` and `--game-hover-edge` are the existing precedent. T-031d owns how this reads on the dark map.         |
| 982, 984, 994 | `bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300`, `text-amber-600`, `border-amber-500/40 text-amber-800 dark:text-amber-200` | 8   | semantic | the `warning` family                                  | the continent-filter version of `v2-turkey-map-explorer:1032`, character for character. Same verdict, same target.                                                  |

**Totals:** data 15, semantic 12, decoration 0.

### app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx (24)

| Line        | Class(es)                                                                                    | #   | Verdict    | Becomes                         | Note                                                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- | --- | ---------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 120,128,129 | `text-teal-600`, `border-teal-500/30`, `text-teal-700`, `dark:text-teal-300`                 | 4   | decoration | the literal spelling only       | quoted inside the metric-strip comment that records why `tone="secondary"` replaced a frozen teal. Nothing renders these. The prose keeps the ruling; the class names stop being spelled literally. See the section above. |
| 316, 318    | `border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500`, `text-cyan-700 dark:text-cyan-300` | 5   | data       | `--basin-karadeniz` + tint/text | the Karadeniz link card. These four cards are the same per-basin identity `v2-marine-basin-cards` paints; the comment ten lines above this page even says so ("teal IS the site-wide Aegean encoding").                    |
| 326, 328    | the amber pair                                                                               | 5   | data       | `--basin-marmara`               |                                                                                                                                                                                                                            |
| 336, 338    | the teal pair                                                                                | 5   | data       | `--basin-ege`                   |                                                                                                                                                                                                                            |
| 346, 348    | the rose pair                                                                                | 5   | data       | `--basin-akdeniz`               |                                                                                                                                                                                                                            |

**Totals:** data 20, semantic 0, decoration 4.

### lib/earthquake/fault-lines-data.ts (24)

The definition behind `deprem/page.tsx` (21) and `deprem/fay-hatlari/page.tsx` (3). Red, blue and
emerald here are **fault identifiers**, not danger/information/success — `fay-hatlari/page.tsx`
carries a ruling in its own comment saying exactly that, and the stat tiles on that page have to
match these cards. Binding them to `destructive` / `info` / `success` would push three data
categories onto three semantic hues, the data-viz rule run backwards.

| Line    | Class(es)                                                                                                                                       | #   | Verdict | Becomes                    | Note                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- | -------------------------- | -------------------------------------------------------- |
| 37-39   | `bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30`, `border-red-500/40 hover:border-red-500/60`, `text-red-600 dark:text-red-400` | 8   | data    | `--fault-kaf` + tint/text  | KAF. Two hand-written `dark:` pairs go with the binding. |
| 140-142 | the blue equivalents                                                                                                                            | 8   | data    | `--fault-daf` + tint/text  | DAF                                                      |
| 236-238 | the emerald equivalents                                                                                                                         | 8   | data    | `--fault-bafs` + tint/text | BAFS                                                     |

**Totals:** data 24, semantic 0, decoration 0.

### components/v2/v2-sea-basin-detail-view.tsx (22)

The sixth frozen colour recorded in T-044(3). 22 occurrences on 12 lines; 10 of them sit on the
eight lines that carry no `dark:` pair (147, 191, 279, 281, 359, 394, 410, 419).

| Line     | Class(es)                                                            | #   | Verdict    | Becomes                                                                                 | Note                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------- | --- | ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 147      | `text-cyan-600`                                                      | 1   | semantic   | `text-info-strong`                                                                      | the "Maksimum Derinlik" reading — the brand's water accent on a headline figure. **The brief's example row calls this `text-accent-strong`; that token does not exist.** `--accent` and `--info` are the same value in both themes (#276b70 light, `oklch(0.65 0.0675 202)` dark), and only `--info-strong` has a strong member: 7.07 light, 7.50 dark. Today's cyan-600 is 3.68:1. |
| 191      | `bg-cyan-500`                                                        | 1   | decoration | removed                                                                                 | the pulsing dot before a heading whose first word is "Canlı"                                                                                                                                                                                                                                                                                                                        |
| 242      | `text-rose-600 dark:text-rose-400`                                   | 2   | decoration | removed                                                                                 | the SST column. Flat for every value, so it names the column, not the reading, and the `<th>` "Su Sıcaklığı" already does. (Where SST **is** banded by value — `v2-marine-map-explorer:891-897` — the verdict is `data`; this column is the flat case.)                                                                                                                             |
| 245      | `text-cyan-600 dark:text-cyan-400`                                   | 2   | decoration | removed                                                                                 | the wave-height column, same shape                                                                                                                                                                                                                                                                                                                                                  |
| 279, 281 | `border-red-500/30 from-red-500/5`, `bg-red-500/10 text-red-600`     | 4   | semantic   | `border-destructive/30 from-destructive/5`, `bg-destructive/10 text-destructive-strong` | the submarine-fault callout. Hazard, and deliberately **not** `--fault-*`: it names no individual fault, it links to the fault page. 7.11 light / 7.66 dark on its /5 wash.                                                                                                                                                                                                         |
| 359      | `text-teal-600`                                                      | 1   | decoration | removed                                                                                 | "Kıyı Tipleri & Yer Şekilleri" heading with `Compass`. Coastal types carry no colour anywhere — `lib/marine/coastal-types-detail.ts` has no colour field, and the six type articles render `border-border bg-card`. Recorded in this repo already.                                                                                                                                  |
| 384      | `bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30` | 4   | decoration | removed                                                                                 | the coastal-type chips below that heading, same reason                                                                                                                                                                                                                                                                                                                              |
| 394      | `text-cyan-600`                                                      | 1   | decoration | removed                                                                                 | "Hidrodinami & Akıntı Rejimi" heading with `Waves`                                                                                                                                                                                                                                                                                                                                  |
| 410      | `text-cyan-600`                                                      | 1   | decoration | removed                                                                                 | `CheckCircle2` on a key-point row whose neighbours are `text-muted-foreground`; the hue varies by section, so it is section variety, not a tick                                                                                                                                                                                                                                     |
| 419      | `text-blue-600`                                                      | 1   | decoration | removed                                                                                 | "Beslenme Kaynakları & Akarsular" heading with `Droplets`                                                                                                                                                                                                                                                                                                                           |
| 437      | `bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30` | 4   | decoration | removed                                                                                 | river-name chips; each chip is a river's name                                                                                                                                                                                                                                                                                                                                       |

**Totals:** data 0, semantic 5, decoration 17.

### components/v2/v2-earthquake-explorer.tsx (21)

A public-safety magnitude scale. It binds to the existing `--eq-mag-1..5` purple ramp, which is
already the owner's decision. This is a binding, not a redesign, and the ramp is not restyled to
Terra.

| Line               | Class(es)                                                       | #   | Verdict  | Becomes                        | Note                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------- | --- | -------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 268, 270, 271      | `bg-red-600`, `border-red-700`, `ring-red-500/50`               | 3   | data     | `--eq-mag-5` and its edge/ring | M ≥ 5.0. Today's traffic-light ramp is a hue scale; `--eq-mag-*` is a lightness ramp, which is what a magnitude belongs on.                                                                                           |
| 275, 277, 278      | the orange set                                                  | 3   | data     | `--eq-mag-4`                   | M 4.0-4.9                                                                                                                                                                                                             |
| 282, 283, 284, 285 | the amber set plus `text-amber-950`                             | 4   | data     | `--eq-mag-3` + its foreground  | M 3.0-3.9; `text-amber-950` is the badge's own foreground and moves with it                                                                                                                                           |
| 288, 290, 291      | the emerald set                                                 | 3   | data     | `--eq-mag-1`/`-2`              | M < 3.0. The raw scale has four steps where the token ramp has five; the sub-3 branch splits or the fifth member goes unused — decide when applying, do not invent a hue.                                             |
| 350                | `bg-amber-500` / `bg-emerald-500`                               | 2   | semantic | `bg-warning` / `bg-success`    | the refresh dot: "Güncelleniyor…" versus a live count. Loading and ready, not magnitudes. Solid fills, 3.04 / 5.82 light and 7.53 / 5.49 dark against `--card`.                                                       |
| 474,477,480,483    | `bg-emerald-600`, `bg-amber-500`, `bg-orange-500`, `bg-red-600` | 4   | data     | the same `--eq-mag-*` members  | the legend swatches. They must be the identical token to the badges above or the legend lies.                                                                                                                         |
| 694                | `stroke-amber-400 dark:stroke-amber-300`                        | 2   | semantic | `stroke-ring`                  | the selected-epicentre ring. Its two siblings on the same expression are already `stroke-destructive/70` and `stroke-primary/50`, so selection needs a token that is neither: `--ring` is the one that exists for it. |

**Totals:** data 17, semantic 4, decoration 0.

**Recorded for T-031d, not fixed here:** on the dark `--card` the five ramp steps measure 3.63,
2.65, 1.89, 1.29 and 1.01. The top of a public-safety scale is invisible in dark mode.

### components/v2/v2-marine-basin-cards.tsx (21)

| Line   | Class(es)                                                                                        | #   | Verdict    | Becomes                         | Note                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------ | --- | ---------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| 31, 32 | `bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30`, `hover:border-cyan-500/50` | 5   | data       | `--basin-karadeniz` + tint/text | the canonical spelling of the basin set — the one the other three files must agree with. |
| 53, 54 | the amber pair                                                                                   | 5   | data       | `--basin-marmara`               |                                                                                          |
| 75, 76 | the teal pair                                                                                    | 5   | data       | `--basin-ege`                   |                                                                                          |
| 97, 98 | the rose pair                                                                                    | 5   | data       | `--basin-akdeniz`               |                                                                                          |
| 169    | `text-cyan-600`                                                                                  | 1   | decoration | removed                         | `Droplets` before the literal label "Tuzluluk:"                                          |

**Totals:** data 20, semantic 0, decoration 1.

### app/[locale]/(site)/deprem/page.tsx (21)

| Line          | Class(es)                                                                                                          | #   | Verdict | Becomes                   | Note                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | --- | ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 197, 199, 200 | `border-red-500/30 bg-red-500/5`, `text-red-700 dark:text-red-300`, `bg-red-500/10 text-red-700 dark:text-red-300` | 7   | data    | `--fault-kaf` + tint/text | the KAF card. Red here is a **fault identifier**, not danger: `fay-hatlari/page.tsx` carries a ruling saying so in its own comment, and its stat tiles have to match. |
| 209, 211, 212 | the blue set                                                                                                       | 7   | data    | `--fault-daf`             | DAF                                                                                                                                                                   |
| 221, 223, 224 | the emerald set                                                                                                    | 7   | data    | `--fault-bafs`            | BAFS. Note that binding these to `destructive` / `info` / `success` would push three data categories onto three semantic hues — the data-viz rule backwards.          |

**Totals:** data 21, semantic 0, decoration 0.

### app/[locale]/(site)/deprem/fay-hatlari/page.tsx (20)

| Line                | Class(es)                                                                                                                                                  | #   | Verdict    | Becomes                                               | Note                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 122,123,125,126,127 | `text-red-600`, `text-blue-600`, `text-emerald-600`, `border-red-500/40`, `bg-red-500/15 text-red-700 dark:text-red-300`, `text-red-600 dark:text-red-400` | 9   | decoration | the literal spelling only                             | quoted inside the "DELIBERATELY NOT MIGRATED — RULING BG" comment. Prose, not markup. The ruling it records is the one this file's `data` rows apply. |
| 148                 | `text-red-600`                                                                                                                                             | 1   | data       | `--fault-kaf-text`                                    | "1.200 km — KAF Toplam Uzunluk". The tile colour says **which fault** and must agree with the KAF card below it and with `/deprem`'s legend.          |
| 156                 | `text-blue-600`                                                                                                                                            | 1   | data       | `--fault-daf-text`                                    | DAF                                                                                                                                                   |
| 164                 | `text-emerald-600`                                                                                                                                         | 1   | data       | `--fault-bafs-text`                                   | BAFS. The fourth tile in this strip is already `text-primary` and carries no fault, so it does not move.                                              |
| 323, 324            | `bg-amber-500/10 border-amber-500/30`, `text-amber-800 dark:text-amber-300`                                                                                | 4   | semantic   | `bg-warning/10 border-warning/30 text-warning-strong` | a caution note about fault-line data currency                                                                                                         |
| 335, 336            | `border-cyan-500/30 bg-cyan-500/5`, `text-cyan-800 dark:text-cyan-300`                                                                                     | 4   | semantic   | `border-info/30 bg-info/5 text-info-strong`           | a neutral pointer to the live monitor: information. 7.63 light / 8.14 dark on its /5 wash.                                                            |

**Totals:** data 3, semantic 8, decoration 9.

### components/v2/v2-header.tsx (19)

Every page renders this file. Screenshot `/tr` and one deep route when it is applied.

| Line     | Class(es)                                                                                  | #   | Verdict    | Becomes                                               | Note                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------ | --- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 235, 239 | `bg-emerald-500/10 text-emerald-600`, `group-hover:text-emerald-600`                       | 3   | decoration | removed                                               | the "Coğrafya Araçları" mega-menu tile: icon plate and hover heading. A section tint; the tile's own title is beside it.                                                 |
| 386      | `bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-500/30`                   | 4   | semantic   | `bg-primary/15 text-primary border-primary/30`        | the **active** state of the Kitaplar link. Active navigation is brand accent; `font-bold` and the border carry it too, but every other nav item marks active with brand. |
| 390      | `text-amber-600 dark:text-amber-400`                                                       | 2   | decoration | removed                                               | the `BookOpen` glyph in that link, painted amber whether active or not — so it is not the state, and the word "Kitaplar" is next to it                                   |
| 420      | `bg-emerald-500`                                                                           | 1   | semantic   | `bg-success`                                          | the signed-in dot on "Hesabım". 5.82 light / 5.49 dark against `--card`, over the 3:1 graphical floor.                                                                   |
| 573      | `text-emerald-600`                                                                         | 1   | decoration | removed                                               | `Compass` beside a labelled link                                                                                                                                         |
| 653, 656 | `bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300`, `text-amber-600` | 5   | decoration | removed                                               | the mobile Kitaplar row. Amber unconditionally here — not a state — and the row is a labelled link with a `BookOpen` icon.                                               |
| 716      | `bg-emerald-500/10 text-emerald-600 border-emerald-500/30`                                 | 3   | semantic   | `bg-success/10 text-success-strong border-success/30` | the "Aktif" badge on the account row                                                                                                                                     |

**Totals:** data 0, semantic 8, decoration 11.

### components/v2/v2-tool-workbench.tsx (16)

Every occurrence here is one of the five meanings; nothing in this file is decorative.

| Line           | Class(es)                                                                                                            | #   | Verdict  | Becomes                                                             | Note                                                                                                                                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | --- | -------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 965            | `text-emerald-600`                                                                                                   | 1   | semantic | `text-success-strong`                                               | a `Check` confirming a copied/applied value                                                                                                                                                                                                                                                                                   |
| 1253,1256,1264 | `bg-amber-950/90 text-amber-200 border-amber-500/50`, `text-amber-400`, `bg-amber-500 text-black hover:bg-amber-400` | 6   | semantic | `bg-warning text-warning-foreground border-warning`, `bg-warning …` | the self-intersection `role="alert"` toast. It is a hand-built opaque dark surface (amber-950 with amber-200 on it, 12.03:1) — the bridge equivalent is a solid `--warning` with `--warning-foreground`, measured 5.54 light and 7.46 dark. Do not translate it into a tint; it floats over the map and needs to stay opaque. |
| 1557           | `text-emerald-600 dark:text-emerald-400`                                                                             | 2   | semantic | `text-success-strong`                                               | the `role="status"` save confirmation                                                                                                                                                                                                                                                                                         |
| 1652           | `text-emerald-600`                                                                                                   | 1   | semantic | `text-success-strong`                                               | a second `Check`                                                                                                                                                                                                                                                                                                              |
| 1796,1798,1807 | `bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200`, `text-amber-600` ×2                        | 6   | semantic | the `warning` family                                                | the measurement-accuracy caution strip and its reset button                                                                                                                                                                                                                                                                   |

**Totals:** data 0, semantic 16, decoration 0.

**APPLIED, Task 9 — all 16, with two rows corrected before applying.**

1. **Rows 965 and 1652 named a target that fails on the surface the page paints.** Both `Check`
   glyphs sit inside a FILLED `variant="secondary"` button (`components/ui/button.tsx`:
   `bg-secondary text-secondary-foreground`), so their backdrop is `--secondary`, not a card.
   `--success-strong` measures **1.27:1 light / 1.62:1 dark** against it — a worse figure than
   the 1.56 / 1.20 the raw `emerald-600` was already scoring, so binding the row as written
   would have swapped one failure for another. No member of the success family reads on
   `--secondary`; the fix is for the glyph to inherit `--secondary-foreground` (5.89 / 5.37),
   which is what the `Copy` glyph in the same slot already does. Nothing is lost: the copied
   state swaps the glyph (Copy → Check) **and** the label ("Özeti Kopyala" → "Kopyalandı!"), so
   the hue was never the carrier. Verdict changes `semantic` → `decoration` for these 2, making
   the file's split **semantic 14, decoration 2**.

2. **Row 1264's action pill is an inversion, and the hovered state is the reason.** With the
   toast panel now a solid `--warning`, a `bg-card` pill on it separates by 3.04:1 at rest but
   only **2.53:1** when it hovers to `--muted` — under WCAG 1.4.11's 3:1 graphical floor. The
   pill takes `--warning-foreground` as its fill with `--warning` as its label instead: 5.54 /
   7.46 at rest, 4.80 / 6.27 hovered. Its rim is `--warning-foreground/25` rather than the
   literal `border-warning` in the `Becomes` column, because a rim the same value as its own
   fill draws no line; inverting a panel inverts its rim. The now-dead `backdrop-blur-md` on
   the opaque panel went with it.

### lib/marine/sea-basins-detail.ts (16)

The definition behind `--basin-*`. Its four hues agree, exactly, with `v2-marine-basin-cards.tsx`'s
(cyan / amber / teal / rose) — so unlike the continent and region sets this one is not
self-contradicting today, and the binding is a consolidation rather than a fix.

| Line    | Class(es)                                                                                                 | #   | Verdict | Becomes                         | Note                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------- | --- | ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 82-84   | `text-cyan-700 dark:text-cyan-300`, `from-cyan-500/10 via-background to-background`, `border-cyan-500/30` | 4   | data    | `--basin-karadeniz` + tint/text | Karadeniz. `themeColor` is the basin's text member, `gradientClass` its hero wash, `borderAccent` its edge. |
| 244-246 | the amber equivalents                                                                                     | 4   | data    | `--basin-marmara` + tint/text   | Marmara Denizi                                                                                              |
| 386-388 | the teal equivalents                                                                                      | 4   | data    | `--basin-ege` + tint/text       | Ege Denizi                                                                                                  |
| 524-526 | the rose equivalents                                                                                      | 4   | data    | `--basin-akdeniz` + tint/text   | Akdeniz                                                                                                     |

**Totals:** data 16, semantic 0, decoration 0.

### components/v2/v2-world-stats-spotlight.tsx (15)

Five superlative rows, five hues, each row labelled in full ("En Yüksek Nokta: Everest") with a
distinct glyph. No scale, no comparison, no map or chart reads these.

| Line     | Class(es)                                              | #   | Verdict    | Becomes | Note                                                                                                                               |
| -------- | ------------------------------------------------------ | --- | ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 216, 222 | `text-amber-500`, `text-amber-600 dark:text-amber-400` | 3   | decoration | removed | `Mountain` + the "+8.848 m" reading; label carries it. amber-500 is 2.15:1 on the light card.                                      |
| 229, 237 | the blue pair                                          | 3   | decoration | removed | `Waves`, deepest point                                                                                                             |
| 244, 250 | the teal pair                                          | 3   | decoration | removed | `Waves`, longest river                                                                                                             |
| 257, 265 | the red pair                                           | 3   | decoration | removed | `Flame`, hottest record. The glyph, not the hue, is what separates it from the row below — which is why removing the pair is safe. |
| 272, 280 | the cyan pair                                          | 3   | decoration | removed | `Snowflake`, coldest record                                                                                                        |

**Totals:** data 0, semantic 0, decoration 15.

### components/v2/v2-turkey-regions.tsx (14)

| Line                          | Class(es)                                                                                | #   | Verdict | Becomes      | Note                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------- | --- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 48, 65, 82, 99, 116, 133, 150 | `from-*-700 to-*-900` ×7 (amber, teal, emerald, yellow/amber, cyan/slate, stone, orange) | 14  | data    | `--region-*` | the seven region card headers — the same seven-hue set as `v2-turkey-map-explorer`'s `headerClass`, a fourth spelling of one identity. Task 3 consumes `--region-*-tint`/`-text` here. |

**Totals:** data 14, semantic 0, decoration 0.

### components/v2/v2-favorite-button.tsx (13)

| Line     | Class(es)                                                                                                      | #   | Verdict    | Becomes | Note                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------- | --- | ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 123, 124 | `bg-rose-600 hover:bg-rose-700 ring-rose-500/30`, `hover:border-rose-400`                                      | 4   | decoration | removed | the icon-only favourited state. The button **already** carries `role="switch"`, `aria-checked`, a filled `Heart` and a `variant` — the rose overrides a variant that encodes it correctly.                                          |
| 159, 160 | `from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 ring-rose-500/30`, `hover:border-rose-400/60` | 6   | decoration | removed | the labelled variant of the same button: `variant={favorited ? "primary" : "outline"}` is one line above it, and the text flips to "Favorilerde".                                                                                   |
| 168, 171 | `text-rose-500` ×2                                                                                             | 2   | decoration | removed | the un-favourited `Heart`. The state is carried by the glyph itself — outline here against `fill-white text-white` at :166 — and by the button's label, which reads "Favoriye Ekle" versus "Favorilerde". 3.67:1 on the light card. |
| 179      | `text-amber-300`                                                                                               | 1   | decoration | removed | a `Sparkles` that spins for a moment after a toggle. Pure ornament.                                                                                                                                                                 |

**Totals:** data 0, semantic 0, decoration 13.

### components/v2/v2-leaderboard-modal.tsx (13)

| Line          | Class(es)                                                                                    | #   | Verdict    | Becomes | Note                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------- | --- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 87            | `bg-amber-500/10 text-amber-600 border-amber-500/30`                                         | 3   | decoration | removed | the "Lider Tablosu" dialog badge, with a `Trophy` and its own word                                                                     |
| 193, 197, 201 | `bg-amber-400/20 text-amber-700 dark:text-amber-300`, the slate pair, the amber-700/800 pair | 9   | decoration | removed | ranks 1-3. Each cell renders 🥇 / 🥈 / 🥉 **and** the rank is a number in the same column; gold/silver/bronze tints restate the emoji. |
| 333           | `text-amber-500`                                                                             | 1   | decoration | removed | a `Trophy` glyph beside its label                                                                                                      |

**Totals:** data 0, semantic 0, decoration 13.

### components/v2/v2-marine-layer-catalogue.tsx (10)

| Line     | Class(es)                                                                                            | #   | Verdict    | Becomes                                               | Note                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------- | --- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 18-22    | `text-rose-500`, `text-cyan-600`, `text-indigo-500`, `text-teal-600`, `text-teal-500`                | 5   | decoration | removed                                               | one icon per layer in a table whose rows are named. The glyphs are not even distinct (`Compass` appears twice, teal twice), so the hue cannot be the identifier — the row label is. No map mark reads these. |
| 144, 145 | `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30`, `text-emerald-600` | 5   | semantic   | `bg-success/10 text-success-strong border-success/30` | the "Yayında" status badge with `CheckCircle2` — availability, one of the five.                                                                                                                              |

**Totals:** data 0, semantic 5, decoration 5.

### components/v2/v2-game-history-stats.tsx (9)

| Line       | Class(es)                                                                                   | #   | Verdict    | Becomes | Note                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------- | --- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 76, 84, 92 | `bg-amber-500/10 text-amber-600 border-amber-500/30` and the emerald and orange equivalents | 9   | decoration | removed | three of the four achievement tints; the fourth is already `bg-primary/10 text-primary border-primary/30`, which is the tell. Unlocked versus locked is carried by a text `Badge` ("Kazanıldı" / "Kilitli"), a dashed border and `opacity-60`, so the per-achievement hue restates the title. |

**Totals:** data 0, semantic 0, decoration 9.

### components/v2/v2-register-card.tsx (9)

| Line               | Class(es)                                                                                            | #   | Verdict  | Becomes                                               | Note                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- | --- | -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 375, 377           | `bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300`, `text-emerald-600` | 5   | semantic | `bg-success/10 border-success/25 text-success-strong` | the registration-success alert. 6.56 light / 7.61 dark.                                                                                                                                                     |
| 627, 633, 638, 643 | `text-emerald-600` ×4                                                                                | 4   | semantic | `text-success-strong`                                 | the four password rules, coloured only once satisfied. Success. The `Check` opacity also flips, so the meaning survives either way — but the meaning **is** success, so it binds rather than being removed. |

**Totals:** data 0, semantic 9, decoration 0.

### components/v2/v2-game-hub.tsx (8)

| Line     | Class(es)             | #   | Verdict    | Becomes | Note                                                                                                                                  |
| -------- | --------------------- | --- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 43       | `text-amber-500`      | 1   | decoration | removed | `Sparkles` inside a labelled badge                                                                                                    |
| 74, 78   | `text-emerald-600` ×2 | 2   | decoration | removed | feature ticks on the first mode card; the `CheckCircle2` glyph and the feature sentence beside it carry the "included" meaning        |
| 122, 126 | `text-teal-600` ×2    | 2   | decoration | removed | the same ticks on the second card — **in teal**. A tick that meant "yes" would not change hue between cards, so this is card variety. |
| 170, 174 | `text-cyan-600` ×2    | 2   | decoration | removed | and cyan on the third, with the same `CheckCircle2` and the same feature sentence carrying it                                         |
| 205      | `text-purple-600`     | 1   | decoration | removed | a `Brain` glyph beside its heading                                                                                                    |

**Totals:** data 0, semantic 0, decoration 8.

### components/v2/v2-member-hub.tsx (8)

| Line          | Class(es)                                            | #   | Verdict    | Becomes | Note                                                                                                                                                                                                                                                              |
| ------------- | ---------------------------------------------------- | --- | ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 296, 306, 316 | `text-sky-500`, `text-emerald-500`, `text-amber-500` | 3   | decoration | removed | one glyph per favourite entity type — and every row already renders a text `badge` ("Ülke" / "Bölge" / "Kıta") plus a subtitle. Note the emerald "Bölge" glyph is **not** a region identity: all seven regions share it, so it must not be bound to `--region-*`. |
| 437, 455, 464 | `text-rose-500`, `text-amber-500`, `text-indigo-500` | 3   | decoration | removed | `Heart` / `Trophy` / `Ruler` on labelled stat rows                                                                                                                                                                                                                |
| 983, 985      | `text-emerald-500`, `text-sky-500`                   | 2   | decoration | removed | `Layers` / `MapPin` on labelled links                                                                                                                                                                                                                             |

**Totals:** data 0, semantic 0, decoration 8.

### components/v2/v2-learning-paths.tsx (7)

| Line       | Class(es)                                                                                       | #   | Verdict    | Becomes               | Note                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------- | --- | ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 17, 34, 51 | `from-amber-600 to-amber-800`, `from-emerald-700 to-emerald-900`, `from-blue-700 to-indigo-900` | 6   | decoration | removed               | three learning-path header washes. Per-card variety: the paths are named in the header they sit behind, and nothing else paints them. |
| 144        | `text-emerald-600`                                                                              | 1   | semantic   | `text-success-strong` | a single `CheckCircle2` on an "included" line, emerald throughout this component — affirmative, not card identity                     |

**Totals:** data 0, semantic 1, decoration 6.

### components/v2/v2-login-card.tsx (7)

| Line | Class(es)                                                                        | #   | Verdict  | Becomes                                               | Note                                                                       |
| ---- | -------------------------------------------------------------------------------- | --- | -------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| 121  | `bg-emerald-500/10 border-emerald-500/30 text-emerald-600`                       | 3   | semantic | `bg-success/10 border-success/30 text-success-strong` | the success plate on the post-login confirmation screen                    |
| 193  | `bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300` | 4   | semantic | `bg-success/10 border-success/25 text-success-strong` | the success alert; identical markup to `v2-register-card:375`, same target |

**Totals:** data 0, semantic 7, decoration 0.

### components/v2/v2-profile-form.tsx (5)

| Line     | Class(es)                                                                                            | #   | Verdict  | Becomes                                               | Note                                                              |
| -------- | ---------------------------------------------------------------------------------------------------- | --- | -------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| 243, 245 | `bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300`, `text-emerald-600` | 5   | semantic | `bg-success/10 border-success/25 text-success-strong` | the third copy of the same success alert; all three move together |

**Totals:** data 0, semantic 5, decoration 0.

### app/[locale]/(site)/deniz/page.tsx (5)

| Line     | Class(es)                                                        | #   | Verdict    | Becomes                   | Note                                                                                               |
| -------- | ---------------------------------------------------------------- | --- | ---------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 247      | `text-cyan-600`                                                  | 1   | decoration | the literal spelling only | quoted inside the metric-strip comment recording the frozen-cyan ruling. Prose, not markup.        |
| 281, 283 | `border-red-500/30 from-red-500/5`, `bg-red-500/10 text-red-600` | 4   | semantic   | the `destructive` family  | the submarine-fault callout, the same component-level markup as `v2-sea-basin-detail-view:279-281` |

**Totals:** data 0, semantic 4, decoration 1.

### app/[locale]/(site)/deprem/hazirlik/page.tsx (5)

| Line     | Class(es)                                                                                  | #   | Verdict  | Becomes                                               | Note                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------ | --- | -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 185, 186 | `bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200`, `text-amber-600` | 5   | semantic | `bg-warning/10 border-warning/30 text-warning-strong` | an `AlertOctagon` preparedness caution on a public-safety page. Caution, not a band — the AQI/MMI/SST rule does not bind it. |

**Totals:** data 0, semantic 5, decoration 0.

### components/v2/v2-auth-benefits-plate.tsx (4)

| Line           | Class(es)                                                                 | #   | Verdict    | Becomes | Note                                                                                                 |
| -------------- | ------------------------------------------------------------------------- | --- | ---------- | ------- | ---------------------------------------------------------------------------------------------------- |
| 14, 20, 32, 90 | `text-amber-500`, `text-emerald-500`, `text-rose-500`, `text-emerald-500` | 4   | decoration | removed | `Star` / `Trophy` / `Video` / `ShieldCheck` on benefit rows, each with its own title and description |

**Totals:** data 0, semantic 0, decoration 4.

### components/v2/v2-tool-educational-content.tsx (3)

| Line | Class(es)          | #   | Verdict    | Becomes | Note                                                                             |
| ---- | ------------------ | --- | ---------- | ------- | -------------------------------------------------------------------------------- |
| 206  | `text-amber-600`   | 1   | decoration | removed | a section heading with its own icon and words                                    |
| 307  | `text-emerald-600` | 1   | decoration | removed | the "Koordinat" tool's sub-label — the same tool tint ruled on in `v2-tools-hub` |
| 317  | `text-sky-600`     | 1   | decoration | removed | the "Alan" tool's sub-label, same set                                            |

**Totals:** data 0, semantic 0, decoration 3.

### app/[locale]/(site)/dunya/kita/[slug]/page.tsx (3)

| Line          | Class(es)                                         | #   | Verdict    | Becomes | Note                                                                                                                             |
| ------------- | ------------------------------------------------- | --- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 206, 219, 232 | `text-amber-600`, `text-rose-600`, `text-sky-600` | 3   | decoration | removed | `Mountain` / `MapPin` / `Waves` on labelled fact rows — the same three-icon block as `v2-world-continents:264-282`, same verdict |

**Totals:** data 0, semantic 0, decoration 3.

### app/[locale]/(site)/dunya/kita/page.tsx (2)

| Line     | Class(es)                        | #   | Verdict    | Becomes | Note                                            |
| -------- | -------------------------------- | --- | ---------- | ------- | ----------------------------------------------- |
| 143, 156 | `text-amber-600`, `text-sky-600` | 2   | decoration | removed | the same two glyphs on the continent index page |

**Totals:** data 0, semantic 0, decoration 2.

### app/[locale]/(site)/turkiye/bolge/page.tsx (2)

| Line | Class(es)      | #   | Verdict    | Becomes | Note                                                                                                                                                                                                                                  |
| ---- | -------------- | --- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 652  | `bg-teal-500`  | 1   | decoration | removed | the coastal marker dot. It is `aria-hidden` and the word "Kıyı" is its sibling `<span>`.                                                                                                                                              |
| 660  | `bg-amber-500` | 1   | decoration | removed | the inland dot, labelled "İç". Two values with two colours, which would argue `data` — but the **third** state on the same ternary is already `bg-muted-foreground/40`, so this is not a data set, it is a bullet in front of a word. |

**Totals:** data 0, semantic 0, decoration 2.

### components/v2/v2-game-pedagogy-guide.tsx (1)

| Line | Class(es)         | #   | Verdict    | Becomes | Note                                     |
| ---- | ----------------- | --- | ---------- | ------- | ---------------------------------------- |
| 25   | `text-purple-600` | 1   | decoration | removed | a `Brain` glyph on a titled section card |

**Totals:** decoration 1.

### components/v2/v2-gis-methodology-guide.tsx (1)

| Line | Class(es)         | #   | Verdict    | Becomes | Note                                       |
| ---- | ----------------- | --- | ---------- | ------- | ------------------------------------------ |
| 25   | `text-purple-600` | 1   | decoration | removed | a `Compass` glyph on a titled section card |

**Totals:** decoration 1.

### components/v2/v2-study-strategy-guide.tsx (1)

| Line | Class(es)         | #   | Verdict    | Becomes | Note                                                                                                                                   |
| ---- | ----------------- | --- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 29   | `text-purple-600` | 1   | decoration | removed | the fourth study topic's tint; its three siblings already use bridge tokens, and each topic carries a title and a "%20 Ağırlık" weight |

**Totals:** decoration 1.

---

## Reconciliation

| Verdict      | Rows    | Share |
| ------------ | ------- | ----- |
| `data`       | 500     | 53.2% |
| `semantic`   | 170     | 18.1% |
| `decoration` | 269     | 28.6% |
| **Total**    | **939** |       |

Per-file totals, heaviest first, summing to 939:

113, 112, 78, 61, 55, 51, 51, 42, 27, 24, 24, 22, 21, 21, 21, 20, 19, 16, 16, 15, 14, 13, 13, 10,
9, 9, 8, 8, 7, 7, 5, 5, 5, 4, 3, 3, 2, 2, 1, 1, 1.

The three `lib/` sections added in fix round 1 are all `data` — 152 rows, no `semantic` and no
`decoration` among them, which is what a file of definitions should look like: a module that exists
to say which colour a continent, a fault or a basin **is** has no warnings and no ornament in it.
The verdict split moved with them, from 348/170/269 to 500/170/269: widening the roots added no
judgement calls, only more of the one verdict that was already the majority.
