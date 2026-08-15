"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./site-nav.module.css";

/**
 * The mobile header's navigation disclosure.
 *
 * ## A disclosure, NOT a modal — and that is what makes it keyboard-safe
 *
 * The panel is a plain container that shows and hides its own content. It carries no
 * `role="dialog"`, no `aria-modal`, no inert backdrop and no focus trap. "Tab must be able to
 * leave the menu" is therefore a property of the mechanism rather than something tested for
 * afterwards: there is nothing here that could hold focus. This mirrors the deliberate choice
 * the header's search island already documents ("the combobox deliberately leaves Tab to the
 * browser").
 *
 * ## The links are the SERVER's, and they never move
 *
 * `children` is a server-rendered `<nav>` carrying one real `<a href>` per hub plus the locale
 * switcher. This island receives it and only toggles a `data-open` attribute; it never
 * builds, rewrites or conditionally renders a link. That is the binding shape of this work
 * (`SEO-POLICY.md` §B8.1/8.2): EVERY hub entry point sits in the first HTML response at every
 * viewport, so the internal link graph is byte-identical to the pre-hamburger header and no
 * crawler has to run JavaScript to find any of them.
 *
 * The set itself is named in exactly one place — `site-nav.tsx`, which builds it — and is
 * deliberately NOT counted or listed again here (→ PR #62 review `CODE62-M1`: this comment
 * said "six" and enumerated five routes while `/kitaplar` was being added in the same commit).
 *
 * Above 64rem the panel is `display: contents` and the button is `display: none`, so this
 * component's state stops having any visual meaning and the desktop nav renders inline
 * exactly as it did before.
 *
 * ## What closes it
 *
 * Escape (focus returns to the button), following a link inside it, and focus leaving the
 * component altogether. The last one is also what keeps the two header panels mutually
 * exclusive without either island knowing the other exists, and the mechanism differs by
 * direction. Reaching for the search trigger moves focus out of this root — in WebKit by
 * clearing it, which the `onBlur` below still reads as "left" — so this panel closes on the
 * press. Reaching for THIS button no longer blurs the search combobox on mousedown, because
 * the button now prevents that default (see the trigger); the search sheet closes one frame
 * later instead, when the open effect above moves focus to this panel's first link and the
 * combobox's own `onBlur` fires. Same outcome, different beat — and it is the open effect,
 * not the button, that carries it. Both sheets anchor to the same header edge, so "both open"
 * would be two overlapping cards.
 *
 * ## No-JS reality, stated rather than implied
 *
 * Below 64rem the panel's closed state is CSS, so a reader with no JavaScript sees the compact
 * header and cannot open the menu. The alternative — rendering the menu open and collapsing it
 * on hydration — trades that for a ~120px layout shift on every page load, which is the defect
 * this whole change exists to remove. The links remain in the document for machines, and for a
 * human the brand link in the first row reaches the homepage, which carries a body link to
 * every one of the five hubs.
 *
 * A THIRD option exists and was evaluated rather than missed (review CR56-M4): native
 * `<details>`/`<summary>`, which is a real zero-JS disclosure and would close the gap above at
 * mobile. It cannot express the desktop half. At 64rem and up the nav must be inline and
 * permanently revealed with no summary, but a CLOSED `<details>` hides its non-summary children
 * through a UA rule that three engines implement differently (`content-visibility` on the
 * details content in current Chromium, historically `display` on the slot), so "always open
 * above 64rem" needs either `open` toggled by JavaScript — the thing it was adopted to remove —
 * or an author override betting on interop, which is exactly what `site-nav.module.css` refuses
 * to do for `position: static`. Rendering a second, desktop-only nav instead would duplicate
 * every hub link in every page's HTML. The trade-off above is therefore kept deliberately.
 */
