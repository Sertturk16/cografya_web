import type { GeoPoint } from "@/lib/map/measure";
import { projectToMapPoint } from "@/lib/map/projection";
import { parseViewBox } from "@/lib/map/zoom-pan";

/**
 * PNG export for the CBS tools (SPEC §9, `plan-web.md` §9).
 *
 * ## Why this builds its own SVG instead of serialising the live one
 *
 * SPEC §9.2(a) says CSS custom properties do not survive serialisation. The measured problem
 * is larger: this map is painted by CSS MODULE CLASSES (`map.module.css` → `.province`,
 * `.water`), and an `<svg>` loaded into an `Image` is detached from the document's
 * stylesheets entirely — so it is not `var(--token)` that is lost but every class, and the
 * fills fall to black. Copying the computed style of ~200 nodes is the other way out; this is
 * the smaller one: build a clean string in which every node carries its colour as a
 * PRESENTATION ATTRIBUTE and no class at all.
 *
 * ## Where the colours come from — the token layer, read rather than bypassed
 *
 * `getComputedStyle` on the live elements. `DESIGN.md` §2 bans raw hex outside the token
 * layer, and this file writes none: it asks the browser what the tokens resolved to, which is
 * also what keeps the PNG the same colour as the screen after a palette change.
 *
 * ## Where the geometry comes from, and the ONE deviation this file records
 *
 * From the live DOM's `<defs>`, not from `PROVINCE_SHAPES`. `plan-web.md` §9.2 proposed the
 * import with the parenthetical "already on the client", and that premise is false on this
 * page: the outlines are in the SERVER HTML, and importing the artifact into a client module
 * would ship a second copy as JavaScript — `lib/map/tr-provinces.generated.ts` is 64 KB of
 * mostly path data, and `components/game/game-map.tsx` records the same rule as a hard one
 * ("the path data is already in the server HTML and is never shipped a second time as
 * JavaScript"). Same output, same mechanism, no second copy: the deviation is the source of
 * the `d` strings, not the approach.
 *
 * ## The attribution band is not optional and not decorative
 *
 * A downloaded file travels without the page, so the licence line is drawn INTO the bitmap
 * (SPEC §9.3, karar-paketi #17). The text is read from the visible attribution element, so
 * the file can never credit something the page does not — and when it cannot be read the
 * export FAILS rather than producing an unattributed image.
 */

/** Rendered width of the exported map, in CSS pixels before the density multiplier. */
const EXPORT_WIDTH_PX = 1200;
/** SPEC §9.4: 2× so the file stays sharp in a slide deck or on a classroom board. */
const DENSITY = 2;
/** Height of the attribution band under the map, in the same CSS pixels. */
const BAND_HEIGHT_PX = 46;
const BAND_PADDING_PX = 12;
const BAND_LINE_HEIGHT_PX = 15;
const BAND_FONT_PX = 11.5;
const SCALE_BAR_FONT_PX = 12;
const PROVINCE_STROKE_PX = 1;
const MEASURE_STROKE_PX = 3;
const MARKER_RADIUS_PX = 5;
const MARKER_STROKE_PX = 1.5;

/**
 * How solid the area tool's ring fill is, on screen and in the export.
 *
 * Kept in step with `.measureArea`'s `fill-opacity` in `tools.module.css` BY HAND, because the
 * export builds its own SVG string from scratch rather than serialising the live DOM (the
 * class-based paint does not survive serialisation — `plan-web.md` §9.2). It is deliberately
 * low: the outline is what carries the shape and has to keep its WCAG 1.4.11 contrast against
 * the province fill, and a heavier wash would eat into exactly that.
 */
const RING_FILL_OPACITY = 0.18;

export interface ToolPngOptions {
  /** The live map — geometry, current view and resolved colours are all read from it. */
  readonly svg: SVGSVGElement;
  /** The visible licence line; its text is baked into the band. */
  readonly attribution: HTMLElement | null;
  /** The measurement, in lon/lat. */
  readonly points: readonly GeoPoint[];
  /**
   * Whether the points form a closed ring — the area tool — rather than an open path.
   *
   * The file has to show what the screen showed. The area tool closes the ring for the reader
   * (SPEC §6.3) and paints the enclosed surface, so an export that drew an open polyline would
   * hand them a picture of a different shape from the one they measured. The fill colour is the
   * SAME token already read for the line, so this opens no new colour decision
   * (`DESIGN.md` §2, and §6.1/1: the ring shows interface state, it does not encode data).
   */
  readonly closed?: boolean;
  /**
   * The scale bar as the page shows it, or `null` when the view cannot produce one.
   *
   * `widthFraction` is the bar's width as a FRACTION of the rendered map width, which is what
   * survives the change of render size: the export is 1200 px wide whatever the reader's
   * screen is, and a bar reused in on-screen pixels would claim one distance while spanning
   * another. The kilometre figure and the latitude correction behind it stay where SPEC §6.4
   * put them — in `scaleBarKm`, computed once, never re-derived here.
   */
  readonly scaleBar: {
    readonly km: number;
    readonly label: string;
    readonly widthFraction: number;
  } | null;
  /** ASCII file name including the extension. */
  readonly fileName: string;
}

