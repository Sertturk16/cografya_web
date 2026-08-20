"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  haversineKm,
  kmDecimalsFor,
  kmPerMapUnitAt,
  parseLatLon,
  polylineLengthKm,
  ringAreaKm2,
  ringCrossesAntimeridian,
  ringPerimeterKm,
  ringSelfIntersects,
  scaleBarKm,
  toDmsParts,
  unprojectMapPoint,
  type CardinalLetters,
  type GeoPoint,
  type LatLonAxis,
  type ParseFailureReason,
} from "@/lib/map/measure";
import { projectToMapPoint } from "@/lib/map/projection";
import {
  boundsOfPoints,
  parseSubpaths,
  pointInPolygon,
  type ShapeBounds,
  type ShapePoint,
} from "@/lib/map/shape-geometry";
import { parseViewBox, type ViewBox } from "@/lib/map/zoom-pan";
import { findProvincePoint, type ProvincePoint } from "@/lib/tools/province-points";
import { downloadToolPng } from "./tool-png";
import styles from "./tools.module.css";

/**
 * Which tool this island is being: a distance measurement, a coordinate lookup, or an area
 * calculation.
 *
 * ONE island file with a mode rather than one per tool — `plan-web.md` §3.3 asks for exactly
 * that ("ilgili modun gövdesi"), and §17.3 records the condition: the modes stay together
 * while they are small, and split when the island outgrows the single `dynamic()` import.
 * What they genuinely share is not cosmetic — the surface lookup, the live `viewBox` read, the
 * screen-to-map matrix, the çizgi ölçek, the three input paths, the PNG pipeline and the
 * out-of-frame rule are one implementation each, and duplicating them is how two tools start
 * disagreeing about where a point is. Adding the third mode moved four branches and added one
 * memo; the splitting condition is still unmet.
 */
export type ToolMode = "distance" | "coordinate" | "area";

/**
 * A province the coordinate tool may NAME and LINK when a point lands inside it (SPEC §6.2's
 * last row).
 *
 * The slug is resolved by the PAGE, from the api's own `slugTr`/`slugEn` — `SEO-POLICY.md`
 * §B4 4.5 bans deriving one per locale by hand, and the island has no api access to do it
 * with. A province the api does not publish is simply absent from this list and its name never
 * appears: A4/3 forbids linking an entity that is not live, and naming one we cannot link
 * would be worse, not better.
 */
export interface ProvinceArea {
  readonly plateCode: string;
  readonly name: string;
  readonly slug: string;
}

export interface ToolIslandProps {
  /** Which tool's body to render. */
  mode: ToolMode;
  /** The picker's options — every province whose il-merkezi point the api publishes. */
  provincePoints: readonly ProvincePoint[];
  /** Coordinate mode only: the provinces a placed point may be reported inside. */
  provinceAreas?: readonly ProvinceArea[];
  /** ASCII file-name stem for the PNG export (SPEC §9.4). */
  downloadName: string;
  /** The map's home frame, passed in rather than imported (see the note on the import list). */
  baseViewBox: string;
}

/** SPEC §6.1: past twenty points this stops being a measuring tool and becomes a drawing one. */
const MAX_POINTS = 20;

/**
 * The fewest points that make a ring (SPEC §6.3), named once.
 *
 * Three places need this number — the area memo's guard, the export threshold and the
 * count-aware announcement below — and a fourth reader has to be able to see they mean the
 * same thing.
 */
const AREA_MIN_POINTS = 3;

/**
 * The uncertainty a point carries when it did NOT come from a click, in kilometres.
 *
 * SPEC §6.6 states the rule as "the digits shown may not exceed the uncertainty the INPUT
 * carries", and it gives two different uncertainties for the two input paths: a map click is
 * worth one CSS pixel (1.7 km at 1× on a desktop stage, 4.7 km on a phone), while a typed
 * coordinate is worth its fourth decimal degree, ~11 m. A province comes from the api's
 * published il-merkezi point and is in the same class.
 *
 * This is the whole of `AK-30 md.2` in code: at 1× zoom two clicks 3 km apart read `3 km`
 * (§6.6, the earned-precision rule) and two typed coordinates 3 km apart read `3,0 km`. The
 * contradiction the ruling closed was between that rule and §6.1's magnitude-only row; the
 * arithmetic lives in `kmDecimalsFor`, and this constant is what feeds it honestly.
 */
const PRECISE_POINT_UNCERTAINTY_KM = 0.011;

/** Marker radius and scale-bar geometry, in CSS pixels — converted to map units per view. */
const MARKER_RADIUS_PX = 5;

type PointSource = "map" | "typed" | "province";

interface PlacedPoint {
  readonly key: number;
  readonly point: GeoPoint;
  readonly source: PointSource;
}

interface Surface {
  readonly svg: SVGSVGElement;
  readonly overlay: SVGGElement;
  readonly controls: HTMLElement;
  readonly attribution: HTMLElement | null;
}

