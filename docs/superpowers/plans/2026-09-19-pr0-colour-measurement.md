# PR0 — Colour Measurement Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dark mode measurable — teach `lib/theme/contrast.ts` to read the oklch values the `.dark` palette is authored in, and add the two instruments (CIEDE2000, CVD simulation) that T-031c/d and T-033 will quote their figures from.

**Architecture:** Three pure, dependency-free modules under `lib/theme/`. `contrast.ts` gains a colour parser that dispatches hex vs oklch behind its existing public API; `delta-e.ts` and `cvd.ts` are new and standalone. No product file changes in this branch — the payoff is a test that measures the shipped `--region-*` set and pins the floor T-031d has to match.

**Tech Stack:** TypeScript strict + `noUncheckedIndexedAccess`, vitest (node env, no jsdom), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-dark-mode-and-build-integrity-design.md` (§2.4, §4)

## Global Constraints

- Branch off `dev`: `feature/pr0-colour-measurement`. Never push to `main`.
- `pnpm typecheck && pnpm lint && pnpm test` green before every commit. Never weaken or skip a test to go green.
- Tests are co-located `*.test.ts` next to the module. Vitest does not run anything under `app/`.
- No new dependency. Every matrix and constant in this plan is written out in full below.
- Conventional Commits; the commitlint hook rejects anything else.
- Do **not** run `git worktree add` in this repo, and do not symlink `node_modules`.
- Every number a test asserts in this plan was computed and verified before the plan was written. If an implementation produces a different number, the implementation is wrong — do not re-pin the constant to whatever the code happens to emit.

---

### Task 1: oklch input for `contrast.ts`

`app/globals.css`'s `.dark` block mixes syntaxes — `--card: #121e21` beside `--primary: oklch(0.65 0.13 40.65)`. `parseHex` throws on the second, so today the only way to get a dark-mode ratio is to read resolved values out of a browser, which `app/globals.css` says in its own comment is what was done. This task removes that workaround.

**Files:**

