import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "the province readout hangs on one DOM attribute, and nothing else".
 *
 * The coordinate tool tells the reader which province their point fell inside, and links it.
 * What makes that possible is a cross-file agreement no type and no import expresses
 * (→ PR #74 review `TEST74-I1`):
 *
 *   1. `tool-map.tsx` emits `data-plate-code` on the classless `<defs>` geometry — the one
 *      copy of the 81 outlines in the server HTML;
 *   2. `tool-island.tsx` finds those nodes with the string selector
 *      `defs path[data-plate-code]` and reads the code back with `getAttribute`.
 *
 * Nothing in `tool-map.tsx` CONSUMES the attribute, so to a reader of that file alone it
 * looks dead. Dropping it while factoring the shared `<defs>` block for a third tool, or
 * moving the geometry out of `<defs>`, makes `provinceShapesOf` return `[]` and
 * `provinceAtPoint` return `null` for every point — the province sentence and its
 * `/turkiye/[slug]` link vanish from every readout while `tsc`, `eslint`, `pnpm test` and
 * `next build` all stay green. It is the silent member of the `[data-tool-*]` family:
 * dropping `[data-tool-overlay]` kills the island loudly, this leaves a working tool that has
 * quietly lost one of its three outputs.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo runs a single `node` vitest environment
 * with no jsdom, and the consumer is a `ssr: false` client island mounted through a portal —
 * the same constraint `map-layers.test.ts`, `inland-water-layer.contract.test.ts` and
 * `game-island.reveal-exit.test.ts` document. A source invariant is the honest version of the
 * same guard: it runs today, costs nothing, and fails on the exact edit it is meant to stop.
 * It makes no claim about the DOM the browser ends up with; that half is the PR's rendered
 * sample of a point placed inside a province.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments and whole-line `//` comments. BOTH files quote `data-plate-code` in
 * their own prose — the emitter explains itself at the `<defs>` block and the island's
 * docblock names it — so an unstripped scan would pass on an attribute that survives only in
 * a note. Every sibling guard in this repo strips for the same reason.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const MAP = code(sourceOf("./tool-map.tsx"));
const ISLAND = code(sourceOf("./tool-island.tsx"));

const EMIT = "data-plate-code={shape.plateCode}";
const SELECTOR = "defs path[data-plate-code]";
const READ = 'getAttribute("data-plate-code")';

/** Occurrences of a literal, counted without a stateful global regex. */
function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the plate-code contract between the tool map and the tool island", () => {
  it("still has the <defs> geometry block and the lookup that reads it", () => {
    // Anchors, first and on purpose. Without them every assertion below passes vacuously on a
    // renamed file, an emptied read or an over-eager comment strip — the one way a
    // source-scanning guard fails silently (the TA48-I1 lesson the game shields cite).
    expect(MAP.indexOf("<defs>")).toBeGreaterThan(-1);
    expect(MAP.indexOf("</defs>")).toBeGreaterThan(MAP.indexOf("<defs>"));
    expect(ISLAND).toContain("function provinceShapesOf(");
  });

  it("emits the plate code exactly once, on the geometry inside <defs>", () => {
    // Once, because the geometry ships once: a second emission means the 64 KB artifact is
    // being written to the page twice. Inside `<defs>`, because that is where the selector
    // looks — geometry hoisted out of `<defs>` is invisible to the island even with the
    // attribute intact.
    expect(countOf(MAP, EMIT)).toBe(1);
    const at = MAP.indexOf(EMIT);
    expect(at).toBeGreaterThan(MAP.indexOf("<defs>"));
    expect(at).toBeLessThan(MAP.indexOf("</defs>"));
    // Self-check: the counter must be able to SEE the attribute, or the assertion above is
    // decorative. The control string lives HERE, never in the file being measured.
    expect(countOf(`<path ${EMIT} />`, EMIT)).toBe(1);
  });

  it("reads it back in the island under the same name", () => {
    // The two halves of the agreement, quoted the way each file writes it: rename the
    // attribute on one side only and this fails instead of the readout.
    expect(ISLAND).toContain(SELECTOR);
    expect(ISLAND).toContain(READ);
  });
});
