# T-116 wheel / trackpad zoom — implementation plan

Spec: `docs/superpowers/specs/2026-09-26-t116-wheel-trackpad-zoom-design.md`. Branch
`feature/t116-wheel-trackpad-zoom`. Gate after each task: `pnpm typecheck && pnpm lint && pnpm test`.

1. **Pure math (TDD).** Tests first in `lib/map/v2-zoom-pan.test.ts` for `zoomPanAround`,
   `atlasZoomAt`, `gameZoomAt`; implement; rebuild `pinchZoomPan` on `zoomPanAround` (its tests
   must stay green unchanged).
2. **Wheel helpers (TDD).** `lib/map/wheel-zoom.test.ts` then `lib/map/wheel-zoom.ts`:
   `wheelZoomFactor`, `isApplePlatform`, `offsetFromCentre`. Switch `usePinchZoom` to
   `offsetFromCentre`.
3. **Hook + hint.** `lib/map/use-wheel-zoom.client.ts`, `components/v2/map-wheel-hint.tsx`,
   `Map.wheelHint` in `messages/tr.json` and `messages/en.json`.
4. **Atlas maps.** Wire `/dunya` and `/turkiye` (`plainWheelZooms: false`); transition off while
   `isZooming`.
5. **Tools.** Extract the pinch's anchoring into one local `zoomToolAt(targetZoom, clientX,
clientY)` used by pinch and wheel; wire with `plainWheelZooms: landscape.active`.
6. **Game.** Wire on the map viewport with `gameZoomAt`; `plainWheelZooms: landscape.active`;
   drop `transition-transform` while `isZooming`.
7. **Verify.** Playwright script per spec §4, `pnpm sweep:overflow` on the four route shapes,
   screenshots of the hint light/dark.
8. **Finish.** Commit, push, PR into `dev`, move T-116 to `TASKS-DONE.md`.
