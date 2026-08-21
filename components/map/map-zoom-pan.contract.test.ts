import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — the four owner rulings of DEC 2026-08-17g, and the tween that carries
 * them (→ PR #69 review TA69-I1 / TA69-I2 / CODE69-C1).
 *
 * The pure geometry has its own suite (`lib/map/zoom-pan.test.ts`). What has none, and cannot
 * have one, is the island that WIRES that geometry: `components/map/map-zoom-pan.tsx` is an
 * imperative DOM/rAF client island, and the repo runs a single `node` vitest environment with
 * no jsdom — the same constraint `game-island.reveal-exit.test.ts`, `game-map.layers.test.ts`
 * and `inland-water-layer.contract.test.ts` each document. Every ruling below therefore lives
 * in exactly one line of an untestable file, where `tsc`, ESLint and the whole unit suite stay
 * green through its removal.
 *
 * WHAT IS PINNED, and why each one is a single careless edit away:
 *
 *   1. "Sıfırla = tüm ülke" (md. 4) is `animateTo({ ...base })`. Restoring the `{ ...world }`
 *      this PR deleted — the line any reader of the pre-PR file would take for correct —
 *      leaves the button labelled "haritanın tamamını göster" showing the cropped middle of
 *      the country, with the whole map unreachable by any route.
 *   2. Every zoom entry point sizes its view from the 1× REFERENCE, not from the world. One
 *      call site reverting to `zoomOf(world, …)` makes the buttons, wheel, pinch and keyboard
 *      disagree by the 1.94× between the two on a 1.2 stage.
 *   3. `base` is the `"contain"` fit and the opening frame is `"cover"`. They are not
 *      interchangeable and swapping them is a one-word edit.
 *   4. A no-op reframe must not cancel a tween (CODE69-C1). `/dunya`'s `<svg>` is sized from
 *      the very attribute this island writes, so the ResizeObserver fires mid-tween; before
 *      the guard, one "+" press delivered 1.028× of its 1.800× step and the reset button
 *      needed 13 presses.
 *   5. The camera's cross-island DOM contract: the reveal condition, and the fact that the
 *      dispatcher and the listener resolve the SAME `<svg>` (the event does not bubble).
 *   6. `/dunya`'s map chrome: the two class fallbacks it relies on by naming none, the CSS
 *      precondition (`height: auto`) that makes the whole aspect layer inert there, and — new
 *      in PR #77 (→ review `TEST77-M1`) — its credit sitting in FLOW under the panel instead
 *      of plated over the reset button. That last one is not a variation on the first two: it
 *      is the only assertion in the suite that fails if the plate comes back.
 *
 * WHAT IT DOES NOT CLAIM: anything about what the DOM ends up doing. That is this PR's
 * measured browser run — the /dunya tween A/B and the phone frames in
 * `Owner's Inbox/oyun-zoom-paketi/`.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments, then whole-line `//` comments, then collapse whitespace: these files
 * explain every rule below in prose, and Prettier is free to break the lines wherever it
 * likes. Byte-identical to the helper `game-island.reveal-exit.test.ts` and
 * `inland-water-layer.contract.test.ts` already use — deliberately, because the "smarter"
 * version that also eats `{/* … *\/}` as a unit over-matches from an arrow-function body's
 * `{` to the next `*\/}` and silently swallows whole effects.
 */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const ISLAND = flatCode(sourceOf("./map-zoom-pan.tsx"));
const GAME_ISLAND = flatCode(sourceOf("../game/game-island.tsx"));
const GAME_MAP = flatCode(sourceOf("../game/game-map.tsx"));
const GAME_CSS = sourceOf("../game/game-map.module.css");
const MAP_CSS = sourceOf("./map.module.css");
const WORLD_MAP = flatCode(sourceOf("./world-map-section.tsx"));

/** Every `zoomAtPoint(…)` call, tolerating one level of nested parentheses in its arguments. */
const ZOOM_AT_POINT_CALLS = ISLAND.match(/zoomAtPoint\((?:[^()]|\([^()]*\))*\)/g) ?? [];

/**
 * `reframe`'s own body — its declaration up to the next handler in the file, the slicing
 * shape `nav-disclosure.test.ts` already uses. EVERY positional claim about this function
 * must be scoped here: the island calls `cancelTween()` in eleven places (`animateTo`,
 * `zoomStep`, wheel, pointer, four keyboard branches, `onPageShow`, the effect's cleanup —
 * and `reframe`), so "the guard sits above the cancel" written as
 * `/guard[\s\S]*cancelTween\(\)/` over the whole flat file matches one of the other ten
 * whatever `reframe` does, and can never go red (review TA69R2-I1).
 *
 * Either marker missing, or the two reordered, collapses the slice to `""` rather than to
 * some wider stretch of the file — so a rename cannot quietly widen the scan back to the
 * shape this replaces. Every assertion below is red on `""`.
 */
const REFRAME_START = ISLAND.indexOf("const reframe = (force = false)");
const REFRAME_END = ISLAND.indexOf("const onWheel = (e: WheelEvent)");
const REFRAME_BODY =
  REFRAME_START >= 0 && REFRAME_END > REFRAME_START ? ISLAND.slice(REFRAME_START, REFRAME_END) : "";

describe("the 1× reference is the stage's own frame, not the world", () => {
  // Anchors. Without them every assertion below could pass vacuously after a rename, which is
  // the one way a source-scan guard fails silently.
  it("still derives both rectangles from the measured box", () => {
    expect(ISLAND).toContain('fitViewToAspect(world, aspect, "contain")');
    expect(ISLAND).toContain('fitViewToAspect(world, aspect, "cover")');
    expect(ZOOM_AT_POINT_CALLS.length).toBe(5);
  });

  it("resets to the whole map, never to the opening crop (DEC 2026-08-17g md. 4)", () => {
    expect(ISLAND).toContain("animateTo({ ...base })");
    expect(ISLAND).not.toContain("animateTo({ ...world })");
  });

  it("measures zoom against the reference at every entry point", () => {
    expect(ISLAND).toContain("zoomOf(base, view)");
    expect(ISLAND).not.toContain("zoomOf(world,");
  });

  it("passes the reference to every zoomAtPoint call", () => {
    for (const call of ZOOM_AT_POINT_CALLS) {
      expect(call.endsWith(", base)")).toBe(true);
    }
  });

  it("keeps the contain/cover roles apart", () => {
    // `base` is the reset target (the whole map) and the opening view is the crop that pays
    // for the phone's scale. Swapping the two words inverts both rulings at once.
    expect(ISLAND).toMatch(/const nextBase = fitViewToAspect\(world, aspect, "contain"\);/);
    expect(ISLAND).toMatch(/view = fitViewToAspect\(world, aspect, "cover"\);/);
  });
});

describe("a reframe that changes nothing does nothing (CODE69-C1)", () => {
  it("compares the derived frame before touching the view", () => {
    expect(ISLAND).toContain("const reframe = (force = false)");
    expect(ISLAND).toContain("if (!force && sameFrame(nextBase, base)) return;");
  });

  it("still cancels the tween once it has decided to rebuild", () => {
    // The guard must sit ABOVE the cancel, not replace it: a genuine reframe still has to
    // stop an animation that is flying toward a rectangle of the old shape.
    //
    // Scoped to `reframe`'s body and asserted BY INDEX, because the claim is positional and
    // the file is not: written as `/guard[\s\S]*cancelTween\(\);/` over the whole flat
    // island, the tail matched one of the ten other `cancelTween()` calls and the test
    // passed with the cancel deleted from `reframe` outright — the only guard CODE69-C1 has
    // could never go red (review TA69R2-I1, measured both ways).
    expect(REFRAME_BODY.length).toBeGreaterThan(0);
    const guard = REFRAME_BODY.indexOf("if (!force && sameFrame(nextBase, base)) return;");
    const cancel = REFRAME_BODY.indexOf("cancelTween();");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(cancel).toBeGreaterThan(guard);
    // Exactly one, so that `indexOf` speaks for the whole body: with two calls the order
    // above describes only the first, and the second could then sit anywhere.
    expect(REFRAME_BODY.match(/cancelTween\(\)/g) ?? []).toHaveLength(1);
  });

  it("never forces the observer's own call", () => {
    expect(ISLAND).toContain("new ResizeObserver(() => reframe())");
    expect(ISLAND).not.toMatch(/new ResizeObserver\(\(\) => reframe\(true\)\)/);
  });

  it("forces the two callers whose attribute the island did not write", () => {
    // Mount and a bfcache restore. Both must rebuild even where the arithmetic sees no change
    // — on `/dunya` the frame is the world before and after, and a restored zoomed viewBox
    // would otherwise survive (SPEC §7: no persistence).
    expect(ISLAND.match(/reframe\(true\)/g) ?? []).toHaveLength(2);
  });
});

describe("the camera contract between the two islands", () => {
  it("pans for a SHOWN answer only (Kâşif SPEC §7.2)", () => {
    // Broadened to fire on a wrong answer, the map would pan to the correct province while
    // the question is still open and hand the player the answer.
    expect(GAME_ISLAND).toContain('if (feedback?.kind !== "revealed") return;');
    expect(GAME_ISLAND).toContain("dispatchMapCamera(svg, revealed)");
  });

  it("dispatches on the map's own <svg>", () => {
    expect(GAME_ISLAND).toContain('document.querySelector("[data-game-map] svg")');
  });

  it("listens on that same element, not on its container", () => {
    // The event does not bubble, so a listener registered on `canvas` or `host` would never
    // receive it — and the island's host is `.frame` now that the cluster left the map box.
    expect(ISLAND).toContain("svg.addEventListener(MAP_CAMERA_EVENT, onCamera)");
    expect(ISLAND).not.toMatch(/(canvas|host)\.addEventListener\(MAP_CAMERA_EVENT/);
  });

  it("keeps the stage as the frame's first child", () => {
    // `host.querySelector("svg")` takes the FIRST `<svg>` in the frame. Adding an icon `<svg>`
    // to the credit line above the stage would bind the whole island to a 16px glyph: zoom,
    // keyboard zoom, focus-follow-view and the camera would all go quiet, with CI green.
    // `\{ \}` is the JSX comment the stripper leaves behind — the frame's own markup note.
    expect(GAME_MAP).toMatch(
      /className=\{styles\.frame\}>\s*(?:\{ \}\s*)?<div className=\{styles\.stage\}/,
    );
  });
});

describe("/dunya's map chrome — the overlay it keeps, the box it fits, the credit it moved out", () => {
  it("falls back to the shared overlay classes when the caller names none", () => {
    // Dropping either default leaves the world map's control layer with `className={undefined}`
    // — the absolutely positioned overlay collapses into the flow on a page this PR does not
    // touch.
    expect(ISLAND).toContain("layerClassName ?? styles.zoomLayer");
    expect(ISLAND).toContain("controlsClassName ?? styles.zoomControls");
  });

  it("keeps the world map's box carrying the viewBox's own ratio", () => {
    // THE precondition of the whole isolation argument: `height: auto` means the measured
    // aspect equals the viewBox's within ASPECT_EPSILON, so `fitViewToAspect` returns the
    // world and the aspect layer is inert. A `max-height`, a flex stretch or an
    // `aspect-ratio` here would silently open `/dunya` on a crop.
    const rule = MAP_CSS.match(/\n\.svg \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(rule).toContain("height: auto");
    expect(rule).not.toMatch(/max-height|min-height|aspect-ratio:/);
    // Every height declaration in the rule, listed rather than pattern-matched: a negative
    // lookahead here reads as a guard and is not one (it matches the empty string before
    // "auto"), which is the shape of an assertion that can never fail.
    const heights = [...rule.matchAll(/(?:^|[\s;])height:\s*([^;]+);/g)].map((m) => m[1]?.trim());
    expect(heights).toEqual(["auto"]);
  });

  it("keeps the credit OUTSIDE the map box, as a sibling of it", () => {
    // The plate used to be the map box's last child, bottom-right — which is where the zoom
    // cluster's reset button ends on a short stage: at 320px the button was geometrically
    // whole and hittable only in 9px slivers. Moving the `<p>` back inside `[data-map-root]`
    // restores that exactly, and nothing else in the repo notices (→ review `TEST77-M1`).
    const root = WORLD_MAP.indexOf("data-map-root");
    expect(root).toBeGreaterThan(-1);
    // Any local module binding, never a hardcoded `styles.` — the sibling surfaces import the
    // same sheet under two different names.
    const credit = WORLD_MAP.search(/<p className=\{[A-Za-z_$][\w$]*\.attributionFlow\}>/);
    expect(credit).toBeGreaterThan(root);

    // Positionally, the way a source scan can honestly see it: the map's `<svg>` closes, then
    // the box's own `</div>` closes, and only then does the credit appear. A credit put back
    // inside the box would sit after `</svg>` with that `</div>` still open behind it.
    const between = WORLD_MAP.slice(root, credit);
    expect(between).toContain("</svg>");
    expect(between.lastIndexOf("</div>")).toBeGreaterThan(between.lastIndexOf("</svg>"));
  });

  it("keeps .attributionFlow in normal flow, with no plate behind it", () => {
    // NOT `.attribution`. When this guard was written the plated rule was still live and
    // correct for `/turkiye`, so the game's guard could not be copied verbatim — it would have
    // gone red on right code, and the reflex fix is to loosen the pattern (the TA50-I1 /
    // TA69R2-I1 failure this repo has already recorded twice). `/turkiye` has since moved too
    // and the plated rule is deleted; the assertions below are unchanged because they were
    // always written against the class that carries the behaviour, not against its absence.
    const rule = MAP_CSS.match(/\n\.attributionFlow \{([\s\S]*?)\n\}/)?.[1];
    expect(rule).toBeDefined();
    // Any `position` at all: `sticky` and `fixed` lift the line back over the map just as
    // effectively, and `--scrim-bg` was the visible half of the plate.
    expect(rule).not.toMatch(/position:/);
    expect(rule).not.toMatch(/background/);

    // Self-check: the reader must be able to SEE a plate when one is there, or both negatives
    // above are decorative. The control stylesheet lives HERE — never in the file measured.
    // That was already the right call for a reason now realised: the live `.attribution` rule
    // this control could have borrowed no longer exists.
    const control =
      "\n.attributionFlow {\n  position: absolute;\n  background: var(--scrim-bg);\n}\n";
    const seen = control.match(/\n\.attributionFlow \{([\s\S]*?)\n\}/)?.[1];
    expect(seen).toMatch(/position:/);
    expect(seen).toMatch(/background/);
  });
});

describe("the cross-file attribute contracts", () => {
  it("pins data-vertical-pan on both sides", () => {
    // Rename either side and the phone map keeps `touch-action: pan-y` at every zoom level: a
    // zoomed-in player can no longer drag it vertically at all, the page scrolls instead.
    expect(ISLAND).toContain('svg.toggleAttribute("data-vertical-pan", cropsVertically)');
    expect(GAME_CSS).toContain(".stage .svg[data-zoomable][data-vertical-pan]");
  });

  it("pins data-game-frame on both sides", () => {
    expect(GAME_MAP).toContain('data-game-frame={isSubset ? "subset" : "country"}');
    expect(GAME_CSS).toContain('.stage[data-game-frame="country"]');
    expect(GAME_CSS).toContain('.stage[data-game-frame="subset"]');
  });

  it("keeps the pre-JS paint equal to the island's opening frame", () => {
    // `slice` paints exactly the `"cover"` rectangle the island computes; `meet` would
    // letterbox before hydration and then visibly jump when the island writes its viewBox.
    expect(GAME_MAP).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it("keeps the region round on the capped desktop model below the breakpoint (ruling O4)", () => {
    // `flex-basis` replaces `width` in main-size resolution, so a blanket `flex: 0 0 100%`
    // switches `--game-stage-cap` off for the frames the ruling explicitly excludes
    // (review CODE69-I1).
    expect(GAME_CSS).toMatch(/\.stage\[data-game-frame="subset"\] \{\s*flex: 0 1 auto;/);
    expect(GAME_CSS).toContain('.stage[data-game-frame="subset"] ~ .attribution');
  });
});
