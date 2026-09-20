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
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { nextActiveIndex } from "@/lib/search/active-option";
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

/* ---------------------------------------------------------------------------------------------
 * THE HEADER SEARCH'S OWN CHROME, AS BRIDGE-TOKEN UTILITIES.
 *
 * T-033 retired `site-search.module.css`. Every colour in it was a raw Terra token and `.dark`
 * redefines none of the thirteen, so the panel rendered as a WHITE card carrying `--color-ink`
 * text on a dark page: 1.14:1 for the input's own text against dark `--card` #121e21, measured
 * with `lib/theme/contrast.ts`. Each string below is the deleted rule, value for value, with
 * colour rebound to the bridge. Comments that recorded a MEASUREMENT or a defect came with it;
 * the ones that only restated CSS did not.
 *
 * `min-[70rem]` is the stylesheet's `@media (min-width: 70rem)` verbatim — the measured
 * single-row header breakpoint, which is not one of Tailwind's own (lg is 64rem, xl 80rem).
 *
 * The strings are HOISTED rather than inlined on the JSX because
 * `lib/test-support/converted-floor.ts`'s extractor reads a top-level `const NAME = …;` and hands
 * back `null` for an inline class string — a floor left inline pins nothing, and does it quietly.
 * `search-combobox.structure.test.ts` carries the pin for the 28px one.
 *
 * Unchanged geometry rule: the SLOT is fixed-size and the island only swaps what is inside it, so
 * hydration and opening never move the header (CLS).
 * ------------------------------------------------------------------------------------------ */

/**
 * No width or height of its own on mobile: the trigger below IS the box, and the header must not
 * grow by a single pixel with the search closed.
 *
 * `ml-auto` on the FIRST item of the trailing group pushes that whole group — this slot and every
 * sibling after it — to the header's right edge. Below the nav-collapse breakpoint nothing else
 * fills that role; from 70rem up the desktop nav's own auto margin already does, so the slot goes
 * back to normal flow and becomes the panel's containing block instead (see PANEL).
 */
const SLOT = "flex items-center ml-auto min-[70rem]:relative min-[70rem]:ml-0";

/**
 * 28x28, and the exact number is MEASURED, not chosen for looks. The binding acceptance criterion
 * is that the header does not grow by a single pixel with search closed, and on a 390px viewport
 * the trigger shares the header's first row with the brand link, whose line box is 30.72px: at
 * 44px the header grew 177 -> 190px, at 32px it still grew by 1.09px. 28px sits below the brand
 * with ~2.7px of headroom and still clears the WCAG 2.5.8 (AA) 24x24 target floor.
 *
 * `border-input`, not `border-border`. A control boundary must be perceivable and WCAG 1.4.11 asks
 * 3:1 of it; `--input` is the bridge token for exactly that job, and its light value IS the
 * `--color-taupe` this rule already carried (3.86:1 on `--card`, 3.64:1 on the header's
 * `--background` plate). Unlike the raw token it is redefined in `.dark` — #5c8189, 4.02:1 on dark
 * `--card`. `border-border` is the decorative edge at 1.45:1 light / 1.53:1 dark and was rejected
 * here for that reason when the rule was first written.
 *
 * NOTHING here hides the collapsed trigger, and that is now correct rather than a gap. The
 * stylesheet carried a `.trigger[hidden] { visibility: hidden }` rule and a comment saying the
 * `hidden` attribute does not hide this control on its own, because the repo shipped no
 * `[hidden]` reset and the author-origin `display: inline-flex` beat the UA sheet. **Both halves
 * of that are false today** and this conversion re-measured rather than carrying the comment
 * over: Tailwind v4's preflight ships `[hidden]:where(:not([hidden="until-found"])) { display:
 * none !important }` (`node_modules/tailwindcss/preflight.css:396`), which is author-origin and
 * important, so it beats `inline-flex` outright. Measured through CDP on the open panel at 390
 * and 1280: the trigger matches that rule, computes `display: none`, has a 0x0 rect and is not
 * tabbable — so the WCAG 4.1.2 defect the old rule existed for (a focusable, NAMELESS control
 * behind an open panel) cannot occur. A `[&[hidden]]:invisible` utility was written here first
 * and removed once measured: it matched, set `visibility: hidden`, and changed nothing.
 *
 * The layout-shift worry that chose `visibility` over `display` is also measured away in this
 * header: nav height is 65px with the panel closed AND open, at both widths.
 */
