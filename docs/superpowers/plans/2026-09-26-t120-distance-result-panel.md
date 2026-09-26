# Distance Tool Result Panel and Leg Labels Implementation Plan (T-120)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/araclar/mesafe-olcme`, show the total, flight time and road estimate with Undo
and Clear in a panel on (or, on a phone page, directly under) the map, in fullscreen too, and
label each leg of the route with its own distance.

**Architecture:** A generic `MapResultPanel` (summary / details / actions / hint slots) and a
`DistanceResultPanel` that fills it. The workbench wraps the plate and the panel in one
`relative` box inside the fullscreen `<figure>`. Two pure modules place labels:
`placeSegmentLabels` (new) and `placePinLabels` (gains `obstacles`). One pure helper,
`distanceTravelEstimates`, feeds both the panel and the existing result card.

**Tech Stack:** Next.js 16 App Router, React 19.2 (ref as a prop), next-intl, Tailwind v4,
vitest (node env, no jsdom; component tests via `renderToStaticMarkup`), Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-09-26-t120-distance-result-panel-design.md`

All paths are relative to `cografya_web/`. Branch: `feature/t120-distance-result-panel`
(already created, holds the spec commits).

## Global Constraints

- pnpm, never npm. Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test`.
- Conventional Commits (commitlint hook), scope `tools` or `map`; every commit ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- TR copy approved verbatim: "Ölçmek için haritada bir yere tıkla." and "Mesafe için bir nokta
  daha ekle." (`docs/copy.md`: "sen", plain words).
- Colours only through tokens / Tailwind theme keys; no `*.module.css`; `Button` has no `asChild`.
- Touch targets ≥ 24×24 CSS px (`docs/design.md`); panel buttons are 32 px tall.
- No hand-edits of generated files. No worktrees. Do not push to `main`.
- Code comments in English, stating rationale, matching the surrounding file's density.

## Review Focus

1. **Undo down to one point, then zero** — the panel goes result → one-point hint → empty hint,
   never shows "0 km" or "0,0 km" visibly, and its height does not change (Task 4 test pins the
   `invisible` + `aria-hidden` sizing; Task 7 measures height in the browser).
2. **A leg shorter than its label, or two nearly coincident points** — no label, no NaN, no
   crash on a zero-length leg (Task 3 tests).
3. **Pressing a panel button on the map** — never adds a point and never starts a pan (Task 4
   test pins the propagation guards; Task 7 checks the point count after pressing).
4. **Portrait fullscreen on a touch phone with the rotate hint up** — the panel sits above the
   hint, both readable (Task 5 wiring; Task 7 checks at 390×844 with a coarse pointer).
5. **A preset framed at `sm`+ or in fullscreen** — the fit keeps every pin and label above the
   panel (Task 5 uses `fitInsets`; Task 7 checks "Edirne - Iğdır" and "Karadeniz Kıyısı").

---

### Task 1: One travel-estimate calculation

**Files:**

- Modify: `lib/map/measure.ts` (after `polylineLengthKm`, ~line 140)
- Test: `lib/map/measure.test.ts`
- Modify: `components/v2/v2-tool-workbench.tsx` (result card, ~lines 1817-1843)

**Interfaces:**

- Produces: `distanceTravelEstimates(distanceKm: number): { flightMinutes: number; roadKm: number }`
  exported from `@/lib/map/measure`.

- [ ] **Step 1: Write the failing test** — append to `lib/map/measure.test.ts` (add
      `distanceTravelEstimates` to its existing `./measure` import):

```ts
describe("distanceTravelEstimates", () => {
  it("quotes flight minutes at 800 km/h and the road at 1.28 × the straight line", () => {
    expect(distanceTravelEstimates(800)).toEqual({ flightMinutes: 60, roadKm: 1024 });
  });

  it("rounds the flight to whole minutes and leaves the road unrounded for the caller", () => {
    const { flightMinutes, roadKm } = distanceTravelEstimates(1430.2);
    expect(flightMinutes).toBe(107);
    expect(roadKm).toBeCloseTo(1830.656, 3);
  });

  it("is zero for no distance", () => {
    expect(distanceTravelEstimates(0)).toEqual({ flightMinutes: 0, roadKm: 0 });
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `pnpm vitest run lib/map/measure.test.ts`
      → "distanceTravelEstimates is not a function" / not exported.

- [ ] **Step 3: Implement** in `lib/map/measure.ts`, right after `polylineLengthKm`:

```ts
/** Cruise speed the distance tool's flight time assumes. */
const FLIGHT_CRUISE_KMH = 800;
/** How much longer than the straight line the tool's road estimate takes the road to be. */
const ROAD_DISTANCE_FACTOR = 1.28;

/**
 * The flight time and road length the distance tool quotes beside a straight-line distance. One
 * function so the result card and the on-map panel (T-120) cannot show different figures.
 */
export function distanceTravelEstimates(distanceKm: number): {
  flightMinutes: number;
  roadKm: number;
} {
  return {
    flightMinutes: Math.round((distanceKm / FLIGHT_CRUISE_KMH) * 60),
    roadKm: distanceKm * ROAD_DISTANCE_FACTOR,
  };
}
```

- [ ] **Step 4: Use it in the result card.** In `v2-tool-workbench.tsx` add
      `distanceTravelEstimates` to the existing `@/lib/map/measure` import. After the `distanceKm`
      memo add:

```ts
const travelEstimates = distanceTravelEstimates(distanceKm);
```

and replace the two inline figures in the card:

```tsx
{
  t("flightMinutes", { minutes: String(travelEstimates.flightMinutes) });
}
```

```tsx
                      ~{formatNumber(travelEstimates.roadKm, locale, 0)} km
```

- [ ] **Step 5: Run** `pnpm vitest run lib/map/measure.test.ts components/v2` → PASS.
- [ ] **Step 6: Commit**

```bash
git add lib/map/measure.ts lib/map/measure.test.ts components/v2/v2-tool-workbench.tsx
git commit -m "refactor(tools): compute the distance tool's flight and road figures in one place (T-120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pin labels avoid obstacles

**Files:**

- Modify: `lib/map/pin-label-placement.ts`
- Test: `lib/map/pin-label-placement.test.ts`

