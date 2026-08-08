"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
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
 * `children` is a server-rendered `<nav>` carrying six real `<a href>` plus the locale
 * switcher. This island receives it and only toggles a `data-open` attribute; it never
 * builds, rewrites or conditionally renders a link. That is the binding shape of this work
 * (`SEO-POLICY.md` §B8.1/8.2): the six hub entry points sit in the first HTML response at
 * every viewport, so the internal link graph is byte-identical to the pre-hamburger header
 * and no crawler has to run JavaScript to find `/turkiye`, `/dunya`, `/deniz`, `/oyun` or
 * `/hakkimizda`.
 *
 * Above 64rem the panel is `display: contents` and the button is `display: none`, so this
 * component's state stops having any visual meaning and the desktop nav renders inline
 * exactly as it did before.
 *
 * ## What closes it
 *
 * Escape (focus returns to the button), following a link inside it, and focus leaving the
 * component altogether. The last one is also what keeps the two header panels mutually
 * exclusive without either island knowing the other exists: reaching for the search trigger
 * moves focus out of this root, and reaching for this button blurs the search combobox, whose
 * own `onBlur` closes it. Both sheets anchor to the same header edge, so "both open" would be
 * two overlapping cards.
 *
 * ## No-JS reality, stated rather than implied
 *
 * Below 64rem the panel's closed state is CSS, so a reader with no JavaScript sees the compact
 * header and cannot open the menu. The alternative — rendering the menu open and collapsing it
 * on hydration — trades that for a ~120px layout shift on every page load, which is the defect
 * this whole change exists to remove. The links remain in the document for machines, and for a
 * human the brand link in the first row reaches the homepage, which carries a body link to
 * every one of the five hubs.
 */
export function NavDisclosure({ children }: { children: ReactNode }) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Set by `close(true)`; consumed after commit so `focus()` never runs on a hidden node. */
  const restoreFocus = useRef(false);
  const panelId = `${useId()}-panel`;

  const close = useCallback((restore: boolean) => {
    restoreFocus.current = restore;
    setOpen(false);
  }, []);

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
   * Following a link closes the menu. It has to be explicit: this island stays mounted across
   * client-side navigations, so without it the panel would still be covering the page the
   * reader just asked for. Scoped to anchors, so a click on the panel's own padding does not
   * dismiss the menu the reader is still reading.
   */
  const onPanelClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("a")) {
      close(false);
    }
  };

  return (
    <div className={styles.root} onBlur={onBlur} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <MenuIcon open={open} />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={styles.panel}
        data-open={open ? "true" : "false"}
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
