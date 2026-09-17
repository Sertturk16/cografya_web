import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(fileURLToPath(new URL("./theme-pair.tsx", import.meta.url)), "utf8");

describe("ThemePair", () => {
  it("forces the dark panel with a .dark wrapper", () => {
    // app/globals.css declares `@custom-variant dark (&:is(.dark *))`, so a wrapper
    // element carrying `dark` makes both the `dark:` variant and the .dark custom
    // properties apply to everything inside it.
    expect(SOURCE).toMatch(/"dark rounded/);
  });

  it("forces the light panel too, which .dark alone cannot do", () => {
    // Measured in the browser before this assertion existed: with <html class="dark">,
    // which is what an OS-dark visitor gets, the unforced panel inherited dark tokens and
    // both sides rendered identically (bg lab(2.75) on both). `.dark` only ever moves a
    // subtree darker. app/globals.css therefore declares its light token block as
    // `:root, .light`, and this class is what re-declares those values here.
    expect(SOURCE).toMatch(/"light rounded/);
  });

  it("the globals.css counterpart exists — this class is not inert", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    expect(css).toMatch(/^:root,\n\.light \{/m);
  });

  it("paints its own surface, because body normally supplies it", () => {
    expect(SOURCE).toContain("bg-background");
    expect(SOURCE).toContain("text-foreground");
  });

  it("warns when a specimen portals out of the wrapper", () => {
    // Dialog, Sheet, Popover, Tooltip, DropdownMenu and toasts render into
    // document.body, escaping the wrapper and picking up the GLOBAL theme.
    expect(SOURCE).toContain("portals");
  });

  it("labels both panels for the reader", () => {
    expect(SOURCE).toMatch(/Aydınlık/);
    expect(SOURCE).toMatch(/Karanlık/);
  });
});
