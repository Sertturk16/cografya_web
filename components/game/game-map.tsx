import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { InlandWaterLayer } from "@/components/map/inland-water-layer";
import { MapZoomPan } from "@/components/map/map-zoom-pan";
import type { GameModeId } from "@/lib/game/config";
import { aspectOfViewBox, interiorPointForPaths } from "@/lib/game/map-bbox";
import type { GameShapeEntry } from "@/lib/game/map-shapes";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import styles from "./game-map.module.css";

/**
 * `React.CSSProperties` has no index signature for custom properties, and the usual
 * workaround is to assert the whole object. Naming the one property instead keeps the rest
 * of the object type-checked, so a typo in a real CSS property is still a compile error.
 */
type StageStyle = CSSProperties & Record<"--game-stage-aspect", string>;

/**
 * `id` prefix of this surface's shared `<defs>` geometry. Prefixed per SURFACE (`tr-map-` on
 * `/turkiye`, `world-map-` on `/dunya`) so two maps could share a document without their
 * fragment ids colliding — a `<use href>` resolves against the whole document.
 */
const SHAPE_ID_PREFIX = "game-map-";

/** `id` of the ONE shared filter that draws a bölge's outer silhouette (see §BÖLGE below). */
const REGION_OUTLINE_FILTER_ID = "game-region-outline";

/**
 * Silhouette thickness, in USER UNITS of the map's own coordinate space (the `<filter>`'s
 * `primitiveUnits` default). User units are what makes it zoom-dependent, which is why the
 * value is ALSO published as `data-zoom-radius` for `MapZoomPan` to scale down as the view
 * narrows — without that, the outline reached a ~25px black band at 12× zoom (measured).
 *
 * ONE constant, deliberately: it is the tunable the owner rules on from rendered samples, and
 * it must stay a single-line change.
 */
const REGION_OUTLINE_RADIUS = 1.4;

/**
 * ---- I1 · HOW A SOLVED TARGET IS MARKED — TWO VARIANTS, ONE SWITCH ------------------------
 *
 * THE DEFECT BOTH OF THEM FIX is the same, and it is not cosmetic (UX tour B24 / D6). Until
 * now `.province[data-state="correct"]` painted a solved shape `--game-correct` (#5f8f3f),
 * which OVERWROTE its region tint. In bölge mode that meant two things at once: a solved Doğu
 * Anadolu (#009e73) turned into a second, barely distinguishable green — and by the end of the
 * round all seven regions had collapsed into ONE colour, erasing the exact distinction the
 * mode spent seven questions teaching. The tint rule in `game-map.module.css` now excludes
 * only `wrong` and `reveal`, so a solved region KEEPS ITS COLOUR in both variants, and
 * "solved" is carried by a second, independent signal.
 *
 * Which second signal is the OWNER'S CALL from rendered samples (→ DEC 2026-08-05g md. 1,
 * Atlas AO-2), so both are built, behind this one line:
 *
 *   "hatch" — a diagonal pattern painted into the hit twin. ~15 lines, no new layer, no
 *             geometry, and it scales with the shape.
 *   "check" — a ✓ glyph per TARGET (81 in the il modes, 7 in bölge mode — one per region,
 *             not one per il). Costs a fourth layer and `interiorPointForPaths`, and it has
 *             an HONEST FLAW the owner must see: MapZoomPan zooms by narrowing the viewBox,
 *             so the glyph GROWS with the map. It is not compensated on purpose — PR #48
 *             rejected a `drop-shadow` for precisely this reason (CR48-M2), and a decorative
 *             mark is not worth a second zoom-compensation mechanism.
 *
 * AO-2 IS BINDING ON WHAT HAPPENS NEXT: once the owner picks, the loser is deleted BEFORE
 * merge — and if "check" loses, `interiorPointForPaths` and its test go with it, because an
 * exported helper with no reader is state that drifts with nothing to catch it (the
 * `runningScore` precedent).
 */
const SOLVED_MARK: "hatch" | "check" = "check";

/** `id` of the diagonal pattern the "hatch" variant paints a solved shape with. */
const SOLVED_HATCH_ID = "game-solved-hatch";

/**
 * Half-width of the ✓ glyph, in the map's own user units.
 *
 * Sized against the SMALLEST target it has to sit inside rather than the average one: a mark
 * that reads on Konya but overflows Yalova is a mark that is wrong where it matters.
 */
