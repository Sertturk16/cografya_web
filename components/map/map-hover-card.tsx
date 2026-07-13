"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./map.module.css";

/** One stat-chip row (label + pre-formatted value), server-formatted. */
interface CardStat {
  label: string;
  value: string;
}

/** Entity info + computed overlay position for one active hover/focus. */
interface ActiveCard {
  name: string;
  /** Pill badge (plaka kodu for a province, ISO code for a country). */
  badge: string;
  /** Secondary line under the name (region for a province, continent for a country). */
  subtitle: string;
  href: string;
  stats: CardStat[];
  left: number;
  top: number;
}

const CARD_WIDTH = 258;
const CARD_HEIGHT_FALLBACK = 150; // used only before the card has ever been measured
const HIDE_DELAY_MS = 140; // hover-intent: bridge the gap between shape and card
const MAX_STATS = 3; // both maps expose exactly three stat slots

/**
 * The floating stat card shared by both interactive maps — the Türkiye il map and the
 * world country map — and the ONLY client JS either map ships (SPEC §1.6/§1.7).
 *
 * Each map is server-rendered: the SVG paths, the seeded shapes wrapped in real crawlable
 * `<a>` links, the visual hover/focus highlight done in pure CSS. This island adds only the
 * overlay card. It uses event delegation on the map root (`[data-map-root]`, its own parent)
 * so no entity data ships to the client twice — it reads the localized, pre-formatted,
 * ENTITY-AGNOSTIC `data-*` the server already put on each link: `data-name`, `data-badge`,
 * `data-subtitle`, `data-href`, and up to three `data-stat-{n}-label` / `data-stat-{n}-value`
 * pairs. A province emits plaka+region+nüfus/yüzölçümü/ilçe; a country emits ISO+kıta+
 * nüfus/yüzölçümü/komşu — same shape, different content.
 *
 * - Desktop hover AND keyboard focus both open the card (SPEC §1.7 — focus, not just hover).
 *   `Enter` on the focused link navigates natively.
 * - **The shape and its card behave as ONE hover region.** Moving the pointer off the shape
 *   toward the card no longer hides it: the card is a real pointer target and a short
 *   hover-intent delay bridges the blind gap in transit. The whole card is itself clickable
 *   (mouse affordance), navigating to the same detail page — so no textual "go to detail" CTA
 *   is needed (retired → DEC 2026-07-13); the keyboard/AT path stays the shape `<a>` (the card
 *   is `aria-hidden`, not focusable, so it never duplicates the link in the tab order or the
 *   a11y tree).
 * - Touch pointers are ignored: on mobile a single tap follows the link straight to the
 *   detail page, with no intermediate card.
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

    const shapeFrom = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const anchor = target.closest<HTMLElement>("a[data-shape]");
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
      const stats: CardStat[] = [];
      for (let n = 1; n <= MAX_STATS; n++) {
        const label = d[`stat${n}Label`];
        const value = d[`stat${n}Value`];
        if (label && value) stats.push({ label, value });
      }
      setActive({
        name: d.name ?? "",
        badge: d.badge ?? "",
        subtitle: d.subtitle ?? "",
        href: d.href ?? "",
        stats,
        left,
        top,
      });
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // mobile taps navigate; no card
      const anchor = shapeFrom(e.target);
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
      if (!shapeFrom(e.relatedTarget) && !inCard(e.relatedTarget)) scheduleHide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const anchor = shapeFrom(e.target);
      if (anchor) {
        cancelHide();
        openFrom(anchor);
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      // Keyboard focus moves deterministically — hide immediately when it leaves.
      if (!shapeFrom(e.relatedTarget)) setActive(null);
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

  return (
    <div
      ref={setCard}
      className={styles.card}
      // Redundant MOUSE affordance duplicating the shape link: aria-hidden + not
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
            {active.badge && <span className={styles.cardPlate}>{active.badge}</span>}
          </div>
          {active.subtitle && <div className={styles.cardRegion}>{active.subtitle}</div>}
          <div className={styles.cardRule} />
          {active.stats.length > 0 && (
            <dl className={styles.stats}>
              {active.stats.map((stat) => (
                <div key={stat.label} className={styles.stat}>
                  <dt className={styles.statLabel}>{stat.label}</dt>
                  <dd className={styles.statValue}>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </div>
  );
}
