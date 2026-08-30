import { getFormatter, getTranslations } from "next-intl/server";
import { byIsoCode, getCountryMapSummaryResilient } from "@/lib/api/countries";
import { byPlateCode, getMapSummary } from "@/lib/api/provinces";
import type { ProvinceMapSummary } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { InlandWaterLayer } from "./inland-water-layer";
import { MapHoverCard } from "./map-hover-card";
import styles from "./map.module.css";

interface TurkeyMapSectionProps {
  locale: Locale;
}

/**
 * `id` prefix of this map's shared `<defs>` geometry.
 *
 * Prefixed per SURFACE (`tr-map-` here, `world-map-` on `/dunya`, `game-map-` on `/oyun`) so
 * two maps could sit on one document without their fragment ids colliding — a `<use href>`
 * resolves against the whole document, not against its own `<svg>`.
 */
const SHAPE_ID_PREFIX = "tr-map-";

/**
 * The geographic-context ISO join key drawn as the CASING (turkiye-yenileme PR-B, plan
 * §5.4) rather than as a labelled neighbour — Türkiye's own Natural Earth outline, used
 * only to close the seam between it and the 81-province union. Never labelled: the `<h1>`
 * already says "Türkiye" (plan §5.6).
 */
const CONTEXT_CASING_ISO = "TR";

/** Sizes in TR-frame svg units (plan §5.6) — at a 1080 px content column these are
 *  ≈ 15.3 px (country) and ≈ 22.1 px (sea); the `<text>` `fontSize` attribute, not CSS, so
 *  they scale with the map exactly the way `marine-map.tsx`'s own point labels do. */
const CONTEXT_COUNTRY_LABEL_SIZE = 18;
const CONTEXT_SEA_LABEL_SIZE = 26;

/**
 * Sea names — four hand-picked anchors (a sea has no polygon to derive a centre from),
 * projected with `projectToFrame()` in the TR-frame coordinate space and verified to fall
 * on open water inside `TR_CONTEXT_FRAME` (plan §5.6). Names come from `Map.sea*`
 * (`GLOSSARY.md` §6's canonical TR/EN sea-name rows), never invented here.
 */
const SEA_LABELS = [
  { key: "seaBlackSea", x: 461, y: -27 },
  // FIX ROUND (PR #108 review, FEN108-M1): the original anchor (137, 102) put only 46% of
  // the label's ink on water (33% Türkiye province fill, 15% Greek Thrace) — measured with
  // Chromium `isPointInFill()` against the REAL 81-province geometry plus the 15-shape
  // context layer (not just the coarse Natural Earth casing outline, which does not resolve
  // a strait this narrow). A full systematic search (both locales, fontSize 26 down to 16,
  // the whole Marmara/Thrace neighbourhood) found NO position with 0% land: "Marmara
  // Denizi"/"Sea of Marmara" at any legible size is wider than the water body's own clear
  // rectangular extent in this generalisation, at every font size tried. (75, 114) is a
  // near-MINIMUM-land position from that search (measured: 24.79% TR / 24.61% EN land) — a
  // large reduction from the original 54% land, not the 0% the finding's own text hoped for;
  // recorded honestly rather than silently accepted. See the PR's fix-round completion
  // report for the full search.
  { key: "seaMarmara", x: 75, y: 114 },
  { key: "seaAegean", x: -13, y: 258 },
  // FIX ROUND (VAL108-SOV6): the original anchor (281, 464) put the EN-only "Mediterranean
  // Sea" label's east end over the Cyprus/KKTC island shapes (16% of its ink, 32/201 sampled
  // columns) — TR "Akdeniz" was already 100% water and is unaffected by this move. New anchor
  // re-measured 0% foreign-shape ink for BOTH locales (Chromium `isPointInFill()`, 1449-point
  // 161×9 grid) and does not collide with the relocated KKTC/Cyprus label block (VAL108-SOV1)
  // south of it.
  { key: "seaMediterranean", x: 228, y: 480 },
] as const;

