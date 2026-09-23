# T-079 Mobile Map Letterbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, `/turkiye` and `/dunya` stop painting an empty "sea" above and below the map, the selection card and toolbar stop covering the map, and the card's stats are never hidden behind its "İncele" button.

**Architecture:** Türkiye (option B): a second, taller context artifact generated from the same Natural Earth snapshot, drawn with `preserveAspectRatio="xMidYMid slice"` so a desktop box still shows exactly today's band while a squarer phone box fills with real land and sea. World (option A+): the box follows the map's own ratio at every width; below `sm` the toolbar sits in a row above the map and the selection card below it. Both explorers render their selection card through one shared `MapSelectionCard` whose stats live in their own grid column, so the actions can never overlap them.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, next-intl 4, vitest (node env, no jsdom), Node generator scripts in `scripts/`.

**Spec:** Approved review page "Mobil Harita Kutusu" (https://claude.ai/artifact/L5YQiMLR9rZgvuhwWVdk8i): Türkiye → B, Dünya → A+, compact mobile card in both. Owner addition: the "İncele" button must not hide any of the card's text.

## Global Constraints

- `TR_CONTEXT_FRAME` / `TR_CONTEXT_VIEWBOX` and `lib/map/tr-context.generated.ts` stay byte-for-byte unchanged: six other surfaces (game screen, tool workbench, region/province locators, marine, earthquake) draw them.
- Generated files are never hand-edited; each is listed in BOTH `.prettierignore` and ESLint `globalIgnores`, and has a CI drift gate.
- Desktop (`sm` and up, box at the 1270:580 ratio) must look exactly as today on `/turkiye`, including neighbour label positions.
- New user-facing strings go to `messages/tr.json` AND `messages/en.json` (`MapExplorer` namespace; both explorers already call `useTranslations("MapExplorer")`).
- A link styled as a button is `<Link className={cn(buttonVariants({ variant, size }))}>`; no `<Button>` inside `<Link>`.
- Visible change: `pnpm sweep:overflow`, and 320 / 360 / 390 / desktop in light and dark via Playwright.

---

## File Structure

| File                                                                                                               | Responsibility                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `scripts/lib/tr-frame.mjs`                                                                                         | + `TR_CONTEXT_TALL_FRAME`, `TR_CONTEXT_TALL_VIEWBOX`; `assertInsideContextFrame` takes an optional `frame` |
| `scripts/generate-tr-context.mjs`                                                                                  | Pipeline wrapped in `buildShapes(rect)`; emits the wide file unchanged plus `tr-context-tall.generated.ts` |
| `lib/map/tr-context-tall.generated.ts` (new, generated)                                                            | `TALL_CONTEXT_SHAPES`, `TR_CONTEXT_TALL_VIEWBOX`                                                           |
| `lib/map/tr-context.contract.test.ts`                                                                              | Tall-artifact contract                                                                                     |
| `package.json`, `.prettierignore`, `eslint.config.mjs`, `CLAUDE.md`, `docs/conventions.md`, `docs/architecture.md` | Register the sixth generated file                                                                          |
| `components/v2/v2-map-payload.test.ts`                                                                             | Expected generated-array set gains `TALL_CONTEXT_SHAPES`                                                   |
| `components/v2/map-selection-card.tsx` (new) + `.test.tsx`                                                         | Shared selection card; stats and actions in separate grid columns                                          |
| `components/v2/v2-turkey-map-explorer.tsx`                                                                         | Tall artifact + slice; labels for new countries; card via `MapSelectionCard`                               |
| `components/v2/v2-world-map-explorer.tsx`                                                                          | Ratio-true box; toolbar row / card below the map under `sm`; card via `MapSelectionCard`                   |
| `components/v2/v2-map-letterbox.test.ts` (new)                                                                     | Source pins for both explorers                                                                             |
| `messages/tr.json`, `messages/en.json`                                                                             | `MapExplorer.explore`, `MapExplorer.closeSelection`                                                        |

---

### Task 1: Tall context artifact

**Files:**

- Modify: `scripts/lib/tr-frame.mjs` (after `TR_CONTEXT_VIEWBOX`, and `assertInsideContextFrame`)
- Modify: `scripts/generate-tr-context.mjs` (Pass 1–3 → `buildShapes(rect)`, second emit)
- Create (generated): `lib/map/tr-context-tall.generated.ts`
- Modify: `lib/map/tr-context.contract.test.ts`, `components/v2/v2-map-payload.test.ts`
- Modify: `package.json` (`generate:tr-context:check`), `.prettierignore`, `eslint.config.mjs`, `CLAUDE.md` (generated-file line), `docs/conventions.md` (generated table), `docs/architecture.md:113`

**Interfaces:**

- Produces: `TR_CONTEXT_TALL_FRAME = { minX: -150, minY: -405, width: 1270, height: 1270 }`, `TR_CONTEXT_TALL_VIEWBOX = "-150 -405 1270 1270"` (both in `tr-frame.mjs` and re-exported by the generated file); `TALL_CONTEXT_SHAPES: readonly ContextShape[]` (type from `./tr-context.generated`).

- [ ] **Step 1: Write the failing contract tests** — in `lib/map/tr-context.contract.test.ts`, lift the inline `d` parser out of "keeps every shape inside the pinned TR_CONTEXT_FRAME" into a module-level `function pathPoints(d: string): [number, number][]` (same body, returns `points`), use it there, then add:

```ts
import { TALL_CONTEXT_SHAPES, TR_CONTEXT_TALL_VIEWBOX } from "./tr-context-tall.generated";
import { TR_CONTEXT_FRAME, TR_CONTEXT_TALL_FRAME } from "../../scripts/lib/tr-frame.mjs";

describe("lib/map/tr-context-tall.generated.ts artifact (T-079)", () => {
  it("keeps the wide frame's width and centre, so `slice` at 1270:580 reproduces the wide view", () => {
    expect(TR_CONTEXT_TALL_FRAME.minX).toBe(TR_CONTEXT_FRAME.minX);
    expect(TR_CONTEXT_TALL_FRAME.width).toBe(TR_CONTEXT_FRAME.width);
    expect(TR_CONTEXT_TALL_FRAME.minY + TR_CONTEXT_TALL_FRAME.height / 2).toBe(
      TR_CONTEXT_FRAME.minY + TR_CONTEXT_FRAME.height / 2,
    );
    expect(TR_CONTEXT_TALL_FRAME.height).toBeGreaterThanOrEqual(TR_CONTEXT_TALL_FRAME.width);
    const { minX, minY, width, height } = TR_CONTEXT_TALL_FRAME;
    expect(TR_CONTEXT_TALL_VIEWBOX).toBe(`${minX} ${minY} ${width} ${height}`);
  });

  it("carries every wide-frame country with the wide artifact's label placement", () => {
    const tall = new Map(TALL_CONTEXT_SHAPES.map((s) => [s.iso, s]));
    for (const wide of CONTEXT_SHAPES) {
      const shape = tall.get(wide.iso);
      expect(shape, `${wide.iso} missing from the tall artifact`).toBeDefined();
      expect(shape?.labelPoint, wide.iso).toEqual(wide.labelPoint);
      expect(shape?.labelRadius, wide.iso).toBe(wide.labelRadius);
    }
  });

  it("keeps every shape inside the pinned TR_CONTEXT_TALL_FRAME", () => {
    for (const shape of TALL_CONTEXT_SHAPES) {
      expect(() =>
        assertInsideContextFrame(pathPoints(shape.d), {
          label: shape.iso,
          tolerance: 0.5,
          frame: TR_CONTEXT_TALL_FRAME,
        }),
      ).not.toThrow();
    }
  });
});
```

In `components/v2/v2-map-payload.test.ts` change the expected set to `["CONTEXT_SHAPES", "COUNTRY_SHAPES", "INLAND_WATER_SHAPES", "PROVINCE_SHAPES", "TALL_CONTEXT_SHAPES"]` and "four committed artifacts" → "five" in its comment.

- [ ] **Step 2: Run to see red**

Run: `pnpm exec vitest run lib/map/tr-context.contract.test.ts components/v2/v2-map-payload.test.ts`
Expected: FAIL — cannot resolve `./tr-context-tall.generated`, and the payload set lacks `TALL_CONTEXT_SHAPES`.

- [ ] **Step 3: Frame constants** — in `scripts/lib/tr-frame.mjs`, after `TR_CONTEXT_VIEWBOX`:

```js
/**
 * T-079: the context frame extended north and south, for a map box squarer than 1270:580 (a
 * phone). Same `minX`/`width` and the same vertical centre as `TR_CONTEXT_FRAME`, so drawing it
 * with `preserveAspectRatio="xMidYMid slice"` in a 1270:580 box shows exactly the wide frame,
 * while a square box shows Ukraine and Crimea north of the Black Sea and Egypt, Jordan and Saudi
 * Arabia south of the Mediterranean instead of a flat cut edge. Height = width: the squarest box
 * the explorer renders (301×300 at 390px) then needs no horizontal crop.
 */
export const TR_CONTEXT_TALL_FRAME = Object.freeze({
  minX: TR_CONTEXT_FRAME.minX,
  minY: -405,
  width: TR_CONTEXT_FRAME.width,
  height: 1270,
});

export const TR_CONTEXT_TALL_VIEWBOX = `${TR_CONTEXT_TALL_FRAME.minX} ${TR_CONTEXT_TALL_FRAME.minY} ${TR_CONTEXT_TALL_FRAME.width} ${TR_CONTEXT_TALL_FRAME.height}`;
```

Change `assertInsideContextFrame(points, { label, tolerance = 0 })` to `assertInsideContextFrame(points, { label, tolerance = 0, frame = TR_CONTEXT_FRAME })` and read `minX/minY/maxX/maxY` from `frame`. Add `@param` for `frame`. The error text stays.

- [ ] **Step 4: Generator** — in `scripts/generate-tr-context.mjs`:
  1. Import `TR_CONTEXT_TALL_FRAME, TR_CONTEXT_TALL_VIEWBOX`; add `const OUT_TALL = join(ROOT, "lib", "map", "tr-context-tall.generated.ts");`.
  2. Replace the `CONTEXT_RECT` constant with `function rectOf(frame) { return { minX: frame.minX, minY: frame.minY, maxX: frame.minX + frame.width, maxY: frame.minY + frame.height }; }`.
  3. Wrap "Pass 1" through the end of "Pass 3" (everything from `const plans = [];` to the `shapes.push(...)` loop's end) in `function buildShapes(rect) { ... return { shapes, allProjectedPoints, rawRingCount, survivingRingCount, topologyStats: topology.stats }; }`, with `clipRingToRect(..., rect)` in both clip calls. The `geojson` load stays outside and is read by closure. No other line inside changes.
  4. Then:

```js
const wide = buildShapes(rectOf(TR_CONTEXT_FRAME));
assertInsideContextFrame(wide.allProjectedPoints, { label: "generate:tr-context", tolerance: 0.5 });
const shapes = wide.shapes.sort((a, b) => a.iso.localeCompare(b.iso, "en"));

const tallBuild = buildShapes(rectOf(TR_CONTEXT_TALL_FRAME));
assertInsideContextFrame(tallBuild.allProjectedPoints, {
  label: "generate:tr-context (tall)",
  tolerance: 0.5,
  frame: TR_CONTEXT_TALL_FRAME,
});
// A country the wide frame also shows keeps the wide artifact's label, so the explorer's
// desktop view (tall frame, `slice`, 1270:580 box) draws today's labels exactly. Measured:
// without this BG, IQ, RU, SY, LB and RS move, because more of each country survives the clip.
const wideByIso = new Map(shapes.map((s) => [s.iso, s]));
const tallShapes = tallBuild.shapes
  .map((s) => {
    const w = wideByIso.get(s.iso);
    return w ? { ...s, labelPoint: w.labelPoint, labelRadius: w.labelRadius } : s;
  })
  .sort((a, b) => a.iso.localeCompare(b.iso, "en"));
```

The existing `body`/`out` emit for the wide file is unchanged (it reads `shapes`). Add a second emit with the same row format:

```js
const tallBody = tallShapes
  .map(
    (s) =>
      `  { iso: ${JSON.stringify(s.iso)}, geoName: ${JSON.stringify(s.geoName)}, d: ${JSON.stringify(
        s.d,
      )}, labelPoint: { x: ${s.labelPoint.x}, y: ${s.labelPoint.y} }, labelRadius: ${s.labelRadius} },`,
  )
  .join("\n");

const outTall = `// AUTO-GENERATED by scripts/generate-tr-context.mjs — DO NOT EDIT BY HAND.
// Regenerate with: pnpm generate:tr-context
//
// The same Natural Earth context as tr-context.generated.ts, clipped to TR_CONTEXT_TALL_FRAME
// (scripts/lib/tr-frame.mjs): the wide frame's width and centre, extended north and south so a
// map box squarer than 1270:580 fills with real land and sea instead of a flat cut edge (T-079).
// A country the wide artifact also carries keeps ITS labelPoint/labelRadius, so a consumer that
// draws this with preserveAspectRatio="xMidYMid slice" in a 1270:580 box renders today's labels.
// Only v2-turkey-map-explorer draws it; every other context surface keeps the wide artifact.

import type { ContextShape } from "./tr-context.generated";

export const TR_CONTEXT_TALL_VIEWBOX = "${TR_CONTEXT_TALL_VIEWBOX}" as const;

export const TALL_CONTEXT_SHAPES: readonly ContextShape[] = [
${tallBody}
];
`;
writeFileSync(OUT_TALL, outTall, "utf8");
```

Extend the final log line with `\n  ${tallShapes.length} tall shapes · viewBox ${TR_CONTEXT_TALL_VIEWBOX}`.

- [ ] **Step 5: Generate and prove the wide file did not move**

Run: `pnpm generate:tr-context && git diff --stat -- lib/map/tr-context.generated.ts`
Expected: log shows `27 tall shapes · viewBox -150 -405 1270 1270`; `git diff` prints nothing for the wide file.

- [ ] **Step 6: Register the sixth generated file**
  - `package.json`: `"generate:tr-context:check": "pnpm run generate:tr-context && git diff --exit-code -- lib/map/tr-context.generated.ts lib/map/tr-context-tall.generated.ts"` (CI and deploy already run this script by name).
  - `.prettierignore`: add `lib/map/tr-context-tall.generated.ts` under the `tr-context` line.
  - `eslint.config.mjs` `globalIgnores`: add `"lib/map/tr-context-tall.generated.ts",` after `tr-context.generated.ts`.
  - `CLAUDE.md`: "Five committed generated files" → "Six", and the brace list → `{tr-provinces,world-countries,tr-inland-water,tr-context,tr-context-tall}`.
  - `docs/conventions.md` generated table: add `| \`lib/map/tr-context-tall.generated.ts\` | \`pnpm generate:tr-context\` | \`generate:tr-context:check\` |`.
  - `docs/architecture.md:113`: "the four `lib/map/*.generated.ts` artifacts" → "the five".

- [ ] **Step 7: Green**

Run: `pnpm exec vitest run lib/map components/v2/v2-map-payload.test.ts && pnpm generate:tr-context:check && pnpm lint`
Expected: PASS; check exits 0.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/tr-frame.mjs scripts/generate-tr-context.mjs lib/map/tr-context-tall.generated.ts lib/map/tr-context.contract.test.ts components/v2/v2-map-payload.test.ts package.json .prettierignore eslint.config.mjs CLAUDE.md docs/conventions.md docs/architecture.md
git commit -m "feat(map): generate a tall Türkiye context artifact for squarer map boxes"
```

---

### Task 2: Shared `MapSelectionCard`

**Files:**

- Create: `components/v2/map-selection-card.tsx`, `components/v2/map-selection-card.test.tsx`
- Modify: `messages/tr.json`, `messages/en.json` (`MapExplorer`)

**Interfaces:**

- Produces: `MapSelectionCard(props: { leading?: React.ReactNode; title: string; badges?: React.ReactNode; stats: readonly string[]; href: React.ComponentProps<typeof Link>["href"]; exploreLabel: string; closeLabel: string; onClose: () => void; className?: string })`. Message keys `MapExplorer.explore` (tr "İncele", en "Explore"), `MapExplorer.closeSelection` (tr "Seçimi kapat", en "Close selection").

- [ ] **Step 1: Failing test** — `components/v2/map-selection-card.test.tsx` (node env; `renderToStaticMarkup`; mock `@/i18n/navigation`'s `Link` the way other `*.test.tsx` in `components/` do — copy that mock verbatim from an existing test that renders a `Link`):

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MapSelectionCard } from "./map-selection-card";

const html = renderToStaticMarkup(
  <MapSelectionCard
    leading={<span data-testid="lead">06</span>}
    title="Ankara"
    stats={["5.910.320 kişi", "25.632 km²"]}
    href="/turkiye/ankara"
    exploreLabel="İncele"
    closeLabel="Seçimi kapat"
    onClose={() => {}}
  />,
);

describe("MapSelectionCard", () => {
  it("puts the stats in their own grid cell, never under the actions", () => {
    expect(html).toMatch(/grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
    expect(html).toMatch(/<p class="[^"]*col-start-2[^"]*"[^>]*>.*5\.910\.320 kişi.*25\.632 km²/);
    expect(html).not.toMatch(/truncate|whitespace-nowrap/);
  });
  it("renders the explore action as a styled link, not a button inside a link", () => {
    expect(html).not.toMatch(/<a[^>]*>[^]*?<button/);
    expect(html).toMatch(/<a[^>]*href="\/turkiye\/ankara"/);
    expect(html).toMatch(/sr-only sm:not-sr-only[^"]*">İncele</);
  });
  it("names the close button", () => {
    expect(html).toMatch(/<button[^>]*aria-label="Seçimi kapat"/);
  });
});
```

- [ ] **Step 2: Red** — `pnpm exec vitest run components/v2/map-selection-card.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement** — `components/v2/map-selection-card.tsx`:

```tsx
"use client";

import * as React from "react";
import { ArrowRight, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The card a map shows for its selected province or country (T-079). Three grid columns —
 * leading mark, text, actions — so the actions can never sit on top of the stats: at 390px the
 * old flex row let the "İncele" button cover the area figure. Below `sm` the action is an icon
 * with the label kept for assistive tech. Placement is the caller's (`className`): an overlay
 * inside `/turkiye`'s box, a block under `/dunya`'s map on phones.
 */
export function MapSelectionCard({
  leading,
  title,
  badges,
  stats,
  href,
  exploreLabel,
  closeLabel,
  onClose,
  className,
}: {
  leading?: React.ReactNode;
  title: string;
  badges?: React.ReactNode;
  stats: readonly string[];
  href: React.ComponentProps<typeof Link>["href"];
  exploreLabel: string;
  closeLabel: string;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border border-primary/40 bg-card/95 p-2.5 shadow-xl backdrop-blur-md animate-in fade-in-50 duration-200 sm:p-3",
        className,
      )}
    >
      <div className="row-span-2">{leading}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-heading text-sm font-bold text-foreground">{title}</span>
        {badges}
      </div>
      <div className="row-span-2 flex items-center gap-1">
        <Link
          href={href}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "h-8 px-2 sm:px-2.5")}
        >
          <span className="sr-only sm:not-sr-only">{exploreLabel}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="col-start-2 flex flex-wrap gap-x-1.5 font-mono text-[11px] text-muted-foreground">
        {stats.map((s, i) => (
          <span key={s}>{i > 0 ? `· ${s}` : s}</span>
        ))}
      </p>
    </div>
  );
}
```

Add to `MapExplorer` in `messages/tr.json`: `"explore": "İncele", "closeSelection": "Seçimi kapat"`; in `messages/en.json`: `"explore": "Explore", "closeSelection": "Close selection"`.

- [ ] **Step 4: Green** — `pnpm exec vitest run components/v2/map-selection-card.test.tsx` → PASS; then `pnpm test` to confirm the message-catalogue parity tests accept the two new keys.

- [ ] **Step 5: Commit** — `git add components/v2/map-selection-card.tsx components/v2/map-selection-card.test.tsx messages/tr.json messages/en.json && git commit -m "feat(map): shared selection card whose actions never cover its stats"`

---

### Task 3: `/turkiye` draws the tall artifact and the shared card

**Files:**

- Modify: `components/v2/v2-turkey-map-explorer.tsx` (import line 7; `COUNTRY_NAMES_TR` ~113; card ~612–665; `<svg viewBox>` ~676; the three `CONTEXT_SHAPES` uses at ~213, ~685, ~774)
- Create: `components/v2/v2-map-letterbox.test.ts`

**Interfaces:**

- Consumes: `TALL_CONTEXT_SHAPES`, `TR_CONTEXT_TALL_VIEWBOX` (Task 1); `MapSelectionCard`, `MapExplorer.explore|closeSelection` (Task 2).

- [ ] **Step 1: Failing source pins** — `components/v2/v2-map-letterbox.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

