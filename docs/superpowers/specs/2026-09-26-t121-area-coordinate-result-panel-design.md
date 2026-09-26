# Area and coordinate tools: result panel on the map and area label — design (T-121)

Status: approved by the owner 2026-09-26, ready for implementation planning.

Scope: `cografya_web` only, `/araclar/alan-hesaplama` and `/araclar/koordinat-bulma`
(`components/v2/v2-tool-workbench.tsx` in `mode="area"` and `mode="coordinates"`). Builds on
T-120 (`2026-09-26-t120-distance-result-panel-design.md`); every rule there that is not restated
here holds unchanged for the two tools.

## 1. Goal

The area and coordinate tools get what T-120 gave the distance tool: the result and its actions
on the map, on the page and in fullscreen, at every width. The area tool also writes its area
inside the drawn polygon.

Today (measured on `dev` @ `1d64d8d`):

- The area and coordinate results live only in the right-column card, ~750 px under the map at
  390 px, and are invisible in fullscreen (outside `landscapeBoxRef`).
- Undo and Clear for these two tools are still in the toolbar above the map
  (`activeTool !== "distance"` block).
- At 320 px the panel is 239 px wide; beside two icon buttons the summary cell has 137 px. The
  decimal coordinate `39,925533° K, 32,866287° D` is 218 px at `text-sm` mono, so it cannot be the
  summary line at phone widths (§3.1).

## 2. Structure

### 2.1 Components

- `MapResultPanel` (`components/v2/map-result-panel.tsx`) stays the one shared panel. One
  addition: `hintTone?: "muted" | "warning"` (default `"muted"`), colouring the hint line
  `text-muted-foreground` or `text-warning-strong`.
- Two wrappers next to `DistanceResultPanel`, the same shape (content and status from props,
  placement via `ref` / `className` / `style` passed through):
  - `components/v2/area-result-panel.tsx` — `AreaResultPanel`
  - `components/v2/coordinate-result-panel.tsx` — `CoordinateResultPanel`
- The workbench renders exactly one of the three, chosen by `activeTool`, at the spot
  `DistanceResultPanel` occupies today, with the same placement props (one shared placement
  object, so the three cannot drift apart).

### 2.2 Placement and obstacle

- `resultPanelOnMap = landscape.active || lgUp` for every tool (no `activeTool === "distance"`
  condition). Everything derived from it — fit insets, the panel obstacle rectangle, the rotate
  hint lift, the fixed 320 px width on the map — then applies to the two tools unchanged.
- Page below `lg`: in flow under the plate, full width, as T-120.

### 2.2a Button labels

`MapResultAction` shows its text by the panel's own width, not the viewport's: a container query
on the panel (`@container`, text from `@sm`, 24rem). On the map the panel is 320 px at every
viewport, and text buttons there left the summary ~100 px, less than "135.476,1 km²", a long
province name or a five-digit route total; so on the map all three tools show icon-only buttons
(names kept for assistive tech), and the wide panel under the map shows icon and text. This
replaces T-120 §2.4's "from `sm` icon plus text".

### 2.3 Toolbar

The `activeTool !== "distance"` Undo/Clear block is removed. The toolbar keeps PNG export (and
the hover readout) for every tool.

## 3. Panel content

Constant height per tool: in every state of one tool the panel has the same size (the T-126 rule,
T-120 §2.5). The hint replaces the details row; the details stay mounted `invisible` with
representative text for sizing. No line wraps at 320 px for any realistic value (§3.3).

### 3.1 Coordinate tool

The tool holds one point (`MEASUREMENT_MAX_POINTS.coordinate` is 1), so the "last point" is
`points[0]`.

| Row     | Content                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Summary | The province the point falls in (`detectedProvince.name`), or "Türkiye dışında" (`text-sm` bold, §3.3). |
| Actions | Copy, Clear.                                                                                            |
| Details | Two columns, latitude and longitude: decimal on top, degrees-minutes-seconds below.                     |

- Decimal: `formatNumber(value, locale, 6)` + `° K` / `° D` (the `latLon` format split per
  axis), mono, bold, 12 px. DMS: the workbench's existing `toDms(value, isLat)`, mono, 11 px,
  muted. The same values the right-column card shows.
