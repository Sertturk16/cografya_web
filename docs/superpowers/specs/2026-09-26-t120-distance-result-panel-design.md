# Distance tool: result panel and segment labels on the map — design (T-120)

Status: approved by the owner 2026-09-26, ready for implementation planning.

Scope: `cografya_web` only, `/araclar/mesafe-olcme` (`components/v2/v2-tool-workbench.tsx` in
`mode="distance"`). T-121 reuses the panel for the area and coordinate tools; that wiring is not
part of this task.

## 1. Goal

A person measuring a distance sees the result (total, flight time, road estimate) without
looking away from the map, on the page and in fullscreen, at every width. Undo and Clear sit
next to that result. Each leg of the route carries its own distance on the map.

Today (measured on `dev` @ `beddf74`):

- Undo, Clear and PNG export sit in the toolbar above the map; the result card is in the right
  column below it. At 390 px the card starts ~750 px under the map.
- In fullscreen only the map, zoom and the scale bar are visible. The toolbar and result card
  are outside the fullscreen target (`landscapeBoxRef`, the `<figure>`).
- Flight minutes (`distanceKm / 800 * 60`) and road km (`distanceKm * 1.28`) are computed inline
  in the result card's JSX.

## 2. Result panel

### 2.1 Component

`components/v2/map-result-panel.tsx`, a generic presentational component next to
`MapSelectionCard` (not in `components/patterns/`, so no `/design-system` specimen):

- Props: `children` (the tool's result content), `actions` (the tool's buttons), `className`,
  and a ref to the root (the workbench measures its height, §3.3).
- The same surface as `MapSelectionCard`: `bg-card/95`, `border`, `rounded-2xl`, `shadow`,
  `backdrop-blur-md`.
- Stops `pointerdown`/`mousedown` propagation like `MapSelectionCard`, so a press on it never
  starts a pan. It is a DOM sibling of the `<svg>`, so a click on it never reaches
  `handleMapClick` and never adds a point.
- The panel knows nothing about distance. T-121 passes area/coordinate content and a Copy
  action through the same props.

### 2.2 Distance content

| State      | Content                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| 0 points   | "Ölçmek için haritada bir yere tıkla." Undo and Clear shown, disabled.               |
| 1 point    | "Mesafe için bir nokta daha ekle." Undo and Clear enabled. No "0 km" anywhere.       |
| ≥ 2 points | Total straight-line km (large), then ✈ flight time and 🚗 road estimate on one line. |

- The total uses the same `formatNumber(distanceKm, locale, 1)` as the result card.
- The flight and road figures render exactly as the card does: `flightMinutes` for the
  minutes, and `~` + `formatNumber(roadKm, locale, 0)` + ` km` for the road estimate. The icons are `aria-hidden`; each figure carries a visually hidden
  label from the existing `flightTime` / `roadEstimate` keys.
- The panel is `aria-live="polite"` on its result region only, so a screen reader hears the
  new total after each point without the buttons being re-announced.
- New message keys (TR approved by the owner 2026-09-26, EN alongside):
  - `resultPanelEmptyDistance`: "Ölçmek için haritada bir yere tıkla." / "Click the map to
    start measuring."
  - `resultPanelOnePointDistance`: "Mesafe için bir nokta daha ekle." / "Add one more point to
    get a distance."
  - A label for the panel region (e.g. "Ölçüm sonucu" / "Measurement result").

### 2.3 One calculation

A pure helper in `lib/map/measure.ts`, `distanceTravelEstimates(distanceKm)` →
`{ flightMinutes, roadKm }`, holding the 800 km/h and ×1.28 constants. The result card and the
panel both call it; the inline arithmetic in the card is removed. Tested in `measure.test.ts`.

### 2.4 Buttons

- Undo (`Undo2`) and Clear (`Trash2`), existing `undo`/`clear` keys and existing handlers.
- Below `sm` icon-only buttons at least 32×32 px with the label as `sr-only`
  (`docs/design.md` floor is 24×24); from `sm` icon plus text. The same pattern
  `MapSelectionCard` uses for its explore action.
