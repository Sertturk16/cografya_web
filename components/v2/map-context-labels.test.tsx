import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapContextLabels, contextLabelCandidates } from "@/components/v2/map-context-labels";
import { UNLABELLED_CONTEXT_ISOS } from "@/lib/map/map-country-names";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { viewBoxRect } from "@/lib/map/context-label-fit";

/**
 * T-085. `/deniz` and `/deprem` draw the wide artifact in a box of its own aspect, so the scale
 * is the box width over 1270 and the frame is the viewBox. Box widths are the measured content
 * boxes: 1214px (`/deniz`) and 1164px (`/deprem`) at 1440, 326px and 284px at 360.
 */
const candidates = contextLabelCandidates(
  CONTEXT_SHAPES.filter((c) => c.iso !== "TR" && !UNLABELLED_CONTEXT_ISOS.has(c.iso)),
);
const vb = viewBoxRect(TR_CONTEXT_VIEWBOX);
const frame = { left: vb.x, top: vb.y, right: vb.x + vb.width, bottom: vb.y + vb.height };

const drawn = (props: Partial<Parameters<typeof MapContextLabels>[0]>) => {
  const html = renderToStaticMarkup(
    <svg>
      <MapContextLabels candidates={candidates} scale={null} frame={frame} {...props} />
    </svg>,
  );
  return [...html.matchAll(/<(?:text|tspan)[^>]*>([^<]+)</g)].map((m) => m[1] ?? "");
};

describe("MapContextLabels on the wide artifact", () => {
  it("draws every name the desktop maps drew before T-085", () => {
    const names = drawn({ scale: 1164 / 1270 });
    for (const name of ["KARADENİZ", "AKDENİZ", "EGE DENİZİ", "MARMARA DENİZİ", "Yunanistan"]) {
      expect(names, name).toContain(name);
    }
    expect(names.filter((n) => n !== n.toUpperCase())).toHaveLength(9);
  });

  it("on a phone, keeps what is legible and fits, and drops Marmara", () => {
    for (const width of [284, 326]) {
      const names = drawn({ scale: width / 1270 });
      expect(names).toEqual(
        expect.arrayContaining(["KARADENİZ", "AKDENİZ", "EGE DENİZİ", "Irak", "İran", "Suriye"]),
      );
      expect(names).not.toContain("MARMARA DENİZİ");
      expect(names).not.toContain("Ermenistan");
    }
  });

  it("drops a neighbour under an overlay, and moves nothing else", () => {
    const scale = 1214 / 1270;
    const bulgaria = candidates.find((c) => c.iso === "BG")!.target;
    const chip = {
      left: bulgaria.x - 5,
      top: bulgaria.y - 5,
      right: bulgaria.x + 5,
      bottom: bulgaria.y + 5,
    };
    const open = drawn({ scale });
    const covered = drawn({ scale, blocked: [chip] });
    expect(open).toContain("Bulgaristan");
    expect(covered).not.toContain("Bulgaristan");
    expect(covered).toHaveLength(open.length - 1);
  });

  it("paints the neighbour group first only when asked (`/deprem`'s order)", () => {
    const html = (neighboursFirst: boolean) =>
      renderToStaticMarkup(
        <svg>
          <MapContextLabels
            candidates={candidates}
            scale={null}
            neighboursFirst={neighboursFirst}
          />
        </svg>,
      );
    expect(html(true).indexOf("Irak")).toBeLessThan(html(true).indexOf("KARADENİZ"));
    expect(html(false).indexOf("KARADENİZ")).toBeLessThan(html(false).indexOf("Irak"));
  });
});