- Modify: `lib/theme/contrast.ts` (`parseHex` at :15-32, `relativeLuminance` at :35, `blendOver` at :67)
- Test: `lib/theme/contrast.test.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces: `parseColor(css: string): readonly [number, number, number]` — module-private, returns sRGB 0-255. The exported signatures of `relativeLuminance`, `contrastRatio`, `ratio` and `blendOver` do not change; they simply accept a wider set of strings. Task 3 and Task 4 both call `parseColor` indirectly through the exported functions, never directly.

- [ ] **Step 1: Write the failing test**

Append to `lib/theme/contrast.test.ts`:

```ts
describe("oklch input", () => {
  it("resolves the two achromatic endpoints to pure white and pure black", () => {
    expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 6);
    expect(relativeLuminance("oklch(0 0 0)")).toBe(0);
  });

  it("gives the published maximum for oklch white on oklch black", () => {
    expect(ratio("oklch(1 0 0)", "oklch(0 0 0)")).toBe(21);
  });

  it("measures a real .dark brand token against a real .dark surface", () => {
    // --primary and --background, both copied from app/globals.css's .dark block.
    // This is the query the module could not answer before: one oklch, one hex.
    expect(ratio("oklch(0.65 0.13 40.65)", "#0b1416")).toBe(5.47);
  });

  it("measures the warning token on the card surface it is actually used over", () => {
    expect(ratio("oklch(0.75 0.13 75)", "#121e21")).toBe(7.53);
  });

  it("still rejects a string that is neither hex nor oklch", () => {
    expect(() => relativeLuminance("rebeccapurple")).toThrow(/hex or oklch/);
  });

  it("blends an oklch fill over a hex backdrop", () => {
    // 100% of the fill is the fill, whatever syntax it arrived in.
    expect(blendOver("oklch(1 0 0)", 1, "#000000")).toBe("#ffffff");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/theme/contrast.test.ts -t "oklch input"`

Expected: FAIL. The first assertion throws `Not a 6-digit sRGB hex: oklch(1 0 0)`.

- [ ] **Step 3: Write the implementation**

In `lib/theme/contrast.ts`, keep `parseHex` exactly as it is and add beside it:

```ts
/**
 * oklch(L C H) to sRGB 0-255.
 *
 * `.dark` authors its brand values in oklch, so a module that only read hex could not measure
 * the half of the palette that most needed measuring. The conversion is Ottosson's oklab:
 * oklch to oklab (polar to cartesian), oklab to linear sRGB through the two published
 * matrices, then the sRGB transfer function.
 *
 * Out-of-gamut components are clamped, which is what a browser does when it paints one.
 */
function parseOklch(css: string): readonly [number, number, number] {
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(css.trim());
  if (match === null) throw new Error(`Not a hex or oklch colour: ${css}`);
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

  const encode = (channel: number): number => {
    const c = Math.min(1, Math.max(0, channel));
    const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
  };

  return [encode(linear[0]!), encode(linear[1]!), encode(linear[2]!)] as const;
}

/** Accepts either syntax this codebase authors colours in. */
function parseColor(css: string): readonly [number, number, number] {
  return /^oklch\(/i.test(css.trim()) ? parseOklch(css) : parseHex(css);
}
```

Then change the two call sites that face the outside world:

- `relativeLuminance`: `const [r, g, b] = parseHex(hex);` becomes `const [r, g, b] = parseColor(hex);`
- `blendOver`: both `parseHex(fill)` and `parseHex(over)` become `parseColor(...)`.

Finally, widen `parseHex`'s error so a non-colour string reports the real contract:

```ts
throw new Error(`Not a hex or oklch colour: ${hex}`);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/theme/contrast.test.ts`

Expected: PASS, including every pre-existing hex test — the hex path is untouched, and that is the point of routing through a dispatcher rather than rewriting `parseHex`.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`

Expected: 0 errors, 0 problems. `noUncheckedIndexedAccess` is on, which is why every destructured match group and array index above carries a `!`.

- [ ] **Step 6: Commit**

```bash
git add lib/theme/contrast.ts lib/theme/contrast.test.ts
git commit -m "feat(theme): read oklch in the contrast helper

.dark authors its brand values in oklch and parseHex threw on them, so
dark-mode ratios had to be read out of a browser. Both syntaxes now go
through one dispatcher; the hex path is unchanged."
```

---

### Task 2: CIEDE2000 colour difference

WCAG contrast ratio answers "can I read this text on that surface". It does not answer "are these two map fills tellable apart", and using it for the second question is how this plan nearly shipped an assertion that could never pass: 20 of the 21 pairs of the shipped `--region-*` set are already below 3:1, worst 1.02:1. Categorical separation needs a colour-difference metric.

**Files:**

- Create: `lib/theme/delta-e.ts`
- Test: `lib/theme/delta-e.test.ts`

**Interfaces:**

- Consumes: `parseHex`/`parseOklch` behind `parseColor` from Task 1. This module needs sRGB triples and must not grow a second parser, so Task 1's `parseColor` is **exported** as part of this task.
- Produces:
  - `parseColor(css: string): readonly [number, number, number]` — now exported from `lib/theme/contrast.ts`.
  - `deltaE00(a: string, b: string): number` from `lib/theme/delta-e.ts`, taking two CSS colour strings (hex or oklch), returning CIEDE2000 rounded to one decimal.
  - `CATEGORICAL_MIN = 10` from `lib/theme/delta-e.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/theme/delta-e.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";

describe("deltaE00", () => {
  it("is zero for a colour against itself", () => {
    expect(deltaE00("#0072b2", "#0072b2")).toBe(0);
  });

  it("is order-independent", () => {
    expect(deltaE00("#0072b2", "#e69f00")).toBe(deltaE00("#e69f00", "#0072b2"));
  });

  it("separates black and white by the largest difference in the space", () => {
    expect(deltaE00("#000000", "#ffffff")).toBe(100);
  });

  it("reads the oklch syntax too, through the shared parser", () => {
    expect(deltaE00("oklch(1 0 0)", "#ffffff")).toBe(0);
  });

  it("rates two Okabe-Ito tints far apart even though their luminances nearly match", () => {
    // ege / akdeniz measure 1.02:1 in WCAG terms — all but identical by luminance.
    // Colour difference is the instrument that sees them as distinct.
    expect(deltaE00("#e69f00", "#56b4e9")).toBeGreaterThan(CATEGORICAL_MIN);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/theme/delta-e.test.ts`

Expected: FAIL — `Cannot find module './delta-e'`.

- [ ] **Step 3: Export `parseColor` from `contrast.ts`**

Change the declaration added in Task 1 from `function parseColor` to:

```ts
/**
 * Accepts either syntax this codebase authors colours in.
 *
 * Exported because `delta-e.ts` and `cvd.ts` need the same contract and a second parser is
 * exactly the shape this repo has been bitten by: two readers of one notation that nothing
 * compares.
 */
export function parseColor(css: string): readonly [number, number, number] {
```

- [ ] **Step 4: Write the implementation**

Create `lib/theme/delta-e.ts`:

```ts
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
 * Chosen from measurement, not convention: the shipped Okabe-Ito set's worst pair is 11.1
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
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run lib/theme/delta-e.test.ts lib/theme/contrast.test.ts`

Expected: PASS. Both files — exporting `parseColor` must not disturb Task 1's suite.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add lib/theme/delta-e.ts lib/theme/delta-e.test.ts lib/theme/contrast.ts
git commit -m "feat(theme): add CIEDE2000 for categorical colour separation

A contrast ratio is a luminance relationship and cannot say whether two
map fills are tellable apart. 20 of the 21 shipped region-tint pairs sit
below 3:1 while being perfectly legible, which is what a qualitative set
looks like measured with the wrong instrument."
```

---

### Task 3: CVD simulation

**Files:**

- Create: `lib/theme/cvd.ts`
- Test: `lib/theme/cvd.test.ts`

**Interfaces:**

- Consumes: `parseColor` from `lib/theme/contrast.ts` (Task 2 exported it).
- Produces:
  - `type Vision = "normal" | "protanopia" | "deuteranopia" | "tritanopia"` from `lib/theme/cvd.ts`
  - `VISIONS: readonly Vision[]` — all four, for `it.each` loops in Task 4.
  - `simulate(css: string, vision: Vision): string` — returns a 6-digit sRGB hex, so its output feeds straight back into `deltaE00` and `ratio`.

- [ ] **Step 1: Write the failing test**

Create `lib/theme/cvd.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { simulate, VISIONS } from "./cvd";
import { deltaE00 } from "./delta-e";

describe("simulate", () => {
  it("returns normal vision unchanged, in hex", () => {
    expect(simulate("#0072b2", "normal")).toBe("#0072b2");
  });

  it("normalises oklch input to hex on the way out", () => {
    expect(simulate("oklch(1 0 0)", "normal")).toBe("#ffffff");
  });

  it("leaves the achromatic axis alone under every simulation", () => {
    // Grey has no chroma to lose, so a correct matrix is near-identity on it. This is the
    // control that catches a transposed matrix: a transposed one tints grey.
    for (const vision of VISIONS) {
      expect(deltaE00(simulate("#808080", vision), "#808080")).toBeLessThan(2);
    }
  });

  it("actually collapses red against green for the red-green deficiencies", () => {
    // The positive control. A simulate() that returned its input would pass every assertion
    // in Task 4 while proving nothing, so one test has to show the transform doing work.
    const apart = deltaE00("#d55e00", "#009e73");
    expect(
      deltaE00(simulate("#d55e00", "protanopia"), simulate("#009e73", "protanopia")),
    ).toBeLessThan(apart);
    expect(
      deltaE00(simulate("#d55e00", "deuteranopia"), simulate("#009e73", "deuteranopia")),
    ).toBeLessThan(apart);
  });

  it("names exactly the four visions the palette is checked against", () => {
    expect([...VISIONS]).toEqual(["normal", "protanopia", "deuteranopia", "tritanopia"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/theme/cvd.test.ts`

Expected: FAIL — `Cannot find module './cvd'`.

- [ ] **Step 3: Write the implementation**

Create `lib/theme/cvd.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/theme/cvd.test.ts`

Expected: PASS, all six.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add lib/theme/cvd.ts lib/theme/cvd.test.ts
git commit -m "feat(theme): simulate the three dichromacies

globals.css claimed a simulation ran before ship but no matrix, number or
test was ever committed. This is the missing instrument, with a control
that fails if the transform silently returns its input."
```

---

### Task 4: Pin the shipped region palette

The payoff. Everything above is machinery; this is the assertion that makes T-031d's dark set answerable to a number instead of to taste.

**Files:**

- Create: `lib/theme/region-palette.test.ts`

**Interfaces:**

- Consumes: `deltaE00`, `CATEGORICAL_MIN` from `lib/theme/delta-e.ts`; `simulate`, `VISIONS`, `Vision` from `lib/theme/cvd.ts`.
- Produces: `REGION_TINTS` — exported from the test file so T-031d's dark-set test can import the light set it has to match. (Test files exporting a fixture is the pattern `token-binding.test.ts` already uses.)

- [ ] **Step 1: Write the test**

Create `lib/theme/region-palette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";

/**
 * The seven `--region-*` tints exactly as `app/globals.css` defines them.
 *
 * Duplicated here rather than parsed out of the stylesheet on purpose: this is the set the
 * assertion below is ABOUT, so a change to globals.css should make this file disagree loudly
 * rather than quietly re-measure whatever it now says.
 */
export const REGION_TINTS: Readonly<Record<string, string>> = {
  marmara: "#0072b2",
  ege: "#e69f00",
  akdeniz: "#56b4e9",
  "ic-anadolu": "#f0e442",
  karadeniz: "#cc79a7",
  "dogu-anadolu": "#009e73",
  "guneydogu-anadolu": "#d55e00",
};

const PAIRS: readonly (readonly [string, string])[] = Object.keys(REGION_TINTS).flatMap(
  (a, i, all) => all.slice(i + 1).map((b) => [a, b] as const),
);

/** Worst pair per vision, measured 2026-09-19 on the shipped set. */
const WORST: Readonly<Record<Vision, number>> = {
  normal: 21.7,
  protanopia: 12.3,
  deuteranopia: 11.5,
  tritanopia: 11.1,
};

describe("the seven region tints are a usable categorical set", () => {
  it("has 21 pairs — the whole set is compared, not a sample", () => {
    expect(PAIRS).toHaveLength(21);
  });

  it.each(VISIONS)("holds the categorical floor under %s", (vision) => {
    for (const [a, b] of PAIRS) {
      const seen = deltaE00(simulate(REGION_TINTS[a]!, vision), simulate(REGION_TINTS[b]!, vision));
      expect(
        seen,
        `${a} / ${b} under ${vision} measured ${seen}, floor is ${CATEGORICAL_MIN}`,
      ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
    }
  });

  it.each(VISIONS)("still has exactly the recorded worst pair under %s", (vision) => {
    const worst = Math.min(
      ...PAIRS.map(([a, b]) =>
        deltaE00(simulate(REGION_TINTS[a]!, vision), simulate(REGION_TINTS[b]!, vision)),
      ),
    );
    // Pinned, not floored: a change that IMPROVES the set should also have to be noticed and
    // re-recorded, because these four numbers are the target T-031d's dark set has to match.
    expect(worst).toBe(WORST[vision]);
  });

  it("fails the floor for a set that genuinely collapses — positive control", () => {
    // Two blues a dichromat cannot separate. If the assertion above were vacuous (a broken
    // deltaE00 returning something huge, a simulate() that no-ops), this would pass too.
    const collapsed = deltaE00(
      simulate("#0072b2", "deuteranopia"),
      simulate("#0082c8", "deuteranopia"),
    );
    expect(collapsed).toBeLessThan(CATEGORICAL_MIN);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run lib/theme/region-palette.test.ts`

Expected: PASS. Unlike Tasks 1-3 this one is green on first run by design — it measures a palette that already shipped. Its job is to hold the numbers, not to drive a change.

If any `WORST` value disagrees, **stop**. Either a matrix was transcribed wrong or `globals.css` moved; do not edit the constant to match the output.

- [ ] **Step 3: Confirm the positive control is load-bearing**

Temporarily change `simulate` to `return hex([r8, g8, b8]);` for every vision (a no-op simulation), then:

Run: `pnpm vitest run lib/theme/region-palette.test.ts`

Expected: FAIL — the three non-`normal` "worst pair" assertions and the positive control all break. Revert the edit and re-run to green.

This step is the whole point of the branch: it is how you know the suite would notice a simulation that stopped simulating.

- [ ] **Step 4: Typecheck, lint, full suite, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add lib/theme/region-palette.test.ts
git commit -m "test(theme): pin the region palette's CVD separation

Four measured worst-case figures, pinned rather than floored, so a dark
set that scores worse than the light one it replaces cannot land quietly."
```

---

### Task 5: Record the instrument split in `docs/design.md`

Without this, the next person reaches for `contrastRatio` on a categorical set — which is exactly the mistake this branch was written to stop, and it was nearly made while writing the spec.

**Files:**

- Modify: `docs/design.md` (the "Data-viz colour doctrine" section, rule 3)

**Interfaces:**

- Consumes: the three modules from Tasks 1-3.
- Produces: nothing code-facing.

- [ ] **Step 1: Amend rule 3 of the doctrine**

Replace the existing rule 3 line:

```markdown
3. Colourblind-safe by construction; reinforce hue with lightness, shape, label or pattern.
   Simulate deuteranopia / protanopia / tritanopia before shipping a new palette.
```

with:

```markdown
3. Colourblind-safe by construction; reinforce hue with lightness, shape, label or pattern.
   Simulate deuteranopia / protanopia / tritanopia before shipping a new palette —
   `lib/theme/cvd.ts` does it, and `lib/theme/region-palette.test.ts` is the worked example.
   **Measure categorical separation with `deltaE00` (`lib/theme/delta-e.ts`), never with a
   contrast ratio.** A ratio is a luminance relationship: 20 of the 21 pairs in the shipped
   Okabe-Ito region set sit below 3:1 and the set is fine. Contrast ratio keeps text, focus
   rings, and adjacent steps of an ordered ramp.
```

- [ ] **Step 2: Note that oklch is now measurable**

In the "Dark mode — Night Sea" section, the bullet beginning "Every value in `.dark` is measured" ends with a sentence about `blendOver`. Append to that bullet:

```markdown
`contrast.ts` reads oklch as well as hex since PR0, so a `.dark` figure is computed from the
authored value rather than read back out of a browser.
```

- [ ] **Step 3: Commit**

```bash
git add docs/design.md
git commit -m "docs(design): say which instrument measures which question"
```

---

## Branch close

- [ ] `pnpm typecheck && pnpm lint && pnpm test` — green, and the test count has grown by this branch's cases with nothing else moving.
- [ ] No product file outside `lib/theme/` and `docs/design.md` appears in `git diff dev...HEAD --name-only`. PR0 changes no rendering.
- [ ] Open the PR to `dev` (squash), titled `PR0: colour measurement layer (oklch, CIEDE2000, CVD)`.
- [ ] On merge, T-048, T-033 and T-031c may start in parallel.
