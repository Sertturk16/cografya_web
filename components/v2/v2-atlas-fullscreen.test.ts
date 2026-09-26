import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  jsxElementsOf,
  readSource,
  type ScannedElement,
} from "@/lib/test-support/composition-scan";

/**
 * T-118, T-119: the atlas, earthquake and sea maps go fullscreen with everything the map needs. Once the Fullscreen API
 * engages only the target's subtree is on screen, so the toggle, the toolbar, the selection card
 * and the rotate hint must all sit inside the element holding the landscape ref (the credit is
 * `v2-fullscreen-credit.test.ts`'s job).
 */
interface Surface {
  file: string;
  /** The toolbar that must come along, where the map has one over or above it. */
  toolbar?: (el: ScannedElement) => boolean;
  /** The map zooms with the wheel (T-116); `/deprem` and `/deniz` have no zoom (T-119). */
  wheel: boolean;
}

const SURFACES: Surface[] = [
  {
    file: "v2-world-map-explorer.tsx",
    toolbar: (el: ScannedElement) => el.attributes.has("data-map-toolbar"),
    wheel: true,
  },
  {
    file: "v2-turkey-map-explorer.tsx",
    toolbar: (el: ScannedElement) => el.attributes.get("ref") === "toolbarRef",
    wheel: true,
  },
  { file: "v2-earthquake-explorer.tsx", wheel: false },
  { file: "v2-marine-map-explorer.tsx", wheel: false },
];

const surfaces = SURFACES.map((s) => ({
  ...s,
  path: fileURLToPath(new URL(`./${s.file}`, import.meta.url)),
}));

const ancestorsOf = (elements: readonly ScannedElement[], index: number): number[] => {
  const chain: number[] = [];
  for (let at = elements[index]?.parent ?? null; at !== null; at = elements[at]?.parent ?? null) {
    chain.push(at);
  }
  return chain;
};

describe.each(surfaces)("$file fullscreen (T-118, T-119)", ({ path, toolbar, wheel }) => {
  const source = readSource(path);
  const elements = jsxElementsOf(path);
  const target = elements.findIndex((el) => el.attributes.get("ref") === "figureRef");

  it("makes the figure the fullscreen target", () => {
    expect(source).toContain("const landscape = useLandscapeMode(figureRef)");
    expect(elements[target]?.tag).toBe("figure");
  });

  it("keeps the toggle, toolbar, card and rotate hint inside it", () => {
    const find = (pred: (el: ScannedElement) => boolean, name: string) => {
      const i = elements.findIndex(pred);
      expect(i, `${name} not found`).toBeGreaterThan(-1);
      expect(ancestorsOf(elements, i), `${name} is outside the fullscreen target`).toContain(
        target,
      );
      return elements[i] as ScannedElement;
    };
    const toggle = find((el) => el.tag === "MapFullscreenToggle", "toggle");
    expect(toggle.attributes.get("active")).toBe("landscape.active");
    expect(toggle.attributes.get("onToggle")).toBe("landscape.toggle");
    if (toolbar) find(toolbar, "toolbar");
    find((el) => el.tag === "MapSelectionCard", "selection card");
    const hint = find((el) => el.tag === "MapRotateHint", "rotate hint");
    expect(hint.attributes.get("onDismiss")).toBe("landscape.exit");
  });

  it.runIf(wheel)("lets a plain wheel zoom in fullscreen (T-116)", () => {
    expect(source).toMatch(/plainWheelZooms: landscape\.active/);
  });
});