const TRIGGER =
  "inline-flex items-center justify-center gap-1.5 min-w-[28px] min-h-[28px] px-[7px] " +
  "rounded-lg border border-input bg-card text-muted-foreground no-underline " +
  "text-[0.9rem] font-semibold hover:border-primary hover:text-primary min-[70rem]:justify-start";

/**
 * Hidden on narrow viewports: the trigger collapses to the icon alone so it fits beside the brand
 * on the header's FIRST row and adds no row of its own. From the measured breakpoint up it shows a
 * SHORT word next to the icon, and the trigger has no fixed width — it sizes to its content.
 * Measured why: with a 210px fixed trigger the Turkish header needed 985px of a 984px line at
 * 1024px wide and wrapped the nav onto a second row.
 */
const TRIGGER_TEXT = "hidden whitespace-nowrap min-[70rem]:inline";

const ICON = "flex-none";

/**
 * The open panel is ABSOLUTELY positioned, so opening the search overlays content instead of
 * pushing it — no layout shift at any viewport.
 *
 * WHICH element it is positioned against changes with the viewport, and that is the point.
 * Narrow: the slot is unpositioned, so the panel resolves against the sticky header and spans the
 * viewport with a 16px inset — the mobile sheet. Anchoring it to the slot there was a real bug:
 * the trigger sits ~250px in on a 390px screen, so a right-aligned 92vw panel started at -109px
 * and the result names were clipped off-screen. Wide: the slot becomes the containing block, so
 * the panel hangs directly under the trigger. The 15px top margin there is measured — the
 * trigger's bottom edge sits 42px below the header's top and the header is 57px tall, so 15px puts
 * the panel flush with the header's lower border instead of overlapping it.
 *
 * `rounded-[16px]` is the deleted rule's `var(--radius-lg)`, which resolves to 16px at runtime;
 * Tailwind's own `rounded-lg` is `--radius` (10px) and `rounded-2xl` is 18px, so neither spells it.
 * `shadow-xl` replaces a hand-rolled `rgb(43 38 34 / 14%)` shadow — a raw Terra ink frozen at its
 * light value — and is what the header's sibling dropdowns already use.
 *
 * NOT `components/ui/card.tsx`, and the exemption is measured rather than asserted. This is a
 * popover, not a section panel: `Card`'s `panel` variant is `rounded-3xl border border-border
 * bg-card p-6 sm:p-8`, which is a 22px radius, 24-32px of padding on a dropdown whose padding is
 * 10px, and a `border-border` edge at 1.45:1 light / 1.53:1 dark where this panel needs the same
 * 3:1 control boundary as the trigger it hangs from (`border-input`, 3.86:1 / 4.02:1 on `--card`).
 * The header's sibling dropdowns hand-draw their surface for the same reason.
 */
const PANEL =
  "absolute top-full left-4 right-4 mt-2 z-50 p-2.5 rounded-[16px] border border-input " +
  "bg-card shadow-xl min-[70rem]:left-0 min-[70rem]:right-auto min-[70rem]:w-[420px] " +
  "min-[70rem]:mt-[15px]";

/**
 * ONE ring, on the OUTER box, and it is the row that owns it.
 *
 * Before the rule existed the row drew its border while the `<input>` inside it drew the global
 * 3px ring, so a focused search box showed two nested rings clipping each other. The ring belongs
 * to the row, which is what the reader perceives as the search box.
 *
 * Scoped to the INPUT, not `:focus-within`. The row has a second focusable child — the close
 * button, which is genuinely Tab-reachable — and with `:focus-within` the row drew its ring at the
 * same time as the button drew the global one: two concentric rings on the very tab stop this rule
 * was written to clean up, and the outer one then named the wrong component. `input:focus` rather
 * than `:focus-visible` keeps today's behaviour exactly: a text input matches `:focus-visible` on
 * pointer focus too, so the box is ringed when clicked into.
 *
 * `outline-ring`, not the `--color-accent` the deleted rule painted. That raw token is frozen at
 * #276b70 in both themes: on the panel's old frozen-white ground it measured 6.13:1, but the panel
 * is `bg-card` now, and #276b70 on dark `--card` is 2.78:1 — a focus ring BELOW WCAG 1.4.11's 3:1
 * floor for the one user who cannot do without it. `--ring` is redefined in `.dark` and lands at
 * 5.44:1 dark / 6.13:1 light on `--card`, at the same 3px width and 2px offset.
 */
