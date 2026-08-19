"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import {
  haversineKm,
  kmDecimalsFor,
  kmPerMapUnitAt,
  parseLatLon,
  polylineLengthKm,
  scaleBarKm,
  unprojectMapPoint,
  type CardinalLetters,
  type GeoPoint,
  type ParseFailureReason,
} from "@/lib/map/measure";
import { projectToMapPoint } from "@/lib/map/projection";
import { parseViewBox, type ViewBox } from "@/lib/map/zoom-pan";
import { findProvincePoint, type ProvincePoint } from "@/lib/tools/province-points";
import { downloadToolPng } from "./tool-png";
import styles from "./tools.module.css";

export interface ToolIslandProps {
  /** The picker's options — every province whose il-merkezi point the api publishes. */
  provincePoints: readonly ProvincePoint[];
  /** ASCII file-name stem for the PNG export (SPEC §9.4). */
  downloadName: string;
  /** The map's home frame, passed in rather than imported (see the note on the import list). */
  baseViewBox: string;
}

/** SPEC §6.1: past twenty points this stops being a measuring tool and becomes a drawing one. */
const MAX_POINTS = 20;

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

/**
 * The measuring island: everything interactive on `/araclar/mesafe-olcme`.
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
export function ToolIsland({ provincePoints, downloadName, baseViewBox }: ToolIslandProps) {
  const t = useTranslations("Tools.ui");
  const format = useFormatter();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [surface, setSurface] = useState<Surface | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [points, setPoints] = useState<readonly PlacedPoint[]>([]);
  const [draft, setDraft] = useState("");
  const [province, setProvince] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(0);

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
    if (!(svg instanceof SVGSVGElement)) return;
    if (!(overlay instanceof SVGGElement)) return;
    if (!(controls instanceof HTMLElement)) return;
    setSurface({
      svg,
      overlay,
      controls,
      // The licence line as the reader sees it — the PNG bakes THIS text in, so the file can
      // never credit something the page does not (SPEC §9.3).
      attribution: host?.querySelector("[data-tool-attribution]") ?? null,
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
      setPoints((previous) => {
        if (previous.length >= MAX_POINTS) {
          setError(t("limitReached", { limit: MAX_POINTS }));
          return previous;
        }
        setError(null);
        nextKey.current += 1;
        return [...previous, { key: nextKey.current, point, source }];
      });
    },
    [t],
  );

  useEffect(() => {
    if (!surface) return;
    const { svg } = surface;
    const onClick = (event: MouseEvent) => {
      const matrix = svg.getScreenCTM();
      if (matrix === null) return;
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      addPoint(unprojectMapPoint({ x: local.x, y: local.y }), "map");
    };
    svg.addEventListener("click", onClick);
    return () => svg.removeEventListener("click", onClick);
  }, [surface, addPoint]);

  const removePoint = useCallback((key: number) => {
    setPoints((previous) => previous.filter((placed) => placed.key !== key));
    setError(null);
  }, []);

  const undo = useCallback(() => {
    setPoints((previous) => previous.slice(0, -1));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setPoints([]);
    setError(null);
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
      setError(messages[result.reason]);
      return;
    }
    addPoint(result.point, "typed");
    setDraft("");
  }, [addPoint, draft, letters, t]);

  const submitProvince = useCallback(() => {
    const picked = findProvincePoint(provincePoints, province);
    if (picked === null) return;
    addPoint(picked.point, "province");
    setProvince("");
  }, [addPoint, province, provincePoints]);

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
  const decimals = kmDecimalsFor(uncertaintyKm, totalKm);

  const formatKm = useCallback(
    (km: number) =>
      format.number(km, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    [decimals, format],
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

  const legs = useMemo(() => {
    if (points.length < 3) return [];
    const values: { key: number; km: number }[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (!previous || !current) continue;
      values.push({ key: current.key, km: haversineKm(previous.point, current.point) });
    }
    return values;
  }, [points]);

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

  const download = useCallback(() => {
    if (!surface || geoPoints.length < 2) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadToolPng({
      svg: surface.svg,
      attribution: surface.attribution,
      points: geoPoints,
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
      setError(t("downloadFailed"));
    });
  }, [bar, downloadName, format, geoPoints, surface, t, view]);

  // ---- Render -----------------------------------------------------------------------------

  const markerRadius = view ? (MARKER_RADIUS_PX * view.box.w) / view.widthPx : 3;
  const projected = points.map((placed) => projectToMapPoint(placed.point.lon, placed.point.lat));

  const overlay = (
    <>
      {projected.length > 1 && (
        <polyline
          className={styles.measureLine}
          points={projected.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      )}
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
    <div className={styles.controls} role="group" aria-label={t("controlsLabel")}>
      <div className={styles.inputs}>
        <form
          className={styles.field}
          onSubmit={(event) => {
            event.preventDefault();
            submitProvince();
          }}
        >
          <label className={styles.label} htmlFor="tool-province">
            {t("provinceLabel")}
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
              {t("addPoint")}
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
            {t("coordinateLabel")}
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
              aria-invalid={error !== null}
              aria-describedby={error !== null ? "tool-coordinate-error" : undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className={`btn btn-ghost ${styles.addButton}`}>
              {t("addPoint")}
            </button>
          </div>
        </form>
      </div>

      {error !== null && (
        <p id="tool-coordinate-error" className={styles.error} role="alert">
          {error}
        </p>
      )}

      {/* The result is a SENTENCE, not a bare number, and it is announced as one: a screen
          reader hearing "331" alone learns nothing (`plan-web.md` §8/2, WCAG 4.1.3). */}
      <p className={styles.result} aria-live="polite">
        {resultText}
      </p>

      {outsideFrame && <p className={styles.note}>{t("outsideFrame")}</p>}

      {legs.length > 0 && (
        <ol className={styles.legs}>
          {legs.map((leg, index) => (
            <li key={leg.key}>{t("legName", { index: index + 1, distance: formatKm(leg.km) })}</li>
          ))}
        </ol>
      )}

      {points.length > 0 && (
        <>
          <p className={styles.label}>{t("pointsLabel")}</p>
          <ul className={styles.points}>
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
        <button
          type="button"
          className="btn btn-ghost"
          onClick={undo}
          disabled={points.length === 0}
        >
          {t("undo")}
        </button>
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
          disabled={points.length < 2}
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
