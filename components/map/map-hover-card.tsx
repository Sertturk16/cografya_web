"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./turkey-map.module.css";

/** Province info + computed overlay position for one active hover/focus. */
interface ActiveCard {
  name: string;
  region: string;
  plateLabel: string;
  href: string;
  popLabel: string;
  popValue: string;
  areaLabel: string;
  areaValue: string;
  districtLabel: string;
  districtValue: string;
  left: number;
  top: number;
}

const CARD_WIDTH = 258;
const CARD_HEIGHT_FALLBACK = 150; // used only before the card has ever been measured
const HIDE_DELAY_MS = 140; // hover-intent: bridge the gap between shape and card

/**
 * The floating province stat card — the ONLY client JS in the map (SPEC §1.6/§1.7).
 *
 * The map itself is server-rendered: 81 SVG paths, the available provinces wrapped
 * in real crawlable `<a>` links, the visual hover/focus highlight done in pure CSS.
 * This island adds only the overlay card. It uses event delegation on the map root
 * (`[data-map-root]`, its own parent) so no province data ships to the client twice
 * — it reads the localized, pre-formatted `data-*` the server already put on each
 * link (name/region/plaka + the stat-chip numbers + the detail href).
 *
 * - Desktop hover AND keyboard focus both open the card (SPEC §1.7 — focus, not just
 *   hover). `Enter` on the focused link navigates natively.
 * - **The shape and its card behave as ONE hover region.** Moving the pointer off the
 *   shape toward the card no longer hides it: the card is a real pointer target and a
 *   short hover-intent delay bridges the blind gap in transit (PR#6 owner report). The
 *   whole card is itself clickable (mouse affordance), navigating to the same detail
 *   page — so no textual "go to detail" CTA is needed (retired → DEC 2026-07-13); the
 *   keyboard/AT path stays the province `<a>` (the card is `aria-hidden`, not
 *   focusable, so it never duplicates the link in the tab order or the a11y tree).
 * - Touch pointers are ignored (SPEC §6.1 / DEC 2026-07-10 #3): on mobile a single
 *   tap follows the link straight to the detail page, with no intermediate card.
 * - The appearance transition is CSS, disabled under `prefers-reduced-motion`.
 */
export function MapHoverCard() {
  const [active, setActive] = useState<ActiveCard | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = card?.parentElement;
    if (!container) return;

    const cancelHide = () => {
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimer.current = setTimeout(() => setActive(null), HIDE_DELAY_MS);
    };

    const provinceFrom = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const anchor = target.closest<HTMLElement>("a[data-province]");
      return anchor && container.contains(anchor) ? anchor : null;
    };
    const inCard = (node: EventTarget | null): boolean =>
      node instanceof Node && card.contains(node);

    const openFrom = (anchor: HTMLElement) => {
      const a = anchor.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const cardH = card.offsetHeight > 40 ? card.offsetHeight : CARD_HEIGHT_FALLBACK;
      const centerX = a.left - c.left + a.width / 2;
      const left = Math.max(8, Math.min(centerX - CARD_WIDTH / 2, c.width - CARD_WIDTH - 8));
      let top = a.top - c.top - cardH - 10;
      if (top < 8) top = a.bottom - c.top + 10; // flip below if no room above
      const d = anchor.dataset;
      setActive({
        name: d.name ?? "",
        region: d.region ?? "",
        plateLabel: d.plateLabel ?? "",
        href: d.href ?? "",
        popLabel: d.popLabel ?? "",
        popValue: d.popValue ?? "",
        areaLabel: d.areaLabel ?? "",
        areaValue: d.areaValue ?? "",
        districtLabel: d.districtLabel ?? "",
        districtValue: d.districtValue ?? "",
        left,
        top,
      });
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // mobile taps navigate; no card
      const anchor = provinceFrom(e.target);
      if (anchor) {
        cancelHide();
        openFrom(anchor);
      } else if (inCard(e.target)) {
        cancelHide(); // hovering the card itself keeps it open
      }
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      // Stay open while moving within the shape↔card region; hide (delayed) otherwise.
      if (!provinceFrom(e.relatedTarget) && !inCard(e.relatedTarget)) scheduleHide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const anchor = provinceFrom(e.target);
      if (anchor) {
        cancelHide();
        openFrom(anchor);
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      // Keyboard focus moves deterministically — hide immediately when it leaves.
      if (!provinceFrom(e.relatedTarget)) setActive(null);
    };

    container.addEventListener("pointerover", onPointerOver);
    container.addEventListener("pointerout", onPointerOut);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    return () => {
      cancelHide();
      container.removeEventListener("pointerover", onPointerOver);
      container.removeEventListener("pointerout", onPointerOut);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
    };
  }, [card]);

  const hasStats =
    active !== null && Boolean(active.popValue || active.areaValue || active.districtValue);

  return (
    <div
      ref={setCard}
      className={styles.card}
      // Redundant MOUSE affordance duplicating the province link: aria-hidden + not
      // focusable, so it never doubles the accessible link (keyboard/AT use the <a>).
      aria-hidden="true"
      data-visible={active !== null ? "true" : undefined}
      style={active ? { left: active.left, top: active.top } : undefined}
      onClick={() => {
        if (active?.href) window.location.assign(active.href);
      }}
    >
      {active && (
        <>
          <div className={styles.cardHead}>
            <span className={styles.cardName}>{active.name}</span>
            {active.plateLabel && <span className={styles.cardPlate}>{active.plateLabel}</span>}
          </div>
          {active.region && <div className={styles.cardRegion}>{active.region}</div>}
          <div className={styles.cardRule} />
          {hasStats && (
            <dl className={styles.stats}>
              {active.popValue && (
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>{active.popLabel}</dt>
                  <dd className={styles.statValue}>{active.popValue}</dd>
                </div>
              )}
              {active.areaValue && (
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>{active.areaLabel}</dt>
                  <dd className={styles.statValue}>{active.areaValue}</dd>
                </div>
              )}
              {active.districtValue && (
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>{active.districtLabel}</dt>
                  <dd className={styles.statValue}>{active.districtValue}</dd>
                </div>
              )}
            </dl>
          )}
        </>
      )}
    </div>
  );
}