const read = (f: string) => stripComments(readFileSync(join(__dirname, f), "utf8"));
const turkey = read("v2-turkey-map-explorer.tsx");

describe("/turkiye fills a squarer box with real geography (T-079)", () => {
  it("draws the tall context artifact, not the wide one", () => {
    expect(turkey).toContain('from "@/lib/map/tr-context-tall.generated"');
    expect(turkey).not.toContain('from "@/lib/map/tr-context.generated"');
    expect(turkey).toMatch(/viewBox=\{TR_CONTEXT_TALL_VIEWBOX\}/);
    expect(turkey).toMatch(/preserveAspectRatio="xMidYMid slice"/);
  });
  it("labels a country new to the tall frame only when it can hold a label", () => {
    expect(turkey).toMatch(/NEW_CONTEXT_LABEL_MIN_RADIUS = 30\b/);
    for (const name of [
      "Ukrayna",
      "Romanya",
      "Moldova",
      "Mısır",
      "Libya",
      "Ürdün",
      "Suudi Arabistan",
    ]) {
      expect(turkey).toContain(`"${name}"`);
    }
  });
  it("renders its selection card through MapSelectionCard", () => {
    expect(turkey).toContain("<MapSelectionCard");
    expect(turkey).not.toMatch(/<Link[^>]*>\s*<Button/);
  });
});
```

- [ ] **Step 2: Red** — `pnpm exec vitest run components/v2/v2-map-letterbox.test.ts` → FAIL on all three.

- [ ] **Step 3: Implement**
  1. Line 7 → `import { TALL_CONTEXT_SHAPES, TR_CONTEXT_TALL_VIEWBOX } from "@/lib/map/tr-context-tall.generated";` and rename every `CONTEXT_SHAPES` use in the file to `TALL_CONTEXT_SHAPES` (casing lookup, shapes loop, labels loop).
  2. `<svg viewBox={TR_CONTEXT_VIEWBOX}` → `viewBox={TR_CONTEXT_TALL_VIEWBOX}` plus `preserveAspectRatio="xMidYMid slice"`, with a comment: the box is 1270:580 on desktop, where `slice` shows exactly the wide frame; on a phone the box is ~1:1 and the extra frame height is real land and sea, so `clampPanOffset`'s container-sized bounds now match drawn content (before, a zoomed phone could pan into the letterbox).
  3. `COUNTRY_NAMES_TR` gains `UA: "Ukrayna", RO: "Romanya", MD: "Moldova", EG: "Mısır", LY: "Libya", JO: "Ürdün", SA: "Suudi Arabistan"`.
  4. Above the component:

```ts
/** A country the wide context frame never showed is labelled only if its pole of
 *  inaccessibility can hold the label: measured radii put UA/RO/MD/EG/LY/JO/SA at 37–173 and
 *  IL/PS/KW/HU/KZ at 5–25, the latter clipped slivers or too small at this scale. */
