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

/** Isolates the fetch-effect's `.then()` callback — from the `fetchFavorites(...)` call
 *  through the closing `.finally(() => clearTimeout(timeout));` that ends the chain, the
 *  same "slice between two unique markers" technique `handleClickBody()` uses. */
function fetchFavoritesThenBody(): string {
  const start = BUTTON.indexOf("fetchFavorites(controller.signal)");
  const end = BUTTON.indexOf(".finally(() => clearTimeout(timeout));");
  return start < 0 || end < 0 || end <= start ? "" : BUTTON.slice(start, end);
}

/** Isolates the `authenticated`-branch `<button>` — from the ternary's `? (` through the
 *  `) : (` that opens the guest branch (A11Y91-I1 fix, PR #91 round 2). */
function authenticatedBranchBody(): string {
  const start = BUTTON.indexOf('authState === "authenticated" ? (');
  const end = BUTTON.indexOf(") : (");
  return start < 0 || end < 0 || end <= start ? "" : BUTTON.slice(start, end);
}

/** Isolates the guest-branch `<button>` — from the ternary's `) : (` through
 *  `{saveFailed && (`, which starts the next sibling after the closing ternary paren. */
function guestBranchBody(): string {
  const start = BUTTON.indexOf(") : (");
  const end = BUTTON.indexOf("{saveFailed && (");
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

describe("A11Y91-I1 fix (PR #91 round 2): switch semantics only in the authenticated branch", () => {
  it('the authenticated branch carries role="switch" and aria-checked bound to favorited', () => {
    const body = authenticatedBranchBody();
    expect(body).not.toBe("");
    expect(body).toContain('role="switch"');
    expect(body).toContain("aria-checked={favorited}");
  });

  it('the guest/checking branch carries NEITHER role="switch" NOR aria-checked — only a plain button', () => {
    const body = guestBranchBody();
    expect(body).not.toBe("");
    expect(body).not.toContain('role="switch"');
    expect(body).not.toContain("aria-checked");
  });

  it("the guest/checking branch still carries the sign-in aria-label, so the accessible name is not lost", () => {
    const body = guestBranchBody();
    expect(body).toContain('aria-label={t("signInRequiredAria")}');
  });

  it("the guest/checking branch renders the shared LockIcon's compact variant (İRİS live-audit A2), wired through the same styles.lockIcon class its own former private definition used", () => {
    const body = guestBranchBody();
    expect(body).toContain('<LockIcon variant="compact" className={styles.lockIcon} />');
    // SIMP96-M2 (`Owner's Inbox/pr-review-archive/cografya_web-96.md`): the icon's own SVG
    // markup — and its aria-hidden/focusable="false" decorative wiring — no longer lives in
    // this file; it moved to the one shared `components/lock-icon.tsx` definition also used by
    // `components/game/game-icons.tsx`. That wiring is asserted directly against the shared
    // component's own rendered output in `components/lock-icon.test.tsx`'s byte-identity
    // regression proof, not scanned from this file's source anymore.
    expect(BUTTON).toContain('import { LockIcon } from "@/components/lock-icon";');
  });
});

describe("CODE91-I1 fix (PR #91 round 2): a stale fetchFavorites cannot overwrite a click", () => {
  it("handleClick marks hasClickedRef BEFORE the auth-gate branch, so it is set on every click including a guest one", () => {
    const body = handleClickBody();
    const pendingGuard = body.indexOf("if (pending) return;");
    const mark = body.indexOf("hasClickedRef.current = true;");
    const gateCheck = body.indexOf('authState !== "authenticated"');
    expect(pendingGuard).toBeGreaterThanOrEqual(0);
    expect(mark).toBeGreaterThan(pendingGuard);
    expect(gateCheck).toBeGreaterThan(mark);
  });

  it("the fetchFavorites success handler bails out once the reader has already clicked, never calling setFavorited(match)", () => {
    const body = fetchFavoritesThenBody();
    expect(body).not.toBe("");
    // The bail-out condition must be checked BEFORE setFavorited(match) is ever reached.
    const guard = body.indexOf("hasClickedRef.current");
    const apply = body.indexOf("setFavorited(match)");
    expect(guard).toBeGreaterThan(0);
    expect(apply).toBeGreaterThan(guard);
    // And the guard must actually gate the early return, not merely appear somewhere in the
    // callback — `if (cancelled || favorites === null || hasClickedRef.current) return;`.
    expect(body).toMatch(
      /if\s*\(\s*cancelled\s*\|\|\s*favorites\s*===\s*null\s*\|\|\s*hasClickedRef\.current\s*\)\s*return;/,
    );
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