/**
 * Per-ISO label anchor overrides (plan §5.6: "a country whose wrapped label cannot fit its
 * labelRadius gets a per-ISO anchor override in the component, recorded with the
 * measurement that forced it" — the same shape `generate-world-map-paths.mjs` uses for its
 * own per-ISO exceptions).
 *
 *   GR — default anchor="middle" overflows the WEST edge by ≈ 18.1 u (the mainland's pole
 *        of inaccessibility sits near the frame's own cut edge). Unchanged since the
 *        original PR; not part of this fix round.
 *
 * AZ — REPLACED in the PR #108 fix round (VAL108-SOV2). The original override (1025, 175,
 * anchor="middle") put ~50% of the label's ink over Armenia (measured: TR 51%/EN 55% inside
 * AM) — the "keeps it inside the frame" reasoning the original override was chosen for never
 * checked which COUNTRY the ink fell on, only the frame edge. Replaced with the validator's
 * own independently re-measured remedy: `anchor="end"` flush to the frame's own east edge
 * (`x: 1120`, `TR_CONTEXT_FRAME.minX + width`, `scripts/lib/tr-frame.mjs`), which pins the
 * label to Azerbaijan's own eastern lobe instead of straddling the AM/AZ border.
 *
 * The validator's own tested remedy used `y: 110.8` (the default `labelPoint.y`, i.e. the
 * SAME row as Armenia's own default label at (982, 106.1)) — reproduced here first, and it
 * measures exactly what the review reported: EN "Azerbaijan" 100% inside AZ, TR "Azerbaycan"
 * 96.5% inside AZ / 3.5% inside AM. But at that shared row the two labels' ink boxes
 * horizontally OVERLAP by several units (TR "Ermenistan" box up to x≈1028; TR "Azerbaycan"
 * box at y=110.8 starts at x≈1022) and visually collide — a NEW defect this fix round's own
 * AZ change would otherwise introduce, caught by rendering the fix rather than trusting the
 * ink-box numbers alone. A joint search over both labels' y (AZ y 104–124 × AM y 80–100,
 * requiring ≥ 6 u of vertical clearance between their ink bands) found `AZ y: 116` / `AM
 * y: 92` as the best pair against the neighbour-country shapes: AZ 2.13% TR / 0% EN foreign
 * ink, AM 1.18% TR / 0% EN foreign ink, 7.8 u of clear vertical gap between the two ink bands.
 * AM therefore gains an override here too (x unchanged at its own default 982, only y moves)
 * — not requested by the review, but required by this fix round's own AZ change to avoid
 * shipping a new collision.
 *
 * SEPARATE AXIS, checked against the REAL rendered page rather than only the generated
 * context-shape geometry (the same QN/CY lesson applied here): Armenia's label — AT ITS
 * ORIGINAL, UNTOUCHED DEFAULT POSITION (982, 106.1), never flagged by this review and not
 * part of its scope — already put 5.19% of the TR ink box over Kars province (0% EN); this
 * is pre-existing and predates this fix round. The repositioned AM (982, 92) measures BETTER
 * on this axis (2.0% TR / 0% EN over Kars), not worse. Pushing AM further east to reach 0%
 * on the Kars axis was tried and rejected: every position tested that clears Kars (x ≳ 984 at
 * this row) costs 5–15% AM-side ink to Azerbaijan instead, which is the wrong trade — AZ is
 * this round's actual CRITICAL finding, Armenia's own small pre-existing Kars overlap is not
 * a finding in this review at all. Recorded honestly as a residual, not silently improved
 * away or silently ignored.
 *
 * A systematic sweep of the whole east-edge/y neighbourhood (edgeX 950–1120 × y 40–220, both
 * locales) found NO anchor/position combination clearing AZ's ink to 0% in BOTH locales:
 * Azerbaijan's own visible sliver here is narrower than the longer TR string, so a few
 * percent is the measured floor, not an unexamined shortfall.
 *
 * FIX ROUND 2 (PR #108, second fix round). An INDEPENDENT claim-verifier pass re-measured
 * the round-1 remedy above (AZ x:1120/y:116/anchor:end, unchanged fontSize 18) with a
 * genuinely fine grid (Chromium `isPointInFill()`, 301×21 = 6,321 points per label, sampled
 * across the label's own `getBBox()`) and found round-1's own "2.13% TR / 0% EN" claim did
 * NOT hold: the real shipped result was **8.12–8.54% TR / 2.66% EN inside Armenia** — more
 * than double, in TR's case, what round 1 reported. The root cause was the MEASURING
 * METHOD, not a fresh geometry change: round 1's own ink band was a narrower approximation
 * (baseline − 0.72·fontSize to baseline + 0.18·fontSize, ≈ 16.2 u tall at fontSize 18) while
 * `getBBox()` — this label's REAL rendered ink box, ascent through descent — is ≈ 23.6 u
 * tall at the same size; the extra ≈ 7.4 u of genuine glyph ink round 1 never sampled is
 * exactly where the Armenia overlap concentrates. Reproduced here first at round 1's own
 * numbers to confirm the regression is measurement, not drift (`git diff` on this override
 * across both fix rounds shows no unrelated change), then re-swept:
 *
 *   Re-ran the SAME wide sweep round 1 described above (edgeX 950–1120 × y −30…260, THREE
 *   anchors: start/middle/end) at fontSize 18 AND 17 and reconfirmed round 1's honest
 *   conclusion still holds at those two sizes: NO position clears AZ's ink to 0% against
 *   Armenia in BOTH locales — Azerbaijan's own visible sliver here is narrower than either
 *   string at 17px or wider.
 *
 *   fontSize 16 (2px down from the shared `CONTEXT_COUNTRY_LABEL_SIZE`, the smallest
 *   integer step below 17 that changes the outcome) DOES clear: keeping `anchor="end"`
 *   flush to the frame's own east edge (`x: 1120`, unchanged) and re-centring `y: 106`
 *   (was 116, chosen from the middle of a y ∈ [96, 112] clean band the sweep found at this
 *   size) measures **0% ink inside Armenia, Georgia, Iran, or ANY other context-land shape
 *   or any of the 81 real province polygons, in BOTH locales — 100% of the label's ink sits
 *   on Azerbaijan's own territory** (Chromium `isPointInFill()`, 6,321-point grid, checked
 *   against the LIVE rendered `<defs>`/`[data-map-layer="context-land"]` geometry, not the
 *   generated artifact in isolation). This is a genuine 0%, not a rounded-down residual —
 *   the fix this round chose is the size reduction the original review invited as an option
 *   once no position-only remedy exists at the shared size.
 *
 *   AM's own override (982, 92) is UNCHANGED — the size reduction does not require moving
 *   it. Re-measured for a NEW visual collision anyway (the same check round 1 ran for its
 *   own AZ change): AM's ink box sits at TR x [933.1, 1030.9] / EN x [946.1, 1017.9]; AZ's
 *   new box sits at TR x [1034.0, 1120.0] / EN x [1042.2, 1120.0] — a real horizontal gap in
 *   both locales (≈ 3.1 u TR, ≈ 24.3 u EN), so the two boxes do not touch despite their y
 *   ranges overlapping. The AM-vs-Kars residual documented above (§"SEPARATE AXIS") is
 *   UNTOUCHED and out of this round's scope, exactly as instructed — AM's x/y did not move,
 *   so that number is unaffected and was not re-measured.
 *
 * MK, RS — REMOVED in the same fix round (VAL108-SOV3) rather than repositioned: see
 * `CONTEXT_LABEL_OMITTED_ISOS` below for why.
 *
 * Verified by rendering: every override keeps its label fully inside the frame and clear
 * of every other label at 1440px, both locales.
 */
const LABEL_ANCHOR_OVERRIDES: Partial<
  Record<
    string,
    {
      readonly x: number;
      readonly y: number;
      readonly anchor: "start" | "middle" | "end";
      /** Per-label font-size override (fix round 2, AZ only) — falls back to
       *  `CONTEXT_COUNTRY_LABEL_SIZE` when absent. See the AZ paragraph above: no
       *  position/anchor combination at the shared 18px clears Azerbaijan's ink off
       *  Armenia in both locales, so this is the deliberate, documented exception. */
      readonly fontSize?: number;
    }
  >
> = {
  AM: { x: 982, y: 92, anchor: "middle" },
  AZ: { x: 1120, y: 106, anchor: "end", fontSize: 16 },
  GR: { x: -105, y: 130, anchor: "start" },
};

/**
 * ISOs deliberately left UNLABELLED even though the api resolves their name (PR #108 fix
 * round, VAL108-SOV3) — their own visible area inside `TR_CONTEXT_FRAME` is too small a
 * sliver to hold their own name without printing it over a wrong neighbour, and none of the
 * three is a sovereignty-sensitive pair (`CONVENTIONS.md` §5 does not apply), so the smallest
 * correct fix is the validator's own recommendation: leave the shape drawn as backdrop and
 * skip the label, the same "unlabelled shape" outcome R10 already gives an ISO the api does
 * not resolve.
 *
 * Measured (Chromium `isPointInFill()`, same 847-point grid, real Nunito Sans 600):
 *   RS — visible area 135 u² (0.5% of Serbia's own territory). Default label: TR 97% / EN 96%
 *        of the ink lands inside Bulgaria, not Serbia.
 *   MK — visible area 756 u² (8.1%). Default label: TR/EN 97% inside Bulgaria.
 *   LB — visible area 542 u² (16.3%). Default label (shape.labelPoint, no override existed):
 *        TR 37% Syria / 32% sea / 30% Lebanon; EN 39% Syria / 35% sea / 26% Lebanon.
 * No position/anchor combination clears any of the three to 0% foreign ink — their own
 * visible slivers are smaller than even the shortest legible rendering of their name.
 */
const CONTEXT_LABEL_OMITTED_ISOS = new Set(["MK", "RS", "LB"]);

