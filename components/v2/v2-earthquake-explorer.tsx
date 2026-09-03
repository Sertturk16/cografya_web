"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { projectToMapPoint } from "@/lib/map/projection";
import { FAULT_LINE_SEGMENTS, buildFaultLinePath } from "@/lib/map/fault-lines";
import type { EarthquakeEvent, EarthquakeList } from "@/lib/api/types";
import { buildEarthquakeQuery } from "@/lib/earthquake/query";
import { bindingSentenceKey } from "@/lib/earthquake/binding-sentence";
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
  Activity,
  Flame,
  Search,
  Layers,
  Clock,
  ArrowRight,
  List,
  AlertTriangle,
  RefreshCw,
  Info,
  Calendar,
} from "lucide-react";
import { foldForSearch } from "@/lib/search/normalize";

export interface V2EarthquakeItem {
  id: string;
  magnitude: number;
  magnitudeType: string;
  depthKm: number;
  latitude: number;
  longitude: number;
  occurredAtUtc: string;
  placeNameTr: string;
  bindingPlateCode?: string | null;
  bindingKind?: "inside" | "offshore_near" | "across_border" | null;
  provinceName?: string | null;
  provinceSlug?: string | null;
  source: string;
}

export interface ProvinceMeta {
  name: string;
  slug: string;
}

interface V2EarthquakeExplorerProps {
  initialEvents?: EarthquakeEvent[];
  provinceMap?: Map<string, ProvinceMeta>;
  defaultMinMagnitude?: number;
  defaultWindowDays?: number;
}

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

const MAGNITUDE_PRESETS = [
  { label: "Tümü (1.0+)", val: 1.0 },
  { label: "M ≥ 2.0", val: 2.0 },
  { label: "M ≥ 2.5", val: 2.5 },
  { label: "M ≥ 3.0", val: 3.0 },
  { label: "M ≥ 4.0", val: 4.0 },
  { label: "M ≥ 5.0", val: 5.0 },
];

const WINDOW_PRESETS = [
  { label: "Son 24 Saat", days: 1 },
  { label: "Son 3 Gün", days: 3 },
  { label: "Son 7 Gün", days: 7 },
  { label: "Son 14 Gün", days: 14 },
  { label: "Son 30 Gün", days: 30 },
];

