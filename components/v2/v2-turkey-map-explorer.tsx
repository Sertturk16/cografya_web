"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { TALL_CONTEXT_SHAPES, TR_CONTEXT_TALL_VIEWBOX } from "@/lib/map/tr-context-tall.generated";
import { MapSelectionCard } from "@/components/v2/map-selection-card";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import type { GeographicRegion } from "@/lib/api/types";
import { REGION_KEYS } from "@/lib/game/region-slug";
import { REGION_IDENTITY, type RegionIdentity } from "@/lib/theme/region-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Waves,
  ArrowRight,
  Search,
  List,
  AlignLeft,
  X,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  Info,
  ChevronRight,
} from "lucide-react";
import { foldForSearch } from "@/lib/search/normalize";
import { clampPanOffset } from "@/lib/map/v2-zoom-pan";
import {
  boxRectToViewBox,
  sliceScale,
  viewBoxRect,
  viewBoxSize,
} from "@/lib/map/context-label-fit";
import { MAP_COUNTRY_NAMES_TR, UNLABELLED_CONTEXT_ISOS } from "@/lib/map/map-country-names";
import {
  MapContextLabels,
  contextLabelCandidates,
  useMapBoxMetrics,
} from "@/components/v2/map-context-labels";
import { MapAttribution } from "@/components/patterns/map-attribution";
import { COASTAL_PLATE_CODES } from "@/lib/geo/coastal-provinces";

export interface ProvinceItem {
  id: string;
  name: string;
  slug: string;
  path: string;
  plateCode: string;
  region: GeographicRegion;
  regionId: string;
  population?: number | null;
  populationYear?: number | null;
  areaKm2?: number | null;
  districtCount?: number | null;
  coastal: boolean;
}

/**
 * The seven coğrafi bölge as this explorer needs them: how many provinces each holds, and the
 * one colour it wears.
 *
 * `identity` replaces a `color` / `badgeClass` / `headerClass` / `borderClass` / `textClass` set
 * written in raw Tailwind hues. `color` was the MAP FILL on this page — a raw amber-600 fill
 * for Marmara — so `/turkiye` painted Marmara amber while `/turkiye/bolge/marmara`, one breadcrumb
 * click away, painted it blue from `--region-marmara`. The other four fields were the same
 * invented hue at other strengths. Both halves now come from `lib/theme/region-identity.ts`,
 * which is the only file that spells a region's colour, and none of them needs a `dark:`
 * variant any more: a data token carries its own value per theme in `app/globals.css`.
 */
export const REGION_DATA: Record<
  GeographicRegion,
  {
    id: string;
    name: string;
    count: number;
    identity: RegionIdentity;
  }
> = {
  MARMARA: {
    id: "marmara",
    name: "Marmara Bölgesi",
    count: 11,
    identity: REGION_IDENTITY.marmara,
  },
  EGE: { id: "ege", name: "Ege Bölgesi", count: 8, identity: REGION_IDENTITY.ege },
  AKDENIZ: { id: "akdeniz", name: "Akdeniz Bölgesi", count: 8, identity: REGION_IDENTITY.akdeniz },
  IC_ANADOLU: {
    id: "ic-anadolu",
    name: "İç Anadolu Bölgesi",
    count: 13,
    identity: REGION_IDENTITY["ic-anadolu"],
  },
  KARADENIZ: {
    id: "karadeniz",
    name: "Karadeniz Bölgesi",
    count: 18,
    identity: REGION_IDENTITY.karadeniz,
  },
  DOGU_ANADOLU: {
    id: "dogu-anadolu",
    name: "Doğu Anadolu Bölgesi",
    count: 14,
    identity: REGION_IDENTITY["dogu-anadolu"],
  },
  GUNEYDOGU_ANADOLU: {
    id: "guneydogu-anadolu",
    name: "Güneydoğu Anadolu",
    count: 9,
    identity: REGION_IDENTITY["guneydogu-anadolu"],
  },
};

/** The wide context frame's countries (`lib/map/tr-context.generated.ts`), labelled as before. */
const WIDE_FRAME_ISOS = new Set([
  "AM",
  "AZ",
  "BG",
  "CY",
  "GE",
  "GR",
  "IQ",
  "IR",
  "LB",
  "MK",
  "QN",
  "RS",
  "RU",
  "SY",
  "TR",
]);

/**
 * A country new to the tall frame is labelled only when its pole of inaccessibility can hold the
 * label. Measured radii: UA, RO, MD, EG, LY, JO, SA are 37–173 svg units; IL, PS, KW, HU, KZ are
 * 5–25 — clipped slivers at the frame's edge, or too small at this scale.
 */
const NEW_CONTEXT_LABEL_MIN_RADIUS = 30;

