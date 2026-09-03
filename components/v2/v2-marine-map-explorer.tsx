"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { projectToMapPoint } from "@/lib/map/projection";
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
  Thermometer,
  ArrowRight,
  Search,
  List,
  X,
  Wind,
  MapPin,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { foldForSearch } from "@/lib/search/normalize";

export interface MarinePointData {
  slugTr: string;
  slugEn: string;
  nameTr: string;
  nameEn: string;
  coastLabelTr: string;
  coastLabelEn: string;
  plateCode: string;
  latitude: number;
  longitude: number;
  seaBasin: "black_sea" | "marmara" | "aegean" | "mediterranean";
  displayOrder: number;
  sst?: number | null;
  waveHeight?: number | null;
  waveDirection?: number | null;
  windSpeed10m?: number | null;
  windDirection10m?: number | null;
  windSpeedKmh?: number | null;
  validAt?: string | null;
  gridDistanceKm?: number | null;
  isStraits?: boolean;
  provinceName?: string;
  provinceSlug?: string;
}

const BASIN_FILTER_META: Record<
  string,
  { name: string; icon: string; color: string; badgeClass: string; title: string }
> & {
  black_sea: { name: string; icon: string; color: string; badgeClass: string; title: string };
  marmara: { name: string; icon: string; color: string; badgeClass: string; title: string };
  aegean: { name: string; icon: string; color: string; badgeClass: string; title: string };
  mediterranean: { name: string; icon: string; color: string; badgeClass: string; title: string };
  all: { name: string; icon: string; color: string; badgeClass: string; title: string };
} = {
  all: {
    name: "Tüm Denizler",
    title: "Tüm Kıyı İstasyonları",
    icon: "Waves",
    color: "fill-primary",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
  },
  black_sea: {
    name: "Karadeniz",
    title: "Karadeniz Havzası (15 İstasyon)",
    icon: "Waves",
    color: "fill-cyan-600",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  },
  marmara: {
    name: "Marmara Denizi",
    title: "Marmara Denizi Havzası (6 İstasyon)",
    icon: "Anchor",
    color: "fill-amber-600",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  aegean: {
    name: "Ege Denizi",
    title: "Ege Denizi Havzası (5 İstasyon)",
    icon: "Sailboat",
    color: "fill-teal-600",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  },
  mediterranean: {
    name: "Akdeniz",
    title: "Akdeniz Havzası (4 İstasyon)",
    icon: "SunMedium",
    color: "fill-rose-600",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
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
  CY: "Güney Kıbrıs Rum Yönetimi",
  LB: "Lübnan",
};

const SEA_LABELS = [
  { name: "KARADENİZ", x: 480, y: -20, fontSize: 18 },
  { name: "MARMARA DENİZİ", x: 145, y: 108, fontSize: 9.5 },
  { name: "EGE DENİZİ", x: -25, y: 240, fontSize: 14 },
  { name: "AKDENİZ", x: 228, y: 480, fontSize: 18 },
];

function getDirectionLabel(deg: number | null | undefined): string {
  if (deg === null || deg === undefined) return "—";
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "Kuzey (K)";
  if (normalized >= 22.5 && normalized < 67.5) return "Kuzeydoğu (KD)";
  if (normalized >= 67.5 && normalized < 112.5) return "Doğu (D)";
  if (normalized >= 112.5 && normalized < 157.5) return "Güneydoğu (GD)";
  if (normalized >= 157.5 && normalized < 202.5) return "Güney (G)";
  if (normalized >= 202.5 && normalized < 247.5) return "Güneybatı (GB)";
  if (normalized >= 247.5 && normalized < 292.5) return "Batı (B)";
  return "Kuzeybatı (KB)";
}

function DirectionArrow({
  deg,
  className = "size-3.5",
}: {
  deg: number | null | undefined;
  className?: string;
}) {
  if (deg === null || deg === undefined) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} inline-block shrink-0 transition-transform`}
      style={{ transform: `rotate(${deg}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="currentColor" />
    </svg>
  );
}

interface V2MarineMapExplorerProps {
  marinePoints: MarinePointData[];
  locale?: string;
}

export function V2MarineMapExplorer({ marinePoints }: V2MarineMapExplorerProps) {
  const [selectedBasin, setSelectedBasin] = React.useState<
    "all" | "black_sea" | "marmara" | "aegean" | "mediterranean"
  >("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortBy, setSortBy] = React.useState<"order" | "temp-desc" | "wave-desc" | "wind-desc">(
    "order",
  );
  const [hoveredSlug, setHoveredSlug] = React.useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);

  const trCasing = React.useMemo(() => {
    return CONTEXT_SHAPES.find((c) => c.iso === "TR");
  }, []);

  const pointMap = React.useMemo(() => {
    const map = new Map<string, MarinePointData>();
    for (const p of marinePoints) {
      map.set(p.slugTr, p);
    }
    return map;
  }, [marinePoints]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleSelectPoint = (slug: string) => {
    setSelectedSlug((prev) => (prev === slug ? null : slug));
  };

  const scrollToStationRow = (slug: string) => {
    const el = document.getElementById(`station-row-${slug}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const filteredPoints = React.useMemo(() => {
    return marinePoints
      .filter((p) => {
        if (selectedBasin !== "all" && p.seaBasin !== selectedBasin) {
          return false;
        }
        if (searchQuery.trim()) {
          const foldedQ = foldForSearch(searchQuery);
          const foldedName = foldForSearch(p.nameTr);
          const foldedCoast = foldForSearch(p.coastLabelTr);
          const foldedPlate = p.plateCode;
          const foldedProvince = p.provinceName ? foldForSearch(p.provinceName) : "";
          return (
            foldedName.includes(foldedQ) ||
            foldedCoast.includes(foldedQ) ||
            foldedPlate.includes(foldedQ) ||
            foldedProvince.includes(foldedQ)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "temp-desc") {
          return (b.sst ?? 0) - (a.sst ?? 0);
        }
        if (sortBy === "wave-desc") {
          return (b.waveHeight ?? 0) - (a.waveHeight ?? 0);
        }
        if (sortBy === "wind-desc") {
          return (b.windSpeed10m ?? 0) - (a.windSpeed10m ?? 0);
        }
        return a.displayOrder - b.displayOrder;
      });
  }, [marinePoints, selectedBasin, searchQuery, sortBy]);

  const hoveredPoint = hoveredSlug ? pointMap.get(hoveredSlug) : null;
  const selectedPoint = selectedSlug ? pointMap.get(selectedSlug) : null;

  // Group filtered points by basin for sectioned presentation
  const groupedPoints = React.useMemo(() => {
    const basins: Array<{
      basinKey: "black_sea" | "marmara" | "aegean" | "mediterranean";
      meta: (typeof BASIN_FILTER_META)[string];
      items: MarinePointData[];
    }> = [
      { basinKey: "black_sea", meta: BASIN_FILTER_META.black_sea, items: [] },
      { basinKey: "marmara", meta: BASIN_FILTER_META.marmara, items: [] },
      { basinKey: "aegean", meta: BASIN_FILTER_META.aegean, items: [] },
      { basinKey: "mediterranean", meta: BASIN_FILTER_META.mediterranean, items: [] },
    ];

    for (const p of filteredPoints) {
      const g = basins.find((b) => b.basinKey === p.seaBasin);
      if (g) {
        g.items.push(p);
      }
    }

    return basins.filter((b) => b.items.length > 0);
  }, [filteredPoints]);

  return (
    <section className="space-y-6" id="v2-marine-map">
      {/* SECTION HEADER */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm" icon={<Waves className="size-3.5" />}>
            Canlı Deniz Telemetrisi
          </Badge>
          <Badge variant="outline" size="sm">
            30 İstasyon • 4 Deniz Havzası
          </Badge>
        </div>
        <h2 className="font-heading text-2xl sm:text-4xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)]">
          Türkiye Kıyıları &amp; Deniz Suyu Sıcaklık Atlası
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
          Copernicus Marine ve ECMWF saatlik telemetri istasyonları, su sıcaklığı, dalga boyu ve 10m
          rüzgâr vektörleri.
        </p>
      </div>

      {/* BASIN FILTER BUTTONS (Directly above the map) */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(BASIN_FILTER_META).map(([key, meta]) => {
          const count =
            key === "all"
              ? marinePoints.length
              : marinePoints.filter((p) => p.seaBasin === key).length;
          const isSelected = selectedBasin === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelectedBasin(
                  key as "all" | "black_sea" | "marmara" | "aegean" | "mediterranean",
                );
                setHoveredSlug(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-[var(--color-primary,#b0522e)] text-white shadow-xs font-bold scale-105"
                  : "bg-card hover:bg-muted text-muted-foreground border border-border"
              }`}
            >
              <span>{meta.name}</span>
              <span className="text-[10px] opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {/* EDGE-TO-EDGE VECTOR TURKEY & SEA MAP CANVAS */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoveredSlug(null);
          setMousePos(null);
        }}
        className="relative rounded-2xl bg-[var(--map-sea,#dbe7e8)] dark:bg-[#152228] border border-border overflow-hidden p-0 group aspect-[1270/580] w-full cursor-default select-none shadow-xl"
      >
        {/* Floating Top-Left Mode Indicator */}
        <div className="absolute top-4 left-4 z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/85 backdrop-blur-md border border-border/80 text-xs font-medium shadow-sm pointer-events-none">
          <Waves className="size-3.5 text-cyan-600 animate-pulse" />
          <span className="text-foreground font-semibold">
            {BASIN_FILTER_META[selectedBasin]?.name}
          </span>
          <span className="text-muted-foreground text-[11px]">
            ({filteredPoints.length} İstasyon Aktif)
          </span>
        </div>

        {/* SVG MAP */}
        <svg
          viewBox={TR_CONTEXT_VIEWBOX}
          className="w-full h-full select-none block"
          aria-label="Türkiye Deniz Telemetrisi ve Kıyılar Haritası"
        >
          <defs>
            <radialGradient id="marine-pulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 1. Surrounding Foreign Countries */}
          <g className="fill-[#f1ece3] dark:fill-[#2d2822] stroke-[#b8aea0] dark:stroke-[#50473e] stroke-[1] stroke-linejoin-round pointer-events-none">
            {CONTEXT_SHAPES.filter((c) => c.iso !== "TR").map((country) => (
              <path key={country.iso} d={country.d} />
            ))}
          </g>

          {/* 2. Türkiye Casing Base Land */}
          {trCasing && (
            <path d={trCasing.d} className="fill-card dark:fill-[#201c18] pointer-events-none" />
          )}

          {/* 3. Türkiye 81 Provinces */}
          <g className="stroke-border/70 stroke-[0.6] fill-card dark:fill-[#201c18] transition-colors pointer-events-none">
            {PROVINCE_SHAPES.map((shape) => (
              <path key={shape.plateCode} d={shape.d} />
            ))}
          </g>

          {/* 4. Inland Lakes */}
          <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#152228] stroke-[var(--color-accent,#276b70)]/40 stroke-[0.5] pointer-events-none">
            {INLAND_WATER_SHAPES.map((lake) => (
              <path key={lake.id} d={lake.d} />
            ))}
          </g>

          {/* 5. Sea Water Typography */}
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

          {/* 7. TELEMETRY STATIONS BUBBLES / PINS */}
          <g>
            {marinePoints.map((point) => {
              const pt = projectToMapPoint(point.longitude, point.latitude);
              const isHovered = hoveredSlug === point.slugTr;
              const isSelected = selectedSlug === point.slugTr;
              const matchesBasin = selectedBasin === "all" || point.seaBasin === selectedBasin;

              const sst = point.sst ?? 25;
              let pinFill = "#0284c7";
              let strokeCol = "#ffffff";
              if (sst >= 28) {
                pinFill = "#ea580c";
              } else if (sst >= 25) {
                pinFill = "#0d9488";
              } else {
                pinFill = "#2563eb";
              }

              if (isSelected) {
                pinFill = "#f59e0b";
                strokeCol = "#ffffff";
              }

              if (!matchesBasin) {
                return null;
              }

              return (
                <g
                  key={point.slugTr}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`İstasyon: ${point.nameTr}, Sıcaklık: ${point.sst ? point.sst.toFixed(1) + " °C" : "Bilinmiyor"}`}
                  onClick={() => handleSelectPoint(point.slugTr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectPoint(point.slugTr);
                    }
                  }}
                  onMouseEnter={() => setHoveredSlug(point.slugTr)}
                  onMouseLeave={() => setHoveredSlug(null)}
                  className="transition-transform duration-200 group/pin cursor-pointer outline-none focus-visible:scale-125"
                >
                  {/* Radar Pulse Effect */}
                  <circle
                    r={isSelected ? 22 : isHovered ? 18 : 10}
                    fill={pinFill}
                    opacity={isSelected ? 0.5 : isHovered ? 0.35 : 0.2}
                    className={isSelected ? "animate-pulse" : "animate-ping"}
                  />
                  {/* Outer Ring */}
                  <circle
                    r={isSelected ? 12 : isHovered ? 10 : 7}
                    fill={pinFill}
                    stroke={strokeCol}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="shadow-md transition-all"
                  />
                  {/* Inner Core */}
                  <circle r={isSelected ? 3.5 : 2.5} fill="#ffffff" />

                  {/* Temperature Floating Label */}
                  {point.sst && (
                    <g transform="translate(10, 3)" className="pointer-events-none">
                      <rect
                        x={-2}
                        y={-10}
                        width={32}
                        height={13}
                        rx={4}
                        fill="rgba(15, 23, 42, 0.85)"
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={14}
                        y={-1}
                        textAnchor="middle"
                        fontSize={8.5}
                        fill="#ffffff"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {point.sst.toFixed(1)}°
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* SELECTED STATION SPOTLIGHT MODAL / CARD OVERLAY */}
        {selectedPoint && (
          <div className="absolute top-4 right-4 z-20 w-80 sm:w-96 rounded-3xl bg-card/95 backdrop-blur-xl border border-primary/40 p-5 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<MapPin className="size-3" />}>
                    Seçili İstasyon
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    TR-{selectedPoint.plateCode}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-lg text-foreground mt-1 leading-tight">
                  {selectedPoint.nameTr}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPoint.coastLabelTr} • {selectedPoint.provinceName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Straits Low-Confidence Caution Badge */}
            {selectedPoint.isStraits && (
              <div className="flex items-start gap-2 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                <ShieldAlert className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-tight text-[11px]">
                  <strong>Boğaz &amp; Dar Su Yolu:</strong> Açık deniz modellerinin kaba grid
                  çözünürlüğü ve iki tabakalı akıntı rejimi nedeniyle kıyı bandında yerel sapmalar
                  olabilir.
                </p>
              </div>
            )}

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Thermometer className="size-3.5 text-primary" /> Su Sıcaklığı
                </span>
                <div className="font-mono font-bold text-base text-primary">
                  {selectedPoint.sst ? `${selectedPoint.sst.toFixed(1)} °C` : "—"}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Waves className="size-3.5 text-cyan-600" /> Dalga Boyu
                </span>
                <div className="font-mono font-bold text-base text-foreground flex items-center gap-1.5">
                  <span>
                    {selectedPoint.waveHeight ? `${selectedPoint.waveHeight.toFixed(2)} m` : "—"}
                  </span>
                  {selectedPoint.waveDirection && (
                    <DirectionArrow
                      deg={selectedPoint.waveDirection}
                      className="size-3.5 text-cyan-600"
                    />
                  )}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Wind className="size-3.5 text-teal-600" /> 10m Rüzgâr
                </span>
                <div className="font-mono font-bold text-xs text-foreground flex items-center gap-1">
                  <span>
                    {selectedPoint.windSpeed10m
                      ? `${selectedPoint.windSpeed10m.toFixed(1)} m/s`
                      : "—"}
                  </span>
                  {selectedPoint.windDirection10m && (
                    <DirectionArrow
                      deg={selectedPoint.windDirection10m}
                      className="size-3.5 text-teal-600"
                    />
                  )}
                </div>
                {selectedPoint.windSpeedKmh && (
                  <span className="text-[10px] text-muted-foreground block">
                    ~{selectedPoint.windSpeedKmh.toFixed(0)} km/h •{" "}
                    {getDirectionLabel(selectedPoint.windDirection10m)}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3.5 text-muted-foreground" /> Model Zamanı
                </span>
                <div className="font-mono font-medium text-[11px] text-foreground">
                  {selectedPoint.validAt ?? "Canlı Analiz"}
                </div>
                {selectedPoint.gridDistanceKm && (
                  <span className="text-[10px] text-muted-foreground block">
                    Grid: &le; {selectedPoint.gridDistanceKm.toFixed(1)} km
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs rounded-xl"
                onClick={() => scrollToStationRow(selectedPoint.slugTr)}
              >
                <List className="size-3.5 mr-1" />
                Tabloda Göster
              </Button>
              {selectedPoint.provinceSlug && (
                <Link
                  href={{
                    pathname: "/v2/turkiye/[slug]",
                    params: { slug: selectedPoint.provinceSlug },
                  }}
                  className="w-full inline-flex items-center justify-center font-medium transition-all duration-150 h-8 px-3 text-xs gap-1.5 rounded-xl bg-primary text-white hover:bg-[var(--color-primary-dark,#7e3a1e)] shadow-xs"
                >
                  <span className="text-white">İl Detayına Git</span>
                  <ArrowRight className="size-3.5 ml-1 text-white" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* DYNAMIC FLOATING TOOLTIP (MOUSE TRACKER ON PIN HOVER) */}
        {!selectedSlug && hoveredPoint && mousePos && (
          <div
            className="absolute z-30 pointer-events-none rounded-2xl bg-card/95 backdrop-blur-xl border border-border/90 p-3.5 shadow-2xl text-xs space-y-2 min-w-[240px] max-w-[290px] animate-in fade-in-50 zoom-in-95 duration-100"
            style={{
              top: `${Math.min(mousePos.y + 20, 380)}px`,
              left: `${Math.min(mousePos.x + 20, 950)}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <span className="font-heading font-bold text-foreground text-sm block leading-tight">
                  {hoveredPoint.nameTr}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {hoveredPoint.coastLabelTr} • {hoveredPoint.provinceName}
                </span>
              </div>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                TR-{hoveredPoint.plateCode}
              </Badge>
            </div>

            <div className="space-y-1.5 text-[11px]">
              {hoveredPoint.sst !== undefined && hoveredPoint.sst !== null && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Thermometer className="size-3 text-primary" /> Su Sıcaklığı:
                  </span>
                  <span className="font-mono font-bold text-primary text-xs">
                    {hoveredPoint.sst.toFixed(1)} °C
                  </span>
                </div>
              )}

              {hoveredPoint.waveHeight !== undefined && hoveredPoint.waveHeight !== null && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Waves className="size-3 text-cyan-600" /> Dalga Boyu:
                  </span>
                  <span className="font-mono font-medium text-foreground flex items-center gap-1">
                    {hoveredPoint.waveHeight.toFixed(2)} m
                    {hoveredPoint.waveDirection && (
                      <DirectionArrow
                        deg={hoveredPoint.waveDirection}
                        className="size-3 text-cyan-600"
                      />
                    )}
                  </span>
                </div>
              )}

              {hoveredPoint.windSpeed10m !== undefined && hoveredPoint.windSpeed10m !== null && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wind className="size-3 text-teal-600" /> 10m Rüzgâr:
                  </span>
                  <span className="font-mono font-medium text-foreground flex items-center gap-1">
                    {hoveredPoint.windSpeed10m.toFixed(1)} m/s
                    {hoveredPoint.windDirection10m && (
                      <DirectionArrow
                        deg={hoveredPoint.windDirection10m}
                        className="size-3 text-teal-600"
                      />
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                <span>Konum:</span>
                <span className="font-mono">
                  {hoveredPoint.latitude.toFixed(2)}°K, {hoveredPoint.longitude.toFixed(2)}°D
                </span>
              </div>
            </div>

            <div className="pt-1 text-[10px] text-muted-foreground flex items-center justify-between border-t border-border/60">
              <span>Tıklayarak detayları aç</span>
              <span className="font-mono">#{hoveredPoint.displayOrder}</span>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend Footer Strip */}
      <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs">
        <span className="font-semibold text-foreground text-[11px]">Su Sıcaklığı Skalası:</span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="size-2.5 rounded-full bg-[#ea580c]" /> 28°C+ (Sıcak Akdeniz)
        </span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="size-2.5 rounded-full bg-[#0d9488]" /> 25°C – 28°C (Ilıman Ege / Marmara)
        </span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="size-2.5 rounded-full bg-[#2563eb]" /> &lt;25°C (Serin Karadeniz)
        </span>
      </div>

      {/* SEARCH & SORT CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border pb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="İstasyon veya il adı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 py-2 rounded-xl bg-card border-border text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setSortBy("order")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === "order"
                ? "bg-card text-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kıyı Sırası
          </button>
          <button
            type="button"
            onClick={() => setSortBy("temp-desc")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === "temp-desc"
                ? "bg-card text-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            En Sıcak Su
          </button>
          <button
            type="button"
            onClick={() => setSortBy("wave-desc")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === "wave-desc"
                ? "bg-card text-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            En Yüksek Dalga
          </button>
          <button
            type="button"
            onClick={() => setSortBy("wind-desc")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === "wind-desc"
                ? "bg-card text-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            En Şiddetli Rüzgâr
          </button>
        </div>
      </div>

      {/* FILTER RESULTS COUNTER */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Toplam <strong className="text-foreground font-semibold">{filteredPoints.length}</strong>{" "}
          telemetri istasyonu listeleniyor.
        </span>
        {(searchQuery || selectedBasin !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedBasin("all");
            }}
            className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <X className="size-3" /> Filtreleri Temizle
          </button>
        )}
      </div>

      {/* CLEAN STRUCTURED TELEMETRY DATA TABLE */}
      <div className="space-y-6">
        {groupedPoints.map((group) => (
          <div
            key={group.basinKey}
            className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm"
          >
            {/* Group Header */}
            <div className="px-5 py-3.5 bg-muted/50 border-b border-border/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Badge variant="outline" className={group.meta.badgeClass}>
                  {group.meta.name}
                </Badge>
                <span className="font-heading font-bold text-sm text-foreground">
                  {group.meta.title}
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {group.items.length} İstasyon
              </span>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>İstasyon Adı &amp; Kıyı</TableHead>
                  <TableHead>İl / Plaka</TableHead>
                  <TableHead className="text-right">Su Sıcaklığı</TableHead>
                  <TableHead className="text-right">Dalga Boyu &amp; Yönü</TableHead>
                  <TableHead className="text-right">10m Rüzgâr Hızı &amp; Yönü</TableHead>
                  <TableHead className="text-right">Model Zamanı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((point) => {
                  const sst = point.sst;
                  const isSelected = selectedSlug === point.slugTr;
                  let tempBadgeClass =
                    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
                  if (sst && sst >= 28) {
                    tempBadgeClass =
                      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
                  } else if (sst && sst >= 25) {
                    tempBadgeClass =
                      "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30";
                  }

                  return (
                    <TableRow
                      key={point.slugTr}
                      id={`station-row-${point.slugTr}`}
                      tabIndex={0}
                      aria-selected={isSelected}
                      aria-label={`${point.nameTr} istasyonunu seç`}
                      className={`cursor-pointer transition-colors outline-none focus-visible:bg-primary/15 ${
                        isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/40"
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectPoint(point.slugTr);
                        }
                      }}
                      onClick={() => handleSelectPoint(point.slugTr)}
                      onMouseEnter={() => setHoveredSlug(point.slugTr)}
                      onMouseLeave={() => setHoveredSlug(null)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground text-center">
                        {point.displayOrder}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          <span
                            className={`size-2 rounded-full ${
                              isSelected ? "bg-amber-500 ring-2 ring-amber-400" : "bg-cyan-500"
                            }`}
                          />
                          <span>{point.nameTr}</span>
                          {point.isStraits && (
                            <Badge
                              variant="outline"
                              size="sm"
                              className="text-[9px] py-0 px-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            >
                              Boğaz
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{point.coastLabelTr}</div>
                      </TableCell>
                      <TableCell>
                        {point.provinceSlug ? (
                          <Link
                            href={{
                              pathname: "/v2/turkiye/[slug]",
                              params: { slug: point.provinceSlug },
                            }}
                            className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {point.provinceName}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{point.provinceName}</span>
                        )}
                        <span className="text-xs font-mono text-muted-foreground ml-1.5">
                          (TR-{point.plateCode})
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {sst ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${tempBadgeClass}`}
                          >
                            <Thermometer className="size-3" />
                            {sst.toFixed(1)} °C
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {point.waveHeight !== undefined && point.waveHeight !== null ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Waves className="size-3.5 text-cyan-600" />
                            <span>{point.waveHeight.toFixed(2)} m</span>
                            {point.waveDirection !== undefined && point.waveDirection !== null && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <DirectionArrow
                                  deg={point.waveDirection}
                                  className="size-3 text-cyan-600"
                                />
                                <span>{Math.round(point.waveDirection)}°</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {point.windSpeed10m !== undefined && point.windSpeed10m !== null ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Wind className="size-3.5 text-teal-600" />
                            <span>{point.windSpeed10m.toFixed(1)} m/s</span>
                            {point.windDirection10m !== undefined &&
                              point.windDirection10m !== null && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <DirectionArrow
                                    deg={point.windDirection10m}
                                    className="size-3 text-teal-600"
                                  />
                                  <span>{Math.round(point.windDirection10m)}°</span>
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                        <div>
                          <span>{point.validAt ?? "Canlı"}</span>
                          {point.gridDistanceKm !== undefined && point.gridDistanceKm !== null && (
                            <span className="block text-[10px] text-muted-foreground/80">
                              &le; {point.gridDistanceKm.toFixed(1)} km
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </section>
  );
}