const CHECK_RADIUS = 4;

/** `id` of the one shared ✓ group every solved mark `<use>`s. */
const CHECK_SHAPE_ID = "game-solved-check";

/**
 * The ✓ itself, in units of {@link CHECK_RADIUS} so the glyph has ONE tunable.
 *
 * Drawn around the origin, because a `<use>`'s `x`/`y` translate the referenced content — so
 * the mark's position is two attributes and the geometry ships once.
 */
const CHECK_D = [
  `M ${-0.8 * CHECK_RADIUS} ${0.1 * CHECK_RADIUS}`,
  `L ${-0.3 * CHECK_RADIUS} ${0.65 * CHECK_RADIUS}`,
  `L ${0.85 * CHECK_RADIUS} ${-0.65 * CHECK_RADIUS}`,
].join(" ");

interface GameMapProps {
  /** The shapes to DRAW — already narrowed to the round's map (§ region mode). */
  shapes: readonly GameShapeEntry[];
  /** The frame these shapes are drawn in: the full map's, or the region subset's. */
  viewBox: string;
  /** `<title>` of the SVG — what assistive tech calls this picture. */
  title: string;
  /**
   * What this screen ASKS FOR — a bölge or an il. Two things depend on it and both must be
   * settled in the first response rather than by the island's first effect: the stage's
   * `data-game-mode` (which drives the region tints AND the region mode's transparent
   * water, `game-map.module.css`) and the keyboard hint, which used to promise every player
   * that Enter "selects that province" even where a click answers for a whole region
   * (→ UX tour B22).
   */
  mode: GameModeId;
}

/**
 * The game's map surface (server component — SPEC §4.2).
 *
 * A SEPARATE surface from `components/map/turkey-map-section.tsx`, which is deliberately
 * never opened by this work. There, a shape is wrapped in an anchor and a click NAVIGATES;
 * here a click ANSWERS a question. Merging the two behind a `mode` prop would leak game
 * state into the most SEO-critical component on the site (81 crawlable internal links), so
 * the two share their DATA sources and nothing else: the same generated artifact
 * (`lib/map/tr-provinces.generated.ts` — raw GeoJSON never ships) and the same
 * `/api/provinces/map-summary` payload.
 *
 * This file contains NO link of any kind, and a CI guard keeps it that way
 * (`game-map.nav-guard.test.ts`): on a play surface a click must answer a question, never
 * navigate. The back link and the end-of-round province links live in their own files.
 *
 * WHAT IS SERVER-RENDERED HERE: every `<path>` of the round's map, in the first response.
 * With JavaScript switched off the page still shows a real map. The island only enhances
 * it.
 *
 * SUBSET RENDERING (→ DEC 2026-07-30p). In the region mode the caller hands over only that
 * region's provinces and a viewBox fitted to them, so the other regions are not dimmed,
 * they are absent — and the region fills the same stage the whole country used to, which
 * is what makes its smallest provinces comfortably tappable.
 *
 * While no round is running the SVG is exposed to assistive tech as ONE labelled image
 * rather than N anonymous children (WCAG 1.1.1). The island swaps that for per-shape
 * `role="button"` names the moment there is something to answer, and swaps it back when
 * the round ends.
 *
 * ---- FOUR PAINT LAYERS OVER ONE COPY OF THE GEOMETRY (owner report 2026-08-02) ----------
 * The measured design study is `Owner's Inbox/ui-cila-arastirma/hover-overlay-plan.md`; the
 * full `<use>` rationale is in `components/map/turkey-map-section.tsx`, which carries the
 * same architecture. In short: shapes paint in plaka order, so a hovered province's border
 * was over-painted by every neighbour drawn after it — thick on one side, a hairline on the
 * other. SVG has no `z-index`, so the fix is structural.
 *
 *   <defs>                     one classless <path id> per shape, plus the ONE outline filter
 *   <g data-map-layer=base>    the painted map: fill, region tint, answer-state FILL, 1px
 *                              resting border. Inert to the pointer, hidden from AT.
 *   <g data-map-layer=region>  §BÖLGE — seven silhouette groups, one per coğrafi bölge
 *   <g data-map-layer=hit>     one <use> per ANSWERABLE shape, unpainted at rest: the
 *                              tab stop, the click target, and the only place a hover, focus
 *                              or answer-state LINE is drawn — above every province layer
 *   <g data-map-layer=mark>    I1's "check" variant ONLY — one ✓ per solved TARGET, inert
 *                              and hidden until the island marks it (see §I1 below)
 *   <InlandWaterLayer>         P6's lakes, still the LAST child (see the note at the call
 *                              site): water above the hit twin is what makes a mid-lake click
 *                              score nothing, so its paint position IS the ruling
 *
 * A free correction comes with it: `correct` / `wrong` / `reveal` suffered from exactly the
 * same paint-order defect (2.5–3px lines, half-eaten on the neighbour side). Drawn in the hit
 * layer they are now even weight the whole way round — the only thing that paints over them is
 * the water, on the few boundaries a lake crosses, exactly as it already paints over the
 * resting border there.
 *
 * ---- §BÖLGE: the region silhouette --------------------------------------------------------
 * In bölge mode a click anywhere in a region answers for the WHOLE region, so hovering one il
 * has to show the whole region. The first version said that by thickening every member's own
 * border, which also thickened the region's INTERNAL boundaries — the owner rejected that: it
 * reads as eleven outlined provinces, not one region.
 *
 * There is no merged region outline in the generated artifact (producing one is geometry work,
 * P2), so the union is made at RENDER time: each region's members are re-used into one `<g>`,
 * filled flat, and a single shared two-primitive filter dilates that union and subtracts the
 * original — leaving only the outer ring. ONE filter for all seven groups, and the groups are
 * `display: none` until their region is hovered or focused, so nothing is computed until it is
 * shown. Measured cost per pointer move: 0.92ms → 1.00ms. (The obvious alternative, a
 * dilate→erode→dilate "closing" chain that would also seal the artifact's inter-province
 * slivers, measured 14.00ms — rejected.)
 *
 * HONEST LIMIT, and it is in the owner's sample set: the source outlines do not share exact
 * edges, so the slivers between them survive the union and the filter draws faint interior
 * hairlines. At 1× they are sub-pixel and hide under the base layer's own 1px borders; they
 * become visible only at high zoom. A radius floor does NOT fix it (tested) — it is source
 * geometry, and sealing it belongs to the P2 boundary work.
 */