const NEW_CONTEXT_LABEL_MIN_RADIUS = 30;
const WIDE_FRAME_ISOS = new Set([
  "AM",
  "AZ",
  "BG",
  "CY",
  "GE",
  "GR",
  "IQ",
  "IR",
  "LB",
  "MK",
  "QN",
  "RS",
  "RU",
  "SY",
  "TR",
]);
```

     and the labels filter becomes `(c) => c.iso !== "TR" && !["MK", "RS", "LB", "QN", "CY"].includes(c.iso) && (WIDE_FRAME_ISOS.has(c.iso) || (c.labelRadius >= NEW_CONTEXT_LABEL_MIN_RADIUS && c.iso in COUNTRY_NAMES_TR))`. Verify `WIDE_FRAME_ISOS` equals the wide artifact's iso list before committing: `node -e` over `lib/map/tr-context.generated.ts` (`grep -o 'iso: "[A-Z]*"'`).

5. Replace the card block (`{selectedPlate && activeProvince && (<div … absolute bottom-3 left-3 …>…</div>)}`) with:

```tsx
{
  selectedPlate && activeProvince && (
    <MapSelectionCard
      className="absolute inset-x-2 bottom-2 z-30 sm:inset-x-auto sm:bottom-3 sm:left-3 sm:max-w-sm"
      leading={
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 font-mono text-sm font-bold text-primary">
          {activeProvince.plateCode}
        </div>
      }
      title={activeProvince.name}
      badges={
        <Badge variant="outline" size="sm" className="px-1 py-0 font-mono text-[9px]">
          {activeRegionMeta?.name.split(" ")[0]}
        </Badge>
      }
      stats={[
        activeProvince.population
          ? `${activeProvince.population.toLocaleString("tr-TR")} kişi`
          : null,
        activeProvince.areaKm2 ? `${activeProvince.areaKm2.toLocaleString("tr-TR")} km²` : null,
      ].filter((s): s is string => s !== null)}
      href={activeProvince.path as unknown as React.ComponentProps<typeof Link>["href"]}
      exploreLabel={t("explore")}
      closeLabel={t("closeSelection")}
      onClose={() => setSelectedPlate(null)}
    />
  );
}
```

     Remove imports that became unused (`Button`, `ArrowRight`, `X` if no other use — let `pnpm lint` tell you).

- [ ] **Step 4: Green** — `pnpm exec vitest run components/v2 lib/map && pnpm typecheck && pnpm lint` → PASS. `page-composition-cards.test.ts` counts card class strings; if its recorded number moves, update it to the new count and say why in the commit body (the card's class string moved to `map-selection-card.tsx`).

- [ ] **Step 5: Commit** — `git commit -m "feat(turkiye): fill a phone-sized map box with real geography"` (stage the explorer and the new test).

---

### Task 4: `/dunya` box follows the map's ratio; toolbar above and card below on phones

**Files:**

- Modify: `components/v2/v2-world-map-explorer.tsx` (container ~533, toolbar ~543, card ~575–633)
- Modify: `components/v2/v2-map-letterbox.test.ts`

**Interfaces:**

- Consumes: `MapSelectionCard`, `MapExplorer.explore|closeSelection`.

- [ ] **Step 1: Failing pins** — append to `v2-map-letterbox.test.ts`:

```ts
const world = read("v2-world-map-explorer.tsx");

