"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { projectToMapPoint } from "@/lib/map/projection";
import { sliceScale, viewBoxRect } from "@/lib/map/context-label-fit";
import { UNLABELLED_CONTEXT_ISOS } from "@/lib/map/map-country-names";
import { markerHitRadius, markerTextLegible } from "@/lib/map/marker-legibility";
import {
  MapContextLabels,
  contextLabelCandidates,
  useMapBoxMetrics,
} from "@/components/v2/map-context-labels";
import type { EarthquakeEvent, EarthquakeList } from "@/lib/api/types";
import { buildEarthquakeQuery } from "@/lib/earthquake/query";
import { bindingSentenceKey } from "@/lib/earthquake/binding-sentence";
import { magnitudeTypeName } from "@/lib/earthquake/magnitude";
import {
  MAGNITUDE_BUCKETS,
  MAGNITUDE_IDENTITY,
  MAGNITUDE_LABEL,
  MAGNITUDE_RING,
  magnitudeIdentityOf,
} from "@/lib/theme/magnitude-identity";
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
  Clock,
  ArrowRight,
  List,
  AlertTriangle,
  RefreshCw,
  Info,
  Calendar,
} from "lucide-react";
import { foldForSearch } from "@/lib/search/normalize";
import { MapAttribution } from "@/components/patterns/map-attribution";
import { formatDayTime } from "@/lib/text/format-date";
import { tr } from "@/lib/text/format-number";

export interface V2EarthquakeItem {
  id: string;
  magnitude: number;
  magnitudeType: string;
  magnitudeTypeRaw?: string;
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

/** The wide frame's neighbours that may carry a label; which of them do is decided per render scale. */
const CONTEXT_LABEL_CANDIDATES = contextLabelCandidates(
  CONTEXT_SHAPES.filter((c) => c.iso !== "TR" && !UNLABELLED_CONTEXT_ISOS.has(c.iso)),
);

/** The magnitude printed on a disc, in viewBox units (9.5 when selected). */
const DISC_VALUE_FONT_UNITS = 8.5;

/** The wide artifact fills its box exactly (same 1270:580 aspect), so the frame is the viewBox. */
const WIDE_VIEWBOX = viewBoxRect(TR_CONTEXT_VIEWBOX);
const WIDE_FRAME = {
  left: WIDE_VIEWBOX.x,
  top: WIDE_VIEWBOX.y,
  right: WIDE_VIEWBOX.x + WIDE_VIEWBOX.width,
  bottom: WIDE_VIEWBOX.y + WIDE_VIEWBOX.height,
};

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
  /**
   * The map box, measured on resize (T-085): CSS px per viewBox unit, `null` until measured so the
   * server render and first paint agree and draw the desktop labels.
   */
  const mapBoxRef = React.useRef<HTMLDivElement | null>(null);
  const mapBox = useMapBoxMetrics(mapBoxRef);
  const mapScale =
    mapBox && sliceScale(mapBox.width, mapBox.height, WIDE_VIEWBOX.width, WIDE_VIEWBOX.height);
  /**
   * Whether the magnitude printed on a disc is legible (T-087). Below that it is not drawn: the
   * selected event's magnitude is the headline of the card under the map.
   */
  const showDiscValues = markerTextLegible(DISC_VALUE_FONT_UNITS, mapScale);
  const [displayCount, setDisplayCount] = React.useState<number>(50);

