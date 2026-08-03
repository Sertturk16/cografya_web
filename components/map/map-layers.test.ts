import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURE, NOT FACTS — "one shape, one crawlable link, and the geometry written once".
 *
 * `/turkiye` (81 links) and `/dunya` (196 links + the Türkiye hub link) are the two most
 * SEO-critical components on the site: their `<a>` set IS the internal link graph
 * (CONVENTIONS §6 #10). Both were restructured into the layered `<use>` architecture —
 * geometry parked classless in `<defs>`, a painted `base` layer, a `hit` layer that owns the
 * links and the hover/focus line — and that restructure shipped with a guard on the GAME map
 * (`components/game/game-map.layers.test.ts`, a `noindex` surface) and none at all on these
 * two (→ PR #40 review, pr-test-analyzer IMPORTANT). This file closes that asymmetry.
 *
 * THE REGRESSION IT EXISTS FOR. The base and hit layers iterate the SAME shape array, so the
 * cheapest possible mistake — copying the `<a>` wrapper into the base loop while "making the
 * layers consistent" — doubles every crawlable link on the page. `tsc`, `eslint`, `next build`
 * and every other test stay green; the only symptom is 162 / 392 anchors in the HTML, which
 * nobody counts by hand twice. The sibling mistake is emitting the `d` again outside `<defs>`,
 * which silently triples the largest payload on the page.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo runs one `node` vitest environment with
 * no jsdom, and both components are async Server Components that reach the api — the same
 * constraint `game-map.nav-guard.test.ts`, `game-map.layers.test.ts` and
 * `inland-water-layer.contract.test.ts` document. A source invariant is the honest version of
 * the same guard: it runs today, costs nothing, and fails on the exact edit it is meant to
 * stop. It does NOT claim to prove what the DOM ends up looking like — the empirical half is
 * the curl link count every PR on these surfaces runs anyway.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments and whole-line `//` comments. Both files are heavily annotated and
 * their prose quotes `<a href=…>`, `<defs>` and the layer markers verbatim, so an unstripped
 * scan would pass on a rule that exists only in a note (every sibling guard in this repo
 * strips for the same reason).
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

/** The two indexable map surfaces, with the shape array each one iterates. */
const SURFACES = [
  { file: "./turkey-map-section.tsx", shapes: "PROVINCE_SHAPES.map" },
  { file: "./world-map-section.tsx", shapes: "COUNTRY_SHAPES.map" },
] as const;

/** The source of ONE layer group: its marker attribute up to the next marker, or end of file. */
function layerBlock(source: string, name: "base" | "hit"): string {
  const start = source.indexOf(`data-map-layer="${name}"`);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const next = rest.indexOf('data-map-layer="', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

for (const { file, shapes } of SURFACES) {
  describe(`${file} paint layers`, () => {
    const SOURCE = code(sourceOf(file));

    it("declares the base layer once, the hit layer once, and paints base first", () => {
      // SVG has no z-index: "above" means "later in the document". The hover/focus line lives
      // in the hit layer, so a hit layer painted first would put it back UNDER the neighbours
      // that ate it — the exact defect this architecture was built to remove.
      for (const layer of ["base", "hit"] as const) {
        expect(SOURCE.match(new RegExp(`data-map-layer="${layer}"`, "g")) ?? []).toHaveLength(1);
      }
      expect(SOURCE.indexOf('data-map-layer="base"')).toBeLessThan(
        SOURCE.indexOf('data-map-layer="hit"'),
      );
    });

    it("emits the path geometry once, and only inside <defs>", () => {
      // Three loops over the same array, ONE copy of the `d`. Emitting it again outside `<defs>`
      // is the regression that triples the page's largest payload while looking like a tidy-up.
      expect(SOURCE.match(/d=\{shape\.d\}/g)).toHaveLength(1);
      expect(SOURCE.indexOf("d={shape.d}")).toBeGreaterThan(SOURCE.indexOf("<defs>"));
      expect(SOURCE.indexOf("d={shape.d}")).toBeLessThan(SOURCE.indexOf("</defs>"));
      // The geometry must stay CLASSLESS (a `<use>` clone takes the CSS that matched the
      // REFERENCED element), and `vector-effect` must stay ON it (not an inherited property, so
      // it can never reach a clone from the `<use>` — borders would thicken with zoom).
      const defs = SOURCE.slice(SOURCE.indexOf("<defs>"), SOURCE.indexOf("</defs>"));
      expect(defs).toContain('vectorEffect="non-scaling-stroke"');
      expect(defs).not.toContain("className=");
    });

    it("confines every crawlable link to the hit layer", () => {
      // THE LINK-DUPLICATION GUARD. The base layer is decorative and `aria-hidden`; an `<a>`
      // in it would be a second, duplicate, crawlable copy of the entire internal link graph
      // — and copying the wrapper into the base loop "for consistency" is the cheapest way to
      // do exactly that, since both layers iterate the same array.
      //
      // WHAT THIS DOES *NOT* CLAIM, stated because an earlier version of this name did claim
      // it (→ PR #40 review round 2): it does not prove ONE anchor per shape. `<a>` sites are
      // not iterations — `world-map-section.tsx` legitimately carries two of them inside the
      // single hit loop (an early-return branch for the Türkiye hub link, then the country
      // branch), and they are mutually exclusive per shape. Proving that from source text
      // would mean following control flow; any count-based stand-in would pin the file's
      // shape rather than the property, i.e. a guard that fails on a harmless refactor and
      // passes on a real duplicate. The per-shape count is proven empirically instead, by the
      // rendered `<a>` count on `/turkiye` (81) and `/dunya` (196 + 1) that every PR on these
      // surfaces curls.
      const base = layerBlock(SOURCE, "base");
      const hit = layerBlock(SOURCE, "hit");
      expect(base).not.toMatch(/<a[\s>]/);
      expect(base).not.toMatch(/\bhref=\{(?!`#)/); // only the same-document `<use href={`#…`}`
      // The link/card contract attribute belongs to the anchor, so its absence is a second,
      // independent tripwire on the same copy-paste.
      expect(base).not.toContain("data-shape");
      expect(hit).toMatch(/<a[\s>]/);
      expect(hit).toContain(shapes);
      // Every anchor in the FILE is inside the hit block — the layer boundary holds for the
      // whole component, not just for the part of it this block happens to cover.
      expect(SOURCE.match(/<a[\s>]/g)?.length).toBe(hit.match(/<a[\s>]/g)?.length);
    });

    it("gives the hit layer a fill-less twin to draw the hover line on", () => {
      // The twin is what carries the hover/focus line above every fill and every resting
      // border. Without it the layer split buys nothing and the owner's original complaint —
      // a border thick on one side, a hairline on the other — comes straight back.
      expect(layerBlock(SOURCE, "hit")).toContain("styles.hitEdge");
      expect(layerBlock(SOURCE, "base")).not.toContain("styles.hitEdge");
    });
  });
}