**Interfaces:**

- Produces: `export interface Box { x: number; y: number; w: number; h: number }`,
  `export function overlapArea(a: Box, b: Box): number`, and
  `placePinLabels(pins, { view, dotRadius, obstacles? }: { view: Box; dotRadius: number; obstacles?: readonly Box[] })`.

- [ ] **Step 1: Write the failing test** — append inside the file's `placePinLabels` describe
      (or a new `describe("placePinLabels obstacles", …)`):

```ts
it("keeps a label off an obstacle, as it keeps off another pin's dot", () => {
  const pin: PinLabel = { x: 50, y: 50, gap: 5, width: 20, height: 8 };
  const view = { x: 0, y: 0, w: 200, h: 200 };
  // Covers the preferred "above" box (x 40–60, y 37–45).
  const obstacle = { x: 30, y: 30, w: 40, h: 20 };
  expect(placePinLabels([pin], { view, dotRadius: 1 })).toEqual(["above"]);
  const [side] = placePinLabels([pin], { view, dotRadius: 1, obstacles: [obstacle] });
  expect(side).toBe("below");
  expect(overlapArea(labelBox(pin, side!), obstacle)).toBe(0);
});
```

Add `overlapArea` to the test's import from `./pin-label-placement`.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run lib/map/pin-label-placement.test.ts`
      (typecheck error on `obstacles` / missing export `overlapArea`; at runtime side stays "above").

- [ ] **Step 3: Implement.** In `pin-label-placement.ts`:
  - `interface Box` → `export interface Box`.
  - `function overlapArea` → `export function overlapArea`.
  - Signature and cost:

```ts
export function placePinLabels(
  pins: readonly PinLabel[],
  {
    view,
    dotRadius,
    obstacles = [],
  }: { view: Box; dotRadius: number; obstacles?: readonly Box[] },
): PinLabelSide[] {
```

Inside `cost`, after the `dots.forEach(…)` block add:

```ts
for (const obstacle of obstacles) total += overlapArea(box, obstacle);
```

and extend the docblock's first paragraph with: "…covers no other pin's dot, no `obstacles`
box (the distance labels and the result panel, T-120) and overlaps no label already placed."

- [ ] **Step 4: Run** `pnpm vitest run lib/map/pin-label-placement.test.ts` → PASS (all old
      tests still pass: `obstacles` defaults to none).
- [ ] **Step 5: Commit**

```bash
git add lib/map/pin-label-placement.ts lib/map/pin-label-placement.test.ts
git commit -m "feat(map): let pin labels keep off caller-given obstacles (T-120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Segment label placement

**Files:**

- Create: `lib/map/segment-labels.ts`
- Test: `lib/map/segment-labels.test.ts`

**Interfaces:**

- Consumes: `Box`, `overlapArea` from `./pin-label-placement` (Task 2).
- Produces:
  - `export interface SegmentLabelSize { width: number; height: number }`
  - `export function segmentHitsBox(a: {x,y}, b: {x,y}, box: Box): boolean`
  - `export function placeSegmentLabels(points: readonly {x:number;y:number}[], sizes: readonly SegmentLabelSize[], opts: { view: Box; gap: number; dotRadius: number; obstacles?: readonly Box[] }): ({ x: number; y: number } | null)[]`
    — one entry per leg (`points.length - 1`), the label's centre or `null` when hidden.

- [ ] **Step 1: Write the failing tests** — `lib/map/segment-labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { overlapArea, type Box } from "./pin-label-placement";
import { placeSegmentLabels, segmentHitsBox } from "./segment-labels";

const SIZE = { width: 20, height: 8 };
const BIG_VIEW: Box = { x: -500, y: -500, w: 1000, h: 1000 };
const opts = (extra: Partial<Parameters<typeof placeSegmentLabels>[2]> = {}) => ({
  view: BIG_VIEW,
  gap: 2,
  dotRadius: 1,
  ...extra,
});
const boxAt = (c: { x: number; y: number }): Box => ({
  x: c.x - SIZE.width / 2,
  y: c.y - SIZE.height / 2,
  w: SIZE.width,
  h: SIZE.height,
});

describe("segmentHitsBox", () => {
  it("sees a segment crossing, touching and missing a box", () => {
    const box = { x: 0, y: 0, w: 10, h: 10 };
    expect(segmentHitsBox({ x: -5, y: 5 }, { x: 15, y: 5 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 10, y: -5 }, { x: 10, y: 15 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 11, y: -5 }, { x: 11, y: 15 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -5, y: -5 }, { x: -1, y: 20 }, box)).toBe(false);
  });
});

