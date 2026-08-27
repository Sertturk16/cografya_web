import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN, for the same reason `components/book/video-progress.structure.test.ts`
 * already gives (UYELIK-08 plan §11): this repo's vitest environment is a bare `node`
 * environment with no jsdom (`FU-WEB-JSDOM`), so `FavoriteButton`'s accessible shape and its
 * optimistic-update-then-rollback handler cannot be rendered and asserted on directly. The
 * source shape is the cheap half that is available.
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

const BUTTON = flatCode(sourceOf("./favorite-button.tsx"));
/** CSS comments use only the C-style form — the `video-progress.structure.test.ts` precedent. */
const STYLES = sourceOf("./favorite-button.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");

/** Escapes every regex-special character in `selector` — needed here because, unlike the
 *  `video-progress.structure.test.ts` precedent this is modelled on (which only ever calls
 *  this helper with a bare class name), `FavoriteButton`'s checked-state selector carries an
 *  attribute matcher (`[aria-checked="true"]`) whose own brackets/quotes would otherwise be
 *  read as regex syntax rather than literal characters. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declaredValues(selector: string, property: string): string[] {
  const pattern = escapeRegExp(selector);
  return [...STYLES.matchAll(new RegExp(`${pattern}\\s*\\{([^}]*)\\}`, "g"))].flatMap((rule) =>
    [...(rule[1] ?? "").matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "g"))].map(
      (declaration) => (declaration[1] ?? "").trim(),
    ),
  );
}

/** Isolates `handleClick` from `BUTTON`, the same position-based slicing
 *  `video-progress.structure.test.ts`'s `handleToggleBody()` uses. `return ( <div
 *  className={styles.wrapper}>` is the next statement after the declaration and appears
 *  nowhere earlier in the file. */
function handleClickBody(): string {
  const start = BUTTON.indexOf("async function handleClick()");
  const end = BUTTON.indexOf("return ( <div className={styles.wrapper}>");
  return start < 0 || end < 0 || end <= start ? "" : BUTTON.slice(start, end);
}

describe("the WAI-ARIA switch shape (§5.4)", () => {
  it('uses role="switch" rather than a bare unlabelled button', () => {
    expect(BUTTON).toContain('role="switch"');
  });

  it("carries aria-checked bound to the favorited state", () => {
    expect(BUTTON).toContain("aria-checked={favorited}");
  });

  it("uses aria-disabled={pending} on the toggle, never a literal disabled={pending} (the same `TEST90R2-I1` lesson `VideoProgressControls` fixed)", () => {
    expect(BUTTON).toContain("aria-disabled={pending}");
    expect(BUTTON).not.toMatch(/(?<!aria-)disabled=\{pending\}/);
  });

  it("stays a real element in every auth state — never returns null for an anonymous reader (deliberate divergence from VideoProgressControls)", () => {
    expect(BUTTON).not.toMatch(/authState\s*!==\s*"authenticated"\)\s*return\s*null/);
  });
});

describe("the click handler (§5.4)", () => {
  it("refuses a second activation while a save is already pending", () => {
    const body = handleClickBody();
    expect(body).not.toBe("");
    expect(body).toContain("if (pending) return;");
  });

  it("the pending guard is the FIRST statement in the handler", () => {
    const body = handleClickBody();
    const guard = body.indexOf("if (pending) return;");
    const gateCheck = body.indexOf('authState !== "authenticated"');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(gateCheck).toBeGreaterThan(guard);
  });

  it("routes an unauthenticated click to /kayit with a returnTo, never spending a save call", () => {
    const body = handleClickBody();
    const gate = body.indexOf('if (authState !== "authenticated")');
    const target = body.indexOf('href: "/kayit"');
    const ret = body.indexOf("return;", target);
    expect(gate).toBeGreaterThan(0);
    expect(target).toBeGreaterThan(gate);
    expect(ret).toBeGreaterThan(target);
  });

  it("sets the optimistic favorited value BEFORE awaiting the save/remove call, not after", () => {
    const body = handleClickBody();
    const optimistic = body.indexOf("setFavorited(next)");
    const awaitCall = body.indexOf("await saveFavorite(target) : await removeFavorite(target)");
    expect(optimistic).toBeGreaterThan(0);
    expect(awaitCall).toBeGreaterThan(optimistic);
  });

  it("rolls back to the pre-click value inside the !result.ok branch (the Acceptance Criteria's own requirement)", () => {
    const body = handleClickBody();
    const failBranch = body.indexOf("if (!result.ok)");
    const rollback = body.indexOf("setFavorited(!next)", failBranch);
    expect(failBranch).toBeGreaterThan(0);
    expect(rollback).toBeGreaterThan(failBranch);
  });

  it("clears any previous save-failed flag at the start of an authenticated click, never leaving a stale error visible", () => {
    const body = handleClickBody();
    const clear = body.indexOf("setSaveFailed(false)");
    const optimistic = body.indexOf("setFavorited(next)");
    expect(clear).toBeGreaterThan(0);
    expect(optimistic).toBeGreaterThan(clear);
  });
});

describe("the checked-state visual treatment is not colour alone (DESIGN.md §5)", () => {
  it("the glyph itself changes between the unchecked and checked state, not merely the fill", () => {
    expect(declaredValues(".toggle::before", "content")).toEqual(['"☆"']);
    expect(declaredValues('.toggle[aria-checked="true"]::before', "content")).toEqual(['"★"']);
  });

  it("the checked state also carries a distinct background, alongside the glyph change", () => {
    expect(declaredValues('.toggle[aria-checked="true"]', "background")).toEqual([
      "var(--color-primary)",
    ]);
  });
});

describe("the error message is a live region, announced to assistive tech (WCAG 4.1.3)", () => {
  it('renders the save-error paragraph with role="status"', () => {
    expect(BUTTON).toContain('role="status"');
  });

  it("the error paragraph is conditional on saveFailed, not always rendered", () => {
    expect(BUTTON).toContain("{saveFailed && (");
  });
});
