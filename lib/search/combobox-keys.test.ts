import { describe, expect, it } from "vitest";
import { comboboxKeyAction } from "./combobox-keys";

/**
 * T-168: the keys both search boxes share. -1 means "nothing selected".
 */
describe("comboboxKeyAction", () => {
  it("moves down from nothing selected to the first option, and wraps at the end", () => {
    expect(comboboxKeyAction("ArrowDown", -1, 3)).toEqual({ type: "move", index: 0 });
    expect(comboboxKeyAction("ArrowDown", 2, 3)).toEqual({ type: "move", index: 0 });
  });

  it("moves up from nothing selected to the last option, and wraps at the start", () => {
    expect(comboboxKeyAction("ArrowUp", -1, 3)).toEqual({ type: "move", index: 2 });
    expect(comboboxKeyAction("ArrowUp", 0, 3)).toEqual({ type: "move", index: 2 });
  });

  it("jumps to the first and last option with Home and End", () => {
    expect(comboboxKeyAction("Home", 1, 3)).toEqual({ type: "move", index: 0 });
    expect(comboboxKeyAction("End", 0, 3)).toEqual({ type: "move", index: 2 });
  });

  it("opens the active option with Enter, or the first when none is active", () => {
    expect(comboboxKeyAction("Enter", 1, 3)).toEqual({ type: "select", index: 1 });
    expect(comboboxKeyAction("Enter", -1, 3)).toEqual({ type: "select", index: 0 });
  });

  it("does nothing without options, and ignores other keys", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter"]) {
      expect(comboboxKeyAction(key, -1, 0)).toEqual({ type: "none" });
    }
    expect(comboboxKeyAction("a", 0, 3)).toEqual({ type: "none" });
    expect(comboboxKeyAction("Tab", 0, 3)).toEqual({ type: "none" });
  });
});
