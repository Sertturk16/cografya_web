"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import type { GeographicRegion } from "@/lib/api/types";
import { REGION_KEYS } from "@/lib/game/region-slug";
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

export const REGION_DATA: Record<
  GeographicRegion,
  {
    id: string;
    name: string;
    count: number;
    color: string;
    badgeClass: string;
    headerClass: string;
    borderClass: string;
    textClass: string;
  }
> = {
  MARMARA: {
    id: "marmara",
    name: "Marmara Bölgesi",
    count: 11,
    color: "fill-amber-600",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    headerClass: "from-amber-700 to-amber-900",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-700 dark:text-amber-300",
  },
  EGE: {
    id: "ege",
    name: "Ege Bölgesi",
    count: 8,
    color: "fill-teal-600",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    headerClass: "from-teal-700 to-teal-900",
    borderClass: "border-teal-500/30",
    textClass: "text-teal-700 dark:text-teal-300",
  },
  AKDENIZ: {
    id: "akdeniz",
    name: "Akdeniz Bölgesi",
    count: 8,
    color: "fill-emerald-600",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    headerClass: "from-emerald-700 to-emerald-900",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  IC_ANADOLU: {
    id: "ic-anadolu",
    name: "İç Anadolu Bölgesi",
    count: 13,
    color: "fill-yellow-600",
    badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    headerClass: "from-yellow-800 to-amber-950",
    borderClass: "border-yellow-500/30",
    textClass: "text-yellow-700 dark:text-yellow-300",
  },
  KARADENIZ: {
    id: "karadeniz",
    name: "Karadeniz Bölgesi",
    count: 18,
    color: "fill-cyan-700",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    headerClass: "from-cyan-800 to-slate-900",
    borderClass: "border-cyan-500/30",
    textClass: "text-cyan-700 dark:text-cyan-300",
  },
  DOGU_ANADOLU: {
    id: "dogu-anadolu",
    name: "Doğu Anadolu Bölgesi",
    count: 14,
    color: "fill-stone-600",
    badgeClass: "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30",
    headerClass: "from-stone-700 to-stone-900",
    borderClass: "border-stone-500/30",
    textClass: "text-stone-700 dark:text-stone-300",
  },
  GUNEYDOGU_ANADOLU: {
    id: "guneydogu-anadolu",
    name: "Güneydoğu Anadolu",
    count: 9,
    color: "fill-orange-600",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    headerClass: "from-orange-800 to-orange-950",
    borderClass: "border-orange-500/30",
    textClass: "text-orange-700 dark:text-orange-300",
  },
};

const COUNTRY_NAMES_TR: Record<string, string> = {
  GR: "Yunanistan",
  BG: "Bulgaristan",
  GE: "Gürcistan",
  AM: "Ermenistan",
  AZ: "Azerbaycan",
  IR: "İran",
  IQ: "Irak",
  SY: "Suriye",
  RU: "Rusya",
  CY: "Kıbrıs",
  LB: "Lübnan",
};

const SEA_LABELS = [
  { name: "KARADENİZ", x: 480, y: -20, fontSize: 18 },
  { name: "MARMARA DENİZİ", x: 145, y: 108, fontSize: 9.5 },
  { name: "EGE DENİZİ", x: -25, y: 240, fontSize: 14 },
  { name: "AKDENİZ", x: 228, y: 480, fontSize: 18 },
];

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
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);

  const provinceMap = React.useMemo(() => {
    const map = new Map<string, ProvinceItem>();
    for (const p of provinces) {
      map.set(p.plateCode, p);
    }
    return map;
  }, [provinces]);

  const trCasing = React.useMemo(() => {
    return CONTEXT_SHAPES.find((c) => c.iso === "TR");
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.4, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.4, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
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
        regionColor: regMeta.color,
        badgeClass: regMeta.badgeClass,
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
      headerClass: string;
      borderClass: string;
      textClass: string;
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
    return provinces.filter((p) => p.coastal).length || 27;
  }, [provinces]);

  return (
    <div className="space-y-8">
      {/* 1. INTERACTIVE VECTOR MAP CANVAS CARD */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 p-5 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm" dot>
                Genişletilmiş Vektör Tuvali
              </Badge>
              <span className="text-xs text-muted-foreground">81 İl + Komşular + Denizler</span>
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
              İnteraktif Türkiye Haritası &amp; Civar Coğrafya
            </h3>
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
                      ? `bg-card ${reg.textClass} font-bold shadow-xs border ${reg.borderClass}`
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

        {/* EDGE-TO-EDGE Map Panel with Zoom & Mouse Tracker */}
        <div
          ref={mapContainerRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (!isDragging) {
              setHoveredPlate(null);
              setMousePos(null);
            }
          }}
          className="relative rounded-2xl bg-[var(--map-sea,#dbe7e8)] dark:bg-[#1a2529] border border-border overflow-hidden p-0 group aspect-[1270/580] min-h-[300px] sm:min-h-[420px] w-full cursor-crosshair select-none"
        >
          {/* Map Controls Floating Bar */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg">
            <button
              type="button"
              onClick={() => setShowRegionColors(!showRegionColors)}
              title={showRegionColors ? "Varsayılan Renkler" : "Bölgeleri Renklendir (Lejant Modu)"}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showRegionColors
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Palette className="size-3.5" />
              <span className="hidden sm:inline">Bölge Renkleri</span>
            </button>

            <div className="h-4 w-px bg-border my-auto mx-0.5" />

            <button
              type="button"
              onClick={handleZoomIn}
              title="Yakınlaştır (+)"
              className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              title="Uzaklaştır (-)"
              className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ZoomOut className="size-4" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                title="Haritayı Sıfırla"
                className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer text-xs font-mono"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>

          {/* Active Selection / Quick Info Bar */}
          {selectedPlate && activeProvince && (
            <div className="absolute bottom-3 left-3 z-30 flex items-center gap-3 bg-card/95 backdrop-blur-md p-3 rounded-2xl border border-primary/40 shadow-xl max-w-sm animate-in fade-in-50 duration-200">
              <div className="size-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center font-mono shrink-0">
                {activeProvince.plateCode}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-foreground text-sm truncate">
                    {activeProvince.name}
                  </span>
                  <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 font-mono">
                    {activeRegionMeta?.name.split(" ")[0]}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                  {activeProvince.population && (
                    <span>{activeProvince.population.toLocaleString("tr-TR")} kişi</span>
                  )}
                  {activeProvince.areaKm2 && (
                    <span>· {activeProvince.areaKm2.toLocaleString("tr-TR")} km²</span>
                  )}
                </div>
              </div>
              <Link
                href={activeProvince.path as unknown as React.ComponentProps<typeof Link>["href"]}
                className="ml-auto shrink-0"
              >
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 text-xs font-semibold px-2.5"
                  rightIcon={<ArrowRight className="size-3.5" />}
                >
                  İncele
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedPlate(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* SVG Map Canvas with Transform */}
          <div
            style={{
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.2s ease-out",
            }}
            className="w-full h-full"
          >
            <svg
              viewBox={TR_CONTEXT_VIEWBOX}
              className="w-full h-full select-none block"
              aria-label="Türkiye 81 İl ve Komşular İnteraktif Haritası"
            >
              {/* 1. Surrounding Foreign Countries */}
              <g
                onMouseEnter={() => setHoveredPlate(null)}
                className="fill-[#f1ece3] dark:fill-[#2d2822] stroke-[#b8aea0] dark:stroke-[#50473e] stroke-[1] stroke-linejoin-round pointer-events-none"
              >
                {CONTEXT_SHAPES.filter((c) => c.iso !== "TR").map((country) => (
                  <path key={country.iso} d={country.d} />
                ))}
              </g>

              {/* 2. Türkiye Casing Base Land */}
              {trCasing && (
                <path
                  d={trCasing.d}
                  className="fill-card dark:fill-[#201c18] pointer-events-none"
                />
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
                    fillColor = `${regMeta.color} opacity-85 hover:opacity-100`;
                  } else if (selectedRegion !== "all" || onlyCoastal) {
                    fillColor = isHighlighted
                      ? `${regMeta.color} opacity-90 hover:opacity-100`
                      : "fill-card/30 opacity-30";
                  }

                  if (isHovered || isSelected) {
                    fillColor =
                      "fill-[var(--color-primary,#b0522e)] filter drop-shadow-md opacity-100";
                  }

                  return (
                    <path
                      key={shape.plateCode}
                      d={shape.d}
                      data-plate={shape.plateCode}
                      onMouseEnter={() => setHoveredPlate(shape.plateCode)}
                      onMouseLeave={() => setHoveredPlate(null)}
                      onClick={() => {
                        setSelectedPlate(shape.plateCode);
                      }}
                      className={`${fillColor} transition-all duration-150 cursor-pointer outline-none hover:stroke-foreground/80 hover:stroke-[1.2]`}
                    />
                  );
                })}
              </g>

              {/* 4. Inland Lakes */}
              <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#1a2529] stroke-[var(--color-accent,#276b70)]/40 stroke-[0.5] pointer-events-none">
                {INLAND_WATER_SHAPES.map((lake) => (
                  <path key={lake.id} d={lake.d} />
                ))}
              </g>

              {/* 5. Surrounding Sea Water Labels */}
              <g className="fill-[var(--color-accent,#276b70)] dark:fill-[#6ec7d1] font-heading font-bold tracking-wider pointer-events-none select-none">
                {SEA_LABELS.map((sea, i) => (
                  <text
                    key={i}
                    x={sea.x}
                    y={sea.y}
                    textAnchor="middle"
                    fontSize={sea.fontSize}
                    className="opacity-80"
                  >
                    {sea.name}
                  </text>
                ))}
              </g>

              {/* 6. Neighbor Country Name Labels */}
              <g className="fill-[#635a4e] dark:fill-[#a89e92] font-sans font-bold text-[12px] pointer-events-none select-none">
                {CONTEXT_SHAPES.filter(
                  (c) => c.iso !== "TR" && !["MK", "RS", "LB", "QN", "CY"].includes(c.iso),
                ).map((country) => {
                  const name = COUNTRY_NAMES_TR[country.iso] || country.geoName;
                  return (
                    <text
                      key={country.iso}
                      x={country.labelPoint.x}
                      y={country.labelPoint.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="tracking-tight opacity-80 select-none"
                    >
                      {name}
                    </text>
                  );
                })}
              </g>
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
                      <span>Tıkla ve İncele</span>
                      <ArrowRight className="size-3" />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* OPTIONAL REGIONS SECTION (7 COĞRAFİ BÖLGE REHBERİ) */}
      {regionsSection}

      {/* 2. PROVINCES CATALOGUE & CONTROLS */}
      <section className="space-y-6">
        <div className="border-b border-border pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" size="sm">
                81 İl Kataloğu
              </Badge>
              <span className="text-xs text-muted-foreground">
                {filteredProvinces.length} İl Listeleniyor
              </span>
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
              İller Listesi &amp; Coğrafi Detaylar
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
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
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs w-full sm:w-auto justify-between">
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

            {/* View Mode Switcher: 3 Modes (Region Grouped / Table / Fihrist) */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode("region")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold px-2.5 ${
                  viewMode === "region"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Bölge Gruplu Görünüm"
              >
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">Bölge Gruplu</span>
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
        {isSearchRestrictedByRegion && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="size-4 shrink-0 text-amber-600" />
              <span>
                <strong>
                  {provinces.find((p) => p.regionId === selectedRegion)?.region
                    ? REGION_DATA[provinces.find((p) => p.regionId === selectedRegion)!.region]
                        ?.name
                    : "Seçili Bölge"}
                </strong>{" "}
                filtresi etkinken &quot;{searchQuery}&quot; bulunamadı.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2.5 bg-card border-amber-500/40 text-amber-800 dark:text-amber-200"
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
            <strong className="text-foreground font-semibold">{filteredProvinces.length}</strong> il
            listeleniyor.
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
              <X className="size-3" /> Tüm Filtreleri Temizle
            </button>
          )}
        </div>

        {/* 1. REGION GROUPED VIEW (DEFAULT & ELEGANT) */}
        {viewMode === "region" && (
          <div className="space-y-6">
            {regionGroupedProvinces.map((group) => (
              <div
                key={group.id}
                className={`rounded-3xl border ${group.borderClass} bg-card overflow-hidden shadow-sm transition-all`}
              >
                {/* Region Section Header Banner */}
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
                        {group.items.length} İl ·{" "}
                        {group.totalPopulation > 0
                          ? `${group.totalPopulation.toLocaleString("tr-TR")} Nüfus`
                          : ""}{" "}
                        ·{" "}
                        {group.totalArea > 0
                          ? `${group.totalArea.toLocaleString("tr-TR")} km²`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <Badge className="bg-white/20 text-white backdrop-blur-xs border-white/30 text-xs">
                    Coğrafi Bölüm
                  </Badge>
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
                          <span
                            title="Kıyı İli (Deniz Telemetrisi Var)"
                            className="size-5 rounded-md bg-accent/10 text-accent flex items-center justify-center"
                          >
                            <Waves className="size-3" />
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
          </div>
        )}

        {/* 2. TABLE VIEW */}
        {viewMode === "table" && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
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
                  <TableHead className="text-right w-24">İşlem</TableHead>
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
                        <span className="text-muted-foreground text-[10px]">İç İl</span>
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
          </div>
        )}

        {/* 3. FIHRIST (A-Z BLOCK) VIEW */}
        {viewMode === "fihrist" && (
          <div className="space-y-6">
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
          </div>
        )}
      </section>
    </div>
  );
}
