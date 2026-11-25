import { MARK_PATHS, MARK_VIEWBOX } from "./mark-paths";

/**
 * The geograp mark on a paper plate, as a standalone SVG string for the OG image (`next/og`
 * renders a raw `<img>`, so the page's CSS variables are out of reach and the colours are the
 * light-theme `--accent`, `--primary` and `--color-bg` values written out).
 *
 * The static icons (`app/icon.svg`, `public/icon.svg`, `app/apple-icon.png`, `public/favicon.ico`,
 * `public/icon-*.png`) are files built from the same mark; the favicon drops the inner diamond so
 * the needle still reads at 16 px.
 */
export interface GlyphOptions {
  /** Rendered pixel size (square). */
  size?: number;
  /** Corner radius as a fraction of the side. 0 = full-bleed square. */
  radiusRatio?: number;
  /** Plate colour (default Terra paper). */
  background?: string;
}

const TONES = { accent: "#276b70", primary: "#b0522e" } as const;

/** Share of the plate's side the mark's height fills. */
const MARK_FILL = 0.76;

export function brandGlyphSvg({
  size = 512,
  radiusRatio = 0.22,
  background = "#fbf8f3",
}: GlyphOptions = {}): string {
  const rx = (radiusRatio * 32).toFixed(2);
  const scale = ((32 * MARK_FILL) / MARK_VIEWBOX.height).toFixed(5);
  const cx = MARK_VIEWBOX.x + MARK_VIEWBOX.width / 2;
  const cy = MARK_VIEWBOX.y + MARK_VIEWBOX.height / 2;
  const paths = MARK_PATHS.map((p) => `<path fill="${TONES[p.tone]}" d="${p.d}"/>`).join("");
  // viewBox is a fixed 32×32 grid; width/height scale it to `size`.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="${rx}" fill="${background}"/>` +
    `<g transform="translate(16 16) scale(${scale}) translate(${-cx} ${-cy})">${paths}</g>` +
    `</svg>`
  );
}

/** Base64 data URI of the glyph SVG — used as an `<img src>` inside `next/og`. */
export function brandGlyphDataUri(opts?: GlyphOptions): string {
  return `data:image/svg+xml;base64,${Buffer.from(brandGlyphSvg(opts)).toString("base64")}`;
}
