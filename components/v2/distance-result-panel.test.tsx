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

const status = (html: string) =>
  /<p role="status" aria-atomic="true" class="sr-only">(.*?)<\/p>/.exec(html)?.[1];
const detailsCell = (html: string) =>
  /<div data-result-details="" class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("DistanceResultPanel", () => {
  it("asks for the first point in the details row, shows a dash for the total, keeps the buttons focusable", () => {
    const html = render(0, 0);
    expect(html).toContain("Ölçmek için haritada bir yere tıkla.");
    // The hint takes the details row, whose figures stay only as invisible sizing, and the total
    // reads "—": the panel keeps its width and height, and no "0,0 km" is ever shown.
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    expect(html).toContain("—");
    expect(html).not.toContain("0,0");
    // `aria-disabled`, not `disabled`: a disabled button drops keyboard focus to <body>.
    expect(html.match(/<button[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("asks for a second point after the first, with the buttons live", () => {
    const html = render(1, 0);
    expect(html).toContain("Mesafe için bir nokta daha ekle.");
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    expect(html).not.toMatch(/aria-disabled="true"/);
  });

  it("puts the hint in the details row, across both columns", () => {
    const html = render(0, 0);
    expect(html).toMatch(
      /<p data-result-hint="" class="[^"]*\bcol-start-1 col-span-2 row-start-2\b/,
    );
  });

  it("announces the whole result in one always-mounted status region", () => {
    // A region that turns live in the same update as its text is not announced; this one is
    // mounted from the start and only its text changes.
    expect(status(render(0, 0))).toBe("Ölçmek için haritada bir yere tıkla.");
    expect(status(render(1, 0))).toBe("Mesafe için bir nokta daha ekle.");
    expect(status(render(2, 1430.2))).toBe(
      "Toplam Kuş Uçuşu Mesafe: 1.430,2 km. Uçuş Süresi: ~107 dk. Karayolu Tahmini: ~1.831 km.",
    );
    // The visible figures are not read a second time.
    expect(render(2, 1430.2)).not.toContain('aria-live="polite"');
  });

  it("shows the total, flight time and road estimate from the shared calculation", () => {
    const html = render(2, 1430.2);
    expect(detailsCell(html)).not.toMatch(/\binvisible\b/);
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
  });
});

describe("MapResultPanel", () => {
  it("starts the details row at the first column, not in an implicit third one", () => {
    // Auto-placed beside another cell in column 1, a two-column details row found no free span in
    // row 2 and fell into an implicit third column, right of the buttons (T-120).
    expect(detailsCell(render(2, 100))).toMatch(/^col-start-1 col-span-2 row-start-2\b/);
  });

  it("keeps a press on the panel from starting a pan on the map under it", () => {
    const code = stripComments(
      readFileSync(new URL("./map-result-panel.tsx", import.meta.url), "utf8"),
    );
    expect(code).toContain("onPointerDown={stopPropagation}");
    expect(code).toContain("onMouseDown={stopPropagation}");
  });
});
