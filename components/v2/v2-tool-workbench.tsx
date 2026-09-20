"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { projectToMapPoint } from "@/lib/map/projection";
import {
  unprojectMapPoint,
  polylineLengthKm,
  ringPerimeterKm,
  ringAreaKm2,
  ringSelfIntersects,
  toDmsParts,
  parseLatLon,
  scaleBarKm,
  type GeoPoint,
  type CardinalLetters,
} from "@/lib/map/measure";
import { parseSubpaths, pointInPolygon, type ShapePoint } from "@/lib/map/shape-geometry";
import {
  CLICK_MOVE_THRESHOLD_PX,
  clampPan,
  moveDistance,
  parseViewBox,
  zoomFromPinch,
  type ViewBox,
} from "@/lib/map/zoom-pan";
import { useLandscapeMode } from "@/lib/map/use-landscape-mode.client";
import type { ProvincePoint, ProvinceArea } from "@/lib/tools/province-points";
import type { MeasurementType } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Link } from "@/i18n/navigation";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth } from "@/lib/auth/auth-modal.client";
import {
  fetchMeasurements,
  saveMeasurement,
  removeMeasurement,
  type MeasurementRecord,
} from "@/lib/measurements/client";
import {
  Compass,
  MapPin,
  Layers,
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

export type ToolMode = "distance" | "coordinates" | "area";

export interface PointWithSvg {
  svgX: number;
  svgY: number;
  geo: GeoPoint;
  label?: string;
  source?: "map" | "dropdown" | "manual" | "preset";
}

const TURKISH_CARDINALS: CardinalLetters = {
  north: "K",
  south: "G",
  east: "D",
  west: "B",
};

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

interface V2ToolWorkbenchProps {
  /** If provided, locks the workbench to this specific tool mode (e.g. on dedicated sub-pages). */
  initialMode?: ToolMode;
  lockMode?: boolean;
  provincePoints?: readonly ProvincePoint[];
  provinceAreas?: readonly ProvinceArea[];
  downloadName?: string;
}

export function V2ToolWorkbench({
  initialMode = "distance",
  lockMode = false,
  provincePoints = [],
  provinceAreas = [],
  downloadName = "cografya-olcum",
}: V2ToolWorkbenchProps) {
  // Read from the same namespace `MapAttribution` does, so the exported image and the on-screen
  // credit cannot drift apart — see `handleExportPng`.
  const tMap = useTranslations("Map");
  const [activeTool, setActiveTool] = React.useState<ToolMode>(initialMode);
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
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false);

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
  const landscapeBoxRef = React.useRef<HTMLDivElement | null>(null);

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

  // Load saved measurements from /api/measurements on authenticated mount
  React.useEffect(() => {
    if (authState !== "authenticated") return;
    let active = true;
    const controller = new AbortController();
    fetchMeasurements(controller.signal).then((records) => {
      if (active && records) {
        setSavedList(records);
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authState]);

  const activeSavedList = authState === "authenticated" ? savedList : [];

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
      setPoints([{ svgX: coords.x, svgY: coords.y, geo, label: "Seçili Nokta", source: "map" }]);
    } else {
      const label = `Nokta ${points.length + 1}`;
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
    const label = ("nameTr" in prov ? prov.nameTr : prov.geoName) || "İl Merkezi";
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

    const parsed = parseLatLon(manualCoordText, TURKISH_CARDINALS);
    if (!parsed.ok) {
      if (parsed.reason === "latitudeOutOfRange") {
        setManualCoordError("Enlem değeri geçerli aralıkta (-90° ile +90°) değil.");
      } else if (parsed.reason === "longitudeOutOfRange") {
        setManualCoordError("Boylam değeri geçerli aralıkta (-180° ile +180°) değil.");
      } else {
        setManualCoordError(
          "Koordinat anlaşılamadı. Örnek: '39.92, 32.85' veya '39°55\\'12\"K 32°52\\'D'",
        );
      }
      return;
    }

    const geo = parsed.point;
    const mapPt = projectToMapPoint(geo.lon, geo.lat);
    const label = `Girdi (${geo.lat.toFixed(2)}°, ${geo.lon.toFixed(2)}°)`;
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
        label: `Sınır ${idx + 1}`,
      })),
    );
  };

  // Quick Preset Scenarios
  // Smart region focus (T-015): every branch ends by framing the SCENARIO'S own points —
  // a preset is picked by name ("İstanbul - Ankara") with no map location behind it yet.
  const loadPreset = (type: "ist-ank" | "izm-van" | "tuz-golu" | "van-golu" | "merkez") => {
    if (type === "ist-ank") {
      setActiveTool("distance");
      const istGeo = { lat: 41.0082, lon: 28.9784 };
      const ankGeo = { lat: 39.9334, lon: 32.8597 };
      const istPt = projectToMapPoint(istGeo.lon, istGeo.lat);
      const ankPt = projectToMapPoint(ankGeo.lon, ankGeo.lat);
      setPoints([
        { svgX: istPt.x, svgY: istPt.y, geo: istGeo, label: "İstanbul", source: "preset" },
        { svgX: ankPt.x, svgY: ankPt.y, geo: ankGeo, label: "Ankara", source: "preset" },
      ]);
      focusOnMapPoints([istPt, ankPt]);
    } else if (type === "izm-van") {
      setActiveTool("distance");
      const izmGeo = { lat: 38.4237, lon: 27.1428 };
      const vanGeo = { lat: 38.4891, lon: 43.4089 };
      const izmPt = projectToMapPoint(izmGeo.lon, izmGeo.lat);
      const vanPt = projectToMapPoint(vanGeo.lon, vanGeo.lat);
      setPoints([
        { svgX: izmPt.x, svgY: izmPt.y, geo: izmGeo, label: "İzmir", source: "preset" },
        { svgX: vanPt.x, svgY: vanPt.y, geo: vanGeo, label: "Van", source: "preset" },
      ]);
      focusOnMapPoints([izmPt, vanPt]);
    } else if (type === "tuz-golu") {
      setActiveTool("area");
      const poly = [
        { lat: 39.15, lon: 33.25 },
        { lat: 39.05, lon: 33.65 },
        { lat: 38.65, lon: 33.45 },
        { lat: 38.75, lon: 33.15 },
      ];
      setPoints(
        poly.map((p, idx) => {
          const pt = projectToMapPoint(p.lon, p.lat);
          return { svgX: pt.x, svgY: pt.y, geo: p, label: `Sınır ${idx + 1}`, source: "preset" };
        }),
      );
      focusOnMapPoints(poly.map((p) => projectToMapPoint(p.lon, p.lat)));
    } else if (type === "van-golu") {
      setActiveTool("area");
      const poly = [
        { lat: 38.95, lon: 43.35 },
        { lat: 38.65, lon: 43.65 },
        { lat: 38.35, lon: 43.15 },
        { lat: 38.55, lon: 42.65 },
        { lat: 38.95, lon: 42.95 },
      ];
      setPoints(
        poly.map((p, idx) => {
          const pt = projectToMapPoint(p.lon, p.lat);
          return { svgX: pt.x, svgY: pt.y, geo: p, label: `Sınır ${idx + 1}`, source: "preset" };
        }),
      );
      focusOnMapPoints(poly.map((p) => projectToMapPoint(p.lon, p.lat)));
    } else if (type === "merkez") {
      setActiveTool("coordinates");
      const centerGeo = { lat: 39.14, lon: 34.16 };
      const pt = projectToMapPoint(centerGeo.lon, centerGeo.lat);
      setPoints([
        {
          svgX: pt.x,
          svgY: pt.y,
          geo: centerGeo,
          label: "Türkiye Coğrafi Ağırlık Merkezi (Kırşehir)",
          source: "preset",
        },
      ]);
      focusOnMapPoints([pt]);
    }
  };

  // Calculations
  const geoPoints = React.useMemo(() => points.map((p) => p.geo), [points]);

  const distanceKm = React.useMemo(() => {
    if (activeTool === "distance" && geoPoints.length >= 2) {
      return polylineLengthKm(geoPoints);
    }
    return 0;
  }, [activeTool, geoPoints]);

  const isSelfIntersecting = React.useMemo(() => {
    if (activeTool === "area" && geoPoints.length >= 4) {
      return ringSelfIntersects(geoPoints);
    }
    return false;
  }, [activeTool, geoPoints]);

  const areaKm2 = React.useMemo(() => {
    if (activeTool === "area" && geoPoints.length >= 3) {
      return ringAreaKm2(geoPoints) || 0;
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
    const dir = isLat
      ? parts.cardinal === "north"
        ? "K"
        : "G"
      : parts.cardinal === "east"
        ? "D"
        : "B";
    return `${parts.degrees}° ${parts.minutes}' ${parts.seconds}" ${dir}`;
  };

  // Safe clipboard copy
  const handleCopy = async () => {
    let text = "";
    if (activeTool === "distance") {
      text = `Mesafe: ${distanceKm.toFixed(2)} km (${(distanceKm / 1.852).toFixed(1)} NM) | ${points.length} Nokta`;
    } else if (activeTool === "area") {
      text = `Alan: ${areaKm2.toFixed(1)} km² (${(areaKm2 * 100).toFixed(0)} Hektar) | Çevre: ${perimeterKm.toFixed(1)} km`;
    } else if (activeTool === "coordinates" && points[0]) {
      const p = points[0].geo;
      const provInfo = detectedProvince ? ` | İl: ${detectedProvince.name}` : "";
      text = `Koordinat: ${p.lat.toFixed(4)}° K, ${p.lon.toFixed(4)}° D (${toDms(p.lat, true)}, ${toDms(p.lon, false)})${provInfo}`;
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
    if (points.length === 0) return;

    if (authState !== "authenticated") {
      requestAuth("measurement");
      return;
    }

    const title =
      saveTitle.trim() ||
      `${activeTool === "distance" ? "Mesafe" : activeTool === "area" ? "Alan" : "Koordinat"} Ölçümü`;

    const measurementType: MeasurementType =
      activeTool === "distance" ? "distance" : activeTool === "area" ? "area" : "coordinate";

    const payload = {
      type: measurementType,
      points: points.map((p) => ({ lon: p.geo.lon, lat: p.geo.lat })),
      title,
      clientMeasurementId: crypto.randomUUID(),
    };

    const res = await saveMeasurement(payload);
    if (res.ok) {
      setSavedList((prev) => [res.measurement, ...prev.slice(0, 19)]);
      setSaveTitle("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  // Restore saved measurement
  const handleLoadSaved = (record: MeasurementRecord) => {
    setActiveTool(record.type === "coordinate" ? "coordinates" : record.type);
    const restored = record.points.map((p) => {
      const pt = projectToMapPoint(p.lon, p.lat);
      return {
        svgX: pt.x,
        svgY: pt.y,
        geo: { lon: p.lon, lat: p.lat },
        label: `${p.lat.toFixed(2)}°K, ${p.lon.toFixed(2)}°D`,
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
    const res = await removeMeasurement(id);
    if (res.ok) {
      setSavedList((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // PNG Export Handler
  const handleExportPng = () => {
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
      {/* 1. TOOL SWITCHER (If mode is not locked to a single subpage) */}
      {!lockMode && (
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-5 sm:p-7 shadow-lg space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                  CBS Coğrafi Ölçüm Laboratuvarı
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  Jeodezik Büyük Daire &amp; Küresel Alan Hesabı
                </span>
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-primary mt-1">
                Coğrafi Bilgi Sistemleri (CBS) Ölçüm Araçları
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={points.length === 0}
                leftIcon={<Undo2 className="size-3.5" />}
              >
                Geri Al
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={points.length === 0}
                leftIcon={<Trash2 className="size-3.5 text-destructive" />}
              >
                Temizle
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                disabled={points.length === 0}
                leftIcon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              >
                {copied ? "Kopyalandı!" : "Özeti Kopyala"}
              </Button>
            </div>
          </div>

          {/* 3 Main Tools Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTool("distance");
                setPoints([]);
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                activeTool === "distance"
                  ? "border-primary bg-primary/10 shadow-md shadow-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-card/60 hover:bg-muted/50 hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-primary/15 text-primary">
                  <Compass className="size-5" />
                </span>
                <Badge variant={activeTool === "distance" ? "primary" : "outline"} size="sm">
                  Jeodezik Kuş Uçuşu
                </Badge>
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-foreground">
                  Mesafe Ölçme Aracı
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Haritada noktalar seçerek büyük daire yay mesafesini ve yolculuk sürelerini
                  hesaplayın.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("coordinates");
                setPoints([]);
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                activeTool === "coordinates"
                  ? "border-secondary bg-secondary/10 shadow-md shadow-secondary/5 ring-1 ring-secondary/40"
                  : "border-border bg-card/60 hover:bg-muted/50 hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-secondary/15 text-secondary">
                  <MapPin className="size-5" />
                </span>
                <Badge variant={activeTool === "coordinates" ? "secondary" : "outline"} size="sm">
                  Enlem / Boylam / DMS
                </Badge>
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-foreground">
                  Koordinat &amp; Konum Bulucu
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Herhangi bir noktaya tıklayarak WGS84, DMS ve UTM coğrafi koordinatlarını öğren.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("area");
                setPoints([]);
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                activeTool === "area"
                  ? "border-accent bg-accent/10 shadow-md shadow-accent/5 ring-1 ring-accent/40"
                  : "border-border bg-card/60 hover:bg-muted/50 hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-accent/15 text-accent">
                  <Layers className="size-5" />
                </span>
                <Badge variant={activeTool === "area" ? "info" : "outline"} size="sm">
                  Küresel Çokgen Alanı
                </Badge>
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-foreground">
                  Alan Hesaplama Aracı
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Köşe noktaları belirleyerek km², Hektar ve Dönüm cinsinden gerçek yüzölçümü ölçün.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. FULL-WIDTH 12-COLUMN INTERACTIVE MAP CANVAS WITH INTEGRATED TOOLBAR */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
        {/* Map Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Navigation className="size-3.5" />}>
              {activeTool === "distance" && "Kuş Uçuşu Mesafe Tuvali"}
              {activeTool === "coordinates" && "Koordinat & Konum Tespit Tuvali"}
              {activeTool === "area" && "Küresel Çokgen Yüzölçümü Tuvali"}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">
              {activeTool === "distance" &&
                "Noktaları bağlamak için haritada istediğin yerlere tıkla"}
              {activeTool === "coordinates" &&
                "Koordinatını ve ilini öğrenmek istediğin noktaya tıkla"}
              {activeTool === "area" && "Kapalı çokgen oluşturmak için en az 3 köşe noktası ekle"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Mouse Coordinates */}
            {hoveredPos && (
              <span className="text-[11px] font-mono bg-muted/60 px-2.5 py-1 rounded-lg text-foreground border border-border/60">
                {hoveredPos.geo.lat.toFixed(3)}° K, {hoveredPos.geo.lon.toFixed(3)}° D
              </span>
            )}

            {/* Undo / Clear in lockMode */}
            {lockMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={points.length === 0}
                  leftIcon={<Undo2 className="size-3.5" />}
                >
                  Geri Al
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={points.length === 0}
                  leftIcon={<Trash2 className="size-3.5 text-destructive" />}
                >
                  Temizle
                </Button>
              </>
            )}

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
                      disabled={points.length === 0}
                      leftIcon={<Download className="size-3.5 text-primary" />}
                    >
                      PNG İndir
                    </Button>
                  }
                />
                <TooltipContent>
                  Harita ve ölçüm sonucunu yüksek çözünürlüklü PNG olarak indirin
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Quick Scenario Preset Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="font-semibold text-muted-foreground shrink-0">Hızlı Senaryolar:</span>
          <button
            type="button"
            onClick={() => loadPreset("ist-ank")}
            className="px-2.5 py-1 rounded-lg bg-muted/70 hover:bg-primary/15 hover:text-primary text-foreground transition-colors shrink-0 cursor-pointer"
          >
            İstanbul - Ankara (351 km)
          </button>
          <button
            type="button"
            onClick={() => loadPreset("izm-van")}
            className="px-2.5 py-1 rounded-lg bg-muted/70 hover:bg-primary/15 hover:text-primary text-foreground transition-colors shrink-0 cursor-pointer"
          >
            İzmir - Van (1.430 km)
          </button>
          <button
            type="button"
            onClick={() => loadPreset("tuz-golu")}
            className="px-2.5 py-1 rounded-lg bg-muted/70 hover:bg-accent/15 hover:text-accent text-foreground transition-colors shrink-0 cursor-pointer"
          >
            Tuz Gölü Alanı (~1.665 km²)
          </button>
          <button
            type="button"
            onClick={() => loadPreset("van-golu")}
            className="px-2.5 py-1 rounded-lg bg-muted/70 hover:bg-accent/15 hover:text-accent text-foreground transition-colors shrink-0 cursor-pointer"
          >
            Van Gölü Alanı (~3.713 km²)
          </button>
          <button
            type="button"
            onClick={() => loadPreset("merkez")}
            className="px-2.5 py-1 rounded-lg bg-muted/70 hover:bg-secondary/15 hover:text-secondary text-foreground transition-colors shrink-0 cursor-pointer"
          >
            Türkiye Ağırlık Merkezi (Kırşehir)
          </button>
        </div>

        {/* Interactive SVG Canvas Container with Zero Top/Bottom Gaps, and its caption.
            ONE BOX, so the 8px between map and credit states the caption relationship instead of
            inheriting whatever `space-y-*` the surrounding container runs — and so fullscreen
            carries the credit with the map. */}
        <div
          className="space-y-2"
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
                aria-label={
                  landscape.active ? "Tam ekrandan çık" : "Tam ekran / yatay modda görüntüle"
                }
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
                <span>Daha geniş bir görünüm için telefonunu yatay çevir.</span>
                <button
                  type="button"
                  onClick={landscape.exit}
                  className="shrink-0 px-2 py-1 rounded-lg border border-white/40 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Anladım
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
                    <strong>Kesişen Çokgen:</strong> Çapraz kenarlar alanı bozar.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSortConvexOrder}
                  className="px-2.5 py-1 rounded-xl bg-warning-foreground text-warning text-[11px] font-bold hover:bg-warning-foreground/90 transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="size-3" />
                  <span>Dış Hat Sırasına Diz</span>
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
                aria-label="Haritayı Yakınlaştır"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Haritayı Uzaklaştır"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                disabled={zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0}
                className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Harita Görünümünü Sıfırla"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>

            {/* Dynamic Metric Scale Bar (Çizgi Ölçek - V1 Klasik Kartografik Standart) */}
            {dynamicScaleBar && (
              <div
                className="absolute bottom-3 left-3 z-30 bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 shadow-md pointer-events-none flex flex-col gap-1 text-xs select-none"
                aria-label={`Çizgi ölçek: ${dynamicScaleBar.km} km`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-foreground font-mono leading-none">
                  <span>0</span>
                  <span>{dynamicScaleBar.km} km</span>
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
              aria-label="Türkiye CBS Ölçüm Haritası"
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
                const radius = Math.max(5 / Math.sqrt(zoomLevel), 3);
                return (
                  <g key={idx} className="transition-transform">
                    <circle
                      cx={p.svgX}
                      cy={p.svgY}
                      r={radius}
                      className="fill-primary stroke-white dark:stroke-black stroke-[2] shadow-md"
                    />
                    <text
                      x={p.svgX}
                      y={p.svgY - (radius + 4)}
                      textAnchor="middle"
                      fontSize={Math.max(10 / Math.sqrt(zoomLevel), 8)}
                      fontWeight="bold"
                      fill="currentColor"
                      className="fill-foreground font-sans drop-shadow-sm select-none pointer-events-none"
                    >
                      {p.label || idx + 1}
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
          <MapAttribution inlandWater context />
        </div>
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
                  Nokta Ekleme &amp; Giriş
                </h4>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {points.length} Nokta Eklendi
              </span>
            </div>

            {/* 81 Province Dropdown Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>1. 81 İl Merkezinden Seçerek Ekle:</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  MGM Resmî Koordinatı
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomSelect
                    options={provinceOptions}
                    value={selectedProvinceCode}
                    onChange={setSelectedProvinceCode}
                    placeholder="İl Seç (81 İl Listesi)..."
                    searchable={true}
                    searchPlaceholder="İl ara (örn: Ankara, 06)..."
                    aria-label="81 İl Merkezinden Seçerek Ekle"
                  />
                </div>
                <Button
                  variant="primary"
                  className="h-10 px-4 text-xs font-bold text-white shrink-0 shadow-xs"
                  onClick={handleAddProvince}
                  disabled={!selectedProvinceCode}
                >
                  Ekle
                </Button>
              </div>
            </div>

            {/* Manual Lat/Lon Text Input */}
            <div className="space-y-2 pt-2 border-t border-border/70">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>2. Doğrudan Koordinat Yazarak Ekle:</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  DD veya DMS Formatı
                </span>
              </label>
              <form onSubmit={handleAddManualCoord} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={manualCoordText}
                  onChange={(e) => setManualCoordText(e.target.value)}
                  placeholder="Örn: 39.92, 32.85 veya 41°00'K 28°58'D"
                  aria-describedby={manualCoordError ? "manual-coord-error" : undefined}
                  className="h-10 text-xs font-mono rounded-xl"
                />
                <Button
                  type="submit"
                  variant="emerald"
                  className="h-10 px-4 text-xs font-bold text-white shrink-0 shadow-xs"
                  disabled={!manualCoordText.trim()}
                >
                  Ekle
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
                <span>3. Bu Ölçümü Kaydet:</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Bulut Arşivine Kaydet
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="Ölçüm Başlığı (Opsiyonel)..."
                  className="h-10 text-xs rounded-xl"
                />
                <Button
                  variant="primary"
                  className="h-10 px-4 text-xs font-bold text-white shrink-0 shadow-xs"
                  onClick={handleSaveMeasurement}
                  disabled={points.length === 0}
                  leftIcon={
                    saveSuccess ? (
                      <BookmarkCheck className="size-4 text-white" />
                    ) : (
                      <Bookmark className="size-4 text-white" />
                    )
                  }
                >
                  {saveSuccess ? "Kaydedildi!" : "Kaydet"}
                </Button>
              </div>
              {saveSuccess && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-[11px] text-success-strong font-medium"
                >
                  Ölçüm bulut arşivine başarıyla kaydedildi.
                </p>
              )}
              {authState !== "authenticated" && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Ölçümlerini bulut arşivine kaydetmek için giriş yapmalısın.
                </p>
              )}
            </div>
          </div>

          {/* B. Saved Measurements History List */}
          {activeSavedList.length > 0 && (
            <div className="p-4 sm:p-5 rounded-3xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-heading font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark className="size-3.5 text-primary" />
                  <span>Kayıtlı Ölçümlerim ({activeSavedList.length})</span>
                </h5>
                <span className="text-[10px] text-muted-foreground">Tıklayarak Yükleyin</span>
              </div>
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
                    aria-label={`${item.title || "Ölçüm"} haritaya yükle`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border hover:bg-muted/60 transition-colors cursor-pointer text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground block">
                        {item.title || "İsimsiz Ölçüm"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        &bull; {item.points.length} Nokta
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(item.id, e)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Ölçümü sil"
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
                Ölçüm Çıktısı &amp; Telemetri
              </Badge>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  disabled={points.length === 0}
                  leftIcon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                >
                  {copied ? "Kopyalandı!" : "Özeti Kopyala"}
                </Button>
              </div>
            </div>

            {/* Distance Output */}
            {activeTool === "distance" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Toplam Kuş Uçuşu Mesafe
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-4xl font-extrabold text-primary font-mono">
                      {distanceKm.toFixed(1)}
                    </span>
                    <span className="text-lg font-bold text-foreground">km</span>
                  </div>
                  <span className="text-xs text-muted-foreground block font-mono">
                    ≈ {(distanceKm * 1000).toLocaleString("tr-TR")} metre /{" "}
                    {(distanceKm / 1.852).toFixed(1)} Deniz Mili (NM)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
                  <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Plane className="size-3.5 text-primary" />
                      <span>Uçuş Süresi</span>
                    </div>
                    <span className="font-heading font-bold text-sm text-foreground">
                      ~{Math.round((distanceKm / 800) * 60)} dk
                    </span>
                    <span className="text-[10px] text-muted-foreground block">800 km/s seyir</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Car className="size-3.5 text-secondary" />
                      <span>Karayolu Tahmini</span>
                    </div>
                    <span className="font-heading font-bold text-sm text-foreground">
                      ~{(distanceKm * 1.28).toFixed(0)} km
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      %28 topoğrafya farkı
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
                        Ondalık Derece (DD - WGS84)
                      </span>
                      <div className="p-3 rounded-xl bg-card border border-border font-mono font-bold text-sm text-foreground">
                        {points[0].geo.lat.toFixed(6)}° K, {points[0].geo.lon.toFixed(6)}° D
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        Derece - Dakika - Saniye (DMS)
                      </span>
                      <div className="p-3 rounded-xl bg-card border border-border font-mono text-xs text-foreground">
                        {toDms(points[0].geo.lat, true)} &bull; {toDms(points[0].geo.lon, false)}
                      </div>
                    </div>

                    {/* Detected Province Link (Reverse Geocoding) */}
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Noktanın Düştüğü İl:
                        </span>
                        <span className="font-heading font-bold text-sm text-primary">
                          {detectedProvince
                            ? `${detectedProvince.name} İli Sınırları İçinde`
                            : "Türkiye Sınırları Dışında / Açık Deniz"}
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
                            İl Sayfası
                          </Button>
                        </Link>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                      <span className="text-muted-foreground block font-medium">
                        UTM Projeksiyon Zonu:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        Zone {Math.floor((points[0].geo.lon + 180) / 6) + 1}N (WGS 84 / UTM)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    Haritada bir noktaya tıklayarak veya listeden il seçerek koordinatlarını ölçün.
                  </div>
                )}
              </div>
            )}

            {/* Area Output */}
            {activeTool === "area" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Hesaplanan Küresel Yüzölçümü
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-4xl font-extrabold text-accent font-mono">
                      {areaKm2.toFixed(1)}
                    </span>
                    <span className="text-lg font-bold text-foreground">km²</span>
                  </div>
                </div>

                {isSelfIntersecting && (
                  <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-between gap-2 text-xs text-warning-strong">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <AlertTriangle className="size-4 text-warning-strong shrink-0" />
                      <span className="text-[11px]">
                        Kesişen çokgen: Çapraz kenarları düzeltmek için sıralayın.
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSortConvexOrder}
                      leftIcon={<RefreshCw className="size-3 text-warning-strong" />}
                      className="shrink-0 text-xs h-7 px-2.5 bg-background"
                    >
                      Sırala
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">Hektar</span>
                    <span className="font-heading font-bold text-sm text-foreground">
                      {(areaKm2 * 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ha
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">Dönüm</span>
                    <span className="font-heading font-bold text-sm text-foreground">
                      {(areaKm2 * 1000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} dönüm
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border col-span-2">
                    <span className="text-muted-foreground block text-[11px]">
                      Çevre Uzunluğu (Perimeter)
                    </span>
                    <span className="font-heading font-bold text-sm text-foreground font-mono">
                      {perimeterKm.toFixed(1)} km
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
                  Nokta Listesi ({points.length})
                </h4>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-destructive hover:underline cursor-pointer"
                >
                  Tümünü Temizle
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
                        {p.label || `Nokta ${idx + 1}`}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {p.geo.lat.toFixed(3)}°K, {p.geo.lon.toFixed(3)}°D
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
