import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the primary navigation (the `lib/search/messages.test.ts`
 * pattern).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path
 * in place of the copy. This namespace names the six hub links in the header of EVERY page,
 * so a typo ships "Nav.hakkimizda" as a visible link label site-wide with CI green. The two
 * disclosure labels are worse than visible: they are the menu button's ONLY accessible name
 * below 64rem, where the button has no text of its own, so a missing key leaves a screen
 * reader with "Nav.openMenu" as the name of the control that opens the whole navigation.
 *
 * Both locales, always: the header renders identically on `"localized"` and `"trNarrative"`
 * surfaces, so "missing in en" is a defect rather than a translation backlog.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that keys resolve to non-empty strings,
 * never what the copy says.
 */

const NAV_KEYS = [
  // `label` names the <nav> landmark itself.
  "label",
  "home",
  "turkiye",
  "dunya",
  "deniz",
  "game",
  "about",
  // The disclosure button's accessible name, one per state.
  "openMenu",
  "closeMenu",
] as const;

const catalogues = { tr: trMessages.Nav, en: enMessages.Nav } as const;

describe("Nav message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(NAV_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it("carries the SAME key set in both locales", () => {
    expect(Object.keys(enMessages.Nav).sort()).toEqual(Object.keys(trMessages.Nav).sort());
  });

  it("names the two disclosure states differently", () => {
    // One label for both states would leave the button announcing "open menu" while the menu
    // is open — the failure `aria-expanded` alone does not prevent, because a reader who
    // navigates by name never hears the state.
    expect(trMessages.Nav.openMenu).not.toBe(trMessages.Nav.closeMenu);
    expect(enMessages.Nav.openMenu).not.toBe(enMessages.Nav.closeMenu);
  });
});
