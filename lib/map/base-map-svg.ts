import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import type { Locale } from "@/i18n/routing";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "./tr-provinces.generated";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "./world-countries.generated";

/**
 * The SHARED BASE SILHOUETTES behind every locator mini-map — one static file per map per
 * locale, produced here and served by the four `force-static` route handlers under
 * `app/maps/`.
 *
 * ## Why a shared file rather than inline SVG (plan §3.2, measured)
 *
 * Inlining a whole map into every detail page costs 42.7 KB gzip per province page and
 * 112.2 KB per country page once Next's RSC double-serialisation is counted — on every one of
 * the site's detail pages, and for zero reader benefit, since the base map is byte-identical on
 * every one of them. The browser downloads this file ONCE and reads it from cache on every
 * subsequent page; the page's own HTML then carries only the highlighted shape's `d`
 * (≈ 0.7 KB gzip). A reader who visits five province pages transfers 20.4 KB instead of
 * 213.5 KB.
 *
 * No new generator and no new artifact: this module reads the SAME committed
 * `PROVINCE_SHAPES` / `COUNTRY_SHAPES` exports the interactive hub maps draw, so the two
 * cannot drift (that drift is exactly what DEC 2026-08-05b's deleted mini-artifact caused).
 *
 * ## Why the colours are literal hex here, and how that is kept honest
 *
 * An SVG loaded through `<img src>` is an isolated document: it cannot see the page's CSS,
 * so `var(--color-border)` would resolve to nothing. The values below are therefore
 * transcribed from `app/globals.css` — which `ENGINEERING.md` §10 otherwise forbids — and
 * `base-map-svg.test.ts` reads globals.css and asserts byte equality, so a token
 * retune fails CI instead of silently splitting the palette in two.
 *
 * ## Why the ODbL credit is a DRAWN `<text>` and not `<metadata>`/`<desc>`/`<title>`
 *
 * The Türkiye outlines are OSM-derived (ODbL). The OSMF Attribution Guideline (board
 * resolution 2021-06-25) states the attribution "should not require individuals to interact
 * with the map or produced work to see the attribution". `<metadata>` and `<desc>` are never
 * rendered at all, and `<title>` is a tooltip — it requires a hover. Only a drawn `<text>`
 * node satisfies the obligation when this file is opened on its own, so that is what the
 * Türkiye file carries, wrapped in an `<a>` to the copyright page (→ DEC 2026-08-08c md.1).
 * `base-map-svg.test.ts` pins it.
 *
 * The WORLD file deliberately carries no drawn credit: Natural Earth is public domain and
 * creates no attribution obligation. The asymmetry follows the licences, not a style
 * preference. Both files still carry a `<desc>` naming their source, and the page itself
 * shows a visible HTML credit chip next to the figure either way — the drawn text is IN
 * ADDITION to that chip, never instead of it.
 *
 * ## Why the geometry is left alone
 *
 * The credit fits inside the Türkiye artifact's EMPTY bottom-right corner (measured: the
 * rectangle x 600–1000 · y 380–429 contains zero shape vertices), so the `viewBox` is
 * unchanged and every dimension the figure CSS depends on still holds.
 */

/* ── Pinned palette (source of truth: app/globals.css) ─────────────────────────────── */

/** `--color-border` — the flat silhouette tone of locator variant V-A. */
const COLOR_BORDER = "#ddd5cc";
/** `--province-fill` (= `--land-inert` on the world map) — white land. */
const PROVINCE_FILL = "#ffffff";
/** `--color-taupe` (= `--province-stroke`) — the hairline boundary tone. */
const COLOR_TAUPE = "#8a8078";
/** `--map-sea` — the flat, cool sea of the world map. */
const MAP_SEA = "#dbe7e8";
/** `--color-slate` — secondary text; carries the drawn credit line. */
const COLOR_SLATE = "#57504a";

/** Every hex this module can emit, keyed by the globals.css token it transcribes. */
export const BASE_MAP_TOKEN_PINS = {
  "--color-border": COLOR_BORDER,
  "--province-fill": PROVINCE_FILL,
  "--color-taupe": COLOR_TAUPE,
  "--map-sea": MAP_SEA,
  "--color-slate": COLOR_SLATE,
} as const;

/* ── Türkiye silhouette paint ───────────────────────────────────────────────────────── */

/**
 * "İl mozaiği" — white land, taupe hairline boundaries: the same visual language as
 * `/turkiye`, so a reader two clicks downstream recognises the map for free.
 *
 * This shipped as one of two variants (V-A "düz siluet" was a single `--color-border` tone
 * with no internal boundaries) so the sample round could render both without a code rewrite.
 * **The variant scaffolding is now gone**, which is the obligation DEC 2026-08-05g md.1 states
 * and the old docblock quoted at itself: two implementations never land together. Keeping the
 * loser would have left a one-line constant that repaints all 81 province maps with CI green
 * and no sample gate — `base-map-svg.test.ts` asserts nothing about fill or stroke.
 */
