# Fullscreen button on the world and Türkiye maps — design (T-118)

Status: approved by the owner 2026-09-26, ready for implementation.

Scope: `cografya_web` only. Two surfaces: `/dunya` (`v2-world-map-explorer.tsx`) and `/turkiye`
(`v2-turkey-map-explorer.tsx`). The game screen and the tool pages keep their own controls.

## 1. Goal

The game and tool maps have a top-left button that takes the map fullscreen and, on a phone, tries
to lock landscape (`useLandscapeMode`, T-015). The two atlas maps, the most cramped on a phone,
have none.

- Same button, same place (top-left of the map box), same icons (`Maximize2` / `Minimize2`), same
  labels ("Tam ekranda aç" / "Tam ekrandan çık"), same rotate-your-phone hint with its "Anladım"
  button that leaves fullscreen.
- In fullscreen, clicking a country or province opens its selection card over the map; the card
  closes with its X and exploring continues without leaving fullscreen.
- The credit behaves as in T-117 (open on entry, then an ⓘ in the bottom-right corner).
- Esc and the browser's own exit reset the state (the hook already does this).
- iOS Safari (no Fullscreen API) gets the hook's fixed-position fallback.

## 2. Fullscreen target

The `<figure>` on each surface: it holds the toolbar, the map box, the selection card and the
`<figcaption>` credit, so everything the map needs is inside the element that goes fullscreen.
`useLandscapeMode(figureRef)`, never reimplemented. The figure gains `relative` (the fullscreen
credit is `absolute` against it) and, in fullscreen, loses `space-y-2` (an empty caption must not
push the map up), exactly as `v2-tool-workbench.tsx` does.

`v2-fullscreen-credit.test.ts` derives its surfaces from `useLandscapeMode(` calls, so both
explorers join it automatically: `MapAttribution` inside the target, unconditional, with
`fullscreen={landscape.active}`. Its "finds the surfaces" list names the two new files.

## 3. Layout in fullscreen

Inline style, not conditional classes, for the reasons `v2-game-screen.tsx` records beside
`LANDSCAPE_FILL`: an inline style beats `aspect-*` / `min-h-*` without depending on Tailwind's
emit order, and a `${…}` className hides the plate's `aspect-[…]` from the composition scanner.

- Figure: `display: flex; flex-direction: column; justify-content: center`, plus
  `background: var(--color-bg)` (a real Fullscreen API session paints the element over a black
  `::backdrop`; the fallback style already sets it).
- Positioning wrapper (`div.relative`): flexes to fill (`flex: 1 1 0%; min-height: 0`, column).
- Map box: `flex: 1 1 0%; min-height: 0; aspect-ratio: auto; border-radius: 0`, plus the side
  borders dropped on `/dunya` (it already drops them under `sm`).
- **`/turkiye` only:** `max-height: 100vw`. The map is drawn with `preserveAspectRatio="xMidYMid
slice"` over a square frame; a portrait fullscreen box (a phone that did not rotate) is about
  twice as tall as wide and `slice` would cut Türkiye's east and west. Capped at square, the box is
  centred vertically on the page background. Landscape and desktop are never taller than wide, so
  the cap does nothing there. `/dunya` uses the default `meet` over the ocean colour, so a tall box
  only adds ocean; no cap.

Corners (fullscreen, every width):

| Corner       | Element                                                             |
| ------------ | ------------------------------------------------------------------- |
| top-left     | fullscreen toggle                                                   |
| top-right    | toolbar (`/dunya`: floats over the map instead of sitting above it) |
| bottom-left  | selection card                                                      |
| bottom-right | credit ⓘ (T-117)                                                    |

- `/dunya` toolbar: its below-`sm` place is a row above the map (T-079). In fullscreen an inline
  style puts it `absolute` at the top-right (`top/right: 12px; z-index: 30; margin: 0`).
- Selection card, both surfaces: in fullscreen an inline style puts it `absolute`, `left: 12px`,
  `z-index: 30`, `margin: 0`, width capped at `min(24rem, 100% − 64px)` so it never reaches the
  ⓘ (12px + 32px + 8px gap + 12px). Its `bottom` is 12px, or, while the rotate hint shows, 12px +
  the hint's measured height + 8px (the tool page's `resultPanelBottom` pattern; the hint is
  measured with a `ResizeObserver` ref callback).
- The rotate hint is `z-40`, bottom-centre, as on the tool page.

## 4. Shared controls

New `components/v2/map-fullscreen-controls.tsx`:

- `MapFullscreenToggle({ active, onToggle })`: the top-left button, `aria-pressed`, label from
  `MapExplorer.fullscreenEnter` / `fullscreenExit`; stops `pointerdown`/`mousedown` so a press does
  not start a pan. Rendered inside the map box so it is inside the fullscreen target on every width.
- `MapRotateHint({ onDismiss, onHeight })`: the `role="status"` banner, `MapExplorer.rotateHint` /
  `rotateDismiss`, reports its height for the card offset.

Copy: `MapExplorer.fullscreenEnter`, `fullscreenExit`, `rotateHint`, `rotateDismiss` in `tr.json`
and `en.json`, the same strings as `ToolWorkbench`'s keys.

## 5. Zoom

- `useWheelZoom({ plainWheelZooms: landscape.active })` on both (T-116's leftover): in fullscreen
  there is no page to scroll, so a plain wheel zooms. `MapWheelHint` already sits in the map box.
- Pinch (T-115) and pan are bound to the map box and need no change.

## 6. `/turkiye` label clearance

The neighbour labels avoid the toolbar through `useMapBoxMetrics(mapContainerRef, toolbarRef)`,
which takes one overlay. The toggle adds a second overlay in the top-left, over the Balkans.
`useMapBoxMetrics(boxRef, overlayRefs?)` takes an array of refs and measures each (the returned
`overlays: Rect[]` is already a list); `/deniz` and `/deprem` callers move to the array form.

## 7. Tests

- New `components/v2/v2-atlas-fullscreen.test.ts` (composition scan, both explorers): the toggle,
  the toolbar and the selection card are descendants of the element carrying the landscape ref; the
  toggle gets `active={landscape.active}` and `onToggle={landscape.toggle}`; `useWheelZoom` gets
  `plainWheelZooms: landscape.active`.
- `v2-fullscreen-credit.test.ts`: the surface list names both explorers.
- `v2-map-letterbox.test.ts`: the `useMapBoxMetrics` call pattern follows the array form.
- Browser (Playwright MCP): enter/exit by button and by Esc on both pages; zoom, pan, select, close
  the card in fullscreen; the CSS fallback (Fullscreen API removed) including the rotate hint on a
  portrait touch viewport; 320/360/390 px and desktop, light and dark; `pnpm sweep:overflow` on
  `/dunya` and `/turkiye`.

## 8. Out of scope

Refactoring the game and tool toggles onto the shared controls; `/deprem` and `/deniz` (T-119).
