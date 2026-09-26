import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { AreaResultPanel } from "./area-result-panel";

/**
 * T-121. The area tool's panel: the hints before a shape closes, the crossing-edges warning in
 * place of the number (T-094), and the area with its hectares, decares and perimeter.
 */
const render = (pointCount: number, isSelfIntersecting = false) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <AreaResultPanel
        pointCount={pointCount}
        isSelfIntersecting={isSelfIntersecting}
        area="1.234,5"
        hectares="123.450 ha"
        decares="1.234.500 dönüm"
        perimeter="150,2"
        onUndo={() => {}}
        onClear={() => {}}
      />
    </NextIntlClientProvider>,
  );

const status = (html: string) =>
  /<p role="status" aria-atomic="true" class="sr-only">(.*?)<\/p>/.exec(html)?.[1];
const detailsCell = (html: string) =>
  /<div data-result-details="" class="([^"]*)"/.exec(html)?.[1] ?? "";
const hintClass = (html: string) => /<p data-result-hint="" class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("AreaResultPanel", () => {
  it("asks for corners before the first one, with a dash and the buttons off but focusable", () => {
    const html = render(0);
    expect(status(html)).toBe("Alan için haritada köşeleri sırayla koy.");
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    expect(html).toContain("—");
    expect(html.match(/<button[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("counts down the corners still needed to close the shape", () => {
    expect(status(render(1))).toBe("Şeklin kapanması için 2 köşe daha koy.");
    expect(status(render(2))).toBe("Şeklin kapanması için 1 köşe daha koy.");
    expect(render(1)).not.toMatch(/aria-disabled="true"/);
  });

  it("shows the crossing-edges warning in place of the area, in the warning colour", () => {
    const html = render(4, true);
    expect(status(html)).toBe("Kenarlar kesişiyor, alan yazılmaz.");
    expect(hintClass(html)).toMatch(/\btext-warning-strong\b/);
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    // T-094: no figure next to the warning. The invisible sizing copy is aria-hidden and hidden.
    expect(html).toMatch(/<span[^>]*>—<\/span>/);
  });

  it("shows the area, hectares, decares and perimeter once the shape closes", () => {
    const html = render(3);
    expect(detailsCell(html)).not.toMatch(/\binvisible\b/);
    expect(html).toContain("1.234,5");
    expect(html).toContain("123.450 ha · 1.234.500 dönüm");
    expect(html).toContain("Çevre uzunluğu 150,2 km");
    expect(status(html)).toBe(
      "Kapanan şeklin alanı: 1.234,5 km². Hektar: 123.450 ha. Dönüm: 1.234.500 dönüm. Çevre uzunluğu: 150,2 km.",
    );
  });

  it("keeps every visible line on one row, so the panel never grows", () => {
    const html = render(3);
    const lines = html.match(/<p class="m-0 whitespace-nowrap[^"]*"/g) ?? [];
    expect(lines).toHaveLength(2);
  });

  it("names Undo and Clear even where the button text is visually hidden", () => {
    const html = render(3);
    expect(html).toMatch(/<span class="sr-only @sm:not-sr-only">Geri Al<\/span>/);
    expect(html).toMatch(/<span class="sr-only @sm:not-sr-only">Temizle<\/span>/);
  });
});
