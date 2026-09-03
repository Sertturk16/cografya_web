import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Invariant tests for earthquake explorer keyboard a11y, fault line copy clean-up,
 * and dead module pruning (`FU125A11Y-C1`, `FEN125-I1`, `FEN125-I2`, `FU125SEO-I1`, `FU125SEO-I2`).
 */

describe("V2 earthquake explorer a11y and copy invariants", () => {
  it("provides keyboard navigation and focus-visible on SVG epicenters and table rows (FU125A11Y-C1)", () => {
    const url = new URL("./v2-earthquake-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // SVG epicenter must have tabIndex={0} and keydown handler
    expect(content).toMatch(/<g[^>]*tabIndex=\{0\}[^>]*role="button"/);
    expect(content).toContain("onKeyDown={(e) => {");
    expect(content).toContain("focus-visible:scale-125");

    // TableRow must have tabIndex={0} and aria-selected
    expect(content).toMatch(/<TableRow[^>]*tabIndex=\{0\}[^>]*aria-selected=\{isSelected\}/);
  });

  it("cleanses fault lines claims from toolbar label, page title, H1, and JSON-LD (FEN125-I1, FEN125-I2)", () => {
    const explorerUrl = new URL("./v2-earthquake-explorer.tsx", import.meta.url);
    const explorerContent = readFileSync(explorerUrl, "utf8");
    expect(explorerContent).toContain("Eşzamanlı Merkez Üsleri &amp; Odak Derinlikleri");
    expect(explorerContent).not.toContain("Eşzamanlı Merkez Üsleri &amp; Aktif Fay Hatları");

    const pageUrl = new URL("../../app/[locale]/v2/deprem/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");
    expect(pageContent).toContain("Canlı Deprem Takip & Sismik Monitör v2");
    expect(pageContent).not.toContain("Sismik Fay Monitörü");
    expect(pageContent).not.toContain("ve fay hatlarıyla anlık takip edin");
  });

  it("removes mta-fay card from earthquake sources section (FU125SEO-I1)", () => {
    const sourcesUrl = new URL("./v2-sources-section.tsx", import.meta.url);
    const sourcesContent = readFileSync(sourcesUrl, "utf8");
    expect(sourcesContent).not.toContain('id: "mta-fay"');
  });

  it("rephrases fault line descriptions without unverified numerical figures (FU125SEO-I2)", () => {
    const guideUrl = new URL("./v2-fault-lines-guide.tsx", import.meta.url);
    const guideContent = readFileSync(guideUrl, "utf8");
    expect(guideContent).not.toContain("yaklaşık 1.500 km");
    expect(guideContent).not.toContain("yaklaşık 550 km");
  });

  it("ensures dead lib/map/fault-lines.ts module is pruned (CODE125-M2)", () => {
    const faultLinesUrl = new URL("../../lib/map/fault-lines.ts", import.meta.url);
    expect(existsSync(faultLinesUrl)).toBe(false);
  });
});
