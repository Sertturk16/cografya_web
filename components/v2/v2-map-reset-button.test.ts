import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// T-114: the reset button must not mount on the first zoom, or it widens the toolbar and moves
// + and − out from under the cursor. It stays rendered and is disabled at the untouched view,
// on every map with a zoom toolbar.
describe("map reset button", () => {
  const surfaces = [
    {
      file: "v2-world-map-explorer.tsx",
      zoom: "zoom",
      pan: "pan",
      marker: "onClick={handleResetZoom}",
    },
    {
      file: "v2-turkey-map-explorer.tsx",
      zoom: "zoomLevel",
      pan: "panOffset",
      marker: "onClick={handleResetZoom}",
    },
    {
      file: "v2-tool-workbench.tsx",
      zoom: "zoomLevel",
      pan: "panOffset",
      marker: "onClick={handleResetZoom}",
    },
    {
      file: "v2-game-screen.tsx",
      zoom: "zoom",
      pan: "pan",
      marker: 'aria-label="Görünümü Sıfırla"',
    },
  ];

  for (const { file, zoom, pan, marker } of surfaces) {
    describe(file, () => {
      const src = readFileSync(resolve(__dirname, file), "utf-8");
      const at = src.indexOf(marker);
      const start = src.lastIndexOf("<button", at);
      const end = src.indexOf("</button>", at);
      const resetButton = src.slice(start, end);

      it("renders the reset button unconditionally", () => {
        expect(at).toBeGreaterThan(-1);
        expect(src.slice(0, start).trimEnd().endsWith("&& (")).toBe(false);
      });

      it("disables it at 1x with no pan and fades it", () => {
        expect(resetButton).toContain(
          `disabled={${zoom} === 1 && ${pan}.x === 0 && ${pan}.y === 0}`,
        );
        expect(resetButton).toContain("disabled:opacity-40");
      });
    });
  }
});
