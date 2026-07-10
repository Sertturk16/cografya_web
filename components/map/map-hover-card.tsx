"use client";

import { useEffect, useState } from "react";
import styles from "./turkey-map.module.css";

/** Province info + computed overlay position for one active hover/focus. */
interface ActiveCard {
  name: string;
  region: string;
  plateLabel: string;
  left: number;
  top: number;
}

interface MapHoverCardProps {
  /** Localized "Detaya git" hint shown at the card foot. */
  ctaLabel: string;
}

/** Fallback card height (px) used only before the card has ever been measured; the
 *  v0 card is a fixed set of rows so its height is effectively constant. */
const CARD_WIDTH = 258;
const CARD_HEIGHT_FALLBACK = 96;

/**
 * The floating province info card — the ONLY client JS in the map (SPEC §1.6/§1.7).
 *
 * The map itself is server-rendered: 81 SVG paths, the available provinces wrapped
 * in real crawlable `<a>` links, the visual hover/focus highlight done in pure CSS.
 * This island adds only the overlay card. It uses event delegation on the map root
 * (`[data-map-root]`, its own parent) so the province data never ships to the
 * client a second time — it reads the localized `data-*` the server already put on
 * each link, and computes the card position from the hovered link's geometry.
 *
 * - Desktop hover AND keyboard focus both open the card (SPEC §1.7 — focus, not just
 *   hover). `Enter` navigates via the link's native behaviour.
 * - Touch pointers are ignored (SPEC §6.1 / DEC 2026-07-10 #3): on mobile a single
 *   tap follows the link straight to the detail page, with no intermediate card.
 * - The card is `pointer-events: none` (CSS) so it never steals hover from the
 *   province underneath (no flicker) nor intercepts the click. It is `aria-hidden`:
 *   it visually duplicates the focused link's own accessible name.
 * - The appearance transition is CSS, disabled under `prefers-reduced-motion`.
 */
export function MapHoverCard({ ctaLabel }: MapHoverCardProps) {
  const [active, setActive] = useState<ActiveCard | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);

  // Delegated listeners on the map root (this island's parent element). Position is
  // computed here — one state update per open, so no cascading effect re-renders.
  useEffect(() => {
    const container = card?.parentElement;
    if (!container) return;

    const anchorFrom = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const anchor = target.closest<HTMLElement>("a[data-province]");
      return anchor && container.contains(anchor) ? anchor : null;
    };

    const openFrom = (anchor: HTMLElement) => {
      const a = anchor.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const cardH = card && card.offsetHeight > 40 ? card.offsetHeight : CARD_HEIGHT_FALLBACK;
      const centerX = a.left - c.left + a.width / 2;
      const left = Math.max(8, Math.min(centerX - CARD_WIDTH / 2, c.width - CARD_WIDTH - 8));
      let top = a.top - c.top - cardH - 10;
      if (top < 8) top = a.bottom - c.top + 10; // flip below if no room above
      setActive({
        name: anchor.dataset.name ?? "",
        region: anchor.dataset.region ?? "",
        plateLabel: anchor.dataset.plateLabel ?? "",
        left,
        top,
      });
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // mobile taps navigate; no card
      const anchor = anchorFrom(e.target);
      if (anchor) openFrom(anchor);
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!anchorFrom(e.relatedTarget)) setActive(null);
    };
    const onFocusIn = (e: FocusEvent) => {
      const anchor = anchorFrom(e.target);
      if (anchor) openFrom(anchor);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!anchorFrom(e.relatedTarget)) setActive(null);
    };

    container.addEventListener("pointerover", onPointerOver);
    container.addEventListener("pointerout", onPointerOut);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    return () => {
      container.removeEventListener("pointerover", onPointerOver);
      container.removeEventListener("pointerout", onPointerOut);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
    };
  }, [card]);

  return (
    <div
      ref={setCard}
      className={styles.card}
      aria-hidden="true"
      data-visible={active !== null ? "true" : undefined}
      style={active ? { left: active.left, top: active.top } : undefined}
    >
      {active && (
        <>
          <div className={styles.cardHead}>
            <span className={styles.cardName}>{active.name}</span>
            {active.plateLabel && <span className={styles.cardPlate}>{active.plateLabel}</span>}
          </div>
          {active.region && <div className={styles.cardRegion}>{active.region}</div>}
          <div className={styles.cardRule} />
          <div className={styles.cardCta}>
            {ctaLabel} <span aria-hidden="true">→</span>
          </div>
        </>
      )}
    </div>
  );
}
