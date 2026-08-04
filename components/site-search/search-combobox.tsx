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
import { useTranslations } from "next-intl";
import { nextActiveIndex } from "@/lib/search/active-option";
import { prepareSearchIndex, type PreparedEntry, searchPrepared } from "@/lib/search/match";
import { isSearchIndexPayload } from "@/lib/search/types";
import styles from "./site-search.module.css";

/** How many hits the listbox shows before the "see the full list" row. */
const RESULT_LIMIT = 8;

/** Give up on the index rather than leaving the panel silently empty forever. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Province labels are Turkish in BOTH locales (`ProvinceListItem` carries no `nameEn`), so
 * the tie-break inside a rank tier is pinned to Turkish exactly as the hub index pins it —
 * otherwise `/en` search results would order the same Turkish names differently from the
 * `/en/turkiye#iller` list they link to (review M1). English country names are plain ASCII,
 * which the two collations order identically, so pinning costs them nothing.
 */
const COLLATION_LOCALE = "tr";

/**
 * Hydration gate. `useSyncExternalStore` with a never-firing subscription is React's own way
 * to ask "am I on the client yet" — the server snapshot is `false`, the client snapshot
 * `true`, so the server render and the first client render agree and only the
 * post-hydration render differs. Preferred over `useState` + `useEffect`, which sets state
 * directly inside an effect (`react-hooks/set-state-in-effect`).
 */
const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

interface SearchComboboxProps {
  readonly fallbackHref: string;
  readonly indexUrl: string;
}

/**
 * The header search control.
 *
 * ## Progressive enhancement, not a spinner
 *
 * `mounted` is false during server rendering AND during the first client render, so both
 * produce the identical `<a>` fallback — no hydration mismatch, and the pre-hydration
 * document contains a real crawlable link to the province index. Only after mount does the
 * element become a combobox. If the index cannot be loaded the control degrades back to
 * that same link rather than presenting a box that answers nothing.
 *
 * ## Strings are resolved HERE, not handed down
 *
 * Every label comes from `useTranslations` inside the island. An earlier revision resolved
 * them in the server wrapper and passed the raw ICU string down for a manual
 * `String.replace` — which worked, but only because next-intl happened to hand back the
 * uncompiled message. Formatting a count is next-intl's job; doing it here also gets real
 * ICU pluralisation, so English no longer says "1 results" (review I1/M6).
 *
 * ## a11y
 *
 * ARIA 1.2 combobox-with-listbox: the input owns `role="combobox"`, `aria-expanded`,
 * `aria-controls` and `aria-activedescendant`; the popup is a `role="listbox"` whose `<li>`
 * wrappers are `role="presentation"`, so the options are its OWNED elements — without that,
 * the intervening listitem breaks the chain and the "1 of 8" position announcements the
 * option role exists for never happen. Options are real `<a href>` carrying `role="option"`
 * and `tabIndex={-1}`: the role is what AT announces, the href keeps middle-click working,
 * and the negative tabindex preserves the combobox's single-tab-stop invariant. Focus
 * restoration happens after commit, never inside the handler that hides the target.
 */