describe("/dunya's box follows the map's own ratio (T-079)", () => {
  it("sets no minimum height that would letterbox the map", () => {
    expect(world).toMatch(/aspect-\[1008\/520\]/);
    expect(world).not.toMatch(/min-h-\[(320|460)px\]/);
  });
  it("keeps toolbar and card off the map below sm, and over it from sm", () => {
    expect(world).toMatch(
      /data-map-toolbar[^>]*className="[^"]*sm:absolute[^"]*sm:top-3[^"]*sm:right-3/,
    );
    expect(world).toMatch(
      /<MapSelectionCard[\s\S]*?className="[^"]*mt-2[^"]*sm:absolute[^"]*sm:bottom-3[^"]*sm:left-3/,
    );
  });
});
```

- [ ] **Step 2: Red** — run the file → the two new cases FAIL.

- [ ] **Step 3: Implement**
  1. Wrap the map box in `<div className="relative">` (the new positioning context). Inside it, in this order: the toolbar, the map box, the card.
  2. Toolbar: move the existing `absolute top-3 right-3 z-30 …` element out of the map box to be the wrapper's first child; add `data-map-toolbar`, and change its position classes to `mb-2 ml-auto w-fit sm:absolute sm:top-3 sm:right-3 sm:z-30 sm:mb-0`, keeping every other class and its `stopPropagation` handlers.
  3. Map box: `aspect-[1008/520] min-h-[320px] sm:min-h-[460px]` → `aspect-[1008/520]`; add a comment that any minimum height re-creates the letterbox (the world has nothing beyond its poles to fill it with).
  4. Card: replace the `{selectedIso && activeCountry && (<div …>…</div>)}` block, moved to after the map box inside the wrapper, with:

```tsx
{
  selectedIso && activeCountry && (
    <MapSelectionCard
      className="mt-2 sm:absolute sm:bottom-3 sm:left-3 sm:z-30 sm:mt-0 sm:max-w-sm"
      leading={
        activeCountry.hasFlag ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/flags/${activeCountry.isoCode.toUpperCase()}.svg`}
            alt={`${activeCountry.nameTr} bayrağı`}
            className="h-7 w-10 rounded-xs border border-border object-cover shadow-2xs"
          />
        ) : undefined
      }
      title={isEn ? activeCountry.nameEn : activeCountry.nameTr}
      badges={
        <>
          <Badge variant="outline" size="sm" className="px-1 py-0 font-mono text-[9px]">
            {activeCountry.isoCode}
          </Badge>
          {activeCountry.isSpecialStatus && <SpecialStatusBadge isEn={isEn} />}
        </>
      }
      stats={[
        activeCountry.population
          ? `${activeCountry.population.toLocaleString(isEn ? "en-US" : "tr-TR")} kişi`
          : null,
        activeCountry.areaKm2
          ? `${activeCountry.areaKm2.toLocaleString(isEn ? "en-US" : "tr-TR")} km²`
          : null,
      ].filter((s): s is string => s !== null)}
      href={activeCountry.path as unknown as React.ComponentProps<typeof Link>["href"]}
      exploreLabel={t("explore")}
      closeLabel={t("closeSelection")}
      onClose={() => setSelectedIso(null)}
    />
  );
}
```

     (The EN "kişi" is pre-existing; leave it and list it in the PR as out of scope.)

5. Drop now-unused imports (`Button`, `ArrowRight`, `X`) if lint flags them.

- [ ] **Step 4: Green** — `pnpm typecheck && pnpm lint && pnpm test` → PASS (full suite: the card move can shift composition counters; update any recorded count with the reason).

- [ ] **Step 5: Commit** — `git commit -m "fix(dunya): size the map box to the map and keep controls off it on phones"`

---

### Task 5: Browser verification, sweep, build, board

- [ ] **Step 1: Measure in the running dev container (`:3000` serves this tree)** — for `/turkiye` and `/dunya` at 320, 360, 390 (light and dark) and 1440 (light): box size; empty-area % idle and after 2× zoom + drag to the corner (the review page's `measure()` method: viewBox corners through `getScreenCTM()` against the box rect); tap Ankara / Brazil and record (a) card overlap with Türkiye's province bbox (must be 0 at 320–390 on `/turkiye`), (b) for the card's stats `<p>`: `scrollWidth <= clientWidth` and its right edge `<=` the explore link's left edge (the owner's "İncele covers the text" check), (c) nothing overflows the page. At 1440 compare `/turkiye` neighbour-label positions and the visible frame against `dev` (screenshot pair): they must match.
      Expected: empty area ≤ 3% everywhere on phones; card overlap 0; stats never covered.
- [ ] **Step 2:** `pnpm sweep:overflow -- --filter=/turkiye` and `-- --filter=/dunya` → 0 overflow.
- [ ] **Step 3:** `docker stop cografya-web-dev && pnpm build; docker start cografya-web-dev` → exit 0, prerender floor holds.
- [ ] **Step 4:** Screenshots for the PR: 390 light/dark for both pages, card open.
- [ ] **Step 5:** Open the PR to `dev`; move T-079 to DONE in `TASKS.md` with the measured numbers after merge.
