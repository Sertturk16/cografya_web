import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * WHAT THE HEADER COMBOBOX KEEPS NOW THAT ITS STYLESHEET IS GONE.
 *
 * T-033 task 5 converted `search-combobox.tsx` to bridge-token utilities and deleted
 * `site-search.module.css`. The floors and the one-ring arrangement this file used to pin
 * (`TRIGGER`, `CLOSE`, `INPUT_ROW`, `INPUT`) belonged to the `variant="default"` rendering path,
 * which no route mounted; T-054 deleted that path and its pins with it. What is left guards the
 * command dialog the header actually renders.
 */

const source = stripComments(
  readFileSync(new URL("./search-combobox.tsx", import.meta.url), "utf8"),
);

/**
 * The stylesheet is gone, and it does not come back through the import it used to arrive by.
 * Anti-vacuity: the reading runs against a source this file really read.
 */
describe("the stylesheet is not reachable from this component any more", () => {
  it("imports no CSS Module and reads no raw Terra token", () => {
    expect(source).not.toMatch(/site-search\.module\.css/);
    expect(source).not.toMatch(/var\(--color-/);
    expect(source.length, "search-combobox.tsx was not read").toBeGreaterThan(5000);
  });
});

/**
 * ONE rendering path. The `variant` prop selected between the command dialog and a second,
 * unmounted panel; with the second gone, a prop reappearing here means a dead branch is back.
 */
describe("the combobox renders one interface", () => {
  it("carries no variant prop", () => {
    expect(source).not.toMatch(/\bvariant\b/);
  });
});

/**
 * THE OVERLAY IS A MODAL DIALOG, AND ITS FOCUS RULES ARE BASE UI'S (T-078).
 *
 * The hand-rolled overlay had three focus defects, all measured in the browser: Tab walked out
 * of it into the page behind, which stayed open underneath; at 390px Escape left focus on
 * `<body>` because the one `triggerRef` pointed at the DESKTOP trigger, `display: none` below
 * `sm`; and `close(restore)` had a parameter every caller passed `true`. The repo's `Dialog`
 * primitive (Base UI) owns the trap, Escape, outside press and focus return, so the component
 * keeps only what is specific to it. Real interaction is a browser question; these pins keep
 * the source from drifting back to the hand-rolled shape.
 */
describe("the search overlay is the repo's modal Dialog primitive", () => {
  it("is built from components/ui/dialog, not a hand-made portal", () => {
    expect(source).toMatch(/from "@\/components\/ui\/dialog"/);
    expect(source).toMatch(/<Dialog\b[^>]*\bopen=\{open\}/);
    expect(source).toMatch(/<DialogPortal\b/);
    expect(source).toMatch(/<DialogPopup\b/);
    expect(source).not.toMatch(/createPortal/);
    expect(source).not.toMatch(/react-dom/);
  });

  it("announces itself as a named modal dialog", () => {
    const popup = source.match(/<DialogPopup\b[\s\S]*?>/)?.[0] ?? "";
    expect(popup, "DialogPopup opening tag").not.toBe("");
    expect(popup).toMatch(/aria-modal="true"/);
    expect(popup).toMatch(/aria-label=\{t\("label"\)\}/);
  });

  it("opens with the caret in the input and returns focus through focusReturnTarget", () => {
    const popup = source.match(/<DialogPopup\b[\s\S]*?>/)?.[0] ?? "";
    expect(popup).toMatch(/initialFocus=\{inputRef\}/);
    expect(popup).toMatch(/finalFocus=\{returnFocus\}/);
    expect(source).toMatch(/from "@\/lib\/search\/focus-return"/);
    expect(source).toMatch(/focusReturnTarget\(\[/);
  });

  it("makes BOTH triggers dialog triggers, each with its own ref", () => {
    const triggers = source.match(/<DialogTrigger\b[\s\S]*?>/g) ?? [];
    expect(triggers).toHaveLength(2);
    const [desktop, mobile] = triggers;
    expect(desktop).toMatch(/data-testid="global-search"/);
    expect(desktop).toMatch(/ref=\{desktopTriggerRef\}/);
    expect(mobile).toMatch(/data-testid="global-search-mobile"/);
    expect(mobile).toMatch(/ref=\{mobileTriggerRef\}/);
    // The one shared ref that pointed at the hidden desktop trigger is what lost focus at 390px.
    expect(source).not.toMatch(/\btriggerRef\b/);
  });

  it("reports the open state on both triggers, however the dialog was opened (T-082)", () => {
    // Base UI sets `aria-expanded` only on the trigger that OPENED the dialog; Ctrl/Cmd+K opens
    // it through the controlled `open` with no trigger, so both reported `false` while it was
    // open. The explicit prop comes after Base UI's in the merge and follows `open` itself.
    const triggers = source.match(/<DialogTrigger\b[\s\S]*?>/g) ?? [];
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) expect(trigger).toMatch(/aria-expanded=\{open\}/);
  });

  it("closes through Base UI's Close part, and leaves Escape to the primitive", () => {
    expect(source).toMatch(/<DialogClose\b/);
    // A hand-rolled Escape handler would duplicate the primitive's and, with a
    // `stopPropagation`, starve its document listener.
    expect(source).not.toMatch(/"Escape"/);
  });

  it("has no dead focus-restore flag: close() takes no argument", () => {
    expect(source).not.toMatch(/\brestore\b/);
    expect(source).not.toMatch(/restoreFocus/);
    expect(source).not.toMatch(/\bclose\([^)]/);
  });
});
