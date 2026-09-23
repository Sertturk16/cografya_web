"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
import { MapAttribution } from "@/components/patterns/map-attribution";
import type { CountryListItem, CountryMapSummary } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Compass, ArrowUpRight, Globe2 } from "lucide-react";

interface V2ContinentLocatorMapProps {
  continentName: string;
  continentSlug: string;
  countries: (CountryListItem | CountryMapSummary)[];
  fillColor?: string;
  hoverFillColor?: string;
  strokeColor?: string;
}

export function V2ContinentLocatorMap({
  continentName,
  countries,
  fillColor = "var(--color-primary, #b0522e)",
  hoverFillColor = "var(--color-primary-dark, #7e3a1e)",
  // `--card`, the panel's own colour, so the line between two member countries reads as a gap:
  // 5.13:1 on the light `--primary` fill, 4.99:1 on the dark one. `--color-primary-dark` on the
  // same fill measured 1.63:1 light / 2.45:1 dark and merged neighbours into one blob (T-092).
  strokeColor = "var(--card)",
}: V2ContinentLocatorMapProps) {
  const [hoveredIso, setHoveredIso] = React.useState<string | null>(null);

  // Set of ISO codes in this continent
  const continentIsoSet = React.useMemo(() => {
    return new Set(countries.map((c) => c.isoCode.toUpperCase()));
  }, [countries]);

  // Lookup country details by ISO
  const countryByIso = React.useMemo(() => {
    const map = new Map<string, CountryListItem | CountryMapSummary>();
    countries.forEach((c) => map.set(c.isoCode.toUpperCase(), c));
    return map;
  }, [countries]);

  const hoveredCountry = hoveredIso ? countryByIso.get(hoveredIso) : null;
  const hoveredPop =
    hoveredCountry &&
    "population" in hoveredCountry &&
    typeof hoveredCountry.population === "number"
      ? hoveredCountry.population
      : null;
  const hoveredArea =
    hoveredCountry && "areaKm2" in hoveredCountry && typeof hoveredCountry.areaKm2 === "number"
      ? hoveredCountry.areaKm2
      : null;

  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-4">
      {/* Header Info Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-primary" />
          <h3 className="font-heading font-bold text-sm sm:text-base text-foreground">
            {continentName} Dünya Haritasındaki Konumu ve Ülkeleri
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="font-mono text-xs bg-primary/10 text-primary-strong border-primary/30"
          >
            {countries.length} Ülke
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Ülkelere tıklayarak detaylı coğrafya rehberine ulaşabilirsiniz
          </span>
        </div>
      </div>

      {/* SVG Map Container and its caption. A FIGURE, like every other map surface here: the
          credit is this map's caption, not a loose line further down the card. It used to sit
          after the footer note below, which put a sentence about the map between the map and the
          line naming where it came from. */}
      <figure className="m-0 space-y-2">
        <div className="relative w-full aspect-[1000/521] rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/60 overflow-hidden flex items-center justify-center">
          <svg
            viewBox={WORLD_MAP_VIEWBOX}
            role="img"
            aria-label={`${continentName} kıtası dünya haritasındaki konumu`}
            className="w-full h-full"
          >
            {/* Base / Background shapes */}
            {COUNTRY_SHAPES.map((shape) => {
              const isContinentMember = continentIsoSet.has(shape.iso.toUpperCase());
              const isHovered = hoveredIso === shape.iso.toUpperCase();

              if (!isContinentMember) {
                // Pixel width on a non-scaling stroke: the viewBox is 1000 wide, so a unitless
                // 0.3 drew about a tenth of a pixel on a phone (T-092). `stroke-border/40`
                // measured 1.03:1 light / 1.00:1 dark on this fill, i.e. no line at all;
                // `muted-foreground/50` is 2.14:1 / 2.44:1. These are context countries, not the
                // subject, so their line stays quieter than the members' 5:1.
                return (
                  <path
                    key={shape.iso}
                    d={shape.d}
                    fillRule="evenodd"
                    className="fill-muted-foreground/15 dark:fill-muted-foreground/20 stroke-muted-foreground/50 [stroke-width:0.75px] [vector-effect:non-scaling-stroke]"
                  />
                );
              }

              return (
                <path
                  key={shape.iso}
                  d={shape.d}
                  fillRule="evenodd"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    fill: isHovered ? hoverFillColor : fillColor,
                    stroke: strokeColor,
                    strokeWidth: isHovered ? "1.5px" : "0.75px",
                    transition: "fill 0.15s ease, stroke-width 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredIso(shape.iso.toUpperCase())}
                  onMouseLeave={() => setHoveredIso(null)}
                />
              );
            })}
          </svg>

          {/* Hover Floating Card */}
          {hoveredCountry && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs bg-background/95 backdrop-blur-md border border-primary/40 rounded-2xl p-3.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150 z-20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9 */}
                  <img
                    src={`/flags/${hoveredCountry.isoCode.toUpperCase()}.svg`}
                    alt={`${hoveredCountry.nameTr} bayrağı`}
                    className="w-6 h-4 object-cover rounded-xs border border-border shadow-2xs shrink-0"
                  />
                  <span className="font-heading font-bold text-sm text-foreground">
                    {hoveredCountry.nameTr}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {hoveredCountry.isoCode}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2.5">
                {hoveredPop !== null && (
                  <div>
                    <span className="text-[10px] block font-semibold text-foreground/70">
                      Nüfus
                    </span>
                    <span className="font-medium text-foreground">
                      {new Intl.NumberFormat("tr-TR").format(hoveredPop)}
                    </span>
                  </div>
                )}
                {hoveredArea !== null && (
                  <div>
                    <span className="text-[10px] block font-semibold text-foreground/70">
                      Yüzölçümü
                    </span>
                    <span className="font-medium text-foreground">
                      {new Intl.NumberFormat("tr-TR").format(hoveredArea)} km²
                    </span>
                  </div>
                )}
              </div>

              <Link
                href={{
                  pathname: "/dunya/[slug]",
                  params: { slug: hoveredCountry.slugTr },
                }}
                className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <span>Ülke Sayfasına Git</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          )}
        </div>
        <figcaption>
          <MapAttribution boundaries={false} world />
        </figcaption>
      </figure>

      {/* Footer helper note */}
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <span className="flex items-center gap-1">
          <Globe2 className="size-3.5 text-primary" />
          <span>Vurgulanan alanlar {continentName} kıtasına ait ülkeleri temsil eder.</span>
        </span>
        {/* "Projeksiyon: Natural Earth 1" names the PROJECTION. It reads like a source line
            and is not one, which is how this surface drew 199 Natural Earth polygons with
            nothing crediting them. The credit is its own line now and the projection keeps its
            own words. */}
        <span className="font-mono text-[11px]">Projeksiyon: Natural Earth 1</span>
      </div>
    </div>
  );
}
