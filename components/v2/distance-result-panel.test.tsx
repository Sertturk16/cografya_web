import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
import { DistanceResultPanel } from "./distance-result-panel";

/**
 * T-120. The panel on the distance tool's map. Layout (where it sits, that its height does not
 * change, that nothing overlaps it) is measured in the browser; these pin what a node render
 * can see: the three states, the shared figures, and the guards that keep a press on it from
 * reaching the map.
 */
const render = (pointCount: number, distanceKm: number) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <DistanceResultPanel
        pointCount={pointCount}
        distanceKm={distanceKm}
        onUndo={() => {}}
        onClear={() => {}}
      />
    </NextIntlClientProvider>,
  );

const sizingCells = (html: string) =>
  [...html.matchAll(/<div aria-hidden="true" class="([^"]*)"/g)].map((m) => m[1]);

describe("DistanceResultPanel", () => {
  it("asks for the first point, keeps the figures only as invisible sizing, disables the buttons", () => {
    const html = render(0, 0);
    expect(html).toContain("Ölçmek için haritada bir yere tıkla.");
    // Summary and details stay in the grid so the panel keeps its height, but hidden from sight
    // and from assistive tech: no "0,0 km" is ever shown.
    const cells = sizingCells(html);
    expect(cells).toHaveLength(2);
    for (const cls of cells) expect(cls).toMatch(/\binvisible\b/);
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });

  it("asks for a second point after the first, with the buttons live", () => {
    const html = render(1, 0);
    expect(html).toContain("Mesafe için bir nokta daha ekle.");
    expect(sizingCells(html)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
  });

  it("shows the total, flight time and road estimate from the shared calculation", () => {
    const html = render(2, 1430.2);
    expect(sizingCells(html)).toHaveLength(0);
    expect(html).toContain("1.430,2");
    expect(html).toContain("~107 dk");
    expect(html).toContain("~1.831 km");
    expect(html).not.toContain("Ölçmek için");
    expect(html).not.toContain("Mesafe için");
  });

  it("names the region and both actions, even where the button text is visually hidden", () => {
    const html = render(2, 100);
    expect(html).toMatch(/role="group" aria-label="Ölçüm sonucu"/);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Geri Al<\/span>/);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Temizle<\/span>/);
    // Readers hear what each figure is; sighted readers get the icons.
    expect(html).toContain("Uçuş Süresi");
    expect(html).toContain("Karayolu Tahmini");
    expect(html).toContain('aria-live="polite"');
  });
});

describe("MapResultPanel", () => {
  it("keeps a press on the panel from starting a pan on the map under it", () => {
    const code = stripComments(
      readFileSync(new URL("./map-result-panel.tsx", import.meta.url), "utf8"),
    );
    expect(code).toContain("onPointerDown={stopPropagation}");
    expect(code).toContain("onMouseDown={stopPropagation}");
  });
});