- In `mode="distance"` Undo and Clear leave the toolbar above the map. Area and coordinate
  modes keep them there until T-121. PNG export stays in the toolbar for every mode.
- The points list card keeps its own "Tümünü Temizle".

### 2.5 Constant height

At a given width the panel has the same height in all three states (the hint text sits in the
space the figures take). Adding the first or second point never moves the map or the page
(the T-126 rule), and the fit/label insets (§3.3) do not jump between states.

## 3. Placement

### 3.1 Structure

```
<figure ref={landscapeBoxRef}>           fullscreen target, `relative`
  <div class="relative">                 new wrapper: plate + panel
    <div ref={mapContainerRef}>…plate, <svg>, zoom, scale bar…</div>
    <MapResultPanel … />
  </div>
  <figcaption><MapAttribution … /></figcaption>   stays last (v2-map-credit-placement.test.ts)
</figure>
```

One panel is rendered in every layout, so the buttons never exist twice. It is inside the
fullscreen target. In fullscreen the wrapper flexes like the plate does today
(`LANDSCAPE_FILL` / `LANDSCAPE_PLATE`, inline styles for the reason the file already states).

### 3.2 Where the panel sits

| Layout                | Position                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| Page, below `sm`      | In flow under the plate (`mt-2`), full width, above the credit.                   |
| Page, `sm` and up     | `absolute`, bottom-left, directly above the scale bar (bottom 52 px, left 12 px). |
| Fullscreen, any width | `absolute`, bottom-left above the scale bar, as on `sm`.                          |

- Page below `sm`: the square plate is 279 px at 360 px; a ~70 px panel inside it would cover a
  quarter of the map. Under it, map plus panel (~350 px) fit one screen. The same choice
  `/turkiye` and `/dunya` made for `MapSelectionCard` (T-079).
- `sm` and up: the left edge carries map information (scale bar, result), the right edge the
  controls (zoom, fullscreen credit ⓘ).
- Fullscreen, including portrait phones. This departs from the earlier board note ("below the
  map on a portrait phone"): in fullscreen the ⓘ credit is `absolute` in the `<figure>`'s
  bottom-right corner, so a panel below the plate would sit under the ⓘ. A portrait fullscreen
  plate is tall and mostly sea above and below Türkiye, so the overlay covers no measured
  ground that the page layout would not.
- Rotate hint: while `landscape.showRotateHint` is up (portrait fullscreen on a touch device,
  bottom-centre, two lines at 320–390 px), the panel lifts to sit above it, using the hint's
  measured height. They never overlap.
- The fullscreen credit starts open for up to 5 s (T-117) and may cover the panel's lower edge
  at phone widths until it collapses on the first interaction. Accepted: the credit must be
  visible on entry, and it is transient.
- Panel width: `sm` and up it sizes to its content, capped at `max-w-sm` (24 rem; the longest
  content, "1.430,2 km" plus two labelled buttons, is ~300 px). Fullscreen below `sm`: the full
  width minus the 12 px side gutters.

### 3.3 The panel as a map obstacle

When the panel is over the plate (`sm` and up, or fullscreen) the workbench measures its
height with a `ResizeObserver` and:

- **Fit (`fitPointsView`)**: the bottom inset becomes `52 + panelHeight + 8`. Presets, dropdown
  picks and restored measurements are framed above the panel.
- **Labels**: the panel's rectangle, converted to map units, is an obstacle for both label
  placers (§4). A rectangle rather than a taller bottom band, because the panel covers only the
  left part of the bottom edge on desktop, and a pin in the bottom-right should keep its label
  there.

Below `sm` on the page the panel is outside the plate: `MAP_CONTROL_INSETS.phone` is unchanged.

## 4. Segment labels

### 4.1 Module

`lib/map/segment-labels.ts`, pure, tested in `segment-labels.test.ts`. Input, all in map units:
the route's points; per segment the label's width and height (estimated from glyph count, as
`placePinLabels` does); the gap; the visible label view (`labelView`, the view minus the control
bands); obstacle boxes (pin dots, the panel). Output per segment: `{ x, y }` of the label centre,
or `null` when it is not shown.

### 4.2 Rules

1. **Position**: the segment's midpoint, moved along the segment's unit normal `n` by
   `d = |nₓ|·w/2 + |n_y|·h/2 + gap`, the smallest offset at which the axis-aligned label box no
   longer touches its own line. Horizontal text (`text-anchor: middle`, central baseline).
2. **Side**: two candidates, `+n` and `−n`. The side facing away from the route's centroid (the
   outside of the bend) is tried first.