describe("placeSegmentLabels", () => {
  it("puts a straight horizontal leg's label above it, just clear of the line", () => {
    // d = half the label's height + gap = 4 + 2.
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([{ x: 50, y: -6 }]);
  });

  it("puts a straight vertical leg's label to its right, half the label's width off", () => {
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([{ x: 12, y: 50 }]);
  });

  it("keeps a diagonal leg's label box off its own line, on the leg's normal", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 100 };
    const [c] = placeSegmentLabels([a, b], [SIZE], opts());
    expect(c).not.toBeNull();
    expect(segmentHitsBox(a, b, boxAt(c!))).toBe(false);
    // On the perpendicular through the midpoint: (c - m) · (b - a) = 0.
    expect((c!.x - 50) * 100 + (c!.y - 50) * 100).toBeCloseTo(0, 9);
  });

  it("puts each label on the outside of the bend", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(placeSegmentLabels(route, [SIZE, SIZE], opts())).toEqual([
      { x: 50, y: -6 },
      { x: 112, y: 50 },
    ]);
  });

  it("takes the other side when the first is under an obstacle", () => {
    const obstacles = [{ x: 30, y: -20, w: 40, h: 15 }];
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [SIZE],
        opts({ obstacles }),
      ),
    ).toEqual([{ x: 50, y: 6 }]);
  });

  it("takes the other side when the first leaves the view", () => {
    const view = { x: -50, y: 0, w: 200, h: 100 };
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 3 },
          { x: 100, y: 3 },
        ],
        [SIZE],
        opts({ view }),
      ),
    ).toEqual([{ x: 50, y: 9 }]);
  });

  it("hides the label when both sides are blocked", () => {
    const obstacles = [
      { x: 30, y: -20, w: 40, h: 15 },
      { x: 30, y: 0.5, w: 40, h: 15 },
    ];
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [SIZE],
        opts({ obstacles }),
      ),
    ).toEqual([null]);
  });

  it("hides the label of a leg shorter than the label and its two dots", () => {
    // 20 along + 4 × dotRadius > 20.
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([null]);
  });

  it("hides a zero-length leg instead of dividing by zero", () => {
    expect(
      placeSegmentLabels(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([null]);
  });

  it("hides a label that would cross another leg on either side", () => {
    // Leg B→C touches the "above" box, leg C→D runs through the "below" box.
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 60, y: -8 },
      { x: 40, y: 40 },
    ];
    expect(placeSegmentLabels(route, [SIZE, SIZE, SIZE], opts())[0]).toBeNull();
  });

  it("returns nothing for fewer than two points", () => {
    expect(placeSegmentLabels([{ x: 0, y: 0 }], [], opts())).toEqual([]);
    expect(placeSegmentLabels([], [], opts())).toEqual([]);
  });

  it("never overlaps two labels, a dot or any leg on a zigzag route", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 60, y: 10 },
      { x: 120, y: -5 },
      { x: 180, y: 20 },
      { x: 240, y: 0 },
      { x: 250, y: 30 },
    ];
    const centres = placeSegmentLabels(
      route,
      route.slice(1).map(() => SIZE),
      opts(),
    );
    const boxes = centres.flatMap((c) => (c ? [boxAt(c)] : []));
    expect(boxes.length).toBeGreaterThan(2);
    boxes.forEach((box, i) => {
      boxes.forEach((other, j) => {
        if (i !== j) expect(overlapArea(box, other)).toBe(0);
      });
      route.forEach((p) => {
        expect(overlapArea(box, { x: p.x - 1, y: p.y - 1, w: 2, h: 2 })).toBe(0);
      });
    });
    centres.forEach((c, i) => {
      if (!c) return;
      route.slice(1).forEach((b, j) => {
        if (j !== i) expect(segmentHitsBox(route[j]!, b, boxAt(c))).toBe(false);
      });
    });
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run lib/map/segment-labels.test.ts`
      → "Cannot find module './segment-labels'".

- [ ] **Step 3: Implement** `lib/map/segment-labels.ts`:

```ts
import { overlapArea, type Box } from "@/lib/map/pin-label-placement";

/**
 * Where each leg's distance label goes on the distance tool's route (T-120).
 *
 * A label is horizontal text centred on its leg's midpoint, moved along the leg's normal by the
 * smallest distance at which its box no longer touches the line: half the box's extent across the
 * normal plus `gap`. So a flat leg's label sits just above it and a steep leg's just beside it.
 * The side facing away from the route's centre (the outside of the bend) is tried first; a
 * straight route, whose centre is on every leg, prefers above, then right.
 *
 * A side is free when its box stays inside `view` (the plate minus the control bands), covers no
 * dot, no `obstacles` box (the result panel), no label placed before it and no other leg. When
 * neither side is free, or the leg is shorter on screen than its label plus its two dots, the
 * label is dropped: the cartographic default, and the total is always in the result panel. Pin
 * labels are placed after these (`placePinLabels` takes them as obstacles), because a leg label
 * has two places and a pin label eight.
 *
 * All values are map units; the caller converts CSS px with `atScreenSize`.
 */

interface Point {
  x: number;
  y: number;
}

export interface SegmentLabelSize {
  width: number;
  height: number;
}

const EPSILON = 1e-9;

/** Whether the segment a→b touches the box (Liang–Barsky clipping; touching counts). */
export function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let leave = 1;
  const edges: readonly (readonly [number, number])[] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.w - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.h - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > leave) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < leave) leave = t;
    }
  }
  return true;
}

export function placeSegmentLabels(
  points: readonly Point[],
  sizes: readonly SegmentLabelSize[],
  {
    view,
    gap,
    dotRadius,
    obstacles = [],
  }: { view: Box; gap: number; dotRadius: number; obstacles?: readonly Box[] },
): (Point | null)[] {
  const legs = points.length - 1;
  if (legs < 1) return [];
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const dots = points.map((p) => ({
    x: p.x - dotRadius,
    y: p.y - dotRadius,
    w: dotRadius * 2,
    h: dotRadius * 2,
  }));
  const placed: Box[] = [];

  const isFree = (box: Box, leg: number) => {
    if (box.w * box.h - overlapArea(box, view) > EPSILON) return false;
    for (const other of [...obstacles, ...dots, ...placed]) {
      if (overlapArea(box, other) > 0) return false;
    }
    for (let j = 0; j < legs; j++) {
      if (j !== leg && segmentHitsBox(points[j]!, points[j + 1]!, box)) return false;
    }
    return true;
  };

  const result: (Point | null)[] = [];
  for (let leg = 0; leg < legs; leg++) {
    const a = points[leg]!;
    const b = points[leg + 1]!;
    const size = sizes[leg];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!size || length < EPSILON) {
      result.push(null);
      continue;
    }
    const { width: w, height: h } = size;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    // The label's extent along the leg, plus both pins' dots, must fit on the leg.
    if (Math.abs(ux) * w + Math.abs(uy) * h + 4 * dotRadius > length) {
      result.push(null);
      continue;
    }
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = -uy;
    let ny = ux;
    const outward = (mx - cx) * nx + (my - cy) * ny;
    const flip =
      Math.abs(outward) > EPSILON
        ? outward < 0
        : ny > EPSILON || (Math.abs(ny) <= EPSILON && nx < 0);
    if (flip) {
      nx = -nx;
      ny = -ny;
    }
    const offset = (Math.abs(nx) * w) / 2 + (Math.abs(ny) * h) / 2 + gap;
    let chosen: Point | null = null;
    for (const side of [1, -1]) {
      const centre = { x: mx + side * nx * offset, y: my + side * ny * offset };
      const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
      if (isFree(box, leg)) {
        chosen = centre;
        placed.push(box);
        break;
      }
    }
    result.push(chosen);
  }
  return result;
}
```

- [ ] **Step 4: Run** `pnpm vitest run lib/map/segment-labels.test.ts` → PASS. If a
      hand-computed expectation fails by floating-point noise (e.g. `-0` vs `0`, `50.000000001`),
      switch that assertion to `toBeCloseTo` per coordinate; do not change the algorithm to fit.
- [ ] **Step 5: Commit**

```bash
git add lib/map/segment-labels.ts lib/map/segment-labels.test.ts
git commit -m "feat(map): place a distance label beside each leg of a route (T-120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The result panel components and copy

