import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN, the same `FU-WEB-JSDOM` reason every other `.structure.test.ts` in this
 * repo already gives — this repo's vitest environment is a bare `node` environment with
 * no jsdom, so `tool-island.tsx`'s recall/save-attempt-id/uncertainty-widening logic
 * cannot be rendered and asserted on directly.
 *
 * NARROW SCOPE, DELIBERATELY (UYELIK-12 plan §5.4 items 3/6/7, §11): this file guards
 * only the NEW recall/save-attempt-id logic this task adds to the pre-existing
 * 1039-line `tool-island.tsx` — it does not retrofit full coverage onto everything else
 * in that file, mirroring §2.6's own stated reason for adding one narrow, new-logic-only
 * test here rather than a broad one.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const ISLAND = flatCode(sourceOf("./tool-island.tsx"));

describe('PointSource gains a fourth literal, "recalled" (plan §5.4 item 3)', () => {
  it('the module-private PointSource union includes "recalled" alongside the three originals', () => {
    expect(ISLAND).toMatch(/type PointSource = "map" \| "typed" \| "province" \| "recalled";/);
  });
});

describe("the uncertainty computation is widened to treat recalled points as map-class (plan §5.4 item 3)", () => {
  it('the uncertaintyKm test checks BOTH "map" and "recalled" sources, never "recalled" alone or omitted', () => {
    expect(ISLAND).toContain(
      'points.some( (placed) => placed.source === "map" || placed.source === "recalled", )',
    );
  });
});

