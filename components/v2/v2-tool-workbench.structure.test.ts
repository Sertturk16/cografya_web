import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

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

  it("lists only this tool's saved measurements, bridging ToolMode to the contract's type (VAL126R2TC-I1, T-125)", () => {
    const code = stripComments(source);
    expect(code).toContain(
      'activeTool === "distance" ? "distance" : activeTool === "area" ? "area" : "coordinate";',
    );
    expect(code).toContain("savedList.filter((record) => record.type === measurementType)");
    // The UI side of the same bridge: renaming ToolMode's plural member must fail here too.
    const presets = readFileSync(
      new URL("../../lib/tools/tool-presets.ts", import.meta.url),
      "utf8",
    );
    expect(presets).toContain(
      'export const TOOL_MODES = ["distance", "coordinates", "area"] as const;',
    );
  });

  // T-125: each tool page runs one tool. Nothing on the page (a preset, a saved measurement, a
  // switcher card) may turn the distance page into the area tool under the distance URL.
  it("never switches the tool from inside the page", () => {
    const code = stripComments(source);
    expect(code).not.toMatch(/setActiveTool|lockMode/);
    expect(code).toContain("const activeTool = mode;");
    expect(code).toContain("TOOL_PRESETS[mode].map(");
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
    /**
     * The fullscreen target is the box holding the map AND its credit — `landscapeBoxRef`, not
     * `mapContainerRef`.
     *
     * This assertion named `mapContainerRef` while the credit was rendered inside the plate, so
     * the two refs were the same element and the distinction did not exist. Once the credit moved
     * out of the plate (2026-09-20, the credit was taking 517px of a 1166px plate away from the
     * map), targeting the plate would have taken the map fullscreen and left its attribution
     * behind on the page underneath — the licence gap that change existed to close, reappearing
     * in the one view where the map fills the screen.
     *
     * `mapContainerRef` still exists and still points at the plate, because the scale-bar
     * `ResizeObserver` measures the DRAWING's width. Both are asserted: the hook must take the
     * outer box, and the plate ref must not be what it takes.
     */
    it("wires the shared landscape hook to the box holding the map and its credit", () => {
      expect(source).toContain('from "@/lib/map/use-landscape-mode.client"');
      expect(source).toContain("useLandscapeMode(landscapeBoxRef)");
      expect(source, "the plate alone must not be the fullscreen target").not.toContain(
        "useLandscapeMode(mapContainerRef)",
      );
    });

    /**
     * The credit has to be INSIDE the element that goes fullscreen. A placement test reading the
     * page tree cannot see this: `v2-map-credit-placement.test.ts` asks that the credit is not
     * inside the map BOX, which is satisfied either way, and fullscreen is a runtime state no
     * static scan evaluates. What is checkable here is the nesting that makes it possible.
     */
    it("keeps the credit inside the fullscreen box", () => {
      const box = source.indexOf("ref={landscapeBoxRef}");
      expect(box, "landscapeBoxRef is not attached to anything").toBeGreaterThan(-1);
      const credit = source.indexOf("<MapAttribution", box);
      expect(credit, "the credit is not rendered after the fullscreen box opens").toBeGreaterThan(
        -1,
      );
    });
  });

  /**
   * T-051: the api answers an under-count shape (a one-point distance, a two-point area) with a
   * 400 `invalidShape`. The save gate must be the shared per-type rule from
   * `lib/measurements/shape.ts`, applied to BOTH the handler and the button, not a local count.
   */
  describe("per-type minimum point gate (T-051)", () => {
    const code = stripComments(source);

    function sliceFrom(start: string, end: string): string {
      const from = code.indexOf(start);
      expect(from, `${start} not found`).toBeGreaterThan(-1);
      const to = code.indexOf(end, from);
      expect(to, `${end} not found after ${start}`).toBeGreaterThan(from);
      return code.slice(from, to);
    }

    it("derives the gate from the shared shape rule", () => {
      expect(code).toContain('from "@/lib/measurements/shape"');
      // T-094 adds the self-intersection refusal on top of the shared count rule.
      expect(code).toMatch(
        /const canSave =\s*canSaveMeasurement\(measurementType, points\.length\) && !isSelfIntersecting;/,
      );
    });

    it("guards handleSaveMeasurement with the per-type gate, not an empty-list check", () => {
      const handler = sliceFrom("const handleSaveMeasurement = ", "\n  };");
      expect(handler).toContain("if (!canSave) return;");
      expect(handler).not.toContain("points.length === 0");
    });

    it("disables the save button on the same gate and points it at the reason", () => {
      const button = sliceFrom("onClick={handleSaveMeasurement}", ">");
      expect(button).toContain("disabled={!canSave}");
      expect(button).toContain("aria-describedby={canSave ? undefined : saveHintId}");
      expect(code).toContain('tMeasurements("minPointsHint", { count: minPointsToSave })');
    });
  });

  /**
   * T-077: a failed save used to be dropped (`if (res.ok)` and nothing else), and a measurement
   * with more points than the api's flat bound failed the same silent way. The mapping from the
   * BFF answer to an error kind lives in `lib/measurements/save-error.ts` and is tested there;
   * this pins that the workbench actually wires it up.
   */
  /**
   * T-094: a self-intersecting outline has no area. `readRingArea` (tested in
   * `lib/map/measure.test.ts`) decides it once; this pins that the workbench shows no number for
   * that reading and refuses to save, copy or export the shape.
   */
  describe("self-intersecting area outline (T-094)", () => {
    const code = stripComments(source);

    it("derives the flag and the number from the one reading", () => {
      expect(code).toContain("readRingArea(points.map((p) => p.geo))");
      expect(code).toContain(
        'const isSelfIntersecting = areaReading?.kind === "selfIntersecting";',
      );
      expect(code).toContain('const areaKm2 = areaReading?.kind === "area" ? areaReading.km2 : 0;');
      expect(code).not.toContain("ringAreaKm2(");
    });

    it("renders the area figure only on the non-crossing branch", () => {
      const from = code.indexOf("{isSelfIntersecting ? (");
      expect(from).toBeGreaterThan(-1);
      const elseAt = code.indexOf(") : (", from);
      const warning = code.slice(from, elseAt);
      const figure = code.slice(elseAt, code.indexOf("km²", elseAt));
      expect(warning).toContain('t("areaSelfIntersect")');
      expect(warning).not.toContain("areaKm2");
      expect(figure).toContain("areaKm2");
    });

    it("blocks copy and PNG export in the handlers and on the buttons", () => {
      for (const handler of [
        "const handleCopy = async () => {",
        "const handleExportPng = () => {",
      ]) {
        const at = code.indexOf(handler);
        expect(at, handler).toBeGreaterThan(-1);
        expect(code.slice(at, at + 120)).toContain("if (isSelfIntersecting) return;");
      }
      // The result card's copy button and the toolbar's PNG export.
      expect(code.match(/disabled=\{points\.length === 0 \|\| isSelfIntersecting\}/g)).toHaveLength(
        2,
      );
    });

    it("tells the reader why save is off", () => {
      expect(code).toContain('t("selfIntersectSaveHint")');
    });
  });

  describe("save failures and the upper point bound (T-077)", () => {
    const code = stripComments(source);

    function sliceFrom(start: string, end: string): string {
      const from = code.indexOf(start);
      expect(from, `${start} not found`).toBeGreaterThan(-1);
      const to = code.indexOf(end, from);
      expect(to, `${end} not found after ${start}`).toBeGreaterThan(from);
      return code.slice(from, to);
    }

    const handler = (): string => sliceFrom("const handleSaveMeasurement = ", "\n  };");

    it("records a failed save, including a thrown one, instead of dropping it", () => {
      const body = handler();
      expect(body).toContain("await saveMeasurement(");
      expect(body).toMatch(
        /if \(res\.ok\) \{[\s\S]*\} else \{\s*setSaveFailure\(\{ code: res\.code,/,
      );
      expect(body).toMatch(/catch \{\s*setSaveFailure\(\{ code: "failed",/);
    });

    it("renders the failure through the shared message map, as an alert", () => {
      expect(code).toContain('from "@/lib/measurements/save-error"');
      const at = code.indexOf(
        "<MeasurementErrorText messageKey={SAVE_ERROR_MESSAGE_KEY[visibleSaveFailure]} />",
      );
      expect(at, "the failure copy is not rendered").toBeGreaterThan(-1);
      const element = code.slice(code.lastIndexOf("<p", at), at);
      expect(element).toContain('role="alert"');
    });

    it("hides a failure once the points or the tool change, and clears it on retry", () => {
      expect(code).toMatch(
        /saveFailure !== null &&\s*saveFailure\.points === points &&\s*saveFailure\.type === measurementType/,
      );
      expect(handler()).toContain("setSaveFailure(null);");
    });

    it("cannot double-submit while a save is in flight", () => {
      const body = handler();
      expect(body).toContain("if (saveInFlightRef.current) return;");
      expect(body).toContain("saveInFlightRef.current = true;");
      expect(body).toMatch(
        /finally \{\s*saveInFlightRef\.current = false;\s*setIsSaving\(false\);/,
      );
      expect(sliceFrom("onClick={handleSaveMeasurement}", ">")).toContain("isLoading={isSaving}");
    });

    it("replays the same clientMeasurementId when retrying the unchanged measurement", () => {
      const body = handler();
      expect(body).toContain("pendingSaveRef.current");
      expect(body).toContain("crypto.randomUUID()");
      expect(body).toMatch(/if \(res\.ok\) \{\s*pendingSaveRef\.current = null;/);
    });

    it("explains an over-limit shape with its own hint", () => {
      expect(code).toContain("measurementPointCountIssue(measurementType, points.length)");
      expect(code).toContain('tMeasurements("maxPointsHint", { count: maxPointsToSave })');
    });

    it("takes every save-row string from the Measurements catalogue", () => {
      for (const key of [
        "saveLabel",
        "savedLabel",
        "savingLabel",
        "saveSuccess",
        "signInHint",
        "titleLabel",
      ]) {
        expect(code, key).toContain(`tMeasurements("${key}")`);
      }
      for (const literal of [
        '"Kaydet"',
        '"Kaydedildi!"',
        "Ölçüm bulut arşivine başarıyla kaydedildi.",
        "Ölçümlerini bulut arşivine kaydetmek için giriş yapmalısın.",
        "Ölçüm Başlığı (Opsiyonel)...",
      ]) {
        expect(code, literal).not.toContain(literal);
      }
    });
  });
  /**
   * T-080: the same silent-failure class T-077 closed for a save, in the three places it was left
   * open — a failed delete, a failed first load of the saved list, and a 401 during a save or
   * delete reported as "try again" when the fix is to sign in again. The render of each message is
   * in `v2-tool-workbench.errors.test.tsx`; this pins the wiring.
   */
  describe("delete, list-load and expired-session failures (T-080)", () => {
    const code = stripComments(source);

    function sliceFrom(start: string, end: string): string {
      const from = code.indexOf(start);
      expect(from, `${start} not found`).toBeGreaterThan(-1);
      const to = code.indexOf(end, from);
      expect(to, `${end} not found after ${start}`).toBeGreaterThan(from);
      return code.slice(from, to);
    }

    function alertAround(needle: string): string {
      const at = code.indexOf(needle);
      expect(at, `${needle} is not rendered`).toBeGreaterThan(-1);
      return code.slice(code.lastIndexOf("<p", at), at);
    }

    it("records a failed delete instead of dropping it, and renders it as an alert", () => {
      const handler = sliceFrom("const handleDeleteSaved = ", "\n  };");
      expect(handler).toContain("setDeleteFailure(null);");
      expect(handler).toMatch(
        /if \(res\.ok\) \{[\s\S]*\} else \{\s*setDeleteFailure\(res\.code\);/,
      );
      expect(
        alertAround(
          "<MeasurementErrorText messageKey={DELETE_ERROR_MESSAGE_KEY[deleteFailure]} />",
        ),
      ).toContain('role="alert"');
    });

    it("shows a failed list load with a retry, and the retry refetches", () => {
      expect(code).toContain("setListLoad({ key: listReloadKey, ok: records !== null });");
      expect(code).toContain("}, [authState, listReloadKey]);");
      expect(alertAround('tMeasurements("listError")')).toContain('role="alert"');
      const retry = sliceFrom("onClick={handleRetryList}", ">");
      expect(retry).toContain("isLoading={listRetrying}");
      expect(code).toContain("const handleRetryList = () => setListReloadKey((key) => key + 1);");
      // The card must render for a failed load even when there is nothing listed yet.
      expect(code).toContain("(activeSavedList.length > 0 || listLoadFailed) && (");
    });

    it("routes an expired session to the login page, not to a retry", () => {
      const helper = sliceFrom("export function MeasurementErrorText(", "return t(messageKey);");
      expect(helper).toContain('if (messageKey === "sessionExpired")');
      expect(helper).toContain('<Link href="/giris"');
    });

    it("bounds the title input by the same constant the BFF schema enforces", () => {
      expect(code).toContain("maxLength={MEASUREMENT_TITLE_MAX_LENGTH}");
      const transport = stripComments(
        readFileSync(
          new URL("../../lib/measurements/transport.server.ts", import.meta.url),
          "utf8",
        ),
      );
      expect(transport).toContain("title: z.string().max(MEASUREMENT_TITLE_MAX_LENGTH)");
    });
  });
  // T-122: the viewBox narrows by `zoomLevel`, so a pin keeps its on-screen size only when
  // every dimension is divided by `zoomLevel` itself (`atScreenSize`). `√zoom` made pins and
  // labels grow; viewBox units without the measured box scale made them tiny on a phone.
  it("draws waypoint pins at a constant on-screen size", () => {
    const code = stripComments(source);
    const start = code.indexOf("{points.map((p, idx) => {");
    expect(start).toBeGreaterThan(-1);
    const pins = code.slice(start, code.indexOf("</svg>", start));
    expect(pins).not.toMatch(/sqrt/);
    expect(pins).toContain("r={atScreenSize(PIN_RADIUS, zoomLevel, pxPerUnit)}");
    expect(pins).toContain("strokeWidth={atScreenSize(PIN_OUTLINE, zoomLevel, pxPerUnit)}");
    expect(pins).toContain("fontSize={atScreenSize(PIN_LABEL_SIZE, zoomLevel, pxPerUnit)}");
    expect(pins).toContain("strokeWidth={atScreenSize(PIN_LABEL_HALO, zoomLevel, pxPerUnit)}");
    expect(pins).toContain(
      "const gap = atScreenSize(PIN_RADIUS + PIN_LABEL_GAP, zoomLevel, pxPerUnit);",
    );
    expect(pins).toContain("pinLabelPlacement(pinCentres[idx]!, pinCentres)");
    // A stroke-[n] class would override the attribute and grow with the zoom again.
    expect(pins).not.toMatch(/stroke-\[/);
    expect(code).toContain(
      "setPxPerUnit(Math.min(width / WORLD_VIEWBOX.w, height / WORLD_VIEWBOX.h))",
    );
  });

  // T-126: the live coordinate readout appeared on the first hover, wrapped the toolbar onto a
  // second row and pushed the map 48 px down under the cursor, so the first click landed ~50 px
  // off. It now holds its place from the first paint on a mouse, and takes none on a touchscreen.
  it("reserves the coordinate readout's place instead of inserting it on hover", () => {
    const code = stripComments(source);
    expect(code).not.toMatch(/\{hoveredPos && \(/);
    expect(code).toMatch(
      /className=\{`hidden pointer-fine:inline-block[^`]*\$\{hoveredPos \? "" : "invisible"\}`\}/,
    );
  });
});