- 0 points: summary "—", hint "Koordinat için haritada bir yere tıkla.", Copy and Clear
  `aria-disabled`.
- Copy calls the existing `handleCopy` (same clipboard text as the card's "Özeti Kopyala"). While
  the workbench's `copied` flag is up the button shows `Check` and "Kopyalandı!" (existing
  `copied` key), otherwise `Copy` and the new short `resultPanelCopy` label.
- No Undo: with one point Undo and Clear do the same thing.
- Status line: `"{decimalDegreesLabel}: {lat}° K, {lon}° D. {dmsLabel}: {latDms}, {lonDms}.
{province}."`, or the hint.

### 3.2 Area tool

| State                  | Summary              | Details row                                                         |
| ---------------------- | -------------------- | ------------------------------------------------------------------- |
| 0 points               | "— km²"              | hint "Alan için haritada köşeleri sırayla koy."                     |
| 1–2 points             | "— km²"              | hint "Şeklin kapanması için {count} köşe daha koy." (3 − n)         |
| ≥ 3, self-intersecting | "— km²"              | warning-toned hint "Kenarlar kesişiyor, alan yazılmaz."             |
| ≥ 3                    | `{area} km²` (large) | line 1 `{ha} ha · {dönüm} dönüm`, line 2 `{perimeter label} {p} km` |

- Area `formatNumber(areaKm2, locale, 1)`; hectares and decares with the card's exact
  `hectaresValue` / `decaresValue` formatting (`toLocaleString(numberLocale, { maximumFractionDigits:
0 })`); perimeter `formatNumber(perimeterKm, locale, 1)`. The card's arithmetic (`× 100`,
  `× 1000`) moves into one place both call (a local helper or props computed once in the
  workbench), so the card and panel cannot disagree.
- Details in sans with `tabular-nums`, not mono: `78.356.240 ha · 783.562.400 dönüm` (Türkiye's
  whole area) is 218 px in 11 px mono, one pixel over the 217 px content width at 320 px.
- Actions: Undo, Clear (existing handlers, `aria-disabled` at 0 points).
- The self-intersection banner at the top of the plate and the card's Sort button stay; the
  panel only replaces the number, as T-094 requires. The banner is `role="alert"` and the panel's
  status line also carries the warning; the double announcement is accepted.
- Status line: `"{areaTotal}: {area} km². {hectares}: {ha}. {decares}: {dönüm}. {perimeter}: {p}
km."`, or the hint.

### 3.3 Width check

Measured at 320 px (panel 239 px, content 217 px, summary cell 137 px): the province summary is
`font-heading text-sm font-bold` — at `text-base` "Kahramanmaraş" is exactly 137 px and
"Afyonkarahisar" 127 px, no margin; each coordinate column ~102 px holds `39,925533° K` (86 px)
and `39° 55′ 31,9″ K` (99 px); the area summary `783.562,4 km²` is 122 px; the area details line
`78.356.240 ha · 783.562.400 dönüm` is 183 px in 11 px sans `tabular-nums`. The implementation re-measures in Playwright and keeps `whitespace-nowrap` on every
line so a surprise shows up as overflow in `sweep:overflow`, not as a height jump.

### 3.4 New message keys (TR / EN)

- `resultPanelEmptyCoordinates`: "Koordinat için haritada bir yere tıkla." / "Click the map to
  get a coordinate."
- `resultPanelOutside`: "Türkiye dışında" / "Outside Türkiye"
- `resultPanelCopy`: "Kopyala" / "Copy"
- `resultPanelEmptyArea`: "Alan için haritada köşeleri sırayla koy." / "Place the corners on
  the map in order to get an area."
- `resultPanelFewPointsArea`: "Şeklin kapanması için {count} köşe daha koy." / "Add {count}
  more corner(s) to close the shape."
- `resultPanelSelfIntersect`: "Kenarlar kesişiyor, alan yazılmaz." / "The edges cross, so there
  is no area."

## 4. Area label on the map

### 4.1 Module

`lib/map/area-label.ts`, pure, tested in `area-label.test.ts`:

