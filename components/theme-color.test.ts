import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const LAYOUT = read("../app/[locale]/layout.tsx");
const CSS = read("../app/globals.css");

/** The `color` of the `themeColor` entry for one `prefers-color-scheme` value. */
function themeColorFor(scheme: "light" | "dark"): string | undefined {
  const match = new RegExp(
    `media: "\\(prefers-color-scheme: ${scheme}\\)", color: "(#[0-9a-fA-F]{6})"`,
  ).exec(LAYOUT);
  return match?.[1]?.toLowerCase();
}

/** A custom property's literal hex inside the first block opened by `selector {`. */
function tokenIn(selector: string, token: string): string | undefined {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) return undefined;
  const block = CSS.slice(start, CSS.indexOf("\n}", start));
  return new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(block)?.[1]?.toLowerCase();
}

/**
 * The metadata layer cannot read CSS variables, so the mobile address-bar colours are hexes
 * copied from `app/globals.css`. The dark one was left at a provisional near-black when the
 * Night Sea palette landed and the bar stopped matching the page; this keeps the copies honest.
 */
describe("viewport themeColor matches the palette", () => {
  it("reads both themeColor entries and both tokens (positive control)", () => {
    expect(themeColorFor("light")).toMatch(/^#/);
    expect(themeColorFor("dark")).toMatch(/^#/);
    expect(tokenIn(":root,\n.light", "--color-primary")).toMatch(/^#/);
    expect(tokenIn(".dark", "--background")).toMatch(/^#/);
  });

  it("light is Terra's --color-primary", () => {
    expect(themeColorFor("light")).toBe(tokenIn(":root,\n.light", "--color-primary"));
  });

  it("dark is the .dark block's --background", () => {
    expect(themeColorFor("dark")).toBe(tokenIn(".dark", "--background"));
  });
});
