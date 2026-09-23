"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MapSelectionCard } from "@/components/v2/map-selection-card";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
import { MapAttribution } from "@/components/patterns/map-attribution";
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
  ArrowRight,
  Search,
  List,
  AlignLeft,
  X,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronRight,
  Info,
} from "lucide-react";
import { foldForSearch } from "@/lib/search/normalize";
import { cn } from "@/lib/utils";
import { clampPanOffset } from "@/lib/map/v2-zoom-pan";
import { CONTINENT_META } from "@/lib/map/continent-theme";
import type { ContinentIdentity } from "@/lib/theme/continent-identity";

export interface WorldCountryItem {
  isoCode: string;
  nameTr: string;
  nameEn: string;
  continent: string;
  slugTr: string;
  slugEn: string;
  path: string;
  entityType?: string;
  population?: number | null;
  areaKm2?: number | null;
  neighborCount?: number;
  hasFlag?: boolean;
  isSpecialStatus?: boolean;
}

export function SpecialStatusBadge({ isEn, className }: { isEn: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "text-[9px] py-0 px-1.5 rounded font-medium bg-warning/15 text-warning-strong border border-warning/30 shrink-0 select-none inline-flex items-center",
        className,
      )}
    >
      {isEn ? "Special Status Entity" : "Özel Statülü Varlık"}
    </span>
  );
}

const CONTINENT_KEYS = Object.keys(CONTINENT_META);

