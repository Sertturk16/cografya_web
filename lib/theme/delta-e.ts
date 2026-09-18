/**
 * CIEDE2000 colour difference.
 *
 * ## Why this exists beside `contrast.ts`
 *
 * A contrast RATIO is a luminance relationship: it answers "can this text be read on that
 * surface". A qualitative set answers a different question — "are these two fills tellable
 * apart" — and luminance is the wrong axis for it. The shipped seven-tint `--region-*` set is
 * the proof: 20 of its 21 pairs sit below 3:1, worst 1.02:1, and yet the set is perfectly
 * legible on a map because Okabe-Ito separates by hue and chroma.
 *
 * Use `contrast.ts` for text, for focus rings, and for adjacent steps of an ordered ramp.
 * Use this for categorical sets.
 */
import { parseColor } from "./contrast";

/**
 * The floor a categorical set has to clear, pairwise, under normal vision and all three CVD
 * simulations.
 *
 * Chosen from measurement, not convention: the shipped Okabe-Ito set's worst pair is 10.9
 * under tritanopia, so 10 is the value the current palette actually holds. A dark-adapted set
 * (T-031d) that scores below it is worse than what it replaces, and this constant is what
 * says so.
 */
export const CATEGORICAL_MIN = 10;

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** CIE Lab under a D65 white point, which is what sRGB is defined against. */
function toLab(css: string): readonly [number, number, number] {
  const [r8, g8, b8] = parseColor(css);
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);

  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;

  const f = (t: number): number =>
    t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)] as const;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** CIEDE2000 between two CSS colours, rounded to one decimal — the form it gets written down in. */
export function deltaE00(a: string, b: string): number {
  const lab1 = toLab(a);
  const lab2 = toLab(b);

  // Ensure canonical ordering for numerical stability; symmetric by design
  const [l1, a1, b1] = lab1[0] <= lab2[0] ? lab1 : lab2;
  const [l2, a2, b2] = lab1[0] <= lab2[0] ? lab2 : lab1;

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;

  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  const dhp = c1p * c2p === 0 ? 0 : ((h2p - h1p + 180) % 360) - 180;
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp) / 2);

  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBar: number;
  if (c1p * c2p === 0) hBar = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hBar = (h1p + h2p) / 2;
  else hBar = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos(rad(hBar - 30)) +
    0.24 * Math.cos(rad(2 * hBar)) +
    0.32 * Math.cos(rad(3 * hBar + 6)) -
    0.2 * Math.cos(rad(4 * hBar - 63));

  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;
  const rT =
    -2 *
    Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7)) *
    Math.sin(rad(60 * Math.exp(-(((hBar - 275) / 25) ** 2))));

  const raw = Math.sqrt(
    (dLp / sL) ** 2 + (dCp / sC) ** 2 + (dHp / sH) ** 2 + rT * (dCp / sC) * (dHp / sH),
  );
  return Math.round(raw * 10) / 10;
}
