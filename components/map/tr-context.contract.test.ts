import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { assertInsideContextFrame } from "../../scripts/lib/tr-frame.mjs";

/**
 * NEW GUARD — the geographic-context paint stack (`turkiye-yenileme` PR-B, plan §11 item 11).
 *
 * `TurkeyMapSection` is an async server component that reaches `getTranslations` and the api,
 * and the repo runs a single `node` vitest environment with no jsdom — the same constraint
 * every sibling guard in this directory documents (`map-layers.test.ts`,
 * `inland-water-layer.contract.test.ts`, `turkey-map-credit.placement.test.ts`). A source
 * invariant is the honest version of the same guard: it runs today, costs nothing, and fails
 * on the exact edit it is meant to stop. It does NOT claim to prove what the DOM ends up
 * looking like — the empirical half is the PR's own rendered-sample matrix and occlusion probe.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip block comments and whole-line `//` comments — this file's own prose quotes every
 *  marker below verbatim, so an unstripped scan would pass on a rule that exists only in a
 *  note (the same reason every sibling guard in this directory strips first). */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const SOURCE = code(sourceOf("./turkey-map-section.tsx"));

/** The source of ONE `data-map-layer` group: its marker attribute up to the next marker, or
 *  end of file — the same helper `map-layers.test.ts` uses for the province layers. */