interface ViewState {
  readonly box: ViewBox;
  readonly widthPx: number;
}

/** One province's outlines, parsed once: its rings plus the box that lets most lookups skip it. */
interface ProvinceShape {
  readonly plateCode: string;
  readonly bounds: ShapeBounds;
  readonly rings: readonly (readonly ShapePoint[])[];
}

/**
 * Parsed province outlines, per map element.
 *
 * ## Where the geometry comes from — the DOM, not an import
 *
 * The same rule `tool-png.ts` records and `game-map.tsx` states as a hard one: the 81 outlines
 * are ALREADY in the server HTML, and importing `lib/map/tr-provinces.generated.ts` into a
 * client module would ship 64 KB of path data a second time as JavaScript. The `<path>` nodes
 * in `<defs>` carry `data-plate-code` for exactly this lookup, so neither file has to know the
 * other's `id` prefix.
 *
 * ## Lazy, then kept — `plan-web.md` §5.6
 *
 * Nothing is parsed until the reader places their first point, and then it is parsed once. A
 * `WeakMap` keyed on the live `<svg>` rather than a module-level list, so a client navigation
 * away from the tool does not leave 81 parsed polygons pinned in memory.
 */
const provinceShapeCache = new WeakMap<SVGSVGElement, readonly ProvinceShape[]>();

function provinceShapesOf(svg: SVGSVGElement): readonly ProvinceShape[] {
  const cached = provinceShapeCache.get(svg);
  if (cached !== undefined) return cached;

  const shapes: ProvinceShape[] = [];
  for (const node of svg.querySelectorAll("defs path[data-plate-code]")) {
    const plateCode = node.getAttribute("data-plate-code");
    const d = node.getAttribute("d");
    if (plateCode === null || d === null) continue;
    let rings: ShapePoint[][];
    try {
      rings = parseSubpaths(d);
    } catch {
      // `parseSubpaths` throws rather than returning a wrong answer on an unsupported command.
      // Skipping the shape costs one province its name; guessing would cost the reader a wrong
      // one, and a wrong province on a coordinate readout is invisible.
      continue;
    }
    const bounds = boundsOfPoints(rings.flat());
    if (bounds === null) continue;
    shapes.push({ plateCode, bounds, rings });
  }

  provinceShapeCache.set(svg, shapes);
  return shapes;
}

/** The plaka kodu of the province containing a MAP-space point, or `null` outside all of them. */
function provinceAtPoint(svg: SVGSVGElement, point: ShapePoint): string | null {
  for (const shape of provinceShapesOf(svg)) {
    // Box test first: it rejects ~80 of the 81 shapes with four comparisons each, so the
    // ray-casting cost is paid on the one or two whose box actually contains the point.
    const { minX, minY, maxX, maxY } = shape.bounds;
    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) continue;
    // A province's `d` is one subpath per landmass (islands included) and no holes, so
    // membership is a disjunction rather than an even-odd fill of the whole path.
    if (shape.rings.some((ring) => pointInPolygon(point, ring))) return shape.plateCode;
  }
  return null;
}

/**
 * The tool island: everything interactive on `/araclar/mesafe-olcme` and
 * `/araclar/koordinat-bulma`.
 *
 * ## Where it renders — three places, one component
 *
 * It is mounted inside the map box, and from there it portals into two server-rendered hooks:
 * the `<g data-tool-overlay>` inside the `<svg>` (the line and the markers) and the
 * `[data-tool-controls]` box under the map (the inputs, the result and the point list). Its
 * own subtree holds only the scale bar. React portals are what make this ONE component with
 * one piece of state instead of three synchronised ones — the alternative is imperative DOM
 * writing, and a measurement that disagrees with its own list is exactly the silent class of
 * bug this tool cannot afford.
 *
 * ## Why the markers live in the map's coordinate space
 *
 * A point is stored as lon/lat and drawn through `projectToMapPoint`, so it sits in the
 * `viewBox` the map is already using: pan and zoom move the measurement with the map for
 * free, with nothing to keep in sync and no second projection to drift. Only the SIZES are
 * per-view — a radius in map units would grow twelvefold at 12× zoom.
 *
 * ## Click versus drag is not decided here
 *
 * `MapZoomPan` already owns that boundary (`isRealClick`, 6 px) and swallows a drag's click
 * in the CAPTURE phase on the element above the `<svg>`. This island listens in the bubble
 * phase, so a click that arrives has already survived that gate: one movement threshold on
 * the page, not two (SPEC §6, `plan-web.md` §5.4).
 *
 * ## Screen point to map point
 *
 * `svg.getScreenCTM().inverse()`, never a bounding-box fraction. The matrix accounts for
 * `preserveAspectRatio`, page scroll and any CSS transform; the fraction method silently
 * produces the wrong point the moment the element's box ratio departs from the viewBox's
 * (`plan-web.md` §5.2). In a measuring instrument that error would be invisible.
 */
