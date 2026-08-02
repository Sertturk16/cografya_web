import { describe, expect, it } from "vitest";
import { encodePath } from "../../scripts/lib/path-encode.mjs";

/**
 * Direct round-trip proof for the relative path encoder, against SYNTHETIC input — the one
 * check the artifact-level tests cannot provide. `world-shapes.test.ts` only decodes what the
 * encoder already produced; the CI drift gate only proves determinism. Neither would notice
 * the exact trap `path-encode.mjs`'s header warns about: the naive
 * `dx = round(x[i]) - round(x[i-1])` cursor, whose rounding error random-walks along a
 * coastline and visibly separates two neighbouring borders — undoing precisely what
 * `map-topology.mjs` guarantees — while every syntax/structure assertion stays green
 * (PR #35 review I4).
 *
 * The input is built to make drift measurable: hundreds of consecutive sub-unit steps whose
 * fractional parts (0.13, 0.077) never land on the 0.1 quantum, so a naive delta encoder
 * accumulates ~0.03/vertex and ends several whole units off after 400 vertices. The correct
 * encoder must reproduce every vertex at exactly `round(v * 10) / 10`.
 */

/** Minimal independent decoder for the `M`/`m`/`l`/`Z` subset the encoder emits. */
function decode(d: string): [number, number][][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const subpaths: [number, number][][] = [];
  let current: [number, number][] | null = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command: string | null = null;
  let i = 0;
  const next = () => {
    const raw = tokens[i++];
    const value = raw === undefined ? Number.NaN : Number.parseFloat(raw);
    if (Number.isNaN(value)) throw new Error(`Expected a number at token ${i - 1}`);
    return value;
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (token !== undefined && /[A-Za-z]/.test(token)) {
      command = token;
      i++;
    }
    if (command === "Z") {
      x = startX;
      y = startY;
      command = null;
      continue;
    }
    if (command === "M" || command === "m") {
      const a = next();
      const b = next();
      x = command === "M" ? a : x + a;
      y = command === "M" ? b : y + b;
      startX = x;
      startY = y;
      current = [[x, y]];
      subpaths.push(current);
      command = command === "M" ? "L" : "l";
      continue;
    }
    if (command === "l" || command === "L") {
      const a = next();
      const b = next();
      x = command === "L" ? a : x + a;
      y = command === "L" ? b : y + b;
      current?.push([x, y]);
      continue;
    }
    throw new Error(`Unsupported command "${command}"`);
  }
  return subpaths;
}

const quantise = (v: number) => Math.round(v * 10) / 10;

describe("encodePath", () => {
  it("round-trips every vertex to the 0.1 quantum with zero accumulated drift", () => {
    const coastline: [number, number][] = [];
    for (let i = 0; i < 400; i++) {
      coastline.push([10 + i * 0.13, 20 + Math.sin(i / 7) * 5 + i * 0.077]);
    }
    const islet: [number, number][] = [
      [-3.14, -2.71],
      [-3.04, -2.71],
      [-3.04, -2.61],
      [-3.14, -2.61],
    ];

    const d = encodePath([coastline, islet], { decimals: 1 });
    const decoded = decode(d);
    const expected = [coastline, islet].map((subpath) =>
      subpath.map(([x, y]) => [quantise(x), quantise(y)] as const),
    );

    expect(decoded.length).toBe(expected.length);
    decoded.forEach((subpath, s) => {
      const want = expected[s];
      expect(subpath.length).toBe(want?.length);
      subpath.forEach(([x, y], v) => {
        // toBeCloseTo(…, 9): the decoder accumulates float additions of exact 0.1-quantum
        // deltas, so representation error is ~1e-13 — while naive-cursor drift would be
        // whole units by the end of the ring. Nothing in between can hide here.
        expect(x).toBeCloseTo(want?.[v]?.[0] ?? Number.NaN, 9);
        expect(y).toBeCloseTo(want?.[v]?.[1] ?? Number.NaN, 9);
      });
    });
  });

  it("drops only vertices that quantise onto the cursor, never real ones", () => {
    // Consecutive vertices closer than half a quantum collapse (drawing them changes no
    // pixel); everything else must survive. Guards the boundary of the dropping rule.
    const ring: [number, number][] = [
      [0, 0],
      [0.04, 0.04], // quantises onto the cursor → dropped
      [0.2, 0],
      [0.2, 0.2],
    ];
    const decoded = decode(encodePath([ring], { decimals: 1 }));
    expect(decoded).toEqual([
      [
        [0, 0],
        [0.2, 0],
        [0.2, 0.2],
      ],
    ]);
  });
});