/** Reads a custom property and follows a single `var(--x)` indirection if one comes back. */
function readToken(styles: CSSStyleDeclaration, name: string): string {
  const value = styles.getPropertyValue(name).trim();
  const indirect = /^var\((--[\w-]+)\)$/.exec(value);
  if (indirect?.[1]) return styles.getPropertyValue(indirect[1]).trim();
  return value;
}

/**
 * A layer's own stroke width in CSS pixels, read from the live element.
 *
 * Both map layers draw with `vector-effect: non-scaling-stroke`, i.e. their width is in CSS
 * pixels rather than map units — and the two are NOT the same width: the province border is
 * 1px and the lake outline is 0.5px, a deliberate difference (`inland-water.module.css`
 * records the measurement behind it). Exporting both at one width doubled the lakes' weight
 * and made them read as ink rather than as water, which is a silent colour-fidelity failure
 * of exactly the kind SPEC §9.2 exists to prevent.
 */
function strokePx(style: CSSStyleDeclaration | null, fallback: number): number {
  const parsed = Number.parseFloat(style?.strokeWidth ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The licence text exactly as the page shows it, one line per visible block span. */
function attributionLines(element: HTMLElement | null): string[] {
  if (element === null) return [];
  const spans = [...element.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const lines = (
    spans.length > 0 ? spans.map((span) => span.textContent ?? "") : [element.textContent ?? ""]
  )
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
  return lines;
}

export async function downloadToolPng(options: ToolPngOptions): Promise<void> {
  const { svg, points, scaleBar, fileName, closed } = options;

  const lines = attributionLines(options.attribution);
  if (lines.length === 0) {
    // Licence-safe direction: no attribution, no file (SPEC §9.3 — the band may not be
    // cropped, hidden or made transparent, and "absent" is all three at once).
    throw new Error("attribution line unavailable");
  }

  const viewAttribute = svg.getAttribute("viewBox");
  if (viewAttribute === null) throw new Error("map viewBox unavailable");
  const view = parseViewBox(viewAttribute);

  const root = getComputedStyle(document.documentElement);
  const background = readToken(root, "--color-bg");
  const ink = readToken(root, "--color-slate");
  const lineColour = readToken(root, "--color-primary");
  const markerRing = readToken(root, "--color-on-primary");
  const border = readToken(root, "--color-border");

  const provinceNodes = [...svg.querySelectorAll("defs path[id]")];
  const provinceSample = svg.querySelector('[data-map-layer="base"] use');
  const provinceStyle = provinceSample ? getComputedStyle(provinceSample) : null;
  const waterNodes = [...svg.querySelectorAll("[data-tool-water] path")];
  const waterStyle = waterNodes[0] ? getComputedStyle(waterNodes[0]) : null;

  const unitsPerPx = view.w / EXPORT_WIDTH_PX;
  const bandUnits = BAND_HEIGHT_PX * unitsPerPx;
  const totalUnits = view.h + bandUnits;
  const widthPx = EXPORT_WIDTH_PX;
  const heightPx = totalUnits / unitsPerPx;
  const round = (value: number) => Number(value.toFixed(2));

  const projected = points.map((point) => projectToMapPoint(point.lon, point.lat));
  const vertices = projected.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
  const strokeAttrs = `stroke="${lineColour}" stroke-width="${round(MEASURE_STROKE_PX * unitsPerPx)}" stroke-linecap="round" stroke-linejoin="round"`;
  // A ring needs three points; below that `closed` describes a shape that does not exist yet
  // and the open path is the honest picture.
  const drawsRing = closed === true && projected.length > 2;
  const polyline =
    projected.length > 1
      ? drawsRing
        ? `<polygon points="${vertices}" fill="${lineColour}" fill-opacity="${RING_FILL_OPACITY}" ${strokeAttrs}/>`
        : `<polyline points="${vertices}" fill="none" ${strokeAttrs}/>`
      : "";
  const markers = projected
    .map(
      (p) =>
        `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="${round(MARKER_RADIUS_PX * unitsPerPx)}" fill="${lineColour}" stroke="${markerRing}" stroke-width="${round(MARKER_STROKE_PX * unitsPerPx)}"/>`,
    )
    .join("");

  // The scale bar travels with the picture: karar-paketi #17 asks for the legend AND the
  // attribution in the file, and a map without its scale cannot be measured off a slide.
  const barLeft = view.x + 14 * unitsPerPx;
  const barBottom = view.y + view.h - 14 * unitsPerPx;
  const barWidthUnits = scaleBar === null ? 0 : scaleBar.widthFraction * view.w;
  const barRight = barLeft + barWidthUnits;
  const barTick = barBottom - 6 * unitsPerPx;
  const bar =
    scaleBar === null || !(barWidthUnits > 0)
      ? ""
      : `<path d="M ${round(barLeft)} ${round(barTick)} L ${round(barLeft)} ${round(barBottom)} L ${round(barRight)} ${round(barBottom)} L ${round(barRight)} ${round(barTick)}" fill="none" stroke="${ink}" stroke-width="${round(unitsPerPx)}"/>` +
        `<text x="${round(barLeft)}" y="${round(barBottom - 10 * unitsPerPx)}" fill="${ink}" font-family="sans-serif" font-size="${round(SCALE_BAR_FONT_PX * unitsPerPx)}">${escapeXml(scaleBar.label)}</text>`;

  const bandTop = view.y + view.h;
  const band =
    `<rect x="${round(view.x)}" y="${round(bandTop)}" width="${round(view.w)}" height="${round(bandUnits)}" fill="${background}"/>` +
    `<line x1="${round(view.x)}" y1="${round(bandTop)}" x2="${round(view.x + view.w)}" y2="${round(bandTop)}" stroke="${border}" stroke-width="${round(unitsPerPx)}"/>` +
    lines
      .map(
        (line, index) =>
          `<text x="${round(view.x + BAND_PADDING_PX * unitsPerPx)}" y="${round(bandTop + (BAND_PADDING_PX + BAND_FONT_PX + index * BAND_LINE_HEIGHT_PX) * unitsPerPx)}" fill="${ink}" font-family="sans-serif" font-size="${round(BAND_FONT_PX * unitsPerPx)}">${escapeXml(line)}</text>`,
      )
      .join("");

  const geometry =
    `<g clip-path="url(#tool-png-map)">` +
    `<g fill="${provinceStyle?.fill ?? background}" stroke="${provinceStyle?.stroke ?? ink}" stroke-width="${round(strokePx(provinceStyle, PROVINCE_STROKE_PX) * unitsPerPx)}" stroke-linejoin="round">` +
    provinceNodes.map((node) => `<path d="${escapeXml(node.getAttribute("d") ?? "")}"/>`).join("") +
    `</g>` +
    `<g fill="${waterStyle?.fill ?? "none"}" stroke="${waterStyle?.stroke ?? "none"}" stroke-width="${round(strokePx(waterStyle, PROVINCE_STROKE_PX) * unitsPerPx)}" stroke-linejoin="round">` +
    waterNodes.map((node) => `<path d="${escapeXml(node.getAttribute("d") ?? "")}"/>`).join("") +
    `</g>` +
    polyline +
    markers +
    bar +
    `</g>`;

  const document_ =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(widthPx * DENSITY)}" height="${round(heightPx * DENSITY)}" viewBox="${round(view.x)} ${round(view.y)} ${round(view.w)} ${round(totalUnits)}">` +
    `<defs><clipPath id="tool-png-map"><rect x="${round(view.x)}" y="${round(view.y)}" width="${round(view.w)}" height="${round(view.h)}"/></clipPath></defs>` +
    `<rect x="${round(view.x)}" y="${round(view.y)}" width="${round(view.w)}" height="${round(totalUnits)}" fill="${background}"/>` +
    geometry +
    band +
    `</svg>`;

  const svgUrl = URL.createObjectURL(
    new Blob([document_], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = await loadImage(svgUrl);
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.round(widthPx * DENSITY);
    canvas.height = Math.round(heightPx * DENSITY);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("canvas 2d context unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (png === null) throw new Error("canvas produced no PNG");
    triggerDownload(png, fileName);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("serialized SVG could not be rasterised"));
    image.src = url;
  });
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  // Appended so the click counts as a user gesture chain in every browser, removed straight
  // after — an orphan node here would leak on every export.
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the NEXT task, not on this line: the download's own fetch of the blob URL is
  // queued rather than synchronous, and a browser that resolves it after the click task would
  // produce no file and no message — `downloadToolPng` resolves normally, so the caller's
  // `downloadFailed` never fires (→ PR #73 review `CODE73-M5`).
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