/**
 * The KKTC/Cyprus paired label placement (plan §5.6). Both entities' inscribed radii
 * (QN 11.1 u, CY 15.2 u) are far too small to hold their own names — `Kuzey Kıbrıs Türk
 * Cumhuriyeti` alone needs ≈ 246 u (≈ 305 u in English) — so both are named in a two-line
 * block placed in open Mediterranean water, each with a short leader line to its own shape.
 * `CONVENTIONS.md` §5's paired-precision rule is why this is one block, not two
 * independently placed labels: the pair is decided together (§5.6), and both leader lines
 * get the identical treatment.
 *
 * FIX ROUND (PR #108 review, VAL108-SOV1/VAL108-SOV4). The original block (both rows at
 * x=480) sat directly north of the island, over Türkiye and Syria: measured TR "Kuzey Kıbrıs
 * Türk Cumhuriyeti" 48% Türkiye / 15% Syria / 38% sea; EN 45%/21%/34%. The docblock at the
 * time claimed "verified by rendering: clear of the Akdeniz sea label, the Syria/Lebanon
 * coastline and the shapes themselves" — that claim was never actually measured and was
 * false; this paragraph replaces it with what IS measured, below. The original leader lines
 * also crossed each other in open water (437.96, 438.18) and the Cyprus line cut across
 * 16.9% of Northern Cyprus's own territory.
 *
 * Both rows moved WEST into open water clear of Türkiye and Syria, and the two rows were
 * given DIFFERENT x centres (rather than one shared x) so neither row's leader line has to
 * cross the other row's text on its way to its own shape. Re-measured in this fix round
 * (Chromium `isPointInFill()`, 121×7 = 847-point ink-box grid per label, real shipped
 * Nunito Sans 600, both locales) — TWO PASSES, because the first pass measured against the
 * `lib/map/tr-context.generated.ts` CONTEXT_SHAPES geometry only and the second, on the
 * actually-rendered page, additionally checked the real 81-`PROVINCE_SHAPES` union (a finer
 * coastline than the coarse Natural-Earth "TR" casing shape): the QN row's first candidate
 * y (422) put 2/847 (TR) and 1/847 (EN) sample points on Mersin's own coastline at the very
 * top of the ink band (y ≈ 409, the cap-height row) — small, but not the claimed 0%, so it
 * was pushed one step further (y 422 → 426; a y ∈ [424, 428] sweep on the real page was
 * clean at every step tried, 426 sits in the middle of it) rather than left at a
 * near-miss:
 *   QN row (x 340, y 426) — TR "Kuzey Kıbrıs Türk Cumhuriyeti" and EN "Turkish Republic of
 *     Northern Cyprus": 0% of either ink box falls inside ANY context shape OR any of the 81
 *     real province polygons (i.e. 100% open water) — verified against the live rendered
 *     page, not only the generated-artifact geometry.
 *   CY row (x 260, y 448) — measured at the time against TR "Kıbrıs Cumhuriyeti" and EN
 *     "Republic of Cyprus": same, 0% foreign-shape ink in both locales, verified against the
 *     live rendered page. **NOT re-measured since the rename** (`DEC 2026-08-30b`/
 *     `DEC 2026-08-31a`, `cografya_api` PR #154): the live TR text this anchor now renders is
 *     "Güney Kıbrıs Rum Yönetimi" — ~39% longer (25 vs. 18 characters) than the string this
 *     ink-box claim was measured against — while `nameEn` is unchanged. This specific 0%
 *     claim is therefore UNCONFIRMED for the TR locale's current live text; flagged as an
 *     open follow-up (a fresh ink-box re-measurement, the same method as rounds 1–3 above),
 *     not silently assumed to still hold and not re-derived here.
 *   Leader lines (from 8 u below each row's baseline, clear of its own ink band, to the
 *     shape's own `labelPoint`): the two segments do not cross (checked algebraically);
 *     neither line's own text-clear starting point sits inside the OTHER row's ink box in
 *     either locale; each line's sampled path (201 points) is 100% either open sea or its
 *     OWN target shape — 0% crosses into the other entity's territory or into TR/SY.
 * See the PR's fix-round completion report for the full search and the exact sample counts.
 *
 * FIX ROUND 2 (PR #108, second fix round). An independent claim-verifier pass re-measured
 * the QN row above with the label's REAL `getBBox()` ink box (ascent through descent, not
 * the round-1 "0.72·fontSize above baseline to 0.18·fontSize below" approximation — the
 * same measuring-method gap the AZ paragraph above documents) at a fine 301×21 = 6,321-point
 * grid and found the y:426 row was NOT fully clear: **0.089–0.275% of the ink box (both
 * locales) still lands on Mersin's own coastline**, on the label's topmost cap-height row —
 * small, but genuinely non-zero, and round 1's "0%" claim did not hold under the finer
 * method. `y: 426 → 428` (2 u further south, still `x: 340`, anchor unchanged) clears it:
 * re-measured on the live rendered page at the same 6,321-point grid, **0% of the QN row's
 * ink box falls inside Mersin, any other of the 81 province polygons, any context-land
 * shape, or the TR casing, in either locale** — the only non-zero hit at this position is
 * 2/6,321 points (0.032%) landing on NORTHERN CYPRUS'S OWN shape, which is not a foreign-
 * territory defect (it is the entity the row names). `leaderFrom.y` moves with it (`434 →
 * 436`, preserving the original 8 u-below-baseline offset); re-verified after the move: the
 * QN/CY leader segments still do not cross (algebraic solve, `t`/`s` both far outside
 * [0, 1]), and each line's 201-point sampled path is 100% either open water or its own
 * target shape in both locales — no foreign-territory or TR/SY crossing reintroduced. The
 * CY row is UNTOUCHED (unaffected — the claim-verifier's re-measurement found it clean at
 * 0% in both locales at the finer grid too).
 *
 * FIX ROUND 3 (PR #108, third fix round; SOV108R2-I1 / SOV108R2-I2). Two small IMPORTANT
 * findings against round 2's own shipped state, both re-measured live (Chromium
 * `isPointInFill()` / `getBBox()` / exact segment-vs-rectangle intersection — the same
 * rigor as rounds 1–2 — against the actually-rendered page, both locales, 768px AND
 * 1440px; round 2's own check only ran at 1440px, which is why neither surfaced there).
 *
 * SOV108R2-I1 — the QN row's `leaderFrom` used the SAME "8 u below baseline" formula the CY
 * row uses, and because the two rows' baselines sit only 20 u apart while each row's own ink
 * band is ≈ 23.56 u tall, that shared offset put the QN leader's start point just
 * 0.40–1.66 svg u from the CY row's own ink box (measured `distanceToCyBox`, all four
 * width/locale combinations) — optically indistinguishable from "inside it", which is why
 * the KKTC line read as emanating from the Cyprus line at 768px. Root cause: a formula
 * copied from the OTHER row, not derived from this row's own geometry — exactly what the
 * finding named. Fix: `leaderFrom.x` moves from 340 (the label's own centre) to 380 — still
 * comfortably under the QN row's own (much wider) ink box, x ∈ [185, 495] in EN — which
 * alone puts the whole point out of the CY row's ink-box x-range (CY's own right edge sits
 * at x ≈ 338–340 in both locales), independent of `leaderFrom.y`; `leaderFrom.y` stays a
 * short, real offset below the QN row's own ink-box bottom edge (433.89), not a copy of the
 * CY row's constant. Re-measured: `distanceToCyBox` 40.40–41.66 svg u in all four
 * combinations (≈ 25–47 px at typical render widths) — a two-order-of-magnitude increase —
 * and the leader-line SEGMENT itself (not just its start point) never intersects the CY
 * row's ink box (exact Liang–Barsky segment-vs-rectangle test, not a sampled approximation).
 *
 * SOV108R2-I2 — the CY row's leader is a single straight segment from `leaderFrom` (8 u
 * below the CY baseline, same formula as above) to `cyShape.labelPoint`. That segment
 * passed straight through `SEA_LABELS.seaMediterranean`'s ink box: measured 79.5–85.1% of
 * the EN segment's own length sat inside the sea label's box (`t0`/`t1` on the exact
 * intersection test), and — not previously checked, because round 1/2 only validated the
 * LABEL text against shapes, never a LEADER LINE against another label's ink box — even the
 * narrower TR "Akdeniz" box was entered for 16.7–17.6% of the segment's length. This is also
 * *why* the round's own A11Y108-I1 contrast fix (`--color-accent` at full opacity) still
 * measured 2.44:1 where reported: `--color-accent` (#276b70) against `--color-ink`
 * (#2b2622, the label text's own fill) is 2.44:1 regardless of opacity — reproduced
 * independently here — so the only real fix is to stop the line crossing the label at all,
 * not to recolour it.
 *
 * ROOT GEOMETRIC CONSTRAINT, recorded honestly rather than papered over: the CY row's own
 * ink-box BOTTOM edge (453.89) and `seaMediterranean`'s ink-box TOP edge (454.08) are only
 * 0.19 svg u apart — there is no straight line from anywhere near the CY row's (short) text
 * to `cyShape.labelPoint` that both starts close to the text and never crosses the sea
 * label's box; every straight-line candidate tried traded one for the other. The CY leader
 * therefore becomes a two-segment `<polyline>` (`leaderFrom` → `leaderElbow` →
 * `cyShape.labelPoint`) rather than a `<line>` — a bent leader, not a straight one, the
 * option the finding itself named ("adjust... the Cyprus leader line's path"). Each leg is
 * safe by a DIFFERENT, structurally-guaranteed axis rather than a single tuned diagonal: leg
 * 1 (`leaderFrom` → `leaderElbow`, both at y = 448, the CY row's own baseline) stays entirely
 * ABOVE the sea label's ink-box top edge (454.08) regardless of x, clearing it by 454.08 −
 * 448 = 6.08 svg u; leg 2 (`leaderElbow` → target, x moving from 360 to `cyShape.labelPoint.x`
 * = 369.3) stays entirely to the RIGHT of the sea label's ink-box right edge — 346.86 (EN) /
 * 278.30 (TR) — regardless of y, clearing it by 13.14 u (EN) / far more (TR). Both legs
 * independently pass the exact segment-vs-rectangle test at every width/locale combination
 * (`intersects: false`); the live-sampled minimum distance from either leg to the sea box is
 * 5.76–14.24 svg u in EN (the binding locale — its sea-label box is the widest) and
 * 51.06–81.93 svg u in TR. `leaderFrom` sits at x = 330, inside the CY row's own ink box
 * (x ∈ [180, 340]) at its own baseline height, so the line still visibly starts at the row's
 * own text rather than floating free of it.
 *
 * RE-VERIFIED, both rows, all four width/locale combinations, after the change (not assumed
 * unaffected because the edit is "just leader lines"): the QN segment and the CY row's two
 * segments never cross each other (exact segment-vs-segment test, all pairs); every
 * sampled point (201 per segment) along all three segments classifies as "water" or the
 * segment's OWN target shape (QN or CY) — zero points land on Türkiye (casing or any of the
 * 81 provinces), Syria, Armenia, or Azerbaijan, in either locale, at either width — so the
 * CRITICAL sovereignty placement two earlier rounds closed stays closed. `seaMediterranean`
 * itself is UNTOUCHED (neither its anchor nor `SEA_LABELS` changed this round): re-confirmed
 * at the same 161×9 = 1,449-point grid VAL108-SOV6 used, 0/1,449 points fall inside the QN or
 * CY shapes in either locale — the invariant that fix established is still intact.
 */
