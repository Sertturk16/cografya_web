"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import type { RegionProvinceItem } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { MapPin, Compass, Users, ArrowUpRight } from "lucide-react";

interface V2RegionLocatorMapProps {
  regionName: string;
  regionSlug: string;
  provinces: RegionProvinceItem[];
  themeClass?: string;
  fillColor?: string;
  strokeColor?: string;
}

export function V2RegionLocatorMap({
  regionName,
  regionSlug,
  provinces,
  fillColor = "var(--color-primary, #b0522e)",
  strokeColor = "var(--color-primary-dark, #7e3a1e)",
}: V2RegionLocatorMapProps) {
  const [hoveredPlate, setHoveredPlate] = React.useState<string | null>(null);

  // Set of plate codes in this region
  const regionPlateSet = React.useMemo(() => {
    return new Set(provinces.map((p) => p.plateCode));
  }, [provinces]);

  // Lookup province details by plate code
  const provinceByPlate = React.useMemo(() => {
    const map = new Map<string, RegionProvinceItem>();
    provinces.forEach((p) => map.set(p.plateCode, p));
    return map;
  }, [provinces]);

  const hoveredProvince = hoveredPlate ? provinceByPlate.get(hoveredPlate) : null;
  const trCasing = CONTEXT_SHAPES.find((c) => c.iso === "TR");

  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4">
      {/* Header Info Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-primary" />
          <h3 className="font-heading font-bold text-sm sm:text-base text-foreground">
            {regionName} Türkiye Haritasındaki Konumu
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="font-mono text-xs bg-primary/10 text-primary border-primary/30"
          >
            {provinces.length} İl
          </Badge>
        </div>
      </div>

      {/* SVG Map Container */}
      <div className="relative w-full aspect-[1270/580] rounded-2xl bg-[var(--map-sea,#dbe7e8)] dark:bg-[#152228] border border-border overflow-hidden select-none shadow-xs">
        {/* Floating Tooltip Pill */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none transition-all duration-200">
          {hoveredProvince ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/95 dark:bg-card/95 backdrop-blur-md border border-primary/40 shadow-lg text-xs animate-in fade-in zoom-in-95">
              <span className="font-mono font-bold text-primary">#{hoveredProvince.plateCode}</span>
              <span className="font-bold text-foreground">{hoveredProvince.nameTr}</span>
              {hoveredProvince.population !== null && (
                <span className="text-muted-foreground flex items-center gap-1 pl-1 border-l border-border">
                  <Users className="size-3 text-muted-foreground" />
                  {hoveredProvince.population.toLocaleString("tr-TR")}
                </span>
              )}
              <span className="text-[10px] text-primary/80 font-medium pl-1">Tıkla →</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/80 dark:bg-card/80 backdrop-blur-xs border border-border/80 text-[11px] text-muted-foreground">
              <MapPin className="size-3 text-primary" />
              <span>İllerin üzerine gelerek detayları görebilirsiniz</span>
            </div>
          )}
        </div>

        <svg
          viewBox={TR_CONTEXT_VIEWBOX}
          className="w-full h-full block"
          aria-label={`${regionName} illerinin Türkiye haritasındaki konumu`}
        >
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

          {/* 3. Non-Region Provinces (Dimmed background) */}
          <g className="stroke-border/60 stroke-[0.5] fill-card dark:fill-[#201c18]">
            {PROVINCE_SHAPES.filter((shape) => !regionPlateSet.has(shape.plateCode)).map(
              (shape) => (
                <path
                  key={shape.plateCode}
                  d={shape.d}
                  className="opacity-55 hover:opacity-75 transition-opacity"
                />
              ),
            )}
          </g>

          {/* 4. Inland Lakes */}
          <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#152228] stroke-[var(--color-accent,#276b70)]/40 stroke-[0.5] pointer-events-none">
            {INLAND_WATER_SHAPES.map((lake) => (
              <path key={lake.id} d={lake.d} />
            ))}
          </g>

          {/* 5. Region Provinces Glow Underlay */}
          <g className="pointer-events-none">
            {PROVINCE_SHAPES.filter((shape) => regionPlateSet.has(shape.plateCode)).map((shape) => (
              <path
                key={`glow-${shape.plateCode}`}
                d={shape.d}
                style={{ fill: fillColor }}
                className="opacity-30 blur-xs"
              />
            ))}
          </g>

          {/* 6. Active Region Provinces (Interactive & Highlighted) */}
          <g className="cursor-pointer">
            {PROVINCE_SHAPES.filter((shape) => regionPlateSet.has(shape.plateCode)).map((shape) => {
              const prov = provinceByPlate.get(shape.plateCode);
              const isHovered = hoveredPlate === shape.plateCode;

              return (
                <Link
                  key={shape.plateCode}
                  href={{
                    pathname: "/v2/turkiye/[slug]",
                    params: { slug: prov?.slugTr ?? shape.plateCode },
                  }}
                  onMouseEnter={() => setHoveredPlate(shape.plateCode)}
                  onMouseLeave={() => setHoveredPlate(null)}
                  className="focus:outline-none"
                >
                  <path
                    d={shape.d}
                    style={{
                      fill: isHovered ? "var(--color-primary-hover, #c8633c)" : fillColor,
                      stroke: isHovered ? "#ffffff" : strokeColor,
                      strokeWidth: isHovered ? 2.2 : 1.2,
                    }}
                    className="transition-all duration-150 filter drop-shadow-xs"
                    aria-label={prov?.nameTr ?? shape.plateCode}
                  />
                </Link>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Quick Province Pill Shortcuts */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold">Bölge İllerine Hızlı Geçiş:</span>
          <span>{provinces.length} İl Listelendi</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-none p-0.5">
          {provinces.map((prov) => {
            const isHovered = hoveredPlate === prov.plateCode;
            return (
              <Link
                key={prov.plateCode}
                href={{
                  pathname: "/v2/turkiye/[slug]",
                  params: { slug: prov.slugTr },
                }}
                onMouseEnter={() => setHoveredPlate(prov.plateCode)}
                onMouseLeave={() => setHoveredPlate(null)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
                  isHovered
                    ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                    : "bg-muted/70 hover:bg-muted text-foreground border-border/80"
                }`}
              >
                <span className="font-mono text-[10px] opacity-75">#{prov.plateCode}</span>
                <span>{prov.nameTr}</span>
                <ArrowUpRight className="size-2.5 opacity-50" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
