import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Batch 6 a11y and token polish invariants", () => {
  it("CustomSelect implements WAI-ARIA combobox and listbox pattern (A11Y124-I3)", () => {
    const url = new URL("../ui/custom-select.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    expect(content).toContain('role="combobox"');
    expect(content).toContain('role="listbox"');
    expect(content).toContain('role="option"');
    expect(content).toContain('aria-haspopup="listbox"');
    expect(content).toContain("aria-controls={isOpen ? listboxId : undefined}");
  });

  it("Alert resolves role cleanly and supports non-destructive status (A11Y124-I4)", () => {
    const url = new URL("../ui/alert.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    expect(content).toContain(
      'const resolvedRole = role ?? (variant === "destructive" ? "alert" : "status")',
    );
    expect(content).toContain("role={resolvedRole}");
  });

  it("Warning variants in Alert and Badge use high-contrast amber tokens (A11Y124-I7)", () => {
    const alertUrl = new URL("../ui/alert.tsx", import.meta.url);
    const alertContent = readFileSync(alertUrl, "utf8");
    expect(alertContent).toContain("text-amber-900");
    expect(alertContent).toContain("dark:text-amber-200");

    const badgeUrl = new URL("../ui/badge.tsx", import.meta.url);
    const badgeContent = readFileSync(badgeUrl, "utf8");
    expect(badgeContent).toContain("text-amber-900");
    expect(badgeContent).toContain("dark:text-amber-200");
  });

  it("V2EarthquakeExplorer does not render unverified schematic fault lines (VAL124SEO-I1)", () => {
    const url = new URL("./v2-earthquake-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    expect(content).not.toContain("FAULT_LINE_SEGMENTS");
    expect(content).not.toContain("showFaultLines");
    expect(content).not.toContain("projectedFaultLines");
  });

  it("V2MarineMapExplorer station pins have focus indicators and table rows preserve row role (A11Y124-I2, A11Y124-I3)", () => {
    const url = new URL("./v2-marine-map-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    expect(content).not.toContain("focus:outline-hidden");
    expect(content).not.toMatch(/<TableRow[^>]*role="button"/);
  });
});
