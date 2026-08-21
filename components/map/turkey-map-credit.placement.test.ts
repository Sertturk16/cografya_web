import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WHERE THE TÜRKİYE MAP'S ODbL/JRC CREDIT SITS (`FU-TURKIYE-ATIF-ORTUSU`, owner-ruled from a
 * rendered frame → DEC 2026-08-21d md.2).
 *
 * ## What this guards, and why it is not decoration
 *
 * The credit used to be `position: absolute; right: 14px; bottom: 10px` inside
 * `[data-map-root]`. With no `left` offset its left edge falls at the panel's inner edge, so at
 * phone widths it is not a corner chip but a band across the whole map: measured on the running
 * build at 320px, 264 × 79.69 over a 280 × 121.25 panel — 62.0% of the map — and hit-testing
 * each of the 81 links at its own bounding-box centre with `elementFromPoint` returned the
 * credit rather than the map for **59 of 81 il** (36 of 81 at 360px), identically in both
 * locales. Those shapes are the hub's navigation links and the plate carried no
 * `pointer-events: none`, so it ate the click as well as the view. In flow the same probe reads
 * 0 of 81 at every width in both locales.
 *
 * Moving that one `<p>` back inside the panel restores the defect exactly, and nothing else in
 * the repo notices: `tsc`, ESLint and the rest of the suite stay green through it, because the
 * markup is still valid and the class still exists. That is the shape of an edit a guard has to
 * catch, and it is the same argument PR #77 made for `/dunya`'s half of it — this file is the
 * sibling of that guard, in its own file rather than appended to
 * `map-zoom-pan.contract.test.ts`, because `/turkiye` renders no `MapZoomPan` at all and a
 * zoom-pan contract is the wrong home for a surface that has no zoom.
 *
 * ## Why it reads source instead of rendering
 *
 * `TurkeyMapSection` is an async server component that reaches for `getTranslations`, and the
 * repo runs a single `node` vitest environment with no jsdom — the same constraint
 * `attribution-separation.test.ts`, `map-zoom-pan.contract.test.ts` and
 * `game-map.layers.test.ts` each document. Structural only (`CONVENTIONS.md` §2): nothing below
 * reads a character of either licence string. That the strings are intact and separated is
 * `attribution-separation.test.ts`'s job.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments, then whole-line `//` comments, then collapse whitespace. Byte-identical
 * to the helper the sibling guards use, and load-bearing here: the docblock above the markup
 * quotes `styles.attribution`, `position: absolute` and `bottom: 10px` verbatim, so an
 * unstripped scan would find the retired plate in the prose that explains its retirement.
 */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const TURKEY_MAP = flatCode(sourceOf("./turkey-map-section.tsx"));
const MAP_CSS = sourceOf("./map.module.css");

describe("/turkiye's credit sits under the map box, never on it", () => {
  it("renders the credit <p> as a sibling of [data-map-root], not its child", () => {
    const root = TURKEY_MAP.indexOf("data-map-root");
    expect(root).toBeGreaterThan(-1);

    // Any local module binding rather than a hardcoded `styles.` — the surfaces that share
    // this sheet import it under two different names, and a pattern that assumes one of them
    // fails on correct code (the trap `attribution-separation.test.ts` documents).
    const credit = TURKEY_MAP.search(/<p className=\{[A-Za-z_$][\w$]*\.attributionFlow\}>/);
    expect(credit).toBeGreaterThan(root);

    // Positionally, the way a source scan can honestly see it: the map's `<svg>` closes, then
    // the panel's own `</div>` closes, and only then does the credit appear. A credit put back
    // inside the panel would sit after `</svg>` with that `</div>` still open behind it.
    const between = TURKEY_MAP.slice(root, credit);
    expect(between).toContain("</svg>");
    expect(between.lastIndexOf("</div>")).toBeGreaterThan(between.lastIndexOf("</svg>"));
  });

  it("names no plated credit class, because this stylesheet no longer has one", () => {
    // The retired rule was `.attribution` in `map.module.css`. It is deleted rather than left
    // unused: a plated class kept warm in a shared sheet is how a fourth surface would
    // reintroduce a defect two owner rulings removed. `.attributionLine` must NOT trip this —
    // it is still consumed here and is a `display: block` rule with no plate.
    expect(/\.attribution\b(?!Flow|Line)/.test(MAP_CSS.replace(/\/\*[\s\S]*?\*\//g, " "))).toBe(
      false,
    );
    expect(/\{[A-Za-z_$][\w$]*\.attribution\}/.test(TURKEY_MAP)).toBe(false);

    // Self-check: the reader must be able to SEE the plated class when one is there, or both
    // negatives above are decorative. The controls are built HERE — never by mutating a file
    // under test, which would make the next run pass on a token this test wrote itself.
    const cssControl = "\n.attribution {\n  position: absolute;\n}\n";
    expect(/\.attribution\b(?!Flow|Line)/.test(cssControl)).toBe(true);
    // …and the negative lookahead really does spare the two live classes.
    expect(
      /\.attribution\b(?!Flow|Line)/.test("\n.attributionFlow {}\n.attributionLine {}\n"),
    ).toBe(false);
    const tsxControl = "<p className={styles.attribution} data-x>";
    expect(/\{[A-Za-z_$][\w$]*\.attribution\}/.test(tsxControl)).toBe(true);
  });

  it("keeps the class it moved to in normal flow, with no plate behind it", () => {
    // `.attributionFlow` is shared with `/dunya`, whose own guard asserts the same rule from
    // the other side (`map-zoom-pan.contract.test.ts`). Repeated deliberately rather than
    // cross-referenced: this surface's defect is what the rule now has to hold back, and a
    // guard that depends on another surface's file staying alive is not a guard.
    const rule = MAP_CSS.match(/\n\.attributionFlow \{([\s\S]*?)\n\}/)?.[1];
    expect(rule).toBeDefined();
    // Any `position` at all: `sticky` and `fixed` lift the line back over the map just as
    // effectively, and a `background` was the visible half of the plate.
    expect(rule).not.toMatch(/position:/);
    expect(rule).not.toMatch(/background/);

    const control =
      "\n.attributionFlow {\n  position: absolute;\n  background: var(--scrim-bg);\n}\n";
    const seen = control.match(/\n\.attributionFlow \{([\s\S]*?)\n\}/)?.[1];
    expect(seen).toMatch(/position:/);
    expect(seen).toMatch(/background/);
  });
});