const INPUT_ROW =
  "flex items-center gap-2 px-2.5 rounded-lg border border-input text-muted-foreground " +
  "has-[input:focus]:outline-3 has-[input:focus]:outline-offset-2 has-[input:focus]:outline-ring";

/**
 * Suppressing the INNER ring needs `!`, and that is a fact about layers rather than a shortcut.
 *
 * `app/globals.css`'s `:focus-visible { outline: 3px solid var(--ring) }` sits OUTSIDE every
 * `@layer`, and an unlayered rule beats every rule in `@layer utilities` whatever its specificity —
 * the trap that file's own T-041 note records. A plain `focus-visible:outline-none` is a layered
 * utility, so it loses and the input draws the global ring INSIDE the row's: the two concentric
 * rings again. Measured, not assumed: the v2 command dialog's input carries `outline-none` today
 * and its computed outline is still `3px solid`. The important form wins because importance
 * reverses layer order. The ring is not lost, it moved — INPUT_ROW above owns it.
 *
 * `text-[1rem]` rather than `text-base`, and it is the same class of trap: `text-base` would also
 * set `line-height: 1.5`, which the deleted rule did not — the input inherits 1.6 from the body.
 */
const INPUT =
  "flex-1 min-w-0 min-h-10 border-none bg-transparent font-sans text-[1rem] text-foreground " +
  "placeholder:text-muted-foreground focus-visible:outline-none!";

const CLOSE =
  "inline-flex items-center justify-center min-w-[32px] min-h-[32px] border-none bg-transparent " +
  "cursor-pointer text-muted-foreground text-[1.3rem] leading-none hover:text-primary";

/** Eight rows overflow a short viewport, so the listbox scrolls rather than the panel growing. */
const RESULTS = "list-none mt-2 mb-0 p-0 max-h-[min(50vh,360px)] overflow-y-auto";

const RESULT_ITEM = "m-0";

const RESULT =
  "flex items-center justify-between gap-2.5 px-2.5 py-[9px] rounded-lg text-link no-underline " +
  "font-semibold text-[0.95rem] hover:bg-chip";

/** The highlighted option, and the hover state above paint the same ground on purpose. */
const RESULT_ACTIVE = "bg-chip";

const RESULT_NAME = "min-w-0 wrap-anywhere";

/**
 * A TEXT badge: the province/country distinction is never carried by colour alone.
 * `text-chip-foreground` on `bg-chip` is 6.59:1 light and 8.01:1 dark.
 */
const RESULT_KIND =
  "flex-none px-2 py-0.5 rounded-full bg-chip text-chip-foreground text-[0.75rem] font-bold";

/** `mb-0` is deliberate: this is a `<p>`, and dropping the explicit zero lets a base margin back. */
const NOTICE = "mt-2.5 mx-1 mb-0 text-muted-foreground text-[0.9rem]";

/**
 * The closing row: province index + country index, side by side. The separator lives on the ROW,
 * once, so the two links do not each draw one; a gap rather than a margin so the row stays
 * symmetric when it wraps on a narrow panel.
 */
const SEE_ALL_ROW = "flex flex-wrap gap-x-[18px] gap-y-0.5 mt-2 pt-0.5 border-t border-border";

