# Fullscreen button on the earthquake and sea maps — design (T-119)

Status: approved by the owner 2026-09-26. Scope: `cografya_web` only. Two surfaces: `/deprem`
(`v2-earthquake-explorer.tsx`) and `/deniz` (`v2-marine-map-explorer.tsx`). Builds on T-118's
shared controls (`components/v2/map-fullscreen-controls.tsx`).

## 1. Goal

Same button and behaviour as `/dunya` and `/turkiye` (T-118): top-left toggle, rotate-your-phone
hint, Esc and the browser exit reset the state, iOS gets the CSS fallback. In fullscreen, the
selected earthquake or sea point opens a compact card over the map that closes with its X. No
zoom (out of scope).

## 2. Credit (owner ruling)

The credit behaves as on every other fullscreen map (T-117): open on entry, then an ⓘ in the
bottom-right corner. The data drawn on the map joins that same credit, so it is reachable in
fullscreen where the page's own source blocks are off screen:

- `/deprem`: the AFAD notice exactly as the API delivers it (`requiredNoticeTr` +
  `regulationReference`), `lang="tr"`, rendered by `EarthquakeMapCredit` beside
  `EarthquakeAttribution` so the format has one home. The page passes it to the explorer.
- `/deniz`: "Deniz verileri: Copernicus Marine Service ve ECMWF", linked to the central licence
  block on `/hakkimizda` (`MARINE_SOURCES_ANCHOR`, the same target `MarineDataNotice` links to).

`MapAttribution` takes a `dataCredit` node that it renders only in fullscreen; the page view is
unchanged (the page's own source blocks stay where they are).

## 3. Fullscreen target and layout

The `<figure>` (map box, card, credit), `useLandscapeMode(figureRef)`, as in T-118.

- Figure: `FULLSCREEN_FIGURE`. Positioning wrapper (the "stage"): fills the screen, painted
  `--map-plate`, `container-type: size`.
- Map box: keeps its own 1270/580 shape and is fitted into the stage
  (`width: min(100cqw, 100cqh × 1270/580)`, centred). Both maps draw with the default `meet` and
  size their labels from `sliceScale`, which is only right while the box has the viewBox's shape;
  a stretched box would misplace the labels. A landscape phone (~2.16:1) is nearly all map; a
  desktop gets thin plate-coloured bands.
- Corners: toggle top-left (inside the map box), card bottom-left and rotate hint bottom-centre
  (both against the stage), credit ⓘ bottom-right.
- `/deniz`'s basin chip moves right of the toggle (`left-16`, `top-3`); the toggle joins the
  label overlays on both maps, so no neighbour label hides under it.

## 4. Cards

`MapSelectionCard` with `fullscreenCardStyle(rotateHintHeight)`, rendered only in fullscreen (the
page cards are unchanged). `href` becomes optional: an event or point with no province gets no
explore link.

- `/deprem`: leading magnitude, title `placeNameTr` (`lang="tr"`), stats depth · time; link to the
  province page. The first event is selected on load, so closing the card dismisses it without
  clearing the selection (clearing would turn the page's spotlight card into "no matching
  earthquake"); selecting any event opens it again.
- `/deniz`: leading plate code, title `nameTr`, a "Boğaz yakını" badge when `isStraits`, stats
  water temperature · wave height · wind; link to the province page. The large page card is not
  rendered in fullscreen. Closing clears the selection, as the page card's X does.

## 5. Tests

- `v2-atlas-fullscreen.test.ts` covers the two new surfaces (toggle, card, rotate hint inside the
  target); the wheel-zoom assertion stays for the two atlas maps only.
- `v2-fullscreen-credit.test.ts`: the surface list names both explorers; both pass `dataCredit`.
- `map-selection-card.test.tsx`: no link without `href`.
- Browser (Playwright MCP): enter/exit by button and Esc, select and close in fullscreen, credit
  opens and shrinks to ⓘ with the data line, CSS fallback with the rotate hint; 320/360/390 px and
  desktop, light and dark; `pnpm sweep:overflow` on `/deprem` and `/deniz`.

## 6. Out of scope

Zoom and pan on these maps; bringing the colour legends into fullscreen.
