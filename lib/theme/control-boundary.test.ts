import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GRAPHICAL_MIN, ratio } from "./contrast";

/**
 * WCAG 1.4.11 for the boundary that identifies a control.
 *
 * ## Why this is a real unit test and not a source scan
 *
 * The rest of this repo's theme tripwires assert that a token is DECLARED and BOUND, because
 * a source scan is all a node-environment suite can do about markup. This one can do better:
 * the question is arithmetic over two hex values, so `lib/theme/contrast.ts` answers it
 * directly. A comment claiming "3.86:1" is a promise; this recomputes it.
 *
 * ## What went wrong, and why it stayed invisible
 *
 * `--input` was declared in both blocks from the start and read by NOTHING — `grep
 * border-input components/` came back empty. Every control bound `--border` instead, so the
 * edge of a text field measured 1.45:1 in light and 1.53:1 in dark. Identical in both themes,
 * which is exactly why it never looked like a defect: a dark-mode bug announces itself by
 * being worse in the dark, and this one was not.
 *
 * The second half of the fix is the binding assertion below. Raising the token without using
 * it is the state this repo was already in.
 */

const CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, " ");

/**
 * The surfaces a control can sit on. A field lives on a card or on the page; a Progress track
 * and an `outline` Button can also sit on `--muted`, which is the tightest of the three and
 * therefore the one that decides the token.
 */
const LIGHT_SURFACES = { card: "#ffffff", background: "#fbf8f3", muted: "#f1e9de" } as const;
const DARK_SURFACES = { card: "#121e21", background: "#0b1416", muted: "#1b2b2f" } as const;

const LIGHT_INPUT = "#8a8078"; // --color-taupe
const DARK_INPUT = "#5c8189";

describe("the control boundary clears WCAG 1.4.11", () => {
  it("positive control — the maths is live and agrees with the old failing values", () => {
    // The values this replaced. If these ever come back as passes, the helper is broken.
    expect(ratio("#ddd5cc", "#ffffff")).toBeLessThan(GRAPHICAL_MIN);
    expect(ratio("#334c52", "#121e21")).toBeLessThan(GRAPHICAL_MIN);
  });

  it.each(Object.entries(LIGHT_SURFACES))("light --input on --%s", (_name, surface) => {
    expect(ratio(LIGHT_INPUT, surface)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it.each(Object.entries(DARK_SURFACES))("dark --input on --%s", (_name, surface) => {
    expect(ratio(DARK_INPUT, surface)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it("the hexes asserted here are the hexes globals.css actually ships", () => {
    // Otherwise this file measures two numbers nobody renders.
    expect(CSS).toContain("--color-taupe: #8a8078");
    expect(CSS).toContain("--input: var(--color-taupe)");
    expect(CSS).toContain(`--input: ${DARK_INPUT}`);
  });

  it("--border is deliberately NOT held to the same floor", () => {
    // A card edge, a divider and a table rule are decorative grouping. 1.4.11 does not ask
    // 3:1 of them, and lifting every one to 3:1 turns the interface into a wireframe. This
    // asserts the distinction is real rather than an accident waiting to be "fixed".
    expect(ratio("#ddd5cc", "#ffffff")).toBeLessThan(GRAPHICAL_MIN);
    expect(CSS).toContain("--border: var(--color-border)");
  });
});

/**
 * The binding half. A raised token that nothing reads is the bug this task started from.
 */
describe("every control actually binds --input", () => {
  const UI = fileURLToPath(new URL("../../components/ui/", import.meta.url));
  const read = (name: string) => readFileSync(`${UI}${name}`, "utf8");

  const CONTROLS = [
    "input.tsx",
    "textarea.tsx",
    "select.tsx",
    "custom-select.tsx",
    "progress.tsx",
  ] as const;

  it("positive control — the directory was read", () => {
    expect(readdirSync(UI).length).toBeGreaterThan(20);
  });

  it.each(CONTROLS)("%s draws its boundary with border-input", (file) => {
    expect(read(file)).toContain("border-input");
  });

  it("the outline Button counts as a control boundary too", () => {
    // It is a pressable target whose only edge IS its boundary; a ghost Button has no border
    // to hold to the floor, which is why only this variant is asserted.
    expect(read("button.tsx")).toContain("border border-input bg-card");
  });

  it("no control has been left on the decorative token", () => {
    for (const file of CONTROLS) {
      const source = read(file).replace(/\/\*[\s\S]*?\*\//g, " ");
      // `border-border` may still appear for genuine surfaces inside these files — the
      // custom-select popover panel and its internal divider are surfaces, not boundaries —
      // so this asserts the CONTROL's own class list, not the whole file.
      expect(source).not.toMatch(/false:\s*"border-border/);
    }
  });
});
