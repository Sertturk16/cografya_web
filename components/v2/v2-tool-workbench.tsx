"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { projectToMapPoint } from "@/lib/map/projection";
import {
  unprojectMapPoint,
  polylineLengthKm,
  ringPerimeterKm,
  readRingArea,
  toDmsParts,
  parseLatLon,
  scaleBarKm,
  type GeoPoint,
  type CardinalLetters,
} from "@/lib/map/measure";
import { parseSubpaths, pointInPolygon, type ShapePoint } from "@/lib/map/shape-geometry";
import {
  CLICK_MOVE_THRESHOLD_PX,
  atScreenSize,
  clampPan,
  moveDistance,
  parseViewBox,
  zoomFromPinch,
  type ViewBox,
} from "@/lib/map/zoom-pan";
import { pinLabelPlacement, type PinLabelSide } from "@/lib/map/pin-label-placement";
import { useLandscapeMode } from "@/lib/map/use-landscape-mode.client";
import type { ProvincePoint, ProvinceArea } from "@/lib/tools/province-points";
import { TOOL_PRESETS, type ToolMode, type ToolPreset } from "@/lib/tools/tool-presets";
import type { MeasurementType } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth } from "@/lib/auth/auth-modal.client";
import {
  fetchMeasurements,
  saveMeasurement,
  removeMeasurement,
  type MeasurementRecord,
} from "@/lib/measurements/client";
import {
  MEASUREMENT_MAX_POINTS,
  MEASUREMENT_MIN_POINTS,
  MEASUREMENT_TITLE_MAX_LENGTH,
  canSaveMeasurement,
  measurementPointCountIssue,
} from "@/lib/measurements/shape";
import {
  DELETE_ERROR_MESSAGE_KEY,
  SAVE_ERROR_MESSAGE_KEY,
  type DeleteMeasurementErrorCode,
  type SaveMeasurementErrorCode,
} from "@/lib/measurements/save-error";
import {
  Compass,
  RotateCcw,
  Copy,
  Check,
  Plane,
  Car,
  ZoomIn,
  ZoomOut,
  Trash2,
  Undo2,
  Download,
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
  RefreshCw,
  Navigation,
  Plus,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { MapAttribution } from "@/components/patterns/map-attribution";
import { formatDay } from "@/lib/text/format-date";
import { formatNumber } from "@/lib/text/format-number";

export interface PointWithSvg {
  svgX: number;
  svgY: number;
  geo: GeoPoint;
  label?: string;
  /** Shorter name drawn on the map when `label` is too wide for a phone map (T-122). */
  mapLabel?: string;
  source?: "map" | "dropdown" | "manual" | "preset";
}

/**
 * The CBS canvas's world rect, parsed once with the shared zoom/pan module's own parser
 * (T-015) rather than the ad hoc `.split(" ").map(Number)` `currentViewBox` still does below —
 * that inline parse stays untouched (it is exercised, working code); this constant is only for
 * the NEW touch-gesture and smart-focus math, which reuses `lib/map/zoom-pan.ts`'s pure
 * geometry (`zoomFromPinch`, `clampPan`) instead of re-deriving pinch/pan arithmetic by hand.
 */
const WORLD_VIEWBOX: ViewBox = parseViewBox(TR_CONTEXT_VIEWBOX);
/** Upper zoom bound this tool's own +/− buttons already use (`handleZoomIn`) — the touch
 *  pinch below is clamped to the SAME ceiling, not `zoom-pan.ts`'s own (higher) `MAX_ZOOM`. */
const MAX_TOOL_ZOOM = 8;

/** Each tool's example chips hover in that tool's colour, as before T-125 split them. */
const PRESET_CHIP_HOVER: Record<ToolMode, string> = {
  distance: "hover:bg-primary/15 hover:text-primary",
  area: "hover:bg-accent/15 hover:text-accent",
  coordinates: "hover:bg-secondary/15 hover:text-secondary",
};

/** Waypoint pin sizes in CSS px, the same at every zoom and box size via `atScreenSize`
 *  (T-122): dot radius, its outline, the label's font size and its gap from the dot. */
const PIN_RADIUS = 5;
const PIN_OUTLINE = 2;
const PIN_LABEL_SIZE = 11;
const PIN_LABEL_GAP = 4;
/** Card-coloured outline painted under each label's glyphs, so it reads across lake shores. */
const PIN_LABEL_HALO = 3;
/** Where a pin's label sits for each `pinLabelPlacement` side: a unit offset from the dot
 *  (times the dot-plus-gap distance) and the text alignment that keeps it clear of the dot. */
const PIN_LABEL_LAYOUT: Record<
  PinLabelSide,
  {
    dx: number;
    dy: number;
    anchor: "start" | "middle" | "end";
    baseline: "auto" | "hanging" | "central";
  }
> = {
  above: { dx: 0, dy: -1, anchor: "middle", baseline: "auto" },
  below: { dx: 0, dy: 1, anchor: "middle", baseline: "hanging" },
  left: { dx: -1, dy: 0, anchor: "end", baseline: "central" },
  right: { dx: 1, dy: 0, anchor: "start", baseline: "central" },
};

/**
 * Landscape/fullscreen overrides for the map box and the box that pairs it with its credit.
 * Inline style, for the two reasons `v2-game-screen.tsx` states at length beside the same pair:
 * they must beat the base utilities without relying on Tailwind's emit order, and a conditional
 * className would reduce this plate's `aspect-[1270/580]` to `${…}` for the composition scanner,
 * dropping the surface out of a recorded population without anyone noticing.
 *
 * `borderRadius: 0` because in this layout the box IS the screen, and a corner radius would cut
 * the map against straight screen edges (T-015) — the same reason the className used to drop
 * `rounded-2xl` when landscape was active.
 */
const LANDSCAPE_FILL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: "1 1 0%",
  minHeight: 0,
};
const LANDSCAPE_PLATE: React.CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  aspectRatio: "auto",
  borderRadius: 0,
};

/** This component's `{ zoomLevel, panOffset }` pair, expressed as a `ViewBox` — the exact
 *  rectangle `currentViewBox` (below) already computes, in the shape `zoom-pan.ts`'s pure
 *  functions expect. Kept local rather than replacing `currentViewBox` itself: that memo is
 *  tested-by-use throughout the file, and this is additive, touch-only math. */
