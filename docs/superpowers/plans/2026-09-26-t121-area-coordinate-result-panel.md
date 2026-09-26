# T-121 Area and Coordinate Result Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The area and coordinate tools show their result and actions in the shared result panel
on the map (page and fullscreen, every width), and the area tool writes its km² inside the drawn
polygon.

**Architecture:** `MapResultPanel` stays the one panel; two thin presentational wrappers
(`AreaResultPanel`, `CoordinateResultPanel`) sit beside T-120's `DistanceResultPanel`. The
workbench renders one of the three with one shared placement object, and T-120's placement,
fit-inset and obstacle logic is generalised from "distance only" to every tool. A new pure module
`lib/map/area-label.ts` places the area label; pin labels then treat it as an obstacle.

**Tech Stack:** Next.js (App Router) client component, React 19 (`ref` as a prop), next-intl,
Tailwind v4, vitest (node env, `renderToStaticMarkup`, no jsdom), Playwright MCP for manual checks.

**Spec:** `docs/superpowers/specs/2026-09-26-t121-area-coordinate-result-panel-design.md` (builds
on `docs/superpowers/specs/2026-09-26-t120-distance-result-panel-design.md`).

## Global Constraints

- Work in `cografya_web` on branch `feature/t121-area-coordinate-result-panel` (already created,
  spec committed). Never `git worktree add`, never symlink `node_modules`.
- Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test`. Conventional Commits,
  each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code, comments and docs in English; user-facing copy in Turkish (TR approved in the spec, EN
  alongside in `messages/en.json`).
- Colours only through theme keys (`text-accent`, `text-secondary`, `text-warning-strong`,
  `text-muted-foreground`, ...). No hex.
- Import `Button` from `@/components/ui/button`; no `asChild`.
- Panel rules inherited from T-120: `aria-disabled`, never `disabled`, on panel buttons; one
  always-mounted `role="status"` line; the panel keeps one size in every state of one tool; every
  visible text line in the panel is `whitespace-nowrap`.
- The map label sizes use `atScreenSize(px, zoomLevel, pxPerUnit)` so they keep one screen size at
  every zoom (T-122).
- Visible UI change: `pnpm sweep:overflow -- --filter=<route>` green against the running dev
  server on :3000; check 320, 360, 390 px and desktop, light and dark, with Playwright MCP.
  Screenshots go under `../.playwright-mcp/`.
- Vitest runs nothing under `app/`; tests live next to code.

## Review Focus

1. **English at 320 px.** EN hints are longer ("Place the corners on the map in order to get an
   area.") and wrap to two lines; the area details row is two lines, so the panel must not grow.
   The coordinate details row is also two lines. Checked by the EN pass in Task 6 step 4.
2. **Zero-area ring (three collinear clicks).** `readRingArea` returns an area of 0 and no
   self-intersection; `placeAreaLabel` must not throw and must put "0,0 km²" outside the line,
   not on it. Test in Task 1.
3. **Polygon partly panned out of view.** Inside candidates off the view are skipped; the label
   moves to a visible inside spot, goes outside, or hides. Never drawn under a control band. Test
   in Task 1 (view clipping).
4. **Coordinate in the sea or abroad.** `detectedProvince` is `null`; the summary reads
   "Türkiye dışında" and the status line says so. Test in Task 3.
5. **Copy with no point.** `handleCopy` would write an empty string; the panel's Copy is
   `aria-disabled` and its `onClick` is not wired while there is no reading. Test in Task 3.

---

### Task 1: `placeAreaLabel` — where the area label goes

**Files:**

- Create: `lib/map/area-label.ts`
- Test: `lib/map/area-label.test.ts`

**Interfaces:**

- Consumes: `overlapArea`, `type Box` from `@/lib/map/pin-label-placement` (`Box` is
  `{ x; y; w; h }`, top-left origin, map units); `segmentHitsBox(a, b, box)` from
  `@/lib/map/segment-labels` (touching counts as hitting); `pointInPolygon(point, polygon)` from
  `@/lib/map/shape-geometry`.
- Produces:

  ```ts
  export interface AreaLabelSize {
    width: number;
    height: number;
  }
  export function placeAreaLabel(
    ring: readonly { x: number; y: number }[],
    size: AreaLabelSize,
    opts: { view: Box; gap: number; dotRadius: number; obstacles?: readonly Box[] },
  ): { x: number; y: number } | null; // label centre, or null when hidden
  ```

- [ ] **Step 1: Write the failing tests**

Create `lib/map/area-label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { overlapArea, type Box } from "./pin-label-placement";
import { placeAreaLabel } from "./area-label";
import { segmentHitsBox } from "./segment-labels";
import { pointInPolygon } from "./shape-geometry";

/**
 * T-121. The area tool writes its km² inside the polygon; when the label does not fit inside it
 * goes just outside, and when nothing is free it is dropped (the panel always has the area).
 */
const SIZE = { width: 20, height: 8 };
const BIG_VIEW: Box = { x: -500, y: -500, w: 1000, h: 1000 };
const opts = (extra: Partial<Parameters<typeof placeAreaLabel>[2]> = {}) => ({
  view: BIG_VIEW,
  gap: 2,
  dotRadius: 1,
  ...extra,
});
const boxAt = (c: { x: number; y: number }, size = SIZE): Box => ({
  x: c.x - size.width / 2,
  y: c.y - size.height / 2,
  w: size.width,
  h: size.height,
});
const edgesOf = (ring: { x: number; y: number }[]) =>
  ring.map((p, i) => [p, ring[(i + 1) % ring.length]!] as const);

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
// An L whose area centroid (≈32.2, 32.2) falls in the notch, outside the shape. The vertical arm
// is exactly as wide as the label, so only the horizontal arm (y 0–20) can hold it.
const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 20 },
  { x: 20, y: 20 },
  { x: 20, y: 100 },
  { x: 0, y: 100 },
];
const TINY = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 5, y: 8 },
];