```ts
placeAreaLabel(ring: Point[], label: { width; height }, opts: {
  view: Box; obstacles: Box[]; dotRadius: number; gap: number;
}): Point | null   // the label's centre, or null when hidden
```

All in map units, like `placeSegmentLabels`. Obstacles are the pin dots (from `ring` and
`dotRadius`) plus the caller's boxes (the result panel).

### 4.2 Rules

1. **Inside first.** Scan the part of the ring's bounding box inside `view` with horizontal lines
   (a fixed count, e.g. 24); each inside interval of each line gives a candidate at its midpoint,
   and at the middle and both ends (kept `gap` off the outline) of the part of it inside `view`,
   so a shape partly panned out of sight or partly under the panel still finds room. A candidate fits when
   the label box lies wholly inside the ring (its corners are inside and no ring edge crosses it,
   `segmentHitsBox`), inside `view`, and off every obstacle. Of the fitting candidates the one
   closest to the ring's area centroid wins.
2. **Outside, close by.** If nothing fits inside: candidates centred just below, above, right of
   and left of the ring's bounding box, `gap` away, tried in that order. A candidate must cross no
   ring edge, stay inside `view` and off obstacles. First free one wins.
3. **Hidden** when neither step finds a place (the area is always in the panel).
4. Not drawn for a self-intersecting ring or fewer than 3 points.

### 4.3 Order and drawing

- Placed before the pin labels; `placePinLabels` receives the area label's box as an obstacle
  (next to the panel rectangle). Segment labels do not exist in area mode.
- Text `"{formatNumber(areaKm2, locale, 1)} km²"`, drawn in the `<svg>` after the polygon and
  before the pins, 13 px (`PIN_LABEL_SIZE + 2`), bold, `fill-foreground stroke-card` halo,
  `paintOrder="stroke"`, sized with `atScreenSize` so it keeps one screen size at every zoom
  (T-122). `pointer-events-none`, `select-none`. The PNG export carries it.
- Width estimated from glyph count as the other labels do (`text.length * size * 0.6`, height
  `size * 1.4`).

## 5. Not changing

- The right-column result cards (detail view, province page link, UTM zone, Sort button).
- The distance tool, apart from sharing the generalised `resultPanelOnMap` and placement object.
- PNG export, Save, presets, point list, zoom/pan/pinch, fullscreen mechanics, `MapAttribution`.

## 6. Tests

- `lib/map/area-label.test.ts`: a convex ring gets its label near the centroid; an L-shaped
  (concave) ring whose centroid falls outside gets it in the wider arm; a ring too small for the
  label gets it outside, below first, then the next side when below is off the view or on an
  obstacle; hidden when every candidate is blocked; the label never covers a vertex dot.
- `components/v2/area-result-panel.test.tsx`, `coordinate-result-panel.test.tsx`
  (`renderToStaticMarkup`): content per state, hint tone for self-intersection, status text,
  accessible button names, `aria-disabled` at 0 points, the copied state.
- `components/v2/map-result-panel.test.tsx`: the warning hint tone.
- `v2-tool-workbench.structure.test.ts`: one panel element per tool after the plate and before the
  `<figcaption>`; `resultPanelOnMap` without the distance condition; no Undo/Clear in the
  toolbar.
- `v2-map-credit-placement.test.ts`, composition scanner tests stay green.

Manual, Playwright MCP, 320 / 360 / 390 px and desktop, light and dark, page and fullscreen
(desktop, 740×360 landscape phone, 390×844 portrait with the rotate hint):

- Area: a preset and a hand-drawn polygon show the km² inside the polygon and the full result in
  the panel; a small polygon puts the label just outside; a crossing shape shows the warning in
  the panel and no label; Undo/Clear work; pressing the panel adds no point.
- Coordinates: a click and a province pick show the province, decimal and DMS; a sea click shows
  "Türkiye dışında"; Copy writes the clipboard and shows "Kopyalandı!"; Clear empties the panel.
- The panel height does not change between states of one tool; it never overlaps the scale bar,
  zoom buttons, ⓘ or rotate hint.
- `pnpm sweep:overflow -- --filter=/araclar/alan-hesaplama` and
  `--filter=/araclar/koordinat-bulma` green.
