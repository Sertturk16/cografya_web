import * as React from "react";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";

interface V2ProvinceLocatorMapProps {
  plateCode: string;
  provinceName: string;
}

export function V2ProvinceLocatorMap({ plateCode, provinceName }: V2ProvinceLocatorMapProps) {
  const targetShape = PROVINCE_SHAPES.find((s) => s.plateCode === plateCode);
  const trCasing = CONTEXT_SHAPES.find((c) => c.iso === "TR");

  return (
    <div className="relative w-full aspect-[1270/580] rounded-2xl bg-[var(--map-sea,#dbe7e8)] dark:bg-[#152228] border border-border overflow-hidden select-none shadow-sm">
      <svg
        viewBox={TR_CONTEXT_VIEWBOX}
        className="w-full h-full block"
        aria-label={`${provinceName} ilinin Türkiye haritasındaki konumu`}
      >
        {/* 1. Surrounding Foreign Countries */}
        <g className="fill-[#f1ece3] dark:fill-[#2d2822] stroke-[#b8aea0] dark:stroke-[#50473e] stroke-[1] stroke-linejoin-round pointer-events-none">
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

        {/* 3. All 81 Provinces (Background) */}
        <g className="stroke-border/70 stroke-[0.6] fill-card dark:fill-[#201c18]">
          {PROVINCE_SHAPES.map((shape) => (
            <path
              key={shape.plateCode}
              d={shape.d}
              className="opacity-70"
            />
          ))}
        </g>

        {/* 4. Inland Lakes */}
        <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#152228] stroke-[var(--color-accent,#276b70)]/40 stroke-[0.5] pointer-events-none">
          {INLAND_WATER_SHAPES.map((lake) => (
            <path key={lake.id} d={lake.d} />
          ))}
        </g>

        {/* 5. Highlighted Target Province (Glowing Terracotta) */}
        {targetShape && (
          <g>
            {/* Soft Glow Underlay */}
            <path
              d={targetShape.d}
              className="fill-[var(--color-primary,#b0522e)] opacity-40 blur-xs"
            />
            {/* Sharp Highlight Shape */}
            <path
              d={targetShape.d}
              className="fill-[var(--color-primary,#b0522e)] stroke-[var(--color-primary-dark,#7e3a1e)] dark:stroke-primary stroke-[1.8] opacity-100 filter drop-shadow-md"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
