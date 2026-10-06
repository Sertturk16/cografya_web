"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { searchAnnouncement } from "@/lib/search/announcement";
import { comboboxKeyAction } from "@/lib/search/combobox-keys";
import type { SearchPanelState } from "@/lib/search/panel-state";

interface SearchComboboxOptions {
  /** The panel is showing (the header's dialog is open, the hero's suggestions are up). */
  readonly open: boolean;
  readonly hasQuery: boolean;
  readonly panelState: SearchPanelState;
  readonly optionCount: number;
  /** Enter on an option (or on the first, when none is active). */
  readonly onSelect: (index: number) => void;
}

/**
 * The ARIA 1.2 combobox-with-listbox behaviour both search boxes share (T-168): the header's
 * command dialog and the homepage hero's inline panel. Each box keeps its own markup and spreads
 * these props onto it:
 *
 * - `inputProps` on the `<input>`: `role="combobox"`, `aria-expanded` (only while options are
 *   showing), `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`.
 * - `listboxProps` on the `role="listbox"` `<ul>`, whose `<li>` wrappers are
 *   `role="presentation"` so the options are its OWNED elements; without that the intervening
 *   listitem breaks the chain and the "1 of 8" position announcements never happen.
 * - `optionProps(index)` on each option: a real `<a href>` (middle-click keeps working) with
 *   `role="option"` and `tabIndex={-1}`, so the combobox stays a single tab stop.
 * - `announcement` in a polite `role="status"` region, on a 250 ms debounce: WCAG 4.1.3 without
 *   narrating every keystroke ({@link searchAnnouncement} decides what it says).
 *
 * The active option is -1 until an arrow key moves it, and `resetActive` is called wherever the
 * query changes, in the event handler, so a highlight never survives into another result set.
 */
export function useSearchCombobox({
  open,
  hasQuery,
  panelState,
  optionCount,
  onSelect,
}: SearchComboboxOptions) {
  const t = useTranslations("Search");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);

  // The whole decision lives inside the timeout, including "say nothing": a synchronous setState
  // in the effect body would cascade a render on every character typed.
  useEffect(() => {
    const timer = setTimeout(() => {
      const said = searchAnnouncement({ open, hasQuery, panelState, hitCount: optionCount });
      setAnnouncement(
        said === null
          ? ""
          : said.key === "resultCount"
            ? t("resultCount", { count: said.count })
            : t(said.key),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [open, hasQuery, panelState, optionCount, t]);

  // Keep the active option visible: eight rows overflow the panel's max-height on a short
  // viewport, where ArrowDown would otherwise move an off-screen highlight while
  // `aria-activedescendant` pointed at something nobody can see (review M8).
  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, optionId]);

  const resetActive = useCallback(() => setActiveIndex(-1), []);

  /** Applies the shared keys; `true` when the key was one of them. */
  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>): boolean => {
    const action = comboboxKeyAction(event.key, activeIndex, optionCount);
    if (action.type === "none") return false;
    event.preventDefault();
    if (action.type === "move") setActiveIndex(action.index);
    else onSelect(action.index);
    return true;
  };

  const expanded = open && optionCount > 0;

  return {
    activeIndex,
    setActiveIndex,
    resetActive,
    handleKey,
    announcement,
    inputProps: {
      id: inputId,
      role: "combobox",
      "aria-expanded": expanded,
      "aria-controls": listboxId,
      "aria-autocomplete": "list",
      "aria-activedescendant": expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    } as const,
    listboxProps: { ref: listRef, id: listboxId, role: "listbox" } as const,
    optionProps: (index: number) =>
      ({
        id: optionId(index),
        role: "option",
        tabIndex: -1,
        "aria-selected": index === activeIndex,
        onMouseEnter: () => setActiveIndex(index),
      }) as const,
  };
}
