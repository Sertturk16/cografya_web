import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { InlandWaterLayer } from "@/components/map/inland-water-layer";
import { MapZoomPan } from "@/components/map/map-zoom-pan";
import type { GameModeId } from "@/lib/game/config";
import { aspectOfViewBox } from "@/lib/game/map-bbox";
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
 * ---- I1 · HOW A SOLVED TARGET IS MARKED ---------------------------------------------------
 *
 * THE DEFECT IT FIXES is not cosmetic (UX tour B24 / D6). Until now
 * `.province[data-state="correct"]` painted a solved shape `--game-correct` (#5f8f3f), which
 * OVERWROTE its region tint. In bölge mode that meant two things at once: a solved Doğu
 * Anadolu (#009e73) turned into a second, barely distinguishable green — and by the end of the
 * round all seven regions had collapsed into ONE colour, erasing the exact distinction the
 * mode spent seven questions teaching. The tint rule in `game-map.module.css` now excludes
 * only `wrong` and `reveal`, so a solved region KEEPS ITS COLOUR and "solved" is carried by a
 * second, independent signal: a diagonal hatch painted into the hit twin.
 *
 * TWO VARIANTS WERE BUILT AND SAMPLED (→ DEC 2026-08-05g md. 1, Atlas AO-2) — this hatch and a
 * per-target ✓ glyph. THE OWNER PICKED THE HATCH (2026-08-06), so the ✓ is gone: its fourth
 * paint layer, its `interiorPointForPaths` helper, that helper's tests and the island's mark
 * query all left with it, because an exported helper with no reader is state that drifts with
 * nothing to catch it (the `runningScore` precedent). Do not re-add a variant switch: there is
 * one solved mark, and it is this one.
 */

/** `id` of the diagonal pattern a solved shape is filled with. */
const SOLVED_HATCH_ID = "game-solved-hatch";

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
 * ---- THREE PAINT LAYERS OVER ONE COPY OF THE GEOMETRY (owner report 2026-08-02) ---------
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
 *                              tab stop, the click target, the only place a hover, focus or
 *                              answer-state LINE is drawn — and, once solved, the only place
 *                              I1's hatch is painted (see §I1 above)
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
        /* WHICH SIZING MODEL THE STAGE USES ON A PHONE (→ DEC 2026-08-17g md. 1, ruling O4).
           A whole-country round takes the ruled 1.2 target and is cropped east-west to pay
           for the scale; a region round keeps the frame its own bounds produced, because
           cropping there would push part of the ASKED-FOR region off screen. Derived from the
           frame, exactly like `isSubset` above — a second prop could only ever disagree. */
        data-game-frame={isSubset ? "subset" : "country"}
      >
        <svg
          className={styles.svg}
          viewBox={viewBox}
          /* THE STAGE MAY NOW BE A DIFFERENT SHAPE FROM THE MAP (→ DEC 2026-08-17g md. 1), and
             this attribute is what makes the first paint correct without a script. `slice`
             fills the box and crops the overflow — the same rectangle `MapZoomPan` computes
             for its opening view — so with JavaScript off the phone still gets the framed,
             magnified map, and when the island writes its explicit viewBox nothing moves.
             Once the island is running every view it writes carries the box's own aspect, so
             `slice` and the default `meet` paint identically from then on; leaving it means a
             sub-pixel mismatch crops a hair rather than letterboxing one. */
          preserveAspectRatio="xMidYMid slice"
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
            {/* THE INK AND THE FULL OPACITY ARE A MEASUREMENT, not a taste (→ PR #50 review
                A11Y50-I2). This line is the ONLY thing that says "solved" on the map, so WCAG
                1.4.11 asks it for 3:1 against every fill it can be drawn over — the seven
                region tints in bölge mode plus `--game-correct` in the two il modes. The first
                version was `--game-correct-edge` at `opacity: 0.55` and, alpha-blended onto
                those eight fills, scored 1.53–2.74:1: it failed on all eight, i.e. the second
                signal was harder to see than the colour difference it was there to supplement.
                Opaque `--game-correct-edge` still fails three of the eight (Marmara 2.05,
                Güneydoğu 2.75, il-mode green 2.78). `--color-ink-dark` at full opacity is the
                value that clears all eight — 3.25 on Marmara (the binding case), 4.41 on the
                il-mode green, 4.36–12.76 on the rest — and it is the same token, chosen against
                the same seven tints, that the hover/focus line already uses (globals.css). */}
            <pattern
              id={SOLVED_HATCH_ID}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-ink-dark)" strokeWidth="1.6" />
            </pattern>
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
              click on it is ignored exactly as before.
              It is also where I1's solved hatch lands: this twin has no fill of its own, it
              already sits above the painted map and below the water, and `pointer-events: all`
              is unaffected by a fill it did not have — so the texture needed no fourth layer
              (`game-map.module.css` §I1). */}
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
      </div>

      {/* Both obligations stay visible wherever these shapes are drawn (SPEC §1) — see
          components/map/turkey-map-section.tsx for the full note, including why the English
          licence string carries its own `lang="en"`. Shared strings with the /turkiye map:
          one source, never re-typed.

          BELOW THE STAGE, NOT ON IT (design tour A1). On the play surface the credit used to
          be an absolutely-positioned plate INSIDE `.stage`, and at phone widths that plate
          covered 42.8% of the map: measured on the running build, the chrome sitting over a
          province's own centre point occluded 62 of 81 targets at 320px and 41 of 81 at 360px.
          A play surface whose targets are under the licence line is not a play surface.

          The credit stays VISIBLE — it moves out of the stage into `.frame`, one flow line
          under the map. Same shape as `locator-map.module.css` `.credit`: still inside the map
          component, but outside the bordered box the map itself is drawn in — which is
          `.stage` here and what that file calls its `.frame`. (The word "frame" names a
          different box in the two stylesheets; the arrangement is the same one.)

          DEC 2026-07-10 md.4 asks the ODbL attribution to remain "visible (map
          footer/component)", and a line in the map's own component footer is that sentence. It is deliberately NOT a `<details>` disclosure:
          a credit that is closed by default is not visible.

          The `/turkiye` and `/dunya` maps followed later, each on its own measurement: `/dunya`
          in PR #77 (`FU-DUNYA-ZOOM-ORTUSU`) and `/turkiye` right after it
          (`FU-TURKIYE-ATIF-ORTUSU` → DEC 2026-08-21d md.2). All four map surfaces now put the
          credit in flow under the map; `map.module.css` no longer offers a plated one.

          IT IS RENDERED BEFORE THE ZOOM CLUSTER, and on a phone the two share one line when
          the width allows (`game-map.module.css`). Reading order and visual order agree —
          credit left, buttons right — which is why this is markup order rather than a flex
          `order`. The credit carries no link, so nothing about the keyboard path changes. */}
      {/* TWO LINES, TWO ELEMENTS — not one paragraph with a <br>. The visual result is
          identical; what changes is the TEXT. A <br> contributes no character, so the
          node's text content ran the two credits together as "…ODbLMevsimlik göl
          sınırları…", which is what a screen reader announces and what a copy-paste
          produces (UX tour B26). Block-level spans separate them for real — and the `{" "}`
          between them is what actually inserts the character: `textContent` ignores layout,
          so two block spans with nothing between them re-weld into one run. That defect was
          fixed on `/turkiye` and never here; `attribution-separation.test.ts` now guards both
          files. */}
      <p className={styles.attribution}>
        <span className={styles.attributionLine}>{tMap("attribution")}</span>{" "}
        <span className={styles.attributionLine}>
          {tMap("attributionJrcLabel")} <span lang="en">{tMap("attributionJrcEnglish")}</span>
        </span>
      </p>

      {/* THE ZOOM CLUSTER, OUT OF THE MAP BOX (→ DEC 2026-08-17g md. 3).
          It used to be an absolutely-positioned overlay inside the stage, and on a phone that
          overlay was 132px of vertical buttons over a 119px stage: the last 11 of 81 targets
          the design tour found under chrome were all under these three buttons. Below the
          64rem breakpoint it is now a row in the frame's flow — on the credit's line where the
          width allows, under it where it does not — so it cannot cover a province at any zoom
          level. From 64rem up it goes back to being an overlay: measured occlusion there is
          0–1 of 81 and the vertical budget is the scarce thing (`game-map.module.css`).

          TAB ORDER, AND WHY THE OLD "RENDERED FIRST" NOTE IS GONE. The cluster used to sit
          before the <svg> so a keyboard player reached +/−/reset without passing 81 provinces.
          The keyboard path is the MAP SURFACE itself: the <svg> is `tabindex="0"`, comes
          before its own shapes, carries `+ − 0 Home` and the arrow keys, and points at the
          instructions below via aria-describedby. So the buttons are the pointer affordance,
          and they sit where this screen already puts its controls — after the map, next to
          "Devam" and "Cevabı göster", which have always been below it. Placing them first in
          the DOM and last visually (a flex `order` split) was considered and rejected: a
          focus order that disagrees with the visual one is a worse trade than a late
          secondary control. */}
      <MapZoomPan
        viewBox={viewBox}
        instructionsId={instructionsId}
        layerClassName={styles.zoomLayer}
        controlsClassName={styles.zoomControls}
        labels={{
          zoomIn: t("zoomIn"),
          zoomOut: t("zoomOut"),
          reset: t("zoomReset"),
          instructions: zoomInstructions,
          controls: t("zoomControls"),
        }}
      />

      {/* Keyboard-controls description the zoomable SVG points at via aria-describedby
          (wired client-side by the zoom island). Visually hidden — the always-visible
          +/− buttons carry the sighted affordance. */}
      <p id={instructionsId} className={styles.srOnly}>
        {zoomInstructions}
      </p>
    </div>
  );
}