describe("placeAreaLabel", () => {
  it("centres the label on a convex ring's centroid", () => {
    expect(placeAreaLabel(SQUARE, SIZE, opts())).toEqual({ x: 50, y: 50 });
  });

  it("finds room inside a concave ring whose centroid falls outside it", () => {
    const c = placeAreaLabel(L_SHAPE, SIZE, opts());
    expect(c).not.toBeNull();
    expect(pointInPolygon(c!, L_SHAPE)).toBe(true);
    expect(c!.y).toBeLessThan(20);
    for (const [a, b] of edgesOf(L_SHAPE)) expect(segmentHitsBox(a, b, boxAt(c!))).toBe(false);
  });

  it("puts the label just below a ring too small to hold it", () => {
    // Bottom of the ring's box (8) + dot radius (1) + gap (2) + half the label height (4).
    expect(placeAreaLabel(TINY, SIZE, opts())).toEqual({ x: 5, y: 15 });
  });

  it("goes above when below leaves the view", () => {
    const view: Box = { x: -100, y: -100, w: 200, h: 110 }; // ends at y = 10
    expect(placeAreaLabel(TINY, SIZE, opts({ view }))).toEqual({ x: 5, y: -7 });
  });

  it("goes above when below is on an obstacle (the result panel)", () => {
    const panel: Box = { x: -50, y: 10, w: 100, h: 40 };
    expect(placeAreaLabel(TINY, SIZE, opts({ obstacles: [panel] }))).toEqual({ x: 5, y: -7 });
  });

  it("drops the label when every candidate is blocked", () => {
    const wall: Box = { x: -400, y: -400, w: 800, h: 800 };
    expect(placeAreaLabel(TINY, SIZE, opts({ obstacles: [wall] }))).toBeNull();
    expect(placeAreaLabel(SQUARE, SIZE, opts({ obstacles: [wall] }))).toBeNull();
  });

  it("never covers a corner dot, moving outside instead", () => {
    const flat = [
      { x: 0, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 12 },
      { x: 0, y: 12 },
    ];
    // Small dots: the label fits inside, box 2–22 × 2–10.
    expect(placeAreaLabel(flat, SIZE, opts({ dotRadius: 1 }))).toEqual({ x: 12, y: 6 });
    // Dots of radius 3 reach into that box, so it goes below: 12 + 3 + 2 + 4.
    const c = placeAreaLabel(flat, SIZE, opts({ dotRadius: 3 }));
    expect(c).toEqual({ x: 12, y: 21 });
  });

  it("keeps an inside label within the view when the ring is partly off it", () => {
    const view: Box = { x: 60, y: -10, w: 200, h: 200 }; // the ring's left 60 units are off view
    const c = placeAreaLabel(SQUARE, SIZE, opts({ view }));
    expect(c).not.toBeNull();
    const box = boxAt(c!);
    expect(box.w * box.h - overlapArea(box, view)).toBeLessThan(1e-9);
    expect(pointInPolygon(c!, SQUARE)).toBe(true);
  });

  it("puts a zero-area ring's label beside the line, not on it", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const c = placeAreaLabel(line, SIZE, opts());
    expect(c).not.toBeNull();
    for (const [a, b] of edgesOf(line)) expect(segmentHitsBox(a, b, boxAt(c!))).toBe(false);
  });

  it("has nothing to label below three points", () => {
    expect(placeAreaLabel(TINY.slice(0, 2), SIZE, opts())).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/map/area-label.test.ts`
Expected: FAIL, `Failed to resolve import "./area-label"`.

- [ ] **Step 3: Implement `lib/map/area-label.ts`**

```ts
import { overlapArea, type Box } from "@/lib/map/pin-label-placement";
import { segmentHitsBox } from "@/lib/map/segment-labels";
import { pointInPolygon } from "@/lib/map/shape-geometry";

/**
 * Where the area tool writes its km² (T-121).
 *
 * Inside first: horizontal scan lines across the ring's box give candidates per inside interval
 * (its midpoint, and the midpoint of the part of it inside `view`, for a shape partly panned out
 * of sight), plus the ring's area centroid itself. A candidate fits when its centre
 * is inside the ring and no ring edge touches its box (then the whole box is inside), and the box
 * stays in `view`, off every vertex dot and off `obstacles` (the result panel). The fitting
 * candidate closest to the centroid wins, so a convex shape gets its label in the middle and a
 * concave one in its widest part near the middle.
 *
 * Outside next: just below, above, right of and left of the ring's box, clear of the edge dots, in
 * that order; the first free one wins. Nothing free: the label is dropped, the cartographic
 * default, and the area is always in the result panel. Pin labels are placed after this one and
 * keep off it.
 *
 * All values are map units; the caller converts CSS px with `atScreenSize`.
 */

interface Point {
  x: number;
  y: number;
}

export interface AreaLabelSize {
  width: number;
  height: number;
}

/** Scan lines across the ring's box; enough to find the wide part of a hand-drawn shape. */
const SCAN_LINES = 24;
const EPSILON = 1e-9;

/** The ring's area centroid, or its vertex mean when the ring has no area. */
function centroid(ring: readonly Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < EPSILON) {
    return {
      x: ring.reduce((sum, p) => sum + p.x, 0) / ring.length,
      y: ring.reduce((sum, p) => sum + p.y, 0) / ring.length,
    };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

export function placeAreaLabel(
  ring: readonly Point[],
  size: AreaLabelSize,
  {
    view,
    gap,
    dotRadius,
    obstacles = [],
  }: { view: Box; gap: number; dotRadius: number; obstacles?: readonly Box[] },
): Point | null {
  if (ring.length < 3) return null;
  const { width: w, height: h } = size;
  const edges = ring.map((p, i) => [p, ring[(i + 1) % ring.length]!] as const);
  const blockers = [
    ...obstacles,
    ...ring.map((p) => ({
      x: p.x - dotRadius,
      y: p.y - dotRadius,
      w: dotRadius * 2,
      h: dotRadius * 2,
    })),
  ];
  const boxAt = (c: Point): Box => ({ x: c.x - w / 2, y: c.y - h / 2, w, h });
  const touchesEdge = (box: Box) => edges.some(([a, b]) => segmentHitsBox(a, b, box));
  const isClear = (box: Box) =>
    box.w * box.h - overlapArea(box, view) <= EPSILON &&
    blockers.every((other) => overlapArea(box, other) <= 0);

  const minX = Math.min(...ring.map((p) => p.x));
  const maxX = Math.max(...ring.map((p) => p.x));
  const minY = Math.min(...ring.map((p) => p.y));
  const maxY = Math.max(...ring.map((p) => p.y));
  const target = centroid(ring);

  const candidates: Point[] = [target];
  for (let k = 0; k < SCAN_LINES; k++) {
    const y = minY + ((k + 0.5) * (maxY - minY)) / SCAN_LINES;
    const xs: number[] = [];
    for (const [a, b] of edges) {
      if (a.y > y === b.y > y) continue;
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const left = xs[i]!;
      const right = xs[i + 1]!;
      candidates.push({ x: (left + right) / 2, y });
      // The part of the interval inside the view, for a shape partly panned out of sight.
      const seenLeft = Math.max(left, view.x);
      const seenRight = Math.min(right, view.x + view.w);
      if (seenRight > seenLeft) candidates.push({ x: (seenLeft + seenRight) / 2, y });
    }
  }
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const box = boxAt(c);
    if (!pointInPolygon(c, ring) || touchesEdge(box) || !isClear(box)) continue;
    const distance = Math.hypot(c.x - target.x, c.y - target.y);
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  }
  if (best) return best;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const off = dotRadius + gap;
  const outside: Point[] = [
    { x: midX, y: maxY + off + h / 2 },
    { x: midX, y: minY - off - h / 2 },
    { x: maxX + off + w / 2, y: midY },
    { x: minX - off - w / 2, y: midY },
  ];
  for (const c of outside) {
    const box = boxAt(c);
    if (!touchesEdge(box) && isClear(box)) return c;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/map/area-label.test.ts`
Expected: PASS, 10 tests. If "centres the label on a convex ring's centroid" fails on float noise
(e.g. `50.00000000000001`), keep `toEqual` and check `centroid`'s sign handling rather than
loosening the test: for the axis-aligned square the arithmetic is exact.

- [ ] **Step 5: Commit**

```bash
git add lib/map/area-label.ts lib/map/area-label.test.ts
git commit -m "feat(map): place the area tool's km² label inside its polygon (T-121)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `AreaResultPanel` and the warning hint tone

**Files:**

- Modify: `components/v2/map-result-panel.tsx` (add `hintTone` prop)
- Create: `components/v2/area-result-panel.tsx`
- Create: `components/v2/area-result-panel.test.tsx`
- Create: `components/v2/map-result-panel.test.tsx`
- Modify: `messages/tr.json`, `messages/en.json` (namespace `ToolWorkbench`, after
  `resultPanelOnePointDistance`, line ~497)

**Interfaces:**

- Consumes: `MapResultPanel`, `MapResultAction` from `@/components/v2/map-result-panel`;
  `MEASUREMENT_MIN_POINTS` from `@/lib/measurements/shape` (`{ coordinate: 1, distance: 2, area: 3 }`).
- Produces:

  ```ts
  // map-result-panel.tsx: new optional prop on MapResultPanel
  hintTone?: "muted" | "warning"; // default "muted"
  // area-result-panel.tsx
  export function AreaResultPanel(props: {
    pointCount: number;
    isSelfIntersecting: boolean;
    area: string;       // formatNumber(areaKm2, locale, 1), e.g. "1.234,5"
    hectares: string;   // t("hectaresValue", …), e.g. "123.450 ha"
    decares: string;    // t("decaresValue", …), e.g. "1.234.500 dönüm"
    perimeter: string;  // formatNumber(perimeterKm, locale, 1), e.g. "150,2"
    onUndo: () => void;
    onClear: () => void;
    className?: string;
    style?: React.CSSProperties;
    ref?: React.Ref<HTMLDivElement>;
  }): React.JSX.Element;
  ```

- [ ] **Step 1: Add the message keys**

In `messages/tr.json`, `ToolWorkbench`, right after `"resultPanelOnePointDistance": …,`:

```json
    "resultPanelEmptyArea": "Alan için haritada köşeleri sırayla koy.",
    "resultPanelFewPointsArea": "Şeklin kapanması için {count} köşe daha koy.",
    "resultPanelSelfIntersect": "Kenarlar kesişiyor, alan yazılmaz.",
```

In `messages/en.json`, same place:

```json
    "resultPanelEmptyArea": "Place the corners on the map in order to get an area.",
    "resultPanelFewPointsArea": "Add {count} more corner(s) to close the shape.",
    "resultPanelSelfIntersect": "The edges cross, so there is no area.",
```

- [ ] **Step 2: Write the failing tests**

Create `components/v2/map-result-panel.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapResultPanel } from "./map-result-panel";

/** T-121: the hint line can carry a warning (the area tool's crossing edges) as well as a nudge. */
const render = (hintTone?: "muted" | "warning") =>
  renderToStaticMarkup(
    <MapResultPanel
      label="Ölçüm sonucu"
      summary="—"
      details="x"
      actions={null}
      hint="Kenarlar kesişiyor, alan yazılmaz."
      hintTone={hintTone}
      status="Kenarlar kesişiyor, alan yazılmaz."
    />,
  );
const hintClass = (html: string) => /<p data-result-hint="" class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("MapResultPanel hint tone", () => {
  it("is muted by default", () => {
    expect(hintClass(render())).toMatch(/\btext-muted-foreground\b/);
    expect(hintClass(render())).not.toMatch(/\btext-warning-strong\b/);
  });

  it("uses the warning colour when asked", () => {
    expect(hintClass(render("warning"))).toMatch(/\btext-warning-strong\b/);
    expect(hintClass(render("warning"))).not.toMatch(/\btext-muted-foreground\b/);
  });
});
```

Create `components/v2/area-result-panel.test.tsx`:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { AreaResultPanel } from "./area-result-panel";

/**
 * T-121. The area tool's panel: the hints before a shape closes, the crossing-edges warning in
 * place of the number (T-094), and the area with its hectares, decares and perimeter.
 */
const render = (pointCount: number, isSelfIntersecting = false) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <AreaResultPanel
        pointCount={pointCount}
        isSelfIntersecting={isSelfIntersecting}
        area="1.234,5"
        hectares="123.450 ha"
        decares="1.234.500 dönüm"
        perimeter="150,2"
        onUndo={() => {}}
        onClear={() => {}}
      />
    </NextIntlClientProvider>,
  );

const status = (html: string) =>
  /<p role="status" aria-atomic="true" class="sr-only">(.*?)<\/p>/.exec(html)?.[1];
const detailsCell = (html: string) =>
  /<div data-result-details="" class="([^"]*)"/.exec(html)?.[1] ?? "";
const hintClass = (html: string) => /<p data-result-hint="" class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("AreaResultPanel", () => {
  it("asks for corners before the first one, with a dash and the buttons off but focusable", () => {
    const html = render(0);
    expect(status(html)).toBe("Alan için haritada köşeleri sırayla koy.");
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    expect(html).toContain("—");
    expect(html.match(/<button[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("counts down the corners still needed to close the shape", () => {
    expect(status(render(1))).toBe("Şeklin kapanması için 2 köşe daha koy.");
    expect(status(render(2))).toBe("Şeklin kapanması için 1 köşe daha koy.");
    expect(render(1)).not.toMatch(/aria-disabled="true"/);
  });

  it("shows the crossing-edges warning in place of the area, in the warning colour", () => {
    const html = render(4, true);
    expect(status(html)).toBe("Kenarlar kesişiyor, alan yazılmaz.");
    expect(hintClass(html)).toMatch(/\btext-warning-strong\b/);
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    // T-094: no figure next to the warning. The invisible sizing copy is aria-hidden and hidden.
    expect(html).toMatch(/<span[^>]*>—<\/span>/);
  });

  it("shows the area, hectares, decares and perimeter once the shape closes", () => {
    const html = render(3);
    expect(detailsCell(html)).not.toMatch(/\binvisible\b/);
    expect(html).toContain("1.234,5");
    expect(html).toContain("123.450 ha · 1.234.500 dönüm");
    expect(html).toContain("Çevre uzunluğu 150,2 km");
    expect(status(html)).toBe(
      "Kapanan şeklin alanı: 1.234,5 km². Hektar: 123.450 ha. Dönüm: 1.234.500 dönüm. Çevre uzunluğu: 150,2 km.",
    );
  });

  it("keeps every visible line on one row, so the panel never grows", () => {
    const html = render(3);
    const lines = html.match(/<p class="m-0 whitespace-nowrap[^"]*"/g) ?? [];
    expect(lines).toHaveLength(2);
  });

  it("names Undo and Clear even where the button text is visually hidden", () => {
    const html = render(3);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Geri Al<\/span>/);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Temizle<\/span>/);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run components/v2/map-result-panel.test.tsx components/v2/area-result-panel.test.tsx`
Expected: FAIL — `map-result-panel.test.tsx` on the warning case (no `text-warning-strong`), and
`area-result-panel.test.tsx` with `Failed to resolve import "./area-result-panel"`.

- [ ] **Step 4: Add `hintTone` to `MapResultPanel`**

In `components/v2/map-result-panel.tsx`:

1. Add `hintTone = "muted",` to the destructured props after `hint,`, and
   `hintTone?: "muted" | "warning";` to the props type after `hint?: string;`.
2. Extend the JSDoc paragraph about `hint` with one sentence:
   `` `hintTone: "warning"` colours it as a warning (the area tool's crossing edges, T-121). ``
3. Replace the hint `<p>`'s `className` string:

```tsx
          className={cn(
            "col-start-1 col-span-2 row-start-2 m-0 self-center text-[11px] leading-4",
            hintTone === "warning" ? "text-warning-strong" : "text-muted-foreground",
          )}
```

- [ ] **Step 5: Create `components/v2/area-result-panel.tsx`**

```tsx
"use client";

import * as React from "react";
import { Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { MEASUREMENT_MIN_POINTS } from "@/lib/measurements/shape";
import { cn } from "@/lib/utils";
import { MapResultAction, MapResultPanel } from "@/components/v2/map-result-panel";

/**
 * The area tool's result on its map (T-121): the closed shape's area, its hectares, decares and
 * perimeter, with Undo and Clear beside them. The figures arrive formatted, from the same values
 * the result card below the map shows, so the two cannot disagree.
 *
 * A crossing outline has no area (T-094): the warning takes the hint line and the total reads
 * "—", never a figure beside a warning.
 */
export function AreaResultPanel({
  pointCount,
  isSelfIntersecting,
  area,
  hectares,
  decares,
  perimeter,
  onUndo,
  onClear,
  className,
  style,
  ref,
}: {
  pointCount: number;
  isSelfIntersecting: boolean;
  area: string;
  hectares: string;
  decares: string;
  perimeter: string;
  onUndo: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("ToolWorkbench");
  const missing = MEASUREMENT_MIN_POINTS.area - pointCount;
  const hint =
    pointCount === 0
      ? t("resultPanelEmptyArea")
      : missing > 0
        ? t("resultPanelFewPointsArea", { count: missing })
        : isSelfIntersecting
          ? t("resultPanelSelfIntersect")
          : undefined;

  return (
    <MapResultPanel
      ref={ref}
      label={t("resultPanelLabel")}
      hint={hint}
      hintTone={isSelfIntersecting && missing <= 0 ? "warning" : "muted"}
      status={
        hint ??
        `${t("areaTotal")}: ${area} km². ${t("hectares")}: ${hectares}. ${t("decares")}: ${decares}. ${t("perimeter")}: ${perimeter} km.`
      }
      className={className}
      style={style}
      summary={
        <p className="m-0 flex items-baseline gap-1 leading-7">
          <span
            className={cn(
              "font-heading font-mono text-lg font-extrabold",
              hint ? "text-muted-foreground" : "text-accent",
            )}
          >
            {hint ? "—" : area}
          </span>
          <span className="text-sm font-bold text-foreground">km²</span>
        </p>
      }
      // Sans with tabular figures, not mono: Türkiye's whole area in hectares and decares is one
      // pixel wider than a 320 px phone's panel in 11 px mono.
      details={
        <div className="text-[11px] leading-4 text-muted-foreground tabular-nums">
          <p className="m-0 whitespace-nowrap">{`${hectares} · ${decares}`}</p>
          <p className="m-0 whitespace-nowrap">{`${t("perimeter")} ${perimeter} km`}</p>
        </div>
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

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run components/v2/map-result-panel.test.tsx components/v2/area-result-panel.test.tsx components/v2/distance-result-panel.test.tsx`
Expected: PASS. (The status assertion in "shows the area…" relies on `hectares`/`decares` label
keys being "Hektar"/"Dönüm" in `messages/tr.json`, lines ~511/513; if the render shows a different
label, the test reads the wrong key, fix the component, not the expectation.)

- [ ] **Step 7: Gate and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. `components/v2/page-composition-cards.test.ts` may now fail on
`COMPUTED_CARD_CLASSNAMES` (180 → 181) because `AreaResultPanel` passes `className={className}`
like `DistanceResultPanel`. If so, bump both `COMPUTED_CARD_CLASSNAMES` and the
`["identifier", …]` entry by exactly 1 and add a note line in both comment blocks, in the style of
the T-120 line: `T-121: 180 → **181**. \`AreaResultPanel\` hands its caller's placement to
\`MapResultPanel\` (\`className={className}\`); not a card of its own.` Any other change in that
test is unexpected: investigate before touching numbers.

```bash
git add components/v2/map-result-panel.tsx components/v2/map-result-panel.test.tsx \
  components/v2/area-result-panel.tsx components/v2/area-result-panel.test.tsx \
  components/v2/page-composition-cards.test.ts messages/tr.json messages/en.json
git commit -m "feat(tools): add the area tool's result panel (T-121)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `CoordinateResultPanel`

**Files:**

- Create: `components/v2/coordinate-result-panel.tsx`
- Create: `components/v2/coordinate-result-panel.test.tsx`
- Modify: `messages/tr.json`, `messages/en.json` (namespace `ToolWorkbench`, after the Task 2
  keys)
- Possibly modify: `components/v2/page-composition-cards.test.ts` (181 → 182)

**Interfaces:**

- Consumes: `MapResultPanel`, `MapResultAction` (Task 2 state).
- Produces:

  ```ts
  export interface CoordinateReading {
    latDecimal: string; // e.g. "39,925533° K"
    lonDecimal: string; // e.g. "32,866287° D"
    latDms: string; // the workbench's toDms(lat, true)
    lonDms: string; // the workbench's toDms(lon, false)
    province: string | null; // detectedProvince?.name ?? null
  }
  export function CoordinateResultPanel(props: {
    reading: CoordinateReading | null;
    copied: boolean;
    onCopy: () => void;
    onClear: () => void;
    className?: string;
    style?: React.CSSProperties;
    ref?: React.Ref<HTMLDivElement>;
  }): React.JSX.Element;
  ```

- [ ] **Step 1: Add the message keys**

`messages/tr.json`, after `resultPanelSelfIntersect`:

```json
    "resultPanelEmptyCoordinates": "Koordinat için haritada bir yere tıkla.",
    "resultPanelOutside": "Türkiye dışında",
    "resultPanelCopy": "Kopyala",
```

`messages/en.json`, same place:

```json
    "resultPanelEmptyCoordinates": "Click the map to get a coordinate.",
    "resultPanelOutside": "Outside Türkiye",
    "resultPanelCopy": "Copy",
```

- [ ] **Step 2: Write the failing tests**

Create `components/v2/coordinate-result-panel.test.tsx`:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { CoordinateResultPanel, type CoordinateReading } from "./coordinate-result-panel";

/**
 * T-121. The coordinate tool's panel: the province the point falls in, its decimal and DMS
 * coordinates per axis, Copy and Clear.
 */
const ANKARA: CoordinateReading = {
  latDecimal: "39,925533° K",
  lonDecimal: "32,866287° D",
  latDms: `39° 55' 31,9" K`,
  lonDms: `32° 51' 58,6" D`,
  province: "Ankara",
};
const render = (reading: CoordinateReading | null, copied = false) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <CoordinateResultPanel
        reading={reading}
        copied={copied}
        onCopy={() => {}}
        onClear={() => {}}
      />
    </NextIntlClientProvider>,
  );
const status = (html: string) =>
  /<p role="status" aria-atomic="true" class="sr-only">(.*?)<\/p>/.exec(html)?.[1];
const detailsCell = (html: string) =>
  /<div data-result-details="" class="([^"]*)"/.exec(html)?.[1] ?? "";
// renderToStaticMarkup escapes the DMS minute and second marks.
const unescape = (s: string | undefined) => s?.replaceAll("&quot;", '"').replaceAll("&#x27;", "'");

describe("CoordinateResultPanel", () => {
  it("asks for a click before there is a point, with Copy and Clear off but focusable", () => {
    const html = render(null);
    expect(status(html)).toBe("Koordinat için haritada bir yere tıkla.");
    expect(detailsCell(html)).toMatch(/\binvisible\b/);
    expect(html).toContain("—");
    expect(html.match(/<button[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("shows the province and both coordinate forms per axis", () => {
    const html = render(ANKARA);
    expect(detailsCell(html)).not.toMatch(/\binvisible\b/);
    expect(html).toContain("Ankara");
    expect(html).toContain("39,925533° K");
    expect(html).toContain("32,866287° D");
    expect(unescape(html)).toContain(`39° 55' 31,9" K`);
    expect(html).not.toMatch(/aria-disabled="true"/);
    expect(unescape(status(html))).toBe(
      `Ondalık derece, WGS84: 39,925533° K, 32,866287° D. Derece-dakika-saniye: 39° 55' 31,9" K, 32° 51' 58,6" D. Noktanın Düştüğü İl: Ankara.`,
    );
  });

  it("says the point is outside Türkiye when no province holds it", () => {
    const html = render({ ...ANKARA, province: null });
    expect(html).toContain("Türkiye dışında");
    expect(status(html)).toMatch(/Noktanın Düştüğü İl: Türkiye dışında\.$/);
  });

  it("switches the Copy button to its done state", () => {
    expect(render(ANKARA)).toMatch(/<span class="sr-only sm:not-sr-only">Kopyala<\/span>/);
    expect(render(ANKARA, true)).toMatch(
      /<span class="sr-only sm:not-sr-only">Kopyalandı!<\/span>/,
    );
  });

  it("names Clear, and offers no Undo on a one-point tool", () => {
    const html = render(ANKARA);
    expect(html).toMatch(/<span class="sr-only sm:not-sr-only">Temizle<\/span>/);
    expect(html).not.toContain("Geri Al");
  });

  it("keeps every visible line on one row, so the panel never grows", () => {
    const html = render(ANKARA);
    // Province, and decimal + DMS for each axis.
    expect(html.match(/<p class="m-0 whitespace-nowrap[^"]*"/g) ?? []).toHaveLength(5);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run components/v2/coordinate-result-panel.test.tsx`
Expected: FAIL, `Failed to resolve import "./coordinate-result-panel"`.

- [ ] **Step 4: Create `components/v2/coordinate-result-panel.tsx`**

```tsx
"use client";

import * as React from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MapResultAction, MapResultPanel } from "@/components/v2/map-result-panel";

/** The coordinate tool's point, formatted by the workbench as its result card shows it. */
export interface CoordinateReading {
  latDecimal: string;
  lonDecimal: string;
  latDms: string;
  lonDms: string;
  province: string | null;
}

/**
 * Sizing copy for the details row before there is a point: the row stays mounted, invisible, so
 * the panel is as tall empty as with a point (the T-126 rule). Never visible or announced.
 */
const SIZING_READING: CoordinateReading = {
  latDecimal: "39,925533° K",
  lonDecimal: "32,866287° D",
  latDms: `39° 55' 31,9" K`,
  lonDms: `32° 51' 58,6" D`,
  province: null,
};

/**
 * The coordinate tool's result on its map (T-121): the province the point falls in as the
 * headline, latitude and longitude in two columns (decimal over degrees-minutes-seconds), Copy and
 * Clear. At 320 px the decimal pair does not fit beside the buttons on one line, which is why the
 * province, not the coordinate, is the summary. No Undo: with one point it would be Clear.
 */
export function CoordinateResultPanel({
  reading,
  copied,
  onCopy,
  onClear,
  className,
  style,
  ref,
}: {
  reading: CoordinateReading | null;
  copied: boolean;
  onCopy: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("ToolWorkbench");
  const hint = reading ? undefined : t("resultPanelEmptyCoordinates");
  const shown = reading ?? SIZING_READING;
  const place = shown.province ?? t("resultPanelOutside");

  return (
    <MapResultPanel
      ref={ref}
      label={t("resultPanelLabel")}
      hint={hint}
      status={
        hint ??
        `${t("decimalDegreesLabel")}: ${shown.latDecimal}, ${shown.lonDecimal}. ${t("dmsLabel")}: ${shown.latDms}, ${shown.lonDms}. ${t("provinceHitLabel")} ${place}.`
      }
      className={className}
      style={style}
      summary={
        <p
          className={cn(
            "m-0 whitespace-nowrap font-heading text-sm font-bold leading-7",
            hint ? "text-muted-foreground" : "text-secondary",
          )}
        >
          {hint ? "—" : place}
        </p>
      }
      details={
        <div className="grid grid-cols-2 gap-x-3 font-mono leading-4">
          {(
            [
              ["lat", shown.latDecimal, shown.latDms],
              ["lon", shown.lonDecimal, shown.lonDms],
            ] as const
          ).map(([axis, decimal, dms]) => (
            <div key={axis} className="min-w-0">
              <p className="m-0 whitespace-nowrap text-xs font-bold text-foreground">{decimal}</p>
              <p className="m-0 whitespace-nowrap text-[11px] text-muted-foreground">{dms}</p>
            </div>
          ))}
        </div>
      }
      actions={
        <>
          <MapResultAction
            icon={
              copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )
            }
            label={copied ? t("copied") : t("resultPanelCopy")}
            onClick={onCopy}
            disabled={!reading}
          />
          <MapResultAction
            icon={<Trash2 className="size-3.5 text-destructive" aria-hidden="true" />}
            label={t("clear")}
            onClick={onClear}
            disabled={!reading}
          />
        </>
      }
    />
  );
}
```

`MapResultAction` already drops `onClick` while `disabled` (`onClick={disabled ? undefined :
onClick}`), which covers Review Focus 5.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run components/v2/coordinate-result-panel.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Gate and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green. If `page-composition-cards.test.ts` reports 181 → 182, bump both numbers by 1
with a note line naming `CoordinateResultPanel`, as in Task 2 step 7.

```bash
git add components/v2/coordinate-result-panel.tsx components/v2/coordinate-result-panel.test.tsx \
  components/v2/page-composition-cards.test.ts messages/tr.json messages/en.json
git commit -m "feat(tools): add the coordinate tool's result panel (T-121)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the panels into the workbench; Undo/Clear leave the toolbar

**Files:**

- Modify: `components/v2/v2-tool-workbench.tsx`
- Modify: `components/v2/v2-tool-workbench.structure.test.ts` (T-120 block, lines ~456–491)
- Possibly modify: `components/v2/page-composition-cards.test.ts`

**Interfaces:**

- Consumes: `AreaResultPanel` (Task 2), `CoordinateResultPanel`, `type CoordinateReading`
  (Task 3), existing workbench locals: `resultPanelRef`, `landscape`, `lgUp`,
  `resultPanelBottom`, `RESULT_PANEL_LEFT`, `RESULT_PANEL_WIDTH`, `handleUndo`, `handleClear`,
  `handleCopy`, `copied`, `areaKm2`, `perimeterKm`, `isSelfIntersecting`, `numberLocale`,
  `cardinals` (`{ north, south, east, west }`), `toDms(val, isLat)`, `detectedProvince`
  (`{ name } | null`).
- Produces (used by Task 5): `resultPanelOnMap` now `landscape.active || lgUp`; unchanged names
  `resultPanelObstacle`, `fitInsets`.

- [ ] **Step 1: Update the structure test first**

In `components/v2/v2-tool-workbench.structure.test.ts`, replace the whole
`describe("distance result panel (T-120)", …)` block with:

```ts
// T-120 (distance) and T-121 (area, coordinates): the result sits on the map, inside the
// fullscreen target, with the tool's actions; Undo and Clear are no longer in the toolbar.
describe("result panel (T-120, T-121)", () => {
  const code = stripComments(source);

  it.each(["DistanceResultPanel", "AreaResultPanel", "CoordinateResultPanel"])(
    "renders one %s, after the plate and inside the fullscreen box",
    (tag) => {
      expect(code.match(new RegExp(`<${tag}\\b`, "g"))).toHaveLength(1);
      const box = code.indexOf("ref={landscapeBoxRef}");
      const plate = code.indexOf("ref={mapContainerRef}", box);
      const panel = code.indexOf(`<${tag}`, plate);
      const caption = code.indexOf("<figcaption>", panel);
      expect(box).toBeGreaterThan(-1);
      expect(plate).toBeGreaterThan(box);
      expect(panel).toBeGreaterThan(plate);
      expect(caption, "the credit stays last in the figure").toBeGreaterThan(panel);
      expect(code.slice(panel, panel + 80)).toContain("{...resultPanelPlacement}");
    },
  );

  it("sits under the plate on a page below lg and over it from lg, at one width, for every tool", () => {
    // From sm to lg the plate is 239–430 px tall; a panel on it left a fit 47 px at 640 px.
    expect(code).toContain(
      'const RESULT_PANEL_CLASS = "mt-2 lg:absolute lg:bottom-13 lg:left-3 lg:z-30 lg:mt-0 lg:w-80";',
    );
    expect(code).toContain("const resultPanelOnMap = landscape.active || lgUp;");
    expect(code).toMatch(/width: RESULT_PANEL_WIDTH,/);
  });

  it("keeps Undo and Clear off the toolbar for every tool", () => {
    expect(code).not.toContain('activeTool !== "distance" &&');
    expect(code).not.toContain("onClick={handleUndo}");
  });

  it("frames named points above the panel and keeps labels off it", () => {
    expect(code).toContain("const fitInsets =");
    expect(code).toContain("const resultPanelObstacle =");
  });

  it("computes the area's hectares and decares once, for the card and the panel", () => {
    expect(code.match(/areaKm2 \* 100\b/g)).toHaveLength(2); // areaHectares + handleCopy
    expect(code.match(/areaKm2 \* 1000\b/g)).toHaveLength(1);
  });
});
```

(`handleCopy`'s `copyArea` text keeps its own `formatNumber(areaKm2 * 100, locale, 0)`; that is
clipboard text, out of scope.)

- [ ] **Step 2: Run the structure test to verify it fails**

Run: `pnpm vitest run components/v2/v2-tool-workbench.structure.test.ts`
Expected: FAIL on the new `it.each` cases for `AreaResultPanel` / `CoordinateResultPanel`, the
placement string, the toolbar and the hectares count.

- [ ] **Step 3: Generalise the placement**

In `components/v2/v2-tool-workbench.tsx`:

1. Under `RESULT_PANEL_GAP` (line ~125) add, and update the preceding JSDoc's first line from
   "Where the distance result panel sits" to "Where the result panel sits (T-120, T-121)":

```ts
/** Below `lg` the panel is in flow under the plate; from `lg` it is on it, above the scale bar. */
const RESULT_PANEL_CLASS = "mt-2 lg:absolute lg:bottom-13 lg:left-3 lg:z-30 lg:mt-0 lg:w-80";
```

2. Update the `LG_UP_QUERY` JSDoc: "from which the page puts the result panel on the map (T-120)".
3. Replace

```ts
// On the page below `lg` the panel is under the plate; from `lg`, and in fullscreen at every
// width, it is on it (T-120).
const resultPanelOnMap = activeTool === "distance" && (landscape.active || lgUp);
```

with

```ts
// On the page below `lg` the panel is under the plate; from `lg`, and in fullscreen at every
// width, it is on it (T-120; every tool since T-121).
const resultPanelOnMap = landscape.active || lgUp;
```

4. In the `resultPanelRef` `ResizeObserver` effect (line ~447), change the dependency list from
   `[]` to `[activeTool]`, so a different panel element is observed if the tool ever changes in
   place.

5. Directly after the `resultPanelObstacle` `useMemo`, add the shared placement:

```ts
// One placement for whichever tool's panel is rendered, so the three cannot drift apart.
// Fullscreen puts the panel on the map at every width, so the inline style has to beat the
// `lg:` classes; see `LANDSCAPE_FILL` for why fullscreen is inline.
const resultPanelPlacement = {
  ref: resultPanelRef,
  className: RESULT_PANEL_CLASS,
  style: landscape.active
    ? ({
        position: "absolute",
        left: RESULT_PANEL_LEFT,
        bottom: resultPanelBottom,
        marginTop: 0,
        zIndex: 30,
        width: RESULT_PANEL_WIDTH,
        maxWidth: `calc(100% - ${RESULT_PANEL_LEFT * 2}px)`,
      } satisfies React.CSSProperties)
    : undefined,
};
```

- [ ] **Step 4: Compute the area figures and the coordinate reading once**

After `perimeterKm` (line ~1017) add:

```ts
// The card and the panel show the same figures from one computation (T-121).
const areaHectares = t("hectaresValue", {
  value: (areaKm2 * 100).toLocaleString(numberLocale, { maximumFractionDigits: 0 }),
});
const areaDecares = t("decaresValue", {
  value: (areaKm2 * 1000).toLocaleString(numberLocale, { maximumFractionDigits: 0 }),
});
```

In the area card (line ~2145–2170) replace the two `t("hectaresValue", {...})` and
`t("decaresValue", {...})` expressions with `areaHectares` and `areaDecares`, keeping the
`isSelfIntersecting ? "—" : …` conditions.

After the `toDms` function (line ~1064) add:

```ts
// The coordinate tool's one point as its panel shows it: decimal per axis in the card's
// `latLon` format, DMS from `toDms`, and the province it falls in (T-121).
const coordinatePoint = activeTool === "coordinates" ? points[0] : undefined;
const coordinateReading: CoordinateReading | null = coordinatePoint
  ? {
      latDecimal: `${formatNumber(coordinatePoint.geo.lat, locale, 6)}° ${cardinals.north}`,
      lonDecimal: `${formatNumber(coordinatePoint.geo.lon, locale, 6)}° ${cardinals.east}`,
      latDms: toDms(coordinatePoint.geo.lat, true),
      lonDms: toDms(coordinatePoint.geo.lon, false),
      province: detectedProvince?.name ?? null,
    }
  : null;
```

Add the imports next to the existing `DistanceResultPanel` import:

```ts
import { AreaResultPanel } from "@/components/v2/area-result-panel";
import {
  CoordinateResultPanel,
  type CoordinateReading,
} from "@/components/v2/coordinate-result-panel";
```

- [ ] **Step 5: Render one panel per tool**

Replace the whole `{activeTool === "distance" && ( <DistanceResultPanel … /> )}` block (line
~1669–1692) with:

```tsx
{
  activeTool === "distance" ? (
    <DistanceResultPanel
      {...resultPanelPlacement}
      pointCount={points.length}
      distanceKm={distanceKm}
      onUndo={handleUndo}
      onClear={handleClear}
    />
  ) : activeTool === "area" ? (
    <AreaResultPanel
      {...resultPanelPlacement}
      pointCount={points.length}
      isSelfIntersecting={isSelfIntersecting}
      area={formatNumber(areaKm2, locale, 1)}
      hectares={areaHectares}
      decares={areaDecares}
      perimeter={formatNumber(perimeterKm, locale, 1)}
      onUndo={handleUndo}
      onClear={handleClear}
    />
  ) : (
    <CoordinateResultPanel
      {...resultPanelPlacement}
      reading={coordinateReading}
      copied={copied}
      onCopy={handleCopy}
      onClear={handleClear}
    />
  );
}
```

- [ ] **Step 6: Remove Undo/Clear from the toolbar**

Delete the whole block that starts with the comment
`{/* Undo / Clear. The distance tool has them on its result panel (T-120); the area` and ends
with its closing `)}` (line ~1300–1323). Remove `Undo2` from the `lucide-react` import (it is no
longer used in this file; `Trash2` stays, the points list uses it).

- [ ] **Step 7: Run the structure test and the full gate**

Run: `pnpm vitest run components/v2/v2-tool-workbench.structure.test.ts`
Expected: PASS.

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green. `page-composition-cards.test.ts` counts unreadable `className` expressions; the
workbench's literal `className="mt-2 lg:…"` became a spread, and each wrapper passes
`className={className}`. If the counter moves, confirm the delta is exactly these elements
(read the test's failure output, which lists files), then update both numbers with one note line
naming T-121 and the reason. `v2-map-credit-placement.test.ts` must stay green untouched.

- [ ] **Step 8: Commit**

```bash
git add components/v2/v2-tool-workbench.tsx components/v2/v2-tool-workbench.structure.test.ts \
  components/v2/page-composition-cards.test.ts
git commit -m "feat(tools): show the area and coordinate results on the map (T-121)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Draw the area label and keep pin labels off it

**Files:**

- Modify: `components/v2/v2-tool-workbench.tsx`
- Modify: `components/v2/v2-tool-workbench.structure.test.ts`

**Interfaces:**

- Consumes: `placeAreaLabel(ring, size, { view, gap, dotRadius, obstacles })` (Task 1);
  workbench locals `areaReading` (`{ kind: "area"; km2 } | { kind: "selfIntersecting" } | … | null`),
  `labelView`, `resultPanelObstacle`, `zoomLevel`, `pxPerUnit`, `locale`, `PIN_RADIUS`,
  `PIN_OUTLINE`, `PIN_LABEL_SIZE`, `PIN_LABEL_HALO`, `legLabels`, `legLabelBox`.
- Produces: nothing consumed later.

- [ ] **Step 1: Add the structure test**

In `components/v2/v2-tool-workbench.structure.test.ts`, after the "labels each leg of a distance
route…" test, add:

```ts
// T-121: the area's km² inside its polygon, one screen size at every zoom; pin labels keep off
// it, and a crossing outline gets no label.
it("writes the area inside the polygon at a constant screen size", () => {
  const code = stripComments(source);
  expect(code).toContain("placeAreaLabel(");
  expect(code).toContain('areaReading?.kind !== "area"');
  const start = code.indexOf("{areaLabel && (");
  expect(start).toBeGreaterThan(-1);
  const label = code.slice(start, code.indexOf("</text>", start));
  expect(label).toContain("fontSize={atScreenSize(AREA_LABEL_SIZE, zoomLevel, pxPerUnit)}");
  expect(label).toContain("strokeWidth={atScreenSize(PIN_LABEL_HALO, zoomLevel, pxPerUnit)}");
  expect(label).toContain("pointer-events-none");
  expect(start, "drawn before the pins").toBeLessThan(code.indexOf("{points.map((p, idx) => {"));
  expect(code).toMatch(/\.\.\.\(areaLabel \? \[legLabelBox\(areaLabel\)\] : \[\]\)/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run components/v2/v2-tool-workbench.structure.test.ts -t "writes the area"`
Expected: FAIL, `placeAreaLabel(` not found.

- [ ] **Step 3: Constants and import**

Add the import next to `placeSegmentLabels`:

```ts
import { placeAreaLabel } from "@/lib/map/area-label";
```

Under `LEG_LABEL_GAP` add:

```ts
/** The area label (T-121): a size up from the pin names, since it names the whole shape, and
 *  its gap from the outline's corner dots when it has to sit outside. CSS px. */
const AREA_LABEL_SIZE = PIN_LABEL_SIZE + 2;
const AREA_LABEL_GAP = 4;
```

Update `legLabelBox`'s JSDoc to: "A centred label's drawn box in map units (a leg label, or the
area label), from its centre, as `placeSegmentLabels` / `placeAreaLabel` modelled it."

- [ ] **Step 4: Place the label**

Directly after the `legLabels` `useMemo` and before `pinLabelSides`, add:

```ts
// The area's km² inside the polygon (T-121), placed before the pin labels, which keep off it.
// No label for a crossing outline: it has no area (T-094). Where nothing is free it is dropped;
// the area is in the panel.
const areaLabel = React.useMemo(() => {
  if (activeTool !== "area" || points.length < 3 || areaReading?.kind !== "area") return null;
  const unit = (px: number) => atScreenSize(px, zoomLevel, pxPerUnit);
  const text = `${formatNumber(areaReading.km2, locale, 1)} km²`;
  const w = unit(text.length * AREA_LABEL_SIZE * 0.6);
  const h = unit(AREA_LABEL_SIZE * 1.4);
  const centre = placeAreaLabel(
    points.map((p) => ({ x: p.svgX, y: p.svgY })),
    { width: w, height: h },
    {
      view: labelView,
      gap: unit(AREA_LABEL_GAP),
      dotRadius: unit(PIN_RADIUS + PIN_OUTLINE),
      obstacles: resultPanelObstacle ? [resultPanelObstacle] : [],
    },
  );
  return centre ? { ...centre, w, h, text } : null;
}, [activeTool, points, areaReading, zoomLevel, pxPerUnit, locale, labelView, resultPanelObstacle]);
```

In `pinLabelSides`, change the obstacles array to:

```ts
        obstacles: [
          ...legLabels.map(legLabelBox),
          ...(areaLabel ? [legLabelBox(areaLabel)] : []),
          ...(resultPanelObstacle ? [resultPanelObstacle] : []),
        ],
```

and add `areaLabel` to its dependency list.

- [ ] **Step 5: Draw it**

In the `<svg>`, right after the `{legLabels.map((label) => ( … ))}` block and before the
`{/* Placed Waypoints Pins */}` comment, add:

```tsx
{
  /* The area inside its polygon (T-121), under the pins so a dot is never covered.
                Inside the <svg>, so the PNG export carries it. */
}
{
  areaLabel && (
    <text
      data-area-label=""
      x={areaLabel.x}
      y={areaLabel.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={atScreenSize(AREA_LABEL_SIZE, zoomLevel, pxPerUnit)}
      fontWeight={700}
      strokeWidth={atScreenSize(PIN_LABEL_HALO, zoomLevel, pxPerUnit)}
      strokeLinejoin="round"
      paintOrder="stroke"
      className="fill-foreground stroke-card font-sans select-none pointer-events-none"
    >
      {areaLabel.text}
    </text>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run components/v2/v2-tool-workbench.structure.test.ts`
Expected: PASS.

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add components/v2/v2-tool-workbench.tsx components/v2/v2-tool-workbench.structure.test.ts
git commit -m "feat(tools): write the area inside the drawn polygon (T-121)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Browser verification, board, PR

**Files:**

- Modify (workspace root, not a git repo): `../TASKS.md`, `../TASKS-DONE.md`
- Fix-ups found in the browser go into the files they concern, each with its own commit.

- [ ] **Step 1: Area tool on the page** (`http://localhost:3000/araclar/alan-hesaplama`,
      Playwright MCP)

At 320, 360, 390 px and 1280×800, light and dark:

- Empty panel: "— km²" and "Alan için haritada köşeleri sırayla koy."; record the panel's
  `offsetHeight`. Click 1, then 2 points: the "{n} köşe daha" hint; height unchanged.
- Close a shape by clicking 3–4 points around central Anatolia: the km² is inside the polygon,
  the panel shows area, "ha · dönüm", "Çevre uzunluğu … km"; height unchanged; the figures match
  the right-column card.
- A small triangle (three clicks close together at 1×): the label sits just outside, near it.
- A crossing shape (4 points in a bow-tie order): warning-coloured hint in the panel, "— km²", no
  label on the map, the top banner still there.
- Undo and Clear on the panel work; pressing on the panel adds no point; pan still works around it.
- No Undo/Clear buttons in the toolbar; PNG export there; the exported PNG shows the area label.

- [ ] **Step 2: Coordinate tool on the page** (`/araclar/koordinat-bulma`), same widths and themes

- Empty: "—" and "Koordinat için haritada bir yere tıkla.", Copy and Clear dimmed; record the
  height. Click Ankara: "Ankara", decimal and DMS per axis, height unchanged; values match the card.
- Click the Black Sea: "Türkiye dışında". Pick "06 - Ankara" from the province dropdown: the panel
  updates and the point is framed above the panel at `lg`+.
- Copy: the button shows ✓ "Kopyalandı!" for ~2 s (read the clipboard with
  `navigator.clipboard.readText()` in `browser_evaluate`; expect the same text as the card's
  "Özeti Kopyala"). Clear empties the panel.

- [ ] **Step 3: Fullscreen, both tools**

Desktop fullscreen, 740×360 landscape phone and 390×844 portrait with a coarse pointer (the
rotate hint): the panel is inside fullscreen at the bottom-left above the scale bar, never over
the scale bar, zoom buttons, ⓘ or the rotate hint; the area label and pin labels keep off it.

- [ ] **Step 4: English at 320 px** (Review Focus 1)

`/en` routes for both tools (look up the EN pathnames in `i18n/routing.ts`): the empty and
few-corner hints may wrap to two lines; the panel's height must equal its height with a result.
If it grows, fix the layout (e.g. the hint's line-height), not the copy.

- [ ] **Step 5: Overflow sweep**

Run:

```bash
pnpm sweep:overflow -- --filter=/araclar/alan-hesaplama
pnpm sweep:overflow -- --filter=/araclar/koordinat-bulma
pnpm sweep:overflow -- --filter=/araclar/mesafe-olcme
```

Expected: all green (the distance page shares the generalised placement).

- [ ] **Step 6: Final gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green. Invoke `superpowers:verification-before-completion` before claiming done.

- [ ] **Step 7: Board**

Move the `### T-121 …` section from `../TASKS.md` to the top of `../TASKS-DONE.md` (Turkish, same
format as the entries already there, with a one-line "Sonuç" naming the PR). In `../TASKS.md`'s
"önerilen sıra" line mark T-121 as done the way T-120 is marked ("T-121 (bitti)").

- [ ] **Step 8: Push and open the PR into `dev`**

```bash
git push -u origin feature/t121-area-coordinate-result-panel
GH_TOKEN=<Sertturk16 token, per memory note gh-pr-account> gh pr create --base dev \
  --title "feat(tools): area and coordinate results on the map (T-121)" \
  --body "<summary of the panel, the area label, the toolbar change, the verification matrix>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Report the PR link.
