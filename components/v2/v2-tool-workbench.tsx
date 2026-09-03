"use client";

import * as React from "react";
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
import type { ProvincePoint } from "@/lib/tools/province-points";
import type { ProvinceArea } from "@/components/tools/tool-island";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
  downloadName = "cografya-v2-olcum",
}: V2ToolWorkbenchProps) {
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

    if (activeTool === "coordinates") {
      setPoints([{ svgX: mapPt.x, svgY: mapPt.y, geo, label, source: "dropdown" }]);
    } else {
      setPoints((prev) => [
        ...prev,
        { svgX: mapPt.x, svgY: mapPt.y, geo, label, source: "dropdown" },
      ]);
    }
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

    if (activeTool === "coordinates") {
      setPoints([{ svgX: mapPt.x, svgY: mapPt.y, geo, label, source: "manual" }]);
    } else {
      setPoints((prev) => [
        ...prev,
        { svgX: mapPt.x, svgY: mapPt.y, geo, label, source: "manual" },
      ]);
    }
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

    const measurementType =
      activeTool === "distance" ? "distance" : activeTool === "area" ? "area" : "coordinate";

    const payload = {
      type: measurementType as "distance" | "area" | "coordinate",
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
  };

  // Delete saved measurement
  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
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

      // Attribution watermarking
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        "Coğrafya Platformu v2 · WGS84 / MEB & MTA Tabanlı Ölçüm",
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
                  CBS Coğrafi Ölçüm Laboratuvarı v2
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  Jeodezik Büyük Daire &amp; Küresel Alan Hesabı
                </span>
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] mt-1">
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
                leftIcon={
                  copied ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )
                }
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPng}
              disabled={points.length === 0}
              leftIcon={<Download className="size-3.5 text-primary" />}
              title="Harita ve ölçüm sonucunu yüksek çözünürlüklü PNG olarak indirin"
            >
              PNG İndir
            </Button>
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

        {/* Interactive SVG Canvas Container with Zero Top/Bottom Gaps */}
        <div
          ref={mapContainerRef}
          className="relative w-full aspect-[1270/580] bg-[#dbe8ee] dark:bg-[#15232d] rounded-2xl border border-border/80 overflow-hidden shadow-inner flex items-center justify-center select-none"
        >
          {/* Absolute Floating Self-Intersection Warning Banner (Zero Layout Shift) */}
          {isSelfIntersecting && (
            <div
              role="alert"
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[95%] sm:max-w-md bg-amber-950/90 backdrop-blur-md text-amber-200 px-3.5 py-1.5 rounded-2xl border border-amber-500/50 shadow-2xl flex items-center justify-between gap-2.5 text-xs pointer-events-auto animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] truncate">
                  <strong>Kesişen Çokgen:</strong> Çapraz kenarlar alanı bozar.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSortConvexOrder}
                className="px-2.5 py-1 rounded-xl bg-amber-500 text-black text-[11px] font-bold hover:bg-amber-400 transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
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
              title="Yakınlaştır (+)"
              aria-label="Haritayı Yakınlaştır"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
              title="Uzaklaştır (-)"
              aria-label="Haritayı Uzaklaştır"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              disabled={zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0}
              className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
              title="Görünümü Sıfırla"
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
            className={`w-full h-full object-fill ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleMapClick}
            aria-label="Türkiye CBS Ölçüm Haritası"
          >
            {/* Background neighbor lands */}
            {CONTEXT_SHAPES.map((country) => (
              <path
                key={country.iso}
                d={country.d}
                className="fill-[#e8edea] dark:fill-[#202b33] stroke-[#c0cec5] dark:stroke-[#2e3c46] stroke-[0.8]"
              />
            ))}

            {/* Inland Lakes & Waters */}
            {INLAND_WATER_SHAPES.map((water) => (
              <path
                key={water.id}
                d={water.d}
                className="fill-[#a9ccdf] dark:fill-[#122b3d] stroke-[#8bb7cf] dark:stroke-[#0e2230] stroke-[0.5]"
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

            {/* Drawn Area Polygon */}
            {activeTool === "area" && points.length >= 3 && (
              <polygon
                points={points.map((p) => `${p.svgX},${p.svgY}`).join(" ")}
                fill="rgba(5, 150, 105, 0.25)"
                stroke="#059669"
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
                  Yerel Hafızaya Sakla
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
                    onClick={() => handleLoadSaved(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleLoadSaved(item);
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
                      className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Sil"
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
                  leftIcon={
                    copied ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )
                  }
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
                            pathname: "/v2/turkiye/[slug]",
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
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                      <span className="text-[11px]">
                        Kesişen çokgen: Çapraz kenarları düzeltmek için sıralayın.
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSortConvexOrder}
                      leftIcon={<RefreshCw className="size-3 text-amber-600" />}
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
