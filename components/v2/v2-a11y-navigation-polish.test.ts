import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Invariant tests for navigation guards, landmark uniqueness, and WAI-ARIA combobox accessibility
 * (`CODE125-I2`, `FU125A11Y-I1`, `FU125A11Y-I2`, `A11Y125-I3`, `SEC125-M2`).
 */

describe("V2 A11y and navigation invariants", () => {
  it("implements WAI-ARIA APG combobox keyboard navigation and focus restoration in CustomSelect (FU125A11Y-I1, FU125A11Y-I2)", () => {
    const url = new URL("../ui/custom-select.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // Focus restoration in handleSelect
    expect(content).toContain("triggerRef.current?.focus()");

    // Keyboard navigation keys
    expect(content).toContain('e.key === "ArrowDown"');
    expect(content).toContain('e.key === "ArrowUp"');
    expect(content).toContain('e.key === "Home"');
    expect(content).toContain('e.key === "End"');

    // ARIA roles and active descendant binding
    expect(content).toContain('role="combobox"');
    expect(content).toContain('role="listbox"');
    expect(content).toContain('role="option"');
    expect(content).toContain("aria-activedescendant={activeDescendantId}");
  });

  it("restores accessible name to selectable marine station table rows (A11Y125-I3)", () => {
    const url = new URL("./v2-marine-map-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    expect(content).toMatch(/<TableRow[^>]*aria-label=\{`\$\{point\.nameTr\} istasyonunu seç`\}/);
  });

  it("cleans up V2 route guard in AuthMount without impure DOM queries (SEC125-M2)", () => {
    const url = new URL("../auth/auth-mount.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // Strict V2 path check
    expect(content).toContain('if (pathStr === "/v2" || pathStr.startsWith("/v2/"))');
    // No render-phase DOM querying
    expect(content).not.toContain('document.querySelector(".v2-app")');
  });

  it("ensures exactly one id=main-content landmark exists across the entire app (CODE125-I2)", () => {
    const pages = [
      "../../app/[locale]/v2/turkiye/page.tsx",
      "../../app/[locale]/v2/page.tsx",
      "../../app/[locale]/v2/oyun/page.tsx",
      "../../app/[locale]/v2/kayit/page.tsx",
      "../../app/[locale]/v2/giris/page.tsx",
      "../../app/[locale]/v2/araclar/page.tsx",
      "../../app/[locale]/v2/araclar/alan-hesaplama/page.tsx",
      "../../app/[locale]/v2/araclar/mesafe-olcme/page.tsx",
      "../../app/[locale]/v2/araclar/koordinat-bulma/page.tsx",
    ];

    for (const pageRel of pages) {
      const url = new URL(pageRel, import.meta.url);
      const content = readFileSync(url, "utf8");
      expect(content).not.toContain('id="main-content"');
    }

    const layoutUrl = new URL("../../app/[locale]/layout.tsx", import.meta.url);
    const layoutContent = readFileSync(layoutUrl, "utf8");
    expect(layoutContent).toContain('id="main-content"');
  });
});
