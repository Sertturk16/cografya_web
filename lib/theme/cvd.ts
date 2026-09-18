/**
 * Colour-vision-deficiency simulation, so a palette's CVD safety is measured rather than
 * asserted from the reputation of the set it was drawn from.
 *
 * Machado, Oliveira and Fernandes (2009), severity 1.0. The matrices operate on LINEAR sRGB,
 * not on gamma-encoded bytes; applying them to the encoded values is the classic way to get a
 * simulation that looks plausible and measures wrong.
 */
import { parseColor } from "./contrast";

export type Vision = "normal" | "protanopia" | "deuteranopia" | "tritanopia";

/** Every vision a categorical palette is checked against, in the order results are reported. */
export const VISIONS: readonly Vision[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
] as const;

type Matrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const MATRICES: Readonly<Record<Exclude<Vision, "normal">, Matrix>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const toLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const toByte = (linear: number): number => {
  const c = Math.min(1, Math.max(0, linear));
  const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
};

const hex = (rgb: readonly [number, number, number]): string =>
  `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/** A CSS colour as that vision would see it, always returned as a 6-digit sRGB hex. */
export function simulate(css: string, vision: Vision): string {
  const [r8, g8, b8] = parseColor(css);
  if (vision === "normal") return hex([r8, g8, b8]);

  const linear = [toLinear(r8), toLinear(g8), toLinear(b8)] as const;
  const m = MATRICES[vision];
  const out = m.map((row) => toByte(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]));

  return hex([out[0]!, out[1]!, out[2]!]);
}
