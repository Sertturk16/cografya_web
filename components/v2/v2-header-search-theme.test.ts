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

  it("ThemeToggle toggles 'dark' class on documentElement and matches QA selectors", () => {
    expect(themeToggleContent).toContain('document.documentElement.classList.add("dark")');
    expect(themeToggleContent).toContain('document.documentElement.classList.remove("dark")');
    expect(themeToggleContent).toContain('localStorage.setItem("theme"');
    // Accessible label must match /Tema|Karanlık|Aydınlık|Dark|Light/i
    expect(themeToggleContent).toMatch(/Tema|Karanlık|Aydınlık|Dark|Light/i);
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
