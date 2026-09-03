import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Invariant tests for sovereignty rules and naming across V2 components
 * (`SOV125-C1`, `SOV122-C1`, `SOV125-I1`, `SOV124-I1`, `SOV122-I1`, `SOV124-P2`, `VAL124SEO-I2`).
 */

describe("V2 sovereignty and naming invariants", () => {
  it("uses canonical Güney Kıbrıs Rum Yönetimi for CY in neighbor map dictionaries (VAL124SEO-I2)", () => {
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

  it("does not claim egemenlik statüleri or egemen ülke in v2-sources-section (SOV122-I1, SOV124-P2)", () => {
    const url = new URL("./v2-sources-section.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");
    expect(content).not.toContain("egemenlik statüleri");
    expect(content).not.toContain("199 egemen ülke");
    expect(content).toContain("199 ülke ve özerk bölge");
  });

  it("enforces locale-aware flag gating and synchronizes special status set in v2/dunya (SOV125-C1, SOV124-I1)", () => {
    const url = new URL("../../app/[locale]/v2/dunya/page.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // Must suppress flags in EN for special-status rows per DEC 2026-08-08h and DEC 2026-09-03a md.2
    expect(content).toContain(
      'const flagVisible = hasFlagAsset && (!isSpecialStatus || locale === "tr");',
    );

    // Matches canonical set of 6 special-status ISOs
    const isoMatch = content.match(/SPECIAL_STATUS_ISO_CODES\s*=\s*new\s+Set\(\[([^\]]+)\]\)/);
    expect(isoMatch).not.toBeNull();
    const rawCodes = isoMatch && isoMatch[1] ? isoMatch[1] : "";
    const codes = rawCodes
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .sort();
    expect(codes).toEqual(["CY", "IL", "PS", "QN", "TW", "XK"].sort());
  });

  it("renders canonical full SpecialStatusBadge across all explorer views (SOV125-I1, FEN125-I3)", () => {
    const url = new URL("./v2-world-map-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // Canonical labels present in unified badge
    expect(content).toContain("Özel Statülü Varlık");
    expect(content).toContain("Special Status Entity");
    expect(content).toContain("SpecialStatusBadge");

    // No truncated variants in badge outputs
    expect(content).not.toMatch(/SpecialStatusBadge[^>]*>[^<]*"Özel"/);
    expect(content).not.toContain('isEn ? "Special" : "Özel"');
    expect(content).not.toContain('isEn ? "Special Status" : "Özel Statü"');

    // 5 render locations use SpecialStatusBadge
    const badgeUsages = content.match(/<SpecialStatusBadge/g);
    expect(badgeUsages?.length).toBe(5);
  });
});