export function ToolIsland({
  mode,
  provincePoints,
  provinceAreas = [],
  downloadName,
  baseViewBox,
}: ToolIslandProps) {
  const t = useTranslations("Tools.ui");
  const format = useFormatter();
  const isCoordinate = mode === "coordinate";
  const isArea = mode === "area";

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [surface, setSurface] = useState<Surface | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [points, setPoints] = useState<readonly PlacedPoint[]>([]);
  const [draft, setDraft] = useState("");
  const [province, setProvince] = useState("");

  /**
   * TWO error channels, not one (→ PR #73 review `A11Y73-I2`).
   *
   * `fieldError` belongs to the coordinate input and is the ONLY one wired to its
   * `aria-invalid` / `aria-describedby`. `statusError` carries the tool-level messages — the
   * point limit, an empty picker, a failed export — which are about the instrument and not
   * about that field. With one shared string, placing a 21st point from the MAP marked an
   * empty, untouched input invalid and described it with a remedy belonging to another
   * control (WCAG 4.1.2 + 3.3.1).
   */
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const nextKey = useRef(0);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const removeButtons = useRef(new Map<number, HTMLButtonElement>());
  const focusAfterRemoval = useRef<number | "group" | null>(null);

  /**
   * The placed points, mirrored into a ref.
   *
   * The map's click listener is installed in an effect, so reading `points` from its closure
   * would either go stale or re-install the listener on every point. The mirror is what lets
   * the limit check — a side effect, because it shows a message — live OUTSIDE the state
   * updater, which React requires to be pure (→ `A11Y73-I2`). `removePoint` reads it for the
   * same reason: it needs the neighbouring row's key before the row is gone.
   */
  const pointsRef = useRef<readonly PlacedPoint[]>([]);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const letters: CardinalLetters = useMemo(
    () => ({ north: t("north"), south: t("south"), east: t("east"), west: t("west") }),
    [t],
  );

  // ---- Wiring to the server-rendered surface -------------------------------------------

  useEffect(() => {
    // The same "reach the shared container and enhance it" contract `MapZoomPan` uses: the
    // element this island is mounted in contains exactly one <svg>, and that is the map.
    const host = rootRef.current?.parentElement;
    const svg = host?.querySelector("svg");
    const overlay = svg?.querySelector("[data-tool-overlay]");
    const controls = document.querySelector("[data-tool-controls]");
    const credit = document.querySelector("[data-tool-attribution]");
    if (!(svg instanceof SVGSVGElement)) return;
    if (!(overlay instanceof SVGGElement)) return;
    if (!(controls instanceof HTMLElement)) return;
    setSurface({
      svg,
      overlay,
      controls,
      // The licence line as the reader sees it — the PNG bakes THIS text in, so the file can
      // never credit something the page does not (SPEC §9.3).
      //
      // DOCUMENT-SCOPED, like `[data-tool-controls]` two lines up, and for the same reason: the
      // credit is no longer inside the map box. It moved into the component's flow, under the
      // stage, when the overlay plate was measured covering 42.8% of the map at 360px. A lookup
      // rooted at `host` silently returned `null` after that move, and `downloadToolPng` refuses
      // to write an unattributed file — so the export would have failed closed on every page.
      attribution: credit instanceof HTMLElement ? credit : null,
    });
  }, []);

  // The live view: the scale bar, the marker sizes and the number of decimals all follow it.
  useEffect(() => {
    if (!surface) return;
    const { svg } = surface;
    let frame: number | null = null;
    const read = () => {
      frame = null;
      const attribute = svg.getAttribute("viewBox");
      const widthPx = svg.getBoundingClientRect().width;
      if (attribute === null || widthPx <= 0) return;
      let box: ViewBox;
      try {
        box = parseViewBox(attribute);
      } catch {
        return; // mid-write during a pan frame; the next mutation brings a complete value
      }
      setView((previous) =>
        previous !== null &&
        previous.widthPx === widthPx &&
        previous.box.x === box.x &&
        previous.box.y === box.y &&
        previous.box.w === box.w &&
        previous.box.h === box.h
          ? previous
          : { box, widthPx },
      );
    };
    // Coalesced to one read per frame: `MapZoomPan` rewrites the attribute on every
    // animation frame of a pan, and a state write per mutation would be a state write per
    // pointer move (INP).
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(read);
    };
    read();
    const mutations = new MutationObserver(schedule);
    mutations.observe(svg, { attributes: true, attributeFilter: ["viewBox"] });
    const resizes = new ResizeObserver(schedule);
    resizes.observe(svg);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
    };
  }, [surface]);

  // ---- Placing and removing points ------------------------------------------------------

  const addPoint = useCallback(
    (point: GeoPoint, source: PointSource) => {
      if (isCoordinate) {
        // ONE POINT, AND A NEW ONE REPLACES IT. SPEC §6.2 describes a two-way conversion —
        // click a point and read its coordinate, or type a coordinate and see the point — not
        // an accumulation. A second marker would raise a question the readout cannot answer
        // ("which of these is the coordinate?"), so the tool answers it structurally rather
        // than with a "clear first" instruction, and therefore never has a limit to refuse at.
        setStatusError(null);
        nextKey.current += 1;
        setPoints([{ key: nextKey.current, point, source }]);
        return;
      }
      if (pointsRef.current.length >= MAX_POINTS) {
        setStatusError(t("limitReached", { limit: MAX_POINTS }));
        return;
      }
      setStatusError(null);
      nextKey.current += 1;
      const key = nextKey.current;
      // The updater re-checks the cap and stays pure: the mirror above is read at event time,
      // and the twenty-point ceiling is the one invariant that may not depend on when React
      // happened to flush.
      setPoints((previous) =>
        previous.length >= MAX_POINTS ? previous : [...previous, { key, point, source }],
      );
    },
    [isCoordinate, t],
  );

  useEffect(() => {
    if (!surface) return;
    const { svg } = surface;
    const onClick = (event: MouseEvent) => {
      // A double-click is the map's OWN gesture — `MapZoomPan` zooms on it — and the browser
      // delivers two ordinary `click` events before `dblclick`. Without this guard the reader
      // who zooms in also gets two coincident points and an announced "0 kilometre" leg they
      // never placed (→ `CODE73-I1`). It covers a triple-click too.
      if (event.detail > 1) return;
      const matrix = svg.getScreenCTM();
      if (matrix === null) return;
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      addPoint(unprojectMapPoint({ x: local.x, y: local.y }), "map");
    };
    svg.addEventListener("click", onClick);
    return () => svg.removeEventListener("click", onClick);
  }, [surface, addPoint]);

  const removePoint = useCallback((key: number) => {
    // WHERE FOCUS GOES, decided before the row is gone (→ `A11Y73-I3`). The activated button
    // unmounts with its `<li>`, so without this focus falls to `<body>` and a keyboard user
    // re-traverses the whole page for every deletion — and this list is the ONLY keyboard
    // deletion path the tool has (recorded deviation 4). The row that takes the deleted row's
    // index inherits the focus, the row above it when the last one goes, and the labelled
    // control group when the list empties: at zero points every action button is disabled,
    // and a disabled button cannot hold focus.
    const current = pointsRef.current;
    const index = current.findIndex((placed) => placed.key === key);
    const successor = index === -1 ? undefined : (current[index + 1] ?? current[index - 1]);
    focusAfterRemoval.current = successor?.key ?? "group";
    setPoints((previous) => previous.filter((placed) => placed.key !== key));
    setStatusError(null);
  }, []);

  useEffect(() => {
    const target = focusAfterRemoval.current;
    if (target === null) return;
    focusAfterRemoval.current = null;
    if (target === "group") {
      controlsRef.current?.focus();
      return;
    }
    removeButtons.current.get(target)?.focus();
  }, [points]);

  // THE SIBLING OF `removePoint`'s FOCUS RULE, and it was missing (→ PR #73 `PRE_EXISTING`,
  // `FU-73-UNDO-CLEAR-FOCUS`). Both buttons carry `disabled={points.length === 0}`, so the
  // activation that empties the list is also the one that disables the button under the
  // reader's finger; the browser blurs it and focus falls to `<body>` — the same WCAG 2.4.3
  // failure `A11Y73-I3` fixed for the per-point delete buttons, reached through the two
  // controls a keyboard user is most likely to use. `"group"` is the labelled control group,
  // which takes focus precisely because a disabled button cannot.
  const undo = useCallback(() => {
    if (pointsRef.current.length <= 1) focusAfterRemoval.current = "group";
    setPoints((previous) => previous.slice(0, -1));
    setFieldError(null);
    setStatusError(null);
  }, []);

  const clear = useCallback(() => {
    focusAfterRemoval.current = "group";
    setPoints([]);
    setFieldError(null);
    setStatusError(null);
    setDraft("");
    setProvince("");
  }, []);

  const submitCoordinate = useCallback(() => {
    const result = parseLatLon(draft, letters);
    if (!result.ok) {
      const messages: Record<ParseFailureReason, string> = {
        empty: t("errorEmpty"),
        unreadable: t("errorUnreadable"),
        latitudeOutOfRange: t("errorLatitude"),
        longitudeOutOfRange: t("errorLongitude"),
      };
      setFieldError(messages[result.reason]);
      return;
    }
    setFieldError(null);
    addPoint(result.point, "typed");
    setDraft("");
  }, [addPoint, draft, letters, t]);

  const submitProvince = useCallback(() => {
    const picked = findProvincePoint(provincePoints, province);
    if (picked === null) {
      // The placeholder is the select's INITIAL value, so this is the ordinary "pressed Ekle
      // before opening the list" case rather than an impossible state. The sibling coordinate
      // form answers the same action with `errorEmpty`; silence here left a screen-reader
      // user unable to tell a skipped step from a broken tool (→ `A11Y73-I4`).
      setStatusError(t("errorNoProvince"));
      return;
    }
    addPoint(picked.point, "province");
    setProvince("");
  }, [addPoint, province, provincePoints, t]);

  // ---- Derived measurement --------------------------------------------------------------

  const geoPoints = useMemo(() => points.map((placed) => placed.point), [points]);
  const totalKm = useMemo(() => polylineLengthKm(geoPoints), [geoPoints]);

  const centerLatitude = view
    ? unprojectMapPoint({ x: view.box.x + view.box.w / 2, y: view.box.y + view.box.h / 2 }).lat
    : null;
  const kmPerPixel =
    view && centerLatitude !== null
      ? (view.box.w / view.widthPx) * kmPerMapUnitAt(centerLatitude)
      : null;
  const bar =
    view && centerLatitude !== null ? scaleBarKm(view.box.w, view.widthPx, centerLatitude) : null;

  // A measurement is only as sharp as its LEAST certain point: one click in the set puts the
  // whole line back on the pixel rule, which is why this is `some` and not `every`.
  const uncertaintyKm = points.some((placed) => placed.source === "map")
    ? (kmPerPixel ?? Number.POSITIVE_INFINITY)
    : PRECISE_POINT_UNCERTAINTY_KM;

  // The decimals belong to the value being SHOWN, which is what `kmDecimalsFor`'s second
  // parameter means. Deriving them once from the route TOTAL printed a 400 m leg as
  // "0 kilometre" on any route past 10 km — the instrument stating that two separately
  // listed points are in the same place (→ `CODE73-I2`, SPEC §6.1 as ratified by AK-30 md.2).
  const formatKm = useCallback(
    (km: number) => {
      const decimals = kmDecimalsFor(uncertaintyKm, km);
      return format.number(km, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    [format, uncertaintyKm],
  );

  /**
   * SPEC §6.6 in its AREA form (PR-D plan §4.4, Atlas-approved).
   *
   * The rule stays the single one this repo already has — `kmDecimalsFor` — applied to the
   * shape's LINEAR scale, the side of the equivalent square. That is the quantity a point's
   * uncertainty is expressed in, so no second threshold family is minted: a ring clicked at 1×
   * reads whole km² because the click is worth ~1.7 km, while a small ring typed in decimal
   * degrees earns its tenth.
   *
   * WHAT IT DOES NOT DO (→ PR #75 review `CODE75-M1`). An earlier version of this note claimed
   * the rule removes the always-integer alternative's `0 km²` problem. It NARROWS it and does
   * not remove it: `kmDecimalsFor` returns at most one decimal, so a ring under 0.05 km² still
   * prints `0,0` on the typed path, and under 0.5 km² still prints `0` on the click path. What
   * the rule buys is the two orders of magnitude between those floors and the alternative's,
   * which is where a legitimately small typed polygon actually lands. The same rounding is
   * already published by the distance tool.
   */
  const formatArea = useCallback(
    (km2: number) => {
      const decimals = kmDecimalsFor(uncertaintyKm, Math.sqrt(km2));
      return format.number(km2, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    [format, uncertaintyKm],
  );

  const formatAxis = useCallback(
    (value: number, axis: "lat" | "lon") => {
      const letter =
        axis === "lat"
          ? value < 0
            ? letters.south
            : letters.north
          : value < 0
            ? letters.west
            : letters.east;
      return `${format.number(Math.abs(value), {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })}° ${letter}`;
    },
    [format, letters],
  );

  /**
   * The same value in degrees, minutes and seconds — SPEC §6.2 asks for BOTH notations.
   *
   * Assembled here rather than from a message key because `°`, `'` and `"` are NOTATION, not
   * copy: they are written identically in Turkish and English, and the only localized part is
   * the direction letter, which already comes from the bundle. The rounding — including the
   * `59'60"` overflow — is `toDmsParts`' job and deliberately not this component's; the two-digit
   * padding is the conventional written form and keeps a column of readouts from jittering.
   */
  const formatDms = useCallback(
    (value: number, axis: LatLonAxis) => {
      const parts = toDmsParts(value, axis);
      const minutes = String(parts.minutes).padStart(2, "0");
      const seconds = String(parts.seconds).padStart(2, "0");
      return `${parts.degrees}°${minutes}'${seconds}"${letters[parts.cardinal]}`;
    },
    [letters],
  );

  /** Coordinate mode's single point. `null` until the reader places one. */
  const activePoint = isCoordinate ? (points[0] ?? null) : null;

  /**
   * The province the point fell inside, when the api published a page for it (SPEC §6.2).
   *
   * Deferred to render rather than done in the click handler so the parse cost lands once, in
   * a memo React can skip, instead of inside the interaction that placed the point (INP).
   */
  const containingProvince = useMemo(() => {
    if (surface === null || activePoint === null || provinceAreas.length === 0) return null;
    const plateCode = provinceAtPoint(
      surface.svg,
      projectToMapPoint(activePoint.point.lon, activePoint.point.lat),
    );
    if (plateCode === null) return null;
    return provinceAreas.find((area) => area.plateCode === plateCode) ?? null;
  }, [activePoint, provinceAreas, surface]);

  // THE DISTANCE TOOL'S per-leg values, and the gate is here rather than at the render
  // (→ PR-D plan §4.1/6). Before the third mode existed this memo needed no mode test: a
  // coordinate lookup never holds more than one point, so `points.length < 3` was accidentally
  // enough. An area ring holds three or more, so without this the area tool would list every
  // edge of its own perimeter beside a perimeter total that already states it (§22).
  const legs = useMemo(() => {
    if (mode !== "distance" || points.length < 3) return [];
    const values: { key: number; km: number }[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (!previous || !current) continue;
      values.push({ key: current.key, km: haversineKm(previous.point, current.point) });
    }
    return values;
  }, [mode, points]);

  /**
   * What the area tool can say about the ring the reader drew — `null` until there is a ring.
   *
   * The three outcomes are the tool's whole contract (SPEC §6.3), and the maths is PR-A's:
   * nothing here reimplements a formula, it chooses a branch.
   */
  const area = useMemo(() => {
    if (!isArea || points.length < AREA_MIN_POINTS) return null;
    const ring = geoPoints;
    // A self-intersecting outline has no well-defined inside, so NO number derived from it is
    // trustworthy — not the area, and not the perimeter either. `plan-web.md` §15/8 is explicit
    // that the tool shows a sentence instead.
    if (ringSelfIntersects(ring)) return { kind: "selfIntersects" } as const;
    const perimeterKm = ringPerimeterKm(ring);
    // A ring crossing the ±180° seam is the OTHER kind of refusal, and it is not the same
    // shape. The ring is valid; only the area is unmeasurable, because the formula sums
    // longitude differences and reads a 1° step across the seam as a 359° sweep. Its perimeter
    // is therefore a true fact about it and is still shown (`measure.ts:149-151` records that
    // `ringPerimeterKm` keeps working there, and `ringCrossesAntimeridian` is exported
    // precisely so a caller can explain the refusal in words instead of showing an empty
    // result). The predicate names the branch; the null check keeps the signature honest
    // without letting an invented number through.
    const km2 = ringCrossesAntimeridian(ring) ? null : ringAreaKm2(ring);
    if (km2 === null) return { kind: "seam", perimeterKm } as const;
    return { kind: "measured", km2, perimeterKm } as const;
  }, [geoPoints, isArea, points.length]);

  const resultText =
    points.length === 0
      ? t("resultEmpty")
      : points.length === 1
        ? t("resultOnePoint")
        : points.length === 2
          ? t("resultTwoPoints", { distance: formatKm(totalKm) })
          : t("resultRoute", { count: points.length, distance: formatKm(totalKm) });

  // A valid coordinate outside the drawn frame is ACCEPTED and named, never clipped
  // (SPEC §6.2): clipping would report a place the reader did not pick.
  const outsideFrame = useMemo(() => {
    let frame: ViewBox;
    try {
      frame = parseViewBox(baseViewBox);
    } catch {
      return false;
    }
    return points.some((placed) => {
      const projected = projectToMapPoint(placed.point.lon, placed.point.lat);
      return (
        projected.x < frame.x ||
        projected.x > frame.x + frame.w ||
        projected.y < frame.y ||
        projected.y > frame.y + frame.h
      );
    });
  }, [baseViewBox, points]);

  // ---- Export ----------------------------------------------------------------------------

  // One point is a complete picture for a coordinate lookup and an incomplete one for a
  // measurement, so the export threshold follows the mode rather than the polyline. An area
  // needs the three that make a ring — exporting two would picture a line, not a shape.
  const minExportPoints = isCoordinate ? 1 : isArea ? AREA_MIN_POINTS : 2;

  const download = useCallback(() => {
    if (!surface || geoPoints.length < minExportPoints) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadToolPng({
      svg: surface.svg,
      attribution: surface.attribution,
      points: geoPoints,
      // The downloaded picture is the one on screen: a ring, not an open path.
      closed: isArea && geoPoints.length > 2,
      scaleBar:
        bar && view
          ? {
              km: bar.km,
              label: t("kmShort", { km: format.number(bar.km) }),
              widthFraction: bar.px / view.widthPx,
            }
          : null,
      fileName: `${downloadName}-${stamp}.png`,
    }).catch((reason: unknown) => {
      console.warn(`[tools] PNG export failed. ${String(reason)}`);
      setStatusError(t("downloadFailed"));
    });
  }, [bar, downloadName, format, geoPoints, isArea, minExportPoints, surface, t, view]);

  // ---- Render -----------------------------------------------------------------------------

  const markerRadius = view ? (MARKER_RADIUS_PX * view.box.w) / view.widthPx : 3;
  const projected = points.map((placed) => projectToMapPoint(placed.point.lon, placed.point.lat));

  /**
   * The polite region's body — one complete sentence per line, never a bare number
   * (`plan-web.md` §8/2, WCAG 4.1.3).
   *
   * Coordinate mode prints the decimal degrees first because that is the answer the reader
   * asked for, the DMS line second because SPEC §6.2 wants both notations, and the province
   * line only when the point is genuinely inside one.
   */
  /**
   * The area tool's readout. One polite region, two sentences when there is something to say
   * about both quantities, one when the ring refuses a number.
   *
   * THE TWO REFUSALS DELIBERATELY DIFFER IN SHAPE (Atlas ruling, PR-D §4.2): a ring across the
   * seam is a valid ring whose AREA is unmeasurable, so its perimeter still shows; a
   * self-intersecting ring is not a valid ring at all, so nothing derived from it does.
   */
  const areaBody =
    area === null ? (
      // COUNT-AWARE BELOW THREE POINTS (→ PR #75 review `A11Y75-I1`). This branch used to print
      // one constant string, so the single polite region was byte-identical at zero, one and two
      // points and a screen-reader user pressing "Ekle" heard nothing — unable to tell an
      // accepted point from a picker that never registered it. Every ring needs three points, so
      // that silence sat on the path of EVERY use of this tool, while the other two modes
      // announce at each step. The state a change has to carry is how many points are down and
      // how many are still owed (WCAG 4.1.3); no second region and no focus move, because the
      // region is already mounted and already polite.
      <p className={styles.result}>
        {points.length === 0
          ? t("areaEmpty")
          : t("areaNeedsMore", {
              placed: points.length,
              remaining: AREA_MIN_POINTS - points.length,
            })}
      </p>
    ) : area.kind === "selfIntersects" ? (
      <p className={styles.result}>{t("areaSelfIntersects")}</p>
    ) : (
      <>
        <p className={styles.result}>
          {area.kind === "seam" ? t("areaSeam") : t("areaResult", { area: formatArea(area.km2) })}
        </p>
        <p className={styles.readoutLine}>
          {t("areaPerimeter", { perimeter: formatKm(area.perimeterKm) })}
        </p>
      </>
    );

  const resultBody = isArea ? (
    areaBody
  ) : !isCoordinate ? (
    <p className={styles.result}>{resultText}</p>
  ) : activePoint === null ? (
    <p className={styles.result}>{t("coordinateEmpty")}</p>
  ) : (
    <>
      <p className={styles.result}>
        {t("coordinateDecimal", {
          lat: formatAxis(activePoint.point.lat, "lat"),
          lon: formatAxis(activePoint.point.lon, "lon"),
        })}
      </p>
      <p className={styles.readoutLine}>
        {t("coordinateDms", {
          lat: formatDms(activePoint.point.lat, "lat"),
          lon: formatDms(activePoint.point.lon, "lon"),
        })}
      </p>
      {containingProvince !== null && (
        <p className={styles.readoutLine}>
          {t.rich("coordinateProvince", {
            name: containingProvince.name,
            link: (chunks) => (
              <Link
                href={{ pathname: "/turkiye/[slug]", params: { slug: containingProvince.slug } }}
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </>
  );

  const overlay = (
    <>
      {/* The area tool's ring is a `<polygon>`, which is what DRAWS the closing edge SPEC §6.3
          says the tool adds for you — with a `<polyline>` the reader would be told the shape
          closes itself and shown one that does not. Below three points there is no ring yet,
          so the line stays a line while the shape is being placed, and a self-intersecting
          ring is still drawn: the reader has to see what to fix. */}
      {projected.length > 1 &&
        (isArea && projected.length > 2 ? (
          <polygon
            className={styles.measureArea}
            points={projected.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ) : (
          <polyline
            className={styles.measureLine}
            points={projected.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ))}
      {projected.map((point, index) => (
        <circle
          key={points[index]?.key ?? index}
          className={styles.marker}
          cx={point.x}
          cy={point.y}
          r={markerRadius}
        />
      ))}
    </>
  );

  const controls = (
    // `tabIndex={-1}` adds no tab stop; it is the landing place for focus when the last point
    // is deleted and every action button is disabled (→ `A11Y73-I3`).
    <div
      ref={controlsRef}
      tabIndex={-1}
      className={styles.controls}
      role="group"
      aria-label={isCoordinate ? t("coordinateControlsLabel") : t("controlsLabel")}
    >
      <div className={styles.inputs}>
        <form
          className={styles.field}
          onSubmit={(event) => {
            event.preventDefault();
            submitProvince();
          }}
        >
          {/* "Ekle" is honest where points accumulate and misleading where the next one
              replaces the last, so the two modes label the same control differently rather
              than sharing a word that is only half true. */}
          <label className={styles.label} htmlFor="tool-province">
            {isCoordinate ? t("coordinateProvinceLabel") : t("provinceLabel")}
          </label>
          <div className={styles.fieldRow}>
            <select
              id="tool-province"
              className={styles.select}
              value={province}
              onChange={(event) => setProvince(event.target.value)}
            >
              <option value="">{t("provincePlaceholder")}</option>
              {provincePoints.map((option) => (
                <option key={option.plateCode} value={option.plateCode}>
                  {option.nameTr}
                </option>
              ))}
            </select>
            <button type="submit" className={`btn btn-ghost ${styles.addButton}`}>
              {isCoordinate ? t("showPoint") : t("addPoint")}
            </button>
          </div>
        </form>

        <form
          className={styles.field}
          onSubmit={(event) => {
            event.preventDefault();
            submitCoordinate();
          }}
        >
          <label className={styles.label} htmlFor="tool-coordinate">
            {isCoordinate ? t("coordinateInputLabel") : t("coordinateLabel")}
          </label>
          <div className={styles.fieldRow}>
            <input
              id="tool-coordinate"
              className={styles.input}
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder={t("coordinatePlaceholder")}
              value={draft}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError !== null ? "tool-coordinate-error" : undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className={`btn btn-ghost ${styles.addButton}`}>
              {isCoordinate ? t("showPoint") : t("addPoint")}
            </button>
          </div>
        </form>
      </div>

      {/* The field's own error, and only it, is what `aria-describedby` points at. */}
      {fieldError !== null && (
        <p id="tool-coordinate-error" className={styles.error} role="alert">
          {fieldError}
        </p>
      )}

      {statusError !== null && (
        <p className={styles.error} role="alert">
          {statusError}
        </p>
      )}

      {/* ONE polite region, mounted before the reader touches anything, carrying both things a
          change can say: the measurement and the out-of-frame note. The result is a SENTENCE
          rather than a bare number — a screen reader hearing "331" alone learns nothing
          (`plan-web.md` §8/2, WCAG 4.1.3). The note was a plain `<p>` outside every live
          region, so a point in Russia was drawn nowhere and announced nowhere either
          (→ `A11Y73-I1`); it lives INSIDE the region rather than carrying its own, because a
          live region inserted together with its text is missed by some screen readers. */}
      <div className={styles.live} aria-live="polite">
        {resultBody}
        {outsideFrame && <p className={styles.note}>{t("outsideFrame")}</p>}
      </div>

      {legs.length > 0 && (
        // `role="list"` because `list-style: none` drops list semantics in Safari/VoiceOver —
        // the repo's settled treatment (`breadcrumb.tsx`, the hubs, `featured-cards`).
        <ol className={styles.legs} role="list">
          {legs.map((leg, index) => (
            <li key={leg.key}>{t("legName", { index: index + 1, distance: formatKm(leg.km) })}</li>
          ))}
        </ol>
      )}

      {/* The point list is the DISTANCE tool's keyboard deletion path and its running record of
          what has been placed. Coordinate mode holds one point whose value the readout above
          already states in two notations, so a list would repeat it and add a delete control
          that duplicates "Temizle" — §22's "do not write what the interface shows". */}
      {!isCoordinate && points.length > 0 && (
        <>
          <p id="tool-points-label" className={styles.label}>
            {t("pointsLabel")}
          </p>
          <ul className={styles.points} role="list" aria-labelledby="tool-points-label">
            {points.map((placed, index) => (
              <li key={placed.key} className={styles.pointRow}>
                <span>
                  {t("pointName", {
                    index: index + 1,
                    lat: formatAxis(placed.point.lat, "lat"),
                    lon: formatAxis(placed.point.lon, "lon"),
                  })}
                </span>
                <button
                  type="button"
                  ref={(node) => {
                    if (node === null) {
                      removeButtons.current.delete(placed.key);
                    } else {
                      removeButtons.current.set(placed.key, node);
                    }
                  }}
                  className={styles.pointRemove}
                  aria-label={t("pointRemove", { index: index + 1 })}
                  onClick={() => removePoint(placed.key)}
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.actions}>
        {/* No "Geri al" in coordinate mode: with one point it does exactly what "Temizle"
            does, and two controls for one action is a choice the reader has to make for no
            gain. */}
        {!isCoordinate && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={undo}
            disabled={points.length === 0}
          >
            {t("undo")}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={clear}
          disabled={points.length === 0}
        >
          {t("clear")}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={download}
          disabled={points.length < minExportPoints}
        >
          {t("download")}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={styles.overlayLayer}>
      {bar && (
        <div
          className={styles.scaleBar}
          role="img"
          aria-label={t("scaleBar", { km: format.number(bar.km) })}
        >
          <span aria-hidden="true">{t("kmShort", { km: format.number(bar.km) })}</span>
          <span aria-hidden="true" className={styles.scaleBarRule} style={{ width: bar.px }} />
        </div>
      )}
      {surface && createPortal(overlay, surface.overlay)}
      {surface && createPortal(controls, surface.controls)}
    </div>
  );
}
