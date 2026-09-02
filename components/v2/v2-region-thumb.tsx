import type { CSSProperties } from "react";
import type { GeographicRegion } from "@/lib/api/types";
import { aspectOfViewBox } from "@/lib/game/map-bbox";
import type { GameShapeEntry } from "@/lib/game/map-shapes";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";

const THUMB_ID_PREFIX = "v2-region-thumb-";
const COUNTRY_ID = `${THUMB_ID_PREFIX}country`;

type ThumbStyle = CSSProperties & Record<"--region-thumb-aspect", string>;

export function V2RegionThumbDefs({ shapes }: { readonly shapes: readonly GameShapeEntry[] }) {
  return (
    <svg className="hidden" aria-hidden="true" focusable="false">
      <defs>
        {shapes.map((shape) => (
          <path
            key={shape.plateCode}
            id={`${THUMB_ID_PREFIX}${shape.plateCode}`}
            d={shape.d}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <g id={COUNTRY_ID}>
          {shapes.map((shape) => (
            <use key={shape.plateCode} href={`#${THUMB_ID_PREFIX}${shape.plateCode}`} />
          ))}
        </g>
      </defs>
    </svg>
  );
}

interface V2RegionThumbProps {
  readonly region: GeographicRegion;
  readonly members: readonly string[];
}

export function V2RegionThumb({ region, members }: V2RegionThumbProps) {
  const aspect = aspectOfViewBox(MAP_VIEWBOX);
  const style: ThumbStyle | undefined =
    aspect !== null && aspect > 0 ? { "--region-thumb-aspect": String(aspect) } : undefined;

  return (
    <div className="w-full aspect-[2.33/1] rounded-2xl bg-muted/40 p-2 flex items-center justify-center border border-border/60 overflow-hidden">
      <svg
        style={style}
        viewBox={MAP_VIEWBOX}
        className="w-full h-full object-contain select-none"
        aria-hidden="true"
        focusable="false"
        data-region={region}
      >
        <use
          href={`#${COUNTRY_ID}`}
          className="fill-muted/60 stroke-border/50 stroke-[0.8]"
        />
        {members.map((plateCode) => (
          <use
            key={plateCode}
            href={`#${THUMB_ID_PREFIX}${plateCode}`}
            className="fill-primary/80 stroke-foreground/60 stroke-[1.2]"
          />
        ))}
      </svg>
    </div>
  );
}