**Files:**

- Create: `components/v2/map-result-panel.tsx`
- Create: `components/v2/distance-result-panel.tsx`
- Test: `components/v2/distance-result-panel.test.tsx`
- Modify: `messages/tr.json`, `messages/en.json` (`ToolWorkbench`, after `"roadFactor"`)
- Maybe modify: `components/v2/page-composition-cards.test.ts` (population counts, Step 6)

**Interfaces:**

- Consumes: `distanceTravelEstimates` (Task 1).
- Produces:
  - `MapResultPanel({ label, summary, details, actions, hint?, className?, style?, ref? })`
    — `label: string; summary: ReactNode; details: ReactNode; actions: ReactNode; hint?: string;
className?: string; style?: React.CSSProperties; ref?: React.Ref<HTMLDivElement>`.
  - `MapResultAction({ icon, label, onClick, disabled? })`.
  - `DistanceResultPanel({ pointCount, distanceKm, onUndo, onClear, className?, style?, ref? })`.

- [ ] **Step 1: Add the copy.** In `messages/tr.json`, `ToolWorkbench`, after `"roadFactor"`:

```json
    "resultPanelLabel": "Ölçüm sonucu",
    "resultPanelEmptyDistance": "Ölçmek için haritada bir yere tıkla.",
    "resultPanelOnePointDistance": "Mesafe için bir nokta daha ekle.",
```

In `messages/en.json`, same place:

```json
    "resultPanelLabel": "Measurement result",
    "resultPanelEmptyDistance": "Click the map to start measuring.",
    "resultPanelOnePointDistance": "Add one more point to get a distance.",
```

- [ ] **Step 2: Write the failing test** — `components/v2/distance-result-panel.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
import { DistanceResultPanel } from "./distance-result-panel";

/**
 * T-120. The panel on the distance tool's map. Layout (where it sits, that its height does not
 * change, that nothing overlaps it) is measured in the browser; these pin what a node render
 * can see: the three states, the shared figures, and the guards that keep a press on it from
 * reaching the map.
 */
const render = (pointCount: number, distanceKm: number) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages}>
      <DistanceResultPanel
        pointCount={pointCount}
        distanceKm={distanceKm}
        onUndo={() => {}}
        onClear={() => {}}
      />
    </NextIntlClientProvider>,
  );

const sizingCells = (html: string) =>
  [...html.matchAll(/<div aria-hidden="true" class="([^"]*)"/g)].map((m) => m[1]);

describe("DistanceResultPanel", () => {
  it("asks for the first point, keeps the figures only as invisible sizing, disables the buttons", () => {
    const html = render(0, 0);
    expect(html).toContain("Ölçmek için haritada bir yere tıkla.");
    // Summary and details stay in the grid so the panel keeps its height, but hidden from sight
    // and from assistive tech: no "0,0 km" is ever shown.
    const cells = sizingCells(html);
    expect(cells).toHaveLength(2);
    for (const cls of cells) expect(cls).toMatch(/\binvisible\b/);
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });

  it("asks for a second point after the first, with the buttons live", () => {
    const html = render(1, 0);
    expect(html).toContain("Mesafe için bir nokta daha ekle.");
    expect(sizingCells(html)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
  });

  it("shows the total, flight time and road estimate from the shared calculation", () => {
    const html = render(2, 1430.2);
    expect(sizingCells(html)).toHaveLength(0);
    expect(html).toContain("1.430,2");
    expect(html).toContain("~107 dk");
    expect(html).toContain("~1.831 km");
    expect(html).not.toContain("Ölçmek için");
    expect(html).not.toContain("Mesafe için");
  });

  it("names the region and both actions, even where the button text is visually hidden", () => {
    const html = render(2, 100);
    expect(html).toMatch(/role="group" aria-label="Ölçüm sonucu"/);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Geri Al<\/span>/);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Temizle<\/span>/);
    // Readers hear what each figure is; sighted readers get the icons.
    expect(html).toContain("Uçuş Süresi");
    expect(html).toContain("Karayolu Tahmini");
    expect(html).toContain('aria-live="polite"');
  });
});
```

A node render cannot fire events, so the propagation guard is pinned by source, at the end of
the same file:

```tsx
describe("MapResultPanel", () => {
  it("keeps a press on the panel from starting a pan on the map under it", () => {
    const code = stripComments(
      readFileSync(new URL("./map-result-panel.tsx", import.meta.url), "utf8"),
    );
    expect(code).toContain("onPointerDown={stopPropagation}");
    expect(code).toContain("onMouseDown={stopPropagation}");
  });
});
```

- [ ] **Step 3: Run, expect FAIL** — `pnpm vitest run components/v2/distance-result-panel.test.tsx`
      → "Cannot find module './distance-result-panel'".

- [ ] **Step 4: Implement** `components/v2/map-result-panel.tsx`:

```tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * A measuring tool's result, on its map (T-120; T-121 fills it for the area and coordinate
 * tools). A two-column grid: `summary` beside `actions` on the first row, `details` across the
 * whole second row, so at 320 px the details get the panel's full width instead of the space
 * the buttons leave.
 *
 * `hint` replaces the figures before there is a result ("tap the map"). The figures stay in the
 * grid, `invisible` and `aria-hidden`, so the panel is as tall with a hint as with a result:
 * adding the first point never moves the map (the T-126 rule), and the workbench's fit and label
 * insets, which read the panel's height, do not jump. The hint shares the first column's two rows.
 *
 * It sits over (or next to) a pan surface, so a press on it stops there, as `MapSelectionCard`'s
 * does. Placement belongs to the caller (`className`, `style`).
 */
export function MapResultPanel({
  label,
  summary,
  details,
  actions,
  hint,
  className,
  style,
  ref,
}: {
  label: string;
  summary: React.ReactNode;
  details: React.ReactNode;
  actions: React.ReactNode;
  hint?: string;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const hidden = hint !== undefined;
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
      style={style}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border border-primary/40 bg-card/95 p-2.5 shadow-xl backdrop-blur-md",
        className,
      )}
    >
      <div
        aria-hidden={hidden || undefined}
        aria-live={hidden ? undefined : "polite"}
        className={cn("col-start-1 row-start-1 min-w-0", hidden && "invisible")}
      >
        {summary}
      </div>
      <div className="col-start-2 row-start-1 flex items-center gap-1">{actions}</div>
      <div
        aria-hidden={hidden || undefined}
        className={cn("col-span-2 row-start-2 min-w-0", hidden && "invisible")}
      >
        {details}
      </div>
      {/* Always mounted, so the live region exists before its text changes. */}
      <p
        aria-live="polite"
        className="pointer-events-none col-start-1 row-span-2 row-start-1 m-0 self-center text-xs text-muted-foreground"
      >
        {hint}
      </p>
    </div>
  );
}

/** A panel button: icon only below `sm` (its label stays for assistive tech), icon and text from
 *  `sm`, the pattern `MapSelectionCard` uses for its explore action. 32 px tall. */
export function MapResultAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      leftIcon={icon}
      className="min-w-8 px-2 sm:px-3"
    >
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  );
}
```

The sizing-cell test regex expects `aria-hidden="true"` directly before `class=`. React
renders attributes in prop order and drops `undefined` ones, so with the prop order above
(`aria-hidden`, then `aria-live` which is `undefined` while hidden, then `className`) it holds.
Keep that order.

Then `components/v2/distance-result-panel.tsx`:

```tsx
"use client";

import * as React from "react";
import { Car, Plane, Trash2, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { distanceTravelEstimates } from "@/lib/map/measure";
import { formatNumber } from "@/lib/text/format-number";
import { MapResultAction, MapResultPanel } from "@/components/v2/map-result-panel";

/**
 * The distance tool's result on its map (T-120): the straight-line total, flight time and road
 * estimate, from the same calculation and message keys as the result card below the map, with
 * Undo and Clear beside them.
 */
export function DistanceResultPanel({
  pointCount,
  distanceKm,
  onUndo,
  onClear,
  className,
  style,
  ref,
}: {
  pointCount: number;
  distanceKm: number;
  onUndo: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("ToolWorkbench");
  const locale = useLocale() as Locale;
  const { flightMinutes, roadKm } = distanceTravelEstimates(distanceKm);
  // No "0 km" for one point: a route with one point has no length yet (spec §2.2).
  const hint =
    pointCount === 0
      ? t("resultPanelEmptyDistance")
      : pointCount === 1
        ? t("resultPanelOnePointDistance")
        : undefined;

  return (
    <MapResultPanel
      ref={ref}
      label={t("resultPanelLabel")}
      hint={hint}
      className={className}
      style={style}
      summary={
        <p className="m-0 flex items-baseline gap-1 leading-7">
          <span className="sr-only">{t("distanceTotal")}: </span>
          <span className="font-heading font-mono text-lg font-extrabold text-primary">
            {formatNumber(distanceKm, locale, 1)}
          </span>
          <span className="text-sm font-bold text-foreground">km</span>
        </p>
      }
      details={
        <p className="m-0 flex flex-wrap gap-x-3 font-mono text-[11px] leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Plane className="size-3 text-primary" aria-hidden="true" />
            <span className="sr-only">{t("flightTime")}: </span>
            {t("flightMinutes", { minutes: String(flightMinutes) })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Car className="size-3 text-secondary" aria-hidden="true" />
            <span className="sr-only">{t("roadEstimate")}: </span>
            {`~${formatNumber(roadKm, locale, 0)} km`}
          </span>
        </p>
      }
      actions={
        <>
          <MapResultAction
            icon={<Undo2 className="size-3.5" aria-hidden="true" />}
            label={t("undo")}
            onClick={onUndo}
            disabled={pointCount === 0}
          />
          <MapResultAction
            icon={<Trash2 className="size-3.5 text-destructive" aria-hidden="true" />}
            label={t("clear")}
            onClick={onClear}
            disabled={pointCount === 0}
          />
        </>
      }
    />
  );
}
```

- [ ] **Step 5: Run** `pnpm vitest run components/v2/distance-result-panel.test.tsx` → PASS.
- [ ] **Step 6: Run the whole suite** `pnpm test`. `page-composition-cards.test.ts` counts
      hand-drawn card surfaces; `map-result-panel.tsx`'s `rounded-2xl border … bg-card/95` joins it.
      If it fails, update only the numbers it reports (`handDrawnTotals().files` 63 → 64, and
      `HAND_DRAWN_CARDS`/`HAND_DRAWN_WELLS` if they moved) and extend the running comment with one
      line: `// 64 after T-120: \`map-result-panel.tsx\` joins with the result panel the tool maps
      render on the map.` Any other failure: stop and debug (systematic-debugging).
- [ ] **Step 7: Gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/v2/map-result-panel.tsx components/v2/distance-result-panel.tsx \
  components/v2/distance-result-panel.test.tsx messages/tr.json messages/en.json \
  components/v2/page-composition-cards.test.ts
git commit -m "feat(tools): add the map result panel and its distance content (T-120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Put the panel on the distance map

**Files:**

- Modify: `components/v2/v2-tool-workbench.tsx`
- Modify: `components/v2/v2-tool-workbench.structure.test.ts`

**Interfaces:**

- Consumes: `DistanceResultPanel` (Task 4).
- Produces (inside the workbench, used by Task 6): `resultPanelObstacle: Box | null` (map
  units), `fitInsets: BoxInsets`.

- [ ] **Step 1: Write the failing structure tests** — append to the top-level describe in
      `v2-tool-workbench.structure.test.ts`, and change the existing T-124 assertion
      `/fitPointsView\(mapPoints, worldView, box, controlInsets/` to
      `/fitPointsView\(mapPoints, worldView, box, fitInsets/`:

