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

  it("V2Header mounts SearchCombobox with pathPrefix='/'", () => {
    expect(v2HeaderContent).toContain(
      'import { SearchCombobox } from "@/components/site-search/search-combobox";',
    );
    expect(v2HeaderContent).toContain('pathPrefix="/"');
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
  it("ThemeToggle drives next-themes, cycles light ⇄ dark only, and keeps the QA selectors", () => {
    expect(themeToggleContent).toContain('from "next-themes"');
    expect(themeToggleContent).toContain("useTheme()");

    // TWO destinations, and the pair is closed (T-066). `system` was the third stop until a
    // reader asked what the monitor icon between the sun and the moon was for: a button whose
    // current state does not tell you which colour scheme you are about to get. Asserted as
    // the CYCLE entries rather than as bare strings, because the word still appears in this
    // file's prose and in the provider's `defaultTheme`, which is a different thing.
    expect(themeToggleContent).toContain('value: "light"');
    expect(themeToggleContent).toContain('next: "dark"');
    expect(themeToggleContent).toContain('value: "dark"');
    expect(themeToggleContent).toContain('next: "light"');
    expect(themeToggleContent).not.toMatch(/(?:value|next):\s*"system"/);
    // The monitor icon went with it; nothing else in this file draws one.
    expect(themeToggleContent).not.toContain("Monitor");

    // WHAT THE STORED `"system"` BECOMES. The provider still defaults to the OS preference,
    // so `theme` is `"system"` for a visitor who has never pressed the button and for anyone
    // who pinned it before T-066. The control reads `resolvedTheme` precisely so neither of
    // those falls through to the light branch while the page is painted dark.
    expect(themeToggleContent).toContain("resolvedTheme");

    // The storage key is a compatibility promise — visitors keep the preference they set
    // before this change. next-themes writes it; the provider passes it.
    const providerContent = readFileSync(
      fileURLToPath(new URL("../theme-provider.tsx", import.meta.url)),
      "utf8",
    );
    expect(providerContent).toContain('storageKey="theme"');
    expect(providerContent).toContain('attribute="class"');
    // Following the OS until the first press is NOT the removed third state: it is the
    // starting value, and `app/not-found.tsx`'s pre-paint script mirrors it.
    expect(providerContent).toContain('defaultTheme="system"');

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
