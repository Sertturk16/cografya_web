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

  // A11Y88R2-I1 (round-4 fix): the district retry's SUCCESS path re-focuses the `<select>`
  // itself. Review flagged this as the same script-`.focus()`-downstream-of-a-click gap the
  // district retry BUTTON above opts back into, reasoning the ring "almost certainly" would
  // not render (the select's shared `.control` class carries only `.control:focus-visible`,
  // no bare `:focus` fallback). MEASURED LIVE (round 4, Playwright): that premise does not
  // hold for a `<select>` — Chromium's `:focus-visible` already matches here even without
  // this rule, on both the script-focus transition AND an ordinary click, unlike the button/
  // heading cases. The id-scoped rule is kept anyway as an explicit guarantee that does not
  // depend on that heuristic (not identical across browsers) continuing to hold.
  it("the district select's retry-success re-focus target opts back into a visible focus ring", () => {
    expect(css).toMatch(/#register-districtId:focus\s*\{[^}]*outline\s*:\s*3px solid/);
  });

  // The fix must stay scoped to this one select's id, never widen to the shared `.control`
  // class every field in the form uses — a blanket `:focus` fallback there would reintroduce
  // the ring on the ORDINARY case of a user directly clicking into any field, where
  // `:focus-visible` is correctly suppressing it. Guards against exactly that regression.
  it("the shared .control class gets no blanket :focus fallback", () => {
    expect(css).not.toMatch(/\.control:focus\s*\{/);
  });
});

// ---------------------------------------------------------------------------------------
// A11Y93-I1 (round 2): a role=status/aria-live node must never be the ONLY thing that
// mounts/unmounts with a conditional block — the exact shape this PR's original fix (the
// `resendState === "sent" ? <p role="status">...</p> : null` mount-timing gap, closed at
// register-form.tsx:485-ish / verify-email-form.tsx:200-ish) and this fix round's own Fix 1
// (register-form.tsx's university/department announcement, previously inside the `userType`
// conditional) both address. This needs no jsdom (`FU-WEB-JSDOM`) — it is a pure structural
// invariant over the same AST `jsxElements`/`descendants` already scan.
// ---------------------------------------------------------------------------------------

/** `true` for a JSX fragment (`<>...</>`) whose only children, if any, are whitespace-only
 *  JSX text — i.e. an empty-fragment alternate (`<></>` or `<> </>`), the third spelling of
 *  "this branch renders nothing" a JSX-mount ternary can use alongside `null`/`undefined`
 *  (TEST95-P1, `Owner's Inbox/pr-review-archive/cografya_web-95.md`). A fragment that
 *  actually wraps real content (`<>fallback</>`) is NOT nullish and must not match. */
function isEmptyJsxFragment(node: ts.Node): boolean {
  return (
    ts.isJsxFragment(node) &&
    node.children.every((child) => ts.isJsxText(child) && child.text.trim() === "")
  );
}

/** `true` for a literal `null`, the `undefined` identifier, or an empty JSX fragment — the
 *  spellings of "this branch renders nothing" a JSX-mount ternary uses in this codebase. */
function isNullishBranch(node: ts.Node): boolean {
  return (
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) && node.text === "undefined") ||
    isEmptyJsxFragment(node)
  );
}

/** Whether ANY JSX element in this subtree (including the subtree's own root) carries
 *  `role="status"` or an `aria-live` attribute — the two markers `field.tsx`/the islands use
 *  for a live-region status node. */
function containsStatusOrLiveNode(root: ts.Node): boolean {
  return jsxElements(root).some(
    (el) => attrText(el, "role") === "status" || hasAttr(el, "aria-live"),
  );
}

