import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "the game map is never a navigation surface".
 *
 * `/turkiye`'s map wraps every province in `<a href="/turkiye/{slug}">`: 81 crawlable
 * internal links and the most SEO-critical component on the site. The game map draws the
 * SAME shapes, and there a click must ANSWER a question. The failure this file exists to
 * catch is someone "reusing" the navigation map's markup here — which would make every
 * wrong answer a page navigation, turn the play surface into a second crawlable link
 * cluster pointing at the same 81 URLs, and break the round the moment a player misses.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo's single vitest environment is
 * `node` — there is no jsdom, and `GameMap` is an async Server Component that reaches the
 * api, so rendering it in a unit test would mean standing up a harness this PR does not
 * own (PR-1 handed that follow-up to Atlas). A source-level invariant is the honest
 * version of the same guard: it runs today, costs nothing, and fails loudly on the exact
 * edit it is meant to stop. It deliberately does NOT claim to prove what the DOM ends up
 * looking like — the empirical proof of that is the curl check on the rendered page,
 * which is part of every PR on this surface.
 *
 * Scope note: the END-OF-ROUND panel intentionally DOES link to `/turkiye/{slug}` (SPEC
 * §5.4 — the missed-province list is the game's hook back into the content corpus). It
 * lives in its own file (`game-summary.tsx`) precisely so the two files under guard here
 * — the map and the island that drives it — can be held to "no link, anywhere".
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Remove block comments and whole-line `//` comments, so the files' own prose about the
 * `/turkiye` map (which necessarily quotes `<a href=…>`) is not mistaken for code. Inline
 * trailing comments are left alone on purpose: stripping to end-of-line would also eat
 * the `//` of any URL literal, and shrinking the scanned text is the only way this guard
 * can produce a false NEGATIVE.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const MAP_SOURCE = code(sourceOf("./game-map.tsx"));
const ISLAND_SOURCE = code(sourceOf("./game-island.tsx"));

describe("the game map component", () => {
  it("renders no anchor element", () => {
    expect(MAP_SOURCE).not.toMatch(/<a[\s>]/);
    expect(MAP_SOURCE).not.toMatch(/<Link[\s>]/);
  });

  /**
   * WHY THIS IS NARROWER THAN "no href of any kind", AND WHY IT IS NOT WEAKER.
   *
   * The rule used to be a blanket ban on the token `href`. That stopped being expressible
   * when the map went to layered `<use>` twins: `<use href="#game-map-42">` is a
   * same-document reference to this file's OWN `<defs>` geometry — it resolves a shape, it
   * does not go anywhere, and it is the only way to draw one outline in three layers without
   * shipping the path data three times.
   *
   * So the guard now says: every `href` in this file MUST open a same-document fragment, and
   * there must be no `href` in any other syntactic position. A destination of any kind —
   * `href="/turkiye/konya"`, `href={someUrl}`, a `getPathname()` result — fails. Navigation
   * would also have to reach an `<a>` or a `<Link>` to mean anything, and both are still
   * banned outright by the test above, so the property this file exists to protect is
   * unchanged: a click on this surface can answer a question and nothing else.
   */
  it("uses href ONLY as a same-document <use> geometry reference", () => {
    const fragmentHrefs = [...MAP_SOURCE.matchAll(/\bhref\b\s*=\s*(?:\{`|["'])(.?)/g)];
    // Anchor: a rename that removed every `<use>` would otherwise satisfy the loop vacuously.
    expect(fragmentHrefs.length).toBeGreaterThan(0);
    for (const match of fragmentHrefs) {
      expect(match[1]).toBe("#");
    }
    // Nothing named `href` anywhere else — this is what catches `href={destination}`, which
    // the loop above would never see.
    expect(MAP_SOURCE.match(/\bhref\b/g)).toHaveLength(fragmentHrefs.length);
    expect(MAP_SOURCE).not.toMatch(/xlink:href/);
  });

  it("imports no navigation helper", () => {
    expect(MAP_SOURCE).not.toMatch(/from\s+"@\/i18n\/navigation"/);
    expect(MAP_SOURCE).not.toMatch(/from\s+"next\/link"/);
    expect(MAP_SOURCE).not.toMatch(/from\s+"next\/navigation"/);
  });

  it("still marks every shape with the plaka kodu the island answers on", () => {
    // The counterpart of the rule above: shapes carry a JOIN key, not a destination.
    expect(MAP_SOURCE).toMatch(/data-plate=/);
  });
});

describe("the game island", () => {
  it("never turns a map shape into a link at runtime", () => {
    // The island upgrades shapes to `role="button"` when a round starts (WCAG 4.1.2).
    // These are the escapes that would smuggle navigation back in imperatively.
    expect(ISLAND_SOURCE).not.toMatch(/setAttribute\(\s*["'](?:xlink:)?href["']/);
    expect(ISLAND_SOURCE).not.toMatch(/role=\s*["']link["']/);
    expect(ISLAND_SOURCE).not.toMatch(/innerHTML|insertAdjacentHTML/);
  });

  it("renders no link itself — the missed-province list is a separate component", () => {
    expect(ISLAND_SOURCE).not.toMatch(/\bhref\b/);
    expect(ISLAND_SOURCE).not.toMatch(/<a[\s>]/);
    expect(ISLAND_SOURCE).not.toMatch(/<Link[\s>]/);
  });
});
