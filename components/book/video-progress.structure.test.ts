import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN, for the same reason `deneme-video.src-invariant.test.ts` and
 * `bench.structure.test.ts` already give: this repo's vitest environment is a bare `node`
 * environment with no jsdom (`FU-WEB-JSDOM`), so none of the three UYELIK-06 invariants below —
 * the login gate never reaching `openVideo`, the CTA's reserved box, the watched toggle's
 * accessible shape — can be rendered and asserted on directly. The source shape is the cheap
 * half that is available (§11: "the click-gate refusing to call `openVideo`...; the CTA/toggle
 * reserved-box invariant... — the same style of structural assertion `bench.structure.test.ts`
 * already runs for the stage's existing reserved boxes").
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

const BENCH = flatCode(sourceOf("./video-bench.tsx"));
const VIDEO = flatCode(sourceOf("./deneme-video.tsx"));
const PROGRESS_CONTROLS = flatCode(sourceOf("./video-progress-controls.tsx"));
/** CSS comments use only the C-style form — the `bench.structure.test.ts` precedent. */
const STYLES = sourceOf("./book-video.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");

function declaredValues(selector: string, property: string): string[] {
  return [...STYLES.matchAll(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, "g"))].flatMap((rule) =>
    [...(rule[1] ?? "").matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "g"))].map(
      (declaration) => (declaration[1] ?? "").trim(),
    ),
  );
}

function clickHandler(): string {
  const start = BENCH.indexOf("const onClick = (event");
  const end = BENCH.indexOf("return ( <div ref={rootRef}");
  return start < 0 || end < 0 || end <= start ? "" : BENCH.slice(start, end);
}

/** Isolates `saveNow` (§5.5 trigger 1/2, the periodic-save/pause-save body) from `VIDEO`, the
 *  same position-based slicing `clickHandler()` above already uses for `BENCH`. `loadIframeApi()`
 *  is the next statement after the `const saveNow = () => { ... };` declaration and appears
 *  nowhere earlier in the file (its only other mention is the bare import specifier, which has no
 *  trailing `()`), so it is a safe, unique end marker. */
function saveNowBody(): string {
  const start = VIDEO.indexOf("const saveNow = () =>");
  const end = VIDEO.indexOf("loadIframeApi()");
  return start < 0 || end < 0 || end <= start ? "" : VIDEO.slice(start, end);
}

/** Isolates `handleVisibilityChange` (§5.5 trigger 3, the tab-hide save) from `VIDEO` the same
 *  way. `document.addEventListener("visibilitychange"` is the next statement after the
 *  declaration and is unique up to that point (the matching `removeEventListener` call comes
 *  later, past this slice's end). */
function visibilityChangeBody(): string {
  const start = VIDEO.indexOf("const handleVisibilityChange = () =>");
  const end = VIDEO.indexOf('document.addEventListener("visibilitychange"');
  return start < 0 || end < 0 || end <= start ? "" : VIDEO.slice(start, end);
}

/** Isolates `handleToggle` (§5.6, PR #90 review `TEST90R2-I1`) from `PROGRESS_CONTROLS`, the
 *  same position-based slicing `saveNowBody()`/`visibilityChangeBody()` above use for `VIDEO`.
 *  `return ( <div className={styles.progressControls}>` is the next statement after the
 *  declaration and appears nowhere earlier in the file. */
function handleToggleBody(): string {
  const start = PROGRESS_CONTROLS.indexOf("async function handleToggle()");
  const end = PROGRESS_CONTROLS.indexOf("return ( <div className={styles.progressControls}>");
  return start < 0 || end < 0 || end <= start ? "" : PROGRESS_CONTROLS.slice(start, end);
}

describe("the login gate (§5.3.2)", () => {
  it("checks authState before ever calling openVideo", () => {
    const handler = clickHandler();
    expect(handler).not.toBe("");
    const gate = handler.indexOf('if (authState !== "authenticated")');
    const openCall = handler.indexOf("openVideo(denemeNo, second)");
    expect(gate).toBeGreaterThan(0);
    expect(openCall).toBeGreaterThan(gate);
  });

  it("treats `checking` the same as `anonymous` — a strict inequality, not an enum match", () => {
    // A gate written as `authState === "anonymous"` would let a `checking` press straight
    // through to `openVideo`.
    expect(BENCH).toContain('if (authState !== "authenticated")');
  });

  it("returns immediately after redirecting, never falling through to openVideo", () => {
    // Position-based, like `deneme-video.src-invariant.test.ts`'s own click-gate checks — a
    // single regex over the call would have to balance `redirectToSignIn(...)`'s own nested
    // parentheses (it forwards `trigger.getAttribute("href")`), which a naive `[^)]*` cannot.
    const handler = clickHandler();
    const gate = handler.indexOf('if (authState !== "authenticated")');
    const redirectCall = handler.indexOf("redirectToSignIn(", gate);
    const gateReturn = handler.indexOf("return;", redirectCall);
    const openCall = handler.indexOf("openVideo(denemeNo, second)");
    expect(gate).toBeGreaterThan(0);
    expect(redirectCall).toBeGreaterThan(gate);
    expect(gateReturn).toBeGreaterThan(redirectCall);
    expect(openCall).toBeGreaterThan(gateReturn);
  });

  it('redirects to /kayit — AK-48\'s own "become a member" framing, not /giris', () => {
    expect(BENCH).toContain('href: "/kayit"');
    expect(BENCH).not.toContain('href: "/giris"');
  });

  it("reads authState from the shared hook exactly once, at the VideoBench level", () => {
    expect(BENCH.match(/useAuthSession\(\)/g)).toHaveLength(1);
  });
});

