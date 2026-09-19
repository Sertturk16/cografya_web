import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";

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
  return stripComments(source).replace(/\s+/g, " ");
}

const BENCH = flatCode(sourceOf("./video-bench.tsx"));
const VIDEO = flatCode(sourceOf("./deneme-video.tsx"));
const PROGRESS_CONTROLS = flatCode(sourceOf("./video-progress-controls.tsx"));
/** The same file, comment-stripped but NOT whitespace-collapsed: `classConstant` reads a
 *  declaration verbatim, and collapsing would fold a two-line class string into one. */
const VIDEO_CONTROLS = stripComments(sourceOf("./video-progress-controls.tsx"));

/**
 * The two CSS-shape cases below used to parse `book-video.module.css`. T-033 task 7 deleted it
 * — its 19 raw Terra-token reads were frozen at light values — so the declarations they pinned
 * are hoisted Tailwind constants now, read through `lib/test-support/converted-floor.ts`. That
 * extractor returns `null` for a value left inline on a `className` rather than hoisted, and
 * says nothing when it does, so every reading below rules the `null` out first.
 */
function classOf(source: string, name: string, file: string): string {
  const found = classConstant(source, name);
  expect(found, `${file} has no top-level ${name} constant`).not.toBeNull();
  return found!;
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
 *  `return ( <div className={PROGRESS_CONTROLS}>` is the next statement after the declaration
 *  and appears nowhere earlier in the file — the component's own hoisted class constant shares
 *  that name, and the marker is searched for INSIDE the source text rather than evaluated, so
 *  the two never meet. */
function handleToggleBody(): string {
  const start = PROGRESS_CONTROLS.indexOf("async function handleToggle()");
  const end = PROGRESS_CONTROLS.indexOf("return ( <div className={PROGRESS_CONTROLS}>");
  return start < 0 || end < 0 || end <= start ? "" : PROGRESS_CONTROLS.slice(start, end);
}

describe("the login gate (§5.3.2)", () => {
  // P2 (§10) gave the delegated handler a SECOND, earlier `if (authState !== "authenticated")`
  // — the external "watch on YouTube" control's own gate, inside the `!video.playable` branch.
  // The assertions below are about the PLAYABLE path's gate specifically (the one that reaches
  // `openVideo`), so they anchor past `const raw = trigger.dataset.second;`, which only exists
  // in that branch, rather than finding the first (external) occurrence by accident.
  function playableBranch(handler: string): string {
    const start = handler.indexOf("const raw = trigger.dataset.second;");
    return start < 0 ? "" : handler.slice(start);
  }

  it("checks authState before ever calling openVideo", () => {
    const handler = clickHandler();
    expect(handler).not.toBe("");
    const playable = playableBranch(handler);
    expect(playable).not.toBe("");
    const gate = playable.indexOf('if (authState !== "authenticated")');
    const openCall = playable.indexOf("openVideo(orderNo, second)");
    expect(gate).toBeGreaterThan(0);
    expect(openCall).toBeGreaterThan(gate);
  });

  it("treats `checking` the same as `anonymous` — a strict inequality, not an enum match", () => {
    // A gate written as `authState === "anonymous"` would let a `checking` press straight
    // through to `openVideo`.
    expect(BENCH).toContain('if (authState !== "authenticated")');
  });

  it("returns immediately after opening the auth modal, never falling through to openVideo (uyelik-auth-redesign plan §5.6.4, superseding the earlier /kayit redirect)", () => {
    // Position-based, like `deneme-video.src-invariant.test.ts`'s own click-gate checks.
    const handler = clickHandler();
    const playable = playableBranch(handler);
    expect(playable).not.toBe("");
    const gate = playable.indexOf('if (authState !== "authenticated")');
    const requestCall = playable.indexOf('requestAuth("video")', gate);
    const gateReturn = playable.indexOf("return;", requestCall);
    const openCall = playable.indexOf("openVideo(orderNo, second)");
    expect(gate).toBeGreaterThan(0);
    expect(requestCall).toBeGreaterThan(gate);
    expect(gateReturn).toBeGreaterThan(requestCall);
    expect(openCall).toBeGreaterThan(gateReturn);
  });

  it("no longer redirects to /kayit or /giris — the auth modal opens in place instead", () => {
    expect(BENCH).not.toContain('href: "/kayit"');
    expect(BENCH).not.toContain('href: "/giris"');
    expect(BENCH).not.toContain("redirectToSignIn");
  });

  it("applies the fragment and selects the video at GATE time (not deferred to a page the reader never leaves), before opening the modal", () => {
    const handler = clickHandler();
    const playable = playableBranch(handler);
    const gate = playable.indexOf('if (authState !== "authenticated")');
    const applyCall = playable.indexOf("applyFragmentAndSelect(orderNo,", gate);
    const requestCall = playable.indexOf('requestAuth("video")', gate);
    expect(gate).toBeGreaterThan(0);
    expect(applyCall).toBeGreaterThan(gate);
    expect(requestCall).toBeGreaterThan(applyCall);
  });

  it("reads authState from the shared hook exactly once, at the VideoBench level", () => {
    expect(BENCH.match(/useAuthSession\(\)/g)).toHaveLength(1);
  });
});

describe("the resume — deliberately does NOT auto-load the player (plan §5.6.4/§13's one genuine owner-judgment item)", () => {
  it("keeps the request id and the resume target in refs, watches the shared modal store, and consumes exactly once", () => {
    expect(BENCH).toContain("const authRequestId = useRef<string | null>(null);");
    expect(BENCH).toContain("modal.resolvedRequestId !== id");
    expect(BENCH).toContain("if (!consumeResolved(id)) return;");
  });

  it("the resume effect never calls openVideo — only focuses the İzle control", () => {
    // The resume effect is the ONE that follows the click handler's own closing `};` — found
    // by searching forward from the request call inside `onClick`, past that handler's own
    // closing brace, for the next `useEffect(`.
    const requestCall = BENCH.indexOf('requestAuth("video")');
    expect(requestCall).toBeGreaterThan(0);
    const start = BENCH.indexOf("useEffect(() => {", requestCall);
    const end = BENCH.indexOf("[modal.resolvedRequestId]);", start);
    expect(start).toBeGreaterThan(requestCall);
    expect(end).toBeGreaterThan(start);
    const body = BENCH.slice(start, end);
    expect(body).not.toContain("openVideo(");
    expect(body).toContain("data-player-open");
    expect(body).toContain("target?.focus();");
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
    expect(externalBranch).not.toContain("SIGN_IN_CTA");
    expect(VIDEO.slice(externalBranchEnd)).toContain("SIGN_IN_CTA");
  });

  it("always renders the paragraph — an empty node when authenticated, never an omitted one", () => {
    expect(VIDEO).toContain(
      '<p className={SIGN_IN_CTA}>{authState === "authenticated" ? null : signInCtaText}</p>',
    );
  });

  it("is taken out of flow, so its own presence/content never changes FRAME's box height", () => {
    const cta = classOf(VIDEO, "SIGN_IN_CTA", "deneme-video.tsx");
    expect(cta, "SIGN_IN_CTA is back in flow").toContain("absolute");
    expect(cta, "SIGN_IN_CTA was put back in flow by a second position").not.toMatch(
      /\b(relative|static|fixed|sticky)\b/,
    );
    expect(renderSites(VIDEO, "SIGN_IN_CTA")).toBe(1);
    // The `:empty` half: an authenticated reader's `<p>` renders no text node, so the box must
    // stay in the DOM at its fixed size and paint NOTHING — not an empty parchment band across
    // the bottom of the cover.
    expect(cta, "SIGN_IN_CTA lost its :empty rule").toContain("empty:bg-transparent");
  });

  it("swaps the İzle button's own accessible name for a signed-out reader", () => {
    // Nested inside a `resolving` check now (P2 plan §5.3, §10's loading state) — the ternary
    // text itself, not the exact `aria-label={…}` wrapper, is what this invariant is about.
    expect(VIDEO).toContain(
      'authState === "authenticated" ? watchAriaLabel : watchAriaSignedOutLabel',
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

  it("the checked fill stays the OLIVE secondary, not a reverted terracotta primary (İRİS idea B2/video-wall, iris-ideas-small-fix-bundle plan §5.2 — the terracotta İzle overlay button sits directly above this toggle on the same stage)", () => {
    const checked = classOf(
      VIDEO_CONTROLS,
      "WATCHED_TOGGLE_CHECKED",
      "video-progress-controls.tsx",
    );
    expect(checked, "the checked fill is no longer the secondary token").toContain("bg-secondary");
    expect(checked, "the checked fill reverted to the primary token").not.toMatch(/\bbg-primary\b/);
    expect(checked).toContain("text-secondary-foreground");
    expect(checked).toContain("border-secondary");
    // Applied by the component, not merely declared: the toggle composes it onto the Button's
    // own variant classes, so `renderSites` (which matches only a bare `className={NAME}`)
    // cannot see it and the composition is what is asserted instead.
    expect(PROGRESS_CONTROLS).toContain(
      "className={cn(WATCHED_TOGGLE, watched && WATCHED_TOGGLE_CHECKED)}",
    );
  });

  it("restates the checked HOVER fill, because a Tailwind utility no longer outranks the variant's", () => {
    // The retired `.watchedToggle[aria-checked="true"]` was an UNLAYERED CSS-Module selector and
    // therefore beat `buttonVariants`' layered `hover:bg-muted` for free. These are utilities in
    // one layer now, and `tailwind-merge` resolves `hover:bg-muted` against a `hover:` class —
    // not against the resting `bg-secondary` — so a checked toggle would go parchment under the
    // pointer with nothing failing.
    const checked = classOf(
      VIDEO_CONTROLS,
      "WATCHED_TOGGLE_CHECKED",
      "video-progress-controls.tsx",
    );
    // The alternation is what the prose above actually means. A BARE `hover:bg-secondary` would
    // satisfy "the fill is restated" and still be a hover that changes nothing visible — the
    // resting fill, painted again — so the token has to carry an alpha modifier or resolve to
    // the `-strong` member. The group is tried before the bare form.
    const hoverFill = /hover:bg-secondary(?:\/\d{1,3}|-strong)?\b/.exec(checked)?.[0];
    expect(
      hoverFill,
      "the checked hover fill is unstated and the outline variant's will win",
    ).toBeDefined();
    expect(
      hoverFill,
      "the checked hover fill IS the resting fill — hovering would change nothing",
    ).not.toBe("hover:bg-secondary");
    // NOT `brightness-*`. The stylesheet used `filter: brightness(0.88)`, which scales the fill
    // AND the ink: over the frozen white-on-#4f6d30 pair that measured 5.36:1, but over the
    // bridge pair dark mode's `--secondary-foreground` is `--color-ink-dark`, and darkening both
    // leaves 4.39:1 — under AA for a 14px/600 label. `bg-secondary/90` touches only the fill.
    expect(checked, "the brightness filter is back and it fails AA in dark mode").not.toMatch(
      /\bbrightness-/,
    );
  });

  it("keeps the 44px target on the toggle (WCAG 2.2 §2.5.5)", () => {
    expect(classOf(VIDEO_CONTROLS, "WATCHED_TOGGLE", "video-progress-controls.tsx")).toContain(
      "min-h-11",
    );
  });

  it("does not encode the checked state by colour alone", () => {
    // `docs/design.md`'s last colour rule. The glyph pairs with the fill, so the state still
    // reads for someone who cannot distinguish the two fills; the control's accessible name
    // carries it for everyone else through two distinct aria-labels.
    expect(
      classOf(VIDEO_CONTROLS, "WATCHED_TOGGLE_CHECKED", "video-progress-controls.tsx"),
    ).toContain("before:content-");
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
