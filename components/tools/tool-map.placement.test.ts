import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "the tool map's zoom cluster stays out of the map box on a phone"
 * (→ DEC 2026-08-20n md. 1/2/3, PR #77 review `TEST77-I1`).
 *
 * ## What it protects
 *
 * On a 320px phone the tool map's box is 119.25px tall and the shared zoom cluster is a 132px
 * column, so `.mapRoot { overflow: hidden }` sliced the third button down to 15.25px of
 * hittable height — under `DESIGN.md` §5's unconditional 24px touch-target floor, whose only
 * enforced exception is map GEOGRAPHY and not map chrome. The fix lays the cluster down as a
 * row at the top of the panel below the cut point, and reproduces today's overlay above it.
 *
 * THREE INDEPENDENT LINES CARRY THAT, each one revertible on its own, and every revert leaves
 * `tsc`, ESLint, the unit suite and `next build` green:
 *
 *   1. `tool-map.tsx` hands `MapZoomPan` the TOOL sheet's two placement classes. The island's
 *      own `??` fallbacks are already pinned (`map-zoom-pan.contract.test.ts`) — but from the
 *      other side: that suite protects the DEFAULT this page overrides, not the override.
 *   2. `.zoomLayer` is in FLOW in the base rule, and only a width query turns it back into an
 *      overlay. A tidy-up that hoists `position: absolute` into the base rule — or deletes the
 *      base rule as "redundant" — restores the 15.25px button exactly.
 *   3. `<MapZoomPan>` is rendered BEFORE the `<svg>`. Until this change that was only tab
 *      order; now it is the single thing that puts the button row ABOVE the map. Aligning this
 *      file with `game-map.tsx`, which deliberately renders its cluster AFTER the map, drops
 *      the row under the map and pushes the scale bar out of the map area.
 *
 * ## Why it reads source instead of rendering
 *
 * The repo runs a single `node` vitest environment with no jsdom and the consumer is an
 * `ssr: false` client island — the constraint `tool-map.contract.test.ts`, `map-layers.test.ts`
 * and `map-zoom-pan.contract.test.ts` each document. A source invariant is the honest version
 * of the same guard: it runs today and fails on the exact edit it is meant to stop.
 *
 * ## What it deliberately does NOT assert
 *
 * No pixel, no rendered DOM, no measured number — and above all NOT the cut point's value. The
 * 410 in `tools.module.css` is derived from this surface's aspect ratio and its derivation says
 * so; a guard that pins the digits would go red on a correct re-derivation after a ratio
 * change. The SHAPE is what is load-bearing: flow at the base, overlay inside a `min-width`
 * query. The measured half of this contract is the PR's own browser run and its frames.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments, then whole-line `//` comments, then collapse whitespace. Both files
 * below explain this contract at length in prose — `tool-map.tsx`'s note quotes `<svg>` and
 * `.mapRoot`, and the stylesheet's docblock quotes `position` in English — so an unstripped
 * scan would pass on a rule that survives only in a comment, which is the one way a
 * source-scanning guard fails silently. Every sibling shield strips for the same reason.
 */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const MAP = flatCode(sourceOf("./tool-map.tsx"));
const TOOLS_CSS = flatCode(sourceOf("./tools.module.css"));

/**
 * The local identifier a component binds a stylesheet to.
 *
 * THIS IS THE POINT OF THE FIRST ASSERTION, not a convenience. `tool-map.tsx` is the only file
 * in range holding TWO stylesheet bindings — `styles` for this folder's sheet and `mapStyles`
 * for the shared map sheet — and every other map class in it is written `mapStyles.…`. Writing
 * `mapStyles.zoomLayer` here TYPE-CHECKS: a `*.module.css` module is declared with a string
 * index signature, so neither the wrong sheet nor a missing key is a type error. The shared
 * overlay would come back silently. Asserting the suffix alone (`.zoomLayer`) cannot see that,
 * so the binding name is resolved from the import and asserted with it.
 */
function bindingFor(source: string, moduleSuffixPattern: string): string | undefined {
  const match = source.match(
    new RegExp(String.raw`import\s+([A-Za-z_$][\w$]*)\s+from\s+"[^"]*${moduleSuffixPattern}"`),
  );
  return match?.[1];
}

const TOOLS_BINDING = bindingFor(MAP, String.raw`tools\.module\.css`);
const SHARED_BINDING = bindingFor(MAP, String.raw`map/map\.module\.css`);

interface MediaBlock {
  query: string;
  body: string;
}

/**
 * Split a stylesheet into its top-level text and its `@media` blocks, by walking braces rather
 * than by pattern — a `[^}]*` reader stops at the first inner rule's `}` and reports the block
 * as empty, and a greedy one swallows every rule after it.
 */
function splitMedia(css: string): { topLevel: string; blocks: MediaBlock[] } {
  const blocks: MediaBlock[] = [];
  let topLevel = "";
  let cursor = 0;

  while (cursor < css.length) {
    const at = css.indexOf("@media", cursor);
    if (at === -1) {
      topLevel += css.slice(cursor);
      break;
    }
    topLevel += css.slice(cursor, at);

    const open = css.indexOf("{", at);
    if (open === -1) {
      topLevel += css.slice(at);
      break;
    }

    let depth = 1;
    let scan = open + 1;
    while (scan < css.length && depth > 0) {
      const char = css[scan];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      scan += 1;
    }

    blocks.push({ query: css.slice(at, open).trim(), body: css.slice(open + 1, scan - 1) });
    cursor = scan;
  }

  return { topLevel, blocks };
}

const SHEET = splitMedia(TOOLS_CSS);

/** The declarations of the single `.zoomLayer { … }` rule inside a stretch of CSS. */
function zoomLayerRule(css: string): string | undefined {
  return css.match(/\.zoomLayer\s*\{([^{}]*)\}/)?.[1];
}

describe("the tool map's zoom-cluster placement contract", () => {
  it("still has everything the assertions below look for", () => {
    // Anchors, first and on purpose (the TA48-I1 lesson every shield in this repo cites): a
    // renamed class, a renamed import or an over-eager comment strip would otherwise make each
    // assertion below pass vacuously on a file that no longer contains the thing it guards.
    expect(MAP.indexOf("<MapZoomPan")).toBeGreaterThan(-1);
    expect(MAP.indexOf("<svg")).toBeGreaterThan(-1);
    expect(TOOLS_BINDING).toBeDefined();
    expect(SHARED_BINDING).toBeDefined();
    // Two DIFFERENT sheets, which is the whole hazard: one binding would make the next
    // assertion unable to tell the tool sheet from the shared one.
    expect(TOOLS_BINDING).not.toBe(SHARED_BINDING);
    expect(TOOLS_CSS).toMatch(/\.zoomLayer\s*\{/);
    expect(TOOLS_CSS).toMatch(/\.zoomControls\s*\{/);

    // Self-check: the import reader must actually resolve a binding, or `TOOLS_BINDING` could
    // be right by accident. The control source lives HERE, never in a file being measured.
    expect(bindingFor('import q from "./tools.module.css";', String.raw`tools\.module\.css`)).toBe(
      "q",
    );
  });

  it("hands MapZoomPan this folder's classes, named by the binding that resolves to them", () => {
    expect(MAP).toContain(`layerClassName={${TOOLS_BINDING}.zoomLayer}`);
    expect(MAP).toContain(`controlsClassName={${TOOLS_BINDING}.zoomControls}`);
    // …and not the shared sheet's, under any key. This is the half a suffix-only assertion
    // cannot see, and the likeliest way the defect returns: every other map class in this file
    // is written with the shared binding.
    expect(MAP).not.toContain(`layerClassName={${SHARED_BINDING}.`);
    expect(MAP).not.toContain(`controlsClassName={${SHARED_BINDING}.`);
  });

  it("keeps .zoomLayer in flow at the base and lifts it into an overlay only inside a width query", () => {
    // Exactly one base rule, so the extractor below cannot silently read the media copy.
    expect(SHEET.topLevel.match(/\.zoomLayer\s*\{/g) ?? []).toHaveLength(1);

    const base = zoomLayerRule(SHEET.topLevel);
    expect(base).toBeDefined();
    // ANY `position`, not only `absolute`: `sticky` and `fixed` put the cluster back over the
    // map just as effectively, and `overflow: hidden` then cuts the third button again.
    expect(base).not.toMatch(/position:/);

    // MATCHED BY SHAPE, NEVER BY THE NUMBER. The cut point is derived from this surface's
    // aspect ratio in `tools.module.css`'s own docblock; pinning its digits here would freeze
    // a measurement and go red on a correct re-derivation.
    const overlay = SHEET.blocks.filter(
      (block) =>
        /\(\s*min-width:\s*\d+(?:\.\d+)?px\s*\)/.test(block.query) &&
        /position:\s*absolute/.test(zoomLayerRule(block.body) ?? ""),
    );
    expect(overlay).toHaveLength(1);

    // Self-check, both directions, on control stylesheets that live HERE: the splitter must
    // keep the two `.zoomLayer` rules apart, and the base reader must be able to SEE a
    // `position` when one is really there — otherwise the negative assertion above is
    // decorative rather than a guard.
    const control =
      ".zoomLayer { position: absolute; } @media (min-width: 1px) { .zoomLayer { margin: 0; } }";
    const split = splitMedia(control);
    expect(zoomLayerRule(split.topLevel)).toMatch(/position:/);
    expect(zoomLayerRule(split.blocks[0]?.body ?? "")).toBe(" margin: 0; ");
  });

  it("renders the cluster BEFORE the map's <svg>", () => {
    // Below the cut point this is the only thing putting the button row above the map: the
    // layer is in flow there, so DOM order IS visual order. `game-map.tsx` renders its cluster
    // after the stage on purpose; copying that here drops the row under the map and pushes the
    // scale bar out of the map area, while `host.querySelector("svg")` still resolves and
    // nothing goes red.
    expect(MAP.indexOf("<MapZoomPan")).toBeLessThan(MAP.indexOf("<svg"));
  });
});