const CY_QN_LABEL_BLOCK = {
  qn: { x: 340, y: 428, leaderFrom: { x: 380, y: 438 } },
  cy: {
    x: 260,
    y: 448,
    leaderFrom: { x: 330, y: 448 },
    leaderElbow: { x: 360, y: 448 },
  },
} as const;

/**
 * Interactive Türkiye map (server component — SPEC / DEC 2026-07-10). Since the IA
 * restructure (→ DEC 2026-07-13) this is the primary content of the dedicated
 * `/turkiye` hub page (it previously lived on the homepage; the retired `/iller`
 * plain list is gone).
 *
 * Renders all 81 il outlines from the committed, build-time-generated SVG paths
 * (`lib/map/tr-provinces.generated.ts` — raw GeoJSON never ships). A shape becomes
 * an interactive, crawlable `<a>` (hub-and-spoke, CONVENTIONS §6 #10) with a stat
 * card ONLY when the api's map-summary carries its plaka kodu — i.e. the province is
 * seeded and has a published `/turkiye/{slug}` page. The rest render as inert backdrop
 * and light up automatically as more il are seeded. So the map never links to a
 * not-yet-published (soft-404) page (SEO §6 #6), and degrades to a static map picture
 * if the summary is unreachable — the interactivity is progressive enhancement over
 * the always-present crawlable `<a>` links.
 *
 * The card's numbers (nüfus / yüzölçümü / ilçe) come from the single purpose-built
 * `/api/provinces/map-summary` payload, formatted server-side and pre-embedded as
 * `data-*` on each link (no per-hover fetch — INP, SPEC §1.6).
 *
 * THREE PAINT LAYERS OVER ONE COPY OF THE GEOMETRY (owner report 2026-08-02; the measured
 * design study is `Owner's Inbox/ui-cila-arastirma/hover-overlay-plan.md`). The owner's
 * complaint was that a hovered province's border is thick on one side and half-eaten on the
 * other — Konya's west edge full weight, its east edge a hairline. That is not a styling bug,
 * it is PAINT ORDER: shapes are drawn in plaka order, so every neighbour drawn AFTER the
 * hovered one paints its own fill and its own 1px border over the hover line's inner half.
 * SVG has no `z-index` (document order wins, verified), and a mirror `<use>` copy of the
 * shape does NOT track the original's `:hover`, so neither shortcut exists. The fix is
 * structural:
 *
 *   <defs>                 81 UNSTYLED <path id> — the geometry MOVES here, it is not copied
 *   <g data-map-layer=base>  today's painted map, byte-identical in appearance; inert to the
 *                            pointer and hidden from AT
 *   <g data-map-layer=hit>   the crawlable <a> wrappers + a <use> unpainted at rest
 *                            that carries ONLY the hover/focus line — above every fill and
 *                            every resting border on the map
 *   <InlandWaterLayer>       P6's lakes, still the LAST PAINTED map layer (see the note at
 *                            the call site): it masks the boundary running across a lake and
 *                            it swallows the mid-lake click, and both of those ARE its paint
 *                            position
 *
 * WIDENED, turkiye-yenileme PR-B (plan §5.4): three GEOGRAPHIC CONTEXT groups joined this
 * stack — `context-casing` and `context-land` BEFORE `base` (so a province's own fill always
 * wins over the backdrop, never the reverse), and `context-labels` AFTER `InlandWaterLayer`
 * (so no fill ever covers a name). None of the three is a province: they add no `<a>`, no
 * `tabIndex`, no `data-shape`, and all three (labels included) are `pointer-events: none` —
 * the SAME regression class the paragraph above this one exists to prevent, re-verified for
 * this change by the same `elementFromPoint` occlusion probe (§11 of the plan; see the PR's
 * completion report for the actual re-run numbers). `MAP_VIEWBOX` and its nine other
 * consumers are UNTOUCHED — this component alone widens to `TR_CONTEXT_VIEWBOX`, a second,
 * independent frame in the same coordinate space (`scripts/lib/tr-frame.mjs`).
 *
 * So no province can eat the hover line: Konya's east and west edges are now pixel-identical.
 * (The one thing painted over it is the water, on the few borders a lake crosses — which is
 * exactly what already happens to the resting border, and is the cartographic rule P6
 * implements: the administrative line stops at the shore.) It costs ONE css rule (down from a
 * family of them), and it is measurably CHEAPER per pointer move than what it replaces
 * (1.71ms → 1.50ms).
 *
 * PAGE WEIGHT — the honest number, because an earlier draft of this note had it backwards.
 * The SVG MARKUP does get smaller gzipped (−338 B: 81 `<use href="#tr-map-42"/>` compress
 * better than 81 inline `<path class d>`), but that is not what ships. Next serializes the
 * same markup a SECOND time into the RSC flight payload, so the real gzipped total for
 * `/turkiye` is **+1,419 B (+1.8%)** — measured end-to-end on one running build, not
 * inferred. (`/dunya` +5,657 B / +3.0%; `/oyun/81-il` +5,765 B / +8.2%.) Small in absolute
 * terms and per-pointer-move work goes down, so it was accepted — but it is a growth, and a
 * comment that claims a shrink is worse than no comment.
 *
 * THREE `<use>` BEHAVIOURS THAT ARE LOAD-BEARING HERE, each one measured:
 *  1. A `<use>` clone takes the CSS that matched the REFERENCED element, so the geometry in
 *     `<defs>` has to stay CLASSLESS. Everything visual is set on the `<use>` and reaches the
 *     clone by INHERITANCE (`fill`, `stroke`, `stroke-*`, `fill-rule`, `pointer-events` are
 *     all inherited properties).
 *  2. `vector-effect` is NOT an inherited property. Declared on the `<use>` it never reaches
 *     the clone, and province borders then thicken with zoom (measured: a 1px border became
 *     a ~12px grey band at 12×). It therefore sits as a presentation attribute ON THE
 *     GEOMETRY, which is the one place a clone reads it from.
 *  3. A clone does not track the original's `:hover` — which is why the `<a>` and its `<use>`
 *     both live in the hit layer rather than mirroring the base one.
 *
 * SEO SURFACE: UNCHANGED. The same 81 crawlable `<a>`, the same `href`s, the same order, in
 * the same first-response HTML. No metadata, canonical, hreflang, JSON-LD or sitemap surface
 * is touched, and not one visible string moves.
 */
