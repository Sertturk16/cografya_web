import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * T-165: `useAuthSession()` starts at `"checking"` (always on the server, and on the client until
 * the check answers). A guest branch keyed on `authState !== "authenticated"`, or on the `else` of
 * `authState === "authenticated"`, also runs while checking, so a signed-in reader saw "giriş yap"
 * prompts, lock icons and sign-in banners on every page load.
 *
 * The rule this scan enforces: compare the session with `"anonymous"` for a guest branch and with
 * `"checking"` for the wait. A comparison with the `"authenticated"` literal may only
 * - guard member-only work: `if (x !== "authenticated") return;` (or `return null;`), or
 * - pick the member value against an EMPTY one: `x === "authenticated" ? value : null`
 *   (`undefined`, `""`, `[]` and `false` are empty too).
 * Anything else can fall into a guest branch while checking. The literal is the session state's
 * alone in this repo, so the scan needs no knowledge of variable names.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCANNED = ["app", "components", "lib"];
const SESSION_LITERAL = "authenticated";
const STORE = join("lib", "auth", "use-session.client.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    // The store that defines the states; its `set` branches on each one by name.
    if (relative(ROOT, path) === STORE) return [];
    return [path];
  });
}

function unwrap(node: ts.Node): ts.Node {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isEmpty(node: ts.Node): boolean {
  const value = unwrap(node);
  if (value.kind === ts.SyntaxKind.NullKeyword || value.kind === ts.SyntaxKind.FalseKeyword) {
    return true;
  }
  if (ts.isIdentifier(value) && value.text === "undefined") return true;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return value.text === "";
  }
  return ts.isArrayLiteralExpression(value) && value.elements.length === 0;
}

/** `return;` or `return null;`, alone or as the only statement of a block. */
function isBareReturn(statement: ts.Statement): boolean {
  const only = ts.isBlock(statement)
    ? statement.statements.length === 1
      ? statement.statements[0]
      : undefined
    : statement;
  return (
    only !== undefined &&
    ts.isReturnStatement(only) &&
    (only.expression === undefined || only.expression.kind === ts.SyntaxKind.NullKeyword)
  );
}

/** The expression a comparison decides: climbs parentheses and nothing else. */
function decidingParent(node: ts.Node): ts.Node {
  let child = node;
  while (ts.isParenthesizedExpression(child.parent)) child = child.parent;
  return child.parent;
}

function violation(comparison: ts.BinaryExpression): string | null {
  const op = comparison.operatorToken.kind;
  const negated =
    op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsToken;
  const parent = decidingParent(comparison);

  if (negated) {
    // `if (!open || x !== "authenticated") return;` is the same guard: climb `||` chains.
    let guard: ts.Node = parent;
    while (ts.isBinaryExpression(guard) && guard.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      guard = decidingParent(guard);
    }
    if (ts.isIfStatement(guard) && guard.elseStatement === undefined) {
      if (isBareReturn(guard.thenStatement)) return null;
    }
    return '`!== "authenticated"` outside a member-only `if (…) return;` guard';
  }

  if (ts.isConditionalExpression(parent) && unwrap(parent.condition) === comparison) {
    return isEmpty(parent.whenFalse) ? null : '`=== "authenticated" ? … : <non-empty>`';
  }
  if (ts.isIfStatement(parent) && parent.elseStatement !== undefined) {
    return '`if (x === "authenticated") … else …`';
  }
  return null;
}

function isSessionComparison(node: ts.Node): node is ts.BinaryExpression {
  if (!ts.isBinaryExpression(node)) return false;
  const op = node.operatorToken.kind;
  const isComparison =
    op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    op === ts.SyntaxKind.EqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsToken;
  return (
    isComparison &&
    [unwrap(node.left), unwrap(node.right)].some(
      (side) => ts.isStringLiteral(side) && side.text === SESSION_LITERAL,
    )
  );
}

/** Every rule break in one source text, as `line: why`. */
function scan(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (isSessionComparison(node)) {
      const why = violation(node);
      if (why !== null) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        found.push(`${line + 1}: ${why}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function findViolations(path: string): string[] {
  const text = readFileSync(path, "utf8");
  if (!text.includes(`"${SESSION_LITERAL}"`)) return [];
  return scan(path, text).map((found) => `${relative(ROOT, path)}:${found}`);
}

const scanSnippet = (code: string) => scan("snippet.tsx", code);

describe("the guest-branch rule itself", () => {
  it.each([
    ['const guest = s !== "authenticated";'],
    ['const x = <div>{s !== "authenticated" && <Lock />}</div>;'],
    ['const label = s === "authenticated" ? addAria : signInAria;'],
    ['const label = busy ? a : s === "authenticated" ? addAria : signInAria;'],
    ['function f() { if (s !== "authenticated") { requestAuth("x"); return; } }'],
    ['function f() { if (s === "authenticated") run(); else requestAuth("x"); }'],
    ['function f() { if (!open || s !== "authenticated") { requestAuth("x"); return; } }'],
  ])("flags %s", (code) => {
    expect(scanSnippet(code)).toHaveLength(1);
  });

  it.each([
    ['function f() { if (s !== "authenticated") return; }'],
    ['function f() { if (s !== "authenticated") { return null; } }'],
    ['function f() { if (!open || s !== "authenticated") return; }'],
    ['const p = s === "authenticated" ? progress : null;'],
    ['const k = s === "authenticated" ? id : undefined;'],
    ['const l = s === "authenticated" ? list.filter(Boolean) : [];'],
    ['const a = <p>{s === "authenticated" ? ready : ""}</p>;'],
    ['const x = <div>{s === "authenticated" && <Badge />}</div>;'],
    ['const guest = <div>{s === "anonymous" && <Lock />}</div>;'],
    ['function f() { if (open && s === "authenticated") resolve(); }'],
  ])("allows %s", (code) => {
    expect(scanSnippet(code)).toEqual([]);
  });
});

describe("no session consumer falls into a guest branch while checking (T-165)", () => {
  it('compares with "anonymous" for guest content, never with the else of "authenticated"', () => {
    const violations = SCANNED.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap(
      findViolations,
    );
    expect(violations).toEqual([]);
  });
});
