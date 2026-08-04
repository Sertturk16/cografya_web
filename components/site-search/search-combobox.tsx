"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Locale } from "@/i18n/routing";
import { prepareSearchIndex, type PreparedEntry, searchPrepared } from "@/lib/search/match";
import type { SearchIndexPayload } from "@/lib/search/types";
import styles from "./site-search.module.css";

/** How many hits the listbox shows before the "see the full list" row. */
const RESULT_LIMIT = 8;

/**
 * Hydration gate. `useSyncExternalStore` with a never-firing subscription is React's own
 * way to ask "am I on the client yet" — the server snapshot is `false`, the client snapshot
 * `true`, so the server render and the first client render agree and only the post-hydration
 * render differs. Preferred over `useState` + `useEffect`, which sets state directly inside
 * an effect and triggers a cascading render (the `react-hooks/set-state-in-effect` rule).
 */
const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

export interface SearchLabels {
  readonly label: string;
  /** Short visible trigger word ("Ara"), NOT the long placeholder. */
  readonly triggerLabel: string;
  readonly placeholder: string;
  readonly openLabel: string;
  readonly closeLabel: string;
  readonly noResults: string;
  /** ICU string with a `{count}` placeholder, pre-resolved per count by the caller. */
  readonly resultCount: string;
  readonly seeAll: string;
  readonly province: string;
  readonly country: string;
  readonly loadFailed: string;
}

interface SearchComboboxProps {
  readonly locale: Locale;
  readonly fallbackHref: string;
  readonly indexUrl: string;
  readonly labels: SearchLabels;
}

/**
 * The header search control.
 *
 * ## Progressive enhancement, not a spinner
 *
 * `mounted` is false during server rendering AND during the first client render, so both
 * produce the identical `<a>` fallback — no hydration mismatch, and the pre-hydration
 * document contains a real crawlable link to the province index. Only after mount does the
 * element become a combobox. If the index fetch fails the control degrades back to that
 * same link rather than presenting a box that answers nothing.
 *
 * ## The index is fetched lazily, once
 *
 * Nothing is requested until the reader actually focuses or opens the control, so a visit
 * that never searches pays zero bytes for it. The fetch is guarded so a second focus does
 * not re-request.
 *
 * ## a11y
 *
 * ARIA 1.2 combobox-with-listbox: the input owns `role="combobox"`, `aria-expanded`,
 * `aria-controls` and `aria-activedescendant`; the popup is a `role="listbox"` of
 * `role="option"` children. The options are real `<a href>` elements carrying
 * `role="option"` — a deliberate trade-off: the role is what lets assistive tech announce
 * "1 of 8" inside a listbox, while the underlying anchor is what keeps middle-click and
 * ctrl-click working (ARIA changes what is announced, never what the browser does). A
 * `role="status"` region announces the result count on a debounce, so typing does not
 * produce a stream of interruptions.
 */
