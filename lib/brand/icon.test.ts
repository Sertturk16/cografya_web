import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { brandGlyphSvg } from "./glyph";
import { MARK_PATHS } from "./mark-paths";

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const svgPaths = (svg: string) => [...svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"/g)];

describe("brand mark", () => {
  it("mark-paths.ts transcribes public/brand/mark.svg path for path", () => {
    const fromFile = svgPaths(read("public/brand/mark.svg")).map((m) => m[2]);
    expect(fromFile).toEqual(MARK_PATHS.map((p) => p.d));
  });

  it("the dark mark draws the same paths as the light one", () => {
    const light = svgPaths(read("public/brand/mark.svg")).map((m) => m[2]);
    const dark = svgPaths(read("public/brand/mark-dark.svg")).map((m) => m[2]);
    expect(dark).toEqual(light);
  });

  it("the OG glyph draws every mark path", () => {
    const glyph = brandGlyphSvg();
    for (const p of MARK_PATHS) expect(glyph).toContain(p.d);
  });
});

describe("icon.svg", () => {
  it("public/icon.svg exists (manifest and direct browser requests) and matches app/icon.svg", () => {
    expect(
      existsSync(resolve(ROOT, "public/icon.svg")),
      "public/icon.svg must exist to prevent 404",
    ).toBe(true);
    expect(read("public/icon.svg")).toBe(read("app/icon.svg"));
  });

  it("app/icon.svg draws the mark's needle", () => {
    const icon = read("app/icon.svg");
    // The needle is the mark's first three paths; the favicon keeps it and drops the diamond.
    for (const p of MARK_PATHS.slice(0, 3)) expect(icon).toContain(p.d);
  });

  it("app/icon.svg is the only app icon, so browsers get one favicon", () => {
    expect(existsSync(resolve(ROOT, "app/icon.png"))).toBe(false);
  });
});