export function SearchCombobox({ fallbackHref, indexUrl }: SearchComboboxProps) {
  const t = useTranslations("Search");
  const mounted = useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PreparedEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inFlight = useRef(false);
  /** Set by `close(true)`; consumed after commit so `focus()` never runs on a hidden node. */
  const restoreFocus = useRef(false);

  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);

  /**
   * Fetches the index at most once per SUCCESSFUL load. A failed attempt clears the guard so
   * the next focus retries: the previous revision set the flag before the await and never
   * reset it, which let one connectivity blip latch the search dead for as long as the island
   * stayed mounted — and it stays mounted across client-side navigations (review I2).
   */
  const ensureIndex = useCallback(async () => {
    if (inFlight.current || entries !== null) return;
    inFlight.current = true;
    setLoadFailed(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(indexUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`search index responded ${response.status}`);
      const payload: unknown = await response.json();
      // Network input, so the shape is CHECKED rather than asserted; a malformed body becomes
      // the same honest "could not load" as a 500 (review M14).
      if (!isSearchIndexPayload(payload)) throw new Error("search index payload malformed");
      setEntries(prepareSearchIndex(payload.entries));
    } catch {
      // No console noise for the reader: the control falls back to the index link, which is a
      // working answer rather than an error state.
      setLoadFailed(true);
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
    }
  }, [indexUrl, entries]);

  const hits = useMemo(
    () =>
      entries === null
        ? []
        : searchPrepared(entries, query, {
            limit: RESULT_LIMIT,
            collationLocale: COLLATION_LOCALE,
          }),
    [entries, query],
  );

  const hasQuery = query.trim().length > 0;
  /** Waiting on the index is NOT the same as having nothing to show for this query. */
  const isLoading = entries === null && !loadFailed;
  const showNoResults = hasQuery && !isLoading && !loadFailed && hits.length === 0;

  // Announce on a debounce — WCAG 4.1.3 without narrating every keystroke. The whole decision
  // lives inside the timeout, including the "say nothing" case: a synchronous setState in the
  // effect body would cascade a render on every character typed. `isLoading` is what stops the
  // region asserting "no results" for a query that does match, before the index arrives — a
  // certainty right after every deploy, when the prerendered index is empty (review I3).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!open || !hasQuery || isLoading || loadFailed) {
        setAnnouncement("");
        return;
      }
      setAnnouncement(
        hits.length === 0 ? t("noResults") : t("resultCount", { count: hits.length }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [open, hasQuery, isLoading, loadFailed, hits.length, t]);

  // Focus restoration AFTER commit. Doing it inside `close()` used to work only because the
  // trigger was never really hidden; now that `[hidden]` genuinely removes it from the a11y
  // tree, a pre-commit `focus()` would be a silent no-op (review C1 and I5 are one fix).
  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    triggerRef.current?.focus();
  }, [open]);

  // Keep the active option visible: eight rows overflow the panel's max-height on a short
  // viewport, where ArrowDown would otherwise move an off-screen highlight while
  // `aria-activedescendant` pointed at something nobody can see (review M8).
  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, optionId]);

  const close = useCallback((restore: boolean) => {
    restoreFocus.current = restore;
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  /**
   * The ONLY way the query changes. The active option resets with it, here in the event
   * handler rather than in an effect watching `query`, so the highlight can never survive
   * into a different result set.
   */
  const updateQuery = useCallback((next: string) => {
    setQuery(next);
    setActiveIndex(-1);
  }, []);

  const openAndFocus = useCallback(() => {
    void ensureIndex();
    setOpen(true);
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
    // Tab is deliberately NOT handled here. Closing on keydown unmounted the focused input
    // before the browser performed its default focus move, so sequential navigation restarted
    // from the document start; `onBlur` closes the panel once focus has settled on whatever
    // Tab actually reached (review I4 / A45-I2).
    if (hits.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        nextActiveIndex(current, hits.length, event.key === "ArrowDown" ? 1 : -1),
      );
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
      // With no explicit selection the first hit is the intent — typing a province name and
      // pressing Enter used to do nothing at all (review M9).
      const hit = hits[activeIndex >= 0 ? activeIndex : 0];
      if (hit) {
        event.preventDefault();
        window.location.assign(hit.path);
      }
    }
  };

  /**
   * Closes once focus has genuinely left the control. Clicking an option keeps focus inside
   * the root, so navigation is never cancelled; tabbing or clicking away closes the panel
   * without moving focus anywhere, which is what makes the keyboard tour coherent. This
   * replaces the previous outside-`pointerdown` listener, which closed the panel but left
   * focus on `<body>`.
   */
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    close(false);
  };

  // Pre-hydration and no-JS: a real link to the alphabetical index. It carries `aria-label`
  // because the visible word is `display: none` below the desktop breakpoint, which would
  // otherwise leave a NAMELESS link in the first HTML response — and that is the state the
  // no-JS reader never leaves (review C2).
  if (!mounted) {
    return (
      <div className={styles.slot}>
        <a ref={triggerRef} className={styles.trigger} href={fallbackHref} aria-label={t("seeAll")}>
          <SearchIcon />
          <span className={styles.triggerText}>{t("triggerLabel")}</span>
        </a>
      </div>
    );
  }

  return (
    <div className={styles.slot} onBlur={onBlur}>
      {/* The collapsed trigger. It stays an <a href> after hydration, so a middle-click still
          opens the full index. `hidden` is honoured by an explicit
          `.trigger[hidden] { visibility: hidden }` rule: the UA's `display:none` for [hidden]
          loses to this module's own author-origin `display:inline-flex`, which left the
          control rendered, focusable and — below the desktop breakpoint — NAMELESS while the
          panel was open (review C1). `visibility:hidden` keeps the slot's box, so the header
          cannot reflow. The accessible name is never cleared. */}
      <a
        ref={triggerRef}
        className={styles.trigger}
        href={fallbackHref}
        aria-label={t("openLabel")}
        aria-expanded={open}
        aria-haspopup="listbox"
        hidden={open}
        onClick={(event) => {
          event.preventDefault();
          openAndFocus();
        }}
        onFocus={() => void ensureIndex()}
      >
        <SearchIcon />
        <span className={styles.triggerText}>{t("triggerLabel")}</span>
      </a>

      {open ? (
        <div className={styles.panel}>
          <label className={styles.srOnly} htmlFor={inputId}>
            {t("label")}
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
              placeholder={t("placeholder")}
              value={query}
              // Tracks the popup's ACTUAL presence: the listbox below renders only when there
              // are hits, so the attribute and the element can never disagree (review M12).
              aria-expanded={hits.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              onChange={(event) => updateQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="button" className={styles.close} onClick={() => close(true)}>
              <span className={styles.srOnly}>{t("closeLabel")}</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {loadFailed ? <p className={styles.notice}>{t("loadFailed")}</p> : null}

          {hits.length > 0 ? (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={t("label")}
              className={styles.results}
            >
              {hits.map((hit, index) => (
                // `role="presentation"` so the options are the listbox's OWNED elements — an
                // intervening listitem breaks that chain (review M11).
                <li key={hit.path} role="presentation" className={styles.resultItem}>
                  <a
                    id={optionId(index)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === activeIndex}
                    href={hit.path}
                    className={`${styles.result} ${index === activeIndex ? styles.resultActive : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className={styles.resultName}>{hit.name}</span>
                    {/* A text badge, never colour alone (DESIGN.md §5). */}
                    <span className={styles.resultKind}>
                      {hit.kind === "p" ? t("province") : t("country")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {showNoResults ? <p className={styles.notice}>{t("noResults")}</p> : null}

          <a className={styles.seeAll} href={fallbackHref}>
            {t("seeAll")}
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
