import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("V2 Region locator map and page design invariants", () => {
  it("defines .scrollbar-none utility in globals.css", () => {
    const cssUrl = new URL("../../app/globals.css", import.meta.url);
    const content = readFileSync(cssUrl, "utf8");
    expect(content).toContain(".scrollbar-none");
    expect(content).toContain("scrollbar-width: none");
    expect(content).toContain(".scrollbar-none::-webkit-scrollbar");
    expect(content).toContain("display: none");
  });

  it("implements V2RegionLocatorMap with SVG viewBox and interactive province paths", () => {
    const mapUrl = new URL("./v2-region-locator-map.tsx", import.meta.url);
    const content = readFileSync(mapUrl, "utf8");

    expect(content).toContain("TR_CONTEXT_VIEWBOX");
    expect(content).toContain("PROVINCE_SHAPES");
    expect(content).toContain("CONTEXT_SHAPES");
    expect(content).toContain("INLAND_WATER_SHAPES");
    expect(content).toContain("hoveredPlate");
    expect(content).toContain("setHoveredPlate");
    expect(content).toContain("/v2/turkiye/[slug]");
  });

  it("integrates V2RegionLocatorMap in region detail page with 12-column asymmetric layout", () => {
    const pageUrl = new URL("../../app/[locale]/v2/turkiye/bolge/[slug]/page.tsx", import.meta.url);
    const content = readFileSync(pageUrl, "utf8");

    expect(content).toContain("V2RegionLocatorMap");
    expect(content).toContain("lg:grid-cols-12");
    expect(content).toContain("lg:col-span-7");
    expect(content).toContain("lg:col-span-5");
    expect(content).toContain("scrollbar-none");
    // Ensure no raw developer prompt text leaked
    expect(content).not.toContain("Sayfanın altında `V2SourcesSection");
  });

  it("provides cross-links from province detail page to region detail page", () => {
    const provincePageUrl = new URL(
      "../../app/[locale]/v2/turkiye/[slug]/page.tsx",
      import.meta.url,
    );
    const content = readFileSync(provincePageUrl, "utf8");

    // Breadcrumb has region link
    expect(content).toMatch(
      /href=\{\{\s*pathname:\s*"\/v2\/turkiye\/bolge\/\[slug\]",\s*params:\s*\{\s*slug:\s*regionTheme\.slug\s*\},?\s*\}\}/,
    );
    // Hero badge has clickable link to region
    expect(content).toContain('pathname: "/v2/turkiye/bolge/[slug]"');
    expect(content).toContain("Bağlı Olduğu Coğrafi Bölge:");
  });
});
