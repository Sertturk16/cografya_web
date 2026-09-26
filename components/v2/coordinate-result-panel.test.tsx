import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { CoordinateResultPanel, type CoordinateReading } from "./coordinate-result-panel";

/**
 * T-121. The coordinate tool's panel: the province the point falls in, its decimal and DMS
 * coordinates per axis, Copy and Clear.
 */
const ANKARA: CoordinateReading = {
  latDecimal: "39,925533° K",
  lonDecimal: "32,866287° D",
  latDms: `39° 55' 31,9" K`,
  lonDms: `32° 51' 58,6" D`,
  province: "Ankara",
};
const render = (reading: CoordinateReading | null, copied = false) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <CoordinateResultPanel
        reading={reading}
        copied={copied}
        onCopy={() => {}}
        onClear={() => {}}
      />
    </NextIntlClientProvider>,
  );
const status = (html: string) =>
  /<p role="status" aria-atomic="true" class="sr-only">(.*?)<\/p>/.exec(html)?.[1];
const detailsCell = (html: string) =>
  /<div data-result-details="" class="([^"]*)"/.exec(html)?.[1] ?? "";
// renderToStaticMarkup escapes the DMS minute and second marks.
const unescape = (s: string | undefined) => s?.replaceAll("&quot;", '"').replaceAll("&#x27;", "'");

describe("CoordinateResultPanel", () => {
  it("asks for a click before there is a point, with Copy and Clear off but focusable", () => {
    const html = render(null);
    expect(status(html)).toBe("Koordinat için haritada bir yere tıkla.");
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    expect(html).toContain("—");
    expect(html.match(/<button[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("shows the province and both coordinate forms per axis", () => {
    const html = render(ANKARA);
    expect(detailsCell(html)).not.toMatch(/\binvisible\b/);
    expect(html).toContain("Ankara");
    expect(html).toContain("39,925533° K");
    expect(html).toContain("32,866287° D");
    expect(unescape(html)).toContain(`39° 55' 31,9" K`);
    expect(html).not.toMatch(/aria-disabled="true"/);
    expect(unescape(status(html))).toBe(
      `Ondalık derece, WGS84: 39,925533° K, 32,866287° D. Derece-dakika-saniye: 39° 55' 31,9" K, 32° 51' 58,6" D. Noktanın Düştüğü İl: Ankara.`,
    );
  });

  it("says the point is outside Türkiye when no province holds it", () => {
    const html = render({ ...ANKARA, province: null });
    expect(html).toContain("Türkiye dışında");
    expect(status(html)).toMatch(/Noktanın Düştüğü İl: Türkiye dışında\.$/);
  });

  it("switches the Copy button to its done state", () => {
    expect(render(ANKARA)).toMatch(/<span class="sr-only sm:not-sr-only">Kopyala<\/span>/);
    expect(render(ANKARA, true)).toMatch(
      /<span class="sr-only sm:not-sr-only">Kopyalandı!<\/span>/,
    );
  });

  it("names Clear, and offers no Undo on a one-point tool", () => {
    const html = render(ANKARA);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Temizle<\/span>/);
    expect(html).not.toContain("Geri Al");
  });

  it("keeps every visible line on one row, so the panel never grows", () => {
    const html = render(ANKARA);
    // Province, and decimal + DMS for each axis.
    expect(html.match(/<p class="m-0 whitespace-nowrap[^"]*"/g) ?? []).toHaveLength(5);
  });
});
