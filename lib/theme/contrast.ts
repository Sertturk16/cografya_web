/**
 * WCAG 2.x contrast maths, as pure functions.
 *
 * A palette value without its measurement is how a contrast failure gets reintroduced, so
 * every token this repo tunes carries its ratios in a comment beside it (see
 * `--color-success` and `--game-hover-edge` in `app/globals.css`). This module is what
 * produces those numbers, so they are computed rather than recalled.
 */

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): readonly [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a 6-digit sRGB hex: ${hex}`);
  }
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ] as const;
}

/** WCAG 2.x relative luminance of an sRGB hex, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG 2.x contrast ratio between two sRGB hexes. Always >= 1, order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounded to two decimals, the form these ratios are written down in. */
export function ratio(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

/**
 * Flattens a translucent fill over an opaque backdrop, the way a browser composites
 * `bg-warning/15`.
 *
 * Needed because a tinted chip's real text contrast is against the BLEND, not against the
 * token: `--color-warning` on a 15% tint of itself measures 2.62:1, which is the failure the
 * `-strong` members exist to fix. Measuring against the untinted token would have missed it
 * entirely.
 *
 * @param fill   the translucent colour, as an sRGB hex
 * @param alpha  0-1
 * @param over   the opaque backdrop, as an sRGB hex
 */
export function blendOver(fill: string, alpha: number, over: string): string {
  if (alpha < 0 || alpha > 1) throw new Error(`alpha out of range: ${alpha}`);
  const [r1, g1, b1] = parseHex(fill);
  const [r2, g2, b2] = parseHex(over);
  const mix = (a: number, b: number) =>
    Math.round(a * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}

/** WCAG 2.1 floors. Graphical objects and large text share the 3:1 bar (1.4.11 / 1.4.3). */
export const TEXT_MIN = 4.5;
export const GRAPHICAL_MIN = 3;
