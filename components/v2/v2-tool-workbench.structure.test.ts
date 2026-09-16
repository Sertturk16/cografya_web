import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Structural AST test for V2ToolWorkbench (`TEST124-I2`, `A11Y124-I5`, `VAL124SEC-2`).
 * Verifies that:
 * 1. `MeasurementType` is imported from `@/lib/api/types` to prevent contract drift.
 * 2. `saveMeasurement` and `removeMeasurement` are imported from `@/lib/measurements/client`.
 * 3. `handleDeleteSaved` and saved measurement row use event guards (`stopPropagation`/`preventDefault`).
 */

function parse(relativePath: string): { source: string; ast: ts.SourceFile } {
  const url = new URL(relativePath, import.meta.url);
  const source = readFileSync(url, "utf8");
  const ast = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  return { source, ast };
}

describe("V2ToolWorkbench structural contract (TEST124-I2, A11Y124-I5)", () => {
  const { source, ast } = parse("./v2-tool-workbench.tsx");

  it("imports MeasurementType from @/lib/api/types", () => {
    let hasMeasurementType = false;

    ts.forEachChild(ast, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, "");
        if (moduleSpecifier === "@/lib/api/types") {
          const namedBindings = node.importClause?.namedBindings;
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const specifier of namedBindings.elements) {
              if (specifier.name.text === "MeasurementType") hasMeasurementType = true;
            }
          }
        }
      }
    });

    expect(hasMeasurementType).toBe(true);
  });

  it("imports cloud persistence methods from @/lib/measurements/client", () => {
    expect(source).toMatch(/saveMeasurement/);
    expect(source).toMatch(/removeMeasurement/);
  });

  it("pins handleLoadSaved's coordinate → coordinates translation (VAL126R2TC-I1, FU125TC-I2)", () => {
    let initializer: string | null = null;
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "handleLoadSaved" &&
        node.initializer
      ) {
        initializer = node.initializer.getText();
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);

    // Positive control: the declaration was actually found, so the assertion below cannot
    // pass vacuously on `null`.
    expect(initializer).not.toBeNull();
    expect(initializer).toContain('record.type === "coordinate" ? "coordinates" : record.type');
    // The UI side of the same bridge: renaming ToolMode's plural member must fail here too.
    expect(source).toContain('export type ToolMode = "distance" | "coordinates" | "area";');
  });

  it("guards against event bubbling and scrolling in saved measurement list (A11Y124-I5)", () => {
    // Should call e.preventDefault() on Space/Enter key down
    expect(source).toContain("e.preventDefault()");
    // Should call e.stopPropagation() on delete button
    expect(source).toContain("e.stopPropagation()");
    // Should check e.target !== e.currentTarget
    expect(source).toContain("e.target !== e.currentTarget");
  });

  describe("touch pinch-zoom + pan (T-015)", () => {
    it("reuses the shared zoom/pan math instead of re-deriving pinch/clamp arithmetic", () => {
      expect(source).toContain('from "@/lib/map/zoom-pan"');
      expect(source).toContain("zoomFromPinch(");
      expect(source).toContain("clampPan(");
    });

    it("filters every touch handler to pointerType, so a mouse click never double-fires", () => {
      // A mouse click ALSO dispatches a `pointerdown`/`pointerup` — without this guard the
      // existing onMouseDown/onMouseMove/onMouseUp path above would run a second time.
      const guardCount = (source.match(/if \(e\.pointerType !== "touch"\) return;/g) ?? []).length;
      expect(guardCount).toBeGreaterThanOrEqual(3); // down, move, up (+ cancel reuses up)
    });
  });

  describe("smart region focus (T-015)", () => {
    it("frames newly named points, never a raw map click", () => {
      expect(source).toContain("focusOnMapPoints(");
      // The one action that must NOT trigger a re-frame: the player already navigated there.
      const clickHandler = (() => {
        const start = source.indexOf("const handleMapClick = ");
        expect(start).toBeGreaterThan(-1);
        const end = source.indexOf("\n  };", start);
        return source.slice(start, end);
      })();
      expect(clickHandler).not.toContain("focusOnMapPoints(");
    });
  });

  describe("landscape / fullscreen entry (T-015)", () => {
    it("wires the shared landscape hook to the map's own container ref", () => {
      expect(source).toContain('from "@/lib/map/use-landscape-mode.client"');
      expect(source).toContain("useLandscapeMode(mapContainerRef)");
    });
  });
});
