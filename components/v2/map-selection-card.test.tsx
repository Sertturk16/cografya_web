import { createTranslator, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
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
    // Below `sm` the stats take a full-width second row and the actions stay in the first (at
    // 320px a middle column was 87px and broke "5.910.320 kişi" over two lines); from `sm` the
    // stats sit in the middle column beside the actions, which span both rows.
    expect(html).toMatch(
      /<p data-map-card-stats="" class="[^"]*\bcol-span-3 sm:col-span-1 sm:col-start-2\b[^"]*">.*5\.910\.320 kişi.*25\.632 km².*<\/p>/,
    );
    expect(html).toMatch(/<div class="sm:row-span-2 flex items-center gap-1">/);
    // A base `p` margin is invisible in the element's box but a grid row counts it: measured
    // 82px against 66px for the same card at 1440px.
    expect(html).toMatch(/<p data-map-card-stats="" class="[^"]*\bm-0\b/);
    // Clipping instead of wrapping is how the old card lost the area figure.
    expect(html).not.toMatch(/\btruncate\b|whitespace-nowrap/);
  });

  it("hangs each separator on the stat before it, so a wrapped line never starts with one", () => {
    // T-082: the separator led the SECOND item ("· 25.632 km²"), so when the pair wrapped on
    // /dunya the new line began with "·". It now trails the first, joined by a no-break space.
    const stats = /<p data-map-card-stats="[^"]*"[^>]*>(.*?)<\/p>/.exec(html)?.[1] ?? "";
    const items = [...stats.matchAll(/<span>(.*?)<\/span>/g)].map((m) => m[1]);
    expect(items).toEqual(["5.910.320 kişi\u00a0·", "25.632 km²"]);
    expect(items.some((item) => item?.trimStart().startsWith("·"))).toBe(false);
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

  it("drops the explore link, and keeps the close button, when there is nowhere to go (T-119)", () => {
    // An earthquake or sea point outside every province has no province page.
    const bare = renderToStaticMarkup(
      <NextIntlClientProvider locale="tr">
        <MapSelectionCard
          title="Ege Denizi"
          stats={["M 4,1"]}
          exploreLabel="İl Sayfası"
          closeLabel="Seçimi kapat"
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(bare).not.toContain("<a ");
    expect(bare).toMatch(/<button [^>]*aria-label="Seçimi kapat"/);
  });
});

/**
 * T-082. `/en/dunya`'s card said "5.910.320 kişi": the unit was a Turkish literal beside a
 * locale-formatted number. Both stats now come from the catalogue, and ICU formats the number in
 * the active locale, through the real next-intl pipeline here.
 */
describe("the card's stat strings", () => {
  const translate = (locale: "tr" | "en") =>
    createTranslator({
      locale,
      messages: locale === "tr" ? trMessages : enMessages,
      namespace: "MapExplorer",
      onError: (error) => {
        throw error;
      },
    });

  it("reads population and area in the active locale", () => {
    expect(translate("tr")("statPopulation", { count: 5910320 })).toBe("5.910.320 kişi");
    expect(translate("en")("statPopulation", { count: 5910320 })).toBe("5,910,320 people");
    expect(translate("en")("statPopulation", { count: 1 })).toBe("1 person");
    expect(translate("tr")("statArea", { area: 783562 })).toBe("783.562 km²");
    expect(translate("en")("statArea", { area: 783562 })).toBe("783,562 km²");
  });

  it("is what both explorers hand the card, with no Turkish unit in the source", () => {
    for (const file of ["v2-world-map-explorer.tsx", "v2-turkey-map-explorer.tsx"]) {
      const source = stripComments(readFileSync(join(__dirname, file), "utf8"));
      const card = /<MapSelectionCard[\s\S]*?onClose=/.exec(source)?.[0] ?? "";
      expect(card, file).toMatch(/t\("statPopulation", \{ count: /);
      expect(card, file).toMatch(/t\("statArea", \{ area: /);
      expect(card, file).not.toMatch(/kişi|toLocaleString/);
    }
  });
});