export function V2EarthquakeExplorer({
  initialEvents = [],
  provinceMap = new Map(),
  defaultMinMagnitude = 2.5,
  defaultWindowDays = 7,
}: V2EarthquakeExplorerProps) {
  const [minMagnitude, setMinMagnitude] = React.useState<number>(defaultMinMagnitude);
  const [windowDays, setWindowDays] = React.useState<number>(defaultWindowDays);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    () => initialEvents[0]?.id || null,
  );
  const [hoveredEventId, setHoveredEventId] = React.useState<string | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [showFaultLines, setShowFaultLines] = React.useState<boolean>(true);
  const [displayCount, setDisplayCount] = React.useState<number>(50);

  // Live client-side fetch state
  const [events, setEvents] = React.useState<V2EarthquakeItem[]>(() =>
    initialEvents.map((item) => {
      const prov = item.bindingPlateCode ? provinceMap.get(item.bindingPlateCode) : undefined;
      return {
        id: item.id,
        magnitude: item.magnitude,
        magnitudeType: item.magnitudeType,
        depthKm: item.depthKm,
        latitude: item.latitude,
        longitude: item.longitude,
        occurredAtUtc: item.occurredAtUtc,
        placeNameTr: item.placeNameTr,
        bindingPlateCode: item.bindingPlateCode,
        bindingKind: item.bindingKind,
        provinceName: prov?.name ?? null,
        provinceSlug: prov?.slug ?? null,
        source: "AFAD",
      };
    }),
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const isFirstMount = React.useRef(true);

  // Client-side fetch when minMagnitude or windowDays changes
  const fetchEarthquakes = React.useCallback(
    async (mag: number, days: number) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const now = new Date();
        const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const qs = buildEarthquakeQuery({
          minMagnitude: mag,
          fromUtc: fromDate.toISOString(),
          toUtc: now.toISOString(),
          page: 1,
          pageSize: 150,
        });

        const res = await fetch(`/api/earthquakes${qs}`);
        if (!res.ok) throw new Error(`API hatası: ${res.status}`);
        const data: EarthquakeList = await res.json();

        const mapped: V2EarthquakeItem[] = (data.items || []).map((item) => {
          const prov = item.bindingPlateCode ? provinceMap.get(item.bindingPlateCode) : undefined;
          return {
            id: item.id,
            magnitude: item.magnitude,
            magnitudeType: item.magnitudeType,
            depthKm: item.depthKm,
            latitude: item.latitude,
            longitude: item.longitude,
            occurredAtUtc: item.occurredAtUtc,
            placeNameTr: item.placeNameTr,
            bindingPlateCode: item.bindingPlateCode,
            bindingKind: item.bindingKind,
            provinceName: prov?.name ?? null,
            provinceSlug: prov?.slug ?? null,
            source: "AFAD",
          };
        });

        setEvents(mapped);
        if (mapped.length > 0 && mapped[0]) {
          setSelectedEventId(mapped[0].id);
        } else {
          setSelectedEventId(null);
        }
      } catch (err) {
        console.error("[v2-earthquake-explorer] Client fetch failed:", err);
        setFetchError("Deprem verileri güncellenirken bir sorun oluştu.");
      } finally {
        setIsLoading(false);
      }
    },
    [provinceMap],
  );

  // Trigger client fetch on filter change (skip first mount as initialEvents is already rendered)
  React.useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchEarthquakes(minMagnitude, windowDays);
  }, [minMagnitude, windowDays, fetchEarthquakes]);

  // Client-side text filter with Turkish fold
  const filteredEvents = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return events;
    }
    const q = foldForSearch(searchQuery.trim());
    return events.filter((e) => {
      const matchPlace = foldForSearch(e.placeNameTr).includes(q);
      const matchProv = e.provinceName ? foldForSearch(e.provinceName).includes(q) : false;
      return matchPlace || matchProv;
    });
  }, [events, searchQuery]);

  // Active / Selected Event Details (Pinned by click)
  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId && filteredEvents.length > 0) {
      return filteredEvents[0];
    }
    return filteredEvents.find((e) => e.id === selectedEventId) || filteredEvents[0] || null;
  }, [selectedEventId, filteredEvents]);

  // Hovered event for lightweight mouse tooltip
  const hoveredEvent = React.useMemo(() => {
    if (!hoveredEventId) return null;
    return events.find((e) => e.id === hoveredEventId) || null;
  }, [hoveredEventId, events]);

  // Max magnitude in active view
  const maxMagnitudeEvent = React.useMemo(() => {
    if (filteredEvents.length === 0) return null;
    return [...filteredEvents].sort((a, b) => b.magnitude - a.magnitude)[0];
  }, [filteredEvents]);

  // Context Turkey Casing Outline
  const trCasing = React.useMemo(() => CONTEXT_SHAPES.find((c) => c.iso === "TR"), []);

  // Pre-project MTA fault lines paths
  const projectedFaultLines = React.useMemo(() => {
    return FAULT_LINE_SEGMENTS.map((seg) => ({
      ...seg,
      pathData: buildFaultLinePath(seg.waypoints),
    }));
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Date/Time formatting helper
  const formatTime = (utcString: string) => {
    const d = new Date(utcString);
    return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${d.toLocaleTimeString(
      "tr-TR",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    )}`;
  };

  const getMagnitudeStyle = (mag: number) => {
    if (mag >= 5.0)
      return {
        bg: "bg-red-600",
        text: "text-white",
        border: "border-red-700",
        ring: "ring-red-500/50",
      };
    if (mag >= 4.0)
      return {
        bg: "bg-orange-500",
        text: "text-white",
        border: "border-orange-600",
        ring: "ring-orange-500/50",
      };
    if (mag >= 3.0)
      return {
        bg: "bg-amber-500",
        text: "text-amber-950",
        border: "border-amber-600",
        ring: "ring-amber-500/50",
      };
    return {
      bg: "bg-emerald-600",
      text: "text-white",
      border: "border-emerald-700",
      ring: "ring-emerald-500/50",
    };
  };

  const getIntensityLabel = (mag: number) => {
    if (mag >= 6.0) return "Şiddetli / Yıkıcı";
    if (mag >= 5.0) return "Kuvvetli Sarsıntı";
    if (mag >= 4.0) return "Orta Büyüklükte";
    if (mag >= 3.0) return "Hissedilebilir";
    return "Hafif / Mikro";
  };

  const getBindingDescription = (item: V2EarthquakeItem) => {
    if (!item.bindingKind || item.bindingKind === "inside") return null;
    const sentenceKey = bindingSentenceKey(item.bindingKind);
    if (sentenceKey === "offshoreNear") {
      return item.provinceName
        ? `${item.provinceName} açıkları (Açık deniz)`
        : "Açık deniz sarsıntısı";
    }
    if (sentenceKey === "acrossBorder") {
      return item.provinceName
        ? `Sınır ötesi (En yakın il: ${item.provinceName})`
        : "Sınır ötesi sarsıntı";
    }
    return null;
  };

  const scrollToTableRow = (id: string) => {
    const el = document.getElementById(`eq-row-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <section className="space-y-8" id="v2-deprem-explorer">
      {/* 1. FILTER CONTROLS & SEARCH BAR */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-5 sm:p-7 shadow-xl space-y-5">
        {/* Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" size="sm" dot>
                Canlı AFAD Sismik Ağı
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">
                Türkiye Deprem Veri Merkezi (TDVMS)
              </span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)]">
              Türkiye Canlı Sismik Aktivite Monitörü
            </h2>
          </div>

          {/* Quick Metrics & Refresh Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-card border border-border flex items-center gap-2 shadow-2xs">
              <span
                className={`size-2 rounded-full ${isLoading ? "bg-amber-500 animate-spin" : "bg-emerald-500"}`}
              />
              <span className="text-xs font-semibold text-foreground">
                {isLoading ? "Güncelleniyor..." : `${filteredEvents.length} Sarsıntı Kayıtlı`}
              </span>
            </div>
            {maxMagnitudeEvent && !isLoading && (
              <div className="px-3.5 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                <Flame className="size-3.5 text-destructive" />
                <span className="text-xs font-bold text-destructive">
                  En Büyük: M {maxMagnitudeEvent.magnitude.toFixed(1)} (
                  {maxMagnitudeEvent.placeNameTr})
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-xl"
              onClick={() => fetchEarthquakes(minMagnitude, windowDays)}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="size-3.5" />}
            >
              Yenile
            </Button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Time Window Buttons (4 cols) */}
          <div className="space-y-1.5 lg:col-span-4 min-w-0">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-primary" /> Zaman Aralığı:
            </label>
            <div className="grid grid-cols-5 gap-1">
              {WINDOW_PRESETS.map((p) => {
                const isSelected = windowDays === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setWindowDays(p.days)}
                    className={`px-1.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer text-center truncate ${
                      isSelected
                        ? "bg-[var(--color-primary,#b0522e)] text-white shadow-xs font-bold scale-[1.02]"
                        : "bg-card hover:bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Magnitude Presets (5 cols) */}
          <div className="space-y-1.5 lg:col-span-5 min-w-0">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-destructive" /> Büyüklük Eşiği:
            </label>
            <div className="grid grid-cols-6 gap-1">
              {MAGNITUDE_PRESETS.map((p) => {
                const isSelected = minMagnitude === p.val;
                return (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setMinMagnitude(p.val)}
                    className={`px-1.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer text-center truncate ${
                      isSelected
                        ? "bg-destructive text-white shadow-xs font-bold scale-[1.02]"
                        : "bg-card hover:bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input (3 cols) */}
          <div className="space-y-1.5 lg:col-span-3 min-w-0">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Search className="size-3.5 text-muted-foreground" /> İl / Bölge Ara:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Örn: Sivas, Maraş, Marmara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8.5 bg-card border-border rounded-xl h-8.5 text-xs w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* 2. FULL-WIDTH INTERACTIVE SEISMIC ATLAS MAP WITH DIRECT CONTROLS */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
        {/* Map Header Toolbar with Integrated Legend & Fault Lines Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Activity className="size-3.5" />}>
              Sismik Projeksiyon Haritası
            </Badge>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              Eşzamanlı Merkez Üsleri &amp; Aktif Fay Hatları
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Magnitude Legend */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-600" /> M &lt; 3.0
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" /> M 3.0–3.9
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-orange-500" /> M 4.0–4.9
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-red-600" /> M &ge; 5.0
              </span>
            </div>

            {/* Direct Fault Lines Toggle Button on Map Header */}
            <Button
              variant={showFaultLines ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFaultLines(!showFaultLines)}
              leftIcon={<Layers className="size-3.5" />}
              className="text-xs rounded-xl h-8"
            >
              {showFaultLines ? "MTA Diri Fayları Açık" : "Fay Hatları Gizli"}
            </Button>
          </div>
        </div>

        {/* EXACT ASPECT RATIO VECTOR MAP (NO LETTERBOX GAPS) */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoveredEventId(null);
            setMousePos(null);
          }}
          className="relative w-full aspect-[1270/580] bg-[var(--map-sea,#dbe7e8)] dark:bg-[#152228] rounded-2xl border border-border/80 overflow-hidden shadow-inner cursor-default select-none p-0"
        >
          <svg
            viewBox={TR_CONTEXT_VIEWBOX}
            className="w-full h-full block select-none"
            aria-label="Türkiye Canlı Deprem Haritası"
          >
            {/* Surrounding Context Countries */}
            <g className="fill-[#f1ece3] dark:fill-[#2d2822] stroke-[#b8aea0] dark:stroke-[#50473e] stroke-[1] stroke-linejoin-round pointer-events-none">
              {CONTEXT_SHAPES.filter((c) => c.iso !== "TR").map((country) => (
                <path key={country.iso} d={country.d} />
              ))}
            </g>

            {/* Neighbor Country Name Labels */}
            <g className="fill-[#635a4e] dark:fill-[#a89e92] font-sans font-bold text-[11px] pointer-events-none select-none">
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
                    className="tracking-tight opacity-75 select-none"
                  >
                    {name}
                  </text>
                );
              })}
            </g>

            {/* Inland Lakes & Waters */}
            <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#152228] stroke-[#8bb7cf] dark:stroke-[#0e2230] stroke-[0.5] pointer-events-none">
              {INLAND_WATER_SHAPES.map((water) => (
                <path key={water.id} d={water.d} />
              ))}
            </g>

            {/* Surrounding Sea Names */}
            <g className="fill-[#537b93] dark:fill-[#5a86a0] font-sans font-bold tracking-widest pointer-events-none select-none opacity-60">
              {SEA_LABELS.map((sea) => (
                <text
                  key={sea.name}
                  x={sea.x}
                  y={sea.y}
                  fontSize={sea.fontSize}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {sea.name}
                </text>
              ))}
            </g>

            {/* Turkey Context Casing Outline */}
            {trCasing && (
              <path
                d={trCasing.d}
                className="fill-none stroke-border/70 stroke-[2] pointer-events-none"
              />
            )}

            {/* 81 Turkish Provinces Base Layer */}
            <g className="fill-card/90 stroke-border/60 stroke-[0.6]">
              {PROVINCE_SHAPES.map((prov) => (
                <path
                  key={prov.plateCode}
                  d={prov.d}
                  className="hover:fill-muted/70 transition-colors"
                >
                  <title>{prov.geoName}</title>
                </path>
              ))}
            </g>

            {/* MTA Real Geographically Projected Diri Fay Hatları Overlay */}
            {showFaultLines && (
              <g className="fault-lines opacity-80 pointer-events-none">
                {projectedFaultLines.map((seg) => (
                  <path
                    key={seg.id}
                    d={seg.pathData}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={seg.strokeWidth}
                    strokeDasharray={seg.strokeDasharray}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <title>{seg.name}</title>
                  </path>
                ))}
              </g>
            )}

            {/* Seismic Earthquake Epicenters (Stable Hit Targets - Zero Flickering) */}
            {filteredEvents.map((eq) => {
              const pt = projectToMapPoint(eq.longitude, eq.latitude);
              const isSelected = selectedEventId === eq.id;
              const isHovered = hoveredEventId === eq.id;
              const baseRadius = Math.max(3.5, Math.min(14, (eq.magnitude - 1.2) * 3.2));
              const radius = isSelected ? baseRadius * 1.35 : baseRadius;
              const style = getMagnitudeStyle(eq.magnitude);

              return (
                <g
                  key={eq.id}
                  className="cursor-pointer outline-none focus:outline-none select-none"
                  role="button"
                  aria-label={`Deprem M ${eq.magnitude.toFixed(1)} - ${eq.placeNameTr}`}
                  onMouseEnter={() => setHoveredEventId(eq.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEventId(eq.id);
                  }}
                >
                  {/* Fixed invisible hit circle to prevent DOM detach/flickering */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={baseRadius + 9}
                    className="fill-transparent"
                    pointerEvents="all"
                  />

                  {/* Subtle native SVG ripple pulse (100% stable, zero coordinate shift) */}
                  {(isSelected || isHovered || eq.magnitude >= 3.5) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={radius}
                      className="fill-none pointer-events-none"
                      stroke={
                        isSelected
                          ? "#f59e0b"
                          : eq.magnitude >= 5.0
                            ? "#dc2626"
                            : eq.magnitude >= 4.0
                              ? "#ea580c"
                              : "#059669"
                      }
                      strokeWidth={isSelected ? "2" : "1.2"}
                    >
                      <animate
                        attributeName="r"
                        values={`${radius + 1.5};${radius + (isSelected ? 10 : 6)};${radius + 1.5}`}
                        dur={isSelected ? "1.8s" : "2.5s"}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0.05;0.8"
                        dur={isSelected ? "1.8s" : "2.5s"}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Static Selected / High-Magnitude Accent Ring */}
                  {(isSelected || isHovered || eq.magnitude >= 4.0) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={radius + 3.5}
                      className={`fill-none stroke-2 pointer-events-none ${
                        isSelected
                          ? "stroke-amber-400 dark:stroke-amber-300 stroke-[2.5]"
                          : eq.magnitude >= 4.0
                            ? "stroke-destructive/70"
                            : "stroke-primary/50"
                      }`}
                      pointerEvents="none"
                    />
                  )}

                  {/* Epicenter Core Circle (Pure SVG radius - zero CSS transform displacement) */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={radius}
                    className={`${style.bg} stroke-white dark:stroke-black stroke-[1.5] shadow-md pointer-events-none transition-all duration-150`}
                    pointerEvents="none"
                  />

                  {/* Magnitude text badge on M >= 3.5 */}
                  {eq.magnitude >= 3.5 && (
                    <text
                      x={pt.x}
                      y={pt.y + (isSelected ? 3.5 : 3)}
                      textAnchor="middle"
                      fontSize={isSelected ? "9.5" : "8.5"}
                      fontWeight="bold"
                      fill="#ffffff"
                      className="pointer-events-none select-none font-mono"
                    >
                      {eq.magnitude.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* FLOATING TOOLTIP ON PIN HOVER */}
          {hoveredEvent && mousePos && (
            <div
              className="absolute z-30 pointer-events-none rounded-2xl bg-card/95 backdrop-blur-xl border border-border/90 p-3 shadow-2xl text-xs space-y-1.5 min-w-[220px] max-w-[270px]"
              style={{
                top: `${Math.min(mousePos.y + 15, 340)}px`,
                left: `${Math.min(mousePos.x + 15, 880)}px`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground font-mono">
                  M {hoveredEvent.magnitude.toFixed(1)} {hoveredEvent.magnitudeType}
                </span>
                <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 font-mono">
                  {hoveredEvent.depthKm.toFixed(1)} km
                </Badge>
              </div>
              <div className="font-semibold text-foreground text-xs">
                {hoveredEvent.placeNameTr}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/60">
                <span>{formatTime(hoveredEvent.occurredAtUtc)}</span>
                <span className="font-mono">AFAD</span>
              </div>
            </div>
          )}
        </div>

        {/* Fault Line Legend Strip */}
        {showFaultLines && (
          <div className="p-3 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap text-[11px]">
              <span className="font-semibold text-foreground">
                Diri Fay Zonları (MTA Haritası):
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-[#dc2626] rounded-full" /> Kuzey Anadolu Fayı (KAFZ)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-[#2563eb] rounded-full" /> Doğu Anadolu Fayı (DAFZ)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-[#059669] rounded-full" /> Batı Anadolu Grabenleri
                (BAFS)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. TWO-COLUMN DASHBOARD: SPOTLIGHT INSPECTOR & RECENT EARTHQUAKES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Col: Selected Earthquake Spotlight Card (Enriched with Sismik Context) */}
        {selectedEvent ? (
          <div className="p-6 rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              {/* Header Badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<Activity className="size-3.5" />}>
                    Seçili Sarsıntı Detayı
                  </Badge>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="text-[10px] py-0 px-2 font-semibold"
                  >
                    {getIntensityLabel(selectedEvent.magnitude)}
                  </Badge>
                </div>
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                  AFAD TDVMS
                </Badge>
              </div>

              {/* Magnitude & Epicenter Title */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-4xl sm:text-5xl font-extrabold text-foreground">
                    M {selectedEvent.magnitude.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                    {selectedEvent.magnitudeType} (Sismik Büyüklük)
                  </span>
                </div>
                <h3 className="font-heading text-lg sm:text-xl font-bold text-foreground">
                  {selectedEvent.placeNameTr}
                </h3>
                {getBindingDescription(selectedEvent) && (
                  <p className="text-xs text-primary font-medium">
                    {getBindingDescription(selectedEvent)}
                  </p>
                )}
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Odak Derinliği</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">
                    {selectedEvent.depthKm.toFixed(2)} km
                  </span>
                  <span className="text-[9px] text-muted-foreground block">
                    {selectedEvent.depthKm <= 60 ? "Sığ Odaklı Deprem" : "Orta/Derin Odaklı"}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Oluş Zamanı</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">
                    {formatTime(selectedEvent.occurredAtUtc)}
                  </span>
                  <span className="text-[9px] text-muted-foreground block">Yerel Saat (TSİ)</span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Büyüklük Skalası</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">
                    {selectedEvent.magnitudeType === "Mw"
                      ? "Moment Büyüklüğü (Mw)"
                      : "Yerel Büyüklük (ML)"}
                  </span>
                  <span className="text-[9px] text-muted-foreground block">Richter Ölçeği</span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Veri Sağlayıcı</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">
                    AFAD Sismik Ağı
                  </span>
                  <span className="text-[9px] text-muted-foreground block">Otomatik Çözüm</span>
                </div>
              </div>

              {/* Coordinates Strip */}
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Merkez Üssü Koordinatları:</span>
                <span className="font-mono font-medium text-foreground">
                  {selectedEvent.latitude.toFixed(4)}° K, {selectedEvent.longitude.toFixed(4)}° D
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs rounded-xl h-9"
                onClick={() => scrollToTableRow(selectedEvent.id)}
              >
                <List className="size-3.5 mr-1.5" />
                Tabloda Göster
              </Button>
              {selectedEvent.provinceSlug && (
                <Link
                  href={{
                    pathname: "/v2/turkiye/[slug]",
                    params: { slug: selectedEvent.provinceSlug },
                  }}
                  className="w-full inline-flex items-center justify-center font-medium transition-all duration-150 h-9 px-3 text-xs gap-1.5 rounded-xl bg-primary text-white hover:bg-[var(--color-primary-dark,#7e3a1e)] shadow-xs"
                >
                  <span className="text-white">İl Detayı</span>
                  <ArrowRight className="size-3.5 ml-1 text-white" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-3xl border border-border bg-card text-center space-y-2 flex flex-col items-center justify-center">
            <Info className="size-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Filtrelere uygun deprem kaydı bulunamadı.
            </p>
          </div>
        )}

        {/* Right Col: Recent Earthquakes Live Feed */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-lg space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-primary" /> Son Gerçekleşen Sarsıntılar
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">İlk 5 Kayıt</span>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between">
            {filteredEvents.slice(0, 5).map((eq) => {
              const isSelected = selectedEventId === eq.id;
              const style = getMagnitudeStyle(eq.magnitude);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => setSelectedEventId(eq.id)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                    isSelected
                      ? "bg-primary/10 border-primary/40 shadow-xs scale-[1.01]"
                      : "bg-muted/30 border-transparent hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`size-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}
                    >
                      {eq.magnitude.toFixed(1)}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground block truncate">
                        {eq.placeNameTr}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        {formatTime(eq.occurredAtUtc)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono font-medium text-foreground block">
                      {eq.depthKm.toFixed(1)} km
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">derinlik</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. COMPREHENSIVE SEISMIC DATA TABLE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
              Deprem Veri Tablosu &amp; Sismik Kayıtlar
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Seçilen zaman penceresinde gerçekleşen tüm sarsıntı listesi (AFAD TDVMS verileri).
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Toplam {filteredEvents.length} kayıt gösteriliyor
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-border text-center space-y-2">
            <Info className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">Eşleşen deprem kaydı bulunamadı</p>
            <p className="text-xs text-muted-foreground">
              Büyüklük eşiğini düşürerek veya zaman aralığını genişleterek tekrar deneyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-x-auto bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-24">BÜYÜKLÜK</TableHead>
                  <TableHead>KONUM / MERKEZ ÜSSÜ</TableHead>
                  <TableHead className="text-right">DERİNLİK</TableHead>
                  <TableHead className="text-right">ENLEM / BOYLAM</TableHead>
                  <TableHead className="text-right">TARİH &amp; SAAT</TableHead>
                  <TableHead className="text-right">KAYNAK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.slice(0, displayCount).map((eq) => {
                  const isSelected = selectedEventId === eq.id;
                  const style = getMagnitudeStyle(eq.magnitude);
                  const bindingDesc = getBindingDescription(eq);

                  return (
                    <TableRow
                      key={eq.id}
                      id={`eq-row-${eq.id}`}
                      onClick={() => setSelectedEventId(eq.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15 font-medium"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${style.bg} ${style.text}`}
                        >
                          {eq.magnitude.toFixed(1)} {eq.magnitudeType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground text-xs sm:text-sm">
                            {eq.placeNameTr}
                          </div>
                          {bindingDesc && (
                            <div className="text-[11px] text-primary font-medium">
                              {bindingDesc}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {eq.depthKm.toFixed(2)} km
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {eq.latitude.toFixed(2)}° K, {eq.longitude.toFixed(2)}° D
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {formatTime(eq.occurredAtUtc)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          size="sm"
                          className="font-mono text-[10px] text-muted-foreground"
                        >
                          AFAD
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Load More Button if results exceed displayCount */}
            {filteredEvents.length > displayCount && (
              <div className="p-3 bg-muted/20 border-t border-border text-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl"
                  onClick={() => setDisplayCount((prev) => prev + 50)}
                >
                  Daha Fazla Göster (+50 Sarsıntı)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
