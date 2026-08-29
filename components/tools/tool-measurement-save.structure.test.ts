import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN, the same reason `components/favorites/favorite-button.structure.test.ts`/
 * `components/game/game-round-save.structure.test.ts` already give (UYELIK-12 plan §11):
 * this repo's vitest environment is a bare `node` environment with no jsdom
 * (`FU-WEB-JSDOM`), so `ToolMeasurementSave`'s accessible shape and its save/retry handler
 * cannot be rendered and asserted on directly. The source shape is the cheap half that is
 * available.
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

const CONTROL = flatCode(sourceOf("./tool-measurement-save.tsx"));

function handleClickBody(): string {
  const start = CONTROL.indexOf("async function handleClick()");
  const end = CONTROL.indexOf("const pending =");
  return start < 0 || end < 0 || end <= start ? "" : CONTROL.slice(start, end);
}

/** Isolates `resume()` — the interrupted action shared by the authenticated click path and
 *  the resume effect (uyelik-auth-redesign plan §5.6.3) — the same slicing technique. */
function resumeBody(): string {
  const start = CONTROL.indexOf("const resume = useCallback(async () => {");
  const end = CONTROL.indexOf("[belowMinPoints, mode, onSaved, pendingSaveIdRef, points, title]");
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

describe("the save-attempt id lifecycle this control relies on (plan §10 item 1)", () => {
  it("reads the pending save id via the ref prop and generates a fresh one ONLY when null", () => {
    const body = resumeBody();
    expect(body).not.toBe("");
    expect(body).toContain("pendingSaveIdRef.current");
    expect(body).toContain("crypto.randomUUID()");
    const readIdx = body.indexOf("pendingSaveIdRef.current");
    const nullCheck = body.indexOf("=== null", readIdx);
    const generate = body.indexOf("crypto.randomUUID()", readIdx);
    expect(nullCheck).toBeGreaterThan(readIdx);
    expect(generate).toBeGreaterThan(nullCheck);
  });

  it("passes the SAME id (not a freshly-generated one unconditionally) into saveMeasurement", () => {
    const body = resumeBody();
    const call = body.indexOf("saveMeasurement({");
    const payload = body.slice(call, body.indexOf("});", call));
    expect(payload).toContain("clientMeasurementId,");
  });

  it("never clears the pending save id on a failure branch (quota or generic) (SIMP100-M1: via the ref directly, no getter/setter closures)", () => {
    const body = resumeBody();
    expect(body).not.toContain("pendingSaveIdRef.current = null");
  });
});

describe("CODE100-M1: a same-geometry retry that silently replays an earlier title is detected, not trusted blind", () => {
  it("computes submittedTitle from the SAME trimmed value handed to saveMeasurement, never the raw title state", () => {
    const body = resumeBody();
    expect(body).toContain("title.trim()");
    const idx = body.indexOf("const submittedTitle");
    expect(idx).toBeGreaterThan(0);
    expect(body.slice(idx, idx + 120)).toContain("trimmedTitle.length > 0 ? trimmedTitle : null");
  });

  it("compares the api's returned title against submittedTitle on every successful save, not only a suspected retry", () => {
    const body = resumeBody();
    const okIdx = body.indexOf("if (result.ok)");
    expect(okIdx).toBeGreaterThan(0);
    const okBranch = body.slice(okIdx, body.indexOf("return;", okIdx));
    expect(okBranch).toContain("setTitleMismatch(result.measurement.title !== submittedTitle)");
  });
});

describe("the title is trimmed and never sent empty or null on create", () => {
  it("omits title when the trimmed value is empty, never sends an empty string or null", () => {
    const body = resumeBody();
    expect(body).toContain("title.trim()");
    expect(body).toMatch(/trimmedTitle\.length > 0 \? trimmedTitle : undefined/);
  });
});

describe("the pending/settled/checking guard is the FIRST statement in handleClick", () => {
  it("refuses a second activation while checking, pending, already saved, or below minPoints", () => {
    const body = handleClickBody();
    expect(body).not.toBe("");
    const guardText =
      'if (authState === "checking" || status === "pending" || status === "saved" || belowMinPoints) { return; }';
    expect(body.replace(/\s+/g, " ")).toContain(guardText);
    const afterOpenBrace = body.slice(body.indexOf("{") + 1).trim();
    expect(afterOpenBrace.startsWith("if (")).toBe(true);
    const anonymousCheck = body.indexOf('authState === "anonymous"');
    const guardIdx = body.indexOf("belowMinPoints");
    expect(anonymousCheck).toBeGreaterThan(guardIdx);
  });

  it("opens the auth modal (requestAuth) on an anonymous click, never spending a save call (uyelik-auth-redesign plan §5.6.3, superseding the earlier /kayit redirect — the case §2.4 measured as genuinely impossible before)", () => {
    const body = handleClickBody();
    const gate = body.indexOf('if (authState === "anonymous")');
    const request = body.indexOf('requestAuth("measurement")');
    const ret = body.indexOf("return;", request);
    const resumeCall = body.indexOf("await resume();");
    expect(gate).toBeGreaterThan(0);
    expect(request).toBeGreaterThan(gate);
    expect(ret).toBeGreaterThan(request);
    expect(resumeCall).toBeGreaterThan(ret);
  });

  it("no longer imports next/navigation's useRouter or i18n's getPathname — there is no page to redirect to", () => {
    expect(CONTROL).not.toContain('from "next/navigation"');
    expect(CONTROL).not.toContain("getPathname");
    expect(CONTROL).not.toContain('href: "/kayit"');
  });
});

describe("the resume mechanism (uyelik-auth-redesign plan §5.6.3) — the case §2.4 shows is impossible under the old redirect design", () => {
  it("keeps the request id in a ref, watches the shared modal store, and consumes exactly once before resuming", () => {
    expect(CONTROL).toContain("const authRequestId = useRef<string | null>(null);");
    expect(CONTROL).toContain("modal.resolvedRequestId !== id");
    expect(CONTROL).toContain("if (!consumeResolved(id)) return;");
    expect(CONTROL).toContain("void resume();");
  });

  it("resume() re-reads points/belowMinPoints at CALL TIME rather than a ref-captured snapshot — closes over the render's own points, never hoisted out of the component body", () => {
    const start = CONTROL.indexOf("const resume = useCallback(async () => {");
    expect(start).toBeGreaterThan(0);
    const end = CONTROL.indexOf("[belowMinPoints, mode, onSaved, pendingSaveIdRef, points, title]");
    expect(end).toBeGreaterThan(start);
    const body = CONTROL.slice(start, end);
    expect(body).toContain("if (belowMinPoints) return;");
    expect(body).toContain("points,");
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

describe("the anonymous branch", () => {
  it("renders the lock cue and the sign-in aria-label, never role=switch", () => {
    const body = anonymousBranchBody();
    expect(body).not.toBe("");
    expect(body).toContain("<LockIcon");
    expect(body).toContain('variant="compact"');
    expect(body).toContain('aria-label={t("signInRequiredAria")}');
    expect(body).not.toContain("role=");
  });
});

describe("the saved branch — a genuine, permanent outcome", () => {
  it("uses aria-disabled, NEVER a real disabled attribute (A11Y96-I1)", () => {
    const body = savedBranchBody();
    expect(body).not.toBe("");
    expect(body).toContain("aria-disabled={true}");
    expect(body).not.toMatch(/<button[^>]*[\s"]disabled(?:[\s>]|=\{)/);
  });

  it("announces the plain save-succeeded fact via a dedicated sr-only role=status region ONLY when the title matches (CODE100-M1 splits this from the mismatch case below)", () => {
    expect(CONTROL).toContain("{saved && !titleMismatch && (");
    const start = CONTROL.indexOf("{saved && !titleMismatch && (");
    const end = CONTROL.indexOf("{saved && titleMismatch && (");
    expect(end).toBeGreaterThan(start);
    const announcement = CONTROL.slice(start, end);
    expect(announcement).toContain('role="status"');
    expect(announcement).toContain('t("savedLabel")');
  });

  it("surfaces a distinct, VISIBLE role=status message instead of the plain announcement when the api's returned title does not match what was submitted (CODE100-M1)", () => {
    expect(CONTROL).toContain("{saved && titleMismatch && (");
    const start = CONTROL.indexOf("{saved && titleMismatch && (");
    const end = CONTROL.indexOf('{status === "failed" &&');
    expect(end).toBeGreaterThan(start);
    const region = CONTROL.slice(start, end);
    expect(region).toContain('role="status"');
    expect(region).toContain('t("saveTitleMismatch")');
    expect(region).not.toContain("styles.srOnly");
  });
});

describe("aria-disabled on the clickable button folds belowMinPoints into the same boolean as pending (plan §5.5)", () => {
  it("the final (authenticated, unsaved) branch's button is aria-disabled on pending OR belowMinPoints", () => {
    expect(CONTROL).toContain("aria-disabled={pending || belowMinPoints}");
  });
});

describe("the quota-exceeded state is distinct copy from the generic failure (plan §5.5/§10 item 2)", () => {
  it('renders a dedicated role="status" paragraph only when status === "quota-exceeded", using saveQuotaError not saveError', () => {
    expect(CONTROL).toContain('status === "quota-exceeded" &&');
    const start = CONTROL.indexOf('{status === "quota-exceeded" &&');
    const region = CONTROL.slice(start, start + 200);
    expect(region).toContain('role="status"');
    expect(region).toContain('t("saveQuotaError")');
  });

  it("maps the quota-exceeded save result to its own status, distinct from the generic failed status", () => {
    expect(CONTROL).toContain('result.code === "quota-exceeded" ? "quota-exceeded" : "failed"');
  });
});

describe('no role="switch" anywhere — this is a one-shot commit, not a toggle', () => {
  it('never uses role="switch" or aria-checked', () => {
    expect(CONTROL).not.toContain('role="switch"');
    expect(CONTROL).not.toContain("aria-checked");
  });
});

describe("the optional title field", () => {
  it("carries a maxLength of 200, matching the contract's own bound", () => {
    expect(CONTROL).toMatch(/maxLength=\{200\}/);
  });

  it("is a controlled input bound to local title state", () => {
    expect(CONTROL).toContain("value={title}");
    expect(CONTROL).toContain("onChange={(event) => setTitle(event.target.value)}");
  });
});
