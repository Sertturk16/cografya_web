import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("T-014 V2 Header Global Search and Theme Toggle", () => {
  const v2HeaderPath = fileURLToPath(new URL("./v2-header.tsx", import.meta.url));
  const themeTogglePath = fileURLToPath(new URL("./theme-toggle.tsx", import.meta.url));
  const searchComboboxPath = fileURLToPath(
    new URL("../site-search/search-combobox.tsx", import.meta.url),
  );

  const v2HeaderContent = readFileSync(v2HeaderPath, "utf8");
  const themeToggleContent = readFileSync(themeTogglePath, "utf8");
  const searchComboboxContent = readFileSync(searchComboboxPath, "utf8");

  it("V2Header mounts SearchCombobox with variant='v2' and pathPrefix='/v2'", () => {
    expect(v2HeaderContent).toContain(
      'import { SearchCombobox } from "@/components/site-search/search-combobox";',
    );
    expect(v2HeaderContent).toContain('variant="v2"');
    expect(v2HeaderContent).toContain('pathPrefix="/v2"');
  });

  it("V2Header mounts ThemeToggle in desktop actions and mobile drawer", () => {
    expect(v2HeaderContent).toContain('import { ThemeToggle } from "./theme-toggle";');
    expect(v2HeaderContent).toContain("<ThemeToggle />");
    // Appears at least twice (desktop right actions and mobile drawer footer)
    const matches = v2HeaderContent.match(/<ThemeToggle \/>/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * Rewritten by T-034 phase B for the mechanism that replaced the hand-rolled toggle.
   *
   * What this test protects is unchanged: the control must actually drive the theme, must
   * persist the choice under the key the site has always used, and must carry an accessible
   * name the QA selectors can find.
   *
   * What changed is how. The original asserted three implementation details —
   * `classList.add("dark")`, `classList.remove("dark")` and a direct `localStorage.setItem`
   * — all of which are now `next-themes`' job, done in a blocking script before hydration
   * rather than in a `useEffect` after it. Asserting them here would pin an implementation
   * the app no longer has, and pinning it would have meant keeping the light flash the
   * provider exists to remove.
   */
  it("ThemeToggle drives next-themes, offers three states, and keeps the QA selectors", () => {
    expect(themeToggleContent).toContain('from "next-themes"');
    expect(themeToggleContent).toContain("useTheme()");

    // Three real destinations. `system` being reachable is the point: the previous binary
    // toggle pinned a choice on first press and could never follow the OS again.
    for (const choice of ["light", "dark", "system"]) {
      expect(themeToggleContent).toContain(`"${choice}"`);
    }

    // The storage key is a compatibility promise — visitors keep the preference they set
    // before this change. next-themes writes it; the provider passes it.
    const providerContent = readFileSync(
      fileURLToPath(new URL("../theme-provider.tsx", import.meta.url)),
      "utf8",
    );
    expect(providerContent).toContain('storageKey="theme"');
    expect(providerContent).toContain('attribute="class"');

    // Accessible name must still match /Tema|Karanlık|Aydınlık|Dark|Light/i
    expect(themeToggleContent).toMatch(/Tema|Karanlık|Aydınlık|Dark|Light/i);
    expect(themeToggleContent).toContain("aria-label");

    // The old toggle changed nothing a screen reader could perceive.
    expect(themeToggleContent).toContain('aria-live="polite"');
  });

  it("SearchCombobox supports Ctrl+K global shortcut and v2 command dialog", () => {
    expect(searchComboboxContent).toContain(
      '(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k"',
    );
    expect(searchComboboxContent).toContain('data-testid="global-search"');
    expect(searchComboboxContent).toContain('data-testid="global-search-mobile"');
    expect(searchComboboxContent).toContain('data-combobox-items="true"');
  });
});
