import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * AST-based structure test for the auth dialog's a11y contract (uyelik-auth-redesign plan
 * §11.2), the `auth-a11y.structure.test.ts` technique: this repo's vitest environment is a
 * bare `node` environment with no jsdom (`FU-WEB-JSDOM`), so the dialog cannot be rendered and
 * asserted on directly. The empirical half (real Playwright: focus order, `showModal()`
 * actually firing, the nested-dialog stacking check) is §11.4, run and reported in the
 * closing summary — never a gate here.
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

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

type JsxElementLike = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function isJsxElementLike(node: ts.Node): node is JsxElementLike {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
}

function jsxElements(root: ts.Node, tagName?: string): JsxElementLike[] {
  const all = descendants(root, isJsxElementLike);
  if (tagName === undefined) return all;
  return all.filter((el) => el.tagName.getText() === tagName);
}

function hasAttr(el: JsxElementLike, name: string): boolean {
  return el.attributes.properties.some(
    (attr) => ts.isJsxAttribute(attr) && attr.name.getText() === name,
  );
}

function attrText(el: JsxElementLike, name: string): string | undefined {
  for (const attr of el.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText() !== name) continue;
    if (attr.initializer === undefined) return "true";
    if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      return attr.initializer.expression.getText();
    }
    return undefined;
  }
  return undefined;
}

describe("auth-dialog.tsx renders a native <dialog>, wired for a11y (plan §5.7)", () => {
  const { source, ast } = parse("./auth-dialog.tsx");

  it("renders exactly one <dialog>, with a ref and aria-labelledby pointing at the heading", () => {
    const dialogs = jsxElements(ast, "dialog");
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0];
    if (!dialog) throw new Error("unreachable");
    expect(hasAttr(dialog, "ref")).toBe(true);
    expect(attrText(dialog, "aria-labelledby")).toBe("auth-dialog-heading");
  });

  it("carries an onClose handler — Esc and programmatic close() both keep the store in sync", () => {
    const dialogs = jsxElements(ast, "dialog");
    const dialog = dialogs[0];
    if (!dialog) throw new Error("unreachable");
    expect(hasAttr(dialog, "onClose")).toBe(true);
  });

  it("calls showModal() when the store's open flag turns true", () => {
    expect(source).toContain("dialog.showModal()");
  });

  it("moves focus to the heading after showModal() — WCAG 4.1.3, the same remedy game-summary.tsx already uses", () => {
    const call = source.indexOf("dialog.showModal()");
    expect(call).toBeGreaterThan(0);
    const focusCall = source.indexOf("headingRef.current?.focus()", call);
    expect(focusCall).toBeGreaterThan(call);
  });

  it("calls close() when the store's open flag turns false", () => {
    expect(source).toContain("dialog.close()");
  });

  it("closes on a click that lands on the dialog element itself (the backdrop), not on the body — the platform gives no backdrop-click-to-close for free", () => {
    expect(source).toContain("event.target === dialogRef.current");
    expect(source).toContain("dismissAuth()");
  });
});

describe("auth-dialog-body.tsx — the close control, the heading, and the intent line", () => {
  const { source, ast } = parse("./auth-dialog-body.tsx");

  it('the close control is a <button type="button"> with an accessible name, never a bare icon', () => {
    const buttons = jsxElements(ast, "button");
    const close = buttons.find((el) => attrText(el, "onClick") === "onClose");
    expect(close).toBeDefined();
    if (!close) throw new Error("unreachable");
    expect(attrText(close, "type")).toBe("button");
    expect(hasAttr(close, "aria-label")).toBe(true);
  });

  it("the heading carries the dialog's own id, tabIndex={-1} and the ref the dialog moves focus to", () => {
    const headings = jsxElements(ast, "h2");
    const heading = headings.find((el) => attrText(el, "id") === "auth-dialog-heading");
    expect(heading).toBeDefined();
    if (!heading) throw new Error("unreachable");
    expect(attrText(heading, "tabIndex")).toBe("-1");
    expect(hasAttr(heading, "ref")).toBe(true);
  });

  it("renders LoginForm or RegisterForm, never a second/bespoke form — Acceptance Criterion 4", () => {
    expect(jsxElements(ast, "LoginForm").length).toBeGreaterThan(0);
    expect(jsxElements(ast, "RegisterForm").length).toBeGreaterThan(0);
    // Both wired through the shared onAuthenticated seam, not a bespoke success handler.
    expect(source).toContain("onAuthenticated={onAuthenticated}");
  });

  it('the mode toggle is a real <button type="button">, never an <a> — it changes in-page state, it does not navigate (ENGINEERING.md §5)', () => {
    const buttons = jsxElements(ast, "button");
    const toggle = buttons.find((el) => attrText(el, "onClick")?.includes("setAuthModalMode"));
    expect(toggle).toBeDefined();
    if (!toggle) throw new Error("unreachable");
    expect(attrText(toggle, "type")).toBe("button");
  });

  it('the intent line is resolved through literal, statically-scannable t("modal.intent....") calls, not a dynamic template-literal key (keeps messages.test.ts\'s own per-file key scan able to see it)', () => {
    expect(source).toContain('t("modal.intent.favorite")');
    expect(source).toContain('t("modal.intent.video")');
    expect(source).toContain('t("modal.intent.gameRound")');
    expect(source).toContain('t("modal.intent.measurement")');
    expect(source).toContain('t("modal.intent.generic")');
  });
});

describe("auth-mount.tsx — the ssr:false boundary and the byte-zero-until-opened contract (K8/K9)", () => {
  const { source } = parse("./auth-mount.tsx");

  it("dynamically imports the dialog with ssr: false", () => {
    expect(source).toContain("ssr: false");
    expect(source).toContain('import("./auth-dialog")');
  });

  it("renders nothing until the modal has opened at least once", () => {
    expect(source).toContain("if (!hasOpened) return null;");
  });
});
