# Trackpad pinch and Ctrl + wheel zoom on every map — design (T-116)

Status: approved by the owner 2026-09-26, ready for implementation.

Scope: `cografya_web` only. Four surfaces: `/dunya` (`v2-world-map-explorer.tsx`), `/turkiye`
(`v2-turkey-map-explorer.tsx`), the game screen (`v2-game-screen.tsx`) and the tool pages
(`v2-tool-workbench.tsx`).

## 1. Goal

No map listens to `wheel` today. A trackpad pinch reaches the page as a `ctrlKey` wheel event
(Safari: `gesturestart`/`gesturechange`/`gestureend`), so it either does nothing or zooms the
whole page.

- Trackpad pinch and Ctrl (also ⌘ on a Mac) + wheel zoom around the point under the cursor.
- A plain wheel or a two-finger scroll always scrolls the page; it never gets stuck on the map.
  Over the map it shows a short hint: "Yakınlaştırmak için Ctrl + tekerlek" ("⌘ + tekerlek" on
  Apple platforms).
- **In fullscreen** (game and tools, `useLandscapeMode().active`) there is no page to scroll, so a
  plain wheel zooms directly and no hint is shown (owner ruling).
- Zoom limits stay each surface's current +/− limits: `/dunya` 1–4, `/turkiye` 1–3, game 0.8–2.5,
  tools 1–8.

## 2. The three zoom models

| Surface              | Transform                                     | Screen offset of map point `u` from the box centre |
| -------------------- | --------------------------------------------- | -------------------------------------------------- |
| `/dunya`, `/turkiye` | `scale(z) translate(pan / z)` on an inner div | `z·u + pan`                                        |
| game                 | `scale(z) translate(pan)` on the `<svg>`      | `z·(u + pan)`                                      |
| tools                | viewBox narrowing (`viewOfZoomPan`)           | via `zoomAtPoint`                                  |

Anchoring the point under the cursor is one formula for the first two (the game's `z·pan` is the
atlas `pan`), and `zoomAtPoint` already does it for the viewBox model.

## 3. Structure

- `lib/map/v2-zoom-pan.ts`: `zoomPanAround(zoom, pan, nextZoom, fromMid, toMid)` is the unclamped
  anchor formula; `pinchZoomPan` (T-115) is rebuilt on it; `atlasZoomAt` (clamped with
  `clampPanOffset`) and `gameZoomAt` (the game's pan-inside-scale, unclamped like its drag) are the
  wheel entry points.
- `lib/map/wheel-zoom.ts` (pure, tested): `wheelZoomFactor(deltaY, deltaMode)` (lines ×16,
  pages ×800, clamped to ±50 px, `exp(-px / 100)`, so a mouse notch is ≈ ×1.65 and trackpad
  steps stay smooth); `isApplePlatform(platform)`; `offsetFromCentre(el, clientX, clientY)`
  (shared with `usePinchZoom`).
- `lib/map/use-wheel-zoom.client.ts`: one hook per surface, `{ targetRef, zoomBy(factor, clientX,
clientY), plainWheelZooms }` → `{ hintVisible, isZooming }`.
  - `wheel` listener added with `{ passive: false }` (React's `onWheel` is passive).
  - Ctrl/⌘ wheel, or any wheel when `plainWheelZooms`: `preventDefault`, factors are multiplied
    and applied once per animation frame at the last cursor point, so a trackpad's many events
    per frame never read a stale zoom.
  - Plain wheel otherwise: untouched; `hintVisible` for 1.5 s after the last one.
  - Safari `gesture*`: always `preventDefault`; zoom by `scale / lastScale` at the gesture's
    `clientX/Y`, unless a touch pointer is down on the target (iOS sends gesture events for a
    touch pinch too; the surface's own pinch handles that).
  - `isZooming` is true until 150 ms after the last zoom event; surfaces drop their `transform`
    transition meanwhile so the map does not trail the cursor.
- `components/v2/map-wheel-hint.tsx`: centred, `pointer-events-none`, `aria-hidden` (a pointer
  hint, nothing for a screen reader), rendered only while visible, so the server never renders
  the platform-specific key. Copy in `messages/*.json` → `Map.wheelHint` with a `{key}` argument.

## 4. Testing

- Vitest: `wheelZoomFactor`, `isApplePlatform`, `offsetFromCentre`, `zoomPanAround`,
  `atlasZoomAt`, `gameZoomAt`.
- Playwright (Chromium), each surface: Ctrl + `mouse.wheel` zooms around the cursor and
  `visualViewport.scale` stays 1; limits hold; a plain wheel scrolls the page and shows the hint;
  in tool/game fullscreen a plain wheel zooms. WebKit: synthetic `gesturechange` zooms. A real
  Mac trackpad check is recommended.

## 5. Out of scope

Unifying the three zoom models; the game's touch pinch anchoring (it zooms around the centre
today); fullscreen for `/dunya` and `/turkiye` (T-118).