```ts
// T-120: the distance result sits on the map, inside the fullscreen target, with Undo/Clear.
describe("distance result panel (T-120)", () => {
  const code = stripComments(source);

  it("renders one panel, after the plate and inside the fullscreen box", () => {
    expect(code.match(/<DistanceResultPanel\b/g)).toHaveLength(1);
    const box = code.indexOf("ref={landscapeBoxRef}");
    const plate = code.indexOf("ref={mapContainerRef}", box);
    const panel = code.indexOf("<DistanceResultPanel", plate);
    const caption = code.indexOf("<figcaption>", panel);
    expect(box).toBeGreaterThan(-1);
    expect(plate).toBeGreaterThan(box);
    expect(panel).toBeGreaterThan(plate);
    expect(caption, "the credit stays last in the figure").toBeGreaterThan(panel);
  });

  it("sits under the plate on a phone page and over it from sm", () => {
    expect(code).toContain(
      'className="mt-2 sm:absolute sm:bottom-13 sm:left-3 sm:z-30 sm:mt-0 sm:max-w-sm"',
    );
  });

  it("moves Undo and Clear off the toolbar for the distance tool only", () => {
    expect(code).toMatch(/\{activeTool !== "distance" && \(\s*<>\s*<Button[\s\S]*?handleUndo/);
  });

  it("frames named points above the panel and keeps labels off it", () => {
    expect(code).toContain("const fitInsets =");
    expect(code).toContain("const resultPanelObstacle =");
  });
});
```

- [ ] **Step 2: Run, expect FAIL** —
      `pnpm vitest run components/v2/v2-tool-workbench.structure.test.ts`.

- [ ] **Step 3: Constants.** Below `MAP_CONTROL_INSETS` add:

```ts
/**
 * Where the distance result panel sits when it is on the map (T-120): 12 px in from the left
 * edge, its bottom on top of the scale bar's band (`MAP_CONTROL_INSETS.bottom`, the
 * `sm:bottom-13` class), and 8 px between it and whatever is under it.
 */
const RESULT_PANEL_LEFT = 12;
const RESULT_PANEL_BOTTOM = 52;
const RESULT_PANEL_GAP = 8;
```

- [ ] **Step 4: Measurements.** After the `svgBox` effect add the panel's and the rotate
      hint's sizes:

```ts
// The result panel's border box, which the fit and the labels keep clear of when it is on the
// map (T-120). `offset*`, not `contentRect`: the padding and border cover the map too.
const resultPanelRef = React.useRef<HTMLDivElement | null>(null);
const [resultPanelSize, setResultPanelSize] = React.useState<{ w: number; h: number } | null>(null);
React.useEffect(() => {
  const el = resultPanelRef.current;
  if (!el) return;
  const observer = new ResizeObserver(() =>
    setResultPanelSize({ w: el.offsetWidth, h: el.offsetHeight }),
  );
  observer.observe(el);
  return () => observer.disconnect();
}, []);
// The rotate hint's height, so the panel can sit above it in portrait fullscreen.
const [rotateHintHeight, setRotateHintHeight] = React.useState(0);
const rotateHintRef = React.useCallback((el: HTMLDivElement | null) => {
  if (!el) return;
  const observer = new ResizeObserver(() => setRotateHintHeight(el.offsetHeight));
  observer.observe(el);
  return () => {
    observer.disconnect();
    setRotateHintHeight(0);
  };
}, []);
```

Attach `ref={rotateHintRef}` to the rotate-hint `<div role="status" …>`.

- [ ] **Step 5: Insets and obstacle.** Replace

```ts
const controlInsets = MAP_CONTROL_INSETS[smUp ? "wide" : "phone"];
```

with the lines below, placed AFTER `visibleView` is defined (move the `controlInsets` line
down with them if needed; `focusOnMapPoints` must read `fitInsets` in its body and its deps
array):

```ts
const controlInsets = MAP_CONTROL_INSETS[smUp ? "wide" : "phone"];
// On the page below `sm` the panel is under the plate; from `sm`, and in fullscreen at every
// width, it is on it (spec §3.2).
const resultPanelOnMap = activeTool === "distance" && (landscape.active || smUp);
const resultPanelBottom = landscape.showRotateHint
  ? Math.max(RESULT_PANEL_BOTTOM, 12 + rotateHintHeight + RESULT_PANEL_GAP)
  : RESULT_PANEL_BOTTOM;
// A fit frames named points above the panel: one rectangle to fit into, so the bottom band
// grows by the panel. Labels instead treat the panel as the rectangle it is (below), so a pin
// in the bottom-right keeps its label there.
const fitInsets = React.useMemo(
  () =>
    resultPanelOnMap && resultPanelSize
      ? {
          ...controlInsets,
          bottom: resultPanelBottom + resultPanelSize.h + RESULT_PANEL_GAP,
        }
      : controlInsets,
  [controlInsets, resultPanelOnMap, resultPanelSize, resultPanelBottom],
);
// The panel in map units, as `labelView` converts the control bands.
const resultPanelObstacle = React.useMemo(() => {
  if (!resultPanelOnMap || !resultPanelSize) return null;
  const unit = (px: number) => atScreenSize(px, zoomLevel, pxPerUnit);
  return {
    x: visibleView.x + unit(RESULT_PANEL_LEFT),
    y: visibleView.y + visibleView.h - unit(resultPanelBottom + resultPanelSize.h),
    w: unit(resultPanelSize.w),
    h: unit(resultPanelSize.h),
  };
}, [resultPanelOnMap, resultPanelSize, resultPanelBottom, visibleView, zoomLevel, pxPerUnit]);
```

`focusOnMapPoints` is declared above `visibleView` today; since it is a `useCallback`, move
the whole `focusOnMapPoints` block below this new block (it is only called from handlers, so
order of declaration is the only constraint). In it, `controlInsets` → `fitInsets` in the
`fitPointsView(…)` call and in the deps array.

`landscape` is declared before this point already (`useLandscapeMode(landscapeBoxRef)`).

- [ ] **Step 6: Pin labels keep off the panel.** In the `pinLabelSides` memo change the
      options object to

