import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fullscreenCardStyle, FULLSCREEN_MAP_BOX } from "./map-fullscreen-controls";

const source = readFileSync(join(__dirname, "map-fullscreen-controls.tsx"), "utf8");
const messages = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../messages/${locale}.json`), "utf8")) as Record<
    string,
    Record<string, unknown>
  >;

describe("atlas fullscreen controls (T-118)", () => {
  it("keeps the card in the bottom-left corner, off the credit's ⓘ", () => {
    expect(fullscreenCardStyle(0)).toMatchObject({
      position: "absolute",
      left: 12,
      bottom: 12,
      margin: 0,
      maxWidth: "min(24rem, calc(100% - 64px))",
    });
  });

  it("lifts the card above the rotate hint while it shows", () => {
    expect(fullscreenCardStyle(48).bottom).toBe(12 + 48 + 8);
  });

  it("lets the map box fill the screen with no corners or borders", () => {
    expect(FULLSCREEN_MAP_BOX).toMatchObject({
      flex: "1 1 0%",
      minHeight: 0,
      aspectRatio: "auto",
      borderRadius: 0,
      borderWidth: 0,
    });
  });

  it("keeps the rotate hint clear of both bottom corners (the credit's ⓘ, the card)", () => {
    // 12px edge + 32px ⓘ + 8px gap on each side. Wider, it covered the ⓘ for the whole portrait
    // session on iOS, where the hint never goes away short of leaving fullscreen.
    expect(source).toMatch(/w-max max-w-\[calc\(100%-104px\)\]/);
  });

  it("names the toggle from the catalogue, both directions", () => {
    expect(source).toMatch(/aria-pressed=\{active\}/);
    expect(source).toMatch(/active \? t\("fullscreenExit"\) : t\("fullscreenEnter"\)/);
    for (const locale of ["tr", "en"]) {
      const { MapExplorer, ToolWorkbench } = messages(locale);
      for (const key of ["fullscreenEnter", "fullscreenExit", "rotateHint", "rotateDismiss"]) {
        expect(MapExplorer?.[key], `${locale} ${key}`).toBeTruthy();
        expect(MapExplorer?.[key], `${locale} ${key}`).toBe(ToolWorkbench?.[key]);
      }
    }
  });
});