const TR_PAINT = { fill: PROVINCE_FILL, stroke: COLOR_TAUPE, strokeWidth: 0.8 } as const;

/* ── Localized strings (read from the catalogues, never inlined) ────────────────────── */

const MESSAGES = { tr: trMessages, en: enMessages } as const;

/** The OSM copyright page the drawn credit links to. */
const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

/* ── Producers ──────────────────────────────────────────────────────────────────────── */

/** Escape the five XML-significant characters. Attribution strings carry `©` and commas. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The Türkiye base silhouette.
 *
 * All 81 outlines are joined into ONE `<path>`: no province is nested inside another, and the
 * offshore islands are separate closed subpaths, so the default `nonzero` fill rule is
 * correct here and one element is cheaper than 81.
 */
export function buildTrBaseMapSvg(locale: Locale): string {
  const messages = MESSAGES[locale];
  const title = escapeXml(messages.Map.mapTitle);
  const credit = escapeXml(messages.Map.attribution);
  const paint = TR_PAINT;
  const d = PROVINCE_SHAPES.map((shape) => shape.d).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${MAP_VIEWBOX}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<desc>${credit}</desc>`,
    `<path d="${d}" fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}" stroke-linejoin="round"/>`,
    // The drawn ODbL credit. `text-anchor="end"` right-aligns it into the measured empty
    // corner; `font-size` is in viewBox units, so it reads at ~16 px when the file is opened
    // on its own at natural width — which is the case this node exists for.
    // `rel` is spelled out because this is a hand-built string: `react/jsx-no-target-blank`
    // cannot see it, so the repo convention every JSX external link follows would otherwise
    // stop exactly here.
    `<a xlink:href="${OSM_COPYRIGHT_URL}" href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noopener noreferrer">`,
    `<text x="990" y="418" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="${COLOR_SLATE}">${credit}</text>`,
    `</a>`,
    `</svg>`,
  ].join("");
}

/**
 * The world base silhouette.
 *
 * Each country keeps its OWN `<path fill-rule="evenodd">`: enclave holes (Lesotho inside
 * South Africa, the Uzbek/Tajik exclaves inside Kyrgyzstan) are encoded as extra subpaths and
 * depend on that rule, so joining the 240 strings the way the Türkiye file does would fill
 * every enclave over.
 *
 * No drawn credit: Natural Earth is public domain (plan §3.3). The source is still named in
 * `<desc>`.
 */
export function buildWorldBaseMapSvg(locale: Locale): string {
  const messages = MESSAGES[locale];
  const title = escapeXml(messages.WorldMap.mapTitle);
  const credit = escapeXml(messages.WorldMap.attribution);
  const paths = COUNTRY_SHAPES.map(
    (shape) =>
      `<path d="${shape.d}" fill-rule="evenodd" fill="${PROVINCE_FILL}" stroke="${COLOR_TAUPE}" stroke-width="0.5" stroke-linejoin="round"/>`,
  ).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORLD_MAP_VIEWBOX}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<desc>${credit}</desc>`,
    `<rect width="100%" height="100%" fill="${MAP_SEA}"/>`,
    paths,
    `</svg>`,
  ].join("");
}

/**
 * The response every base-map route returns.
 *
 * `max-age=604800` (7 days), plain — NOT a content-hashed filename with `immutable`. Hashing
 * is technically superior and was rejected on purpose (→ DEC 2026-08-08a md.2): it would add
 * a dynamic segment to the route, and the artifacts have not changed since PR #39 (measured:
 * `git log` over `lib/map/` is empty across the whole range). The staleness window is an
 * ACCEPTED risk (plan R3), not a closed one.
 *
 * ## These responses are NOT compressed, and that is a deferral, not an oversight
 *
 * Measured on `next start`: with `Accept-Encoding: gzip` an HTML page from this same server
 * comes back `Content-Encoding: gzip` while this route does not, so Next's own compression
 * does not cover app-route responses. The world file is 208,324 B where gzip gives 58,293 B.
 *
 * It is not fixed here because it cannot be fixed here *correctly*. The route is
 * `force-static`, so the body is written at build with no access to the request's
 * `Accept-Encoding`; gzipping it would mean sending `Content-Encoding: gzip` to every client
 * including one that never asked, permanently, on a public asset URL. Compression negotiation
 * belongs to the serving layer, every mainstream host compresses `image/svg+xml` by default,
 * and this repo has no hosting decision yet (ENGINEERING §6). The measurement is recorded here
 * so whoever makes that decision inherits the number instead of rediscovering it.
 */
export function baseMapResponse(svg: string): Response {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // The document itself stays sandboxed and never content-sniffed. Türkiye's drawn credit
      // is a fixed, escaped OSM URL with target=_blank; allow only that user-activated popup
      // and let the trusted destination escape the inherited crippled sandbox. The stricter
      // flag response has no links and deliberately keeps a bare sandbox.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox allow-popups allow-popups-to-escape-sandbox",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