```ts
      {
        view: labelView,
        dotRadius: unit(PIN_RADIUS + PIN_OUTLINE),
        obstacles: resultPanelObstacle ? [resultPanelObstacle] : [],
      },
```

add `resultPanelObstacle` to its deps, and update the structure test's regex (T-127 block) to
`/placePinLabels\([\s\S]*?\{\s*view: labelView,\s*dotRadius: unit\(PIN_RADIUS \+ PIN_OUTLINE\),\s*obstacles:/`.
(Task 6 widens `obstacles` to include the leg labels.)

- [ ] **Step 7: Toolbar.** Wrap the Undo and Clear `<Button>`s in the toolbar:

```tsx
            {/* Undo / Clear. The distance tool has them on its result panel (T-120); the area
                and coordinate tools keep them here until T-121. */}
            {activeTool !== "distance" && (
              <>
                <Button … onClick={handleUndo} …>{t("undo")}</Button>
                <Button … onClick={handleClear} …>{t("clear")}</Button>
              </>
            )}
```

(the two buttons unchanged inside the fragment.)

- [ ] **Step 8: Wrapper and panel.** Inside `<figure …ref={landscapeBoxRef}…>`, wrap the plate
      `<div ref={mapContainerRef} …>…</div>` in a new div and add the panel after the plate:

```tsx
          {/* The plate and the result panel (T-120): one box, so the panel is rendered once,
              sits in flow under the plate on a phone page and over it from `sm`, and goes
              fullscreen with the map. In fullscreen it flexes like the plate. */}
          <div className="relative" style={landscape.active ? LANDSCAPE_FILL : undefined}>
            <div ref={mapContainerRef} …>…unchanged plate…</div>
            {activeTool === "distance" && (
              <DistanceResultPanel
                ref={resultPanelRef}
                pointCount={points.length}
                distanceKm={distanceKm}
                onUndo={handleUndo}
                onClear={handleClear}
                className="mt-2 sm:absolute sm:bottom-13 sm:left-3 sm:z-30 sm:mt-0 sm:max-w-sm"
                style={
                  landscape.active
                    ? {
                        position: "absolute",
                        left: RESULT_PANEL_LEFT,
                        bottom: resultPanelBottom,
                        marginTop: 0,
                        zIndex: 30,
                        maxWidth: `min(24rem, calc(100% - ${RESULT_PANEL_LEFT * 2}px))`,
                      }
                    : undefined
                }
              />
            )}
          </div>
```

Import `DistanceResultPanel` from `@/components/v2/distance-result-panel`. The inline style
wins over the `sm:` classes, which is how fullscreen below `sm` gets the on-map position;
explain that in one comment line above `style=`, pointing at `LANDSCAPE_FILL`'s docblock for
why this file uses inline styles for fullscreen.

Because `resultPanelRef`'s effect runs once on mount and the panel mounts with the
component (mode never changes on a page), `[]` deps are correct.

- [ ] **Step 9: Run** `pnpm vitest run components/v2` → PASS, including
      `v2-map-credit-placement.test.ts`, `v2-fullscreen-credit.test.ts` and
      `page-composition-cards.test.ts` (the plate itself is unchanged). Then the gate:
      `pnpm typecheck && pnpm lint && pnpm test`.

- [ ] **Step 10: Commit**

