import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapSelectionCard } from "./map-selection-card";

/**
 * T-079. At 390px the old card was one flex row, and the "İncele" button sat on top of the area
 * figure. These pin the structure that makes that impossible: stats and actions are separate grid
 * columns. The rendered geometry (stats' right edge left of the link, nothing clipped at 320–390)
 * is measured in the browser; a node test cannot see layout. `Link` needs an intl provider for
 * its locale, as in `components/patterns/breadcrumbs.test.tsx`.
 */
const html = renderToStaticMarkup(
  <NextIntlClientProvider locale="tr">
    <MapSelectionCard
      leading={<span>06</span>}
      title="Ankara"
      stats={["5.910.320 kişi", "25.632 km²"]}
      href={"/turkiye/ankara" as never}
      exploreLabel="İncele"
      closeLabel="Seçimi kapat"
      onClose={() => {}}
    />
  </NextIntlClientProvider>,
);

describe("MapSelectionCard", () => {
  it("puts the stats in their own grid cell, never under the actions", () => {
    expect(html).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(html).toMatch(/<p class="[^"]*col-start-2[^"]*">.*5\.910\.320 kişi.*25\.632 km².*<\/p>/);
    // Clipping instead of wrapping is how the old card lost the area figure.
    expect(html).not.toMatch(/\btruncate\b|whitespace-nowrap/);
  });

  it("renders the explore action as a styled link, not a button inside a link", () => {
    expect(html).toMatch(/<a [^>]*href="\/turkiye\/ankara"/);
    expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>).)*<button/);
    // Icon-only below `sm`, but the name stays in the accessibility tree.
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">İncele<\/span>/);
  });

  it("names the close button", () => {
    expect(html).toMatch(/<button [^>]*aria-label="Seçimi kapat"/);
  });
});
