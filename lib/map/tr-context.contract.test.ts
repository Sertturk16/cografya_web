import { describe, expect, it } from "vitest";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "./tr-context.generated";
import { PROVINCE_SHAPES } from "./tr-provinces.generated";
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

/**
 * The COMPONENT half of this contract is gone with its component.
 *
 * It pinned `turkey-map-section.tsx`'s three geographic-context groups: declared once each in
 * plan §5.4's order, `pointer-events: none` on all three without exception, no link or tab stop
 * or hit-testing hook anywhere in them, the two shape groups hidden from assistive tech with the
 * label group left visible, the viewBox read from `TR_CONTEXT_VIEWBOX` rather than a literal, and
 * `<InlandWaterLayer />` rendered after the hit layer.
 *
 * T-032 PR4 deleted that component. V2 draws its context shapes inline in eight map surfaces with
 * no base/hit layer split and no crawlable links inside the map at all, so there is no layer
 * ORDER to pin and no hit layer to sit after — the rules were about an architecture that no
 * longer exists, not about a guarantee that moved. Re-expressing them against V2 would invent
 * requirements rather than preserve them.
 *
 * The ARTIFACT half below is unchanged and is the durable part: it re-derives the committed
 * generated file's own numbers from the geometry it ships, which is what catches a hand-edit
 * that bypassed the generator.
 */
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
/**
 * The remaining COMPONENT blocks are gone for the same reason as the first, and one of them is
 * worth recording rather than merely deleting.
 *
 * `PR #108 fix round 2` pinned an AZ label-size exception; `fix round 3` pinned exact leader-line
 * geometry for the QN and CY rows — x/y coordinates, an anchor, a two-leg elbow — all measured so
 * two sovereignty-sensitive callouts could sit near each other without one's leader landing
 * inside the other's ink box.
 *
 * V2 draws context country labels in four surfaces, so the subject looked live. It is not: those
 * surfaces filter the label set with `c.iso !== "TR" && !["MK", "RS", "LB", "QN", "CY"].includes(c.iso)`.
 * The crowded rows are not laid out differently — they are not drawn at all, and the five are
 * omitted together rather than QN or CY alone. That is the symmetric-absence shape
 * `lib/geo/sovereignty.ts` already argues for elsewhere: the contested pair stays in the same
 * state as each other. With no label there is no leader line and no geometry to pin.
 *
 * `lib/map/tr-context.generated.ts`'s own label metadata is still asserted by the artifact block
 * above, so the data these rules positioned is still checked — only the positioning is gone.
 */
