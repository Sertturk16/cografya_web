import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN, the same reason `components/favorites/favorite-button.structure.test.ts`
 * already gives (UYELIK-10 plan §11): this repo's vitest environment is a bare `node`
 * environment with no jsdom (`FU-WEB-JSDOM`), so `GameRoundSaveControl`'s accessible shape
 * and its one-shot-commit handler cannot be rendered and asserted on directly. The source
 * shape is the cheap half that is available.
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

const CONTROL = flatCode(sourceOf("./game-round-save.tsx"));

function handleClickBody(): string {
  const start = CONTROL.indexOf("async function handleClick()");
  const end = CONTROL.indexOf("const pending =");
  return start < 0 || end < 0 || end <= start ? "" : CONTROL.slice(start, end);
}

function checkingBranchBody(): string {
  const start = CONTROL.indexOf('authState === "checking" ? (');
  const end = CONTROL.indexOf(') : authState === "anonymous"');
  return start < 0 || end < 0 || end <= start ? "" : CONTROL.slice(start, end);
}

function anonymousBranchBody(): string {
  const start = CONTROL.indexOf(') : authState === "anonymous" ? (');
  const end = CONTROL.indexOf(") : saved ? (");
  return start < 0 || end < 0 || end <= start ? "" : CONTROL.slice(start, end);
}

function savedBranchBody(): string {
  const start = CONTROL.indexOf(") : saved ? (");
  const end = CONTROL.indexOf(") : (", CONTROL.indexOf(") : saved ? (") + 1);
  return start < 0 || end < 0 || end <= start ? "" : CONTROL.slice(start, end);
}

describe("the idempotent-retry mechanism this control relies on (plan §10 item 1)", () => {
  it("submits the SAME clientRoundId prop unchanged — never regenerates or mutates it", () => {
    // The prop is destructured directly, never shadowed by a local variable of the same name.
    expect(CONTROL).not.toMatch(/const clientRoundId\s*=/);
    // The payload sent to submitGameRound carries the prop directly.
    const call = CONTROL.indexOf("submitGameRound({");
    const payload = CONTROL.slice(call, CONTROL.indexOf("});", call));
    expect(payload).toContain("clientRoundId,");
    expect(payload).not.toMatch(/clientRoundId\s*:\s*generateId|clientRoundId\s*:\s*crypto/);
  });

  it("never sends completionTimeSeconds — the current engine tracks no clock", () => {
    const call = CONTROL.indexOf("submitGameRound({");
    const payload = CONTROL.slice(call, CONTROL.indexOf("});", call));
    expect(payload).not.toContain("completionTimeSeconds");
  });
});

describe("the pending/settled guard is the FIRST statement in handleClick", () => {
  it("refuses a second activation while checking, pending, or already saved", () => {
    const body = handleClickBody();
    expect(body).not.toBe("");
    const guardText =
      'if (authState === "checking" || status === "pending" || status === "saved") return;';
    expect(body).toContain(guardText);
    // The function's opening brace is followed IMMEDIATELY by the guard — nothing else runs
    // first, which is what "the pending guard is the FIRST statement" actually means.
    const afterOpenBrace = body.slice(body.indexOf("{") + 1).trim();
    expect(afterOpenBrace.startsWith(guardText)).toBe(true);
    const anonymousCheck = body.indexOf('authState === "anonymous"');
    expect(anonymousCheck).toBeGreaterThan(body.indexOf(guardText));
  });

  it("routes an anonymous click to /kayit with a returnTo, never spending a save call", () => {
    const body = handleClickBody();
    const gate = body.indexOf('if (authState === "anonymous")');
    const target = body.indexOf('href: "/kayit"');
    const ret = body.indexOf("return;", target);
    const submit = body.indexOf("submitGameRound(");
    expect(gate).toBeGreaterThan(0);
    expect(target).toBeGreaterThan(gate);
    expect(ret).toBeGreaterThan(target);
    expect(submit).toBeGreaterThan(ret);
  });
});

describe("the checking branch renders in the SAME interactive shape as authenticated-unsaved, never the lock-icon shape", () => {
  it("uses btn-primary and aria-disabled, carries no LockIcon or sign-in aria-label", () => {
    const body = checkingBranchBody();
    expect(body).not.toBe("");
    expect(body).toContain("btn-primary");
    expect(body).toContain("aria-disabled={true}");
    expect(body).not.toContain("LockIcon");
    expect(body).not.toContain("signInRequiredAria");
  });
});

describe("the anonymous branch (§5.6)", () => {
  it("renders the lock cue and the sign-in aria-label, never role=switch", () => {
    const body = anonymousBranchBody();
    expect(body).not.toBe("");
    expect(body).toContain("<LockIcon");
    expect(body).toContain('aria-label={t("signInRequiredAria")}');
    expect(body).not.toContain("role=");
  });

  it("uses btn-ghost, not btn-primary — a lighter-weight affordance than the save action itself", () => {
    const body = anonymousBranchBody();
    expect(body).toContain("btn-ghost");
  });
});

describe("the saved branch — a genuine, permanent outcome", () => {
  it("uses a real disabled attribute, not aria-disabled, and shows the savedLabel", () => {
    const body = savedBranchBody();
    expect(body).not.toBe("");
    expect(body).toMatch(/<button[^>]*\bdisabled\b/);
    expect(body).toContain('t("savedLabel")');
  });
});

describe("the failed state — an inline, conditional live region", () => {
  it('renders role="status" only when status === "failed"', () => {
    expect(CONTROL).toContain('role="status"');
    expect(CONTROL).toContain('status === "failed" &&');
  });

  it("returns the control to its clickable state on failure — clientRoundId is untouched, so a retry is safe", () => {
    // The failed branch is not one of checking/anonymous/saved, so it falls through to the
    // same clickable authenticated-unsaved button as the initial state.
    expect(CONTROL).not.toMatch(/status === "failed" \? \(/);
  });
});

describe('no role="switch" anywhere — this is a one-shot commit, not a toggle (§5.6)', () => {
  it('never uses role="switch" or aria-checked, unlike FavoriteButton', () => {
    expect(CONTROL).not.toContain('role="switch"');
    expect(CONTROL).not.toContain("aria-checked");
  });
});
