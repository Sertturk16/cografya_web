import * as React from "react";
import { getTranslations } from "next-intl/server";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";

interface V2ProvinceLocatorMapProps {
  plateCode: string;
  provinceName: string;
}

/**
 * The province locator, drawn from the build-time generated shapes.
 *
 * ## The credit is not decoration
 *
 * `tr-provinces.generated.ts` and `tr-context.generated.ts` are projected from
 * `data/tr-il-boundaries.geojson`, which is **© OpenStreetMap contributors, ODbL** — their own
 * file headers say so. ODbL requires the credit to travel with the rendering, and this component
 * shipped without one: T-032 PR3 found it by re-pointing `components/map/locator-attribution.test.ts`
 * at the V2 province page, where it had been guarding `LocatorMap`'s `<figcaption>` all along.
 * The V2 rewrite swapped the component and the obligation went with it.
 *
 * The string is read HERE rather than taken as a prop, for the reason `LocatorMap`'s own test
 * records: a caller-supplied credit can be dropped at one call site, and the chip stops
 * travelling with the figure. Same for the accessible name — this component hardcoded a Turkish
 * sentence, so the EN page announced the map in Turkish while `ProvinceDetail.locationAlt` sat
 * unused in both catalogues.
 *
 * The composite carries ONE accessible name (`role="img"` + `aria-label`), like `LocatorMap`.
 */
export async function V2ProvinceLocatorMap({ plateCode, provinceName }: V2ProvinceLocatorMapProps) {
  const t = await getTranslations("Map");
  const tProvince = await getTranslations("ProvinceDetail");
  const targetShape = PROVINCE_SHAPES.find((s) => s.plateCode === plateCode);
  const trCasing = CONTEXT_SHAPES.find((c) => c.iso === "TR");

  return (
    <figure className="m-0 space-y-1.5">
      <div
        className="relative w-full aspect-[1270/580] rounded-2xl bg-[var(--map-sea,#dbe7e8)] dark:bg-[#152228] border border-border overflow-hidden select-none shadow-sm"
        role="img"
        aria-label={tProvince("locationAlt", { name: provinceName })}
      >
        <svg viewBox={TR_CONTEXT_VIEWBOX} className="w-full h-full block" aria-hidden="true">
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

          {/* 3. All 81 Provinces (Background) */}
          <g className="stroke-border/70 stroke-[0.6] fill-card dark:fill-[#201c18]">
            {PROVINCE_SHAPES.map((shape) => (
              <path key={shape.plateCode} d={shape.d} className="opacity-70" />
            ))}
          </g>

          {/* 4. Inland Lakes */}
          <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#152228] stroke-accent/40 stroke-[0.5] pointer-events-none">
            {INLAND_WATER_SHAPES.map((lake) => (
              <path key={lake.id} d={lake.d} />
            ))}
          </g>

          {/* 5. Highlighted Target Province (Glowing Terracotta) */}
          {targetShape && (
            <g>
              {/* Soft Glow Underlay */}
              <path d={targetShape.d} className="fill-primary opacity-40 blur-xs" />
              {/* Sharp Highlight Shape */}
              <path
                d={targetShape.d}
                className="fill-primary stroke-primary dark:stroke-primary stroke-[1.8] opacity-100 filter drop-shadow-md"
              />
            </g>
          )}
        </svg>
      </div>
      {/* The ODbL credit. Visible on the page, beside the figure — the layer that survives the
          shapes failing to render, and the one a reader actually sees. */}
      <figcaption className="text-[11px] text-muted-foreground">{t("attribution")}</figcaption>
    </figure>
  );
}