3. **Cost of a candidate**: area outside `labelView` + overlap with obstacles (dots, panel) +
   overlap with segment labels already placed + crossing any other segment of the route
   (segment–rectangle test). The first zero-cost candidate wins.
4. **Hidden** when neither side is free, or when the label's extent along the segment
   (`|cos θ|·w + |sin θ|·h`) plus both pins' dot diameters is longer than the segment on screen.
   A dropped label is the cartographic default, and the total is always in the panel.
5. Segments are placed in route order.

### 4.3 Pin labels

`placePinLabels` gains an optional `obstacles: Box[]` option: overlap with an obstacle is added to
a side's cost exactly as a dot's is. The workbench passes the shown segment label boxes and the
panel rectangle (§3.3). Segment labels are placed first because they have two candidates and pin
labels have eight.

### 4.4 Text and drawing

- Distance: `haversineKm(a, b)`, the same leg function `polylineLengthKm` sums. Decimals from
  `kmDecimalsFor(kmPerPixel, km)` (whole km, one decimal under 10 km when a pixel is finer than
  1 km), `kmPerPixel` from `kmPerMapUnitAt(midpoint latitude)` and the drawn scale. Format
  `"{n} km"` through `formatNumber`. Rounded legs need not sum to the rounded total.
- Drawn in the `<svg>` after the polyline and before the pins, at `PIN_LABEL_SIZE` with the same
  card-coloured halo, sized with `atScreenSize` so they keep one screen size at every zoom
  (T-122). Semibold, where pin names are bold, so a name and a distance read as different things.
  `pointer-events-none`, `select-none`.
- They are part of the `<svg>`, so the PNG export carries them.
- Only in `mode="distance"` and only with ≥ 2 points.

## 5. Not changing

- The result card in the right column stays, as the detailed view (metres, nautical miles,
  captions under flight/road).
- PNG export, Copy, Save, presets, point list: unchanged apart from the shared calculation
  (§2.3).
- Zoom, pan, pinch, fullscreen mechanics (`useLandscapeMode`), `MapAttribution`.

## 6. Tests

- `lib/map/segment-labels.test.ts`: position off the line for horizontal, vertical and diagonal
  segments; outside-of-bend side first; the other side when the first hits a dot, the panel or
  the view edge; hidden when both sides are blocked; hidden for a leg shorter than its label;
  no two segment labels overlap on a tight route; no label crosses another leg.
- `lib/map/pin-label-placement.test.ts`: a pin next to an obstacle takes a side off it.
- `lib/map/measure.test.ts`: `distanceTravelEstimates`.
- `components/v2/map-result-panel.test.tsx` (`renderToStaticMarkup`): renders content and
  actions; buttons carry accessible names below `sm`.
- `v2-map-credit-placement.test.ts` and the composition scanner tests stay green with the new
  wrapper.

Manual, Playwright MCP, 320 / 360 / 390 px and desktop, light and dark, page and fullscreen
(desktop fullscreen, 740×360 landscape phone, 390×844 portrait phone with a coarse pointer for
the rotate hint), using the "İzmir - Van" preset and a hand-placed three-point route:

- After two points the total, flight time and road estimate are visible without scrolling.
- Undo removes the last point, Clear removes all, the panel updates; pressing the panel never
  adds a point; pan and click-to-add work around it.
- A three-point route shows two segment labels with the right legs; zooming keeps their size;
  short legs drop their label; pin labels stay off segment labels and the panel.
- The panel never overlaps the scale bar, the zoom buttons, the ⓘ, or the rotate hint.
- `pnpm sweep:overflow -- --filter=/araclar/mesafe-olcme` green.