```bash
git add components/v2/v2-tool-workbench.tsx components/v2/v2-tool-workbench.structure.test.ts
git commit -m "feat(tools): show the distance result and Undo/Clear on the map (T-120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Leg labels on the distance map

**Files:**

- Modify: `components/v2/v2-tool-workbench.tsx`
- Modify: `components/v2/v2-tool-workbench.structure.test.ts`

**Interfaces:**

- Consumes: `placeSegmentLabels` (Task 3), `resultPanelObstacle` (Task 5),
  `haversineKm`, `kmPerMapUnitAt`, `kmDecimalsFor` from `@/lib/map/measure`.

- [ ] **Step 1: Write the failing structure test** — append:

```ts
// T-120: each leg carries its own distance, one screen size at every zoom, and pin labels keep
// off those labels.
it("labels each leg of a distance route at a constant screen size", () => {
  const code = stripComments(source);
  expect(code).toContain("placeSegmentLabels(");
  expect(code).toContain("haversineKm(");
  expect(code).toContain("kmDecimalsFor(");
  const start = code.indexOf("{legLabels.map(");
  expect(start).toBeGreaterThan(-1);
  const legs = code.slice(start, code.indexOf("{points.map((p, idx) => {", start));
  expect(legs).toContain("fontSize={atScreenSize(PIN_LABEL_SIZE, zoomLevel, pxPerUnit)}");
  expect(legs).toContain("strokeWidth={atScreenSize(PIN_LABEL_HALO, zoomLevel, pxPerUnit)}");
  expect(legs).toContain("pointer-events-none");
  expect(code).toMatch(/obstacles: \[\s*\.\.\.legLabels\.map\(legLabelBox\)/);
});
```

- [ ] **Step 2: Run, expect FAIL** —
      `pnpm vitest run components/v2/v2-tool-workbench.structure.test.ts`.

- [ ] **Step 3: Constants and helper.** Next to the pin constants add:

```ts
/** CSS px between a leg and its distance label's box (T-120). */
const LEG_LABEL_GAP = 3;
/** A leg label's drawn box in map units, from its centre, as `placeSegmentLabels` modelled it. */
function legLabelBox(label: { x: number; y: number; w: number; h: number }) {
  return { x: label.x - label.w / 2, y: label.y - label.h / 2, w: label.w, h: label.h };
}
```

Add `placeSegmentLabels` import from `@/lib/map/segment-labels`, and `haversineKm`,
`kmPerMapUnitAt`, `kmDecimalsFor` to the `@/lib/map/measure` import.

- [ ] **Step 4: Compute the labels.** Directly ABOVE the `pinLabelSides` memo:

```ts
// Each leg's distance beside it (T-120), placed before the pin labels, which then keep off
// them. Same size rules as the pin labels (T-122); the decimals follow what a pixel can resolve
// at this zoom (`kmDecimalsFor`). A leg without room keeps no label; the total is in the panel.
const legLabels = React.useMemo(() => {
  if (activeTool !== "distance" || points.length < 2) return [];
  const unit = (px: number) => atScreenSize(px, zoomLevel, pxPerUnit);
  const legs = points.slice(1).map((p, i) => {
    const from = points[i]!;
    const km = haversineKm(from.geo, p.geo);
    const kmPerPixel = kmPerMapUnitAt((from.geo.lat + p.geo.lat) / 2) * unit(1);
    const text = `${formatNumber(km, locale, kmDecimalsFor(kmPerPixel, km))} km`;
    return {
      text,
      w: unit(text.length * PIN_LABEL_SIZE * 0.6),
      h: unit(PIN_LABEL_SIZE * 1.4),
    };
  });
  const centres = placeSegmentLabels(
    points.map((p) => ({ x: p.svgX, y: p.svgY })),
    legs.map((leg) => ({ width: leg.w, height: leg.h })),
    {
      view: labelView,
      gap: unit(LEG_LABEL_GAP),
      dotRadius: unit(PIN_RADIUS + PIN_OUTLINE),
      obstacles: resultPanelObstacle ? [resultPanelObstacle] : [],
    },
  );
  return centres.flatMap((c, i) => (c ? [{ ...c, ...legs[i]!, leg: i }] : []));
}, [activeTool, points, zoomLevel, pxPerUnit, locale, labelView, resultPanelObstacle]);
```

And in `pinLabelSides` change `obstacles` to:

```ts
        obstacles: [
          ...legLabels.map(legLabelBox),
          ...(resultPanelObstacle ? [resultPanelObstacle] : []),
        ],
```

adding `legLabels` to its deps.

- [ ] **Step 5: Draw them.** In the `<svg>`, between the distance `<polyline>` block and
      `{/* Placed Waypoints Pins */}`:

```tsx
{
  /* Each leg's distance (T-120), under the pins so a dot is never covered. Inside
                the <svg>, so the PNG export carries them. Semibold where the pin names are bold,
                so a name and a distance read as different things. */
}
{
  legLabels.map((label) => (
    <text
      key={label.leg}
      data-leg-label=""
      x={label.x}
      y={label.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={atScreenSize(PIN_LABEL_SIZE, zoomLevel, pxPerUnit)}
      fontWeight={600}
      strokeWidth={atScreenSize(PIN_LABEL_HALO, zoomLevel, pxPerUnit)}
      strokeLinejoin="round"
      paintOrder="stroke"
      className="fill-foreground stroke-card font-sans select-none pointer-events-none"
    >
      {label.text}
    </text>
  ));
}
```

- [ ] **Step 6: Run** `pnpm vitest run components/v2 lib/map` → PASS; then
      `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 7: Commit**

```bash
git add components/v2/v2-tool-workbench.tsx components/v2/v2-tool-workbench.structure.test.ts
git commit -m "feat(tools): label each leg of a distance route with its length (T-120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser verification, docs, PR

**Files:**

- Maybe modify: any of the above for defects found (each fix gets its own test where a node test
  can see it, per the root `CLAUDE.md` "turning mistakes into rules").
- Modify: `../TASKS.md` → move T-120 to the top of `../TASKS-DONE.md` (root, not a git repo).

- [ ] **Step 1: Server.** The `cografya-web-dev` container serves this tree on :3000; confirm
      `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/araclar/mesafe-olcme` → 200.
- [ ] **Step 2: Page checks (Playwright MCP)** at 320, 360, 390 px wide and 1440 px, light and
      dark (`browser_emulate_media` colorScheme). For each:
  - Load, confirm the panel shows "Ölçmek için haritada bir yere tıkla." and both buttons are
    disabled; record the panel's `getBoundingClientRect().height`.
  - Click the map once → one-point hint; twice more at different places → total, flight, road
    visible; panel height identical in all three states (±0.5 px).
  - Below `sm`: panel bottom ≤ viewport height after scrolling the map's top to the viewport's
    top (map and result on one screen). From `sm`: panel rect inside the plate rect, not
    intersecting the scale bar, zoom buttons or fullscreen button rects.
  - Press Undo → point count (points list card) drops by one; Clear → zero; after pressing
    either, confirm no point was added by the press (count as expected).
  - Three-point route: two `[data-leg-label]` elements whose text matches the haversine legs
    (compare with the points list coordinates; the "İzmir - Van" preset gives one ~1.430 km leg).
    Zoom in twice: the labels' `getBoundingClientRect().height` unchanged. No leg label rect
    intersects a pin-label rect or the panel rect.
  - Presets "Edirne - Iğdır" and "Karadeniz Kıyısı (Samsun - Rize)" at 1440 px: no pin or pin
    label rect intersects the panel rect.
  - When measuring rects after a click that scrolled the page, add `scrollX/scrollY` (board note).
- [ ] **Step 3: Fullscreen checks.** Desktop 1440×900: enter fullscreen, panel bottom-left above
      the scale bar, ⓘ bottom-right, no overlap after the credit collapses. 740×360 (landscape
      phone) same. 390×844 with a touch/coarse pointer (Playwright `hasTouch`/`isMobile` context or
      `browser_emulate_media` pointer) so the rotate hint shows: panel rect above the hint rect, no
      overlap; the "Anladım" button still clickable.
- [ ] **Step 4: Overflow sweep** `pnpm sweep:overflow -- --filter=/araclar/mesafe-olcme` → green.
      Save any screenshots under `../.playwright-mcp/`.
- [ ] **Step 5: Final gate** `pnpm typecheck && pnpm lint && pnpm test` → green; commit any
      fixes from Steps 2–4 with their tests.
- [ ] **Step 6: Board.** Move the T-120 block from `../TASKS.md` to the top of
      `../TASKS-DONE.md` with a one-line outcome (PR link filled in after Step 7).
- [ ] **Step 7: Push and PR** (the active gh account cannot open PRs here; use the
      `Sertturk16` token per command as the `gh-pr-account` memory says):

```bash
git push -u origin feature/t120-distance-result-panel
GH_TOKEN=… gh pr create --base dev --title "feat(tools): distance result and leg labels on the map (T-120)" --body "…summary, test plan…

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Report the PR link.
