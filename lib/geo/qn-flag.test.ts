import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveFlag } from "./flag-set";

/**
 * Structural gates on `assets/flags/qn.svg`, the one flag we draw ourselves.
 *
 * ## What is deliberately NOT asserted here
 *
 * The geometry. Not one line says "the crescent's outer circle has this radius" or "the star
 * sits at this coordinate". Those are facts about a state's flag, and CONVENTIONS §2 keeps
 * facts out of tests (→ DEC 2026-07-12); the plan repeats it for this asset by name
 * (`plan.md` §15 md.9). Correctness of the drawing was established the way DEC 2026-08-08n
 * requires — by an auditor who did not draw it, rebuilding the acceptance geometry from the
 * published dimension table, plus the owner's sample gate. A unit test written by the author
 * of the drawing would only restate the author's own arithmetic back to itself.
 *
 * What IS pinned below is everything that is a RULING or an INVARIANT rather than a fact: the
 * 3:2 contract, the reason the red has the value it has, and the hygiene an SVG must keep to
 * be safe inside an `<img>`.
 */

const qnPath = resolveFlag("QN")?.path;
const trPath = resolveFlag("TR")?.path;

function read(path: string | undefined): string {
  if (path === undefined) throw new Error("flag asset did not resolve");
  return readFileSync(path, "utf8");
}

/** Every `fill="…"` value in a flag file, normalised to lower case. */
function fills(svg: string): ReadonlySet<string> {
  return new Set([...svg.matchAll(/fill="([^"]+)"/g)].map((m) => (m[1] ?? "").toLowerCase()));
}

const qn = read(qnPath);

describe("qn.svg — the 3:2 contract", () => {
  it("declares the flag's own ratio, not the card's", () => {
    // DEC 2026-08-08p: the asset is 3:2 and the 4:3 card is only a container. A refactor that
    // "aligns" this file with the package's 4x3 set would be redrawing a state's flag.
    expect(qn).toContain('viewBox="0 0 3 2"');
  });

  it("asks to be letterboxed rather than stretched", () => {
    expect(qn).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("comes from the local layer, never from the package", () => {
    expect(resolveFlag("QN")?.origin).toBe("local");
  });
});

describe("qn.svg — the red is the SET's red, and that is the whole reason it is that value", () => {
  it("matches the red of the pinned package's tr.svg", () => {
    // The examined official texts fix no numeric colour for this flag; the value is a product
    // choice, taken so the flag sits consistently beside the other 198 (→ DEC 2026-08-08p).
    // Pinning the coupling is what keeps that rationale true: if a package bump moves the
    // set's red, this fails instead of leaving one flag quietly off-palette.
    const packageRed = [...fills(read(trPath))].filter((f) => !/^#(fff|ffffff)$/.test(f));
    expect(packageRed).toHaveLength(1);
    expect(fills(qn)).toEqual(new Set([...packageRed, "#fff"]));
  });

  it("says in the file itself that the colour is not an official one", () => {
    // The asset is served publicly at a guessable URL, so its own comment is the only account
    // of itself a reader gets — it must not be possible to read this file and come away
    // believing the colour is a state's published value. Matched case-insensitively and on
    // the load-bearing phrase only: pinning one exact sentence would fail CI on a reword with
    // no defect present.
    expect(qn).toMatch(/not an official/i);
  });

  it("does not carry this project's internal decision identifiers", () => {
    // Same reason, inverted. The file is a sovereignty-sensitive artifact on a public URL;
    // it states its sources and its two product choices in outward-facing language, and
    // internal deliberation stays in the repo and the source ledger.
    expect(qn).not.toMatch(/DEC \d{4}-\d{2}-\d{2}/);
  });
});

describe("qn.svg — hygiene for an asset loaded through <img>", () => {
  it.each([
    ["<script", /<script/i],
    ["<image", /<image\b/i],
    ["<foreignObject", /<foreignobject/i],
    ["an external or embedded reference", /(?:xlink:)?href=|url\(|data:/i],
  ])("carries no %s", (_label, pattern) => {
    expect(qn).not.toMatch(pattern);
  });

  it("stays small enough that it can never be the page's weight problem", () => {
    // Six primitives plus a provenance comment. The bound is loose on purpose — it exists to
    // catch a pasted raster or an inlined third-party outline, not to police the comment,
    // which is required to be complete (an auditor must be able to re-derive the geometry
    // from this file alone). For scale: the package's median flag is ~804 B and its heaviest
    // is 181 KB.
    expect(Buffer.byteLength(qn, "utf8")).toBeLessThan(8192);
  });
});