  // Live client-side fetch state
  const [events, setEvents] = React.useState<V2EarthquakeItem[]>(() =>
    initialEvents.map((item) => {
      const prov = item.bindingPlateCode ? provinceMap.get(item.bindingPlateCode) : undefined;
      return {
        id: item.id,
        magnitude: item.magnitude,
        magnitudeType: item.magnitudeType,
        magnitudeTypeRaw: item.magnitudeTypeRaw,
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
            magnitudeTypeRaw: item.magnitudeTypeRaw,
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
        setFetchError("Deprem listesi güncellenemedi. Biraz sonra yeniden dene.");
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // ONE zone, not the runtime's (T-064). AFAD publishes `occurredAtUtc`; formatting it without a
  // `timeZone` told a reader an event happened at 21:30 "yesterday" when the people who felt it
  // were already past midnight — and made the server and the browser disagree about the text.
  const formatTime = (utcString: string) => formatDayTime(utcString, "tr");

  /* THE MAGNITUDE RAMP IS NOT DEFINED HERE ANY MORE (T-031c). `getMagnitudeStyle` used to sit
     at this point and return a four-step traffic-light scale in the red/orange/amber/emerald
     families, alongside two fields — a `border` and a `ring` — that no call site ever read.
     It is replaced by `lib/theme/magnitude-identity.ts`, which reads `--eq-mag-1`…`--eq-mag-5`
     and classifies through `lib/earthquake/magnitude.ts`, the module `MagnitudeBadge` has been
     using all along. The five steps are that classifier's, not a fifth hue invented here: this
     component's own `getIntensityLabel` below already splits at 6.0.

     The ramp's dark-mode contrast is a known failure and is T-031d's, not this file's. */

  const getIntensityLabel = (mag: number) => {
    if (mag >= 6.0) return "Büyük deprem";
    if (mag >= 5.0) return "Orta-büyük deprem";
    if (mag >= 4.0) return "Orta büyüklükte";
    if (mag >= 3.0) return "Hissedilir";
    return "Çok küçük deprem";
  };

  const getBindingDescription = (item: V2EarthquakeItem) => {
    if (!item.bindingKind || item.bindingKind === "inside") return null;
    const sentenceKey = bindingSentenceKey(item.bindingKind);
    if (sentenceKey === "offshoreNear") {
      return item.provinceName ? `Denizde, ${item.provinceName} açıklarında` : "Denizde";
    }
    if (sentenceKey === "acrossBorder") {
      return item.provinceName
        ? `Türkiye dışında, en yakın il: ${item.provinceName}`
        : "Türkiye dışında";
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
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
              Depremleri Filtrele
            </h2>
          </div>

          {/* Quick Metrics & Refresh Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-card border border-border flex items-center gap-2 shadow-2xs">
              <span
                className={`size-2 rounded-full ${isLoading ? "bg-warning animate-spin" : "bg-success"}`}
              />
              <span className="text-xs font-semibold text-foreground">
                {isLoading ? "Güncelleniyor…" : `${filteredEvents.length} deprem`}
              </span>
            </div>
            {maxMagnitudeEvent && !isLoading && (
              <div className="px-3.5 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                <Flame className="size-3.5 text-destructive" />
                <span className="text-xs font-bold text-destructive">
                  En büyüğü: M {tr(maxMagnitudeEvent.magnitude, 1)} ({maxMagnitudeEvent.placeNameTr}
                  )
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
                        ? "bg-primary text-white shadow-xs font-bold scale-[1.02]"
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
              <Activity className="size-3.5 text-destructive" /> En Küçük Büyüklük:
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
              <Search className="size-3.5 text-muted-foreground" /> Yer Ara:
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
        {/* Map Header Toolbar with Integrated Legend & Magnitude Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              Her daire bir depremin merkez üssü. Daire büyüdükçe deprem de büyür.
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Magnitude Legend. Rendered FROM the ramp rather than beside it: this key is the
                reader's only explanation of the marker colours, so a hand-written swatch could
                go on describing a scale the map no longer draws. It spelled four swatches out
                independently until T-031c — and the map, at that moment, was drawing none of
                them. Both the swatch and the printed range come from
                `lib/theme/magnitude-identity.ts` now, so the legend cannot disagree with the
                markers or with the classifier. */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
              {MAGNITUDE_BUCKETS.map((bucket) => (
                <span key={bucket} className="inline-flex items-center gap-1">
                  <span className={`size-2 rounded-full ${MAGNITUDE_IDENTITY[bucket].swatch}`} />{" "}
                  {MAGNITUDE_IDENTITY[bucket].legend}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* EXACT ASPECT RATIO VECTOR MAP (NO LETTERBOX GAPS), and its caption.
            ONE BOX for the two, so the gap under the map is the caption's own 8px rather than
            the section's `space-y-*` — which set it to 16px here, 20px on the game screens and
            24px on `/turkiye`, three spacings for one relationship. */}
        {/* A map and the line that credits it are a FIGURE and its CAPTION — the relationship
            `v2-province-locator-map.tsx` has always expressed and the other six did not, so a screen
            reader heard a figure caption on a province page and a loose paragraph on `/turkiye`.
            `m-0` because a `<figure>` carries a UA margin a `<div>` does not. */}
        <figure className="m-0 space-y-2">
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setHoveredEventId(null);
              setMousePos(null);
            }}
            ref={mapBoxRef}
            className="relative w-full aspect-[1270/580] bg-[var(--map-plate)] rounded-2xl border border-border/80 overflow-hidden shadow-inner cursor-default select-none p-0"
          >
            <svg
              viewBox={TR_CONTEXT_VIEWBOX}
              className="w-full h-full block select-none"
              aria-label="Türkiye Canlı Deprem Haritası"
            >
              {/* Surrounding Context Countries */}
              <g className="fill-[var(--map-context-land)] stroke-[var(--map-context-line)] stroke-[1] stroke-linejoin-round pointer-events-none">
                {CONTEXT_SHAPES.filter((c) => c.iso !== "TR").map((country) => (
                  <path key={country.iso} d={country.d} />
                ))}
              </g>

              {/* Neighbour-country and sea names, legible at every box size and dropped where
                they do not fit (T-085). Painted here, under the provinces and the markers, in
                the order `lib/theme/magnitude-ramp.test.ts` enumerates. */}
              <MapContextLabels
                candidates={CONTEXT_LABEL_CANDIDATES}
                scale={mapScale}
                frame={WIDE_FRAME}
                neighboursFirst
              />

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

              {/* Inland Lakes & Waters. Painted AFTER the province layer above (not before, as it
                was originally) because SVG paints in document order and the province layer's
                fill-card/90 is ~90% opaque: with the lakes underneath, that fill covered them
                almost entirely in both themes, independent of colour -- the water was invisible
                since this file was written. The sibling `v2-turkey-map-explorer.tsx` already
                orders its "3. Türkiye 81 Provinces Layer" before its "4. Inland Lakes" group for
                the same reason. `pointer-events-none` keeps province hover/selection working
                through this layer, and the epicentre markers below still paint after it, so a
                lake never covers a quake marker. */}
              <g className="fill-[var(--map-sea)] stroke-[var(--map-water-line)] stroke-[0.5] pointer-events-none">
                {INLAND_WATER_SHAPES.map((water) => (
                  <path key={water.id} d={water.d} />
                ))}
              </g>

              {/* Seismic Earthquake Epicenters (Stable Hit Targets - Zero Flickering) */}
              {filteredEvents.map((eq, index) => {
                const pt = projectToMapPoint(eq.longitude, eq.latitude);
                const isSelected = selectedEventId === eq.id;
                const isHovered = hoveredEventId === eq.id;
                // Roving tabindex (A11Y126-I5, WAI-ARIA composite-widget pattern): the whole
                // marker group is ONE tab stop instead of one per event (up to `pageSize: 150`).
                // `selectedEvent` is a useMemo that falls back to `filteredEvents[0]`, so it is
                // never null while any marker renders and always names a member of the list —
                // exactly one marker therefore carries `tabIndex={0}` at all times. Binding this
                // to the raw `selectedEventId` instead would leave nothing focusable when it is
                // null.
                const isTabStop = selectedEvent?.id === eq.id;
                const baseRadius = Math.max(3.5, Math.min(14, (eq.magnitude - 1.2) * 3.2));
                const radius = isSelected ? baseRadius * 1.35 : baseRadius;
                const tone = magnitudeIdentityOf(eq.magnitude);

                return (
                  <g
                    key={eq.id}
                    id={`eq-marker-${eq.id}`}
                    tabIndex={isTabStop ? 0 : -1}
                    className="cursor-pointer outline-none select-none transition-transform duration-150 focus-visible:scale-125"
                    role="button"
                    aria-label={`Deprem M ${tr(eq.magnitude, 1)} - ${eq.placeNameTr}`}
                    onPointerEnter={(e) => {
                      // A mouse only (T-087): a tap fires the mouse events too, and pinned this
                      // tooltip over a phone map with nothing to dismiss it.
                      if (e.pointerType === "mouse") setHoveredEventId(eq.id);
                    }}
                    onPointerLeave={() => setHoveredEventId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEventId(eq.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedEventId(eq.id);
                      } else if (
                        e.key === "ArrowRight" ||
                        e.key === "ArrowDown" ||
                        e.key === "ArrowLeft" ||
                        e.key === "ArrowUp" ||
                        e.key === "Home" ||
                        e.key === "End"
                      ) {
                        // Arrow/Home/End move the single tab stop within the group. Order is
                        // `filteredEvents` order (the api's recency order, the same order the
                        // table renders), not geographic adjacency; both ends wrap.
                        e.preventDefault();
                        const last = filteredEvents.length - 1;
                        const nextIndex =
                          e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? last
                              : e.key === "ArrowRight" || e.key === "ArrowDown"
                                ? index === last
                                  ? 0
                                  : index + 1
                                : index === 0
                                  ? last
                                  : index - 1;
                        // `noUncheckedIndexedAccess`: this really can be undefined.
                        const next = filteredEvents[nextIndex];
                        if (next) {
                          setSelectedEventId(next.id);
                          document.getElementById(`eq-marker-${next.id}`)?.focus();
                        }
                      }
                    }}
                  >
                    {/* Fixed invisible hit circle to prevent DOM detach/flickering; never under
                      a 24px touch target, which at a phone's scale is ~53 units (T-087). */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={markerHitRadius(baseRadius + 9, mapScale)}
                      className="fill-transparent"
                      pointerEvents="all"
                    />

                    {/* Subtle native SVG ripple pulse (100% stable, zero coordinate shift) */}
                    {(isSelected || isHovered || eq.magnitude >= 3.5) && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={radius}
                        /* The ripple used to carry four RAW HEXES in a `stroke` prop — the
                         Tailwind v3 values of red/orange/emerald, plus amber for the selected
                         state — re-classified at three thresholds of its own. A bare hex in a
                         prop is a class to no scanner, so neither arm of the palette count
                         could see it and it was free to drift from the badges it sits under.
                         Selection is `--ring`, the token that exists for it; everything else is
                         the event's own step. */
                        className={`fill-none pointer-events-none ${
                          isSelected ? "stroke-ring" : tone.ripple
                        }`}
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
                            ? "stroke-ring stroke-[2.5]"
                            : eq.magnitude >= 4.0
                              ? "stroke-destructive/70"
                              : "stroke-primary/50"
                        }`}
                        pointerEvents="none"
                      />
                    )}

                    {/* Epicenter Core Circle (Pure SVG radius - zero CSS transform displacement).
                      Ring is MAGNITUDE_RING, not the old `stroke-white dark:stroke-black` pair
                      — see that constant's docblock in lib/theme/magnitude-identity.ts for the
                      measurement behind it (T-031d Task 13). */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={radius}
                      className={`${tone.mark} ${MAGNITUDE_RING} stroke-[1.5] shadow-md pointer-events-none transition-all duration-150`}
                      pointerEvents="none"
                    />

                    {/* Magnitude text badge on M >= 3.5. MAGNITUDE_LABEL, not the old
                      `fill="#ffffff"` — that was an SVG presentation attribute, which a class
                      cannot shadow, so it had to be deleted rather than overridden (T-031d
                      Task 13; see MAGNITUDE_LABEL's docblock in lib/theme/magnitude-identity.ts
                      for the measurement). */}
                    {showDiscValues && eq.magnitude >= 3.5 && (
                      <text
                        x={pt.x}
                        y={pt.y + (isSelected ? 3.5 : 3)}
                        textAnchor="middle"
                        fontSize={isSelected ? 9.5 : DISC_VALUE_FONT_UNITS}
                        fontWeight="bold"
                        className={`${MAGNITUDE_LABEL} pointer-events-none select-none font-mono`}
                      >
                        {tr(eq.magnitude, 1)}
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
                    M {tr(hoveredEvent.magnitude, 1)} {hoveredEvent.magnitudeType}
                  </span>
                  <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 font-mono">
                    {tr(hoveredEvent.depthKm, 1)} km
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

          {/* UNDER the plate. Inside it the credit flowed below a `h-full` map and the plate's
            `overflow-hidden` cut it off: on `/deprem` it sat at y=532 of a 533px box, so the
            ODbL and JRC lines this component publishes reached no reader at all. */}
          <figcaption>
            <MapAttribution inlandWater context />
          </figcaption>
        </figure>
      </div>

      {/* Accessible Live Region for Selected Earthquake Announcement (WCAG 4.1.3, A11Y126-I4) */}
      <div role="status" aria-live="polite" className="sr-only">
        {selectedEvent &&
          `Seçilen deprem: Büyüklük ${tr(selectedEvent.magnitude, 1)}, ${selectedEvent.placeNameTr}, derinlik ${tr(selectedEvent.depthKm)} km.`}
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
                    Seçtiğin Deprem
                  </Badge>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="text-[10px] py-0 px-2 font-semibold"
                  >
                    {getIntensityLabel(selectedEvent.magnitude)}
                  </Badge>
                </div>
              </div>

              {/* Magnitude & Epicenter Title */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-4xl sm:text-5xl font-extrabold text-foreground">
                    M {tr(selectedEvent.magnitude, 1)}
                  </span>
                  <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                    {selectedEvent.magnitudeType}
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
                    {tr(selectedEvent.depthKm, 2)} km
                  </span>
                  <span className="text-[9px] text-muted-foreground block">
                    {selectedEvent.depthKm <= 60 ? "Sığ odaklı" : "Orta ya da derin odaklı"}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Ne Zaman</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">
                    {formatTime(selectedEvent.occurredAtUtc)}
                  </span>
                  <span className="text-[9px] text-muted-foreground block">Türkiye saatiyle</span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Büyüklük Türü</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">
                    {magnitudeTypeName(selectedEvent)}
                  </span>
                  {selectedEvent.magnitudeType === "Mw" && (
                    <span className="text-[9px] text-muted-foreground block">
                      Büyük depremleri doğru ölçer
                    </span>
                  )}
                  {selectedEvent.magnitudeType === "ML" && (
                    <span className="text-[9px] text-muted-foreground block">
                      Bilinen adıyla Richter ölçeği
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Kaynak</span>
                  <span className="font-mono font-bold text-foreground sm:text-sm">AFAD</span>
                </div>
              </div>

              {/* Coordinates Strip */}
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Merkez üssü:</span>
                <span className="font-mono font-medium text-foreground">
                  {tr(selectedEvent.latitude, 4)}° K, {tr(selectedEvent.longitude, 4)}° D
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
                    pathname: "/turkiye/[slug]",
                    params: { slug: selectedEvent.provinceSlug },
                  }}
                  className="w-full inline-flex items-center justify-center font-medium transition-all duration-150 h-9 px-3 text-xs gap-1.5 rounded-xl bg-primary text-white hover:bg-primary shadow-xs"
                >
                  <span className="text-white">İl Sayfası</span>
                  <ArrowRight className="size-3.5 ml-1 text-white" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-3xl border border-border bg-card text-center space-y-2 flex flex-col items-center justify-center">
            <Info className="size-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Bu filtrelerle eşleşen deprem yok.</p>
          </div>
        )}

        {/* Right Col: Recent Earthquakes Live Feed */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-lg space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-primary" /> En Son Beş Deprem
            </span>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between">
            {filteredEvents.slice(0, 5).map((eq) => {
              const isSelected = selectedEventId === eq.id;
              const tone = magnitudeIdentityOf(eq.magnitude);
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
                      className={`size-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${tone.badge}`}
                    >
                      {tr(eq.magnitude, 1)}
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
                      {tr(eq.depthKm, 1)} km
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
              Deprem Listesi
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Seçtiğin zaman aralığındaki depremler, en yenisi en üstte. Bir satıra tıklarsan o
              deprem haritada ve üstteki kartta seçilir.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {filteredEvents.length} deprem
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-border text-center space-y-2">
            <Info className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">Eşleşen deprem yok</p>
            <p className="text-xs text-muted-foreground">
              En küçük büyüklüğü düşür, daha uzun bir zaman aralığı seç ya da aramayı temizle.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-x-auto bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-24">BÜYÜKLÜK</TableHead>
                  <TableHead>YER</TableHead>
                  <TableHead className="text-right">DERİNLİK</TableHead>
                  <TableHead className="text-right">ENLEM / BOYLAM</TableHead>
                  <TableHead className="text-right">TARİH VE SAAT</TableHead>
                  <TableHead className="text-right">KAYNAK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.slice(0, displayCount).map((eq) => {
                  const isSelected = selectedEventId === eq.id;
                  const tone = magnitudeIdentityOf(eq.magnitude);
                  const bindingDesc = getBindingDescription(eq);

                  return (
                    <TableRow
                      key={eq.id}
                      id={`eq-row-${eq.id}`}
                      tabIndex={0}
                      aria-selected={isSelected}
                      aria-label={`M ${tr(eq.magnitude, 1)} - ${eq.placeNameTr} depremini seç`}
                      onClick={() => setSelectedEventId(eq.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedEventId(eq.id);
                        }
                      }}
                      className={`cursor-pointer transition-colors outline-none focus-visible:bg-primary/15 ${
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15 font-medium"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${tone.badge}`}
                        >
                          {tr(eq.magnitude, 1)} {eq.magnitudeType}
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
                        {tr(eq.depthKm, 2)} km
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {tr(eq.latitude, 2)}° K, {tr(eq.longitude, 2)}° D
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
                  50 Deprem Daha Göster
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
