import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * T-061 PR5 — the header's account controls.
 *
 * Comments are stripped first: several cases assert the ABSENCE of a string that the
 * docblocks explaining the absence necessarily contain.
 */
const SOURCE = stripComments(
  readFileSync(fileURLToPath(new URL("./v2-header.tsx", import.meta.url)), "utf8"),
);

describe("the signed-in account menu", () => {
  it("is ONE trigger, not two side-by-side controls", () => {
    // The header used to carry a "Hesabım" link and a "Çıkış Yap" button next to each other,
    // with a third sign-out in the hub hero below them (removed in PR3). A member should not
    // have to work out which of three controls is the real one.
    expect(SOURCE).toContain('aria-label="Hesap menüsü"');
    expect(SOURCE).toContain('toggleDropdown("account")');
    expect(SOURCE).not.toContain('aria-label="Çıkış Yap"');
  });

  it("holds exactly the three things a signed-in member does from the chrome", () => {
    const menu = SOURCE.slice(
      SOURCE.indexOf('activeDropdown === "account" && ('),
      SOURCE.indexOf('aria-label="Menüyü aç"'),
    );
    expect(menu).toContain('href="/hesabim"');
    expect(menu).toContain('href="/hesabim/ayarlar"');
    expect(menu).toContain("handleSignOut()");
  });

  it("uses the disclosure pattern the other three dropdowns already use", () => {
    // Not a `role="menu"` widget: one header with two different menu mechanisms is worse
    // than one with a single pattern used four times. `aria-expanded` on the trigger is what
    // makes the state audible.
    expect(SOURCE).toContain('aria-expanded={activeDropdown === "account"}');
    expect(SOURCE).not.toContain('role="menu"');
  });

  it("closes on an outside click that lands outside EITHER container", () => {
    // The account trigger sits outside `navContainerRef`, on the other side of the header.
    // Checking one container would have closed the menu the instant it opened, because its
    // own trigger counts as "outside the nav".
    expect(SOURCE).toContain("const insideNav = navContainerRef.current?.contains(target)");
    expect(SOURCE).toContain("const insideAccount = accountMenuRef.current?.contains(target)");
    expect(SOURCE).toContain("if (!insideNav && !insideAccount)");
  });

  it("returns focus to its own trigger on Escape, like every other dropdown here", () => {
    expect(SOURCE).toContain('} else if (activeDropdown === "account") {');
    expect(SOURCE).toContain("accountBtnRef.current?.focus();");
  });
});

describe("the mobile drawer carries the same three entries", () => {
  it("links to the hub and to settings, and signs out", () => {
    const drawer = SOURCE.slice(SOURCE.indexOf("SheetContent"));
    expect(drawer).toContain('href="/hesabim"');
    expect(drawer).toContain('href="/hesabim/ayarlar"');
    expect(drawer).toContain("onClick={handleSignOut}");
  });

  it('drops the "Hesabım & Profil" label, whose ampersand promised a second destination', () => {
    // It pointed at the hub alone. The profile half of that promise is now a real, separate
    // entry rather than an ampersand.
    expect(SOURCE).not.toContain("Hesabım &amp; Profil");
  });
});

describe("no surface links to the retired profile route", () => {
  it("the header sends nobody through the /profil redirect", () => {
    // `/profil` still resolves — it is a 308 in `next.config.ts` — but a link to it from our
    // own chrome would be an extra hop we control and chose not to remove.
    expect(SOURCE).not.toContain('href="/profil"');
  });
});
