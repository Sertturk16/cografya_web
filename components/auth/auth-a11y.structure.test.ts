import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * G4 (plan §8/§9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`):
 * the STRUCTURAL half of the a11y contract, AST-based (the `components/route-urls.test.ts`
 * pattern) over `field.tsx` and PR-1's three islands. `vitest.config.ts` runs a bare `node`
 * environment with no jsdom (`FU-WEB-JSDOM`), so no test in this repo can render a component
 * or prove that focus actually moved — the empirical half (a scripted Playwright pass) is
 * evidence in the closing summary, never a gate. This file proves the SOURCE always wires
 * the contract, which is the half CI can actually check.
 *
 * Scoped to the THREE islands PR-1 ships (`login-form`, `password-reset-request-form`,
 * `password-reset-confirm-form`); PR-2 adds `register-form` and `verify-email-form` to
 * `ISLAND_FILES` in the same PR that creates them.
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

/** The attribute's literal text value — a string-literal initializer or a JSX-expression
 *  initializer's raw source text (e.g. `{-1}` → `"-1"`, `{styles.control}` →
 *  `"styles.control"`). `undefined` when the attribute is absent. */
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

// ---------------------------------------------------------------------------------------
// field.tsx — the a11y wiring, once.
// ---------------------------------------------------------------------------------------

describe("field.tsx wires the a11y contract once", () => {
  const { ast } = parse("./field.tsx");

  it("TextField renders exactly one raw <input>, wired", () => {
    const inputs = jsxElements(ast, "input");
    // Anchors the scan: a rename of the element (or of the whole component) fails here
    // instead of every assertion below passing vacuously on zero matches.
    expect(inputs).toHaveLength(1);
    const input = inputs[0];
    if (!input) throw new Error("unreachable");
    expect(hasAttr(input, "id")).toBe(true);
    expect(hasAttr(input, "aria-invalid")).toBe(true);
    expect(hasAttr(input, "aria-describedby")).toBe(true);
  });

  it("SelectField renders exactly one raw <select>, wired the same way", () => {
    const selects = jsxElements(ast, "select");
    expect(selects).toHaveLength(1);
    const select = selects[0];
    if (!select) throw new Error("unreachable");
    expect(hasAttr(select, "id")).toBe(true);
    expect(hasAttr(select, "aria-invalid")).toBe(true);
    expect(hasAttr(select, "aria-describedby")).toBe(true);
  });

  it("both controls get a real <label htmlFor>", () => {
    const labels = jsxElements(ast, "label");
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(hasAttr(label, "htmlFor")).toBe(true);
    }
  });

  it("the shared error region carries role=alert and a focusable, ref'd heading", () => {
    const alerts = jsxElements(ast).filter((el) => attrText(el, "role") === "alert");
    expect(alerts).toHaveLength(1);

    const headings = jsxElements(ast, "h2");
    expect(headings).toHaveLength(1);
    const heading = headings[0];
    if (!heading) throw new Error("unreachable");
    expect(attrText(heading, "tabIndex")).toBe("-1");
    expect(hasAttr(heading, "ref")).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// The islands — every control goes through field.tsx, never a bare <input>/<select>.
// ---------------------------------------------------------------------------------------

const ISLAND_FILES = [
  "./login-form.tsx",
  "./password-reset-request-form.tsx",
  "./password-reset-confirm-form.tsx",
] as const;

describe("every island uses TextField/SelectField, never a bare control", () => {
  it.each(ISLAND_FILES)("%s", (relativePath) => {
    const { ast } = parse(relativePath);
    const textFields = jsxElements(ast, "TextField");
    // Positive control: the scan genuinely finds something, so the negative assertion below
    // is proof of absence rather than proof the parse silently found nothing at all.
    expect(textFields.length).toBeGreaterThan(0);
    expect(jsxElements(ast, "input")).toHaveLength(0);
    expect(jsxElements(ast, "select")).toHaveLength(0);

    for (const field of textFields) {
      expect(hasAttr(field, "required")).toBe(true);
    }
  });
});

describe("required autoComplete values are present", () => {
  it("login-form: email and current-password", () => {
    const { ast } = parse("./login-form.tsx");
    const values = jsxElements(ast, "TextField").map((el) => attrText(el, "autoComplete"));
    expect(values).toContain("email");
    expect(values).toContain("current-password");
  });

  it("password-reset-request-form: email", () => {
    const { ast } = parse("./password-reset-request-form.tsx");
    const values = jsxElements(ast, "TextField").map((el) => attrText(el, "autoComplete"));
    expect(values).toContain("email");
  });

  it("password-reset-confirm-form: one-time-code and new-password", () => {
    const { ast } = parse("./password-reset-confirm-form.tsx");
    const values = jsxElements(ast, "TextField").map((el) => attrText(el, "autoComplete"));
    expect(values).toContain("one-time-code");
    expect(values.filter((value) => value === "new-password").length).toBeGreaterThanOrEqual(2);
  });
});

describe("a code field is never type=number (G4's revert-to-red control)", () => {
  it("the reset-confirm screen's reset-code field is type=text", () => {
    // The plan's own worked example is the (PR-2) e-mail verification code; PR-1's only
    // code-shaped field is this screen's opaque reset token (plan §6.2 — a base64url
    // string, not a 6-digit number), so this is the field this gate actually observes in
    // PR-1. A `type="number"` input silently strips non-digit characters and any leading
    // zero, corrupting the token before it is ever submitted.
    const { ast } = parse("./password-reset-confirm-form.tsx");
    const field = jsxElements(ast, "TextField").find(
      (el) => attrText(el, "id") === "reset-new-code",
    );
    if (!field) throw new Error("reset-new-code field not found");
    expect(attrText(field, "type")).toBe("text");
  });
});

// ---------------------------------------------------------------------------------------
// The CSS module never removes focus.
// ---------------------------------------------------------------------------------------

describe("auth-form.module.css never sets outline: none", () => {
  it("no rule disables the focus ring", () => {
    const cssPath = fileURLToPath(new URL("./auth-form.module.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(css).not.toMatch(/outline\s*:\s*none/);
  });
});
