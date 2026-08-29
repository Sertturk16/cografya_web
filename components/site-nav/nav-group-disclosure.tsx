"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import styles from "./site-nav.module.css";

/**
 * A per-group dropdown inside the header's primary navigation ("Haritalar", "Araçlar" —
 * finding 8, `Owner's Inbox/anasayfa-yenileme/plan.md` §5.7b). Reuses `NavDisclosure`'s own
 * proven interaction contract at a smaller, per-group shape rather than generalizing that
 * component: `NavDisclosure`'s `display: contents` / full-panel-becomes-inline-nav swap is
 * specific to becoming the ENTIRE top-level nav, which a per-group trigger never does (plan
 * §5.7b, "Rejected alternative").
 *
 * ## The responsive split is INVERTED from `NavDisclosure`'s, on purpose
 *
 * `NavDisclosure`: below 64rem the trigger is visible and the panel is a real, JS-toggled
 * overlay; at/above 64rem the trigger hides and the panel becomes `display: contents` — always
 * open, inline. This component's shape below the nav-collapse breakpoint (`DESIGN.md` §4) is
 * the mirror image: the trigger `<button>` hides (`.groupTrigger { display: none }`) and the
 * panel is FORCED open (`.groupPanel { display: contents }`) so the group renders as a plain,
 * non-interactive heading (`.groupHeading`, a `<p>` — never an `<h*>` tag, so it does not claim
 * a heading-outline position it does not own, `SEO-POLICY.md` §B3.7) plus its indented links,
 * inline in the already-scrollable mobile panel. At/above the breakpoint the trigger becomes a
 * real button and the panel becomes a real `position: absolute` dropdown, toggled by `open`.
 *
 * ## `children` is the server's, and it NEVER gates behind `open`
 *
 * Exactly `NavDisclosure`'s own invariant (`SEO-POLICY.md` §B8.1/8.2): every link inside a
 * group is a real, unconditional server-rendered `<a href>` present in the first HTML response
 * at every viewport. Below the breakpoint this is what the CSS `display: contents` panel
 * guarantees (the links are never hidden, only whether the FULL-WIDTH mobile panel that
 * contains this group is itself open is `NavDisclosure`'s concern, not this component's). At
 * the breakpoint the dropdown toggles VISIBILITY, never presence.
 *
 * ## The two WebKit `preventDefault()` guards
 *
 * `nav-disclosure.tsx`'s own docblock documents at length why both are required — a real,
 * previously-shipped iOS defect (PR #56 review CR56-C1 / A11Y-1), not defensive padding. The
 * defect's precondition (focus placed on the panel's first link when it opens, then a second
 * link's mousedown racing a synchronous `onBlur`-triggered close) reproduces identically here:
 * this component places focus on its first link when it opens and closes on blur exactly as
 * `NavDisclosure` does, so both guards are carried over unchanged rather than assumed
 * unnecessary at the smaller scale.
 *
 * ## The accessible name does NOT change between open/closed states
 *
 * Unlike the icon-only hamburger, whose visible content carries no text at all,
 * "Haritalar"/"Araçlar" already name what the trigger opens — `aria-expanded` alone
 * communicates state (WAI-ARIA APG dynamic-naming guidance: only a control whose visible label
 * doesn't already name its target needs a second name). So `label` is a single translated
 * string, not an open/closed pair, and this component makes no `next-intl` call of its own —
 * every string it renders (the trigger's `label`, every link inside `children`) arrives
 * already-translated from its server-component caller, keeping this file entirely outside the
 * single-namespace-per-file invariant `components/site-nav/messages.test.ts` enforces on `Nav`
 * consumers.
 */
export function NavGroupDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Set by `close(true)`; consumed after commit so `focus()` never runs on a hidden node. */
  const restoreFocus = useRef(false);
  const panelId = `${useId()}-group-panel`;

  const close = (restore: boolean) => {
    restoreFocus.current = restore;
    setOpen(false);
  };

  // Focus restoration AFTER commit — the same ordering `NavDisclosure` uses and the same bug
  // pattern its docblock cites (PR #45 review C1/I5): running `focus()` inside the handler
  // that hides the target is the defect, not a hardening measure.
  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    buttonRef.current?.focus();
  }, [open]);

  // On opening, focus moves to the first link in the panel — this is what the WebKit guards
  // below exist to protect once a second link is activated.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector("a")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    close(true);
  };

  /**
   * Closes once focus has genuinely left the component. At the mobile width this component's
   * own `open` state never becomes visually meaningful (the panel is forced open by CSS
   * regardless), so this only has a real effect at/above the nav-collapse breakpoint, where the
   * dropdown is a real overlay.
   */
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (restoreFocus.current) return;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    close(false);
  };

  /**
   * THE PANEL'S LINKS DO NOT NAVIGATE IN WEBKIT WITHOUT THIS — identical mechanism to
   * `NavDisclosure`'s own guard, see that file's docblock for the full WebKit
   * `isMouseFocusable()` chain. Scoped to the open state: below the breakpoint `open` never
   * becomes true (the trigger that sets it is `display: none` and unreachable), so this guard
   * costs nothing there.
   */
  const onPanelMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (open) event.preventDefault();
  };

  /** Following a link closes the dropdown and hands focus back to the trigger — `NavDisclosure`'s own pattern, unchanged. */
  const onPanelClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("a")) {
      close(true);
    }
  };

  return (
    <div className={styles.group} onBlur={onBlur} onKeyDown={onKeyDown}>
      {/* Mobile-only, non-interactive: `display: none` from the nav-collapse breakpoint up
          (site-nav.module.css), where the trigger below carries the same text as its own
          accessible name instead. Never an `<h*>` tag — `SEO-POLICY.md` §B3.7 bars a heading
          tag used purely for visual/structural grouping. */}
      <p className={styles.groupHeading}>{label}</p>
      <button
        ref={buttonRef}
        type="button"
        className={styles.groupTrigger}
        aria-expanded={open}
        aria-controls={panelId}
        // WebKit does not mouse-focus form controls at all (bug 254655) — identical rationale
        // to `NavDisclosure`'s trigger guard, applied to this smaller trigger.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        {label}
        <CaretIcon />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={styles.groupPanel}
        data-open={open ? "true" : "false"}
        onMouseDown={onPanelMouseDown}
        onClick={onPanelClick}
      >
        {children}
      </div>
    </div>
  );
}

/** Decorative only — the trigger's own text is the accessible name, not this glyph. */
function CaretIcon() {
  return (
    <svg
      className={styles.groupCaret}
      viewBox="0 0 12 8"
      width="10"
      height="7"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