function layerBlock(source: string, name: string): string {
  const start = source.indexOf(`data-map-layer="${name}"`);
  expect(start, `data-map-layer="${name}" not found`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const next = rest.indexOf('data-map-layer="', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("turkey-map-section.tsx geographic context layers", () => {
  it("declares each of the three new groups exactly once, in plan §5.4's order", () => {
    for (const layer of ["context-casing", "context-land", "context-labels"] as const) {
      expect(SOURCE.match(new RegExp(`data-map-layer="${layer}"`, "g")) ?? []).toHaveLength(1);
    }
    const casing = SOURCE.indexOf('data-map-layer="context-casing"');
    const land = SOURCE.indexOf('data-map-layer="context-land"');
    const base = SOURCE.indexOf('data-map-layer="base"');
    const hit = SOURCE.indexOf('data-map-layer="hit"');
    const inlandWater = SOURCE.indexOf("<InlandWaterLayer");
    const labels = SOURCE.indexOf('data-map-layer="context-labels"');
    // casing → land → base (unchanged) → hit (unchanged) → InlandWaterLayer (unchanged,
    // still the last PAINTED layer) → labels (last of all).
    expect(casing).toBeLessThan(land);
    expect(land).toBeLessThan(base);
    expect(base).toBeLessThan(hit);
    expect(hit).toBeLessThan(inlandWater);
    expect(inlandWater).toBeLessThan(labels);
  });

  it("carries pointer-events: none on all three new groups, without exception", () => {
    // The groups reach `pointer-events: none` through their CSS class, not an inline style —
    // this is the source-level half of the guarantee; `map.module.css` carries the rule
    // itself, matched below.
    const casingBlock = layerBlock(SOURCE, "context-casing");
    const landBlock = layerBlock(SOURCE, "context-land");
    const labelsBlock = layerBlock(SOURCE, "context-labels");
    expect(casingBlock).toContain("styles.contextCasing");
    expect(landBlock).toContain("styles.contextLand");
    expect(labelsBlock).toContain("styles.contextLabels");

    const css = sourceOf("./map.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const cls of ["contextCasing", "contextLand", "contextLabels"]) {
      const bodies = [...css.matchAll(new RegExp(`\\.${cls}[,\\s{][^{]*\\{([^}]*)\\}`, "g"))].map(
        (m) => m[1] ?? "",
      );
      const declaresNone = bodies.some((body) => /pointer-events:\s*none/.test(body));
      expect(declaresNone, `.${cls} must declare "pointer-events: none" in map.module.css`).toBe(
        true,
      );
    }
  });

  it("adds no link, tab stop or hit-testing hook to any of the three new groups", () => {
    for (const layer of ["context-casing", "context-land", "context-labels"] as const) {
      const block = layerBlock(SOURCE, layer);
      expect(block).not.toMatch(/<a[\s>]/);
      expect(block).not.toMatch(/tabIndex/);
      expect(block).not.toMatch(/data-shape/);
    }
  });

  it("hides the two shape groups from assistive tech and leaves the label group visible to it", () => {
    // Plan §5.6: the shape groups are decorative (aria-hidden), the label group is real
    // geographic text and is NOT — hiding visible words from AT to keep a group tidy is the
    // wrong trade for fourteen country names and four sea names.
    expect(layerBlock(SOURCE, "context-casing")).toMatch(/aria-hidden="true"/);
    expect(layerBlock(SOURCE, "context-land")).toMatch(/aria-hidden="true"/);
    expect(layerBlock(SOURCE, "context-labels")).not.toMatch(/aria-hidden/);
  });

  it("sets the svg viewBox to the named TR_CONTEXT_VIEWBOX constant, never a literal", () => {
    expect(SOURCE).toContain("viewBox={TR_CONTEXT_VIEWBOX}");
    // No stray literal viewBox string (the old MAP_VIEWBOX value or the raw context frame
    // string) anywhere in the component.
    expect(SOURCE).not.toMatch(/viewBox="[-\d\s]+"/);
  });

  it("still renders <InlandWaterLayer /> after the hit layer", () => {
    const hit = SOURCE.indexOf('data-map-layer="hit"');
    const inlandWater = SOURCE.indexOf("<InlandWaterLayer");
    expect(hit).toBeGreaterThan(-1);
    expect(inlandWater).toBeGreaterThan(hit);
  });
});

describe("lib/map/tr-context.generated.ts artifact", () => {
  it("carries exactly the ISO join keys the frame clips to, each with a labelPoint/labelRadius", () => {
    expect(CONTEXT_SHAPES.length).toBeGreaterThan(0);
    for (const shape of CONTEXT_SHAPES) {
      expect(shape.iso).toMatch(/^[A-Z]{2}$/);
      expect(typeof shape.d).toBe("string");
      expect(shape.d.length).toBeGreaterThan(0);
      expect(Number.isFinite(shape.labelPoint.x)).toBe(true);
      expect(Number.isFinite(shape.labelPoint.y)).toBe(true);
      expect(shape.labelRadius).toBeGreaterThan(0);
    }
  });

  it("exports the same TR_CONTEXT_VIEWBOX string the component imports", () => {
    expect(typeof TR_CONTEXT_VIEWBOX).toBe("string");
    expect(TR_CONTEXT_VIEWBOX.split(" ")).toHaveLength(4);
  });

  it("keeps every shape inside the pinned TR_CONTEXT_FRAME", () => {
    // Re-parses each shape's `d` into points and re-runs the SAME assertion the generator
    // runs at build time — so a hand-edit of the committed artifact (bypassing the
    // generator entirely) is still caught here.
    for (const shape of CONTEXT_SHAPES) {
      const points: [number, number][] = [];
      const tokens = shape.d.match(/[MmLlZz]|-?\d*\.?\d+/g) ?? [];
      let i = 0;
      let x = 0;
      let y = 0;
      // `sx`/`sy` — the CURRENT subpath's start point. `path-encode.mjs`'s own encoder resets
      // its cursor to it on `Z` (SVG 1.1 §8.3.1: `Z` returns the cursor to the subpath's start),
      // so the NEXT subpath's relative `m` is measured from there, not from wherever the `l`
      // run left off. Skipping this reset was the first version of this test's own bug: it
      // read a real emitted point as ~9.5 u outside the frame that the generator's own
      // (correct) pre-encode check never saw, because the two cursors had silently diverged.
      let sx = 0;
      let sy = 0;
      while (i < tokens.length) {
        const t = tokens[i++];
        if (t === "M") {
          x = Number(tokens[i++]);
          y = Number(tokens[i++]);
          sx = x;
          sy = y;
          points.push([x, y]);
        } else if (t === "m") {
          x += Number(tokens[i++]);
          y += Number(tokens[i++]);
          sx = x;
          sy = y;
          points.push([x, y]);
        } else if (t === "l") {
          while (
            i < tokens.length &&
            tokens[i] !== "Z" &&
            tokens[i] !== "z" &&
            tokens[i] !== "M" &&
            tokens[i] !== "m" &&
            tokens[i] !== "l" &&
            !Number.isNaN(Number(tokens[i]))
          ) {
            x += Number(tokens[i++]);
            y += Number(tokens[i++]);
            points.push([x, y]);
          }
        } else if (t === "Z" || t === "z") {
          x = sx;
          y = sy;
        }
      }
      expect(() =>
        assertInsideContextFrame(points, { label: shape.iso, tolerance: 0.5 }),
      ).not.toThrow();
    }
  });

  it("shares no ISO join key with a province plate code", () => {
    const plateCodes = new Set(PROVINCE_SHAPES.map((shape) => shape.plateCode));
    for (const shape of CONTEXT_SHAPES) {
      expect(plateCodes.has(shape.iso)).toBe(false);
    }
  });
});

/**
 * PR #108 FIX ROUNDS 2–3 — the source-invariant half of the placement fixes (same honest
 * shape the file's top docblock names: this cannot re-derive the `isPointInFill()` geometric
 * result on its own no-jsdom `node` environment, but it DOES fail the moment a fixed value is
 * hand-reverted or drifts, which is the exact edit class that shipped round 1's own
 * regression — a docblock claiming a measurement the shipped constant no longer matched. The
 * empirical half (0% ink in both locales, both labels; exact segment-vs-rectangle clearance
 * from the CY row's ink box and from `seaMediterranean`'s ink box) is the PR's own re-run
 * `isPointInFill()`/`getBBox()`/segment-intersection pass against the live rendered page, at
 * both 768px and 1440px, reported in the PR.
 */
describe("PR #108 fix round 2 — AZ label size exception", () => {
  it("keeps AZ's fontSize-16 exception at the re-measured 0%-overlap position (x:1120/y:106/anchor:end)", () => {
    const azMatch = SOURCE.match(/AZ:\s*\{([^}]*)\}/);
    expect(azMatch, "AZ entry not found in LABEL_ANCHOR_OVERRIDES").not.toBeNull();
    const az = azMatch?.[1] ?? "";
    expect(az).toMatch(/x:\s*1120\b/);
    expect(az).toMatch(/y:\s*106\b/);
    expect(az).toMatch(/anchor:\s*"end"/);
    expect(az).toMatch(/fontSize:\s*16\b/);

    // AM stays untouched by this round — the size reduction did not require moving it.
    const amMatch = SOURCE.match(/AM:\s*\{([^}]*)\}/);
    expect(amMatch, "AM entry not found in LABEL_ANCHOR_OVERRIDES").not.toBeNull();
    const am = amMatch?.[1] ?? "";
    expect(am).toMatch(/x:\s*982\b/);
    expect(am).toMatch(/y:\s*92\b/);
  });

  it("consumes an override's own fontSize, falling back to CONTEXT_COUNTRY_LABEL_SIZE when absent", () => {
    expect(SOURCE).toContain("override?.fontSize ?? CONTEXT_COUNTRY_LABEL_SIZE");
    expect(SOURCE).toMatch(/fontSize=\{fontSize\}/);
  });
});

describe("PR #108 fix round 3 — QN/CY leader-line geometry (SOV108R2-I1 / SOV108R2-I2)", () => {
  it("keeps the QN row's own text at y:428 and its leader starting under its OWN ink box, clear of the CY row's", () => {
    const qnMatch = SOURCE.match(/qn:\s*\{([^}]*leaderFrom:\s*\{[^}]*\}[^}]*)\}/);
    expect(qnMatch, "qn entry not found in CY_QN_LABEL_BLOCK").not.toBeNull();
    const qn = qnMatch?.[1] ?? "";
    expect(qn).toMatch(/x:\s*340\b/);
    expect(qn).toMatch(/y:\s*428\b/);
    // leaderFrom.x must NOT equal the row's own centre (340) any more — that shared-centre
    // offset is exactly what SOV108R2-I1 measured landing inside the CY row's own ink box.
    expect(qn).toMatch(/leaderFrom:\s*\{\s*x:\s*380,\s*y:\s*438\s*\}/);
  });

  it("keeps the CY row's own text at x:260/y:448 and its leader as a two-leg polyline clear of seaMediterranean", () => {
    const cyMatch = SOURCE.match(
      /cy:\s*\{([^}]*leaderFrom:\s*\{[^}]*\}[^}]*leaderElbow:\s*\{[^}]*\}[^}]*)\}/,
    );
    expect(cyMatch, "cy entry (with leaderElbow) not found in CY_QN_LABEL_BLOCK").not.toBeNull();
    const cy = cyMatch?.[1] ?? "";
    expect(cy).toMatch(/x:\s*260\b/);
    expect(cy).toMatch(/y:\s*448\b/);
    expect(cy).toMatch(/leaderFrom:\s*\{\s*x:\s*330,\s*y:\s*448\s*\}/);
    // The elbow sits on the SAME y as leaderFrom (the row's own baseline) — leg 1 is safe by
    // staying entirely above seaMediterranean's ink-box top edge regardless of x; leg 2 (elbow
    // to target) is safe by staying entirely right of its ink-box right edge regardless of y.
    expect(cy).toMatch(/leaderElbow:\s*\{\s*x:\s*360,\s*y:\s*448\s*\}/);
  });

  it("renders the CY leader as a fill:none <polyline> through leaderFrom → leaderElbow → the shape's labelPoint, not a straight <line>", () => {
    const labelsBlock = layerBlock(SOURCE, "context-labels");
    expect(labelsBlock).toMatch(/<polyline[^>]*fill="none"[^>]*points=\{/);
    expect(labelsBlock).toMatch(/CY_QN_LABEL_BLOCK\.cy\.leaderFrom\.x/);
    expect(labelsBlock).toMatch(/CY_QN_LABEL_BLOCK\.cy\.leaderElbow\.x/);
    expect(labelsBlock).toMatch(/cyShape\.labelPoint\.x/);
  });

  it("still gives the QN row a plain <line> (only the CY row needed the bend)", () => {
    const labelsBlock = layerBlock(SOURCE, "context-labels");
    expect(labelsBlock).toMatch(/<line[^>]*x1=\{CY_QN_LABEL_BLOCK\.qn\.leaderFrom\.x\}/);
  });
});
