import { readdirSync, readFileSync } from "node:fs";
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
 * `ISLAND_FILES` is DERIVED from the directory, not hand-maintained (review
 * `TEST85-M1`/`C3`; plan header item 5,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`) — every client island
 * in this directory is named `*-form.tsx` (the established convention: `login-form.tsx`,
 * `password-reset-request-form.tsx`, `password-reset-confirm-form.tsx`, PR-2's
 * `register-form.tsx` and `verify-email-form.tsx`); `field.tsx` and every `*.test.ts` file do
 * not match, so the filter needs no exclusion list of its own. A hand list silently stopped
 * covering a new island the moment one shipped without a matching edit here — this can no
 * longer happen: a new `*-form.tsx` file is picked up automatically.
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

const COMPONENT_DIR = new URL("./", import.meta.url);

const ISLAND_FILES = readdirSync(COMPONENT_DIR, { encoding: "utf8" })
  .filter((name) => /-form\.tsx$/.test(name))
  .sort()
  .map((name) => `./${name}`);

describe("every island uses TextField/SelectField, never a bare control", () => {
  it("discovers every real island — fails closed if the naming convention silently changes", () => {
    expect(ISLAND_FILES.length).toBeGreaterThanOrEqual(5);
    expect(ISLAND_FILES).toEqual(
      expect.arrayContaining([
        "./login-form.tsx",
        "./password-reset-request-form.tsx",
        "./password-reset-confirm-form.tsx",
        "./register-form.tsx",
        "./verify-email-form.tsx",
      ]),
    );
  });

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

  it("register-form: given-name, family-name, tel, email, new-password (x2), one-time-code", () => {
    const { ast } = parse("./register-form.tsx");
    const values = jsxElements(ast, "TextField").map((el) => attrText(el, "autoComplete"));
    expect(values).toContain("given-name");
    expect(values).toContain("family-name");
    expect(values).toContain("tel");
    expect(values).toContain("email");
    expect(values.filter((value) => value === "new-password").length).toBeGreaterThanOrEqual(2);
    expect(values).toContain("one-time-code");
  });

  it("verify-email-form: email and one-time-code", () => {
    const { ast } = parse("./verify-email-form.tsx");
    const values = jsxElements(ast, "TextField").map((el) => attrText(el, "autoComplete"));
    expect(values).toContain("email");
    expect(values).toContain("one-time-code");
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

  it("the register screen's step-2 verification-code field is type=text — the plan's own worked example", () => {
    const { ast } = parse("./register-form.tsx");
    const field = jsxElements(ast, "TextField").find(
      (el) => attrText(el, "id") === "register-code",
    );
    if (!field) throw new Error("register-code field not found");
    expect(attrText(field, "type")).toBe("text");
  });

  it("the standalone verify-email screen's code field is type=text", () => {
    const { ast } = parse("./verify-email-form.tsx");
    const field = jsxElements(ast, "TextField").find(
      (el) => attrText(el, "id") === "verify-email-code",
    );
    if (!field) throw new Error("verify-email-code field not found");
    expect(attrText(field, "type")).toBe("text");
  });
});

// ---------------------------------------------------------------------------------------
// The CSS module never removes focus.
// ---------------------------------------------------------------------------------------

describe("auth-form.module.css never sets outline: none", () => {
  const cssPath = fileURLToPath(new URL("./auth-form.module.css", import.meta.url));
  const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");

  it("no rule disables the focus ring", () => {
    expect(css).not.toMatch(/outline\s*:\s*none/);
  });

  // Atlas ruling, `UYELIK-04-owner-review-ledger.md` §2.4 / review `VAL85-R2` part (3): the
  // auth forms opt back in to a visible ring on their two programmatic, tabIndex={-1}
  // headings, at (0,2,0) — the `game-ui.module.css` `.question:focus-visible` escape hatch
  // `app/globals.css`'s no-ring exception itself names as the intended use. `:focus`, not
  // `:focus-visible` (UYELIK-04 ui-fixes plan Finding 1): every covered target is reached
  // ONLY via a script `.focus()` call, and Chromium's `:focus-visible` heuristic fails to
  // match a script-triggered focus downstream of any prior click on the page.
  it("the error heading opts back into a visible focus ring", () => {
    expect(css).toMatch(/\.errorHeading:focus\s*\{[^}]*outline\s*:\s*2px solid/);
  });

  it("the success heading opts back into a visible focus ring", () => {
    expect(css).toMatch(/\.successHeading:focus\s*\{[^}]*outline\s*:\s*2px solid/);
  });

  // UYELIK-04-UI-FIXES review round 3 (`CODE88-M1`/`TEST88-I1`): the double-frame de-clutter
  // above used to fire on ANY focused descendant of `.errorRegion` (`:focus-within`),
  // including the error-list `<a>` links `field.tsx`'s `FormErrorRegion` renders when
  // field-level errors exist — those sit in normal Tab order (unlike the heading's own
  // `tabIndex={-1}`), so tabbing from the heading into that list made the red border vanish
  // early, at the exact moment a keyboard user is reviewing which fields are wrong. The fix
  // scopes the override to the HEADING specifically via `:has()` (Baseline-available,
  // already shipped in `game-map.module.css` and `site-search.module.css`), never to "any
  // focused descendant".
  it("the double-frame de-clutter is scoped to the heading, not any focused descendant", () => {
    expect(css).toMatch(
      /\.errorRegion:has\(\.errorHeading:focus\)\s*\{[^}]*border-color\s*:\s*var\(--color-border\)/,
    );
  });

  it("the old broad :focus-within selector is gone — it is the exact defect this fix corrects", () => {
    expect(css).not.toMatch(/\.errorRegion:focus-within/);
  });

  // A static regex over CSS source cannot evaluate real selector matching (this repo has no
  // jsdom — `FU-WEB-JSDOM` — so nothing here can render the DOM and ask the browser whether
  // `:has(.errorHeading:focus)` actually excludes `.errorList a`). The closest structural
  // proxy available at this layer: the border-color override's own selector never mentions
  // `.errorList` (or reaches into it any other way), so nothing in THIS rule's text could
  // widen it back to matching the link list. Real confirmation that focus on an `.errorList`
  // link leaves the border red — the false-positive case this guards against — is the
  // empirical half (tab from the heading into the error-link list, confirm the border does
  // NOT go neutral), run live and recorded in the closing summary, not a gate here.
  it("the border-color override selector never reaches into .errorList", () => {
    const overrideRule = css.match(/\.errorRegion:has\([^)]*\)\s*\{[^}]*\}/);
    expect(overrideRule).not.toBeNull();
    expect(overrideRule?.[0]).not.toMatch(/errorList/);
  });

  // A11Y88-I1 (round-3 fix): `register-form.tsx` re-focuses the district retry button on a
  // repeat failure, but a script `.focus()` downstream of the click that remounted it fails
  // Chromium's `:focus-visible` heuristic (measured live: `matches(':focus-visible')` is
  // `false` there) — the SAME class of gap `.errorHeading:focus`/`.successHeading:focus`
  // above already opt back into with a bare `:focus` rule. This button is not
  // `tabIndex={-1}`, so it needs its own equivalent opt-in.
  it("the district retry button opts back into a visible focus ring", () => {
    expect(css).toMatch(/\.districtRetry:focus\s*\{[^}]*outline\s*:\s*3px solid/);
  });
});
