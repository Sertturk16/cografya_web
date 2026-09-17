import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blendOver, contrastRatio } from "@/lib/theme/contrast";

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

  /**
   * A11Y124-I7, rewritten for the mechanism T-034 replaced it with.
   *
   * The invariant is unchanged and is the reason this test exists: warning text must be
   * HIGH CONTRAST, because amber has to stay light to read as amber and is therefore the
   * worst case in the semantic set when used as text on its own tint.
   *
   * What changed is how that is achieved. The original pinned two literal Tailwind classes,
   * `text-amber-900` and `dark:text-amber-200` — an off-brand palette colour with a
   * hand-written theme patch. Both are now forbidden by
   * `components/ui/token-binding.test.ts`, because a hand-written `dark:` in a primitive
   * means the component is bound to the wrong token. Warning text now reads
   * `text-warning-strong`, the high-contrast member of the family, which the `.dark` block
   * flips like every other token.
   *
   * The assertion is also stronger than the one it replaces: rather than matching a class
   * name, it reads the real token values out of `app/globals.css` and measures them.
   */
  it("Warning text in Alert and Badge clears 4.5:1 on its own tint (A11Y124-I7)", () => {
    const alertContent = readFileSync(new URL("../ui/alert.tsx", import.meta.url), "utf8");
    const badgeContent = readFileSync(new URL("../ui/badge.tsx", import.meta.url), "utf8");

    // The high-contrast member, not the base — the base measures 2.62:1 on its own 15% tint.
    expect(alertContent).toContain("text-warning-strong");
    expect(badgeContent).toContain("text-warning-strong");
    expect(alertContent).not.toMatch(/text-warning\b(?!-strong)/);
    expect(badgeContent).not.toMatch(/text-warning\b(?!-strong)/);

    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const value = (token: string) => {
      const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
      expect(match, `${token} is not a literal hex in globals.css`).not.toBeNull();
      return match![1]!;
    };

    const warning = value("--color-warning");
    const warningStrong = value("--color-warning-dark");

    // Worst surface a tinted warning chip can land on: a 15% tint over --color-surface,
    // the darkest panel in the light palette.
    const tint = blendOver(warning, 0.15, value("--color-surface"));
    expect(contrastRatio(warningStrong, tint)).toBeGreaterThanOrEqual(4.5);
    // And the base it replaced genuinely was failing — so this test guards a real fix.
    expect(contrastRatio(warning, tint)).toBeLessThan(4.5);
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