export function NavDisclosure({ children }: { children: ReactNode }) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Set by `close(true)`; consumed after commit so `focus()` never runs on a hidden node. */
  const restoreFocus = useRef(false);
  const panelId = `${useId()}-panel`;

  const close = (restore: boolean) => {
    restoreFocus.current = restore;
    setOpen(false);
  };

  // Focus restoration AFTER commit: while the panel is open the button is still rendered, but
  // running `focus()` inside the handler that hides the target is the bug pattern the search
  // island already paid for (PR #45 review C1/I5).
  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    buttonRef.current?.focus();
  }, [open]);

  // On opening, focus moves to the first link in the panel. `preventScroll` because the panel
  // hangs off the sticky header and is on screen by construction — the default scroll-into-view
  // would only be able to move the page underneath it.
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
   * Closes once focus has genuinely left the component. Moving between the button and the
   * panel keeps focus inside this root, so the menu survives its own opening; tabbing past the
   * last item, or clicking anywhere else, closes it without moving focus anywhere.
   */
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // A deliberate close (Escape) is already restoring focus through the effect above; the
    // blur it causes must not cancel that by re-closing with `restore: false`.
    if (restoreFocus.current) return;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    close(false);
  };

  /**
   * THE PANEL'S LINKS DO NOT NAVIGATE IN WEBKIT WITHOUT THIS. Not a hardening measure — the
   * defect it removes made every link in this panel dead on every browser on iOS (PR #56
   * review CR56-C1, established by running the chain in a real WebKit build).
   *
   * WebKit does not mouse-focus a plain `<a href>`: `HTMLAnchorElement::isMouseFocusable()`
   * is true only when the anchor carries an explicit `tabindex`. Worse, finding no
   * mouse-focusable node it CLEARS focus rather than leaving it alone. The effect above put
   * focus on the panel's first link, so pressing any other link fires `focusout` FROM that
   * first link with `relatedTarget === null` — and both of `onBlur`'s guards miss it
   * (`restoreFocus` is false; `contains(null)` is false), so `close(false)` runs. `focusout`
   * is DiscreteEventPriority, so React commits `open: false` BEFORE mouseup:
   * `.panel[data-open="true"]` stops matching, the anchor becomes `display: none`, WebKit
   * re-hit-tests mouseup on what is now behind it and dispatches the click on BODY. The URL
   * never changes. Chromium mouse-focuses the anchor, so CI, every desktop review and every
   * rendered sample came back clean.
   *
   * Preventing the mousedown default is what stops it: WebKit runs its focus block only when
   * the event was not swallowed, so nothing is focused, nothing is blurred, no `focusout`
   * fires, and the click reaches the link. This is the same remedy the search × already
   * carries for the sibling half of the same engine bug (`search-combobox.tsx:395-401`),
   * applied to the element that needs it here. The alternative — `tabIndex` on the links —
   * was rejected: `-1` removes all eight links from the tab order (WCAG 2.1.1) and `0` pushes
   * an engine workaround into server-rendered markup on every page at every viewport,
   * including desktop, where no defect exists.
   *
   * SCOPED TO THE OPEN STATE. Normally that means the floating sheet below 64rem; `open` can
   * survive a viewport crossing, though, so the guard may briefly remain active after this
   * element becomes the inline desktop nav. In that stale state it also suppresses mouse
   * focus and drag-to-select until focus leaves this root and `onBlur` closes the panel.
   *
   * The panel therefore carries anchors only. If a mouse-focusable control such as an input
   * or select is added, narrow this guard to anchor targets; otherwise that control would be
   * keyboard-focusable but not mouse-focusable.
   */
  const onPanelMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (open) event.preventDefault();
  };

  /**
   * Following a link closes the menu. It has to be explicit: this island stays mounted across
   * client-side navigations, so without it the panel would still be covering the page the
   * reader just asked for. Scoped to anchors, so a click on the panel's own padding does not
   * dismiss the menu the reader is still reading — a promise that only became TRUE with the
   * mousedown guard above. Before it, padding is not focusable, so pressing it cleared focus
   * in both engines, `onBlur` read the null `relatedTarget` as "focus left" and closed the
   * panel; the comment described the intent rather than the behaviour (review A11Y-5).
   *
   * `close(true)` rather than `close(false)`: the reader activated a link while focus sat on
   * a link inside a panel that is about to become `display: none`, which would drop focus on
   * `<body>` and restart the next Tab from the skip link (review A11Y-4). Handing focus back
   * to the button leaves it on a real control in the header the reader is navigating away
   * from, which is also the search island's pattern.
   */
  const onPanelClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("a")) {
      close(true);
    }
  };

  return (
    <div className={styles.root} onBlur={onBlur} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        // A state-dependent NAME alongside `aria-expanded` is deliberate, not an oversight
        // (review CR56-M3). ARIA APG's disclosure pattern keeps the name fixed; the reason
        // this one does not is written where the pairing is locked —
        // `messages.test.ts` "names the two disclosure states differently": a reader who
        // navigates by name, through a rotor or an element list, never hears `aria-expanded`
        // at all and would meet a control called "open menu" over an open menu.
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        // WebKit does not mouse-focus form controls at all (bug 254655), so pressing this
        // button fires `focusout` from whatever held focus with `relatedTarget === null`.
        // On the search × that only dropped focus; here the control is a TOGGLE that reads
        // `open` at click time, so the root `onBlur` closed the panel first and the click
        // handler then read `open: false` and REOPENED it — the only way to close the
        // primary navigation, broken across the whole iOS install base (review A11Y-1).
        // Preventing the mousedown default keeps focus where it is until `onClick` decides,
        // so `onBlur` never fires and `close(true)` restores focus deliberately. Identical
        // to `search-combobox.tsx:395-401`. Unconditional there and here: with the panel
        // closed there is nothing to close, so the guard costs nothing.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <MenuIcon open={open} />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={styles.panel}
        data-open={open ? "true" : "false"}
        onMouseDown={onPanelMouseDown}
        onClick={onPanelClick}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Decorative: the button carries its own accessible name, which changes with the state. The
 * glyph changes with it so the state is not announced-only — a sighted reader sees an X over
 * an open panel rather than a hamburger that looks unchanged.
 */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      {open ? (
        <>
          <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" />
          <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" />
        </>
      ) : (
        <>
          <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="2" />
          <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2" />
          <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