export async function TurkeyMapSection({ locale }: TurkeyMapSectionProps) {
  const tMap = await getTranslations("Map");
  const tRegions = await getTranslations("Regions");
  const tDetail = await getTranslations("ProvinceDetail");
  const format = await getFormatter();

  // Best-effort: the map is a homepage enhancement, so a summary-fetch failure hides
  // the interactivity (all shapes inert) rather than breaking the homepage — the
  // same discipline as the detail page's neighbour block.
  let summaries: ProvinceMapSummary[] = [];
  try {
    summaries = await getMapSummary();
  } catch (error) {
    console.warn(`[map] map-summary unavailable; rendering inert map. ${String(error)}`);
  }
  // Raw plateCode join: both sides are the api's 2-digit zero-padded codes (api
  // ENGINEERING.md §5), matching the generated artifact — same posture as the existing
  // neighbour-code join.
  const byPlate = byPlateCode(summaries);

  // Country names for the geographic-context labels (plan §5.6) come from the SAME
  // `/api/countries/map-summary` endpoint `/dunya` already reads — never from
  // `messages/*.json` (CONVENTIONS.md §5: sovereignty-sensitive status framing is
  // represented by the api, not a frontend-maintained entity list).
  //
  // FIX ROUND (PR #108 review, FEN108-M2): this used to call `getCountryMapSummary()`
  // wrapped in a local best-effort `try/catch` that swallowed EVERY failure — including a
  // transient RUNTIME outage, which would let ISR cache a `/turkiye` render missing all 18
  // context-label `<text>` nodes (14 countries + the KKTC/Cyprus pair) as if that were the
  // correct steady state. `getCountryMapSummaryResilient()` (`lib/api/countries.ts`) already
  // draws exactly the distinction this surface needs: `[]` at BUILD (so web CI, which has no
  // api service, still builds) and RE-THROW at RUNTIME (so a transient blip leaves the last
  // good static page in place instead of caching one that silently lost its country data) —
  // the same posture the plan's own §10 R10 already assumes for an unresolved ISO, but now
  // actually enforced instead of unconditionally swallowed.
  const countrySummaries = await getCountryMapSummaryResilient();
  const byIso = byIsoCode(countrySummaries);

  const contextCasing = CONTEXT_SHAPES.find((shape) => shape.iso === CONTEXT_CASING_ISO);
  const contextLand = CONTEXT_SHAPES.filter((shape) => shape.iso !== CONTEXT_CASING_ISO);

  const titleId = "turkey-map-title";

  return (
    // The "Haritadan bir il seçin" <h2> and its instruction paragraph were removed by
    // the site-wide frame-copy trim (→ DEC 2026-07-30t/u, CONTENT-STYLE §22): the
    // heading restated what the map itself shows, and the paragraph both narrated the
    // interaction and carried a stale claim ("kalan iller içerik doğrulandıkça
    // eklenir" — all 81 are live). The region keeps an accessible name via aria-label
    // (same string as the <svg> <title>) rather than a visually-hidden heading: an
    // equivalent landmark name with no hidden text on the page.
    <section className="section" aria-label={tMap("mapTitle")}>
      {/* .trContextRoot = flat sea backdrop (turkiye-yenileme PR-B, plan §5.5): the map now
          draws real sea, so the panel background switches from the warm parchment gradient
          `/dunya`'s own `.worldRoot` modifier already establishes the pattern for — a
          class of its own on [data-map-root], never an edit to `.mapRoot` itself, because
          `tool-map.tsx` shares that base rule and would otherwise gain a sea background
          nobody asked for. */}
      <div className={`${styles.mapRoot} ${styles.trContextRoot}`} data-map-root>
        <svg className={styles.svg} viewBox={TR_CONTEXT_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>

          {/* THE GEOMETRY, ONCE. Classless on purpose (note 1 in the component docblock);
              `vector-effect` is here rather than in the stylesheet because it is the one
              stroke property a `<use>` clone cannot inherit (note 2). */}
          <defs>
            {PROVINCE_SHAPES.map((shape) => (
              <path
                key={shape.plateCode}
                id={`${SHAPE_ID_PREFIX}${shape.plateCode}`}
                d={shape.d}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </defs>

          {/* CONTEXT LAYERS — geographic backdrop (turkiye-yenileme PR-B, plan §5.4). Drawn
              FIRST, before the province `base`/`hit` layers, so a province's own fill and
              hover/focus line always paint over the context — the paint-order stack this
              file's own docblock already documents is now: casing → land → base (unchanged)
              → hit (unchanged) → InlandWaterLayer (unchanged, still last PAINTED layer) →
              labels (last of all, so nothing covers a name). All three context groups are
              `pointer-events: none` WITHOUT EXCEPTION — this is the exact shape of the
              62%-of-the-map credit-plate regression this docblock records above (an overlay
              without it returned the credit instead of the map for 59/81 province centres at
              320px); none of the three carries an `<a>`, a `tabIndex` or a `data-shape`, so
              the hit layer stays the only thing on this map that scores a hit. */}

          {/* Türkiye's own Natural Earth outline, filled + self-coloured-stroked UNDER
              everything else. Its fill covers every point where NE-Türkiye's generalisation
              reaches outside the 81-province union (measured, plan §5.0-3: p99 2.47 u, max
              4.60 u) — closing the seam by construction, not by a tuned number. Its stroke is
              a SCALING one (no `vectorEffect`, deliberately — plan §5.4): the halo has to stay
              proportional to the map at every container width, unlike the province hairlines,
              which stay a constant device-pixel width via `non-scaling-stroke`. */}
          <g data-map-layer="context-casing" className={styles.contextCasing} aria-hidden="true">
            {contextCasing && <path d={contextCasing.d} />}
          </g>

          {/* The 14 neighbour/near-neighbour countries whose Natural Earth outline has any
              visible area inside the widened frame (`lib/map/tr-context.generated.ts` —
              every survivor is drawn, no hand-kept "immediate neighbours" list, plan §5.3).
              Each carries its own hairline coastline/border (`--map-context-line`,
              non-scaling so it stays a hairline at every rendered size, matching every other
              boundary line on this map) over the shared `--map-context-land` fill. */}
          <g data-map-layer="context-land" className={styles.contextLand} aria-hidden="true">
            {contextLand.map((contextShape) => (
              // `contextShape`, deliberately NOT `shape`: keeping the province `<defs>` loop's
              // `d={shape.d}` the ONLY match for that pattern is what lets
              // `map-layers.test.ts`'s "geometry written once" guard stay a single,
              // unambiguous regex rather than something a differently-named loop variable could
              // satisfy by accident (plan §5.4) — the context array gets its OWN explicit
              // "written once" assertion instead, matching this variable name.
              <path key={contextShape.iso} d={contextShape.d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* LAYER 1 — the map as it has always looked: fill + 1px resting border, all 81
              shapes in plaka order. Decorative by construction (every accessible name lives
              in the hit layer), and inert to the pointer so a hit can only ever be scored by
              the layer that owns the links. */}
          <g data-map-layer="base" className={styles.mapBase} aria-hidden="true">
            {PROVINCE_SHAPES.map((shape) => (
              <use
                key={shape.plateCode}
                href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`}
                className={byPlate.has(shape.plateCode) ? styles.province : styles.provinceInert}
              />
            ))}
          </g>

          {/* LAYER 2 — the crawlable links and NOTHING ELSE that paints. A not-yet-published
              province has no twin up here at all: it is backdrop, so it gets no link, no
              card, no tab stop and no hover line. */}
          <g data-map-layer="hit">
            {PROVINCE_SHAPES.map((shape) => {
              const province = byPlate.get(shape.plateCode);
              if (!province) return null;
              const region = tRegions(province.region);
              const href = getPathname({
                locale,
                href: {
                  pathname: "/turkiye/[slug]",
                  params: { slug: locale === "en" ? province.slugEn : province.slugTr },
                },
              });
              // Stat-chip rows, formatted server-side; a null stat omits its row
              // (honest — never a placeholder dash). Labels reuse the ProvinceDetail
              // namespace so the card and the detail page read identically.
              const popLabel =
                province.population !== null
                  ? province.populationYear
                    ? tDetail("populationWithYear", { year: province.populationYear })
                    : tDetail("population")
                  : undefined;
              const popValue =
                province.population !== null ? format.number(province.population) : undefined;
              const areaValue =
                province.areaKm2 !== null
                  ? `${format.number(province.areaKm2)} ${tDetail("areaUnit")}`
                  : undefined;
              const areaLabel = areaValue ? tDetail("area") : undefined;
              const districtValue =
                province.districtCount !== null ? format.number(province.districtCount) : undefined;
              const districtLabel = districtValue ? tDetail("districtCount") : undefined;
              // Accessible-name parity (a11y, PR#6 round-2): the hover card is a
              // pointer-only visual surface (aria-hidden), so keyboard/AT users reach
              // the province only through this <a>'s name. Fold the same stat rows the
              // sighted card shows into the label — but ONLY the non-null ones, so the
              // 76 unseeded il stay a clean "name, region" and the 5 seeded ones read
              // "name, region. Nüfus … Yüzölçümü … İlçe Sayısı …" with no "null" leaking.
              const statPhrases: string[] = [];
              if (popLabel && popValue) statPhrases.push(`${popLabel} ${popValue}`);
              if (areaLabel && areaValue) statPhrases.push(`${areaLabel} ${areaValue}`);
              if (districtLabel && districtValue)
                statPhrases.push(`${districtLabel} ${districtValue}`);
              const ariaLabel =
                statPhrases.length > 0
                  ? `${province.nameTr}, ${region}. ${statPhrases.join(". ")}.`
                  : `${province.nameTr}, ${region}`;
              return (
                // A plain SVG <a> with a server-computed localized next-intl pathname:
                // a real crawlable link in the first-response HTML, reliable inside
                // <svg> (Next's <Link> component targets the HTML anchor, not the SVG
                // namespace). Navigation is a full load — fine for a hub map. The
                // `data-*` are the shared, entity-agnostic hover-card contract (see
                // map-hover-card.tsx): badge = plaka, subtitle = bölge, three stat slots.
                <a
                  key={shape.plateCode}
                  className={styles.provinceLink}
                  href={href}
                  aria-label={ariaLabel}
                  data-shape={province.plateCode}
                  data-name={province.nameTr}
                  data-subtitle={region}
                  data-badge={tMap("plateLabel", { code: province.plateCode })}
                  data-href={href}
                  data-stat1-label={popLabel}
                  data-stat1-value={popValue}
                  data-stat2-label={areaLabel}
                  data-stat2-value={areaValue}
                  data-stat3-label={districtLabel}
                  data-stat3-value={districtValue}
                >
                  {/* Paints NOTHING at rest — no fill, no stroke — and still takes every
                    pointer event (`pointer-events: all`). It exists so the hover/focus line
                    has somewhere to be drawn ABOVE the whole base layer. */}
                  <use href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`} className={styles.hitEdge} />
                </a>
              );
            })}
          </g>

          {/* Still the LAST PAINTED map layer (turkiye-yenileme PR-B moved the true last CHILD
              to the label group below it): opaque water painted after every province layer is
              what hides the boundary segments crossing a lake, and what makes a mid-lake click
              hit the water instead of the hit layer's link (→ DEC 2026-08-02k md. 5 — a click
              on water does nothing). Moving it under the hit layer would restore the
              navigation it exists to swallow. See components/map/inland-water-layer.tsx. */}
          <InlandWaterLayer />

          {/* CONTEXT LABELS — drawn LAST of everything so no fill ever covers a name (plan
              §5.4/§5.6). Unlike the two shape groups above, this group is NOT `aria-hidden`:
              it is real geographic text — fourteen short country names plus four sea names,
              not forty-three tab stops — and hiding visible words from AT to keep a group
              tidy is the wrong trade (the `inland-water-layer.tsx` "decorative, no page, no
              label, no action" precedent does not transfer to a name). `pointer-events: none`
              still applies (the shared `.contextGroup` rule), same as the two shape groups:
              a label is never a hit target. Hidden entirely below 720px
              (`@media (max-width: 720px)` in map.module.css) — reusing `marine.module.css`'s
              own breakpoint for the identical problem: at that width no font size or
              placement rule makes fourteen names readable. */}
          <g data-map-layer="context-labels" className={styles.contextLabels}>
            {SEA_LABELS.map((sea) => (
              <text
                key={sea.key}
                x={sea.x}
                y={sea.y}
                textAnchor="middle"
                fontSize={CONTEXT_SEA_LABEL_SIZE}
                className={`${styles.contextLabel} ${styles.contextSeaLabel}`}
              >
                {tMap(sea.key)}
              </text>
            ))}

            {contextLand
              // QN/CY get the dedicated paired block below; MK/RS/LB are deliberately
              // unlabelled backdrop (VAL108-SOV3 fix round — see CONTEXT_LABEL_OMITTED_ISOS).
              .filter(
                (shape) =>
                  shape.iso !== "QN" &&
                  shape.iso !== "CY" &&
                  !CONTEXT_LABEL_OMITTED_ISOS.has(shape.iso),
              )
              .map((shape) => {
                const country = byIso.get(shape.iso);
                if (!country) return null; // R10: an ISO the api has not published draws unlabelled
                const name = locale === "en" ? country.nameEn : country.nameTr;
                const override = LABEL_ANCHOR_OVERRIDES[shape.iso];
                const x = override ? override.x : shape.labelPoint.x;
                const y = override ? override.y : shape.labelPoint.y;
                const anchor = override ? override.anchor : "middle";
                // Fix round 2 (AZ only, see LABEL_ANCHOR_OVERRIDES docblock): an override
                // may carry its OWN font-size when no position/anchor combination at the
                // shared size clears its ink off a neighbour's territory.
                const fontSize = override?.fontSize ?? CONTEXT_COUNTRY_LABEL_SIZE;
                return (
                  <text
                    key={shape.iso}
                    x={x}
                    y={y}
                    textAnchor={anchor}
                    fontSize={fontSize}
                    className={styles.contextLabel}
                  >
                    {name}
                  </text>
                );
              })}

            {/* KKTC/Cyprus — labelled as a pair or not at all (plan §5.6, CONVENTIONS.md §5).
                Both names come from the live api (never hardcoded), verified against
                `GLOSSARY.md` §7.3's locked `Kuzey Kıbrıs Türk Cumhuriyeti` /
                `Turkish Republic of Northern Cyprus` form before shipping — see the
                completion report. If either is not (yet) published by the api, NEITHER is
                labelled, so the pair is never asymmetric. */}
            {(() => {
              const qn = byIso.get("QN");
              const cy = byIso.get("CY");
              const qnShape = contextLand.find((shape) => shape.iso === "QN");
              const cyShape = contextLand.find((shape) => shape.iso === "CY");
              if (!qn || !cy || !qnShape || !cyShape) return null;
              const qnName = locale === "en" ? qn.nameEn : qn.nameTr;
              const cyName = locale === "en" ? cy.nameEn : cy.nameTr;
              return (
                <g>
                  <line
                    className={styles.contextLeader}
                    x1={CY_QN_LABEL_BLOCK.qn.leaderFrom.x}
                    y1={CY_QN_LABEL_BLOCK.qn.leaderFrom.y}
                    x2={qnShape.labelPoint.x}
                    y2={qnShape.labelPoint.y}
                  />
                  {/* ELBOWED, unlike the QN line above (fix round 3, SOV108R2-I2): a single
                      straight segment from anywhere near Cyprus's own (short) text to its
                      shape's labelPoint provably re-crosses the Mediterranean Sea label's ink
                      box — the two boxes are only 0.19 u apart vertically, so no straight line
                      threading that gap clears the sea label. The elbow's first leg stays
                      ABOVE the sea label's ink-box top edge the whole way (y stays below its
                      454.08 top, regardless of x); the second leg stays to the RIGHT of its
                      346.86(EN)/278.30(TR) right edge the whole way (x stays past it,
                      regardless of y) — two independently safe legs, not a tuned diagonal. */}
                  <polyline
                    className={styles.contextLeader}
                    fill="none"
                    points={`${CY_QN_LABEL_BLOCK.cy.leaderFrom.x},${CY_QN_LABEL_BLOCK.cy.leaderFrom.y} ${CY_QN_LABEL_BLOCK.cy.leaderElbow.x},${CY_QN_LABEL_BLOCK.cy.leaderElbow.y} ${cyShape.labelPoint.x},${cyShape.labelPoint.y}`}
                  />
                  <text
                    x={CY_QN_LABEL_BLOCK.qn.x}
                    y={CY_QN_LABEL_BLOCK.qn.y}
                    textAnchor="middle"
                    fontSize={CONTEXT_COUNTRY_LABEL_SIZE}
                    className={styles.contextLabel}
                  >
                    {qnName}
                  </text>
                  <text
                    x={CY_QN_LABEL_BLOCK.cy.x}
                    y={CY_QN_LABEL_BLOCK.cy.y}
                    textAnchor="middle"
                    fontSize={CONTEXT_COUNTRY_LABEL_SIZE}
                    className={styles.contextLabel}
                  >
                    {cyName}
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>

        <MapHoverCard />
      </div>

      {/* BELOW THE MAP BOX, NOT ON IT (`FU-TURKIYE-ATIF-ORTUSU`; owner-ruled from a rendered
          frame — → DEC 2026-08-21d md.2). This surface is the fourth to make the move — the
          game did it first, then the CBS tool pages, then `/dunya` in PR #77 — but NOT the last
          map in the repo that needs it: `/deniz` still plates its credit from
          `marine.module.css`, tracked as `FU-MARINE-ATIF-PLAKASI`.

          WHAT IT FIXES, RE-MEASURED ON THIS BUILD RATHER THAN QUOTED. The plate was
          `position: absolute; right: 14px; bottom: 10px` inside `[data-map-root]`, and at
          phone widths it is not a corner chip at all — with no `left` offset it stretches
          from the panel's inner left edge to 14px off its right, so at 320px it measures
          264 × 79.69 over a 280 × 121.25 panel: **62.0% of the map**. Hit-testing each of the
          81 links at its own bounding-box centre with `elementFromPoint`, **59 of 81 il
          centres return the credit, not the map** at 320px, and 36 of 81 at 360px — identical
          in both locales. That is a navigation defect, not a cosmetic one: `.attribution`
          carried no `pointer-events: none`, so the plate ATE the click on those 59 shapes.
          The same probe reads 0 of 81 with the credit in flow, at every width and in both
          locales.

          The credit stays VISIBLE and stays INSIDE the map component — it moves out of the
          bordered box into this component's own flow, under the map, which is the sentence
          DEC 2026-07-10 md.4 asks for ("visible (map footer/component)"). In flow it needs no
          scrim to stay legible: `--color-slate` on `--color-bg` is 7.48:1 (`DESIGN.md` §5),
          against a plate that only existed to survive being over the map.

          THE PANEL DOES NOT MOVE. An absolutely positioned plate never contributed to
          `.mapRoot`'s height, so the box stays at exactly the height it has today (measured:
          121.25px at 320, 138.42 at 360, 313.45 at 768, 464.45 at 1440 — unchanged) and the
          map inside it is not relaid out. What grows is the `<section>`, by the credit's own
          flow height, in the first-response HTML — so nothing shifts after paint (CWV/CLS,
          `ENGINEERING.md` §4 #9).

          NOT ONE CHARACTER OF EITHER LICENCE STRING MOVED: the two message keys, their order,
          the `lang="en"` wrapper and the `{" "}` below are exactly as they were.

          TWO obligations, one credit. OSM's ODbL covers the dams and permanent lakes; the
          seasonal and salt lakes come from JRC Global Surface Water, whose terms require
          both the dataset credit and, on /hakkimizda, the journal citation.

          `Source: EC JRC/Google` is the licensor's own wording: VERBATIM in both locales,
          never translated, shortened or expanded (→ DEC 2026-08-02q §F). It therefore sits
          in its own `lang="en"` span — the `marine-attribution.tsx` pattern, for the same
          reason (WCAG 3.1.2): a Turkish-voice screen reader must not read an English
          licence string with Turkish phonetics. The Turkish label stands ALONGSIDE it.

          ONE paragraph, TWO block spans WITH A REAL SPACE BETWEEN THEM — and the reason is
          no longer the layout. It used to be: the plate was `position: absolute; bottom:
          10px`, so a second `<p>` would have landed on top of the first. In flow that
          constraint is gone and two paragraphs would stack correctly. It stays one paragraph
          because the two notices are ONE credit for ONE water layer, which is the same
          reasoning `game-map.tsx` records for the same markup; `attribution-separation.test.ts`
          guards the shape on all three surfaces and is indifferent to which reason holds.

          The two notices used to be split by a `<br>`, which left them a SINGLE text run:
          the DOM read "…ODbLMevsimlik göl sınırları:…" with the two licences welded
          together (UX tour B26). Block spans alone do NOT fix that — `textContent`
          concatenates regardless of layout, MEASURED on the running build — so the
          separating space below is load-bearing, not formatting. With it, all three text
          APIs agree: `textContent` separates the licences, `innerText` still breaks the
          line, and AT gets two block boxes instead of one run. The space itself never
          renders: whitespace between two block-level boxes is collapsed away, so the credit
          is pixel-identical to the `<br>` version.

          NOT on the world map: it draws Natural Earth countries, not this water layer, and
          crediting a source a surface does not use is a false claim, not a courtesy.

          A THIRD `.attributionLine` joined this paragraph in turkiye-yenileme PR-B (plan
          §5.7 recommendation 1), and the converse of the note directly above is exactly why
          it is now correct here: this component draws Natural Earth country boundaries as
          its geographic context (`lib/map/tr-context.generated.ts`), so `/turkiye` now
          genuinely uses that data. `provenance/datasets.md` line 51 still rules
          `ATIF: borçlu değildir` — Natural Earth is public domain and owes no attribution —
          so this line is a product choice, not a new licence obligation.
          `attribution-separation.test.ts` was extended for this file's case (2 → 3
          `.attributionLine` spans) rather than left silently out of step.

          FIX ROUND (PR #108 review, FEN108-I3): this line originally reused
          `WorldMap.attribution` verbatim ("Sınır verisi: Natural Earth (kamu malı)" /
          "Boundaries: Natural Earth (public domain)") — correct bytes, WRONG scope on this
          page. `/dunya`'s own line has no scope problem because there EVERY boundary on the
          map is Natural Earth. Here it is not: the map's actual subject, the 81 il
          boundaries, is `data/tr-il-boundaries.geojson`, licensed ODbL, credited by the
          FIRST attribution span above (`tMap("attribution")`) — Natural Earth supplies only
          the NEIGHBOUR/context layer this PR added. A scope-free "Boundaries: Natural Earth"
          line sitting next to a scope-free "© OpenStreetMap … ODbL" line left it genuinely
          ambiguous which licence covers the il polygons, which is exactly the ambiguity a
          licence credit exists to prevent. Its own dedicated key, `Map.attributionContextLabel`
          ("Komşu ülke sınırları: Natural Earth (kamu malı)" / "Neighbouring-country
          boundaries: Natural Earth (public domain)"), states its scope explicitly — mirroring
          how the JRC line above it is already scoped ("Mevsimlik göl sınırları:"). A new
          string, so `CONTENT-STYLE.md` §22's licence-attribution class applies (shortest
          faithful form; no verb, no instruction) rather than the "reused verbatim, no new
          surface" claim the original comment made. */}
      <p className={styles.attributionFlow}>
        <span className={styles.attributionLine}>{tMap("attribution")}</span>{" "}
        <span className={styles.attributionLine}>
          {tMap("attributionJrcLabel")} <span lang="en">{tMap("attributionJrcEnglish")}</span>
        </span>{" "}
        <span className={styles.attributionLine}>{tMap("attributionContextLabel")}</span>
      </p>
    </section>
  );
}