describe("a role=status/aria-live node is never the consequent of a null-alternate conditional (A11Y93-I1 regression class)", () => {
  it.each(ISLAND_FILES)("%s", (relativePath) => {
    const { ast } = parse(relativePath);
    const conditionals = descendants(ast, ts.isConditionalExpression);
    // Positive control: every island in this file DOES use at least one `cond ? x : null`
    // JSX-mount ternary (e.g. `hasErrors ? <FormErrorRegion .../> : null`), so this scan is
    // exercising real matches, not vacuously passing on an empty list.
    const nullAlternateConditionals = conditionals.filter((c) => isNullishBranch(c.whenFalse));
    expect(nullAlternateConditionals.length).toBeGreaterThan(0);

    for (const conditional of nullAlternateConditionals) {
      expect(containsStatusOrLiveNode(conditional.whenTrue)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------
// TEST95-P1 (`Owner's Inbox/pr-review-archive/cografya_web-95.md`): `isNullishBranch` above
// used to recognize only a literal `null` and the `undefined` identifier as "this branch
// renders nothing" — an empty-fragment alternate (`cond ? <p role="status">...</p> : <></>`)
// carries the exact same A11Y93-I1 mount-timing hazard (the status node's role and its first
// content both arrive in the same commit) but went unrecognized, so the real-files scan above
// would have silently skipped a violation shaped this way. No island in this repo writes this
// pattern today, so — the same reasoning the TA93R2-M1 block below gives for its own detector —
// this is a synthetic-fixture positive/negative control, not a real-files scan.
// ---------------------------------------------------------------------------------------

describe("isNullishBranch also recognizes an empty JSX fragment as nullish (TEST95-P1)", () => {
  it("treats `<></>` as a nullish ternary alternate — the revert-to-red case: before the fix this returned false", () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{cond ? <p role="status">done</p> : <></>}</div>;
      }
    `);
    const [conditional] = descendants(ast, ts.isConditionalExpression);
    if (!conditional) throw new Error("unreachable");
    expect(isNullishBranch(conditional.whenFalse)).toBe(true);
  });

  it("treats whitespace-only `<> </>` as nullish too", () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{cond ? <p role="status">done</p> : <> </>}</div>;
      }
    `);
    const [conditional] = descendants(ast, ts.isConditionalExpression);
    if (!conditional) throw new Error("unreachable");
    expect(isNullishBranch(conditional.whenFalse)).toBe(true);
  });

  it("does NOT treat a fragment that wraps real content as nullish (false-positive control)", () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{cond ? <p role="status">done</p> : <>fallback</>}</div>;
      }
    `);
    const [conditional] = descendants(ast, ts.isConditionalExpression);
    if (!conditional) throw new Error("unreachable");
    expect(isNullishBranch(conditional.whenFalse)).toBe(false);
  });

  it("the full null-alternate scan now also flags a status node consequent to an empty-fragment alternate", () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{cond ? <p role="status">done</p> : <></>}</div>;
      }
    `);
    const conditionals = descendants(ast, ts.isConditionalExpression);
    const nullAlternateConditionals = conditionals.filter((c) => isNullishBranch(c.whenFalse));
    expect(nullAlternateConditionals).toHaveLength(1);
    const [conditional] = nullAlternateConditionals;
    if (!conditional) throw new Error("unreachable");
    // This is the same shape A11Y93-I1 fixed for the `null` case — the assertion below is the
    // one the production scan above would run, made explicit here as proof this fixture is
    // exactly the regression class the detector must catch.
    expect(containsStatusOrLiveNode(conditional.whenTrue)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// TA93R2-M1 (`pr-reviews/93-round2.md`): the block above only scans `ts.ConditionalExpression`
// (`cond ? X : null`) — React's other, equally common way to say "render nothing while this
// condition is false" is the short-circuit `&&` mount (`{cond && <p role="status">...}`),
// which TypeScript parses as a `ts.BinaryExpression` (operator `&&`), not a
// `ts.ConditionalExpression`. `&&` has no explicit false branch to compare against — with
// `&&` the JSX right-hand side simply is absent from the DOM until the condition flips true —
// but the underlying hazard is identical to the ternary case above: a status/live-region node
// whose role AND first content both arrive in the SAME commit, so a screen reader gets no
// "something changed" signal to react to. Reuses the same `containsStatusOrLiveNode` helper.
//
// No island in this repo writes this pattern today (confirmed: `grep -n "&&"` over all five
// `*-form.tsx` files below finds only plain boolean guards in `if` conditions / variable
// assignments — never a `cond && <JSX/>` mount), so a scan of the real files alone would pass
// vacuously and a future accidental deletion of the scan body would go unnoticed. The
// synthetic-fixture block below is the positive control: it proves the detector actually
// fires on the shape it exists to catch, using inline source strings that are never read from
// — and never written into — the real component tree.
// ---------------------------------------------------------------------------------------

/** `true` when `node` is a `&&` `ts.BinaryExpression` whose right-hand side contains (or is)
 *  a JSX element carrying `role="status"` or `aria-live` — the short-circuit-mount mirror of
 *  `isNullishBranch`'s ternary check. Unlike the ternary case there is no explicit false
 *  branch to inspect: with `&&`, ANY status/live-region node on the right-hand side is the
 *  same "does not exist until the condition flips true" hazard. */
function isAndGuardedStatusMount(node: ts.Node): node is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
    containsStatusOrLiveNode(node.right)
  );
}

function parseSource(source: string): ts.SourceFile {
  return ts.createSourceFile(
    "synthetic.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

describe("the &&-guarded-status-mount detector fires on the shape it exists to catch (positive control)", () => {
  it('flags `cond && <p role="status">...</p>}`', () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{cond && <p role="status">done</p>}</div>;
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(1);
  });

  it('flags `cond && <p aria-live="polite">...</p>}`', () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return (
          <div>{cond && <p aria-live="polite">done</p>}</div>
        );
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(1);
  });

  it("flags a status node nested deeper inside the &&-guarded subtree, not only a direct child", () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return (
          <div>
            {cond && (
              <section>
                <p role="status">done</p>
              </section>
            )}
          </div>
        );
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(1);
  });

  it("does not flag an ordinary &&-guarded mount with no status/live node — the false-positive control", () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{cond && <p className="note">done</p>}</div>;
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(0);
  });

  it("does not flag a plain boolean &&-guard with no JSX on the right at all", () => {
    const ast = parseSource(`
      function guard(a: boolean, b: boolean) {
        if (a && b) {
          return true;
        }
        return false;
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(0);
  });

  // TEST95-M1 (`Owner's Inbox/pr-review-archive/cografya_web-95.md`): three compound
  // short-circuit shapes the detector already catches today but that carried no committed
  // test of their own — each is added below as its own positive control, the same pattern
  // as the four cases above.

  it('flags `cond2 && <Y role="status">` when it sits inside a ternary\'s alternate branch (`cond ? <X/> : (cond2 && <Y role="status"/>)`)', () => {
    const ast = parseSource(`
      function Demo({ cond, cond2 }: { cond: boolean; cond2: boolean }) {
        return (
          <div>
            {cond ? <p className="note">x</p> : cond2 && <p role="status">done</p>}
          </div>
        );
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(1);
  });

  it('flags a chained `a && b && <Y role="status"/>`', () => {
    const ast = parseSource(`
      function Demo({ a, b }: { a: boolean; b: boolean }) {
        return <div>{a && b && <p role="status">done</p>}</div>;
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(1);
  });

  it('flags `Boolean(cond) && <X role="status"/>`', () => {
    const ast = parseSource(`
      function Demo({ cond }: { cond: boolean }) {
        return <div>{Boolean(cond) && <p role="status">done</p>}</div>;
      }
    `);
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(1);
  });
});

describe("a role=status/aria-live node is never the right-hand side of a && short-circuit mount (TA93R2-M1 regression class)", () => {
  it.each(ISLAND_FILES)("%s", (relativePath) => {
    const { ast } = parse(relativePath);
    // No positive control here on purpose: the review that opened this gap (`TA93R2-M1`)
    // measured zero `cond && <JSX/>` mounts of ANY kind across these five files today (see
    // the block comment above) — a `.toBeGreaterThan(0)` count assertion on the real files
    // would itself fail right now. The synthetic-fixture block above is what proves this
    // scan isn't vacuous instead.
    expect(descendants(ast, isAndGuardedStatusMount)).toHaveLength(0);
  });
});
