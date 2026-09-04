import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("V2 Map Pan & Hover Contracts", () => {
  const turkeyFile = readFileSync(resolve(__dirname, "./v2-turkey-map-explorer.tsx"), "utf-8");
  const worldFile = readFileSync(resolve(__dirname, "./v2-world-map-explorer.tsx"), "utf-8");

  describe("Turkey Map (v2-turkey-map-explorer.tsx)", () => {
    it("imports clampPanOffset from lib/map/v2-zoom-pan", () => {
      expect(turkeyFile).toContain('import { clampPanOffset } from "@/lib/map/v2-zoom-pan"');
    });

    it("clamps panOffset during mouse move drag", () => {
      expect(turkeyFile).toContain("clampPanOffset(");
      expect(turkeyFile).toContain("container.clientWidth");
      expect(turkeyFile).toContain("container.clientHeight");
    });

    it("clamps panOffset when zooming out", () => {
      expect(turkeyFile).toContain("setPanOffset((cur) => clampPanOffset(cur, next");
    });

    it("has pointerdown handler with pointer capture and global pointer release listeners", () => {
      expect(turkeyFile).toContain("setPointerCapture");
      expect(turkeyFile).toContain('window.addEventListener("pointerup"');
      expect(turkeyFile).toContain('window.addEventListener("pointercancel"');
      expect(turkeyFile).toContain("onPointerDown={handlePointerDown}");
      expect(turkeyFile).toContain("onPointerUp={handleMouseUp}");
    });

    it("prevents drag initiation and pointer capture on UI button clicks", () => {
      expect(turkeyFile).toContain('closest("button, a, input")');
      expect(turkeyFile).toContain("onPointerDown={(e) => e.stopPropagation()}");
    });

    it("resets isDragging if mouse moves with no buttons pressed", () => {
      expect(turkeyFile).toContain("if (e.buttons === 0)");
      expect(turkeyFile).toContain("setIsDragging(false)");
    });
  });

  describe("World Map (v2-world-map-explorer.tsx)", () => {
    it("imports clampPanOffset from lib/map/v2-zoom-pan", () => {
      expect(worldFile).toContain('import { clampPanOffset } from "@/lib/map/v2-zoom-pan"');
    });

    it("clamps pan during mouse move drag", () => {
      expect(worldFile).toContain("clampPanOffset(");
      expect(worldFile).toContain("container.clientWidth");
      expect(worldFile).toContain("container.clientHeight");
    });

    it("clamps pan when zooming out", () => {
      expect(worldFile).toContain("setPan((cur) => clampPanOffset(cur, next");
    });

    it("has pointerdown handler with pointer capture and global pointer release listeners", () => {
      expect(worldFile).toContain("setPointerCapture");
      expect(worldFile).toContain('window.addEventListener("pointerup"');
      expect(worldFile).toContain('window.addEventListener("pointercancel"');
      expect(worldFile).toContain("onPointerDown={handlePointerDown}");
      expect(worldFile).toContain("onPointerUp={handleMouseUp}");
    });

    it("prevents drag initiation and pointer capture on UI button clicks", () => {
      expect(worldFile).toContain('closest("button, a, input")');
      expect(worldFile).toContain("onPointerDown={(e) => e.stopPropagation()}");
    });

    it("resets isPanning if mouse moves with no buttons pressed", () => {
      expect(worldFile).toContain("if (e.buttons === 0)");
      expect(worldFile).toContain("setIsPanning(false)");
    });

    it("clears hoveredIso when cursor leaves a country path", () => {
      expect(worldFile).toContain("onMouseLeave={() => setHoveredIso(null)}");
    });

    it("clears hoveredIso on the background ocean layer", () => {
      expect(worldFile).toContain('fill="url(#ocean-gradient)"');
      expect(worldFile).toContain("onMouseEnter={() => setHoveredIso(null)}");
    });

    it("renders unselected continent countries with visible muted land and subtle borders", () => {
      expect(worldFile).toContain("fill-slate-600/65");
      expect(worldFile).toContain("stroke-slate-400/45");
      expect(worldFile).not.toContain("fill-slate-700/20 stroke-slate-600/10 opacity-30");
    });
  });
});
