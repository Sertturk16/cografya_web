import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN, the same reason `components/game/game-round-save.structure.test.ts`/
 * `components/favorites/favorite-button.structure.test.ts` already give (UYELIK-12 plan
 * §11): this repo's vitest environment is a bare `node` environment with no jsdom
 * (`FU-WEB-JSDOM`), so `ToolMeasurementList`'s accessible shape and its optimistic-
 * delete-then-rollback handler cannot be rendered and asserted on directly.
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

const PANEL = flatCode(sourceOf("./tool-measurement-list.tsx"));

function handleDeleteBody(): string {
  const start = PANEL.indexOf("async function handleDelete(measurement: MeasurementRecord)");
  const end = PANEL.indexOf("return ( <details");
  return start < 0 || end < 0 || end <= start ? "" : PANEL.slice(start, end);
}

describe("never renders a premature statement (plan §5.6)", () => {
  it('returns null for status "idle" or "pending", before anything else renders', () => {
    expect(PANEL).toContain('if (status === "idle" || status === "pending") return null;');
  });
});

describe("the three settled states are mutually exclusive and distinct (Acceptance Criterion 4)", () => {
  it("checks measurements === null before measurements.length === 0 (error takes priority, never collapsed)", () => {
    const nullCheck = PANEL.indexOf("measurements === null");
    const emptyCheck = PANEL.indexOf("measurements.length === 0");
    expect(nullCheck).toBeGreaterThan(0);
    expect(emptyCheck).toBeGreaterThan(nullCheck);
  });

  it("the error branch uses the listError key inside a role=status region", () => {
    const nullCheck = PANEL.indexOf("measurements === null");
    const region = PANEL.slice(nullCheck, nullCheck + 150);
    expect(region).toContain('role="status"');
    expect(region).toContain('t("listError")');
  });

  it("the empty branch uses the listEmpty key", () => {
    const emptyCheck = PANEL.indexOf("measurements.length === 0");
    const region = PANEL.slice(emptyCheck, emptyCheck + 150);
    expect(region).toContain('t("listEmpty")');
  });

  it("the populated branch renders a role=list <ul>, one <li> per measurement.id", () => {
    expect(PANEL).toContain('<ul className={styles.points} role="list">');
    expect(PANEL).toContain("measurements.map((measurement) => {");
    expect(PANEL).toContain("key={measurement.id}");
  });
});

describe("the disclosure is closed by default (Product judgment call #4)", () => {
  it('renders a native <details> with no "open" attribute anywhere in the file', () => {
    expect(PANEL).toContain("<details");
    expect(PANEL).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("the summary uses the listToggleLabel key", () => {
    expect(PANEL).toContain('<summary className={styles.label}>{t("listToggleLabel")}</summary>');
  });
});

describe("the landing heading for post-delete focus (WCAG 2.4.3)", () => {
  it("renders an <h2> with tabIndex={-1} bound to headingRef, visually hidden via srOnly", () => {
    expect(PANEL).toContain("<h2 ref={headingRef} tabIndex={-1} className={styles.srOnly}>");
  });
});

describe("the type-fallback label reuses Tools.hub — no new i18n key (plan §5.6)", () => {
  it("maps distance/area/coordinate to mesafeName/alanName/koordinatName", () => {
    expect(PANEL).toContain('tHub("mesafeName")');
    expect(PANEL).toContain('tHub("alanName")');
    expect(PANEL).toContain('tHub("koordinatName")');
  });

  it("a row's label is the measurement's own title, falling back to the type label", () => {
    expect(PANEL).toContain("measurement.title ?? typeFallbackLabel");
  });
});

describe("the recall button (plan §5.4 item 7 — no confirmation)", () => {
  it("calls onRecall directly on click, with no confirm()/window.confirm anywhere in the file", () => {
    expect(PANEL).toContain("onClick={() => onRecall(measurement)}");
    expect(PANEL).not.toMatch(/confirm\(/);
  });

  it("carries a parametrized aria-label naming the row via recallAria", () => {
    expect(PANEL).toContain('aria-label={t("recallAria", { label })}');
  });
});

describe("the delete button — optimistic update, then rollback on failure (plan §5.6/§10 item 5)", () => {
  it("calls onDeleted BEFORE awaiting removeMeasurement — the optimistic half", () => {
    const body = handleDeleteBody();
    expect(body).not.toBe("");
    const onDeletedIdx = body.indexOf("onDeleted(measurement.id)");
    const awaitIdx = body.indexOf("await removeMeasurement(measurement.id)");
    expect(onDeletedIdx).toBeGreaterThan(0);
    expect(awaitIdx).toBeGreaterThan(onDeletedIdx);
  });

  it("moves focus to the panel's own heading BEFORE the async removeMeasurement call resolves — WCAG 2.4.3, both outcomes", () => {
    const body = handleDeleteBody();
    const onDeletedIdx = body.indexOf("onDeleted(measurement.id)");
    const focusIdx = body.indexOf("headingRef.current?.focus()");
    const awaitIdx = body.indexOf("await removeMeasurement(measurement.id)");
    expect(focusIdx).toBeGreaterThan(onDeletedIdx);
    expect(focusIdx).toBeLessThan(awaitIdx);
  });

  it("calls onDeleteFailed and NOT onDeleted a second time inside the failure branch — re-inserts the SPECIFIC row, not a re-fetch", () => {
    const body = handleDeleteBody();
    const failBranch = body.indexOf("if (!result.ok)");
    expect(failBranch).toBeGreaterThan(0);
    const tail = body.slice(failBranch);
    expect(tail).toContain("onDeleteFailed(measurement)");
    expect(tail).not.toContain("onDeleted(measurement.id)");
  });

  it("carries a parametrized aria-label naming the row via deleteAria", () => {
    expect(PANEL).toContain('aria-label={t("deleteAria", { label })}');
  });
});

describe("the inline per-row delete-error, shown only on the row whose delete just failed", () => {
  it("tracks failed ids in local state, set inside the failure branch", () => {
    const body = handleDeleteBody();
    const failBranch = body.indexOf("if (!result.ok)");
    const tail = body.slice(failBranch);
    expect(tail).toContain("setFailedDeleteIds");
  });

  it("renders the deleteError text only when the row's own id is in failedDeleteIds", () => {
    expect(PANEL).toContain("failedDeleteIds.has(measurement.id) &&");
    const idx = PANEL.indexOf("failedDeleteIds.has(measurement.id) &&");
    const region = PANEL.slice(idx, idx + 150);
    expect(region).toContain('role="status"');
    expect(region).toContain('t("deleteError")');
  });

  it("clears any stale failed-flag for that id at the START of a fresh delete attempt on it", () => {
    const body = handleDeleteBody();
    const clearIdx = body.indexOf("setFailedDeleteIds");
    const onDeletedIdx = body.indexOf("onDeleted(measurement.id)");
    expect(clearIdx).toBeGreaterThan(0);
    expect(clearIdx).toBeLessThan(onDeletedIdx);
  });
});