const TALL_VIEWBOX_SIZE = viewBoxSize(TR_CONTEXT_TALL_VIEWBOX);
const TALL_VIEWBOX_RECT = viewBoxRect(TR_CONTEXT_TALL_VIEWBOX);

/** The neighbour countries that may carry a label; which of them do is decided per render scale. */
const CONTEXT_LABEL_CANDIDATES = contextLabelCandidates(
  TALL_CONTEXT_SHAPES.filter(
    (c) =>
      c.iso !== "TR" &&
      !UNLABELLED_CONTEXT_ISOS.has(c.iso) &&
      (WIDE_FRAME_ISOS.has(c.iso) ||
        (c.labelRadius >= NEW_CONTEXT_LABEL_MIN_RADIUS && c.iso in MAP_COUNTRY_NAMES_TR)),
  ),
);

const ALPHABET_TURKISH = [
  "A",
  "B",
  "C",
  "Ç",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "İ",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Ö",
  "P",
  "R",
  "S",
  "Ş",
  "T",
  "U",
  "Ü",
  "V",
  "Y",
  "Z",
];

interface V2TurkeyMapExplorerProps {
  provinces: ProvinceItem[];
  regionsSection?: React.ReactNode;
}

export function V2TurkeyMapExplorer({ provinces, regionsSection }: V2TurkeyMapExplorerProps) {
  /**
   * The toolbar's icon buttons carry NO visible text (two of them lose theirs under `sm:`),
   * so their `aria-label` is their only accessible name — and this page is reached in EN too.
   * A Turkish literal in an `aria-label` is a name half the readers cannot read, which is why
   * these six strings go through the catalogue while the rest of this component's inline
   * Turkish prose does not (T-036). The selection card's strings do too, because
   * `MapSelectionCard` is shared with `/dunya`, whose EN card read "kişi" (T-082).
   */
  const t = useTranslations("MapExplorer");
  const [hoveredPlate, setHoveredPlate] = React.useState<string | null>(null);
  const [selectedPlate, setSelectedPlate] = React.useState<string | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [selectedRegion, setSelectedRegion] = React.useState<string>("all");
  const [onlyCoastal, setOnlyCoastal] = React.useState<boolean>(false);
  const [selectedLetter, setSelectedLetter] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [viewMode, setViewMode] = React.useState<"region" | "table" | "fihrist">("region");
  const [sortBy, setSortBy] = React.useState<"plate" | "name" | "pop-desc" | "area-desc">("plate");
  const [showRegionColors, setShowRegionColors] = React.useState<boolean>(false);

  // Interactive Map Zoom & Pan State
  const [zoomLevel, setZoomLevel] = React.useState<number>(1);
  const [panOffset, setPanOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState<boolean>(false);

  // Drag tracking refs (avoids pointer capture stealing clicks when zoom > 1)
  const dragStartPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPanRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPointerDownRef = React.useRef<boolean>(false);
  const hasDraggedRef = React.useRef<boolean>(false);
  const dragResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);

  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  /**
   * The box and the toolbar floating over its top-right corner (T-086), measured on resize.
   * `boxScale` is CSS px per viewBox unit at zoom 1 (T-082), `null` until measured, so the server
   * render and the first client render agree and draw the desktop labels.
   */
  const boxMetrics = useMapBoxMetrics(mapContainerRef, toolbarRef);
  const boxScale =
    boxMetrics &&
    sliceScale(
      boxMetrics.width,
      boxMetrics.height,
      TALL_VIEWBOX_SIZE.width,
      TALL_VIEWBOX_SIZE.height,
    );
  /** What the box shows at zoom 1, and what the toolbar covers at the current zoom and pan. */
  const labelFrame = React.useMemo(
    () =>
      boxMetrics &&
      boxRectToViewBox(
        { left: 0, top: 0, right: boxMetrics.width, bottom: boxMetrics.height },
        boxMetrics,
        TALL_VIEWBOX_RECT,
        1,
        { x: 0, y: 0 },
      ),
    [boxMetrics],
  );
  const labelBlocked = React.useMemo(
    () =>
      boxMetrics
        ? boxMetrics.overlays.map((rect) =>
            boxRectToViewBox(rect, boxMetrics, TALL_VIEWBOX_RECT, zoomLevel, panOffset),
          )
        : [],
    [boxMetrics, zoomLevel, panOffset],
  );

  const provinceMap = React.useMemo(() => {
    const map = new Map<string, ProvinceItem>();
    for (const p of provinces) {
      map.set(p.plateCode, p);
    }
    return map;
  }, [provinces]);

  const trCasing = React.useMemo(() => {
    return TALL_CONTEXT_SHAPES.find((c) => c.iso === "TR");
  }, []);

  // Global release listener for pointerup and pointercancel
  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      isPointerDownRef.current = false;
      setIsDragging(false);
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
      if (dragResetTimerRef.current) {
        clearTimeout(dragResetTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input")) {
      return;
    }
    if (e.button !== 0) return;

    if (dragResetTimerRef.current) {
      clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartPanRef.current = { ...panOffset };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPointerDownRef.current) {
      if (e.buttons === 0) {
        isPointerDownRef.current = false;
        setIsDragging(false);
        return;
      }
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (!hasDraggedRef.current && dist > 5) {
        if (zoomLevel > 1) {
          hasDraggedRef.current = true;
          setIsDragging(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignored in unsupported test environments
          }
        }
      }

      if (hasDraggedRef.current && zoomLevel > 1) {
        const rawX = dragStartPanRef.current.x + dx;
        const rawY = dragStartPanRef.current.y + dy;
        const container = mapContainerRef.current;
        if (container) {
          setPanOffset(
            clampPanOffset(
              { x: rawX, y: rawY },
              zoomLevel,
              container.clientWidth,
              container.clientHeight,
            ),
          );
        } else {
          setPanOffset({ x: rawX, y: rawY });
        }
        return;
      }
    }

    if (!hasDraggedRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    isPointerDownRef.current = false;
    setIsDragging(false);
    if (hasDraggedRef.current) {
      dragResetTimerRef.current = setTimeout(() => {
        hasDraggedRef.current = false;
      }, 50);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.4, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.4, 1);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      } else if (mapContainerRef.current) {
        const { clientWidth, clientHeight } = mapContainerRef.current;
        setPanOffset((cur) => clampPanOffset(cur, next, clientWidth, clientHeight));
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Filter and Sort Provinces
  const filteredProvinces = React.useMemo(() => {
    let list = provinces.map((p) => {
      const regMeta = REGION_DATA[p.region] || REGION_DATA.MARMARA;
      return {
        ...p,
        regionName: regMeta.name,
        regionColor: regMeta.identity.fill,
        // The OPAQUE member, not `badge`. This field has exactly one consumer — the province
        // table's region chip — and that table hovers every row to `bg-muted/50`. A 15% tint over
        // that over `--card` takes Marmara's dark label to 4.41:1, under the 4.5:1 floor, so the
        // chip carries no tint of its own and is measured against `--card` alone. See the `ROW`
        // note beside `--region-*-text` in `app/globals.css`;
        // `components/v2/region-identity.test.ts` pins this call site.
        badgeClass: regMeta.identity.badgeOpaque,
      };
    });

    if (onlyCoastal) {
      list = list.filter((p) => p.coastal);
    }

    if (selectedRegion !== "all") {
      list = list.filter((p) => p.regionId === selectedRegion);
    }

    if (selectedLetter) {
      list = list.filter((p) => p.name.toLocaleUpperCase("tr-TR").startsWith(selectedLetter));
    }

    if (searchQuery.trim()) {
      const folded = foldForSearch(searchQuery.trim());
      list = list.filter(
        (p) =>
          foldForSearch(p.name).includes(folded) ||
          p.plateCode.includes(folded) ||
          foldForSearch(p.regionName).includes(folded),
      );
    }

    return list.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "tr-TR");
      }
      if (sortBy === "pop-desc") {
        return (b.population ?? 0) - (a.population ?? 0);
      }
      if (sortBy === "area-desc") {
        return (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0);
      }
      return parseInt(a.plateCode, 10) - parseInt(b.plateCode, 10);
    });
  }, [provinces, selectedRegion, onlyCoastal, selectedLetter, searchQuery, sortBy]);

  // Check if search has 0 results due to active region filter
  const isSearchRestrictedByRegion = React.useMemo(() => {
    if (!searchQuery.trim() || selectedRegion === "all") return false;
    const folded = foldForSearch(searchQuery.trim());
    const matchInAll = provinces.some(
      (p) => foldForSearch(p.name).includes(folded) || p.plateCode.includes(folded),
    );
    return matchInAll && filteredProvinces.length === 0;
  }, [searchQuery, selectedRegion, provinces, filteredProvinces.length]);

  const activeProvince = selectedPlate
    ? provinceMap.get(selectedPlate)
    : hoveredPlate
      ? provinceMap.get(hoveredPlate)
      : null;

  const activeRegionMeta = activeProvince ? REGION_DATA[activeProvince.region] : null;

  // Grouping for Region Grouped Mode (derived directly from REGION_KEYS)
  const regionGroupedProvinces = React.useMemo(() => {
    const groups: {
      id: string;
      name: string;
      identity: RegionIdentity;
      items: ProvinceItem[];
      totalPopulation: number;
      totalArea: number;
    }[] = [];

    for (const key of REGION_KEYS) {
      const meta = REGION_DATA[key];
      if (selectedRegion !== "all" && selectedRegion !== meta.id) continue;
      const items = filteredProvinces.filter((p) => p.region === key);
      if (items.length > 0) {
        const totalPopulation = items.reduce((acc, p) => acc + (p.population || 0), 0);
        const totalArea = items.reduce((acc, p) => acc + (p.areaKm2 || 0), 0);
        groups.push({
          id: meta.id,
          name: meta.name,
          identity: meta.identity,
          items,
          totalPopulation,
          totalArea,
        });
      }
    }
    return groups;
  }, [filteredProvinces, selectedRegion]);

  // Grouping for Fihrist (A-Z Block) Mode
  const fihristGroups = React.useMemo(() => {
    const groups: Record<string, ProvinceItem[]> = {};
    for (const letter of ALPHABET_TURKISH) {
      const matching = filteredProvinces.filter((p) =>
        p.name.toLocaleUpperCase("tr-TR").startsWith(letter),
      );
      if (matching.length > 0) {
        groups[letter] = matching;
      }
    }
    return groups;
  }, [filteredProvinces]);

  const coastalCount = React.useMemo(() => {
    return provinces.filter((p) => p.coastal).length || COASTAL_PLATE_CODES.size;
  }, [provinces]);

  return (
    <div className="space-y-8">
      {/* 1. INTERACTIVE VECTOR MAP CANVAS CARD */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 p-5 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
              81 İl Haritası
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Bir ile tıkla, kısa bilgisini gör. Yakınlaştırıp sürükleyerek haritada gezinebilirsin.
            </p>
          </div>

          {/* Region Tabs (Fully Functional Filter Bar) */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl bg-muted border border-border text-xs scrollbar-none max-w-full">
            <button
              type="button"
              onClick={() => {
                setSelectedRegion("all");
                setOnlyCoastal(false);
                setSelectedLetter(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
                selectedRegion === "all" && !onlyCoastal
                  ? "bg-card text-primary font-bold shadow-xs border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tüm İller (81)
            </button>
            {REGION_KEYS.map((key) => {
              const reg = REGION_DATA[key];
              const isSelected = selectedRegion === reg.id && !onlyCoastal;
              return (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(reg.id);
                    setOnlyCoastal(false);
                    setSelectedLetter(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? `bg-card ${reg.identity.label} font-bold shadow-xs border ${reg.identity.edge}`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {reg.name.split(" ")[0]} ({reg.count})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setOnlyCoastal(!onlyCoastal);
                setSelectedRegion("all");
                setSelectedLetter(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                onlyCoastal
                  ? "bg-accent text-accent-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Waves className="size-3" />
              <span>Kıyı İlleri ({coastalCount})</span>
            </button>
          </div>
        </div>

        {/* EDGE-TO-EDGE Map Panel with Zoom & Mouse Tracker, and its caption in ONE box — so the
            gap under the map is the caption's 8px, not this container's `space-y-6`. */}
        {/* A map and the line that credits it are a FIGURE and its CAPTION — the relationship
            `v2-province-locator-map.tsx` has always expressed and the other six did not, so a screen
            reader heard a figure caption on a province page and a loose paragraph on `/turkiye`.
            `m-0` because a `<figure>` carries a UA margin a `<div>` does not. */}
        <figure className="m-0 space-y-2">
          {/* Positioning context for the selection card, which sits under the map box on a phone
            and floats over it from `sm`. */}
          <div className="relative">
            <div
              ref={mapContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onMouseLeave={() => {
                if (!isDragging && !isPointerDownRef.current) {
                  setHoveredPlate(null);
                  setMousePos(null);
                }
              }}
              className={`relative rounded-2xl bg-[var(--map-plate)] border border-border overflow-hidden p-0 group aspect-square sm:aspect-[1270/580] sm:min-h-[420px] w-full select-none ${
                zoomLevel > 1
                  ? `touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`
                  : "cursor-crosshair"
              }`}
            >
              {/* Map Controls Floating Bar */}
              <div
                ref={toolbarRef}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => setShowRegionColors(!showRegionColors)}
                  aria-label={showRegionColors ? t("regionColorsReset") : t("regionColorsShow")}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showRegionColors
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Palette className="size-3.5" />
                  <span className="hidden sm:inline">Bölge Renkleri</span>
                </button>

                {/* The product's ONE standalone rule (T-036 measured it). It stays a <div>: it
                groups toolbar buttons visually and carries no meaning a screen reader needs,
                so it is hidden from the accessibility tree rather than announced. */}
                <div aria-hidden="true" className="h-4 w-px bg-border my-auto mx-0.5" />

                <button
                  type="button"
                  onClick={handleZoomIn}
                  aria-label={t("zoomIn")}
                  className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <ZoomIn className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  aria-label={t("zoomOut")}
                  className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ZoomOut className="size-4" />
                </button>
                {zoomLevel > 1 && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    aria-label={t("resetView")}
                    className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer text-xs font-mono"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
              </div>

              {/* SVG Map Canvas with Transform */}
              <div
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                }}
                className="w-full h-full"
              >
                {/* `slice` over the tall frame (T-079): in the 1270:580 desktop box it shows exactly the
                wide frame; in a phone's ~1:1 box the extra height is real land and sea rather than
                letterbox, so `clampPanOffset`'s box-sized bounds match what is drawn and a zoomed
                map can no longer be panned into empty space. */}
                <svg
                  viewBox={TR_CONTEXT_TALL_VIEWBOX}
                  preserveAspectRatio="xMidYMid slice"
                  className="w-full h-full select-none block"
                  aria-label="Türkiye'nin 81 ili ve komşu ülkeler haritası"
                >
                  {/* 1. Surrounding Foreign Countries */}
                  <g
                    onMouseEnter={() => setHoveredPlate(null)}
                    className="fill-[var(--map-context-land)] stroke-[var(--map-context-line)] stroke-[1] stroke-linejoin-round pointer-events-none"
                  >
                    {TALL_CONTEXT_SHAPES.filter((c) => c.iso !== "TR").map((country) => (
                      <path key={country.iso} d={country.d} />
                    ))}
                  </g>

                  {/* 2. Türkiye Casing Base Land */}
                  {trCasing && (
                    <path d={trCasing.d} className="fill-[var(--map-land)] pointer-events-none" />
                  )}

                  {/* 3. Türkiye 81 Provinces Layer */}
                  <g className="stroke-border/90 stroke-[0.8] transition-colors">
                    {PROVINCE_SHAPES.map((shape) => {
                      const isHovered = shape.plateCode === hoveredPlate;
                      const isSelected = shape.plateCode === selectedPlate;
                      const provItem = provinceMap.get(shape.plateCode);
                      const regMeta = provItem ? REGION_DATA[provItem.region] : REGION_DATA.MARMARA;
                      const matchesRegion =
                        selectedRegion === "all" || provItem?.regionId === selectedRegion;
                      const matchesCoastal = !onlyCoastal || provItem?.coastal;
                      const isHighlighted = matchesRegion && matchesCoastal;

                      let fillColor = "fill-card hover:fill-primary/60";

                      if (showRegionColors) {
                        fillColor = regMeta.identity.fill;
                      } else if (selectedRegion !== "all" || onlyCoastal) {
                        fillColor = isHighlighted
                          ? regMeta.identity.fill
                          : "fill-card/30 opacity-30";
                      }

                      if (isHovered || isSelected) {
                        fillColor = "fill-primary filter drop-shadow-md opacity-100";
                      }

                      return (
                        <path
                          key={shape.plateCode}
                          d={shape.d}
                          data-plate={shape.plateCode}
                          role="button"
                          tabIndex={0}
                          aria-label={`${provItem?.name || shape.plateCode} ili`}
                          onMouseEnter={() => setHoveredPlate(shape.plateCode)}
                          onMouseLeave={() => setHoveredPlate(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedPlate(shape.plateCode);
                            }
                          }}
                          onClick={() => {
                            if (!hasDraggedRef.current) {
                              setSelectedPlate(shape.plateCode);
                            }
                          }}
                          className={`${fillColor} transition-all duration-150 cursor-pointer outline-none hover:stroke-foreground/80 hover:stroke-[1.2] focus-visible:stroke-primary focus-visible:stroke-[2]`}
                        />
                      );
                    })}
                  </g>

                  {/* 4. Inland Lakes */}
                  <g className="fill-[var(--map-sea)] stroke-[var(--map-water-line)] stroke-[0.5] pointer-events-none">
                    {INLAND_WATER_SHAPES.map((lake) => (
                      <path key={lake.id} d={lake.d} />
                    ))}
                  </g>

                  {/* 5–6. Sea and neighbour-country names, sized to stay legible at every box
                  size and dropped where they do not fit, cross the frame or sit under the
                  toolbar (T-082, T-084, T-085, T-086). */}
                  <MapContextLabels
                    candidates={CONTEXT_LABEL_CANDIDATES}
                    scale={boxScale === null ? null : boxScale * zoomLevel}
                    blocked={labelBlocked}
                    frame={labelFrame}
                  />
                </svg>
              </div>

              {/* DYNAMIC FLOATING TOOLTIP */}
              {hoveredPlate && mousePos && !isDragging && (
                <div
                  className="absolute z-30 pointer-events-none rounded-2xl bg-card/95 backdrop-blur-xl border border-border/90 p-3.5 shadow-2xl text-xs space-y-2 min-w-[210px] max-w-[260px] animate-in fade-in-50 zoom-in-95 duration-100"
                  style={{
                    top: `${Math.min(mousePos.y + 20, 340)}px`,
                    left: `${Math.min(mousePos.x + 20, 960)}px`,
                  }}
                >
                  {(() => {
                    const item = provinceMap.get(hoveredPlate);
                    if (!item) return null;
                    const regMeta = REGION_DATA[item.region];
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="size-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono">
                              {item.plateCode}
                            </span>
                            <div>
                              <span className="font-heading font-bold text-foreground text-sm block leading-tight">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {regMeta?.name ?? "Türkiye"}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                            TR-{item.plateCode}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Bölge:</span>
                            <span className="font-medium text-foreground">
                              {regMeta?.name.split(" ")[0] ?? "Türkiye"}
                            </span>
                          </div>
                          {item.population && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Nüfus:</span>
                              <span className="font-mono font-bold text-primary">
                                {item.population.toLocaleString("tr-TR")}
                              </span>
                            </div>
                          )}
                          {item.areaKm2 && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Yüzölçümü:</span>
                              <span className="font-mono font-medium text-foreground">
                                {item.areaKm2.toLocaleString("tr-TR")} km²
                              </span>
                            </div>
                          )}
                          {item.districtCount && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>İlçe Sayısı:</span>
                              <span className="font-mono font-medium text-foreground">
                                {item.districtCount} İlçe
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-1 text-[10px] text-primary font-semibold flex items-center justify-between border-t border-border/60">
                          <span>Seçmek için tıkla</span>
                          <ArrowRight className="size-3" />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            {/* Active Selection / Quick Info Bar: under the map on a phone, over it from `sm` (T-079).
          Inside the box it covered 24px of Türkiye at 320px and 8px at 360px. */}
            {selectedPlate && activeProvince && (
              <MapSelectionCard
                className="mt-2 sm:absolute sm:bottom-3 sm:left-3 sm:z-30 sm:mt-0 sm:max-w-sm"
                leading={
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 font-mono text-sm font-bold text-primary">
                    {activeProvince.plateCode}
                  </div>
                }
                title={activeProvince.name}
                badges={
                  <Badge variant="outline" size="sm" className="px-1 py-0 font-mono text-[9px]">
                    {activeRegionMeta?.name.split(" ")[0]}
                  </Badge>
                }
                stats={[
                  activeProvince.population
                    ? t("statPopulation", { count: activeProvince.population })
                    : null,
                  activeProvince.areaKm2 ? t("statArea", { area: activeProvince.areaKm2 }) : null,
                ].filter((stat): stat is string => stat !== null)}
                href={activeProvince.path as unknown as React.ComponentProps<typeof Link>["href"]}
                exploreLabel={t("explore")}
                closeLabel={t("closeSelection")}
                onClose={() => setSelectedPlate(null)}
              />
            )}
          </div>

          {/* UNDER the plate, and outside it. The credit used to sit beside the `<svg>` in the
            plate's inner `w-full h-full` box, which put it below a full-height map and inside the
            plate's `overflow-hidden` — clipped, so the credit was on no screen. */}
          <figcaption>
            <MapAttribution inlandWater context />
          </figcaption>
        </figure>
      </div>

      {/* OPTIONAL REGIONS SECTION (7 COĞRAFİ BÖLGE REHBERİ) */}
      {regionsSection && <div key="v2-regions-section">{regionsSection}</div>}

      {/* 2. PROVINCES CATALOGUE & CONTROLS */}
      <section>
        {/*
          A control switching between three renderings of the same catalogue, so `pills`
          (T-034 rationale, components/ui/tabs.tsx). The section's vertical rhythm lives on the
          `Tabs` root itself, NOT on the `<section>` with a `contents` root under it: Tailwind v4
          compiles the space-y utility to a direct-child selector, and `display: contents` does
          not change selector matching, so a `contents` root left the section with exactly one
          element child, nothing matched `:not(:last-child)`, and every gap in here computed to
          zero. The root is a real box in the flow and spaces its own children.
        */}
        <Tabs
          value={viewMode}
          onValueChange={(value) => setViewMode(value as "region" | "table" | "fihrist")}
          variant="pills"
          className="space-y-6"
        >
          <div className="border-b border-border pb-4 flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
              İl Listesi
            </h3>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="İl adı, plaka veya bölge ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-xs bg-card"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Filter */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs w-full md:w-auto justify-between">
                <button
                  type="button"
                  onClick={() => setSortBy("plate")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    sortBy === "plate"
                      ? "bg-card text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Plaka
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("name")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    sortBy === "name"
                      ? "bg-card text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  A-Z
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("pop-desc")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    sortBy === "pop-desc"
                      ? "bg-card text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Nüfus
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("area-desc")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    sortBy === "area-desc"
                      ? "bg-card text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Yüzölçümü
                </button>
              </div>

              {/* View Mode Switcher: 3 Modes (Region Grouped / Table / Fihrist) */}
              <TabsList aria-label="Görünüm Seçenekleri" className="h-auto p-1">
                <TabsTrigger
                  value="region"
                  className="gap-1 px-2.5 text-xs font-semibold"
                  aria-label={t("regionGroupedView")}
                >
                  <Layers className="size-3.5" />
                  <span className="hidden sm:inline">Bölgelere Göre</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="px-1.5" aria-label={t("tableView")}>
                  <List className="size-4" />
                </TabsTrigger>
                <TabsTrigger value="fihrist" className="px-1.5" aria-label={t("indexView")}>
                  <AlignLeft className="size-4" />
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Search Restriction Helper Banner — a CAUTION, not neutral information: the region
            filter is suppressing results the reader asked for, and the escape from it is the
            button on the right. Hence the warning family rather than `info`.
            Measured with lib/theme/contrast.ts, BACKDROP NAMED: this banner sits in a bare
            <section>, so the tint composites over `--background`, not over `--card`.
            `--warning-strong` on `--warning/10` over `--background` measures 5.81:1 light and
            9.19:1 dark FROM PAINTED PIXELS at 320 and 1280 in both themes; the model
            (`blendOver`) says 5.86 / 9.10. The gap is +-1 byte per channel from 8-bit ALPHA
            QUANTISATION — `/10` cannot be expressed exactly in 255ths — and its direction is
            NOT systematic: here the model flatters by 0.05 in light and is conservative by
            0.09 in dark. It is not an oklab-versus-sRGB effect; mixing with `transparent` is
            premultiplied, so the second colour contributes nothing and only alpha scales, in
            any interpolation space. Measured across 486 painted cases, `color-mix(in oklab, C
            P%, transparent)` and `rgb(C / P)` agree exactly in 408 and differ by one byte in
            76. The painted figures are recorded because they are painted, not because the
            model leans one way. The same pairing over `--card` would be 6.17 / 8.18, but this
            page never paints it there. The escape button supplies its own `bg-card`, so its
            label is an OPAQUE PAIR — `--warning-strong` on `--card`, no alpha anywhere, so the
            analytic figure is exact by construction: 6.81:1 light, 9.64:1 dark (a paint
            confirmed 6.814). Every figure floored. */}
          {isSearchRestrictedByRegion && (
            <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 text-xs text-warning-strong flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="size-4 shrink-0 text-warning-strong" />
                <span>
                  <strong>
                    {provinces.find((p) => p.regionId === selectedRegion)?.region
                      ? REGION_DATA[provinces.find((p) => p.regionId === selectedRegion)!.region]
                          ?.name
                      : "Seçili Bölge"}
                  </strong>{" "}
                  seçiliyken &quot;{searchQuery}&quot; bulunamadı.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5 bg-card border-warning/40 text-warning-strong"
                onClick={() => setSelectedRegion("all")}
              >
                Tüm İllerde Ara
              </Button>
            </div>
          )}

          {/* Alphabet Initial Letters Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedLetter(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                selectedLetter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground border border-border/60"
              }`}
            >
              Tümü
            </button>
            {ALPHABET_TURKISH.map((letter) => {
              const hasProvinces = provinces.some((p) =>
                p.name.toLocaleUpperCase("tr-TR").startsWith(letter),
              );
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!hasProvinces}
                  onClick={() => setSelectedLetter(isSelected ? null : letter)}
                  className={`size-7 rounded-lg text-xs font-medium shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : hasProvinces
                        ? "bg-card hover:bg-muted text-foreground border border-border/80"
                        : "opacity-30 text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Results Info and Reset Filters */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Toplam{" "}
              <strong className="text-foreground font-semibold">{filteredProvinces.length}</strong>{" "}
              il listeleniyor.
            </span>
            {(searchQuery || selectedLetter || selectedRegion !== "all" || onlyCoastal) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedLetter(null);
                  setSelectedRegion("all");
                  setOnlyCoastal(false);
                }}
                className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <X className="size-3" /> Filtreleri Temizle
              </button>
            )}
          </div>

          {/* 1. REGION GROUPED VIEW (DEFAULT & ELEGANT) */}
          <TabsContent value="region" className="space-y-6">
            {regionGroupedProvinces.map((group) => (
              <div
                key={group.id}
                className={`rounded-3xl border ${group.identity.edge} bg-card overflow-hidden shadow-sm transition-all`}
              >
                {/* Region Section Header Banner */}
                {/* The region's own colour, the one the map above paints it. `[&_h4]:text-inherit`
                    is load-bearing: `@layer base` sets `h1,h2,h3,h4 { color: var(--foreground) }`,
                    which beats a merely inherited colour, so without it the heading drops the
                    region's label member and renders plain foreground.
                    BACKDROP: one `--region-*-tint` over `--card` — the `BANNER` column of the
                    table in `app/globals.css`, because this Card is opaque and nothing else
                    paints over it. Confirmed from painted pixels at 320 and 1280: Marmara's
                    heading measures 5.97:1 light and 4.82:1 dark, against a recorded 5.97 /
                    4.77, so the stylesheet's figures are the conservative ones. */}
                <div
                  className={`p-4 sm:p-5 ${group.identity.banner} [&_h4]:text-inherit flex flex-wrap items-center justify-between gap-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-background text-foreground flex items-center justify-center font-bold text-sm">
                      {group.items.length}
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-lg leading-tight">{group.name}</h4>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {group.items.length} İl ·{" "}
                        {group.totalPopulation > 0
                          ? `${group.totalPopulation.toLocaleString("tr-TR")} kişi`
                          : ""}{" "}
                        ·{" "}
                        {group.totalArea > 0
                          ? `${group.totalArea.toLocaleString("tr-TR")} km²`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Provinces Compact Mini-Card Grid */}
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {group.items.map((province) => (
                    <Link
                      key={province.plateCode}
                      href={province.path as unknown as React.ComponentProps<typeof Link>["href"]}
                      className="p-3 rounded-2xl border border-border/80 bg-muted/20 hover:bg-card hover:border-primary/60 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {province.plateCode}
                        </span>
                        {province.coastal && (
                          <span className="size-5 rounded-md bg-accent/10 text-accent flex items-center justify-center">
                            <Waves className="size-3" aria-hidden="true" />
                            <span className="sr-only">Kıyı ili</span>
                          </span>
                        )}
                      </div>

                      <div className="mb-2">
                        <span className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors block">
                          {province.name}
                        </span>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                          {province.population && (
                            <span>{province.population.toLocaleString("tr-TR")} kişi</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-primary font-medium">
                        <span>
                          {province.areaKm2
                            ? `${province.areaKm2.toLocaleString("tr-TR")} km²`
                            : "Detay"}
                        </span>
                        <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* 2. TABLE VIEW */}
          <TabsContent
            value="table"
            className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-16">Plaka</TableHead>
                  <TableHead>İl Adı</TableHead>
                  <TableHead>Bölge</TableHead>
                  <TableHead className="text-center w-24">Kıyı</TableHead>
                  <TableHead className="text-right">Nüfus</TableHead>
                  <TableHead className="text-right">Yüzölçümü (km²)</TableHead>
                  <TableHead className="text-center w-24">İlçe</TableHead>
                  <TableHead className="text-right w-24">Sayfası</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProvinces.map((province) => (
                  <TableRow
                    key={province.plateCode}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-mono font-bold text-primary">
                      {province.plateCode}
                    </TableCell>
                    <TableCell className="font-bold text-foreground">
                      <Link
                        href={province.path as unknown as React.ComponentProps<typeof Link>["href"]}
                        className="hover:text-primary hover:underline transition-colors"
                      >
                        {province.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm" className={province.badgeClass}>
                        {province.regionName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {province.coastal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent font-semibold text-[10px]">
                          <Waves className="size-3" /> Kıyı
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Yok</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {province.population ? province.population.toLocaleString("tr-TR") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-foreground">
                      {province.areaKm2 ? `${province.areaKm2.toLocaleString("tr-TR")} km²` : "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {province.districtCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={province.path as unknown as React.ComponentProps<typeof Link>["href"]}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          rightIcon={<ArrowRight className="size-3.5" />}
                        >
                          İncele
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* 3. FIHRIST (A-Z BLOCK) VIEW */}
          <TabsContent value="fihrist" className="space-y-6">
            {Object.entries(fihristGroups).map(([letter, groupList]) => (
              <div key={letter} className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <span className="size-7 rounded-xl bg-primary text-white font-heading font-bold text-sm flex items-center justify-center">
                    {letter}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {groupList.length} İl
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {groupList.map((p) => (
                    <Link
                      key={p.plateCode}
                      href={p.path as unknown as React.ComponentProps<typeof Link>["href"]}
                      className="p-2.5 rounded-xl border border-border/70 hover:border-primary hover:bg-muted/50 transition-all flex items-center justify-between text-xs group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-[10px] text-muted-foreground font-bold">
                          {p.plateCode}
                        </span>
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {p.name}
                        </span>
                      </div>
                      <ChevronRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