const ALPHABET_TR = [
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

const ALPHABET_EN = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

interface V2WorldMapExplorerProps {
  countries: WorldCountryItem[];
  locale?: string;
  middleSections?: React.ReactNode;
}

export function V2WorldMapExplorer({
  countries,
  locale = "tr",
  middleSections,
}: V2WorldMapExplorerProps) {
  /**
   * The view-mode toolbar buttons have no accessible name of their own — the first loses its
   * visible label under `sm:`, the other two never had one — and this page is reached in EN
   * too, so the name goes through the catalogue rather than shipping as a Turkish literal
   * (T-036).
   */
  const t = useTranslations("MapExplorer");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [selectedContinent, setSelectedContinent] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedLetter, setSelectedLetter] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"continent" | "table" | "fihrist">("continent");
  const [sortBy, setSortBy] = React.useState<"name" | "pop-desc" | "area-desc">("name");
  const [hoveredIso, setHoveredIso] = React.useState<string | null>(null);
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [containerDim, setContainerDim] = React.useState<{ width: number; height: number }>({
    width: 1000,
    height: 520,
  });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerDim({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Zoom & Pan states
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState<boolean>(false);

  // Drag tracking refs (avoids pointer capture stealing clicks when zoom > 1)
  const dragStartPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPanRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPointerDownRef = React.useRef<boolean>(false);
  const hasDraggedRef = React.useRef<boolean>(false);
  const dragResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEn = locale === "en";
  const alphabet = isEn ? ALPHABET_EN : ALPHABET_TR;

  const countryMap = React.useMemo(() => {
    const map = new Map<string, WorldCountryItem>();
    for (const c of countries) {
      map.set(c.isoCode, c);
    }
    return map;
  }, [countries]);

  // Global release listener for pointerup and pointercancel
  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      isPointerDownRef.current = false;
      setIsPanning(false);
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
    dragStartPanRef.current = { ...pan };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPointerDownRef.current) {
      if (e.buttons === 0) {
        isPointerDownRef.current = false;
        setIsPanning(false);
        return;
      }
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (!hasDraggedRef.current && dist > 5) {
        if (zoom > 1) {
          hasDraggedRef.current = true;
          setIsPanning(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignored in unsupported environments
          }
        }
      }

      if (hasDraggedRef.current && zoom > 1) {
        const rawX = dragStartPanRef.current.x + dx;
        const rawY = dragStartPanRef.current.y + dy;
        const container = containerRef.current;
        if (container) {
          setPan(
            clampPanOffset(
              { x: rawX, y: rawY },
              zoom,
              container.clientWidth,
              container.clientHeight,
            ),
          );
        } else {
          setPan({ x: rawX, y: rawY });
        }
        return;
      }
    }

    if (!hasDraggedRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
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
    setIsPanning(false);
    if (hasDraggedRef.current) {
      dragResetTimerRef.current = setTimeout(() => {
        hasDraggedRef.current = false;
      }, 50);
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.4, 4));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.4, 1);
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      } else if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setPan((cur) => clampPanOffset(cur, next, clientWidth, clientHeight));
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Filter countries based on continent, search, and letter
  const filteredCountries = React.useMemo(() => {
    return countries
      .filter((c) => {
        // Continent filter
        if (selectedContinent !== "ALL" && c.continent !== selectedContinent) {
          return false;
        }
        // Letter filter with locale awareness
        const displayName = isEn ? c.nameEn : c.nameTr;
        if (
          selectedLetter &&
          !displayName.toLocaleUpperCase(isEn ? "en-US" : "tr-TR").startsWith(selectedLetter)
        ) {
          return false;
        }
        // Search query filter
        if (searchQuery.trim()) {
          const foldedQ = foldForSearch(searchQuery);
          const foldedTr = foldForSearch(c.nameTr);
          const foldedEn = foldForSearch(c.nameEn);
          const foldedIso = foldForSearch(c.isoCode);
          return (
            foldedTr.includes(foldedQ) || foldedEn.includes(foldedQ) || foldedIso.includes(foldedQ)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "pop-desc") {
          return (b.population ?? 0) - (a.population ?? 0);
        }
        if (sortBy === "area-desc") {
          return (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0);
        }
        const nameA = isEn ? a.nameEn : a.nameTr;
        const nameB = isEn ? b.nameEn : b.nameTr;
        return nameA.localeCompare(nameB, isEn ? "en-US" : "tr-TR");
      });
  }, [countries, selectedContinent, selectedLetter, searchQuery, sortBy, isEn]);

  // Check if search has 0 results due to active continent filter
  const isSearchRestrictedByContinent = React.useMemo(() => {
    if (!searchQuery.trim() || selectedContinent === "ALL") return false;
    const folded = foldForSearch(searchQuery.trim());
    const matchInAll = countries.some(
      (c) =>
        foldForSearch(c.nameTr).includes(folded) ||
        foldForSearch(c.nameEn).includes(folded) ||
        foldForSearch(c.isoCode).includes(folded),
    );
    return matchInAll && filteredCountries.length === 0;
  }, [searchQuery, selectedContinent, countries, filteredCountries.length]);

  const activeCountry = selectedIso
    ? countryMap.get(selectedIso)
    : hoveredIso
      ? countryMap.get(hoveredIso)
      : null;

  // Grouping for Continent Grouped Mode (Default & Elegant)
  const continentGroups = React.useMemo(() => {
    const groups: {
      id: string;
      name: string;
      identity: ContinentIdentity;
      items: WorldCountryItem[];
      totalPopulation: number;
      totalArea: number;
    }[] = [];

    for (const key of CONTINENT_KEYS) {
      const meta = CONTINENT_META[key];
      if (!meta) continue;
      if (selectedContinent !== "ALL" && selectedContinent !== key) continue;
      const items = filteredCountries.filter((c) => c.continent === key);
      if (items.length > 0) {
        const totalPopulation = items.reduce((acc, c) => acc + (c.population || 0), 0);
        const totalArea = items.reduce((acc, c) => acc + (c.areaKm2 || 0), 0);
        groups.push({
          id: key,
          name: isEn ? meta.nameEn : meta.name,
          identity: meta.identity,
          items,
          totalPopulation,
          totalArea,
        });
      }
    }
    return groups;
  }, [filteredCountries, selectedContinent, isEn]);

  // Grouping for Fihrist (A-Z Blocks) Mode
  const fihristGroups = React.useMemo(() => {
    const groups: Record<string, WorldCountryItem[]> = {};
    for (const letter of alphabet) {
      const matching = filteredCountries.filter((c) => {
        const name = isEn ? c.nameEn : c.nameTr;
        return name.toLocaleUpperCase(isEn ? "en-US" : "tr-TR").startsWith(letter);
      });
      if (matching.length > 0) {
        groups[letter] = matching;
      }
    }
    return groups;
  }, [filteredCountries, alphabet, isEn]);

  // Dynamic tooltip positioning with boundary guard
  const getTooltipStyle = () => {
    const tooltipWidth = 240;
    const tooltipHeight = 180;

    let left = mousePos.x + 15;
    let top = mousePos.y + 15;

    if (left + tooltipWidth > containerDim.width - 10) {
      left = mousePos.x - tooltipWidth - 15;
    }
    if (top + tooltipHeight > containerDim.height - 10) {
      top = mousePos.y - tooltipHeight - 15;
    }

    return {
      top: `${Math.max(10, top)}px`,
      left: `${Math.max(10, left)}px`,
    };
  };

  return (
    <div className="space-y-8">
      {/* 1. INTERACTIVE VECTOR WORLD MAP CANVAS */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 p-5 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm" dot>
                {isEn ? "World Vector Canvas" : "Genişletilmiş Dünya Vektör Tuvali"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {isEn ? "199 Countries & Territories + 7 Continents" : "199 Ülke ve Bölge + 7 Kıta"}
              </span>
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
              {isEn
                ? "Interactive World Map & Country Explorer"
                : "İnteraktif Dünya Haritası & Ülkeler Kataloğu"}
            </h3>
          </div>

          {/* Continent Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl bg-muted border border-border text-xs scrollbar-none max-w-full">
            <button
              type="button"
              onClick={() => {
                setSelectedContinent("ALL");
                setSelectedLetter(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
                selectedContinent === "ALL"
                  ? "bg-card text-primary font-bold shadow-xs border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isEn ? "All Countries (199)" : "Tüm Dünya (199)"}
            </button>
            {CONTINENT_KEYS.map((key) => {
              const meta = CONTINENT_META[key];
              if (!meta) return null;
              const isSelected = selectedContinent === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedContinent(key);
                    setSelectedLetter(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? `bg-card ${meta.identity.label} font-bold shadow-xs border ${meta.identity.edge}`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isEn ? meta.nameEn : meta.name} ({meta.count})
                </button>
              );
            })}
          </div>
        </div>

        {/* EDGE-TO-EDGE World Map Panel, and its caption. A FIGURE, like every other map
            surface here — the credit below is this map's caption and was written as a bare `<p>`
            sibling while the province locator next door said the same thing as a `<figcaption>`.
            `m-0` because a `<figure>` carries a UA margin a `<div>` does not. Under `sm` the
            figure breaks out of the panel's `p-5` (`-mx-5`, +40px of map on a 360px phone,
            T-092) and the map box drops its side border and corners, which would otherwise sit
            against the panel's own edge; the toolbar, selection card and caption put the 20px
            back so only the map runs edge to edge. */}
        <figure className="-mx-5 my-0 space-y-2 sm:mx-0">
          {/* Positioning context for the toolbar and card, which sit outside the map box on a
            phone and float over it from `sm`. */}
          <div className="relative">
            {/* Map Controls. A row above the map on a phone, where the box is only as tall as the map
              (T-079) and a floating bar would cover it; floating over the map from `sm`. */}
            <div
              data-map-toolbar
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="mb-2 mr-5 ml-auto flex w-fit items-center gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg sm:absolute sm:top-3 sm:right-3 sm:z-30 sm:mr-0 sm:mb-0"
            >
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
                disabled={zoom <= 1}
                aria-label={t("zoomOut")}
                className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ZoomOut className="size-4" />
              </button>
              {zoom > 1 && (
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

            {/* No minimum height (T-079): the world has nothing beyond its poles to fill a taller
            box with, so any floor becomes letterbox painted as ocean on a phone. */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onMouseLeave={() => {
                if (!isPanning && !isPointerDownRef.current) {
                  setHoveredIso(null);
                }
              }}
              className={`relative rounded-none border-y border-border bg-[var(--map-ocean)] overflow-hidden sm:rounded-2xl sm:border-x p-0 group aspect-[1008/520] w-full select-none ${
                zoom > 1
                  ? `touch-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`
                  : "cursor-crosshair"
              }`}
            >
              {/* SVG Map Canvas with Zoom & Pan Transform */}
              <div
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.2s ease-out",
                }}
                className="w-full h-full"
              >
                <svg
                  viewBox={WORLD_MAP_VIEWBOX}
                  className="w-full h-full select-none block"
                  aria-label="İnteraktif Dünya Haritası"
                >
                  <defs>
                    <filter id="country-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow
                        dx="0"
                        dy="0"
                        stdDeviation="3"
                        floodColor="var(--primary)"
                        floodOpacity="0.8"
                      />
                    </filter>
                  </defs>

                  {/* Background Ocean Layer */}
                  <rect
                    width="1008"
                    height="520"
                    className="fill-[var(--map-ocean)]"
                    onMouseEnter={() => setHoveredIso(null)}
                  />

                  {/* Graticules / Latitude-Longitude Grid. FULL STRENGTH, no `/60`: an opacity
                  utility is part of the rendered colour, so the `/60` this group carried put
                  the two tropics at 2.26:1 light / 2.34:1 dark on `--map-ocean` -- under
                  GRAPHICAL_MIN, and under the 4.03/4.49 that `app/globals.css` and
                  `lib/theme/map-surface.test.ts` both record for `--map-graticule`, which
                  only the equator and the prime meridian below actually reached. One value,
                  one measurement, every line: 4.03 light / 4.49 dark. The major/minor
                  hierarchy is carried by STROKE WIDTH (0.8 against 0.5), which costs no
                  contrast. */}
                  <g className="stroke-[var(--map-graticule)] stroke-[0.5] stroke-dasharray-[2,4] pointer-events-none">
                    <line
                      x1="0"
                      y1="260"
                      x2="1008"
                      y2="260"
                      className="stroke-[var(--map-graticule)] stroke-[0.8]"
                    />
                    <line x1="0" y1="195" x2="1008" y2="195" />
                    <line x1="0" y1="325" x2="1008" y2="325" />
                    <line
                      x1="504"
                      y1="0"
                      x2="504"
                      y2="520"
                      className="stroke-[var(--map-graticule)] stroke-[0.8]"
                    />
                  </g>

                  {/* Graticule Text Labels */}
                  <g className="fill-[var(--map-graticule)] text-[7.5px] font-mono select-none pointer-events-none">
                    <text x="8" y="257">
                      EKVATOR (0°)
                    </text>
                    <text x="8" y="192">
                      YENGEÇ DÖNENCESİ (23.5°K)
                    </text>
                    <text x="8" y="322">
                      OĞLAK DÖNENCESİ (23.5°G)
                    </text>
                    <text x="508" y="14">
                      0° MERİDYENİ
                    </text>
                  </g>

                  {/* Country Polygons */}
                  <g fillRule="evenodd" style={{ "--map-zoom": zoom } as React.CSSProperties}>
                    {COUNTRY_SHAPES.map((shape) => {
                      const item = countryMap.get(shape.iso);
                      const continentMeta = item ? CONTINENT_META[item.continent] : null;
                      const isHovered = hoveredIso === shape.iso;
                      const isSelected = selectedIso === shape.iso;
                      const isMatchingContinent =
                        selectedContinent === "ALL" || item?.continent === selectedContinent;

                      // `--map-ocean`, NOT `--map-context-line`, and this is measured rather
                      // than matched to the Türkiye maps by name. `--map-context-line` is tuned
                      // against `--map-context-land` (3.18/3.54) and was never measured against
                      // THIS fill: on `--map-unknown-land` it reads 1.23:1 light / 1.04:1 dark,
                      // so the border between two adjacent un-continent countries was WORSE than
                      // the slate-400/45 line it replaced (1.97 light / 2.04 dark) even as
                      // the fill improved 1.67 -> 3.66. The ocean tone clears 3.66:1 light /
                      // 4.07:1 dark on that fill and is the only existing token that clears the
                      // floor without flipping polarity between themes -- /dunya is dark in BOTH,
                      // so a stroke that is white in light and near-black in dark (`--map-land`,
                      // `--card`, `--background`) is wrong here for the same reason `--map-hover`
                      // is one literal in both blocks. The outer edge, ocean line on ocean, is
                      // 1:1 by construction and costs nothing: the land/sea boundary is carried
                      // by the FILL's own 3.66/4.07 silhouette, which is what WCAG 1.4.11 asks
                      // of. `lib/theme/map-surface.test.ts` holds the pairing.
                      //
                      // Every width below is `--country-stroke`, in CSS PIXELS, never in viewBox
                      // units: the viewBox is 1000 wide, so a unitless 0.4 drew 0.108px on a
                      // 360px phone (T-092). The `<path>` turns it into `stroke-width` on a
                      // `non-scaling-stroke`, divided by `--map-zoom` (set on the `<g>`), because
                      // zoom is a CSS `scale()` on an HTML wrapper, which `non-scaling-stroke`
                      // does not undo: without the division a 0.75px border drew 2.85px at 3.8x.
                      let fillClass =
                        "fill-[var(--map-unknown-land)] stroke-[var(--map-ocean)] [--country-stroke:0.75px]";

                      if (item && continentMeta) {
                        // The border between two countries of ONE continent is `--map-ocean`,
                        // the ground colour, so it reads as a gap in the fill. It used to be the
                        // continent's own colour at /50, i.e. the fill drawn over the fill:
                        // neighbours in a continent merged into one blob (T-092). Measured in
                        // `lib/theme/map-surface.test.ts`: 3.35:1 (Avrupa, the worst) to 13.15:1
                        // light, 3.74:1 to 14.65:1 dark. The selected-continent view keeps the
                        // same line at 1px: `stroke-white/80`, which the T-092 plan named there,
                        // measures 1.25:1 on Antarktika, 1.92 Asya, 1.97 Kuzey Amerika, 2.51
                        // Okyanusya and 2.72 Afrika, so it could not separate those neighbours.
                        if (selectedContinent === "ALL") {
                          fillClass = `${continentMeta.identity.fill} stroke-[var(--map-ocean)] [--country-stroke:0.75px]`;
                        } else if (isMatchingContinent) {
                          fillClass = `${continentMeta.identity.fill} stroke-[var(--map-ocean)] [--country-stroke:1px]`;
                        } else {
                          // The `hover:fill-[var(--map-unknown-land)]/80` that used to sit here
                          // is GONE, and it was dead before it was wrong: `isHovered` is React
                          // state set by this path's own `onMouseEnter`, and the branch below
                          // replaces `fillClass` outright with the `--map-hover` highlight, so
                          // the CSS hover never rendered. Measured anyway, because a dead class
                          // is still a recorded intent: /80 over `--map-ocean` is 2.80:1 light /
                          // 3.02:1 dark, i.e. the hover would have DROPPED the country under the
                          // 3:1 floor its resting fill clears at 3.66/4.07.
                          fillClass =
                            "fill-[var(--map-unknown-land)] stroke-[var(--map-ocean)] [--country-stroke:0.75px] transition-colors";
                        }
                      }

                      if (isHovered || isSelected) {
                        // ONE token, not a light/dark pair: /dunya is dark in both themes, so the
                        // highlight has only ever one ground (--map-ocean) to be measured against.
                        // Fix round 1 tried a theme-aware split (--map-graticule light /
                        // --primary-strong dark) because --primary-strong's dark value cleared
                        // 9.33:1 against the dark ocean; but its LIGHT value is #7e3a1e, ink
                        // calibrated for a light surface, which measured only 2.08:1 against the
                        // light ocean -- worse than --map-graticule's 4.03:1, not better. --map-hover
                        // pins that same dark-mode value (#f49f80) as a literal in BOTH `:root` and
                        // `.dark`, which is what makes it work in light too: 8.38:1 light / 9.33:1
                        // dark full strength, 7.00:1 / 7.71:1 at the /90 this fill renders at --
                        // above every continent's own contrast against --map-ocean except
                        // Antarktika's outlier (see app/globals.css and map-surface.test.ts for the
                        // full measurement, including where it does NOT clear the top two).
                        fillClass =
                          "stroke-[var(--map-hover)] [--country-stroke:1.5px] fill-[var(--map-hover)]/90 opacity-100";
                      }

                      const cItem = countryMap.get(shape.iso);
                      const countryName = cItem ? (isEn ? cItem.nameEn : cItem.nameTr) : shape.iso;

                      return (
                        <path
                          key={shape.iso}
                          d={shape.d}
                          data-iso={shape.iso}
                          role="button"
                          tabIndex={0}
                          aria-label={countryName}
                          className={`transition-colors duration-150 cursor-pointer outline-none [vector-effect:non-scaling-stroke] [stroke-width:calc(var(--country-stroke)/var(--map-zoom))] focus-visible:stroke-primary focus-visible:[--country-stroke:2px] ${fillClass}`}
                          style={isHovered ? { filter: "url(#country-glow)" } : undefined}
                          onMouseEnter={() => setHoveredIso(shape.iso)}
                          onMouseLeave={() => setHoveredIso(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedIso(shape.iso);
                            }
                          }}
                          onClick={() => {
                            if (!hasDraggedRef.current) {
                              setSelectedIso(shape.iso);
                            }
                          }}
                        />
                      );
                    })}
                  </g>
                </svg>
              </div>

              {/* DYNAMIC FLOATING TOOLTIP */}
              {hoveredIso && countryMap.get(hoveredIso) && !isPanning && (
                <div
                  className="absolute z-30 pointer-events-none rounded-2xl bg-card/95 backdrop-blur-xl border border-border/90 p-3.5 shadow-2xl text-xs space-y-2 min-w-[200px] max-w-[260px] animate-in fade-in-50 zoom-in-95 duration-100"
                  style={getTooltipStyle()}
                >
                  {(() => {
                    const item = countryMap.get(hoveredIso)!;
                    const continentMeta = CONTINENT_META[item.continent];
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            {item.hasFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={`/flags/${item.isoCode.toUpperCase()}.svg`}
                                alt={`${item.nameTr} bayrağı`}
                                className="w-6 h-4 object-cover rounded-xs border border-border/60 shadow-2xs"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-heading font-bold text-foreground text-sm block leading-tight">
                                  {isEn ? item.nameEn : item.nameTr}
                                </span>
                                {item.isSpecialStatus && <SpecialStatusBadge isEn={isEn} />}
                              </div>
                              <span className="text-[10px] text-muted-foreground block">
                                {isEn ? item.nameTr : item.nameEn}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                            {item.isoCode}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>{isEn ? "Continent:" : "Kıta:"}</span>
                            <span className="font-medium text-foreground">
                              {continentMeta
                                ? isEn
                                  ? continentMeta.nameEn
                                  : continentMeta.name
                                : item.continent}
                            </span>
                          </div>
                          {item.population !== null && item.population !== undefined && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>{isEn ? "Population:" : "Nüfus:"}</span>
                              <span className="font-mono font-bold text-primary">
                                {item.population.toLocaleString(isEn ? "en-US" : "tr-TR")}
                              </span>
                            </div>
                          )}
                          {item.areaKm2 !== null && item.areaKm2 !== undefined && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>{isEn ? "Area:" : "Yüzölçümü:"}</span>
                              <span className="font-mono font-medium text-foreground">
                                {item.areaKm2.toLocaleString(isEn ? "en-US" : "tr-TR")} km²
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-1 text-[10px] text-primary font-semibold flex items-center justify-between border-t border-border/60">
                          <span>{isEn ? "Click to inspect" : "Tıkla ve İncele"}</span>
                          <ArrowRight className="size-3" />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            {/* Active Selected Country Card: under the map on a phone, over it from `sm` (T-079). */}
            {selectedIso && activeCountry && (
              <MapSelectionCard
                className="mx-5 mt-2 sm:absolute sm:bottom-3 sm:left-3 sm:z-30 sm:mx-0 sm:mt-0 sm:max-w-sm"
                leading={
                  activeCountry.hasFlag ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/flags/${activeCountry.isoCode.toUpperCase()}.svg`}
                      alt={`${activeCountry.nameTr} bayrağı`}
                      className="h-7 w-10 rounded-xs border border-border object-cover shadow-2xs"
                    />
                  ) : undefined
                }
                title={isEn ? activeCountry.nameEn : activeCountry.nameTr}
                badges={
                  <>
                    <Badge variant="outline" size="sm" className="px-1 py-0 font-mono text-[9px]">
                      {activeCountry.isoCode}
                    </Badge>
                    {activeCountry.isSpecialStatus && <SpecialStatusBadge isEn={isEn} />}
                  </>
                }
                stats={[
                  activeCountry.population
                    ? t("statPopulation", { count: activeCountry.population })
                    : null,
                  activeCountry.areaKm2 ? t("statArea", { area: activeCountry.areaKm2 }) : null,
                ].filter((stat): stat is string => stat !== null)}
                href={activeCountry.path as unknown as React.ComponentProps<typeof Link>["href"]}
                exploreLabel={t("explore")}
                closeLabel={t("closeSelection")}
                onClose={() => setSelectedIso(null)}
              />
            )}
          </div>

          {/* The source of the 199 polygons above. UNDER the map box and never on it
            (`v2-map-credit-placement.test.ts`): a credit inside the box is a credit drawn over
            the map, which two owner rulings removed. A FIGCAPTION, because that is the
            relationship — this was a bare `<p>` while the province locator next door said the
            same thing as a caption. `boundaries={false}` because this surface draws no OSM
            geometry — the province layer is a different map. */}
          <figcaption className="px-5 sm:px-0">
            <MapAttribution boundaries={false} world />
          </figcaption>
        </figure>
      </div>

      {/* MIDDLE SECTIONS: 7 CONTINENTS GUIDE & GEOGRAPHIC EXTREMES SPOTLIGHT */}
      {middleSections && <div key="middle-sections-container">{middleSections}</div>}

      {/* 2. WORLD COUNTRIES CATALOGUE & CONTROLS */}
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
          onValueChange={(value) => setViewMode(value as "continent" | "table" | "fihrist")}
          variant="pills"
          className="space-y-6"
        >
          <div className="border-b border-border pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="sm">
                  {isEn ? "199 Countries Catalogue" : "199 Ülke Kataloğu"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {filteredCountries.length} {isEn ? "Countries Listed" : "Ülke Listeleniyor"}
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
                {isEn
                  ? "World Countries & Geography Registry"
                  : "Dünya Ülkeleri Kataloğu & Coğrafi Detaylar"}
              </h3>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={
                    isEn ? "Search country or ISO code..." : "Ülke adı veya ISO kodu ara..."
                  }
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

              {/* Sort Buttons */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs w-full md:w-auto justify-between">
                <button
                  type="button"
                  onClick={() => setSortBy("name")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    sortBy === "name"
                      ? "bg-card text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  A-Z İsim
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

              {/* View Mode Switcher */}
              <TabsList aria-label="Görünüm Seçenekleri" className="h-auto p-1">
                <TabsTrigger
                  value="continent"
                  className="gap-1 px-2.5 text-xs font-semibold"
                  aria-label={t("continentGroupedView")}
                >
                  <Layers className="size-3.5" />
                  <span className="hidden sm:inline">Kıta Gruplu</span>
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

          {/* Search Restriction Helper Banner */}
          {isSearchRestrictedByContinent && (
            <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 text-xs text-warning-strong flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="size-4 shrink-0 text-warning-strong" />
                <span>
                  <strong>{CONTINENT_META[selectedContinent]?.name ?? selectedContinent}</strong>{" "}
                  {isEn ? "filter is active, but no results found for" : "filtresi etkinken"} &quot;
                  {searchQuery}&quot; {isEn ? "" : "bulunamadı."}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5 bg-card border-warning/40 text-warning-strong"
                onClick={() => setSelectedContinent("ALL")}
              >
                {isEn ? "Search All Countries" : "Tüm Dünyada Ara"}
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
              {isEn ? "All" : "Tümü"}
            </button>
            {alphabet.map((letter) => {
              const hasCountries = countries.some((c) => {
                const name = isEn ? c.nameEn : c.nameTr;
                return name.toLocaleUpperCase(isEn ? "en-US" : "tr-TR").startsWith(letter);
              });
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!hasCountries}
                  onClick={() => setSelectedLetter(isSelected ? null : letter)}
                  className={`size-7 rounded-lg text-xs font-medium shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : hasCountries
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
              {isEn ? "Total " : "Toplam "}
              <strong className="text-foreground font-semibold">
                {filteredCountries.length}
              </strong>{" "}
              {isEn ? "countries listed." : "ülke listeleniyor."}
            </span>
            {(searchQuery || selectedLetter || selectedContinent !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedLetter(null);
                  setSelectedContinent("ALL");
                }}
                className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <X className="size-3" /> {isEn ? "Clear All Filters" : "Tüm Filtreleri Temizle"}
              </button>
            )}
          </div>

          {/* 1. CONTINENT GROUPED VIEW (DEFAULT & COMPACT) */}
          <TabsContent value="continent" className="space-y-6">
            {continentGroups.map((group) => (
              <div
                key={group.id}
                className={`rounded-3xl border ${group.identity.edge} bg-card overflow-hidden shadow-sm transition-all`}
              >
                {/* Continent Section Header Banner — the continent's own identity, not a
                    two-stop gradient of an unrelated hue with white text on it. `[&_h4]:text-inherit`
                    is load-bearing: `app/globals.css`'s base rule `h1,h2,h3,h4 { color: var(--foreground) }`
                    beats a merely inherited colour, so without the escape the heading ignores the
                    banner's label member and renders plain foreground. The same fix
                    `v2-turkey-map-explorer.tsx` carries on its region banner.
                    BACKDROP: one `--continent-*-tint` over `--card` — the `CARD` column of the
                    table in `app/globals.css`, because this panel is opaque and nothing else
                    paints over it. */}
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
                        {group.items.length} {isEn ? "Countries" : "Ülke"} ·{" "}
                        {group.totalPopulation > 0
                          ? `${group.totalPopulation.toLocaleString(isEn ? "en-US" : "tr-TR")} ${isEn ? "Population" : "Nüfus"}`
                          : ""}{" "}
                        ·{" "}
                        {group.totalArea > 0
                          ? `${group.totalArea.toLocaleString(isEn ? "en-US" : "tr-TR")} km²`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-xs">
                    {isEn ? "Continent" : "Kıta Havzası"}
                  </Badge>
                </div>

                {/* Compact Mini-Card Grid */}
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {group.items.map((country) => {
                    const v2Path = country.path.startsWith("/")
                      ? country.path
                      : `/v2${country.path}`;
                    return (
                      <Link
                        key={country.isoCode}
                        href={v2Path as unknown as React.ComponentProps<typeof Link>["href"]}
                        className="p-3 rounded-2xl border border-border/80 bg-muted/20 hover:bg-card hover:border-primary/60 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {country.hasFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={`/flags/${country.isoCode.toUpperCase()}.svg`}
                                alt={`${country.nameTr} bayrağı`}
                                className="w-6 h-4 object-cover rounded-xs border border-border shadow-2xs group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            )}
                            <span className="font-mono text-[10px] text-muted-foreground font-bold">
                              {country.isoCode}
                            </span>
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors block">
                              {isEn ? country.nameEn : country.nameTr}
                            </span>
                            {country.isSpecialStatus && <SpecialStatusBadge isEn={isEn} />}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                            {country.population && (
                              <span>{t("statPopulation", { count: country.population })}</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-primary font-medium">
                          <span>
                            {country.areaKm2
                              ? `${country.areaKm2.toLocaleString(isEn ? "en-US" : "tr-TR")} km²`
                              : isEn
                                ? "Explore"
                                : "Detay"}
                          </span>
                          <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </Link>
                    );
                  })}
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
                  <TableHead className="w-14">{isEn ? "Flag" : "Bayrak"}</TableHead>
                  <TableHead className="w-16">ISO</TableHead>
                  <TableHead>{isEn ? "Country Name" : "Ülke Adı"}</TableHead>
                  <TableHead>{isEn ? "Continent" : "Kıta"}</TableHead>
                  <TableHead className="text-right">{isEn ? "Population" : "Nüfus"}</TableHead>
                  <TableHead className="text-right">
                    {isEn ? "Area (km²)" : "Yüzölçümü (km²)"}
                  </TableHead>
                  <TableHead className="text-right w-24">{isEn ? "Action" : "İşlem"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCountries.map((country) => {
                  const continentMeta = CONTINENT_META[country.continent];
                  const v2Path = country.path.startsWith("/") ? country.path : `/v2${country.path}`;
                  return (
                    <TableRow key={country.isoCode} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        {country.hasFlag ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/flags/${country.isoCode.toUpperCase()}.svg`}
                            alt={`${country.nameTr} bayrağı`}
                            className="w-7 h-4.5 object-cover rounded-xs border border-border shadow-2xs"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary text-xs">
                        {country.isoCode}
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={v2Path as unknown as React.ComponentProps<typeof Link>["href"]}
                            className="hover:text-primary hover:underline transition-colors"
                          >
                            {isEn ? country.nameEn : country.nameTr}
                          </Link>
                          {country.isSpecialStatus && <SpecialStatusBadge isEn={isEn} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* `label` + `edge` on the variant's opaque `bg-card`, NOT the tinted
                            `badge` member: this row carries `hover:bg-muted/50`, and a 15% tint
                            over that over `--card` takes Avrupa's dark label to 4.41:1. An
                            opaque chip is immune to the row state. See the `ROW` note beside
                            `--continent-*-text` in `app/globals.css`. */}
                        <Badge
                          variant="outline"
                          size="sm"
                          className={continentMeta?.identity.badgeOpaque}
                        >
                          {continentMeta
                            ? isEn
                              ? continentMeta.nameEn
                              : continentMeta.name
                            : country.continent}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        {country.population
                          ? country.population.toLocaleString(isEn ? "en-US" : "tr-TR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground">
                        {country.areaKm2
                          ? `${country.areaKm2.toLocaleString(isEn ? "en-US" : "tr-TR")} km²`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={v2Path as unknown as React.ComponentProps<typeof Link>["href"]}>
                          <Button
                            variant="ghost"
                            size="sm"
                            rightIcon={<ArrowRight className="size-3.5" />}
                          >
                            {isEn ? "Explore" : "İncele"}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          {/* 3. FIHRIST (A-Z BLOCKS) VIEW */}
          <TabsContent value="fihrist" className="space-y-6">
            {Object.entries(fihristGroups).map(([letter, groupList]) => (
              <div key={letter} className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <span className="size-7 rounded-xl bg-primary text-white font-heading font-bold text-sm flex items-center justify-center">
                    {letter}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {groupList.length} {isEn ? "Countries" : "Ülke"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 items-start">
                  {groupList.map((c) => {
                    const v2Path = c.path.startsWith("/") ? c.path : `/v2${c.path}`;
                    return (
                      <Link
                        key={c.isoCode}
                        href={v2Path as unknown as React.ComponentProps<typeof Link>["href"]}
                        className="p-2.5 rounded-xl border border-border/70 hover:border-primary hover:bg-muted/50 transition-all flex items-center justify-between text-xs group"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.hasFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={`/flags/${c.isoCode.toUpperCase()}.svg`}
                                alt={`${c.nameTr} bayrağı`}
                                className="w-4 h-3 object-cover rounded-2xs shrink-0"
                                loading="lazy"
                              />
                            )}
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {isEn ? c.nameEn : c.nameTr}
                            </span>
                          </div>
                          {c.isSpecialStatus && (
                            <SpecialStatusBadge isEn={isEn} className="text-[8px] px-1 py-0" />
                          )}
                        </div>
                        <ChevronRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
