# Atlas Fullscreen Button Implementation Plan (T-118)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dunya` and `/turkiye` get the game/tool pages' top-left fullscreen button, with toolbar, selection card and credit working inside fullscreen.

**Architecture:** Each explorer's `<figure>` becomes the `useLandscapeMode` target. A new shared `map-fullscreen-controls.tsx` holds the toggle, the rotate hint and the inline fullscreen layout styles. `useMapBoxMetrics` takes a list of overlays so `/turkiye`'s labels clear the new toggle.

**Tech Stack:** Next.js 16, React 19 (ref as a prop), next-intl, Tailwind v4, vitest (node env, no jsdom; component checks are source/composition scans).

**Spec:** `docs/superpowers/specs/2026-09-26-t118-atlas-fullscreen-design.md`

## Global Constraints

- Fullscreen logic only through `useLandscapeMode` (`lib/map/use-landscape-mode.client.ts`); never reimplemented.
- Fullscreen layout overrides are INLINE STYLE, never conditional classes on the map box (composition scanner reads `aspect-[…]` literally).
- Labels: `MapExplorer.fullscreenEnter` "Tam ekranda aç" / `fullscreenExit` "Tam ekrandan çık", `rotateHint`, `rotateDismiss`, same strings as `ToolWorkbench`.
- Corners in fullscreen: toggle top-left, toolbar top-right, card bottom-left, credit ⓘ bottom-right.
- Card width in fullscreen: `min(24rem, calc(100% - 64px))`.
- `/turkiye` map box in fullscreen: `maxHeight: "100vw"`.
- Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test`.
- Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Dark mode on the iOS fallback: the hook paints the fallback with `var(--color-bg)`, a light-only token (parchment); `/turkiye`'s portrait letterbox would show it in dark. Task 1 moves it to `var(--background)` and pins it.
2. Selecting a country in fullscreen when the credit is still open: the click collapses the credit (T-117 first-interaction rule), and the card's width cap keeps it off the ⓘ. Checked in the browser (Task 5).
3. Esc / browser exit while a card is open: the card stays selected and returns to its page position. Checked in the browser (Task 5).
4. Portrait phone fallback (rotate hint showing) with a card open: card sits above the hint (Task 2 pins the offset math).
5. `/turkiye` neighbour labels under the new top-left toggle: Task 3 pins that the toggle is a measured overlay.

---

### Task 1: Shared fullscreen controls, copy and fallback background

**Files:**

- Create: `components/v2/map-fullscreen-controls.tsx`
- Create: `components/v2/map-fullscreen-controls.test.ts`
- Modify: `lib/map/use-landscape-mode.client.ts` (export `FALLBACK_STYLE`, background token)
- Modify: `lib/map/use-landscape-mode.test.ts`
- Modify: `messages/tr.json`, `messages/en.json` (`MapExplorer` namespace)
- Modify: `components/v2/map-selection-card.tsx` (accept `style`)

**Interfaces:**

- Produces:
  - `MapFullscreenToggle({ active: boolean; onToggle: () => void; ref?: React.Ref<HTMLDivElement> })`
  - `MapRotateHint({ onDismiss: () => void; onHeight: (px: number) => void })`
  - `fullscreenCardStyle(rotateHintHeight: number): React.CSSProperties`
  - `FULLSCREEN_FIGURE`, `FULLSCREEN_STAGE`, `FULLSCREEN_MAP_BOX`, `FULLSCREEN_TOOLBAR`: `React.CSSProperties`
  - `MapSelectionCard` gains `style?: React.CSSProperties`

- [ ] **Step 1: Write the failing tests**

`components/v2/map-fullscreen-controls.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { fullscreenCardStyle, FULLSCREEN_MAP_BOX } from "./map-fullscreen-controls";

const source = readFileSync(join(__dirname, "map-fullscreen-controls.tsx"), "utf8");

