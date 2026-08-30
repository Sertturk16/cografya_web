import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "Diğer araçlar" related-links row and the two smaller V7/§5.3
 * changes PR #112 added to all three tool detail pages (`SEO-POLICY.md` §B8 8.5; PR #112 review
 * `TEST112-I1`/`TEST112-M1`).
 *
 * ## What is actually at risk
 *
 * `{rendersProse && (...)}` gates the TR-only explanatory prose on all three pages — on `/en`
 * that block never renders (§B14). The related-links `<section>` was deliberately placed
 * OUTSIDE both `rendersProse` blocks on every page so it renders on `/en` too: before this PR
 * the EN tool page had no exit link but the breadcrumb (`FENER112-S2` independently confirmed
 * the resulting cross-links are correct and bidirectional — this file does not re-check THAT).
 * Nothing enforces the JSX NESTING that keeps the row unconditional. A future edit (e.g.
 * copy-pasting a new post-tool paragraph) can nest the block back inside the last `rendersProse`
 * gate and silently kill the EN exit link: `pnpm test` stays green (the key still resolves in
 * the message catalogue, see `lib/tools/messages.test.ts:88`), `tsc`/`eslint` stay silent, and
 * no other check reads WHICH JSX condition a key is called under.
 *
 * The same defect class covers two smaller SPEC requirements that shipped in the same PR with
 * no guard of their own: the `.proseAfterTool` spacing class on the post-tool `.prose` block
 * (V7), and koordinat-bulma's `derecekmHeading` H2 moving from pre-tool to post-tool position
 * (SPEC §5.3 — the page's own docblock calls this a "BLOCKER-level requirement" for doorway
 * defense).
 *
 * ## Why it reads source instead of rendering
 *
 * This repo's vitest environment is a bare `node` environment with no jsdom (`FU-WEB-JSDOM`)
 * and all three page components are async server components — the same constraint
 * `tool-hub-card.structure.test.ts` (PR #111) and every other `*.structure.test.ts` in this repo
 * name for their own file. Structural only (`CONVENTIONS.md` §2): every assertion below is about
 * which JSX condition a block is nested under, or which class it carries — never about what any
 * string says.
 */

/**
 * Comments stripped so a docblock that discusses an identifier BY NAME cannot fake a match — the
 * same trap `attribution-separation.test.ts`'s `codeOnly` names for its own file. These three
 * pages carry unusually long docblocks that reference several of the exact identifiers under
 * test by name (e.g. `derecekmP1`/`derecekmP2`, `rendersProse` itself). Block comments first, so
 * a `//` inside a URL or path quoted inside one is gone before line comments are stripped.
 */
function codeOnly(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const PAGES = [
  { name: "mesafe-olcme", path: "../../app/[locale]/araclar/mesafe-olcme/page.tsx" },
  { name: "koordinat-bulma", path: "../../app/[locale]/araclar/koordinat-bulma/page.tsx" },
  { name: "alan-hesaplama", path: "../../app/[locale]/araclar/alan-hesaplama/page.tsx" },
] as const;

/**
 * Returns the index just past the LAST `{rendersProse && ( … )}` block in `source` — the
 * boundary between the TR-only gated content and whatever follows it unconditionally.
 *
 * Walks paren DEPTH from the opening `(` rather than matching the first textual `)}`, because
 * the block's own content nests further `(`/`)` pairs of its own (`t.rich("…", { … =>
 * provinceLink(…) })`) that a naive "first `)}`" search would stop at prematurely, well before
 * the block's real end.
 */
function lastRendersProseBlockEnd(source: string): number {
  const marker = "rendersProse && (";
  const markerIndex = source.lastIndexOf(marker);
  if (markerIndex === -1) {
    throw new Error("no `rendersProse && (` block found in source");
  }

  let depth = 0;
  let closeParenIndex = -1;
  for (let i = markerIndex + marker.length - 1; i < source.length; i++) {
    if (source[i] === "(") {
      depth++;
    } else if (source[i] === ")") {
      depth--;
      if (depth === 0) {
        closeParenIndex = i;
        break;
      }
    }
  }
  if (closeParenIndex === -1) {
    throw new Error("unbalanced parens while walking the last `rendersProse` block");
  }
  // `closeParenIndex` sits on the `)` that matches the opening `(` right after `&&`. The JSX
  // expression container that wraps the whole conditional (`{rendersProse && ( … )}`) must close
  // immediately after it.
  if (source[closeParenIndex + 1] !== "}") {
    throw new Error("expected `)}` immediately closing the last `rendersProse` block");
  }
  return closeParenIndex + 2;
}

describe.each(PAGES)("$name — content after the last `rendersProse` gate", ({ path }) => {
  const source = codeOnly(path);
  const boundary = lastRendersProseBlockEnd(source);

  it("the boundary walker lands on a real `)}`, not -1 or the end of the file (sanity check)", () => {
    expect(boundary).toBeGreaterThan(1);
    expect(boundary).toBeLessThan(source.length);
    expect(source.slice(boundary - 2, boundary)).toBe(")}");
  });

  it("positive control — content that genuinely belongs INSIDE the last gate (its own `sonucHeading` H2) sits BEFORE the boundary", () => {
    // Proves the boundary is not vacuous (e.g. index 0, or "end of file") — it actually
    // separates content that is really gated from content that is really not.
    const gatedHeading = source.lastIndexOf('t("sonucHeading")');
    expect(gatedHeading).toBeGreaterThan(-1);
    expect(gatedHeading).toBeLessThan(boundary);
  });

  it('"Diğer araçlar" (`otherToolsHeading`) occurs ONLY after the boundary — it is unconditional, not nested inside the TR-only gate (TEST112-I1)', () => {
    const needle = "otherToolsHeading";
    const occurrences: number[] = [];
    for (let i = source.indexOf(needle); i !== -1; i = source.indexOf(needle, i + 1)) {
      occurrences.push(i);
    }
    expect(occurrences.length).toBeGreaterThan(0);
    for (const index of occurrences) {
      expect(index).toBeGreaterThan(boundary);
    }
  });

  it("positive control — the PRE-tool `.prose` wrapper uses the bare `styles.prose` class (not the post-tool template literal), proving the next assertion can actually tell the two `.prose` blocks apart", () => {
    expect(source).toMatch(/className=\{styles\.prose\}>/);
  });

  it("`.proseAfterTool` is applied to the post-tool `.prose` block's className (TEST112-M1)", () => {
    expect(source).toMatch(/className=\{`\$\{styles\.prose\} \$\{styles\.proseAfterTool\}`\}/);
  });
});

describe("koordinat-bulma — the `derecekmHeading` H2 sits after the tool, not before it (SPEC §5.3 reorder, TEST112-M1)", () => {
  const source = codeOnly("../../app/[locale]/araclar/koordinat-bulma/page.tsx");
  const toolMarker = source.indexOf('id="tool-heading"');

  it("positive control — the tool-section marker itself resolves to a real position", () => {
    expect(toolMarker).toBeGreaterThan(-1);
  });

  it("positive control — a heading that genuinely belongs BEFORE the tool (`sistemHeading`) sits before the marker", () => {
    const preToolHeading = source.indexOf('t("sistemHeading")');
    expect(preToolHeading).toBeGreaterThan(-1);
    expect(preToolHeading).toBeLessThan(toolMarker);
  });

  it("`derecekmHeading` sits AFTER the tool — not reverted to its pre-tool position", () => {
    const derecekmHeading = source.indexOf('t("derecekmHeading")');
    expect(derecekmHeading).toBeGreaterThan(-1);
    expect(derecekmHeading).toBeGreaterThan(toolMarker);
  });
});
