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

/** CSS with block comments removed: the docblocks quote class names and declarations. */
function bare(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

const TURKEY_MAP = flatCode(sourceOf("./turkey-map-section.tsx"));
const MAP_CSS = sourceOf("./map.module.css");

/**
 * The credit `<p>` under ANY local binding of the sheet, with the tag left OPEN after the class.
 * Anchoring on `}>` would match only a `<p>` that carries no other attribute, so adding a
 * legitimate `data-…`, `id` or `lang` would turn this guard red on correct code — and this repo
 * has twice recorded what follows a false red: the pattern gets loosened (TA50-I1 / TA69R2-I1).
 * The negative control in the second test already tolerates an extra attribute; this keeps both
 * halves of the file saying the same thing about them.
 */
const CREDIT_TAG = /<p className=\{[A-Za-z_$][\w$]*\.attributionFlow\}[^>]*>/;

/** Every declaration body of a class in a stylesheet — top-level AND inside any media query. */
function bodiesOf(css: string, className: string): string[] {
  return [...bare(css).matchAll(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, "g"))].map(
    (match) => match[1] ?? "",
  );
}

describe("/turkiye's credit sits under the map box, never on it", () => {
  it("renders the credit <p> as a sibling of [data-map-root], not its child", () => {
    const root = TURKEY_MAP.indexOf("data-map-root");
    expect(root).toBeGreaterThan(-1);

    // Any local module binding rather than a hardcoded `styles.` — the surfaces that share
    // this sheet import it under two different names, and a pattern that assumes one of them
    // fails on correct code (the trap `attribution-separation.test.ts` documents). Why the tag
    // is left open after the class is on `CREDIT_TAG` itself.
    const credit = TURKEY_MAP.search(CREDIT_TAG);
    expect(credit).toBeGreaterThan(root);

    // Structurally, the way a source scan can honestly see it: the map's `<svg>` closes and the
    // panel's own `</div>` closes before the credit appears. COUNTED, not compared by position.
    // `lastIndexOf("</div>") > lastIndexOf("</svg>")` is only right while this file holds
    // exactly one `</div>`, and it passes again the moment a toolbar `<div>` is added after the
    // `</svg>` and the credit is re-nested behind it — which is the very edit this guard exists
    // to catch. `between` begins INSIDE the panel's own opening tag, so the panel is closed
    // exactly when the closings run one ahead of the openings.
    const between = TURKEY_MAP.slice(root, credit);
    expect(between).toContain("</svg>");
    const opened = (between.match(/<div[\s>]/g) ?? []).length;
    const closed = (between.match(/<\/div>/g) ?? []).length;
    expect(closed).toBe(opened + 1);
  });

  it("names no plated credit class, because this stylesheet no longer has one", () => {
    // The retired rule was `.attribution` in `map.module.css`. It is deleted rather than left
    // unused: a plated class kept warm in a shared sheet is how another surface would
    // reintroduce a defect two owner rulings removed. THIS SHEET ONLY — `/deniz` still plates
    // its own copy from `marine.module.css` and is tracked separately (`FU-MARINE-ATIF-PLAKASI`).
    // `.attributionLine` must NOT trip this — it is still consumed here and is a
    // `display: block` rule with no plate.
    //
    // THE WORD BOUNDARY IS THE WHOLE MECHANISM. A `(?!Flow|Line)` lookahead stood here and could
    // never fire: `\b` already fails between the "n" and the "F"/"L", so it was never reached and
    // the pattern behaved identically with and without it — measured on both control strings
    // below. A control that cannot distinguish the pattern from the pattern-without-it documents
    // nothing, and a dead clause invites the "simplify it away" edit that leaves the real guard
    // resting on something a reader believes is redundant. One pattern, named once, so the
    // assertions and their controls cannot drift apart.
    const PLATED_CSS_CLASS = /\.attribution\b/;
    const PLATED_TSX_CLASS = /\{[A-Za-z_$][\w$]*\.attribution\}/;
    expect(PLATED_CSS_CLASS.test(bare(MAP_CSS))).toBe(false);
    expect(PLATED_TSX_CLASS.test(TURKEY_MAP)).toBe(false);

    // Self-check: the reader must be able to SEE the plated class when one is there, or both
    // negatives above are decorative. The controls are built HERE — never by mutating a file
    // under test, which would make the next run pass on a token this test wrote itself.
    expect(PLATED_CSS_CLASS.test("\n.attribution {\n  position: absolute;\n}\n")).toBe(true);
    // …and the boundary really does spare the two live classes, which is the only reason the
    // first negative can be trusted against a sheet that still declares both of them.
    expect(PLATED_CSS_CLASS.test("\n.attributionFlow {}\n.attributionLine {}\n")).toBe(false);
    expect(PLATED_TSX_CLASS.test("<p className={styles.attribution} data-x>")).toBe(true);
  });

  it("keeps the class it moved to in normal flow, with no plate behind it", () => {
    // `.attributionFlow` is shared with `/dunya`, whose own guard asserts the same rule from
    // the other side (`map-zoom-pan.contract.test.ts`). Repeated deliberately rather than
    // cross-referenced: this surface's defect is what the rule now has to hold back, and a
    // guard that depends on another surface's file staying alive is not a guard.
    //
    // EVERY declaration of the class, never just the first. A line-anchored
    // `\n.attributionFlow {` scan reads the top-level rule alone, so an indented override —
    // `@media (max-width: 480px) { .attributionFlow { position: sticky; background: … } }`, the
    // shape a "make the credit stick on phones" edit takes — slips straight past it, at exactly
    // the width where the defect measured 59 of 81.
    const bodies = bodiesOf(MAP_CSS, "attributionFlow");
    expect(bodies.length).toBeGreaterThan(0);
    // Any `position` at all: `sticky` and `fixed` lift the line back over the map just as
    // effectively, and a `background` was the visible half of the plate.
    for (const body of bodies) {
      expect(body).not.toMatch(/position:/);
      expect(body).not.toMatch(/background/);
    }

    // Self-check: the reader must be able to SEE a plate when one is there — INCLUDING one
    // hidden in a media query, which is the case the loop above exists for, so the control
    // carries both a clean top-level rule and a plated override. The control stylesheet is
    // built HERE, never by mutating the file under test.
    const control =
      ".attributionFlow {\n  margin: 6px 14px 10px;\n}\n" +
      "@media (max-width: 480px) {\n  .attributionFlow {\n" +
      "    position: sticky;\n    background: var(--scrim-bg);\n  }\n}\n";
    const seen = bodiesOf(control, "attributionFlow");
    expect(seen).toHaveLength(2);
    expect(seen.some((body) => /position:/.test(body))).toBe(true);
    expect(seen.some((body) => /background/.test(body))).toBe(true);
  });
});