export function SearchCombobox({ locale, fallbackHref, indexUrl, labels }: SearchComboboxProps) {
  const mounted = useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PreparedEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const requested = useRef(false);

  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  /** Fetch-once. Called on first focus/open — never during render. */
  const ensureIndex = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    try {
      const response = await fetch(indexUrl);
      if (!response.ok) throw new Error(`search index responded ${response.status}`);
      const payload = (await response.json()) as SearchIndexPayload;
      setEntries(prepareSearchIndex(payload.entries));
    } catch {
      // Deliberately silent for the reader beyond the inline notice: the control falls back
      // to the index link, which is a working answer, not an error state.
      setLoadFailed(true);
    }
  }, [indexUrl]);

  const hits = useMemo(
    () =>
      entries === null
        ? []
        : searchPrepared(entries, query, { limit: RESULT_LIMIT, collationLocale: locale }),
    [entries, query, locale],
  );

  // Announce the count on a debounce — WCAG 4.1.3 without narrating every keystroke. The
  // whole decision lives INSIDE the timeout, including the "say nothing" case: a synchronous
  // setState in the effect body would cascade a render on every character typed.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!open || query.trim().length === 0) {
        setAnnouncement("");
        return;
      }
      setAnnouncement(
        hits.length === 0
          ? labels.noResults
          : labels.resultCount.replace("{count}", `${hits.length}`),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, hits.length, labels.noResults, labels.resultCount]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /**
   * The ONLY way the query changes. The active option resets with it, here in the event
   * handler rather than in an effect watching `query`: the highlight must never survive
   * into a different result set, and doing it at the source keeps `activeIndex` valid for
   * the hits currently on screen instead of being corrected a render later.
   */
  const updateQuery = useCallback((next: string) => {
    setQuery(next);
    setActiveIndex(-1);
  }, []);

  // Pointer-outside and focus-outside both dismiss. Registered only while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const openAndFocus = useCallback(() => {
    void ensureIndex();
    setOpen(true);
    // The input mounts in the same tick; focus it once it exists.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [ensureIndex]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (query.length > 0) {
        updateQuery("");
        return;
      }
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (hits.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + delta;
        if (next < 0) return hits.length - 1;
        if (next >= hits.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(hits.length - 1);
      return;
    }
    if (event.key === "Enter") {
      const hit = hits[activeIndex];
      if (hit) {
        event.preventDefault();
        window.location.assign(hit.path);
      }
    }
  };

  // Pre-hydration and no-JS: a real link to the alphabetical index. Also the state the
  // control returns to if the index cannot be loaded.
  if (!mounted) {
    return (
      <div className={styles.slot}>
        <a ref={triggerRef} className={styles.trigger} href={fallbackHref}>
          <SearchIcon />
          <span className={styles.triggerText}>{labels.triggerLabel}</span>
        </a>
      </div>
    );
  }

  return (
    <div className={styles.slot} ref={rootRef}>
      {/* Collapsed state: a link-shaped trigger. It stays an <a href> even after hydration,
          so a middle-click still opens the full index and a failed island still navigates. */}
      <a
        ref={triggerRef}
        className={styles.trigger}
        href={fallbackHref}
        aria-label={open ? undefined : labels.openLabel}
        aria-expanded={open}
        hidden={open}
        onClick={(event) => {
          event.preventDefault();
          openAndFocus();
        }}
        onFocus={() => void ensureIndex()}
      >
        <SearchIcon />
        <span className={styles.triggerText}>{labels.triggerLabel}</span>
      </a>

      {open ? (
        <div className={styles.panel}>
          <label className={styles.srOnly} htmlFor={inputId}>
            {labels.label}
          </label>
          <div className={styles.inputRow}>
            <SearchIcon />
            <input
              ref={inputRef}
              id={inputId}
              className={styles.input}
              type="text"
              role="combobox"
              autoComplete="off"
              placeholder={labels.placeholder}
              value={query}
              aria-expanded={hits.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              onChange={(event) => updateQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="button" className={styles.close} onClick={() => close(true)}>
              <span className={styles.srOnly}>{labels.closeLabel}</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {loadFailed ? <p className={styles.notice}>{labels.loadFailed}</p> : null}

          {/* `role="listbox"` supplies the semantics `list-style: none` would otherwise strip
              (the PR #44 A11Y-2 lesson), so no separate `role="list"` is wanted here. */}
          <ul id={listboxId} role="listbox" aria-label={labels.label} className={styles.results}>
            {hits.map((hit, index) => (
              <li key={hit.path} className={styles.resultItem}>
                <a
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  href={hit.path}
                  className={`${styles.result} ${index === activeIndex ? styles.resultActive : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className={styles.resultName}>{hit.name}</span>
                  {/* A text badge, never colour alone (DESIGN.md §5). */}
                  <span className={styles.resultKind}>
                    {hit.kind === "p" ? labels.province : labels.country}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {query.trim().length > 0 && hits.length === 0 && !loadFailed ? (
            <p className={styles.notice}>{labels.noResults}</p>
          ) : null}

          <a className={styles.seeAll} href={fallbackHref}>
            {labels.seeAll}
          </a>

          <div role="status" aria-live="polite" className={styles.srOnly}>
            {announcement}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Decorative magnifier; every control that uses it carries its own accessible name. */
function SearchIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