describe("the resume-second priority (§5.4)", () => {
  it("only applies when the press carries no explicit data-second", () => {
    const handler = clickHandler();
    const explicitBranch = handler.indexOf("if (raw !== undefined)");
    const resumeCall = handler.indexOf("resolveIzleStartSecond(");
    expect(explicitBranch).toBeGreaterThan(0);
    expect(resumeCall).toBeGreaterThan(explicitBranch);
    // The resume call sits in the else branch of the same if/else — never inside the explicit
    // branch itself, which would let a saved position override a real deep link.
    const elseIndex = handler.indexOf("} else {", explicitBranch);
    expect(elseIndex).toBeGreaterThan(0);
    expect(resumeCall).toBeGreaterThan(elseIndex);
  });
});

describe("the sign-in CTA's reserved box (§5.3.4)", () => {
  it("renders in the rich/typographic branch only, not the external outbound-link branch", () => {
    const externalBranchStart = VIDEO.indexOf("if (!video.playable)");
    const externalBranchEnd = VIDEO.indexOf("const rich = video.rich;");
    expect(externalBranchStart).toBeGreaterThan(0);
    expect(externalBranchEnd).toBeGreaterThan(externalBranchStart);
    const externalBranch = VIDEO.slice(externalBranchStart, externalBranchEnd);
    expect(externalBranch).not.toContain("styles.signInCta");
    expect(VIDEO.slice(externalBranchEnd)).toContain("styles.signInCta");
  });

  it("always renders the paragraph — an empty node when authenticated, never an omitted one", () => {
    expect(VIDEO).toContain(
      '<p className={styles.signInCta}>{authState === "authenticated" ? null : signInCtaText}</p>',
    );
  });

  it("is taken out of flow, so its own presence/content never changes .frame's box height", () => {
    expect(declaredValues(".signInCta", "position")).toEqual(["absolute"]);
  });

  it("swaps the İzle button's own accessible name for a signed-out reader", () => {
    expect(VIDEO).toContain(
      'aria-label={authState === "authenticated" ? watchAriaLabel : watchAriaSignedOutLabel}',
    );
  });
});

describe("the watched toggle (§5.6)", () => {
  it("renders nothing for anonymous/checking readers", () => {
    expect(PROGRESS_CONTROLS).toContain('if (authState !== "authenticated") return null;');
  });

  it("uses the WAI-ARIA switch pattern rather than a bare unlabelled button", () => {
    expect(PROGRESS_CONTROLS).toContain('role="switch"');
    expect(PROGRESS_CONTROLS).toContain("aria-checked={watched}");
  });

  it("defaults to unchecked for both a not-yet-fetched and a still-loading progress state", () => {
    expect(PROGRESS_CONTROLS).toContain("const watched = known?.watched ?? false;");
  });

  it("never shows a resume line for an exactly-zero saved position", () => {
    expect(PROGRESS_CONTROLS).toContain("known.lastPositionSeconds > 0");
  });

  it("uses aria-disabled={pending} on the toggle button, never a literal disabled={pending} (PR #90 review `TEST90R2-I1`)", () => {
    // A truly `disabled` button is dropped from the Tab sequence and blurred by the browser
    // the instant the attribute flips — exactly the WCAG focus-loss regression `A11Y90-I3`
    // fixed. The lookbehind rejects only the bare form; it still matches the `aria-` prefix.
    expect(PROGRESS_CONTROLS).toContain("aria-disabled={pending}");
    expect(PROGRESS_CONTROLS).not.toMatch(/(?<!aria-)disabled=\{pending\}/);
  });

  it("handleToggle refuses a second activation while a save is already pending (PR #90 review `TEST90R2-I1`)", () => {
    // `aria-disabled`, unlike `disabled`, does not stop the browser from firing click/Enter/
    // Space on its own — the component has to refuse the second activation itself.
    const body = handleToggleBody();
    expect(body).not.toBe("");
    expect(body).toContain("if (pending) return;");
  });
});

describe("the playback-triggered saves carry watchedRef.current forward (§5.5/§5.6, PR #90 review `TEST90-I1`)", () => {
  // The plan's own full-state-replace hazard (§5.5/§5.6, §10): `watched` may be written ONLY by
  // the toggle in `VideoProgressControls`, never by a playback-telemetry save. `saveNow` and
  // `handleVisibilityChange` are the two call sites `lib/video-progress/client.test.ts`'s
  // `buildWatchedTogglePayload` coverage does not reach — that suite only guards the toggle's own
  // call site (`video-bench.tsx`'s `saveWatched`). A regression here (`watchedRef.current` swapped
  // for the closed-over `watched` prop, or for a literal `false`) compiles, passes lint, and every
  // OTHER test in the 3198-strong suite stays green while every periodic/pause/tab-hide save
  // silently resets the reader's watched flag.

  it("saveNow sends watchedRef.current, never a literal false or the closed-over watched prop", () => {
    const body = saveNowBody();
    expect(body).not.toBe("");
    expect(body).toContain("watched: watchedRef.current");
    expect(body).not.toMatch(/watched:\s*false\b/);
    // `\b` after the second `watched` rejects `watched: watched` while still matching
    // `watched: watchedRef.current` (no word boundary between the "d" of "watched" and the "R"
    // of "Ref").
    expect(body).not.toMatch(/watched:\s*watched\b/);
  });

  it("handleVisibilityChange sends watchedRef.current, never a literal false or the closed-over watched prop", () => {
    const body = visibilityChangeBody();
    expect(body).not.toBe("");
    expect(body).toContain("watched: watchedRef.current");
    expect(body).not.toMatch(/watched:\s*false\b/);
    expect(body).not.toMatch(/watched:\s*watched\b/);
  });
});
