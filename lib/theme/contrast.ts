/**
 * WCAG 2.x contrast maths, as pure functions.
 *
 * A palette value without its measurement is how a contrast failure gets reintroduced, so
 * every token this repo tunes carries its ratios in a comment beside it (see
 * `--color-success` and `--game-hover-edge` in `app/globals.css`). This module is what
 * produces those numbers, so they are computed rather than recalled.
 */

/**
 * sRGB byte to linear-light, 0-1.
 *
 * Shared by `contrast.ts`, `delta-e.ts` and `cvd.ts` — all three colour instruments need the
 * same decode, and three independent copies is exactly the shape that drifts unnoticed.
 *
 * The knee is 0.04045, the sRGB spec's literal value (WCAG 2.x's literal value is 0.03928).
 * The two are equivalent over 8-bit input: no integer channel byte (0-255) has c = channel/255
 * fall between them, so every byte takes the same branch under either knee.
 */
export function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear-light 0-1 to an sRGB byte, the inverse of `toLinear`. Out-of-range input is clamped. */
export function toByte(linear: number): number {
  const c = Math.min(1, Math.max(0, linear));
  const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
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
    throw new Error(`Not a hex, oklch or lab colour: ${hex}`);
  }
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ] as const;
}

/**
 * oklch(L C H) to sRGB 0-255.
 *
 * `.dark` authors its brand values in oklch, so a module that only read hex could not measure
 * the half of the palette that most needed measuring. The conversion is Ottosson's oklab:
 * oklch to oklab (polar to cartesian), oklab to linear sRGB through the two published
 * matrices, then the sRGB transfer function.
 *
 * Out-of-gamut components are clamped, which is what a browser does when it paints one.
 *
 * Accepted subset: space-separated `L C H`, with an optional `%` on L only — no alpha (the
 * `/ A` suffix), no commas, no `deg` on H, no negative hue. `oklch(1 0 0 / 10%)`, which
 * `app/globals.css` authors for `--sidebar-border`, is outside this subset and throws.
 */
function parseOklch(css: string): readonly [number, number, number] {
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(css.trim());
  if (match === null) throw new Error(`Not a hex, oklch or lab colour: ${css}`);
  const [, rawL, rawC, rawH] = match;
  const L = rawL!.endsWith("%") ? Number.parseFloat(rawL!) / 100 : Number.parseFloat(rawL!);
  const C = Number.parseFloat(rawC!);
  const hRad = (Number.parseFloat(rawH!) * Math.PI) / 180;

  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear: readonly number[] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return [toByte(linear[0]!), toByte(linear[1]!), toByte(linear[2]!)] as const;
}

/**
 * CIE `lab(L a b)` to sRGB 0-255.
 *
 * THE SYNTAX A BROWSER HANDS BACK, which is why it is here and not only the two this repo
 * authors. `getComputedStyle` does not echo `oklch(…)`: Chrome serializes a resolved oklch
 * colour as `lab(73.7049 29.9329 29.6267)`. So every instrument that measures what a page
 * ACTUALLY PAINTS — rather than what a token declares — met this notation the moment `.dark`
 * started authoring brand values in oklch, and a parser that rejected it fell back silently to
 * the declaration. T-033 task 8 is where that was caught: a whole dark column of readings was
 * taken from `app/globals.css` while the harness recorded `null` for the resolved ink beside it.
 * The two agreed to within 0.12 when it was checked by hand, which is exactly the kind of
 * agreement that has to be MEASURED rather than assumed.
 *
 * CSS Color 4's `lab()` is CIE Lab against the **D50** white point, not D65 — the single thing
 * an implementation of this gets wrong. The chain is therefore Lab → XYZ(D50) → XYZ(D65) via
 * the spec's Bradford matrix → linear sRGB → the transfer function in `toByte`. Skipping the
 * adaptation shifts a saturated colour by several bytes and, worse, does it in a direction that
 * still looks plausible.
 *
 * Out-of-gamut components are clamped, which is what a browser does when it paints one.
 *
 * Accepted subset, matching `parseOklch`'s: space-separated `L a b`, with an optional `%` on L
 * only, and NO alpha (the `/ A` suffix) — a translucent colour has no contrast of its own and
 * belongs in `blendOver` with its backdrop named.
 */
function parseLab(css: string): readonly [number, number, number] {
  const match = /^lab\(\s*(-?[\d.]+%?)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i.exec(css.trim());
  if (match === null) throw new Error(`Not a hex, oklch or lab colour: ${css}`);
  const [, rawL, rawA, rawB] = match;
  const L = Number.parseFloat(rawL!);
  const a = Number.parseFloat(rawA!);
  const b = Number.parseFloat(rawB!);

  // CIE Lab inverse, with the spec's exact rational constants rather than the 0.008856/903.3
  // decimal approximations — same reasoning as the sRGB knee above.
  const EPSILON = 216 / 24389;
  const KAPPA = 24389 / 27;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const finv = (t: number) => (t ** 3 > EPSILON ? t ** 3 : (116 * t - 16) / KAPPA);

  // D50 reference white, the CSS Color 4 values.
  const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585] as const;
  const x = finv(fx) * D50[0];
  const y = (L > KAPPA * EPSILON ? fy ** 3 : L / KAPPA) * D50[1];
  const z = finv(fz) * D50[2];

  // Bradford chromatic adaptation D50 → D65, then XYZ(D65) → linear sRGB. Both matrices are
  // CSS Color 4's own.
  const x65 = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z;
  const y65 = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z;
  const z65 = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z;

  const linear: readonly number[] = [
    (12831 / 3959) * x65 + (-329 / 214) * y65 + (-1974 / 3959) * z65,
    (-851781 / 878810) * x65 + (1648619 / 878810) * y65 + (36519 / 878810) * z65,
    (705 / 12673) * x65 + (-2585 / 12673) * y65 + (705 / 667) * z65,
  ];

  return [toByte(linear[0]!), toByte(linear[1]!), toByte(linear[2]!)] as const;
}

/**
 * Accepts every syntax a colour reaches this module in: the two this codebase AUTHORS (hex and
 * `oklch()`), and the one a BROWSER hands back for the second of those (`lab()`).
 *
 * Exported because `delta-e.ts` and `cvd.ts` need the same contract and a second parser is
 * exactly the shape this repo has been bitten by: two readers of one notation that nothing
 * compares. That is also why `lab()` landed here rather than in the measurement harness that
 * first needed it — a harness-local converter is the second reader.
 */
export function parseColor(css: string): readonly [number, number, number] {
  const trimmed = css.trim();
  if (/^oklch\(/i.test(trimmed)) return parseOklch(trimmed);
  if (/^lab\(/i.test(trimmed)) return parseLab(trimmed);
  return parseHex(trimmed);
}

/** WCAG 2.x relative luminance of an sRGB hex or oklch colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseColor(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio between two sRGB hexes or oklch colours. Always >= 1, order-independent. */
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
 * @param fill   the translucent colour, as an sRGB hex or oklch
 * @param alpha  0-1
 * @param over   the opaque backdrop, as an sRGB hex or oklch
 */
export function blendOver(fill: string, alpha: number, over: string): string {
  if (alpha < 0 || alpha > 1) throw new Error(`alpha out of range: ${alpha}`);
  const [r1, g1, b1] = parseColor(fill);
  const [r2, g2, b2] = parseColor(over);
  const mix = (a: number, b: number) =>
    Math.round(a * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}

/** WCAG 2.1 floors. Graphical objects and large text share the 3:1 bar (1.4.11 / 1.4.3). */
export const TEXT_MIN = 4.5;
export const GRAPHICAL_MIN = 3;