const SEE_ALL_LINK =
  "px-2.5 py-[9px] text-link no-underline text-[0.9rem] font-bold hover:text-primary hover:underline";

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
      <div className={SLOT}>
        <a
          ref={triggerRef as unknown as React.RefObject<HTMLAnchorElement>}
          className={TRIGGER}
          href={provinceIndexHref}
          aria-label={t("label")}
        >
          <SearchIcon />
          <span className={TRIGGER_TEXT}>{t("triggerLabel")}</span>
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
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground font-medium transition-all cursor-pointer shadow-2xs"
        >
          <SearchIcon />
          <span>{t("triggerLabel")}...</span>
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

        {/* THE COMMAND DIALOG, AND IT IS PORTALLED OUT OF THE HEADER ON PURPOSE (T-067).
            The trigger above lives inside `<nav>`, and that `<nav>` paints itself with
            `backdrop-blur-xl`. A `backdrop-filter` makes its element a CONTAINING BLOCK for
            every `position: fixed` descendant (CSS Filter Effects §2.2, the same rule
            `transform` and `filter` carry), so this dialog's `fixed inset-0` resolved
            against the 64px header box rather than the viewport: measured at
            `{top: 0, left: 0, width: 1467, height: 64}`. What a reader saw was a dark band
            across the top of the page and nothing over the content the palette covers.
            Widening the box would not fix it and removing the header's blur would cost the
            header its own look, so the dialog is rendered into `document.body`, which has no
            filtered ancestor. `open` is only ever true after a press, so there is no server
            render of this branch — the `mounted` guard is belt and braces for a future
            caller that opens it from state.
            The backdrop that band came from is now TRANSPARENT rather than `bg-black/60`:
            it exists to catch the click that closes the palette, not to dim the page. */}
        {open && mounted
          ? createPortal(
              <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 sm:px-0">
                <div className="fixed inset-0" onClick={() => close(true)} aria-hidden="true" />
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
                      /* No `outline-none`, unlike the `INPUT` constant above: that one sits in a row
                     that owns the ring (`has-[input:focus]:outline-3`), this one's row does not,
                     so suppressing here would leave the command dialog's only control with no
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
                    <button
                      type="button"
                      className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => close(true)}
                    >
                      <span className="sr-only">{t("closeLabel")}</span>
                      <CloseIcon />
                    </button>
                  </div>

                  {indexUnavailable ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      {t("loadFailed")}
                    </p>
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
                    <p className="p-6 text-center text-xs text-muted-foreground">
                      {t("noResults")}
                    </p>
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
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div className={SLOT} onBlur={onBlur}>
      <a
        ref={triggerRef as unknown as React.RefObject<HTMLAnchorElement>}
        className={TRIGGER}
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
        <span className={TRIGGER_TEXT}>{t("triggerLabel")}</span>
      </a>

      {open ? (
        <div className={PANEL}>
          <label className="sr-only" htmlFor={inputId}>
            {t("label")}
          </label>
          <div className={INPUT_ROW}>
            <SearchIcon />
            <input
              ref={inputRef}
              id={inputId}
              className={INPUT}
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
              className={CLOSE}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => close(true)}
            >
              <span className="sr-only">{t("closeLabel")}</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {indexUnavailable ? <p className={NOTICE}>{t("loadFailed")}</p> : null}

          {hits.length > 0 ? (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={t("label")}
              className={RESULTS}
            >
              {hits.map((hit, index) => {
                const resolvedPath = resolvePath(hit.path);
                return (
                  <li key={hit.path} role="presentation" className={RESULT_ITEM}>
                    <a
                      id={optionId(index)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={index === activeIndex}
                      href={resolvedPath}
                      className={`${RESULT} ${index === activeIndex ? RESULT_ACTIVE : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={RESULT_NAME}>{hit.name}</span>
                      <span className={RESULT_KIND}>
                        {hit.kind === "p" ? t("province") : t("country")}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showNoResults ? <p className={NOTICE}>{t("noResults")}</p> : null}

          <div className={SEE_ALL_ROW}>
            <a className={SEE_ALL_LINK} href={provinceIndexHref}>
              {t("seeAllProvinces")}
            </a>
            <a className={SEE_ALL_LINK} href={countryIndexHref}>
              {t("seeAllCountries")}
            </a>
          </div>

          <div role="status" aria-live="polite" className="sr-only">
            {announcement}
          </div>
        </div>
      ) : null}
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