/**
 * Id of the `<clipPath>` that confines the water layer to this round's land. SVG ids are
 * document-global, so it is written once here rather than re-typed at the call site — one
 * game map is rendered per page.
 */
const LAND_CLIP_ID = "game-map-land-clip";

export async function GameMap({ shapes, viewBox, title, mode }: GameMapProps) {
  const t = await getTranslations("Game");
  const tMap = await getTranslations("Map");
  const titleId = "game-map-title";
  const instructionsId = "game-map-instructions";
  // The keyboard hint's one mode-dependent sentence, injected into the otherwise identical
  // instructions. Split rather than duplicated: everything else about zooming and panning
  // is the same in both modes, and two full copies of a four-clause paragraph would drift.
  const zoomInstructions = t("zoomInstructions", {
    selectHint: mode === "regions" ? t("selectHintRegions") : t("selectHintProvinces"),
  });
  // Does this round draw the whole country, or a slice of it? Derived from the frame rather
  // than passed as a flag: `game-screen.tsx` builds the region frame with `viewBoxForPaths`
  // and falls back to `MAP_VIEWBOX` for the full map, so the frame IS the answer and a new
  // prop could only ever disagree with it. Used to decide whether the water layer needs
  // clipping to the drawn land.
  const isSubset = viewBox !== MAP_VIEWBOX;

  // The stage takes its shape FROM the frame it is drawing, so the map fills the box
  // exactly instead of letterboxing inside a fixed one — which is what lets a region's
  // provinces use the full width they are entitled to (`lib/game/map-bbox.ts`).
  //
  // Handed to CSS as a CUSTOM PROPERTY rather than as `aspect-ratio` directly, because the
  // stylesheet needs the ratio as a NUMBER in arithmetic too: the viewport cap it applies is
  // a height, and turning a height cap into the width that produces it is a multiplication
  // by this ratio (`game-map.module.css` `.stage`). One value, read twice, so the shape and
  // the cap can never disagree.
  //
  // The guard is `> 0`, not just "not null": the ratio is now an operand in the stylesheet's
  // width arithmetic, so a zero would compute `width: 0` and erase the map, where the old
  // `aspect-ratio`-only usage merely fell back to the CSS default. `aspectOfViewBox` already
  // rejects non-finite and non-positive boxes, so this is unreachable — it is here so the
  // unreachable branch fails toward the fallback ratio rather than toward a blank stage.
  const aspect = aspectOfViewBox(viewBox);
  const stageStyle: StageStyle | undefined =
    aspect !== null && aspect > 0 ? { "--game-stage-aspect": String(aspect) } : undefined;

  // Members of each bölge, for the silhouette layer (§BÖLGE). Built from `shape.target.region`
  // — the api's own grouping, arriving through the shape join — so no geography is encoded
  // here (CONVENTIONS §4). Insertion order follows the artifact's plaka order, which keeps the
  // rendered markup deterministic. An unseeded plate has no region and joins no group: it can
  // never be part of an answer, so it must not be part of an answer's outline either.
  const platesByRegion = new Map<string, string[]>();
  for (const shape of shapes) {
    const region = shape.target?.region;
    if (!region) continue;
    const members = platesByRegion.get(region);
    if (members) members.push(shape.plateCode);
    else platesByRegion.set(region, [shape.plateCode]);
  }

  /**
   * I1 · "check" variant — where each target's ✓ goes.
   *
   * ONE MARK PER TARGET, which is the whole reason this is grouped rather than mapped: in
   * bölge mode the answer is a REGION, so eleven ticks across Marmara would say the player
   * answered eleven questions. The grouping is the same one the silhouette layer uses, and it
   * is the api's (`shape.target.region`) — no geography is decided here (CONVENTIONS §4).
   *
   * A target whose interior point cannot be found draws NO mark rather than one placed by
   * guesswork; `interiorPointForPaths` returns `null` exactly there.
   */
  const dByPlate = new Map(shapes.map((shape) => [shape.plateCode, shape.d]));
  const markGroups: { targetId: string; paths: string[] }[] =
    mode === "regions"
      ? [...platesByRegion].map(([region, members]) => ({
          targetId: region,
          paths: members.map((plate) => dByPlate.get(plate) ?? ""),
        }))
      : shapes
          .filter((shape) => shape.target !== null)
          .map((shape) => ({ targetId: shape.plateCode, paths: [shape.d] }));
  const solvedMarks =
    SOLVED_MARK === "check"
      ? markGroups.flatMap(({ targetId, paths }) => {
          const point = interiorPointForPaths(paths.filter(Boolean));
          return point ? [{ targetId, point }] : [];
        })
      : [];

  return (
    <div className={styles.frame}>
      {/* FIXED-SIZE STAGE. Fixed does not mean constant: the ratio is server-rendered from
          the viewBox, so it is settled before any script runs and the overlays mount on top
          of it without moving a single pixel of the page (CLS budget, CONVENTIONS §6 #9).
          The CSS default is the full map's ratio, for the case the string is unreadable. */}
      <div
        className={styles.stage}
        style={stageStyle}
        data-game-map
        data-game-mode={mode}
        // I1 · which solved-mark variant this build renders. Scoping the stylesheet on it,
        // rather than letting `fill: url(#game-solved-hatch)` resolve against a `<defs>` that
        // may not hold the pattern, keeps each variant's CSS inert unless its own markup is
        // present — an unresolvable paint IRI is an SVG error, not a no-op.
        data-solved-mark={SOLVED_MARK}
      >
        {/* Rendered BEFORE the <svg> so the zoom controls come first in tab order — a
            keyboard player reaches +/−/reset without tabbing through every province (the
            solution already proven on /dunya). Visual position is unaffected: the layer is
            absolutely positioned, and the island finds the <svg> by query. */}
        <MapZoomPan
          viewBox={viewBox}
          instructionsId={instructionsId}
          labels={{
            zoomIn: t("zoomIn"),
            zoomOut: t("zoomOut"),
            reset: t("zoomReset"),
            instructions: zoomInstructions,
            controls: t("zoomControls"),
          }}
        />

        <svg
          className={styles.svg}
          viewBox={viewBox}
          role="img"
          aria-labelledby={titleId}
          focusable="false"
        >
          <title id={titleId}>{title}</title>

          <defs>
            {/* THE GEOMETRY, ONCE — classless, so each `<use>` twin decides how it looks.
                `vector-effect` must be here: it is not an inherited property, so declared on
                the `<use>` it would never reach the clone and every border would thicken with
                zoom (measured: a 1px border became a ~12px band at 12×). */}
            {shapes.map((shape) => (
              <path
                key={shape.plateCode}
                id={`${SHAPE_ID_PREFIX}${shape.plateCode}`}
                d={shape.d}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* ONE filter, shared by all seven silhouette groups (§BÖLGE). Grow the union,
                then subtract the union from the grown copy: what is left is the outer ring
                and nothing else. `radius` is in USER UNITS, so it grows on screen as the map
                is zoomed — `data-zoom-radius` is the base value MapZoomPan scales it back
                down from, and it is never written to, so the compensation cannot drift. */}
            <filter id={REGION_OUTLINE_FILTER_ID}>
              <feMorphology
                in="SourceGraphic"
                operator="dilate"
                radius={REGION_OUTLINE_RADIUS}
                data-zoom-radius={REGION_OUTLINE_RADIUS}
                result="grown"
              />
              <feComposite in="grown" in2="SourceGraphic" operator="out" />
            </filter>

            {/* I1 · "hatch" variant — the diagonal the hit twin is filled with once its
                target is solved. `patternUnits="userSpaceOnUse"` ties the stripes to the MAP's
                coordinate space, not to each shape's bounding box, so the pattern is
                continuous across a region's provinces instead of restarting at every internal
                border — which is what makes a solved bölge read as one solved area. It also
                means the stripes narrow as the map is zoomed, exactly like the borders. */}
            {SOLVED_MARK === "hatch" ? (
              <pattern
                id={SOLVED_HATCH_ID}
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="var(--game-correct-edge)"
                  strokeWidth="1.6"
                  opacity="0.55"
                />
              </pattern>
            ) : null}

            {/* I1 · "check" variant — the ✓, defined ONCE and `<use>`d per solved target.
                TWO PATHS, and that is a legibility requirement rather than decoration: this
                mark has to read on seven region tints AND on the il modes' green, and
                MEASURED against those eight fills neither ink alone clears the 3:1 floor for
                a non-text graphic. White fails on the yellow (1.32:1) and the two lighter
                blues; the dark green-black fails on the deep blue (2.05:1) and the vermillion.
                A dark halo under a white glyph always leaves ONE of the two reading: ≥5:1 on
                every dark tint, ≥4.6:1 on every light one. */}
            {SOLVED_MARK === "check" ? (
              <g id={CHECK_SHAPE_ID}>
                <path className={styles.checkHalo} d={CHECK_D} />
                <path className={styles.checkGlyph} d={CHECK_D} />
              </g>
            ) : null}
          </defs>

          {/* LAYER 1 — the painted map: fill, region tint and answer-state FILL. Decorative
              (the island puts every accessible name on the hit layer) and inert to the
              pointer, so a click can only ever be scored by the layer that owns the targets.
              It keeps `data-plate` because the island writes `data-state` to BOTH twins: the
              fill belongs here, the line belongs up there. */}
          <g data-map-layer="base" className={styles.mapBase} aria-hidden="true">
            {shapes.map((shape) => (
              <use
                key={shape.plateCode}
                href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`}
                className={shape.target ? styles.province : styles.provinceInert}
                data-plate={shape.plateCode}
                data-region={shape.target?.region}
              />
            ))}
          </g>

          {/* LAYER 2 — the seven bölge silhouettes (§BÖLGE). Rendered on every game screen but
              `display: none` until the stylesheet's `:has()` rules show one, and only in bölge
              mode: no filter is evaluated while a group is not displayed. */}
          <g data-map-layer="region" className={styles.regionLayer} aria-hidden="true">
            {[...platesByRegion].map(([region, members]) => (
              <g
                key={region}
                className={styles.regionOutline}
                data-region={region}
                filter={`url(#${REGION_OUTLINE_FILTER_ID})`}
              >
                {members.map((plateCode) => (
                  <use key={plateCode} href={`#${SHAPE_ID_PREFIX}${plateCode}`} />
                ))}
              </g>
            ))}
          </g>

          {/* LAYER 3 — one invisible twin per ANSWERABLE shape: the tab stop, the click
              target, and the only place a hover / focus / answer-state LINE is drawn. An
              unseeded plate gets no twin — it is backdrop, it can never be an answer, and a
              click on it is ignored exactly as before. */}
          <g data-map-layer="hit">
            {shapes.map((shape) =>
              shape.target ? (
                <use
                  key={shape.plateCode}
                  href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`}
                  className={styles.hitEdge}
                  data-plate={shape.plateCode}
                  data-region={shape.target.region}
                />
              ) : null,
            )}
          </g>

          {/* LAYER 4 (I1 · "check" variant only) — one ✓ per SOLVED TARGET, above every line
              the hit layer draws and below the water, which keeps the paint order rule
              intact. Every glyph is rendered from the first response and stays
              `display: none` until the island writes `data-state="correct"` onto its target's
              mark: the map is never re-rendered by React, exactly as for every other state
              (`game-island.tsx`).
              Inert and hidden from assistive tech — it is a second rendering of something the
              live region already says in words, and a tick that could take a click would
              cover the target it sits on. */}
          {SOLVED_MARK === "check" ? (
            <g data-map-layer="mark" className={styles.markLayer} aria-hidden="true">
              {solvedMarks.map(({ targetId, point }) => (
                <use
                  key={targetId}
                  href={`#${CHECK_SHAPE_ID}`}
                  x={point.x}
                  y={point.y}
                  data-target={targetId}
                />
              ))}
            </g>
          ) : null}

          {/* Painted after every province layer, exactly as on /turkiye — and it stays LAST
              now that the map is a layer stack. Water above the hit layer is what implements
              the ruling that a click on a lake does nothing (→ DEC 2026-08-02k md. 5): the hit
              twin's `pointer-events: all` reads the shape's whole interior, so a water layer
              slid underneath it would score a mid-lake click as an answer. The layer holds
              every body in the country, not just this round's region, so on a REGION map it is
              clipped to the provinces actually drawn — the region's bounding box is not a
              substitute (Keban and Atatürk fall inside Doğu Anadolu's box while lying outside
              it). The layer stays OUT of `viewBoxForPaths()`: the stage's aspect ratio is
              derived from the province shapes alone, so adding water cannot move the frame. */}
          {/* THE WRAPPER IS THE OWNER'S BÖLGE-MODE RULING, and it is deliberately on THIS
              side of the boundary. Water swallowing clicks is a ruling
              (→ DEC 2026-08-02k md. 5) that `inland-water.module.css` states, explains and
              a contract test forbids inverting — for good reason: `pointer-events: none`
              there would let a mid-lake click navigate on /turkiye and score an answer in
              the two il modes.
              In BÖLGE mode the same rule produces the wrong answer to a different question.
              The target is a whole region, a lake is drawn inside one of its provinces, and
              clicking the middle of Isparta hits Eğirdir and resolves to nothing at all —
              the map simply ignores the player (owner live tour, 2026-08-05, finding #5).
              So the exception is expressed where it belongs: a game-owned wrapper that only
              the region mode's own stylesheet rule reaches. The shared layer, its stylesheet
              and its contract test are untouched, and the il modes keep the original
              behaviour exactly (`game-map.module.css` § BÖLGE MODU SUYU).
              Paint order is unchanged — this <g> is still the <svg>'s last child, and the
              clip stays on the layer's own group. */}
          <g className={styles.waterHost}>
            <InlandWaterLayer
              clip={
                isSubset ? { paths: shapes.map((shape) => shape.d), id: LAND_CLIP_ID } : undefined
              }
            />
          </g>
        </svg>

        {/* Both obligations stay visible wherever these shapes are drawn (SPEC §1) — see
            components/map/turkey-map-section.tsx for the full note, including why the English
            licence string carries its own `lang="en"`. Shared strings with the /turkiye map:
            one source, never re-typed. */}
        {/* TWO LINES, TWO ELEMENTS — not one paragraph with a <br>. The visual result is
            identical; what changes is the TEXT. A <br> contributes no character, so the
            node's text content ran the two credits together as "…ODbLMevsimlik göl
            sınırları…", which is what a screen reader announces and what a copy-paste
            produces (UX tour B26). Block-level spans separate them for real. */}
        <p className={styles.attribution}>
          <span className={styles.attributionLine}>{tMap("attribution")}</span>
          <span className={styles.attributionLine}>
            {tMap("attributionJrcLabel")} <span lang="en">{tMap("attributionJrcEnglish")}</span>
          </span>
        </p>
      </div>

      {/* Keyboard-controls description the zoomable SVG points at via aria-describedby
          (wired client-side by the zoom island). Visually hidden — the always-visible
          +/− buttons carry the sighted affordance. */}
      <p id={instructionsId} className={styles.srOnly}>
        {zoomInstructions}
      </p>
    </div>
  );
}
