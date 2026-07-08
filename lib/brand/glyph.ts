/**
 * Terra brand mark — a neutral GLOBE glyph rendered as pure vector shapes.
 *
 * This is the SINGLE SOURCE for the placeholder brand mark shared by the header
 * (`components/site-header.tsx`), `app/apple-icon.tsx`, and the OG image; the
 * favicon `app/icon.svg` mirrors it BY HAND (a static file cannot import). The
 * mark is a white globe (disc + equator + one meridian) on the Terra plate —
 * deliberately geo-appropriate and non-alarming (the previous ◭ triangle read like
 * a warning sign in the favicon/OG/apple surfaces). At favicon sizes the thin grid
 * lines gracefully collapse into a clean solid disc, so it never degrades badly.
 * Still a PLACEHOLDER — swap on the pending brand decision (CONVENTIONS §3); the
 * owner approved this Terra globe for now.
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
  // White globe disc (r=8.6, centred) carved by two Terra grid lines: a straight
  // equator across the full diameter and a narrow vertical meridian ellipse whose
  // poles meet the disc edge — the minimal, instantly-readable globe.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="${rx}" fill="${background}"/>` +
    `<circle cx="16" cy="16" r="8.6" fill="${glyph}"/>` +
    `<line x1="7.4" y1="16" x2="24.6" y2="16" stroke="${background}" stroke-width="1.5"/>` +
    `<ellipse cx="16" cy="16" rx="3.7" ry="8.6" fill="none" stroke="${background}" stroke-width="1.5"/>` +
    `</svg>`
  );
}

/** Base64 data URI of the glyph SVG — used as an `<img src>` inside `next/og`. */
export function brandGlyphDataUri(opts?: GlyphOptions): string {
  return `data:image/svg+xml;base64,${Buffer.from(brandGlyphSvg(opts)).toString("base64")}`;
}
