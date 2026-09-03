"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
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
}

export const CONTINENT_META: Record<
  string,
  {
    name: string;
    nameEn: string;
    color: string;
    hoverColor: string;
    strokeColor: string;
    badgeClass: string;
    headerClass: string;
    borderClass: string;
    textClass: string;
    count: number;
  }
> = {
  AVRUPA: {
    name: "Avrupa",
    nameEn: "Europe",
    color: "fill-indigo-600/85 dark:fill-indigo-500/85",
    hoverColor: "hover:fill-indigo-500 dark:hover:fill-indigo-400",
    strokeColor: "stroke-indigo-400/50",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    headerClass: "from-indigo-700 to-blue-900",
    borderClass: "border-indigo-500/30",
    textClass: "text-indigo-700 dark:text-indigo-300",
    count: 44,
  },
  ASYA: {
    name: "Asya",
    nameEn: "Asia",
    color: "fill-amber-600/85 dark:fill-amber-500/85",
    hoverColor: "hover:fill-amber-500 dark:hover:fill-amber-400",
    strokeColor: "stroke-amber-400/50",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    headerClass: "from-amber-700 to-orange-950",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-700 dark:text-amber-300",
    count: 48,
  },
  AFRIKA: {
    name: "Afrika",
    nameEn: "Africa",
    color: "fill-emerald-600/85 dark:fill-emerald-500/85",
    hoverColor: "hover:fill-emerald-500 dark:hover:fill-emerald-400",
    strokeColor: "stroke-emerald-400/50",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    headerClass: "from-emerald-700 to-emerald-950",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    count: 54,
  },
  KUZEY_AMERIKA: {
    name: "Kuzey Amerika",
    nameEn: "North America",
    color: "fill-sky-600/85 dark:fill-sky-500/85",
    hoverColor: "hover:fill-sky-500 dark:hover:fill-sky-400",
    strokeColor: "stroke-sky-400/50",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    headerClass: "from-sky-700 to-cyan-950",
    borderClass: "border-sky-500/30",
    textClass: "text-sky-700 dark:text-sky-300",
    count: 23,
  },
  GUNEY_AMERIKA: {
    name: "Güney Amerika",
    nameEn: "South America",
    color: "fill-rose-600/85 dark:fill-rose-500/85",
    hoverColor: "hover:fill-rose-500 dark:hover:fill-rose-400",
    strokeColor: "stroke-rose-400/50",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    headerClass: "from-rose-700 to-rose-950",
    borderClass: "border-rose-500/30",
    textClass: "text-rose-700 dark:text-rose-300",
    count: 12,
  },
  OKYANUSYA: {
    name: "Okyanusya",
    nameEn: "Oceania",
    color: "fill-purple-600/85 dark:fill-purple-500/85",
    hoverColor: "hover:fill-purple-500 dark:hover:fill-purple-400",
    strokeColor: "stroke-purple-400/50",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    headerClass: "from-purple-700 to-purple-950",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-700 dark:text-purple-300",
    count: 14,
  },
  ANTARKTIKA: {
    name: "Antarktika",
    nameEn: "Antarctica",
    color: "fill-teal-600/85 dark:fill-teal-500/85",
    hoverColor: "hover:fill-teal-500 dark:hover:fill-teal-400",
    strokeColor: "stroke-teal-400/50",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    headerClass: "from-teal-700 to-teal-950",
    borderClass: "border-teal-500/30",
    textClass: "text-teal-700 dark:text-teal-300",
    count: 1,
  },
};

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
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isEn = locale === "en";
  const alphabet = isEn ? ALPHABET_EN : ALPHABET_TR;

  const countryMap = React.useMemo(() => {
    const map = new Map<string, WorldCountryItem>();
    for (const c of countries) {
      map.set(c.isoCode, c);
    }
    return map;
  }, [countries]);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
        return;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    [isPanning, dragStart],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsPanning(true);
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.4, 4));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.4, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
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
      headerClass: string;
      borderClass: string;
      textClass: string;
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
          headerClass: meta.headerClass,
          borderClass: meta.borderClass,
          textClass: meta.textClass,
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
                      ? `bg-card ${meta.textClass} font-bold shadow-xs border ${meta.borderClass}`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isEn ? meta.nameEn : meta.name} ({meta.count})
                </button>
              );
            })}
          </div>
        </div>

        {/* EDGE-TO-EDGE World Map Panel */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (!isPanning) {
              setHoveredIso(null);
            }
          }}
          className="relative rounded-2xl bg-[#0d1b2a] dark:bg-[#070e17] border border-border overflow-hidden p-0 group aspect-[1008/520] min-h-[320px] sm:min-h-[460px] w-full cursor-crosshair select-none"
        >
          {/* Map Controls Floating Bar */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg">
            <button
              type="button"
              onClick={handleZoomIn}
              title={isEn ? "Zoom In (+)" : "Yakınlaştır (+)"}
              className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              title={isEn ? "Zoom Out (-)" : "Uzaklaştır (-)"}
              className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ZoomOut className="size-4" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                title={isEn ? "Reset View" : "Haritayı Sıfırla"}
                className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer text-xs font-mono"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>

          {/* Active Selected Country Card */}
          {selectedIso && activeCountry && (
            <div className="absolute bottom-3 left-3 z-30 flex items-center gap-3 bg-card/95 backdrop-blur-md p-3 rounded-2xl border border-primary/40 shadow-xl max-w-sm animate-in fade-in-50 duration-200">
              {activeCountry.hasFlag && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/flags/${activeCountry.isoCode.toUpperCase()}.svg`}
                  alt={`${activeCountry.nameTr} bayrağı`}
                  className="w-10 h-7 object-cover rounded-xs border border-border shadow-2xs shrink-0"
                />
              )}
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-foreground text-sm truncate">
                    {isEn ? activeCountry.nameEn : activeCountry.nameTr}
                  </span>
                  <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 font-mono">
                    {activeCountry.isoCode}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                  {activeCountry.population && (
                    <span>
                      {activeCountry.population.toLocaleString(isEn ? "en-US" : "tr-TR")} kişi
                    </span>
                  )}
                  {activeCountry.areaKm2 && (
                    <span>
                      · {activeCountry.areaKm2.toLocaleString(isEn ? "en-US" : "tr-TR")} km²
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={activeCountry.path as unknown as React.ComponentProps<typeof Link>["href"]}
                className="ml-auto shrink-0"
              >
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 text-xs font-semibold px-2.5"
                  rightIcon={<ArrowRight className="size-3.5" />}
                >
                  {isEn ? "Explore" : "İncele"}
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedIso(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

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
                    floodColor="#f59e0b"
                    floodOpacity="0.8"
                  />
                </filter>
                <linearGradient id="ocean-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0b192c" />
                  <stop offset="50%" stopColor="#1e3e62" />
                  <stop offset="100%" stopColor="#000000" />
                </linearGradient>
              </defs>

              {/* Background Ocean Layer */}
              <rect width="1008" height="520" fill="url(#ocean-gradient)" />

              {/* Graticules / Latitude-Longitude Grid */}
              <g className="stroke-sky-500/15 stroke-[0.5] stroke-dasharray-[2,4] pointer-events-none">
                <line
                  x1="0"
                  y1="260"
                  x2="1008"
                  y2="260"
                  className="stroke-sky-400/40 stroke-[0.8]"
                />
                <line x1="0" y1="195" x2="1008" y2="195" />
                <line x1="0" y1="325" x2="1008" y2="325" />
                <line
                  x1="504"
                  y1="0"
                  x2="504"
                  y2="520"
                  className="stroke-sky-400/30 stroke-[0.8]"
                />
              </g>

              {/* Graticule Text Labels */}
              <g className="fill-sky-400/50 text-[7.5px] font-mono select-none pointer-events-none">
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
              <g fillRule="evenodd">
                {COUNTRY_SHAPES.map((shape) => {
                  const item = countryMap.get(shape.iso);
                  const continentMeta = item ? CONTINENT_META[item.continent] : null;
                  const isHovered = hoveredIso === shape.iso;
                  const isSelected = selectedIso === shape.iso;
                  const isMatchingContinent =
                    selectedContinent === "ALL" || item?.continent === selectedContinent;

                  let fillClass = "fill-slate-600/40 dark:fill-slate-700/40 stroke-slate-500/30";

                  if (item && continentMeta) {
                    if (selectedContinent === "ALL") {
                      fillClass = `${continentMeta.color} ${continentMeta.hoverColor} ${continentMeta.strokeColor} stroke-[0.4]`;
                    } else if (isMatchingContinent) {
                      fillClass = `${continentMeta.color} ${continentMeta.hoverColor} stroke-white/80 stroke-[0.8] shadow-lg`;
                    } else {
                      fillClass = "fill-slate-700/20 stroke-slate-600/10 opacity-30";
                    }
                  }

                  if (isHovered || isSelected) {
                    fillClass = "stroke-yellow-400 stroke-[1.8] fill-yellow-500/90 opacity-100";
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
                      className={`transition-colors duration-150 cursor-pointer outline-none focus-visible:stroke-primary focus-visible:stroke-[2] ${fillClass}`}
                      style={isHovered ? { filter: "url(#country-glow)" } : undefined}
                      onMouseEnter={() => setHoveredIso(shape.iso)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedIso(shape.iso);
                        }
                      }}
                      onClick={() => setSelectedIso(shape.iso)}
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
                          <span className="font-heading font-bold text-foreground text-sm block leading-tight">
                            {isEn ? item.nameEn : item.nameTr}
                          </span>
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
      </div>

      {/* MIDDLE SECTIONS: 7 CONTINENTS GUIDE & GEOGRAPHIC EXTREMES SPOTLIGHT */}
      {middleSections}

      {/* 2. WORLD COUNTRIES CATALOGUE & CONTROLS */}
      <section className="space-y-6">
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

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
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
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs w-full sm:w-auto justify-between">
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
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode("continent")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold px-2.5 ${
                  viewMode === "continent"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Kıta Gruplu Görünüm"
              >
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">Kıta Gruplu</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Detaylı Tablo (Table)"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("fihrist")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "fihrist"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Alfabetik Fihrist (A-Z Bloklar)"
              >
                <AlignLeft className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Restriction Helper Banner */}
        {isSearchRestrictedByContinent && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="size-4 shrink-0 text-amber-600" />
              <span>
                <strong>{CONTINENT_META[selectedContinent]?.name ?? selectedContinent}</strong>{" "}
                {isEn ? "filter is active, but no results found for" : "filtresi etkinken"} &quot;
                {searchQuery}&quot; {isEn ? "" : "bulunamadı."}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2.5 bg-card border-amber-500/40 text-amber-800 dark:text-amber-200"
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
        {viewMode === "continent" && (
          <div className="space-y-6">
            {continentGroups.map((group) => (
              <div
                key={group.id}
                className={`rounded-3xl border ${group.borderClass} bg-card overflow-hidden shadow-sm transition-all`}
              >
                {/* Continent Section Header Banner */}
                <div
                  className={`p-4 sm:p-5 bg-gradient-to-r ${group.headerClass} text-white flex flex-wrap items-center justify-between gap-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs font-bold text-sm">
                      {group.items.length}
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-lg text-white leading-tight">
                        {group.name}
                      </h4>
                      <span className="text-[11px] text-white/80 font-mono">
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

                  <Badge className="bg-white/20 text-white backdrop-blur-xs border-white/30 text-xs">
                    {isEn ? "Continent" : "Kıta Havzası"}
                  </Badge>
                </div>

                {/* Compact Mini-Card Grid */}
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {group.items.map((country) => {
                    const v2Path = country.path.startsWith("/v2")
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
                          <span className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors block">
                            {isEn ? country.nameEn : country.nameTr}
                          </span>
                          <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                            {country.population && (
                              <span>
                                {country.population.toLocaleString(isEn ? "en-US" : "tr-TR")} kişi
                              </span>
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
          </div>
        )}

        {/* 2. TABLE VIEW */}
        {viewMode === "table" && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
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
                  const v2Path = country.path.startsWith("/v2")
                    ? country.path
                    : `/v2${country.path}`;
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
                        <Link
                          href={v2Path as unknown as React.ComponentProps<typeof Link>["href"]}
                          className="hover:text-primary hover:underline transition-colors"
                        >
                          {isEn ? country.nameEn : country.nameTr}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" size="sm" className={continentMeta?.badgeClass}>
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
          </div>
        )}

        {/* 3. FIHRIST (A-Z BLOCKS) VIEW */}
        {viewMode === "fihrist" && (
          <div className="space-y-6">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {groupList.map((c) => {
                    const v2Path = c.path.startsWith("/v2") ? c.path : `/v2${c.path}`;
                    return (
                      <Link
                        key={c.isoCode}
                        href={v2Path as unknown as React.ComponentProps<typeof Link>["href"]}
                        className="p-2.5 rounded-xl border border-border/70 hover:border-primary hover:bg-muted/50 transition-all flex items-center justify-between text-xs group"
                      >
                        <div className="flex items-center gap-2 truncate">
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
                        <ChevronRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