describe('recallMeasurement loads a saved measurement\'s geometry with source "recalled" (plan §5.4 item 7)', () => {
  it('maps every recalled point\'s source literal to "recalled", never map/typed/province', () => {
    const start = ISLAND.indexOf("const recallMeasurement = useCallback");
    expect(start).toBeGreaterThan(0);
    const end = ISLAND.indexOf("}, []);", start);
    const body = ISLAND.slice(start, end);
    expect(body).toContain('source: "recalled" as const');
  });

  it("clears fieldError/statusError/draft/province and the pending-save id, mirroring clear()'s own reset — but does NOT ask for confirmation", () => {
    const start = ISLAND.indexOf("const recallMeasurement = useCallback");
    const end = ISLAND.indexOf("}, []);", start);
    const body = ISLAND.slice(start, end);
    expect(body).toContain("setFieldError(null)");
    expect(body).toContain("setStatusError(null)");
    expect(body).toContain('setDraft("")');
    expect(body).toContain('setProvince("")');
    expect(body).toContain("pendingSaveIdRef.current = null");
    expect(body).not.toMatch(/confirm\(/);
  });

  it("sets points FROM the recalled measurement's own geometry, not an empty array (the difference from clear())", () => {
    const start = ISLAND.indexOf("const recallMeasurement = useCallback");
    const end = ISLAND.indexOf("}, []);", start);
    const body = ISLAND.slice(start, end);
    expect(body).toContain("setPoints(");
    expect(body).toContain("measurement.points.map(");
    expect(body).not.toContain("setPoints([]);");
  });
});

describe("the save-attempt id is cleared on EVERY point-mutating call site (plan §5.4 item 6/§10 item 1)", () => {
  it("addPoint clears it on BOTH the coordinate-replace branch and the accumulation branch", () => {
    const occurrences = ISLAND.split("pendingSaveIdRef.current = null").length - 1;
    // addPoint (x2: coordinate-replace + accumulation) + removePoint + undo + clear +
    // recallMeasurement = 6 call sites total.
    expect(occurrences).toBe(6);
  });

  it("removePoint clears the pending save id alongside its own focus-successor bookkeeping", () => {
    const start = ISLAND.indexOf("const removePoint = useCallback");
    const end = ISLAND.indexOf("}, []);", start);
    const body = ISLAND.slice(start, end);
    expect(body).toContain("pendingSaveIdRef.current = null");
  });

  it("undo and clear both clear the pending save id", () => {
    const undoStart = ISLAND.indexOf("const undo = useCallback");
    const undoEnd = ISLAND.indexOf("}, []);", undoStart);
    expect(ISLAND.slice(undoStart, undoEnd)).toContain("pendingSaveIdRef.current = null");

    const clearStart = ISLAND.indexOf("const clear = useCallback");
    const clearEnd = ISLAND.indexOf("}, []);", clearStart);
    expect(ISLAND.slice(clearStart, clearEnd)).toContain("pendingSaveIdRef.current = null");
  });
});

describe("the measurements-fetch effect never sets pending synchronously in the effect body (react-hooks/set-state-in-effect)", () => {
  it('the ONLY setMeasurementsStatus call site is inside the async .then() callback, settling to "settled"', () => {
    const occurrences = ISLAND.split("setMeasurementsStatus(").length - 1;
    expect(occurrences).toBe(1);
    expect(ISLAND).toContain('setMeasurementsStatus("settled")');
    expect(ISLAND).not.toContain('setMeasurementsStatus("pending")');
  });
});

describe("measurementsForThisTool preserves null rather than collapsing it (corrected reading of plan §5.4 item 5)", () => {
  it("does not use the `measurements ?? []` collapse that would make the list panel's error state unreachable", () => {
    expect(ISLAND).not.toContain("(measurements ?? []).filter");
    expect(ISLAND).toContain(
      "measurements === null ? null : measurements.filter((measurement) => measurement.type === mode)",
    );
  });
});

describe("locale is threaded through ToolIslandProps and into the save/list subcomponents (plan §5.4 item 1)", () => {
  it("ToolIslandProps declares a locale: Locale field", () => {
    expect(ISLAND).toMatch(/locale: Locale;/);
  });

  it("both new subcomponents receive locale as a prop", () => {
    expect(ISLAND).toContain("<ToolMeasurementSave");
    const saveStart = ISLAND.indexOf("<ToolMeasurementSave");
    const saveEnd = ISLAND.indexOf("/>", saveStart);
    expect(ISLAND.slice(saveStart, saveEnd)).toContain("locale={locale}");

    const listStart = ISLAND.indexOf("<ToolMeasurementList");
    const listEnd = ISLAND.indexOf("/>", listStart);
    expect(ISLAND.slice(listStart, listEnd)).toContain("locale={locale}");
  });
});

describe("the list panel mounts only for an authenticated reader (Product judgment call #3)", () => {
  it('wraps <ToolMeasurementList> in an authState === "authenticated" guard', () => {
    const guardIdx = ISLAND.indexOf('authState === "authenticated" && (');
    const listIdx = ISLAND.indexOf("<ToolMeasurementList");
    expect(guardIdx).toBeGreaterThan(0);
    expect(listIdx).toBeGreaterThan(guardIdx);
  });
});

describe("handleMeasurementSaved/handleMeasurementDeleted/handleMeasurementDeleteFailed (plan §5.4 items 8/9, §5.6/§10 item 5)", () => {
  it("a newly-saved row is prepended, never triggering a re-fetch", () => {
    expect(ISLAND).toContain("setMeasurements((previous) => [measurement, ...(previous ?? [])]);");
  });

  it("a deleted id is filtered out by id, not by a full-list replace", () => {
    expect(ISLAND).toContain(
      "setMeasurements((previous) => (previous ?? []).filter((m) => m.id !== id));",
    );
  });

  it("a failed delete re-inserts the SPECIFIC row object, guarding against a duplicate", () => {
    const start = ISLAND.indexOf("const handleMeasurementDeleteFailed = useCallback");
    expect(start).toBeGreaterThan(0);
    const end = ISLAND.indexOf("}, []);", start);
    const body = ISLAND.slice(start, end);
    expect(body).toContain("current.some((m) => m.id === measurement.id)");
    expect(body).toContain("return current;");
  });
});
