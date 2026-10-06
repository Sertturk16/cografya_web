import { nextActiveIndex } from "./active-option";

/**
 * What a key does in a search combobox, shared by the header box and the homepage hero box
 * (T-168), so the two cannot drift apart again. Pure, so the node-only test config reaches it.
 *
 * `activeIndex` is -1 when nothing is selected. Enter with nothing selected opens the FIRST
 * option: typing a name and pressing Enter is the intent (review M9 on the header box).
 * Escape and Tab are not here: the header's modal dialog owns both, and the hero handles
 * Escape itself because it has no dialog.
 */
export type ComboboxKeyAction =
  | { readonly type: "move"; readonly index: number }
  | { readonly type: "select"; readonly index: number }
  | { readonly type: "none" };

export function comboboxKeyAction(
  key: string,
  activeIndex: number,
  optionCount: number,
): ComboboxKeyAction {
  if (optionCount <= 0) return { type: "none" };
  switch (key) {
    case "ArrowDown":
      return { type: "move", index: nextActiveIndex(activeIndex, optionCount, 1) };
    case "ArrowUp":
      return { type: "move", index: nextActiveIndex(activeIndex, optionCount, -1) };
    case "Home":
      return { type: "move", index: 0 };
    case "End":
      return { type: "move", index: optionCount - 1 };
    case "Enter":
      return { type: "select", index: activeIndex >= 0 ? activeIndex : 0 };
    default:
      return { type: "none" };
  }
}
