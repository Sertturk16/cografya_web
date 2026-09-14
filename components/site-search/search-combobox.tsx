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
  /**
   * `/turkiye#iller` for this locale. Two jobs, one destination: it is the pre-hydration /
   * no-JS target of the collapsed trigger AND the panel's province-list link. See
   * `lib/search/index-hrefs.ts` for why the fallback aims at the province index specifically.
   */
  readonly provinceIndexHref: string;
  /** `/dunya#ulkeler` for this locale — the panel's second list link. */
  readonly countryIndexHref: string;
  readonly indexUrl: string;
  readonly pathPrefix?: string;
  readonly variant?: "default" | "v2";
  readonly enableGlobalShortcut?: boolean;
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
 * ## Two list links, not one
 *
 * The panel's closing row offers the province index AND the country index (owner live-tour
 * finding #4). The single previous row said "Tüm il ve ülke listesi" and went only to
 * `/turkiye#iller`, so a reader hunting a country was silently sent to the wrong corpus. The
 * collapsed trigger still carries ONE href, because it is the no-JS surface and a single
 * `<a>` cannot honestly offer two destinations; the second link arrives with the panel, which
 * only exists once JS runs.
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
export function SearchCombobox({
  provinceIndexHref,
  countryIndexHref,
  indexUrl,
  pathPrefix,
  variant = "default",
  enableGlobalShortcut = false,
}: SearchComboboxProps) {
  const t = useTranslations("Search");
  const mounted = useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PreparedEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inFlight = useRef(false);
  /** Set by `close(true)`; consumed after commit so `focus()` never runs on a hidden node. */
  const restoreFocus = useRef(false);

  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);

  const resolvePath = useCallback(
    (rawPath: string) => {
      if (!pathPrefix) return rawPath;
      if (rawPath.startsWith(pathPrefix)) return rawPath;
      return `${pathPrefix}${rawPath}`;
    },
    [pathPrefix],
  );

  /**
   * A USABLE index — non-null and non-empty. An empty one is treated as "not loaded yet"
   * rather than as loaded, which is what makes the retry below reach the post-deploy case
   * (see `indexUnavailable`).
   */
  const indexReady = entries !== null && entries.length > 0;

  /**
   * Fetches the index at most once per usable load. A failed OR empty result clears the
   * guard so the next focus retries: the original revision set the flag before the await and
   * never reset it, which let one connectivity blip latch the search dead for as long as the
   * island stayed mounted — and it stays mounted across client-side navigations (review I2).
   */
  const ensureIndex = useCallback(async () => {
    if (inFlight.current || indexReady) return;
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
  }, [indexUrl, indexReady]);

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
  /**
   * The index cannot answer anything right now — either the fetch failed, or it SUCCEEDED
   * and returned zero entries.
   *
   * The empty case is not hypothetical: a CI build with no api service prerenders
   * `{"entries":[]}`, which is a valid 200 and passes the payload guard, so it is what every
   * reader gets between a deploy and the first ISR regeneration. Without this branch the
   * panel would answer every query with "no results" during exactly that window — the false
   * statement review CR-I3 was accepted to remove, still reachable through the other door
   * (confirm-leg NEW-1). An empty index means "the list is unavailable", never "your search
   * matched nothing".
   */
  const indexUnavailable = loadFailed || (entries !== null && entries.length === 0);
  const showNoResults = hasQuery && !isLoading && !indexUnavailable && hits.length === 0;

  // Announce on a debounce — WCAG 4.1.3 without narrating every keystroke. The whole decision
  // lives inside the timeout, including the "say nothing" case: a synchronous setState in the
  // effect body would cascade a render on every character typed. `isLoading` is what stops the
  // region asserting "no results" for a query that does match, before the index arrives — a
  // certainty right after every deploy, when the prerendered index is empty (review I3).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!open || !hasQuery || isLoading) {
        setAnnouncement("");
        return;
      }
      // An unavailable index is ANNOUNCED, not silently swallowed: a reader who cannot see
      // the inline notice still needs to know why their query produced nothing.
      if (indexUnavailable) {
        setAnnouncement(t("loadFailed"));
        return;
      }
      setAnnouncement(
        hits.length === 0 ? t("noResults") : t("resultCount", { count: hits.length }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [open, hasQuery, isLoading, indexUnavailable, hits.length, t]);

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

  useEffect(() => {
    if (!enableGlobalShortcut) return;
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          close(true);
        } else {
          openAndFocus();
        }
        return;
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [enableGlobalShortcut, open, openAndFocus, close]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
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
        window.location.assign(resolvePath(hit.path));
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
    if (variant === "v2") return;
    // A deliberate close (Escape, ×) is already restoring focus through the effect above;
    // the blur it causes must not cancel that by re-closing with `restore: false`.
    if (restoreFocus.current) return;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    close(false);
  };

  // Pre-hydration and no-JS: a real link to the alphabetical province index. It carries
  // `aria-label` because the visible word is `display: none` below the desktop breakpoint,
  // which would otherwise leave a NAMELESS link in the first HTML response — and that is the
  // state the no-JS reader never leaves (review C2).
  if (!mounted) {
    if (variant === "v2") {
      return (
        <div className="flex items-center">
          <a
            ref={triggerRef as unknown as React.RefObject<HTMLAnchorElement>}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 text-xs text-muted-foreground font-medium shadow-2xs"
            href={provinceIndexHref}
            aria-label={t("label")}
            data-testid="global-search"
          >
            <SearchIcon />
            <span>{t("triggerLabel")}...</span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-background border border-border rounded-md shadow-2xs text-muted-foreground">
              Ctrl K
            </kbd>
          </a>
          <a
            className="sm:hidden size-9 rounded-xl border border-border/80 bg-card flex items-center justify-center text-foreground shadow-2xs"
            href={provinceIndexHref}
            aria-label={t("label")}
            data-testid="global-search-mobile"
          >
            <SearchIcon />
          </a>
        </div>
      );
    }
    return (
      <div className={styles.slot}>
        <a
          ref={triggerRef as unknown as React.RefObject<HTMLAnchorElement>}
          className={styles.trigger}
          href={provinceIndexHref}
          aria-label={t("label")}
        >
          <SearchIcon />
          <span className={styles.triggerText}>{t("triggerLabel")}</span>
        </a>
      </div>
    );
  }

  if (variant === "v2") {
    return (
      <div className="flex items-center">
        {/* Desktop trigger: command bar button with Ctrl+K badge */}
        <button
          ref={triggerRef as unknown as React.RefObject<HTMLButtonElement>}
          type="button"
          data-testid="global-search"
          aria-label={t("openLabel")}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => openAndFocus()}
          onFocus={() => void ensureIndex()}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground font-medium transition-all cursor-pointer shadow-2xs group"
        >
          <SearchIcon />
          <span>{t("triggerLabel")}...</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-background border border-border rounded-md shadow-2xs text-muted-foreground group-hover:text-foreground pointer-events-none">
            Ctrl K
          </kbd>
        </button>

        {/* Mobile trigger: icon button */}
        <button
          type="button"
          className="sm:hidden size-9 rounded-xl border border-border/80 bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer shadow-2xs"
          aria-label={t("openLabel")}
          aria-expanded={open}
          aria-haspopup="listbox"
          data-testid="global-search-mobile"
          onClick={() => openAndFocus()}
          onFocus={() => void ensureIndex()}
        >
          <SearchIcon />
        </button>

        {/* Modal dialog when open */}
        {open ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 sm:px-0">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
              onClick={() => close(true)}
              aria-hidden="true"
            />
            <div
              className="relative z-50 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col max-h-[75vh]"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  close(true);
                }
              }}
            >
              <label className="sr-only" htmlFor={inputId}>
                {t("label")}
              </label>
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background">
                <SearchIcon />
                <input
                  ref={inputRef}
                  id={inputId}
                  className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none border-none"
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  placeholder={t("placeholder")}
                  value={query}
                  aria-expanded={hits.length > 0}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                  onChange={(event) => updateQuery(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button
                  type="button"
                  className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => close(true)}
                >
                  <span className="sr-only">{t("closeLabel")}</span>
                  <kbd className="text-[10px] font-semibold border border-border px-1.5 py-0.5 rounded bg-muted/50">
                    ESC
                  </kbd>
                </button>
              </div>

              {indexUnavailable ? (
                <p className="p-4 text-center text-xs text-muted-foreground">{t("loadFailed")}</p>
              ) : null}

              {hits.length > 0 ? (
                <ul
                  ref={listRef}
                  id={listboxId}
                  role="listbox"
                  aria-label={t("label")}
                  data-combobox-items="true"
                  className="p-2 overflow-y-auto space-y-1 flex-1 max-h-80"
                >
                  {hits.map((hit, index) => {
                    const resolvedPath = resolvePath(hit.path);
                    return (
                      <li key={hit.path} role="presentation">
                        <a
                          id={optionId(index)}
                          role="option"
                          tabIndex={-1}
                          aria-selected={index === activeIndex}
                          href={resolvedPath}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            index === activeIndex
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted"
                          }`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.assign(resolvedPath);
                          }}
                        >
                          <span className="font-bold">{hit.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                            {hit.kind === "p" ? t("province") : t("country")}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {showNoResults ? (
                <p className="p-6 text-center text-xs text-muted-foreground">{t("noResults")}</p>
              ) : null}

              <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <a href={provinceIndexHref} className="hover:text-primary transition-colors">
                  {t("seeAllProvinces")} →
                </a>
                <a href={countryIndexHref} className="hover:text-primary transition-colors">
                  {t("seeAllCountries")} →
                </a>
              </div>

              <div role="status" aria-live="polite" className="sr-only">
                {announcement}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.slot} onBlur={onBlur}>
      <a
        ref={triggerRef as unknown as React.RefObject<HTMLAnchorElement>}
        className={styles.trigger}
        href={provinceIndexHref}
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
            <button
              type="button"
              className={styles.close}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => close(true)}
            >
              <span className={styles.srOnly}>{t("closeLabel")}</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {indexUnavailable ? <p className={styles.notice}>{t("loadFailed")}</p> : null}

          {hits.length > 0 ? (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={t("label")}
              className={styles.results}
            >
              {hits.map((hit, index) => {
                const resolvedPath = resolvePath(hit.path);
                return (
                  <li key={hit.path} role="presentation" className={styles.resultItem}>
                    <a
                      id={optionId(index)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={index === activeIndex}
                      href={resolvedPath}
                      className={`${styles.result} ${index === activeIndex ? styles.resultActive : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={styles.resultName}>{hit.name}</span>
                      <span className={styles.resultKind}>
                        {hit.kind === "p" ? t("province") : t("country")}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showNoResults ? <p className={styles.notice}>{t("noResults")}</p> : null}

          <div className={styles.seeAllRow}>
            <a className={styles.seeAllLink} href={provinceIndexHref}>
              {t("seeAllProvinces")}
            </a>
            <a className={styles.seeAllLink} href={countryIndexHref}>
              {t("seeAllCountries")}
            </a>
          </div>

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