describe("atlas fullscreen controls (T-118)", () => {
  it("keeps the card in the bottom-left corner, off the credit's ⓘ", () => {
    expect(fullscreenCardStyle(0)).toMatchObject({
      position: "absolute",
      left: 12,
      bottom: 12,
      margin: 0,
      maxWidth: "min(24rem, calc(100% - 64px))",
    });
  });

  it("lifts the card above the rotate hint while it shows", () => {
    expect(fullscreenCardStyle(48).bottom).toBe(12 + 48 + 8);
  });

  it("lets the map box fill the screen with no corners or borders", () => {
    expect(FULLSCREEN_MAP_BOX).toMatchObject({
      flex: "1 1 0%",
      minHeight: 0,
      aspectRatio: "auto",
      borderRadius: 0,
      borderWidth: 0,
    });
  });

  it("names the toggle from the catalogue, both directions", () => {
    expect(source).toMatch(/aria-pressed=\{active\}/);
    expect(source).toMatch(/active \? t\("fullscreenExit"\) : t\("fullscreenEnter"\)/);
    for (const messages of [tr, en]) {
      for (const key of ["fullscreenEnter", "fullscreenExit", "rotateHint", "rotateDismiss"]) {
        expect(messages.MapExplorer[key as keyof typeof messages.MapExplorer], key).toBe(
          messages.ToolWorkbench[key as keyof typeof messages.ToolWorkbench],
        );
      }
    }
  });
});
```

Append to `lib/map/use-landscape-mode.test.ts` (add `FALLBACK_STYLE` to its existing import from `./use-landscape-mode.client`):

```ts
describe("fallback layout colour", () => {
  it("paints the fallback with the theme background, which dark mode redefines", () => {
    // `--color-bg` is the light parchment only; `--background` is what `.dark` switches.
    expect(FALLBACK_STYLE.background).toBe("var(--background)");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run components/v2/map-fullscreen-controls.test.ts lib/map/use-landscape-mode.test.ts`
Expected: FAIL (module `./map-fullscreen-controls` not found; `FALLBACK_STYLE` not exported).

- [ ] **Step 3: Implement**

In `lib/map/use-landscape-mode.client.ts`: `const FALLBACK_STYLE` → `export const FALLBACK_STYLE`, and `background: "var(--color-bg)"` → `background: "var(--background)"`.

`messages/tr.json`, inside `"MapExplorer"` after `"statArea"`:

```json
    "fullscreenEnter": "Tam ekranda aç",
    "fullscreenExit": "Tam ekrandan çık",
    "rotateHint": "Daha geniş bir görünüm için telefonunu yatay çevir.",
    "rotateDismiss": "Anladım"
```

`messages/en.json`, same place:

```json
    "fullscreenEnter": "View fullscreen / in landscape",
    "fullscreenExit": "Exit fullscreen",
    "rotateHint": "Turn your phone sideways for a wider view.",
    "rotateDismiss": "Got it"
```

`components/v2/map-selection-card.tsx`: add `style` to the props type (`style?: React.CSSProperties;`), destructure it, and pass `style={style}` on the root `<div>`.

`components/v2/map-fullscreen-controls.tsx`:

```tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";

/**
 * The atlas maps' fullscreen controls (T-118), shared by `/dunya` and `/turkiye`: the top-left
 * toggle, the rotate-your-phone hint, and the inline layout a surface switches to while
 * `useLandscapeMode().active`. The game and tool pages keep their own copies (T-015).
 *
 * Inline styles, not conditional classes, for the reasons `v2-game-screen.tsx` gives beside its
 * `LANDSCAPE_FILL`: they beat `aspect-*` / `min-h-*` without relying on Tailwind's emit order, and
 * a `${…}` className hides the plate's `aspect-[…]` from the composition scanner.
 */

/** Gap between a fullscreen overlay and the screen edge, in CSS px (`top-3`/`left-3`). */
const EDGE_PX = 12;
/** Gap between two overlays stacked in one corner. */
const STACK_GAP_PX = 8;
/** The credit's ⓘ button in the bottom-right corner (`size-8`, `map-attribution.tsx`). */
const CREDIT_BUTTON_PX = 32;

/** The fullscreen target itself. A real Fullscreen API session paints the element over a black
 *  `::backdrop`, so the page background is set here too, not only by the hook's CSS fallback. */
export const FULLSCREEN_FIGURE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: "var(--background)",
};

/** The positioning box around the map: fills the screen and centres a height-capped map. */
export const FULLSCREEN_STAGE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  flex: "1 1 0%",
  minHeight: 0,
};

/** The map box: the whole stage, no corner radius or border against straight screen edges. */
export const FULLSCREEN_MAP_BOX: React.CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  aspectRatio: "auto",
  borderRadius: 0,
  borderWidth: 0,
};

/** A toolbar that sits above the map on a phone floats over its top-right corner instead. */
export const FULLSCREEN_TOOLBAR: React.CSSProperties = {
  position: "absolute",
  top: EDGE_PX,
  right: EDGE_PX,
  zIndex: 30,
  margin: 0,
};

/**
 * The selection card over the bottom-left corner at every width, narrow enough to leave the
 * credit's ⓘ clear, and above the rotate hint while that shows (it is bottom-centre, `z-40`).
 */
export function fullscreenCardStyle(rotateHintHeight: number): React.CSSProperties {
  return {
    position: "absolute",
    left: EDGE_PX,
    bottom: rotateHintHeight > 0 ? EDGE_PX + rotateHintHeight + STACK_GAP_PX : EDGE_PX,
    zIndex: 30,
    margin: 0,
    maxWidth: `min(24rem, calc(100% - ${EDGE_PX + CREDIT_BUTTON_PX + STACK_GAP_PX + EDGE_PX}px))`,
  };
}

/**
 * ONE control for both directions, rendered inside the map box: once the Fullscreen API engages
 * only the target's subtree is on screen, so an exit control outside it would be unreachable.
 * Sized like the atlas toolbar's buttons so the two bars line up across the top edge.
 */
export function MapFullscreenToggle({
  active,
  onToggle,
  ref,
}: {
  active: boolean;
  onToggle: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("MapExplorer");
  return (
    <div
      ref={ref}
      // A press on the control must not start a pan on the map under it.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-3 left-3 z-30 flex bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={active ? t("fullscreenExit") : t("fullscreenEnter")}
        className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        {active ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  );
}

/**
 * "Rotate your phone" (T-015): shown by the caller only while `landscape.showRotateHint`. Reports
 * its height so the selection card can sit above it. `onHeight` must be stable (a state setter).
 */
export function MapRotateHint({
  onDismiss,
  onHeight,
}: {
  onDismiss: () => void;
  onHeight: (px: number) => void;
}) {
  const t = useTranslations("MapExplorer");
  const measure = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const observer = new ResizeObserver(() => onHeight(el.offsetHeight));
      observer.observe(el);
      return () => {
        observer.disconnect();
        onHeight(0);
      };
    },
    [onHeight],
  );
  return (
    <div
      ref={measure}
      role="status"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-[92%] flex items-center gap-2.5 bg-ink-dark/95 text-white px-3.5 py-2 rounded-2xl shadow-2xl text-xs"
    >
      <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
      <span>{t("rotateHint")}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 px-2 py-1 rounded-lg border border-white/40 hover:bg-white/10 transition-colors cursor-pointer"
      >
        {t("rotateDismiss")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run components/v2/map-fullscreen-controls.test.ts lib/map/use-landscape-mode.test.ts`
Expected: PASS. If the JSON import is rejected by the tsconfig, read the files with `readFileSync` + `JSON.parse` instead.

- [ ] **Step 5: Gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/v2/map-fullscreen-controls.tsx components/v2/map-fullscreen-controls.test.ts \
  components/v2/map-selection-card.tsx lib/map/use-landscape-mode.client.ts \
  lib/map/use-landscape-mode.test.ts messages/tr.json messages/en.json
git commit -m "feat(map): shared fullscreen controls for the atlas maps (T-118)"
```

---

### Task 2: `useMapBoxMetrics` takes a list of overlays

**Files:**

- Modify: `components/v2/map-context-labels.tsx:60-98`
- Modify: `components/v2/v2-marine-map-explorer.tsx:189-192`
- Modify: `components/v2/v2-map-letterbox.test.ts:47,112`

**Interfaces:**

- Produces: `useMapBoxMetrics(boxRef, overlayRefs?: readonly React.RefObject<HTMLElement | null>[]): MapBoxMetrics | null`. `overlayRefs` must be referentially stable (`React.useMemo(() => [a, b], [])`).

- [ ] **Step 1: Update the tests first**

In `v2-map-letterbox.test.ts`:

- line 47: `expect(turkey).toMatch(/useMapBoxMetrics\(mapContainerRef, labelOverlays\)/);` and add
  `expect(turkey).toMatch(/labelOverlays = React\.useMemo\(\(\) => \[toolbarRef, fullscreenToggleRef\], \[\]\)/);`
- line 112: `expect(marine).toMatch(/useMapBoxMetrics\(mapBoxRef, chipOverlays\)/);`
- add to the `describe` holding line 47: `expect(labels).toMatch(/overlayRefs: readonly React\.RefObject<HTMLElement \| null>\[\] = NO_OVERLAY_REFS/);`

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run components/v2/v2-map-letterbox.test.ts`
Expected: FAIL on the new patterns.

- [ ] **Step 3: Implement**

`map-context-labels.tsx`, replace the hook body's head and measurement:

```tsx
/** No overlays: one module-level array, so a map without any keeps the effect's deps stable. */
const NO_OVERLAY_REFS: readonly React.RefObject<HTMLElement | null>[] = [];

/**
 * Measures the map box and the overlays floating on it (a toolbar, a status chip, a fullscreen
 * toggle) whenever any changes size, so a hidden-below-`sm` overlay is picked up when it appears.
 * `null` until the first measurement, so the server render and first paint agree and draw the
 * desktop labels. `overlayRefs` must be stable (a module constant or `useMemo`): it is an effect
 * dependency.
 */
export function useMapBoxMetrics(
  boxRef: React.RefObject<HTMLElement | null>,
  overlayRefs: readonly React.RefObject<HTMLElement | null>[] = NO_OVERLAY_REFS,
): MapBoxMetrics | null {
  const [metrics, setMetrics] = React.useState<MapBoxMetrics | null>(null);
  React.useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const elements = overlayRefs
      .map((ref) => ref.current)
      .filter((el): el is HTMLElement => el !== null);
    const measure = () => {
      const overlays: Rect[] = elements
        .filter((el) => el.offsetWidth > 0)
        .map((el) => ({
          left: el.offsetLeft - OVERLAY_CLEARANCE_PX,
          top: el.offsetTop - OVERLAY_CLEARANCE_PX,
          right: el.offsetLeft + el.offsetWidth + OVERLAY_CLEARANCE_PX,
          bottom: el.offsetTop + el.offsetHeight + OVERLAY_CLEARANCE_PX,
        }));
      const next = { width: box.clientWidth, height: box.clientHeight, overlays };
      if (!(next.width > 0 && next.height > 0)) return;
      // The observer fires once on `observe` and then only on a size change; an unchanged
      // measurement is not worth a render.
      setMetrics((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [boxRef, overlayRefs]);
  return metrics;
}
```

(Keep the file's existing `NO_AREAS` constant; it serves the labels, not this hook.)

`v2-marine-map-explorer.tsx`:

```tsx
const modeChipRef = React.useRef<HTMLDivElement | null>(null);
const chipOverlays = React.useMemo(() => [modeChipRef], []);
const mapBox = useMapBoxMetrics(mapBoxRef, chipOverlays);
```

`v2-turkey-map-explorer.tsx`, line 282 (the toggle that `fullscreenToggleRef` points at arrives in Task 4; until then the ref is `null` and filtered out):

```tsx
const fullscreenToggleRef = React.useRef<HTMLDivElement | null>(null);
const labelOverlays = React.useMemo(() => [toolbarRef, fullscreenToggleRef], []);
const boxMetrics = useMapBoxMetrics(mapContainerRef, labelOverlays);
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run components/v2/v2-map-letterbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/v2/map-context-labels.tsx components/v2/v2-marine-map-explorer.tsx \
  components/v2/v2-turkey-map-explorer.tsx components/v2/v2-map-letterbox.test.ts
git commit -m "refactor(map): let map labels clear more than one overlay (T-118)"
```

---

### Task 3: Fullscreen on `/dunya`

**Files:**

- Modify: `components/v2/v2-world-map-explorer.tsx` (state ~156-230, figure ~554-943)
- Create: `components/v2/v2-atlas-fullscreen.test.ts`
- Modify: `components/v2/v2-fullscreen-credit.test.ts:38-44`

**Interfaces:**

- Consumes: everything Task 1 produces.

- [ ] **Step 1: Write the failing tests**

`components/v2/v2-atlas-fullscreen.test.ts`:

```ts
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  jsxElementsOf,
  readSource,
  type ScannedElement,
} from "@/lib/test-support/composition-scan";

/**
 * T-118: the atlas maps go fullscreen with everything the map needs. Once the Fullscreen API
 * engages only the target's subtree is on screen, so the toggle, the toolbar, the selection card
 * and the rotate hint must all sit inside the element holding the landscape ref (the credit is
 * `v2-fullscreen-credit.test.ts`'s job).
 */
const surfaces = [
  {
    file: "v2-world-map-explorer.tsx",
    toolbar: (el: ScannedElement) => el.attributes.has("data-map-toolbar"),
  },
  {
    file: "v2-turkey-map-explorer.tsx",
    toolbar: (el: ScannedElement) => el.attributes.get("ref") === "toolbarRef",
  },
].map((s) => ({ ...s, path: fileURLToPath(new URL(`./${s.file}`, import.meta.url)) }));

const ancestorsOf = (elements: readonly ScannedElement[], index: number): number[] => {
  const chain: number[] = [];
  for (let at = elements[index]?.parent ?? null; at !== null; at = elements[at]?.parent ?? null) {
    chain.push(at);
  }
  return chain;
};

describe.each(surfaces)("$file fullscreen (T-118)", ({ path, toolbar }) => {
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
    find(toolbar, "toolbar");
    find((el) => el.tag === "MapSelectionCard", "selection card");
    const hint = find((el) => el.tag === "MapRotateHint", "rotate hint");
    expect(hint.attributes.get("onDismiss")).toBe("landscape.exit");
  });

  it("lets a plain wheel zoom in fullscreen (T-116)", () => {
    expect(source).toMatch(/plainWheelZooms: landscape\.active/);
  });
});
```

Only the world surface will exist at this point; to keep the Turkey half red-but-honest, run with `-t "v2-world"` in Step 2/4. The full file goes green in Task 4.

In `v2-fullscreen-credit.test.ts`, extend the expected list:

```ts
      expect.arrayContaining([
        "components/v2/v2-game-screen.tsx",
        "components/v2/v2-tool-workbench.tsx",
        "components/v2/v2-world-map-explorer.tsx",
        "components/v2/v2-turkey-map-explorer.tsx",
      ]),
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run components/v2/v2-atlas-fullscreen.test.ts -t "v2-world"`
Expected: FAIL ("const landscape = useLandscapeMode(figureRef)" missing).

- [ ] **Step 3: Implement in `v2-world-map-explorer.tsx`**

Imports:

```tsx
import { useLandscapeMode } from "@/lib/map/use-landscape-mode.client";
import {
  FULLSCREEN_FIGURE,
  FULLSCREEN_MAP_BOX,
  FULLSCREEN_STAGE,
  FULLSCREEN_TOOLBAR,
  MapFullscreenToggle,
  MapRotateHint,
  fullscreenCardStyle,
} from "@/components/v2/map-fullscreen-controls";
```

After `const containerRef = …` (line 156):

```tsx
/**
 * The figure is what goes fullscreen (T-118): toolbar, map, card and credit together, so none of
 * them is left behind on the page once only the target's subtree is on screen.
 */
const figureRef = React.useRef<HTMLElement | null>(null);
const landscape = useLandscapeMode(figureRef);
// The rotate hint's height, so the card can sit above it in portrait fullscreen.
const [rotateHintHeight, setRotateHintHeight] = React.useState(0);
```

`useWheelZoom`: `plainWheelZooms: false` → `plainWheelZooms: landscape.active`.

Figure (line 562):

```tsx
        <figure
          ref={figureRef}
          className={`-mx-5 my-0 relative sm:mx-0 ${landscape.active ? "" : "space-y-2"}`}
          style={landscape.active ? FULLSCREEN_FIGURE : undefined}
        >
          <div className="relative" style={landscape.active ? FULLSCREEN_STAGE : undefined}>
```

Toolbar `<div data-map-toolbar …>`: add `style={landscape.active ? FULLSCREEN_TOOLBAR : undefined}`.

Map box `<div ref={containerRef} …>`: add `style={landscape.active ? FULLSCREEN_MAP_BOX : undefined}`. Inside it, as its first child (before the zoom/pan wrapper):

```tsx
{
  /* Top-left, inside the box: on screen in fullscreen at every width (T-118). */
}
<MapFullscreenToggle active={landscape.active} onToggle={landscape.toggle} />;
{
  landscape.showRotateHint && (
    <MapRotateHint onDismiss={landscape.exit} onHeight={setRotateHintHeight} />
  );
}
```

`MapSelectionCard`: add `style={landscape.active ? fullscreenCardStyle(rotateHintHeight) : undefined}` and extend its comment: "…over it from `sm` (T-079); over it at every width in fullscreen (T-118)."

`<MapAttribution boundaries={false} world />` → `<MapAttribution boundaries={false} world fullscreen={landscape.active} />`.

Update the figure's comment block: it now also says the figure is the fullscreen target.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run components/v2/v2-atlas-fullscreen.test.ts -t "v2-world" components/v2/v2-fullscreen-credit.test.ts components/v2/v2-map-credit-placement.test.ts`
Expected: world half PASS; the credit test's per-surface checks PASS for `/dunya` (its "finds the surfaces" case stays red until Task 4).

- [ ] **Step 5: Commit**

Run `pnpm typecheck && pnpm lint` (the full `pnpm test` goes green after Task 4; note it in the message body).

```bash
git add components/v2/v2-world-map-explorer.tsx components/v2/v2-atlas-fullscreen.test.ts \
  components/v2/v2-fullscreen-credit.test.ts
git commit -m "feat(map): fullscreen button on the world map (T-118)"
```

---

### Task 4: Fullscreen on `/turkiye`

**Files:**

- Modify: `components/v2/v2-turkey-map-explorer.tsx` (state ~245-285, figure ~657-958)

**Interfaces:**

- Consumes: Task 1 exports; `fullscreenToggleRef` and `labelOverlays` from Task 2.

- [ ] **Step 1: Confirm the Turkey half fails**

Run: `pnpm vitest run components/v2/v2-atlas-fullscreen.test.ts components/v2/v2-fullscreen-credit.test.ts components/v2/v2-map-letterbox.test.ts`
Expected: FAIL only on `v2-turkey-map-explorer.tsx` cases and "finds the surfaces".

- [ ] **Step 2: Implement in `v2-turkey-map-explorer.tsx`**

Same imports as Task 3 (without `FULLSCREEN_TOOLBAR`). Before `usePinchZoom` (~245):

```tsx
/** The figure goes fullscreen (T-118): toolbar, map, card and credit together. */
const figureRef = React.useRef<HTMLElement | null>(null);
const landscape = useLandscapeMode(figureRef);
// The rotate hint's height, so the card can sit above it in portrait fullscreen.
const [rotateHintHeight, setRotateHintHeight] = React.useState(0);
```

`useWheelZoom`: `plainWheelZooms: false` → `plainWheelZooms: landscape.active`.

Below the component's other module constants (near `TALL_VIEWBOX_RECT`, line 161):

```tsx
/**
 * The map box in fullscreen (T-118): never taller than wide. The map is drawn with `slice` over a
 * square frame, so a portrait box (a phone that did not rotate) would cut Türkiye's east and west;
 * capped at square it is centred on the page background instead. Landscape and desktop boxes are
 * wider than tall, so the cap does nothing there.
 */
const FULLSCREEN_TURKEY_BOX: React.CSSProperties = { ...FULLSCREEN_MAP_BOX, maxHeight: "100vw" };
```

Figure (line 657):

```tsx
        <figure
          ref={figureRef}
          className={`m-0 relative ${landscape.active ? "" : "space-y-2"}`}
          style={landscape.active ? FULLSCREEN_FIGURE : undefined}
        >
          <div className="relative" style={landscape.active ? FULLSCREEN_STAGE : undefined}>
```

Map box `<div ref={mapContainerRef} …>`: add `style={landscape.active ? FULLSCREEN_TURKEY_BOX : undefined}`. Inside it, right before the toolbar `<div ref={toolbarRef} …>`:

```tsx
{
  /* Top-left, inside the box, measured as a label overlay like the toolbar (T-118). */
}
<MapFullscreenToggle
  ref={fullscreenToggleRef}
  active={landscape.active}
  onToggle={landscape.toggle}
/>;
{
  landscape.showRotateHint && (
    <MapRotateHint onDismiss={landscape.exit} onHeight={setRotateHintHeight} />
  );
}
```

`MapSelectionCard`: add `style={landscape.active ? fullscreenCardStyle(rotateHintHeight) : undefined}`.

`<MapAttribution inlandWater context />` → `<MapAttribution inlandWater context fullscreen={landscape.active} />`.

- [ ] **Step 3: Run to verify they pass**

Run: `pnpm vitest run components/v2/v2-atlas-fullscreen.test.ts components/v2/v2-fullscreen-credit.test.ts components/v2/v2-map-letterbox.test.ts components/v2/v2-map-credit-placement.test.ts`
Expected: PASS.

- [ ] **Step 4: Gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/v2/v2-turkey-map-explorer.tsx
git commit -m "feat(map): fullscreen button on the Türkiye map (T-118)"
```

---

### Task 5: Browser verification, board, PR

**Files:**

- Modify: `../TASKS.md`, `../TASKS-DONE.md` (workspace root, not in git)

- [ ] **Step 1: Browser checks (Playwright MCP against the dev container on :3000)**

For `/dunya` and `/turkiye`, at 320, 360, 390 px and 1440 px, light and dark:

- The toggle is top-left in the map box; the page view is otherwise unchanged (no toolbar/label overlap on `/turkiye`).
- Click → `document.fullscreenElement` is the `<figure>`; toolbar top-right, credit open bottom-right, then ⓘ after 5 s or the first press.
- In fullscreen: `+`/`−`/reset, drag pan, plain wheel zoom (desktop), select a country/province → card bottom-left, not over the ⓘ; X closes it; select another.
- Esc exits; `landscape` state resets (button shows "Tam ekranda aç" again, card back in its page place).
- CSS fallback: `page.addInitScript` deleting `Element.prototype.requestFullscreen` and `webkitRequestFullscreen`, touch + portrait 390×844 → fixed layout, rotate hint visible, card above it, `/turkiye` map square and centred, dark mode background dark; "Anladım" exits.
- Screenshots to `.playwright-mcp/t118-*.png`.

- [ ] **Step 2: Overflow sweep**

Run: `pnpm sweep:overflow -- --filter=/dunya` and `pnpm sweep:overflow -- --filter=/turkiye`
Expected: green.

- [ ] **Step 3: Board**

Move T-118 from `TASKS.md` to the top of `TASKS-DONE.md` (Turkish, the repo's DONE entry format), and drop T-118 from the "önerilen sıra" line if it lists finished items as "(bitti)" (mark it "(bitti)").

- [ ] **Step 4: Push and open the PR into `dev`**

```bash
git push -u origin feature/t118-atlas-fullscreen
GH_TOKEN=… gh pr create --base dev --title "feat(map): fullscreen button on the world and Türkiye maps (T-118)" --body "…"
```

(PR account: see memory `gh-pr-account`.) Report the PR link.
