/**
 * Terra brand mark — the ◭ header glyph rendered as pure vector paths.
 *
 * The ◭ codepoint (U+25ED) is absent from most fonts (incl. the OG default), so
 * the mark is DRAWN, never typed. This is the single source of the placeholder
 * brand glyph shared by `app/apple-icon.tsx` and the OG image; `app/icon.svg`
 * mirrors it by hand (a static file cannot import). Swap on the pending brand
 * decision (CONVENTIONS §3) — owner approved this Terra placeholder for now.
 */
export interface GlyphOptions {
  /** Rendered pixel size (square). */
  size?: number;
  /** Corner radius as a fraction of the side. 0 = full-bleed square (apple-icon). */
  radiusRatio?: number;
  /** Plate colour (default Terra primary). */
  background?: string;
  /** Mark colour (default on-primary white). */
  glyph?: string;
}

export function brandGlyphSvg({
  size = 512,
  radiusRatio = 0.22,
  background = "#b0522e",
  glyph = "#ffffff",
}: GlyphOptions = {}): string {
  const rx = (radiusRatio * 32).toFixed(2);
  // viewBox is a fixed 32×32 grid; width/height scale it to `size`.
  // Path 1 fills the LEFT half of the triangle; path 2 strokes the FULL outline —
  // together they reproduce ◭ (left half solid, right half outline).
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="${rx}" fill="${background}"/>` +
    `<path d="M16 8 L7 24 L16 24 Z" fill="${glyph}"/>` +
    `<path d="M16 8 L7 24 L25 24 Z" fill="none" stroke="${glyph}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/** Base64 data URI of the glyph SVG — used as an `<img src>` inside `next/og`. */
export function brandGlyphDataUri(opts?: GlyphOptions): string {
  return `data:image/svg+xml;base64,${Buffer.from(brandGlyphSvg(opts)).toString("base64")}`;
}
