import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PUBLIC_ICON_PATH = resolve(ROOT, "public/icon.svg");
const APP_ICON_PATH = resolve(ROOT, "app/icon.svg");

describe("UYE-P5 — icon.svg guard (İRİS A14)", () => {
  it("public/icon.svg exists and serves non-empty SVG for manifest and direct browser requests", () => {
    expect(existsSync(PUBLIC_ICON_PATH), "public/icon.svg must exist to prevent 404").toBe(true);
    const content = readFileSync(PUBLIC_ICON_PATH, "utf8");
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
    expect(content).toContain("#b0522e");
    expect(content).toContain('r="8.6"');
  });

  it("app/icon.svg mirrors the single-source brand mark per ENGINEERING.md §5", () => {
    expect(existsSync(APP_ICON_PATH), "app/icon.svg must exist per ENGINEERING.md §5").toBe(true);
    const content = readFileSync(APP_ICON_PATH, "utf8");
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
    expect(content).toContain("#b0522e");
    expect(content).toContain('r="8.6"');
  });
});
