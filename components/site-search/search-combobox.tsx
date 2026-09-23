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
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTrigger,
} from "@/components/ui/dialog";
import { nextActiveIndex } from "@/lib/search/active-option";
import { focusReturnTarget } from "@/lib/search/focus-return";
import { prepareSearchIndex, type PreparedEntry, searchPrepared } from "@/lib/search/match";
import { isSearchIndexPayload } from "@/lib/search/types";

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

/** Keeps the icons at their drawn size inside a flex row. */
const ICON = "flex-none";

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
 * and the negative tabindex preserves the combobox's single-tab-stop invariant.
 *
 * The combobox lives inside a MODAL dialog (T-078): the repo's Base UI `Dialog`, so the focus
 * trap, Escape, outside press and focus return are the primitive's, not this file's. The
 * hand-rolled overlay it replaced let Tab walk out into the page behind while it stayed open,
 * and at 390px returned focus to a desktop trigger that is `display: none` there. Where focus
 * lands on close is {@link focusReturnTarget}'s decision; see `lib/search/focus-return.ts`.
 */
export function SearchCombobox({
  provinceIndexHref,
  countryIndexHref,
  indexUrl,
  pathPrefix,
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
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inFlight = useRef(false);
  /** What opened the dialog: the pressed trigger, or whatever had focus when Ctrl/Cmd+K fired. */
  const openerRef = useRef<HTMLElement | null>(null);

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

  // Keep the active option visible: eight rows overflow the panel's max-height on a short
  // viewport, where ArrowDown would otherwise move an off-screen highlight while
  // `aria-activedescendant` pointed at something nobody can see (review M8).
  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, optionId]);

  const close = useCallback(() => {
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

  /**
   * Opens the dialog and remembers what opened it. The caret is placed by the popup's
   * `initialFocus`, after Base UI has mounted it, so there is no `requestAnimationFrame` race.
   * `<body>` is not an opener: it cannot take focus back, so the triggers stand in for it.
   */
  const openSearch = useCallback(
    (opener: Element | null | undefined) => {
      openerRef.current = opener instanceof HTMLElement && opener !== document.body ? opener : null;
      void ensureIndex();
      setOpen(true);
    },
    [ensureIndex],
  );

  /**
   * The popup's `finalFocus`. The opener first, then the two triggers: whichever is still
   * connected and rendered. `true` hands the decision back to Base UI when none is.
   */
  const returnFocus = useCallback(
    () =>
      focusReturnTarget([openerRef.current, desktopTriggerRef.current, mobileTriggerRef.current]) ??
      true,
    [],
  );

  const prefetchIndex = useCallback(() => void ensureIndex(), [ensureIndex]);

  // Ctrl/Cmd+K toggles from anywhere on the page. Escape is not handled here or anywhere else in
  // this file: the modal dialog owns it, and it is the dialog that returns focus.
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          close();
        } else {
          openSearch(document.activeElement);
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [enableGlobalShortcut, open, openSearch, close]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab is deliberately NOT handled here: the modal dialog keeps it inside the panel.
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

  // Pre-hydration and no-JS: a real link to the alphabetical province index. Both anchors
  // carry `aria-label` because the mobile one is the icon alone, which would otherwise leave a
  // NAMELESS link in the first HTML response — and that is the state the no-JS reader never
  // leaves (review C2).
  if (!mounted) {
    return (
      <div className="flex items-center">
        <a
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 text-xs text-muted-foreground font-medium shadow-2xs"
          href={provinceIndexHref}
          aria-label={t("label")}
          data-testid="global-search"
        >
          <SearchIcon />
          <span>{t("triggerLabel")}...</span>
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
    <div className="flex items-center">
      <Dialog
        open={open}
        onOpenChange={(next, details) => (next ? openSearch(details.trigger) : close())}
      >
        {/* Desktop trigger: command bar button. Base UI marks only the trigger that OPENED the
            dialog as expanded, and Ctrl/Cmd+K opens it with no trigger, so both triggers state
            `aria-expanded` from `open` themselves (T-082); the explicit prop wins the merge. */}
        <DialogTrigger
          ref={desktopTriggerRef}
          data-testid="global-search"
          aria-label={t("openLabel")}
          aria-expanded={open}
          onFocus={prefetchIndex}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground font-medium transition-all cursor-pointer shadow-2xs"
        >
          <SearchIcon />
          <span>{t("triggerLabel")}...</span>
        </DialogTrigger>

        {/* Mobile trigger: icon button */}
        <DialogTrigger
          ref={mobileTriggerRef}
          data-testid="global-search-mobile"
          aria-label={t("openLabel")}
          aria-expanded={open}
          onFocus={prefetchIndex}
          className="sm:hidden size-9 rounded-xl border border-border/80 bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer shadow-2xs"
        >
          <SearchIcon />
        </DialogTrigger>

        {/* THE COMMAND DIALOG, AND IT IS PORTALLED OUT OF THE HEADER ON PURPOSE (T-067).
            The triggers above live inside `<nav>`, and that `<nav>` paints itself with
            `backdrop-blur-xl`. A `backdrop-filter` makes its element a CONTAINING BLOCK for
            every `position: fixed` descendant (CSS Filter Effects §2.2, the same rule
            `transform` and `filter` carry), so a `fixed inset-0` rendered in place resolved
            against the 64px header box rather than the viewport: measured at
            `{top: 0, left: 0, width: 1467, height: 64}`. What a reader saw was a dark band
            across the top of the page and nothing over the content the palette covers.
            `DialogPortal` renders into `document.body`, which has no filtered ancestor.
            The overlay is TRANSPARENT rather than the primitive's dimmed default: it exists
            to catch the click that closes the palette, not to dim the page.
            `aria-modal` is stated because Base UI hides the page behind a modal dialog with
            `aria-hidden` but does not write the attribute itself; the name is `aria-label`
            because a visible title would add a heading to every page's outline. */}
        <DialogPortal>
          <DialogOverlay className="bg-transparent backdrop-blur-none" />
          <DialogPopup
            aria-modal="true"
            aria-label={t("label")}
            initialFocus={inputRef}
            finalFocus={returnFocus}
            className="fixed top-[12vh] left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col max-h-[75vh]"
          >
            <label className="sr-only" htmlFor={inputId}>
              {t("label")}
            </label>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background">
              <SearchIcon />
              <input
                ref={inputRef}
                id={inputId}
                /* No `outline-none`: this input's row draws no ring of its own, so
                   suppressing here would leave the command dialog's only control with no
                   visible focus once T-053 made suppression work. Site default applies. */
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground border-none"
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
              <DialogClose className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer">
                <span className="sr-only">{t("closeLabel")}</span>
                <CloseIcon />
              </DialogClose>
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
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

/** Decorative magnifier; every control that uses it carries its own accessible name. */
/**
 * The command dialog's close glyph. An `X`, not the `ESC` legend it replaced (T-067): the
 * legend named a key a touch reader does not have, and it sat in a control whose accessible
 * name already says "close" — two different promises in one 28px box. Escape still closes.
 */
function CloseIcon() {
  return (
    <svg
      className={ICON}
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
      <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className={ICON}
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
