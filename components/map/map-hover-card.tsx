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
  /**
   * Secondary line under the name — region for a province, continent for a country, the
   * one-line status sentence for a territory.
   */
  subtitle: string;
  /** Empty for a territory: it has no detail page, so the card is not a click target. */
  href: string;
  stats: CardStat[];
  /**
   * `true` when the card hangs ABOVE the shape. `top` is then the card's BOTTOM edge and CSS
   * pulls it up by its own height (`translateY(-100%)`) — see the placement note below.
   */
  above: boolean;
  left: number;
  top: number;
}

const CARD_WIDTH = 258;
/**
 * Upper bound on the card's rendered height, used ONLY to decide which side of the shape it
 * hangs on (exact placement is CSS's job — see `data-place` below). MEASURED, not guessed:
 * all 43 territory cards were sampled at 1440×900 on both locales and span 112–237px (TR)
 * and 92–193px (EN); the tallest is Antarktika, whose two-line status sentence sits above a
 * wrapped 7-digit area range. 260 leaves headroom over the observed 237.
 * Over-estimating only flips a short card BELOW a near-the-top shape that could have hosted
 * it above; under-estimating pushes a card off the top of the map, so this errs high.
 */
const CARD_MAX_HEIGHT = 260;
const CARD_GAP = 10; // shape↔card breathing room
const EDGE_INSET = 8; // keep the card off the container edge
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
 * ENTITY-AGNOSTIC `data-*` the server already put on each shape: `data-name`, `data-badge`,
 * `data-subtitle`, `data-href`, and up to three `data-stat{n}-label` / `data-stat{n}-value`
 * pairs. A province emits plaka+region+nüfus/yüzölçümü/ilçe; a country emits ISO+kıta+
 * nüfus/yüzölçümü/komşu; a territory emits ISO+statü+nüfus/yüzölçümü/merkez — same shape,
 * different content.
 *
 * The delegated selector is `[data-shape]`, not `a[data-shape]`: the world map's 43 territory
 * shapes are `<g role="img">`, not links (no detail page exists → nothing to navigate to,
 * → DEC 2026-07-26 K2). They therefore emit no `data-href`, and a card opened from one is not
 * a click target — the pointer affordance is suppressed rather than silently doing nothing.
 *
 * - Desktop hover AND keyboard focus both open the card (SPEC §1.7 — focus, not just hover).
 *   `Enter` on the focused link navigates natively. `Escape` dismisses the card without
 *   moving the pointer (WCAG 1.4.13 "Dismissable" — content shown on hover).
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

    // HTMLElement OR SVGElement: a country/province shape is an `<a>`, a territory shape is
    // an SVG `<g>`. Both implement `HTMLOrSVGElement`, which is where `dataset` lives.
    const shapeFrom = (target: EventTarget | null): HTMLElement | SVGElement | null => {
      if (!(target instanceof Element)) return null;
      const shape = target.closest("[data-shape]");
      if (!(shape instanceof HTMLElement || shape instanceof SVGElement)) return null;
      return container.contains(shape) ? shape : null;
    };
    const inCard = (node: EventTarget | null): boolean =>
      node instanceof Node && card.contains(node);

    // PLACEMENT. The card is anchored to an EDGE, never to a measured height: `top` is the
    // card's bottom edge when it hangs above (CSS pulls it up by exactly its own height) and
    // its top edge when it hangs below. Reading `card.offsetHeight` here would measure the
    // PREVIOUS entity's card — the DOM has not re-rendered yet — which placed a tall card as
    // if it were short and vice versa; territory cards, whose height swings from one stat row
    // to a two-line status sentence plus three rows, made that visible. Height now only
    // decides WHICH SIDE, against a conservative bound, so no measurement is needed at all.
    const openFrom = (anchor: HTMLElement | SVGElement) => {
      const a = anchor.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const centerX = a.left - c.left + a.width / 2;
      const left = Math.max(
        EDGE_INSET,
        Math.min(centerX - CARD_WIDTH / 2, c.width - CARD_WIDTH - EDGE_INSET),
      );
      const anchorTop = a.top - c.top;
      const above = anchorTop - CARD_GAP - CARD_MAX_HEIGHT >= EDGE_INSET;
      const top = above ? anchorTop - CARD_GAP : a.bottom - c.top + CARD_GAP;
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
        above,
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
    // WCAG 1.4.13: content shown on hover must be dismissable without moving the pointer.
    // Bound on the document, not the container, because a mouse user has no focus inside it.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelHide();
        setActive(null);
      }
    };

    container.addEventListener("pointerover", onPointerOver);
    container.addEventListener("pointerout", onPointerOut);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelHide();
      container.removeEventListener("pointerover", onPointerOver);
      container.removeEventListener("pointerout", onPointerOut);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
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
      // Above the shape ⇒ `top` is the card's BOTTOM edge and CSS lifts it by its own
      // height, so placement is exact for any card height without measuring one.
      data-place={active?.above ? "above" : undefined}
      // Territory cards have no destination, so they must not offer a pointer cursor for a
      // click that would do nothing (the CSS keys off this).
      data-clickable={active?.href ? "true" : undefined}
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
          {/* The rule SEPARATES the head from the stats, so it only exists when there are
              stats to separate. Every province and country card has at least one stat; the
              stat-less case is the hand-wired Türkiye shape, whose card is deliberately just
              name + destination (→ DEC 2026-07-26 K1) and would otherwise end on a dangling
              hairline. */}
          {active.stats.length > 0 && (
            <>
              <div className={styles.cardRule} />
              <dl className={styles.stats}>
                {active.stats.map((stat) => (
                  <div key={stat.label} className={styles.stat}>
                    <dt className={styles.statLabel}>{stat.label}</dt>
                    <dd className={styles.statValue}>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </>
      )}
    </div>
  );
}
