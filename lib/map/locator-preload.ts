/** The fixed-column/visible-height boundary measured for server-rendered locator discovery. */
export const LOCATOR_PRELOAD_VIEWPORT = {
  minWidthPx: 1120,
  minHeightPx: 720,
} as const;

const ROOT_FONT_SIZE_PX = 16;

/** Media query emitted by the server; no hydration or client viewport branch is involved. */
export const LOCATOR_DESKTOP_PRELOAD_MEDIA =
  `(min-width: ${LOCATOR_PRELOAD_VIEWPORT.minWidthPx / ROOT_FONT_SIZE_PX}rem) and ` +
  `(min-height: ${LOCATOR_PRELOAD_VIEWPORT.minHeightPx / ROOT_FONT_SIZE_PX}rem)`;

/** Pure classification contract shared by the viewport matrix test. */
export function shouldPreloadLocator(widthPx: number, heightPx: number): boolean {
  return (
    widthPx >= LOCATOR_PRELOAD_VIEWPORT.minWidthPx &&
    heightPx >= LOCATOR_PRELOAD_VIEWPORT.minHeightPx
  );
}