function viewOfZoomPan(
  zoomLevel: number,
  panOffset: { x: number; y: number },
  world: ViewBox,
): ViewBox {
  const w = world.w / zoomLevel;
  const h = world.h / zoomLevel;
  const cx = world.x + world.w / 2 + panOffset.x;
  const cy = world.y + world.h / 2 + panOffset.y;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** The inverse of `viewOfZoomPan` — a `ViewBox` back to `{ zoomLevel, panOffset }`. */
function zoomPanOfView(
  view: ViewBox,
  world: ViewBox,
): { zoomLevel: number; panOffset: { x: number; y: number } } {
  return {
    zoomLevel: world.w / view.w,
    panOffset: {
      x: view.x + view.w / 2 - (world.x + world.w / 2),
      y: view.y + view.h / 2 - (world.y + world.h / 2),
    },
  };
}

/** Every `Measurements` key a failed save, delete or list load can show. */
type MeasurementErrorMessageKey =
  | (typeof SAVE_ERROR_MESSAGE_KEY)[SaveMeasurementErrorCode]
  | (typeof DELETE_ERROR_MESSAGE_KEY)[DeleteMeasurementErrorCode];

/**
 * The copy for a failed save or delete. `sessionExpired` is rich text whose `<link>` goes to the
 * login page: an expired session is fixed by signing in, not by clicking again. The login page has
 * no return-path parameter today (it always lands on `/`), so the link carries none.
 */
export function MeasurementErrorText({
  messageKey,
}: {
  readonly messageKey: MeasurementErrorMessageKey;
}) {
  const t = useTranslations("Measurements");
  if (messageKey === "sessionExpired") {
    return t.rich("sessionExpired", {
      link: (chunks) => (
        <Link href="/giris" className="font-semibold underline underline-offset-2">
          {chunks}
        </Link>
      ),
    });
  }
  return t(messageKey);
}

interface V2ToolWorkbenchProps {
  /** The one tool this page runs. Nothing inside the page switches it (T-125): each tool has its
   *  own URL, so a switch would show the area tool under `/araclar/mesafe-olcme`. */
  mode: ToolMode;
  provincePoints?: readonly ProvincePoint[];
  provinceAreas?: readonly ProvinceArea[];
  downloadName?: string;
}

export function V2ToolWorkbench({
  mode,
  provincePoints = [],
  provinceAreas = [],
  downloadName = "cografya-olcum",
}: V2ToolWorkbenchProps) {
  // Read from the same namespace `MapAttribution` does, so the exported image and the on-screen
  // credit cannot drift apart — see `handleExportPng`.
  const tMap = useTranslations("Map");
  const t = useTranslations("ToolWorkbench");
  // `useLocale()` is typed as a plain string; the routing config only ever hands it one of these.
  const locale = useLocale() as Locale;
  // The same tags `lib/text/format-date.ts` uses, so numbers and dates agree on one page.
  const numberLocale = locale === "en" ? "en-GB" : "tr-TR";
  // The letters a typed coordinate may end in and the DMS readout prints: K/G/D/B in Turkish,
  // N/S/E/W in English. The parser takes them as data, so each locale reads its own input.
  const cardinals = React.useMemo<CardinalLetters>(
    () => ({
      north: t("cardinalNorth"),
      south: t("cardinalSouth"),
      east: t("cardinalEast"),
      west: t("cardinalWest"),
    }),
    [t],
  );
  const activeTool = mode;
  const [points, setPoints] = React.useState<PointWithSvg[]>([]);
  const [hoveredPos, setHoveredPos] = React.useState<{
    x: number;
    y: number;
    geo: GeoPoint;
  } | null>(null);
  const [copied, setCopied] = React.useState<boolean>(false);
  const [selectedProvinceCode, setSelectedProvinceCode] = React.useState<string>("");
  const [manualCoordText, setManualCoordText] = React.useState<string>("");
  const [manualCoordError, setManualCoordError] = React.useState<string | null>(null);

  // Save measurements (Cloud-persisted via /api/measurements)
  const [authState] = useAuthSession();
  const [saveTitle, setSaveTitle] = React.useState<string>("");
  const [savedList, setSavedList] = React.useState<readonly MeasurementRecord[]>([]);
  // The list is fetched once per sign-in and again on each retry (`listReloadKey`). `listLoad`
  // records which attempt last settled and whether it worked, so a failed first load can show an
  // error with a retry instead of an empty space that looks like "you have no measurements".
  const [listReloadKey, setListReloadKey] = React.useState(0);
  const [listLoad, setListLoad] = React.useState<{
    readonly key: number;
    readonly ok: boolean;
  } | null>(null);
  const [deleteFailure, setDeleteFailure] = React.useState<DeleteMeasurementErrorCode | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  // State flips on the next render; the ref closes the window in which a second click could
  // still reach the handler before the button disables.
  const saveInFlightRef = React.useRef(false);
  // A failure is pinned to the exact points array and type it was about. Any edit (a new point,
  // undo, clear, a preset, a tool switch) replaces `points` or the type, so the message goes away
  // without an effect having to watch for it.
  const [saveFailure, setSaveFailure] = React.useState<{
    readonly code: SaveMeasurementErrorCode;
    readonly points: readonly PointWithSvg[];
    readonly type: MeasurementType;
  } | null>(null);
  // The idempotency key of the last attempt, reused when the same unchanged measurement is
  // retried: a save that timed out on the client may still have landed, and the api answers a
  // replayed `clientMeasurementId` with the existing row instead of a duplicate.
  const pendingSaveRef = React.useRef<{
    readonly id: string;
    readonly points: readonly PointWithSvg[];
    readonly type: MeasurementType;
    readonly title: string;
  } | null>(null);
  const tMeasurements = useTranslations("Measurements");
  const saveHintId = React.useId();
  const measurementType: MeasurementType =
    activeTool === "distance" ? "distance" : activeTool === "area" ? "area" : "coordinate";
  // The api refuses an under-count shape (a one-point distance, a two-point area) with a 400, and
  // the BFF refuses more than MEASUREMENT_POINTS_MAX points, so the save button is bound to the
  // same per-type rule instead of failing after the click.
  // T-094: a self-intersecting outline has no area, so the tool shows a warning instead of a
  // number, and the same reading refuses to save, copy or export that shape.
  const areaReading = React.useMemo(
    () => (activeTool === "area" ? readRingArea(points.map((p) => p.geo)) : null),
    [activeTool, points],
  );
  const isSelfIntersecting = areaReading?.kind === "selfIntersecting";
  const areaKm2 = areaReading?.kind === "area" ? areaReading.km2 : 0;
  const canSave = canSaveMeasurement(measurementType, points.length) && !isSelfIntersecting;
  const pointCountIssue = measurementPointCountIssue(measurementType, points.length);
  const minPointsToSave = MEASUREMENT_MIN_POINTS[measurementType];
  const maxPointsToSave = MEASUREMENT_MAX_POINTS[measurementType];
  const visibleSaveFailure =
    saveFailure !== null && saveFailure.points === points && saveFailure.type === measurementType
      ? saveFailure.code
      : null;

  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = React.useState<number>(1);
  const [panOffset, setPanOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState<boolean>(false);
  const [panStart, setPanStart] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMovedDrag, setHasMovedDrag] = React.useState<boolean>(false);

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  /**
   * The plate AND its credit, which is what goes fullscreen — not the plate alone.
   *
   * These were one ref until the credit moved out of the plate. Keeping the fullscreen target on
   * the plate would have taken the map into fullscreen and left its attribution behind on the
   * page underneath, which is the same licence gap this change exists to close, reappearing in
   * the one view where the map fills the whole screen. `mapContainerRef` stays on the plate
   * because the scale-bar `ResizeObserver` below measures the DRAWING's width, not this box's.
   */
  const landscapeBoxRef = React.useRef<HTMLElement | null>(null);

  // "Tam Ekran / Yatay Mod" (T-015) — fullscreen + best-effort landscape lock for the canvas
  // card itself, so the toolbar, scale bar and zoom cluster all come along.
  const landscape = useLandscapeMode(landscapeBoxRef);

  // Touch pinch-zoom + one-finger pan (T-015). Kept as refs, not state: a pinch/pan gesture
  // fires many times a frame and none of these values are ever read by render — only the
  // mouse-driven `isPanning`/`hasMovedDrag` state (shared with the existing mouse path below,
  // so a touch drag swallows the trailing synthetic click exactly like a mouse drag already
  // does) and `zoomLevel`/`panOffset` themselves need to trigger a re-render.
  const touchPointsRef = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchPinchStartRef = React.useRef<{ dist: number; zoom: number } | null>(null);
  const touchPanLastRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchMaxMoveRef = React.useRef(0);

  /**
   * "Smart region focus" (T-015): pan/zoom the canvas to frame the point(s) just named by
   * VALUE rather than by screen location — an 81-il dropdown pick, a typed coordinate, a
   * quick-scenario preset, or a restored saved measurement. A point placed by CLICKING the
   * map is deliberately excluded (`handleMapClick` never calls this): the player already
   * navigated there themselves, so re-framing under their finger would fight the pan/zoom
   * they just did instead of helping it.
   *
   * Reuses this file's own `currentViewBox` convention (zoomLevel/panOffset around
   * `WORLD_VIEWBOX`) rather than `zoom-pan.ts`'s `viewToIncludeShape` — that helper only ever
   * grows the view to include something already close to visible; here the map is very often
   * still at its 1× national extent and needs an actual zoom-IN, which is exactly what a
   * "fit these points, with padding" computation gives.
   */
  const focusOnMapPoints = React.useCallback((mapPoints: readonly { x: number; y: number }[]) => {
    if (mapPoints.length === 0) return;
    const xs = mapPoints.map((p) => p.x);
    const ys = mapPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // A single point (or a tight cluster) has zero span — floor it to a fraction of the
    // world so "fit the bounds" still produces a sensible close-in zoom instead of infinity.
    const spanX = Math.max(maxX - minX, WORLD_VIEWBOX.w * 0.06);
    const spanY = Math.max(maxY - minY, WORLD_VIEWBOX.h * 0.06);
    const PAD = 1.7; // headroom so the point(s) never sit edge-to-edge against the frame
    const zoomForWidth = WORLD_VIEWBOX.w / (spanX * PAD);
    const zoomForHeight = WORLD_VIEWBOX.h / (spanY * PAD);
    const nextZoom = Math.min(MAX_TOOL_ZOOM, Math.max(1, Math.min(zoomForWidth, zoomForHeight)));
    setZoomLevel(nextZoom);
    setPanOffset({
      x: (minX + maxX) / 2 - (WORLD_VIEWBOX.x + WORLD_VIEWBOX.w / 2),
      y: (minY + maxY) / 2 - (WORLD_VIEWBOX.y + WORLD_VIEWBOX.h / 2),
    });
  }, []);

  // Background context shape
  const trCasing = React.useMemo(() => CONTEXT_SHAPES.find((c) => c.iso === "TR"), []);

  // Pre-parsed province shapes for reverse geocoding
  const provinceShapePolys = React.useMemo(() => {
    return PROVINCE_SHAPES.map((prov) => {
      const rings = parseSubpaths(prov.d);
      return {
        plateCode: prov.plateCode,
        geoName: prov.geoName,
        rings,
      };
    });
  }, []);

  // Container width tracking for responsive scale bar calculation
  const [containerWidth, setContainerWidth] = React.useState(1000);

  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // CSS px per viewBox unit at 1×, for the pins (T-122). Read from the <svg> itself, not the
  // plate: fullscreen reshapes the svg box, and the default `meet` fit scales by the tighter axis.
  const [pxPerUnit, setPxPerUnit] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setPxPerUnit(Math.min(width / WORLD_VIEWBOX.w, height / WORLD_VIEWBOX.h));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load saved measurements from /api/measurements on authenticated mount
  React.useEffect(() => {
    if (authState !== "authenticated") return;
    let active = true;
    const controller = new AbortController();
    fetchMeasurements(controller.signal).then((records) => {
      if (!active) return;
      if (records) setSavedList(records);
      setListLoad({ key: listReloadKey, ok: records !== null });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authState, listReloadKey]);

  // Only this tool's records: loading another tool's shape here would need that tool (T-125).
  const activeSavedList =
    authState === "authenticated"
      ? savedList.filter((record) => record.type === measurementType)
      : [];
  // The last settled load failed. It stays up while a retry runs (the retry button spins), and
  // goes away when one succeeds.
  const listLoadFailed = authState === "authenticated" && listLoad !== null && !listLoad.ok;
  const listRetrying = listLoadFailed && listLoad.key !== listReloadKey;
  const handleRetryList = () => setListReloadKey((key) => key + 1);

  // Calculate live viewBox string based on zoom and pan
  const currentViewBox = React.useMemo(() => {
    const parts = TR_CONTEXT_VIEWBOX.split(" ").map(Number);
    const baseMinX = parts[0] || -150;
    const baseMinY = parts[1] || -60;
    const baseWidth = parts[2] || 1270;
    const baseHeight = parts[3] || 580;

    const zoomedWidth = baseWidth / zoomLevel;
    const zoomedHeight = baseHeight / zoomLevel;

    // Center zoom on current pan
    const centerX = baseMinX + baseWidth / 2 + panOffset.x;
    const centerY = baseMinY + baseHeight / 2 + panOffset.y;

    const curMinX = centerX - zoomedWidth / 2;
    const curMinY = centerY - zoomedHeight / 2;

    return `${curMinX} ${curMinY} ${zoomedWidth} ${zoomedHeight}`;
  }, [zoomLevel, panOffset]);

  // Convert mouse screen client coordinates to SVG map coordinate space
  const screenToMap = React.useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!svgRef.current) return null;
      const svg = svgRef.current;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    },
    [],
  );

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev * 1.5, 8));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev / 1.5, 1);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setHasMovedDrag(false);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = screenToMap(e.clientX, e.clientY);
    if (coords) {
      const geo = unprojectMapPoint(coords);
      setHoveredPos({ x: coords.x, y: coords.y, geo });
    }

    if (isPanning && zoomLevel > 1) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setHasMovedDrag(true);
      }

      // Convert delta pixels to SVG units scale
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const parts = currentViewBox.split(" ").map(Number);
        const curWidth = parts[2] || 1270;
        const scaleX = curWidth / rect.width;
        setPanOffset((prev) => ({
          x: prev.x - dx * scaleX,
          y: prev.y - dy * scaleX,
        }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // --- Touch pinch-zoom + one-finger pan (T-015) ---------------------------------------
  // Filtered to `pointerType === "touch"` throughout: mouse input keeps using the handlers
  // above unchanged (a mouse click ALSO fires a `pointerdown`, so without this guard every
  // mouse gesture would run twice). Pen input is deliberately left alone too — the mouse
  // handlers already cover it, and this tool has no pen-specific gesture to add.
  const handleTouchPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touchMaxMoveRef.current = 0;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (touchPointsRef.current.size === 1) {
      touchPanLastRef.current = { x: e.clientX, y: e.clientY };
      touchPinchStartRef.current = null;
    } else if (touchPointsRef.current.size === 2) {
      const [a, b] = [...touchPointsRef.current.values()];
      if (a && b) {
        touchPinchStartRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomLevel };
        touchPanLastRef.current = null; // suspend one-finger pan while pinching
      }
    }
  };

  const handleTouchPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    if (!touchPointsRef.current.has(e.pointerId)) return;
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const start = touchStartPosRef.current;
    if (start) {
      touchMaxMoveRef.current = Math.max(
        touchMaxMoveRef.current,
        moveDistance(e.clientX - start.x, e.clientY - start.y),
      );
    }

    // Two fingers: pinch-zoom, anchored at the pinch's own midpoint — reuses `zoomFromPinch`
    // (the ratio) and `zoomAtPoint`-equivalent anchoring via `viewOfZoomPan`/`zoomPanOfView`
    // rather than re-deriving either from raw touch deltas.
    const pinch = touchPinchStartRef.current;
    if (pinch && touchPointsRef.current.size >= 2) {
      const [a, b] = [...touchPointsRef.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.dist > 0) {
        const targetZoom = Math.min(
          MAX_TOOL_ZOOM,
          Math.max(1, zoomFromPinch(pinch.zoom, pinch.dist, dist)),
        );
        const svg = svgRef.current;
        const view = viewOfZoomPan(zoomLevel, panOffset, WORLD_VIEWBOX);
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const fx = rect.width > 0 ? (midX - rect.left) / rect.width : 0.5;
          const fy = rect.height > 0 ? (midY - rect.top) / rect.height : 0.5;
          // World-space point under the pinch midpoint, held stationary as the view resizes
          // around it — the same anchoring `zoomAtPoint` does for wheel/pinch on the game map.
          const anchorX = view.x + fx * view.w;
          const anchorY = view.y + fy * view.h;
          const nextW = WORLD_VIEWBOX.w / targetZoom;
          const nextH = WORLD_VIEWBOX.h / targetZoom;
          const nextView = clampPan(
            { x: anchorX - fx * nextW, y: anchorY - fy * nextH, w: nextW, h: nextH },
            WORLD_VIEWBOX,
          );
          const next = zoomPanOfView(nextView, WORLD_VIEWBOX);
          setZoomLevel(next.zoomLevel);
          setPanOffset(next.panOffset);
        } else {
          setZoomLevel(targetZoom);
        }
      }
      setHasMovedDrag(true); // a pinch must never also register as a tap-to-add-point
      return;
    }

    // One finger: pan, gated to zoomed-in exactly like the mouse path above (at 1× there is
    // nothing to pan to, and a single touch is a candidate tap-to-add-point instead).
    const last = touchPanLastRef.current;
    if (!last || zoomLevel <= 1) return;
    if (touchMaxMoveRef.current < CLICK_MOVE_THRESHOLD_PX) return; // still a candidate tap
    setHasMovedDrag(true);
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dxClient = e.clientX - last.x;
    const dyClient = e.clientY - last.y;
    const view = viewOfZoomPan(zoomLevel, panOffset, WORLD_VIEWBOX);
    const worldPerPxX = view.w / rect.width;
    const worldPerPxY = view.h / rect.height;
    const nextView = clampPan(
      { ...view, x: view.x - dxClient * worldPerPxX, y: view.y - dyClient * worldPerPxY },
      WORLD_VIEWBOX,
    );
    setPanOffset(zoomPanOfView(nextView, WORLD_VIEWBOX).panOffset);
    touchPanLastRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleTouchPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    touchPointsRef.current.delete(e.pointerId);
    if (touchPointsRef.current.size < 2) touchPinchStartRef.current = null;
    if (touchPointsRef.current.size === 1) {
      // Lifting one finger of a pinch: keep going, panning with whichever finger remains.
      const remaining = [...touchPointsRef.current.values()][0];
      touchPanLastRef.current = remaining ?? null;
      return;
    }
    if (touchPointsRef.current.size === 0) {
      touchPanLastRef.current = null;
      touchStartPosRef.current = null;
      // A real tap (never crossed the movement threshold) must still add a point: the
      // browser synthesizes a `click` after a touch that called no `preventDefault`, which
      // is exactly what `handleMapClick` below is already wired to receive via `onClick`.
    }
  };

  // Map Click to Add Point
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (hasMovedDrag) {
      setHasMovedDrag(false);
      return;
    }
    const coords = screenToMap(e.clientX, e.clientY);
    if (!coords) return;

    const geo = unprojectMapPoint(coords);

    if (activeTool === "coordinates") {
      setPoints([
        { svgX: coords.x, svgY: coords.y, geo, label: t("selectedPoint"), source: "map" },
      ]);
    } else {
      const label = t("pointLabel", { index: points.length + 1 });
      setPoints((prev) => [...prev, { svgX: coords.x, svgY: coords.y, geo, label, source: "map" }]);
    }
  };

  // Undo last point
  const handleUndo = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  // Clear all points
  const handleClear = () => {
    setPoints([]);
  };

  // Add province center from 81-il dropdown
  const handleAddProvince = () => {
    if (!selectedProvinceCode) return;
    const prov =
      provincePoints.find((p) => p.plateCode === selectedProvinceCode) ||
      PROVINCE_SHAPES.find((p) => p.plateCode === selectedProvinceCode);

    if (!prov) return;

    let geo: GeoPoint;
    if ("point" in prov) {
      geo = prov.point;
    } else {
      // Approximate fallback from polygon bounds center
      const rings = parseSubpaths(prov.d);
      const firstPt = rings[0]?.[0] || { x: 500, y: 200 };
      geo = unprojectMapPoint(firstPt);
    }

    const mapPt = projectToMapPoint(geo.lon, geo.lat);
    const label = ("nameTr" in prov ? prov.nameTr : prov.geoName) || t("provinceCentreFallback");
    const newPoint: PointWithSvg = { svgX: mapPt.x, svgY: mapPt.y, geo, label, source: "dropdown" };

    // Smart region focus (T-015): the province was picked by NAME from a list, not by tapping
    // the map, so the canvas has no reason yet to be looking anywhere near it.
    const nextPoints = activeTool === "coordinates" ? [newPoint] : [...points, newPoint];
    setPoints(nextPoints);
    focusOnMapPoints(nextPoints.map((p) => ({ x: p.svgX, y: p.svgY })));
    setSelectedProvinceCode("");
  };

  // Add coordinate manually from text input
  const handleAddManualCoord = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setManualCoordError(null);
    if (!manualCoordText.trim()) return;

    const parsed = parseLatLon(manualCoordText, cardinals);
    if (!parsed.ok) {
      if (parsed.reason === "latitudeOutOfRange") {
        setManualCoordError(t("coordErrorLatitude"));
      } else if (parsed.reason === "longitudeOutOfRange") {
        setManualCoordError(t("coordErrorLongitude"));
      } else {
        setManualCoordError(t("coordErrorUnreadable"));
      }
      return;
    }

    const geo = parsed.point;
    const mapPt = projectToMapPoint(geo.lon, geo.lat);
    const label = t("manualPoint", {
      lat: formatNumber(geo.lat, locale, 2),
      lon: formatNumber(geo.lon, locale, 2),
    });
    const newPoint: PointWithSvg = { svgX: mapPt.x, svgY: mapPt.y, geo, label, source: "manual" };

    // Smart region focus (T-015): a typed coordinate has no on-screen anchor at all until
    // the canvas moves to it.
    const nextPoints = activeTool === "coordinates" ? [newPoint] : [...points, newPoint];
    setPoints(nextPoints);
    focusOnMapPoints(nextPoints.map((p) => ({ x: p.svgX, y: p.svgY })));
    setManualCoordText("");
  };

  // Fix / Sort self-intersecting polygon into convex/star-convex order
  const handleSortConvexOrder = () => {
    if (points.length < 3) return;
    // Calculate centroid
    const sumX = points.reduce((acc, p) => acc + p.svgX, 0);
    const sumY = points.reduce((acc, p) => acc + p.svgY, 0);
    const cx = sumX / points.length;
    const cy = sumY / points.length;

    // Sort by polar angle around centroid
    const sorted = [...points].sort((a, b) => {
      const angleA = Math.atan2(a.svgY - cy, a.svgX - cx);
      const angleB = Math.atan2(b.svgY - cy, b.svgX - cx);
      return angleA - angleB;
    });

    setPoints(
      sorted.map((p, idx) => ({
        ...p,
        label: t("vertexLabel", { index: idx + 1 }),
      })),
    );
  };

  // Ready-made examples (T-125): this tool's own list only, so a preset never changes the tool.
  // Smart region focus (T-015): each ends by framing the example's own points — it is picked by
  // name ("İstanbul - Ankara") with no map location behind it yet.
  const loadPreset = (preset: ToolPreset) => {
    const loaded = preset.points.map((p, idx): PointWithSvg => {
      const pt = projectToMapPoint(p.lon, p.lat);
      return {
        svgX: pt.x,
        svgY: pt.y,
        geo: { lat: p.lat, lon: p.lon },
        label: p.labelKey ? t(p.labelKey) : t("vertexLabel", { index: idx + 1 }),
        mapLabel: p.mapLabelKey ? t(p.mapLabelKey) : undefined,
        source: "preset",
      };
    });
    setPoints(loaded);
    focusOnMapPoints(loaded.map((p) => ({ x: p.svgX, y: p.svgY })));
  };

  // Calculations
  const geoPoints = React.useMemo(() => points.map((p) => p.geo), [points]);
  const pinCentres = React.useMemo(() => points.map((p) => ({ x: p.svgX, y: p.svgY })), [points]);

  const distanceKm = React.useMemo(() => {
    if (activeTool === "distance" && geoPoints.length >= 2) {
      return polylineLengthKm(geoPoints);
    }
    return 0;
  }, [activeTool, geoPoints]);

  const perimeterKm = React.useMemo(() => {
    if (activeTool === "area" && geoPoints.length >= 3) {
      return ringPerimeterKm(geoPoints) || 0;
    }
    return 0;
  }, [activeTool, geoPoints]);

  // Point-in-province detection (Reverse Geocoding)
  const detectedProvince = (() => {
    if (activeTool !== "coordinates" || points.length === 0) return null;
    const pt = points[0];
    if (!pt) return null;

    const shapePt: ShapePoint = { x: pt.svgX, y: pt.svgY };
    for (const prov of provinceShapePolys) {
      if (prov.rings.some((ring) => pointInPolygon(shapePt, ring))) {
        // Find slug if available
        const matchedArea = provinceAreas.find((a) => a.plateCode === prov.plateCode);
        return {
          plateCode: prov.plateCode,
          name: prov.geoName,
          slug: matchedArea?.slug || prov.geoName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        };
      }
    }
    return null;
  })();

  // 81 Provinces select options for CustomSelect
  const provinceOptions = React.useMemo(() => {
    return PROVINCE_SHAPES.map((prov) => ({
      value: prov.plateCode,
      label: `${prov.plateCode} - ${prov.geoName}`,
      description: prov.geoName,
    }));
  }, []);

  // Scale Bar calculation adapting to zoom level dynamically (Fixed to viewport center latitude, not cursor)
  const dynamicScaleBar = React.useMemo(() => {
    const parts = currentViewBox.split(" ").map(Number);
    const viewWidthUnits = parts[2] || 1270;
    const centerLat = 39.0;
    return scaleBarKm(viewWidthUnits, containerWidth, centerLat, 0.22);
  }, [currentViewBox, containerWidth]);

  // Convert decimal to DMS (Degrees Minutes Seconds)
  const toDms = (val: number, isLat: boolean) => {
    const parts = toDmsParts(val, isLat ? "lat" : "lon", 1);
    const dir = cardinals[parts.cardinal];
    return `${parts.degrees}° ${parts.minutes}' ${formatNumber(parts.seconds, locale)}" ${dir}`;
  };

  // Safe clipboard copy
  const handleCopy = async () => {
    if (isSelfIntersecting) return;
    let text = "";
    if (activeTool === "distance") {
      text = t("copyDistance", {
        km: formatNumber(distanceKm, locale, 2),
        nauticalMiles: formatNumber(distanceKm / 1.852, locale, 1),
        count: points.length,
      });
    } else if (activeTool === "area") {
      text = t("copyArea", {
        area: formatNumber(areaKm2, locale, 1),
        hectares: formatNumber(areaKm2 * 100, locale, 0),
        perimeter: formatNumber(perimeterKm, locale, 1),
      });
    } else if (activeTool === "coordinates" && points[0]) {
      const p = points[0].geo;
      const provInfo = detectedProvince ? t("copyProvince", { name: detectedProvince.name }) : "";
      text =
        t("copyCoordinate", {
          lat: formatNumber(p.lat, locale, 4),
          lon: formatNumber(p.lon, locale, 4),
          latDms: toDms(p.lat, true),
          lonDms: toDms(p.lon, false),
        }) + provInfo;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback failed silently
    }
  };

  // Save measurement to cloud archive (/api/measurements)
  const handleSaveMeasurement = async () => {
    if (!canSave) return;
    if (saveInFlightRef.current) return;

    if (authState !== "authenticated") {
      requestAuth("measurement");
      return;
    }

    const title =
      saveTitle.trim() ||
      t(
        activeTool === "distance"
          ? "defaultTitleDistance"
          : activeTool === "area"
            ? "defaultTitleArea"
            : "defaultTitleCoordinates",
      );

    saveInFlightRef.current = true;
    setIsSaving(true);
    setSaveFailure(null);
    setSaveSuccess(false);
    try {
      const pending = pendingSaveRef.current;
      const clientMeasurementId =
        pending !== null &&
        pending.points === points &&
        pending.type === measurementType &&
        pending.title === title
          ? pending.id
          : crypto.randomUUID();
      pendingSaveRef.current = { id: clientMeasurementId, points, type: measurementType, title };

      const res = await saveMeasurement({
        type: measurementType,
        points: points.map((p) => ({ lon: p.geo.lon, lat: p.geo.lat })),
        title,
        clientMeasurementId,
      });
      if (res.ok) {
        pendingSaveRef.current = null;
        // A replayed id returns the row the first attempt already created; never list it twice.
        setSavedList((prev) => [
          res.measurement,
          ...prev.filter((item) => item.id !== res.measurement.id).slice(0, 19),
        ]);
        setSaveTitle("");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        setSaveFailure({ code: res.code, points, type: measurementType });
      }
    } catch {
      // `saveMeasurement` never throws; `crypto.randomUUID` does outside a secure context.
      setSaveFailure({ code: "failed", points, type: measurementType });
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  // Restore saved measurement
  const handleLoadSaved = (record: MeasurementRecord) => {
    const restored = record.points.map((p) => {
      const pt = projectToMapPoint(p.lon, p.lat);
      return {
        svgX: pt.x,
        svgY: pt.y,
        geo: { lon: p.lon, lat: p.lat },
        label: t("latLonCompact", {
          lat: formatNumber(p.lat, locale, 2),
          lon: formatNumber(p.lon, locale, 2),
        }),
        source: "preset" as const,
      };
    });
    setPoints(restored);
    // Smart region focus (T-015): a restored measurement can be anywhere on the map, and
    // until now this action never moved the canvas at all — reopening one made for a
    // distant area silently showed nothing.
    focusOnMapPoints(restored.map((p) => ({ x: p.svgX, y: p.svgY })));
  };

  // Delete saved measurement
  const handleDeleteSaved = async (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setDeleteFailure(null);
    const res = await removeMeasurement(id);
    if (res.ok) {
      setSavedList((prev) => prev.filter((item) => item.id !== id));
    } else {
      setDeleteFailure(res.code);
    }
  };

  // PNG Export Handler
  const handleExportPng = () => {
    if (isSelfIntersecting) return;
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 730;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // ATTRIBUTION, and it has to be the real one.
      //
      // This line used to read "Coğrafya Gurmesi · WGS84 / MEB & MTA Tabanlı Ölçüm". Neither MEB
      // nor MTA supplies anything here — the measurement is WGS84 haversine/L'Huilier arithmetic
      // in `lib/map/`, and `grep -rn 'MEB\|MTA' lib/map lib/tools` finds nothing. So it credited
      // two institutions that contributed no data, while omitting the two whose licences ask to
      // be credited: this canvas rasterises `PROVINCE_SHAPES` (OpenStreetMap, ODbL) and
      // `INLAND_WATER_SHAPES` (OSM plus JRC Global Surface Water).
      //
      // The export is the case that matters most for ODbL, not least: the PNG leaves the site.
      // A credit that is only on the page does not travel with the file a student puts in a
      // homework folder or a slide.
      //
      // Strings come from the `Map` namespace that `MapAttribution` renders on screen, so the
      // two cannot drift; the JRC citation stays in English because it is published verbatim.
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        `Coğrafya Gurmesi · ${tMap("attributionProvinceLabel")} ${tMap("attribution")} · ${tMap("attributionJrcEnglish")}`,
        20,
        canvas.height - 20,
      );

      const link = document.createElement("a");
      link.download = `${downloadName}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="space-y-6">
      {/* 2. FULL-WIDTH 12-COLUMN INTERACTIVE MAP CANVAS WITH INTEGRATED TOOLBAR */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
        {/* Map Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Navigation className="size-3.5" />}>
              {activeTool === "distance" && t("canvasDistance")}
              {activeTool === "coordinates" && t("canvasCoordinates")}
              {activeTool === "area" && t("canvasArea")}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">
              {activeTool === "distance" && t("canvasHintDistance")}
              {activeTool === "coordinates" && t("canvasHintCoordinates")}
              {activeTool === "area" && t("canvasHintArea")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Mouse Coordinates */}
            {hoveredPos && (
              <span className="text-[11px] font-mono bg-muted/60 px-2.5 py-1 rounded-lg text-foreground border border-border/60">
                {t("latLon", {
                  lat: formatNumber(hoveredPos.geo.lat, locale, 3),
                  lon: formatNumber(hoveredPos.geo.lon, locale, 3),
                })}
              </span>
            )}

            {/* Undo / Clear */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={points.length === 0}
              leftIcon={<Undo2 className="size-3.5" />}
            >
              {t("undo")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={points.length === 0}
              leftIcon={<Trash2 className="size-3.5 text-destructive" />}
            >
              {t("clear")}
            </Button>

            {/* PNG Export Button */}
            {/* The one place in this repo a Tooltip is the right answer (T-036). The button
                already has a visible name ("PNG İndir"); the `title` was an EXPLANATION of
                what it does, which is `aria-describedby` semantics — exactly what Tooltip
                wires. `title` never appears on keyboard focus and never on touch, so that
                explanation reached a mouse user only. Everywhere else in this sweep a `title`
                WAS the accessible name, and those got `aria-label` instead: Tooltip wires
                `aria-describedby`, not `aria-labelledby`, so using it there would have left
                an unnamed button unnamed. */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPng}
                      disabled={points.length === 0 || isSelfIntersecting}
                      leftIcon={<Download className="size-3.5 text-primary" />}
                    >
                      {t("downloadPng")}
                    </Button>
                  }
                />
                <TooltipContent>{t("downloadPngHint")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Quick Scenario Preset Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="font-semibold text-muted-foreground shrink-0">{t("presetsLabel")}</span>
          {TOOL_PRESETS[mode].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => loadPreset(preset)}
              className={`px-2.5 py-1 rounded-lg bg-muted/70 text-foreground transition-colors shrink-0 cursor-pointer ${PRESET_CHIP_HOVER[mode]}`}
            >
              {t(preset.labelKey)}
            </button>
          ))}
        </div>

        {/* Interactive SVG Canvas Container with Zero Top/Bottom Gaps, and its caption.
            ONE BOX, so the 8px between map and credit states the caption relationship instead of
            inheriting whatever `space-y-*` the surrounding container runs — and so fullscreen
            carries the credit with the map. */}
        {/* A map and the line that credits it are a FIGURE and its CAPTION — the relationship
            `v2-province-locator-map.tsx` has always expressed and the other six did not, so a
            screen reader heard a figure caption on a province page and a loose paragraph here.
            `m-0` because a `<figure>` carries a UA margin a `<div>` does not. */}
        <figure
          className="m-0 space-y-2"
          ref={landscapeBoxRef}
          style={landscape.active ? LANDSCAPE_FILL : undefined}
        >
          <div
            ref={mapContainerRef}
            className="relative w-full aspect-[1270/580] rounded-2xl bg-[var(--map-plate)] border border-border/80 overflow-hidden shadow-inner flex items-center justify-center select-none"
            style={landscape.active ? LANDSCAPE_PLATE : undefined}
          >
            {/* Fullscreen / landscape toggle — ONE control for both directions, kept INSIDE
              this container rather than in the toolbar above: once the real Fullscreen API
              engages, only this element's own subtree stays on screen, so an "exit" control
              living in the toolbar would be unreachable (T-015). */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg">
              <button
                type="button"
                onClick={landscape.toggle}
                aria-pressed={landscape.active}
                aria-label={landscape.active ? t("fullscreenExit") : t("fullscreenEnter")}
                className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                {landscape.active ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </button>
            </div>

            {/* "Rotate your phone" (T-015) — only once landscape mode is on, the device is
              STILL portrait (no orientation-lock support, e.g. iOS Safari), and the pointer
              is coarse. Lives inside this same container for the identical reason as the
              toggle button above: it must stay visible under a real Fullscreen session. */}
            {landscape.showRotateHint && (
              <div
                role="status"
                aria-live="polite"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[92%] flex items-center gap-2.5 bg-ink-dark/95 text-white px-3.5 py-2 rounded-2xl shadow-2xl text-xs"
              >
                <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
                <span>{t("rotateHint")}</span>
                <button
                  type="button"
                  onClick={landscape.exit}
                  className="shrink-0 px-2 py-1 rounded-lg border border-white/40 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {t("rotateDismiss")}
                </button>
              </div>
            )}

            {/* Absolute Floating Self-Intersection Warning Banner (Zero Layout Shift) */}
            {isSelfIntersecting && (
              <div
                role="alert"
                className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[95%] sm:max-w-md bg-warning text-warning-foreground px-3.5 py-1.5 rounded-2xl border border-warning-foreground/25 shadow-2xl flex items-center justify-between gap-2.5 text-xs pointer-events-auto animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span className="text-[11px] truncate">
                    {t.rich("selfIntersectBanner", {
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSortConvexOrder}
                  className="px-2.5 py-1 rounded-xl bg-warning-foreground text-warning text-[11px] font-bold hover:bg-warning-foreground/90 transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="size-3" />
                  <span>{t("sortOutline")}</span>
                </button>
              </div>
            )}

            {/* Zoom & Pan Overlay Controls */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg">
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 8}
                className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={t("zoomIn")}
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={t("zoomOut")}
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                disabled={zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0}
                className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={t("zoomReset")}
              >
                <RotateCcw className="size-4" />
              </button>
            </div>

            {/* Dynamic Metric Scale Bar (Çizgi Ölçek - V1 Klasik Kartografik Standart) */}
            {dynamicScaleBar && (
              <div
                className="absolute bottom-3 left-3 z-30 bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 shadow-md pointer-events-none flex flex-col gap-1 text-xs select-none"
                aria-label={t("scaleBarAria", { km: formatNumber(dynamicScaleBar.km, locale) })}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-foreground font-mono leading-none">
                  <span>0</span>
                  <span>{formatNumber(dynamicScaleBar.km, locale)} km</span>
                </div>
                <div
                  className="h-1.5 border-x-2 border-b-2 border-foreground"
                  style={{
                    width: `${Math.max(36, Math.min(Math.round(dynamicScaleBar.px), 240))}px`,
                  }}
                />
              </div>
            )}

            {/* SVG Map */}
            <svg
              ref={svgRef}
              viewBox={currentViewBox}
              className={`w-full h-full object-fill ${isPanning ? "cursor-grabbing" : "cursor-crosshair"} ${
                // Zoomed in, the map itself owns one-finger dragging (pan); at 1× a vertical
                // swipe over the map should still scroll the PAGE, and `pan-y` is what leaves
                // that native behaviour intact while still suppressing the browser's own
                // pinch-zoom (T-015) — our pinch handler above replaces it.
                zoomLevel > 1 ? "touch-none" : "touch-pan-y"
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleMapClick}
              onPointerDown={handleTouchPointerDown}
              onPointerMove={handleTouchPointerMove}
              onPointerUp={handleTouchPointerUp}
              onPointerCancel={handleTouchPointerUp}
              aria-label={t("mapAria")}
            >
              {/* Background neighbor lands. `--map-context-land`, NOT `--map-land`: the country
                fill here is `fill-card/90` over `--map-plate`, and `--map-land` against that
                blend measures 1.02:1 light / 1.01:1 dark -- Türkiye and its neighbours were
                one tone, while the other five Türkiye maps kept the warm/white split this
                token exists for. Bound to it the step is 1.15:1 light / 1.16:1 dark, and the
                hairline moves with the fill to `--map-context-line` (3.28:1 / 3.18:1 on that
                neighbour land, 3.05:1 / 3.54:1 on the `--map-plate` it also borders), leaving
                `--province-stroke` to Türkiye's own coast. */}
              {CONTEXT_SHAPES.map((country) => (
                <path
                  key={country.iso}
                  d={country.d}
                  className="fill-[var(--map-context-land)] stroke-[var(--map-context-line)] stroke-[0.8]"
                />
              ))}

              {/* Turkey Context Casing Outline */}
              {trCasing && (
                <path
                  d={trCasing.d}
                  className="fill-none stroke-border/70 stroke-[2] pointer-events-none"
                />
              )}

              {/* 81 Turkish Provinces Base Layer (Hover highlight removed per feedback) */}
              {PROVINCE_SHAPES.map((prov) => (
                <path
                  key={prov.plateCode}
                  d={prov.d}
                  className="fill-card/90 stroke-border/60 stroke-[0.6]"
                >
                  <title>{prov.geoName}</title>
                </path>
              ))}

              {/* Inland Lakes & Waters. Painted AFTER the province layer above (not before, as
                it was originally) because SVG paints in document order and the province
                layer's fill-card/90 is ~90% opaque: with the lakes underneath, that fill
                covered them almost entirely in both themes, independent of colour -- the same
                inversion `v2-earthquake-explorer.tsx` carried until Task 7.

                `pointer-events-none` is not load-bearing HERE — this screen's click handler is
                `onClick={handleMapClick}` on the <svg> itself and reads `e.clientX/clientY`, not
                `e.target`, so a click over a lake still bubbles to it and still measures. It is
                set anyway so the attribute is an invariant of this layer rather than a per-file
                judgement: the play board next door has a PER-PATH handler and lost answers to
                exactly this (see `v2-game-screen.tsx`), and
                `components/v2/inland-water-hit-testing.test.ts` now holds it on every render
                site in the tree. */}
              {INLAND_WATER_SHAPES.map((water) => (
                <path
                  key={water.id}
                  d={water.d}
                  className="fill-[var(--map-sea)] stroke-[var(--map-water-line)] stroke-[0.5] pointer-events-none"
                />
              ))}

              {/* Drawn Area Polygon */}
              {activeTool === "area" && points.length >= 3 && (
                <polygon
                  points={points.map((p) => `${p.svgX},${p.svgY}`).join(" ")}
                  className="fill-accent/25 stroke-accent"
                  strokeWidth={2.5 / zoomLevel}
                  strokeDasharray="4 2"
                />
              )}

              {/* Drawn Distance Polyline */}
              {activeTool === "distance" && points.length >= 2 && (
                <polyline
                  points={points.map((p) => `${p.svgX},${p.svgY}`).join(" ")}
                  fill="none"
                  stroke="var(--color-primary, #b0522e)"
                  strokeWidth={3 / zoomLevel}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Placed Waypoints Pins */}
              {points.map((p, idx) => {
                const gap = atScreenSize(PIN_RADIUS + PIN_LABEL_GAP, zoomLevel, pxPerUnit);
                const label =
                  PIN_LABEL_LAYOUT[pinLabelPlacement(pinCentres[idx]!, pinCentres).side];
                return (
                  <g key={idx} className="transition-transform">
                    <circle
                      cx={p.svgX}
                      cy={p.svgY}
                      r={atScreenSize(PIN_RADIUS, zoomLevel, pxPerUnit)}
                      strokeWidth={atScreenSize(PIN_OUTLINE, zoomLevel, pxPerUnit)}
                      className="fill-primary stroke-white dark:stroke-black shadow-md"
                    />
                    <text
                      x={p.svgX + label.dx * gap}
                      y={p.svgY + label.dy * gap}
                      textAnchor={label.anchor}
                      dominantBaseline={label.baseline}
                      fontSize={atScreenSize(PIN_LABEL_SIZE, zoomLevel, pxPerUnit)}
                      fontWeight="bold"
                      fill="currentColor"
                      strokeWidth={atScreenSize(PIN_LABEL_HALO, zoomLevel, pxPerUnit)}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      className="fill-foreground stroke-card font-sans select-none pointer-events-none"
                    >
                      {p.mapLabel || p.label || idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* UNDER the plate, not in it: the plate is `flex items-center justify-center`, so a
              credit nested inside it becomes a flex sibling of the `<svg>` and takes width the
              map needs — 517px of 1166 on this surface, measured. See
              `v2-map-credit-placement.test.ts`, which reads the tree rather than source order. */}
          <figcaption>
            <MapAttribution inlandWater context />
          </figcaption>
        </figure>
      </div>

      {/* 3. TWO-COLUMN BALANCED DASHBOARD BELOW THE MAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Input Tools (Province Dropdown, Manual Lat/Lon Input, Save Measurement) */}
        <div className="space-y-5">
          {/* A. Point Insertion Tools Card */}
          <div className="p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-primary/10 text-primary">
                  <Plus className="size-4" />
                </span>
                <h4 className="font-heading font-bold text-base text-foreground">
                  {t("pointsCardHeading")}
                </h4>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {t("pointsAdded", { count: points.length })}
              </span>
            </div>

            {/* 81 Province Dropdown Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{t("provinceStepLabel")}</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {t("provinceSource")}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomSelect
                    options={provinceOptions}
                    value={selectedProvinceCode}
                    onChange={setSelectedProvinceCode}
                    placeholder={t("provincePlaceholder")}
                    searchable={true}
                    searchPlaceholder={t("provinceSearchPlaceholder")}
                    emptyLabel={t("provinceSearchEmpty")}
                    aria-label={t("provinceStepAria")}
                  />
                </div>
                <Button
                  variant="primary"
                  className="h-10 px-4 text-xs font-bold text-white shrink-0 shadow-xs"
                  onClick={handleAddProvince}
                  disabled={!selectedProvinceCode}
                >
                  {t("add")}
                </Button>
              </div>
            </div>

            {/* Manual Lat/Lon Text Input */}
            <div className="space-y-2 pt-2 border-t border-border/70">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{t("coordStepLabel")}</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {t("coordFormat")}
                </span>
              </label>
              <form onSubmit={handleAddManualCoord} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={manualCoordText}
                  onChange={(e) => setManualCoordText(e.target.value)}
                  placeholder={t("coordPlaceholder")}
                  aria-describedby={manualCoordError ? "manual-coord-error" : undefined}
                  className="h-10 text-xs font-mono rounded-xl"
                />
                <Button
                  type="submit"
                  variant="emerald"
                  className="h-10 px-4 text-xs font-bold text-white shrink-0 shadow-xs"
                  disabled={!manualCoordText.trim()}
                >
                  {t("add")}
                </Button>
              </form>
              {manualCoordError && (
                <p
                  id="manual-coord-error"
                  role="alert"
                  className="text-[11px] text-destructive font-medium"
                >
                  {manualCoordError}
                </p>
              )}
            </div>

            {/* Save Measurement Form */}
            <div className="space-y-2 pt-2 border-t border-border/70">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{t("saveStepLabel")}</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {t("saveDestination")}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder={tMeasurements("titleLabel")}
                  aria-label={tMeasurements("titleLabel")}
                  maxLength={MEASUREMENT_TITLE_MAX_LENGTH}
                  className="h-10 text-xs rounded-xl"
                />
                <Button
                  variant="primary"
                  className="h-10 px-4 text-xs font-bold text-white shrink-0 shadow-xs"
                  onClick={handleSaveMeasurement}
                  disabled={!canSave}
                  isLoading={isSaving}
                  aria-describedby={canSave ? undefined : saveHintId}
                  leftIcon={
                    saveSuccess ? (
                      <BookmarkCheck className="size-4 text-white" />
                    ) : (
                      <Bookmark className="size-4 text-white" />
                    )
                  }
                >
                  {isSaving
                    ? tMeasurements("savingLabel")
                    : saveSuccess
                      ? tMeasurements("savedLabel")
                      : tMeasurements("saveLabel")}
                </Button>
              </div>
              {!canSave && (
                <p id={saveHintId} className="text-[11px] text-muted-foreground">
                  {isSelfIntersecting
                    ? t("selfIntersectSaveHint")
                    : pointCountIssue === "tooMany"
                      ? tMeasurements("maxPointsHint", { count: maxPointsToSave })
                      : tMeasurements("minPointsHint", { count: minPointsToSave })}
                </p>
              )}
              {visibleSaveFailure && (
                <p role="alert" className="text-[11px] text-destructive font-medium">
                  <MeasurementErrorText messageKey={SAVE_ERROR_MESSAGE_KEY[visibleSaveFailure]} />
                </p>
              )}
              {saveSuccess && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-[11px] text-success-strong font-medium"
                >
                  {tMeasurements("saveSuccess")}
                </p>
              )}
              {authState !== "authenticated" && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {tMeasurements("signInHint")}
                </p>
              )}
            </div>
          </div>

          {/* B. Saved Measurements History List */}
          {(activeSavedList.length > 0 || listLoadFailed) && (
            <div className="p-4 sm:p-5 rounded-3xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-heading font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark className="size-3.5 text-primary" />
                  {/* No count and no "click to load" while a failed load left the list empty:
                      "(0)" would claim there is nothing saved, which is exactly what is unknown. */}
                  <span>
                    {tMeasurements("listHeading")}
                    {activeSavedList.length > 0 && ` (${activeSavedList.length})`}
                  </span>
                </h5>
                {activeSavedList.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {tMeasurements("listLoadHint")}
                  </span>
                )}
              </div>
              {listLoadFailed && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p role="alert" className="text-[11px] text-destructive font-medium">
                    {tMeasurements("listError")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryList}
                    isLoading={listRetrying}
                    leftIcon={<RefreshCw className="size-3.5" />}
                  >
                    {tMeasurements("listRetry")}
                  </Button>
                </div>
              )}
              {deleteFailure && (
                <p role="alert" className="text-[11px] text-destructive font-medium">
                  <MeasurementErrorText messageKey={DELETE_ERROR_MESSAGE_KEY[deleteFailure]} />
                </p>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeSavedList.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if (
                        e.target !== e.currentTarget &&
                        (e.target as HTMLElement).closest("button")
                      ) {
                        return;
                      }
                      handleLoadSaved(item);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleLoadSaved(item);
                      }
                    }}
                    aria-label={tMeasurements("recallAria", {
                      label: item.title || tMeasurements("untitled"),
                    })}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border hover:bg-muted/60 transition-colors cursor-pointer text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground block">
                        {item.title || tMeasurements("untitled")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDay(item.createdAt, locale, "short")} &bull;{" "}
                        {tMeasurements("itemPointCount", { count: item.points.length })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(item.id, e)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={tMeasurements("deleteAria", {
                        label: item.title || tMeasurements("untitled"),
                      })}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Real-Time Telemetry & Output Cards + Waypoint List */}
        <div className="space-y-5">
          {/* A. Live Measurement Telemetry Output Panel */}
          <div className="p-6 rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                {t("outputBadge")}
              </Badge>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  disabled={points.length === 0 || isSelfIntersecting}
                  leftIcon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                >
                  {copied ? t("copied") : t("copySummary")}
                </Button>
              </div>
            </div>

            {/* Distance Output */}
            {activeTool === "distance" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t("distanceTotal")}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-4xl font-extrabold text-primary font-mono">
                      {formatNumber(distanceKm, locale, 1)}
                    </span>
                    <span className="text-lg font-bold text-foreground">km</span>
                  </div>
                  <span className="text-xs text-muted-foreground block font-mono">
                    {t("distanceEquivalents", {
                      meters: (distanceKm * 1000).toLocaleString(numberLocale),
                      nauticalMiles: formatNumber(distanceKm / 1.852, locale, 1),
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
                  <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Plane className="size-3.5 text-primary" />
                      <span>{t("flightTime")}</span>
                    </div>
                    <span className="font-heading font-bold text-sm text-foreground">
                      {t("flightMinutes", { minutes: String(Math.round((distanceKm / 800) * 60)) })}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {t("flightCruise")}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Car className="size-3.5 text-secondary" />
                      <span>{t("roadEstimate")}</span>
                    </div>
                    <span className="font-heading font-bold text-sm text-foreground">
                      ~{formatNumber(distanceKm * 1.28, locale, 0)} km
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {t("roadFactor")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Coordinates Output */}
            {activeTool === "coordinates" && (
              <div className="space-y-4">
                {points[0] ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        {t("decimalDegreesLabel")}
                      </span>
                      <div className="p-3 rounded-xl bg-card border border-border font-mono font-bold text-sm text-foreground">
                        {t("latLon", {
                          lat: formatNumber(points[0].geo.lat, locale, 6),
                          lon: formatNumber(points[0].geo.lon, locale, 6),
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        {t("dmsLabel")}
                      </span>
                      <div className="p-3 rounded-xl bg-card border border-border font-mono text-xs text-foreground">
                        {toDms(points[0].geo.lat, true)} &bull; {toDms(points[0].geo.lon, false)}
                      </div>
                    </div>

                    {/* Detected Province Link (Reverse Geocoding) */}
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          {t("provinceHitLabel")}
                        </span>
                        <span className="font-heading font-bold text-sm text-primary">
                          {detectedProvince
                            ? t("provinceInside", { name: detectedProvince.name })
                            : t("provinceOutside")}
                        </span>
                      </div>
                      {detectedProvince && (
                        <Link
                          href={{
                            pathname: "/turkiye/[slug]",
                            params: { slug: detectedProvince.slug },
                          }}
                        >
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-8 px-3 text-xs font-bold text-white shadow-xs"
                          >
                            {t("provincePage")}
                          </Button>
                        </Link>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                      <span className="text-muted-foreground block font-medium">
                        {t("utmLabel")}
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {t("utmZone", {
                          zone: String(Math.floor((points[0].geo.lon + 180) / 6) + 1),
                        })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    {t("coordinatesEmpty")}
                  </div>
                )}
              </div>
            )}

            {/* Area Output */}
            {activeTool === "area" && (
              <div className="space-y-4">
                {/* T-094: a self-intersecting outline gets a warning IN PLACE of the number, not
                    beside it. The formula would still return a figure (the lobes cancel), and a
                    figure next to a warning still reads as an answer. */}
                {isSelfIntersecting ? (
                  <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 space-y-2 text-xs text-warning-strong">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="size-4 text-warning-strong shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-relaxed">{t("areaSelfIntersect")}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSortConvexOrder}
                      leftIcon={<RefreshCw className="size-3 text-warning-strong" />}
                      className="text-xs h-7 px-2.5 bg-background"
                    >
                      {t("sort")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {t("areaTotal")}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading text-4xl font-extrabold text-accent font-mono">
                        {formatNumber(areaKm2, locale, 1)}
                      </span>
                      <span className="text-lg font-bold text-foreground">km²</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">{t("hectares")}</span>
                    <span className="font-heading font-bold text-sm text-foreground">
                      {isSelfIntersecting
                        ? "—"
                        : t("hectaresValue", {
                            value: (areaKm2 * 100).toLocaleString(numberLocale, {
                              maximumFractionDigits: 0,
                            }),
                          })}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">{t("decares")}</span>
                    <span className="font-heading font-bold text-sm text-foreground">
                      {isSelfIntersecting
                        ? "—"
                        : t("decaresValue", {
                            value: (areaKm2 * 1000).toLocaleString(numberLocale, {
                              maximumFractionDigits: 0,
                            }),
                          })}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border col-span-2">
                    <span className="text-muted-foreground block text-[11px]">
                      {t("perimeter")}
                    </span>
                    <span className="font-heading font-bold text-sm text-foreground font-mono">
                      {formatNumber(perimeterKm, locale, 1)} km
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* B. Points List Summary Card */}
          {points.length > 0 && (
            <div className="p-4 sm:p-5 rounded-3xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-heading font-bold text-xs text-foreground uppercase tracking-wider">
                  {t("pointListHeading", { count: String(points.length) })}
                </h4>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-destructive hover:underline cursor-pointer"
                >
                  {t("clearAll")}
                </button>
              </div>
              <div className="space-y-1.5 text-xs max-h-52 overflow-y-auto pr-1">
                {points.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-foreground">
                        {p.label || t("pointLabel", { index: idx + 1 })}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {t("latLonCompact", {
                        lat: formatNumber(p.geo.lat, locale, 3),
                        lon: formatNumber(p.geo.lon, locale, 3),
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
