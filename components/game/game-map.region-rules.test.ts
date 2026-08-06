import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGION_KEYS } from "@/lib/game/region-slug";

/**
 * STRUCTURE, NOT FACTS — "every coğrafi bölge gets every region rule".
 *
 * `game-map.module.css` hand-writes the seven region keys three times over: once for the
 * Mode-1 tints, once for the pointer-hover outline and once for the keyboard-focus outline.
 * CSS has no compiler. A missing or mistyped selector produces no error anywhere in the
 * pipeline — `tsc`, `eslint` and `next build` all stay green — and the only symptom is one
 * region silently behaving differently from the other six, discoverable by manual QA on
 * that region alone. The duplication predates this file (the tint rules always had it) but
 * PR #38 added two more copies of the list, which is what makes a cheap guard worth its
 * keep (→ PR #38 review, code-reviewer M2 / pr-test-analyzer).
 *
 * The canonical list is `REGION_KEYS`, which is itself pinned to the api contract type by
 * `satisfies Record<GeographicRegion, string>` in `lib/game/region-slug.ts`. So this test
 * transitively ties the stylesheet to the api's region enum: add or rename a region there
 * and this fails until the CSS follows.
 *
 * It asserts nothing about which colour or how many pixels — those are the owner's call and
 * the rendered samples' job. What it pins is structural: that no region is missing a rule,
 * that each tint rule actually declares a fill and declares its OWN region's token, that the
 * hover and focus rules probe the HIT layer and light that region's own silhouette, and that
 * no rule names a region the api contract does not have.
 *
 * WHAT CHANGED WITH THE LAYERED MAP (owner rejection 2026-08-02), because two assertions here
 * moved and a reader deserves to know they were not quietly dropped:
 *  · The hover/focus SUBJECT is no longer the region's member provinces, it is the region's
 *    silhouette group (`.regionOutline`). Outlining the members also thickened the region's
 *    INTERNAL boundaries, which is what the owner rejected.
 *  · `:not(:focus-visible)` on the mate subjects is GONE, and the assertion that pinned it
 *    with it. It existed because those (0,11,0) selectors set `stroke-width` on a province and
 *    beat the (0,6,0) focus step (→ CR-R2-1). These rules now set `display` on a group and
 *    touch no province at all, so there is nothing left to win that cascade. The test below
 *    pins the replacement invariant instead: the probe must read the HIT layer (`.hitEdge`),
 *    because the base layer is `pointer-events: none` and can never match `:hover`.
 *  · `:not([data-state])` moved from the subject to the probe and is still asserted — but see
 *    the tint test below: in PR-4b the TINT probe narrowed to the two transient states, so
 *    that a solved region keeps its colour (I1 / D6). The hover and focus probes still read
 *    `:not([data-state])` deliberately, and the reason is NOT that a solved region is
 *    unpickable — it is pickable, and picking it is a wrong answer to the open question
 *    (`lib/game/shape-state.ts`; an earlier wording of this note had that backwards). The
 *    reason is that a hover silhouette is an invitation, and inviting a click that can only
 *    cost the player points is the wrong invitation to draw. What the player DID outranks
 *    where the pointer is.
 */

const CSS = readFileSync(fileURLToPath(new URL("./game-map.module.css", import.meta.url)), "utf8")
  // Strip comments FIRST. This stylesheet is heavily annotated and its prose quotes real
  // selectors, so without this a commented-out rule — or a selector merely discussed in a
  // note — would satisfy every assertion below (→ PR #38 review round 2, CR-R2-2). The
  // sibling `game-island.wrong-scope.test.ts` strips for the same reason; this file did not,
  // which made it a weaker guard than it looked.
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  // Prettier wraps these very long selectors across lines; flatten so the assertions match
  // the selector, not its formatting.
  .replace(/\s+/g, " ");

/**
 * `MARMARA` → `--region-marmara`, `IC_ANADOLU` → `--region-ic-anadolu`. The token names are
 * derived rather than listed so the mapping cannot drift into a fifth hand-written copy of
 * the region list — and so a copy-paste that points one region's rule at another region's
 * token fails here instead of shipping.
 */
function tintToken(region: string): string {
  return `--region-${region.toLowerCase().replaceAll("_", "-")}`;
}

describe("game-map.module.css region rules", () => {
  it("tints every region with that region's own token", () => {
    for (const region of REGION_KEYS) {
      // The selector AND its declaration: asserting the selector alone would pass on an
      // empty rule block (→ CR-R2-5).
      //
      // THE PROBE CHANGED IN PR-4b, and it is the fix, not a relaxation (I1 / D6,
      // → DEC 2026-08-05g md. 1). It used to be `:not([data-state])`, which handed the tint
      // over to EVERY answer state — including `correct`, the one that is permanent. A solved
      // region therefore lost its colour, and a finished round showed all seven regions in one
      // green. The probe now names only the two TRANSIENT states, so a solved region keeps its
      // tint and says "solved" with a second signal instead.
      expect(CSS).toContain(
        `[data-game-mode="regions"] .province[data-region="${region}"]:not([data-state="wrong"]):not([data-state="reveal"]) { fill: var(${tintToken(region)}); }`,
      );
    }
  });

  it("never lets the SOLVED state suppress a region's tint (D6)", () => {
    // The regression itself, stated once and independently of the seven rules above: if
    // `correct` ever reappears in a tint probe — as a bare `:not([data-state])` or by name —
    // the bölge mode goes back to erasing its own lesson at the end of every round.
    for (const match of CSS.matchAll(
      /\[data-game-mode="regions"\] \.province\[data-region="[A-Z_]+"\]([^{]*)\{/g,
    )) {
      const probe = match[1] ?? "";
      expect(probe).not.toContain("correct");
      expect(probe).not.toContain(":not([data-state])");
    }
  });

  it("shows every region's own silhouette on pointer hover", () => {
    for (const region of REGION_KEYS) {
      // The probe reads `.hitEdge`, not `.province`: the painted base layer is
      // `pointer-events: none`, so a `:hover` written against it could never match and the
      // whole bölge-mode hover state would be silently dead.
      expect(CSS).toContain(
        `:has(.hitEdge[data-region="${region}"]:hover:not([data-state])) .regionOutline[data-region="${region}"]`,
      );
    }
  });

  it("shows every region's own silhouette on keyboard focus", () => {
    for (const region of REGION_KEYS) {
      expect(CSS).toContain(
        `:has(.hitEdge[data-region="${region}"]:focus-visible:not([data-state])) .regionOutline[data-region="${region}"]`,
      );
    }
  });

  it("hides the silhouettes until one of those rules shows it", () => {
    // The pair the seven rules above depend on: without the default `display: none` every
    // region would be outlined at all times, and without `display` as the shown value the
    // rules would set a property nothing reads. `display` specifically, not visibility or
    // opacity — a `display: none` subtree evaluates no filter, which is what keeps six
    // unused silhouettes free.
    expect(CSS).toMatch(/\.regionOutline \{[^}]*display: none;/);
    expect(CSS).toContain(`.regionOutline[data-region="GUNEYDOGU_ANADOLU"] { display: block; }`);
  });

  it("names no region the api contract does not have", () => {
    const named = new Set<string>();
    for (const match of CSS.matchAll(/\[data-region="([^"]+)"\]/g)) {
      const region = match[1];
      if (region !== undefined) named.add(region);
    }
    expect([...named].sort()).toEqual([...REGION_KEYS].sort());
  });
});
