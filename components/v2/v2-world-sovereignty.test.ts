import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Invariant tests for sovereignty rules and naming across V2 components
 * (`SOV122-C1`, `SOV124-I1`, `SOV122-I1`, `SOV124-P2`, `VAL124SEO-I2`).
 */

describe("V2 sovereignty and naming invariants", () => {
  it("uses canonical Güney Kıbrıs Rum Yönetimi for CY in neighbor map dictionaries", () => {
    const files = [
      "./v2-earthquake-explorer.tsx",
      "./v2-marine-map-explorer.tsx",
      "./v2-turkey-map-explorer.tsx",
      "./v2-interactive-map-preview.tsx",
    ];

    for (const relPath of files) {
      const url = new URL(relPath, import.meta.url);
      const content = readFileSync(url, "utf8");
      expect(content).not.toContain('CY: "Kıbrıs"');
      expect(content).toContain('CY: "Güney Kıbrıs Rum Yönetimi"');
    }
  });

  it("does not claim egemenlik statüleri or egemen ülke in v2-sources-section", () => {
    const url = new URL("./v2-sources-section.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");
    expect(content).not.toContain("egemenlik statüleri");
    expect(content).not.toContain("199 egemen ülke");
    expect(content).toContain("199 ülke ve özerk bölge");
  });

  it("renders Special Status Entity badge in v2-world-map-explorer", () => {
    const url = new URL("./v2-world-map-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");
    expect(content).toContain("Özel Statülü Varlık");
    expect(content).toContain("Special Status Entity");
    expect(content).toContain("isSpecialStatus");
  });
});
