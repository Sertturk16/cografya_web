import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN TRIPWIRE for the accordion's SEO and no-JavaScript contract.
 *
 * The question index is a default-closed accordion, and two properties of that shape are the
 * only reason it is allowed to exist:
 *
 * · every question row is still a REAL `<a href>` — `SEO-POLICY.md` §B8 8.2 rates JavaScript
 *   navigation a BLOCKER, and §B12 12.2.b is what makes this index the page rather than an
 *   afterthought;
 * · the collapsed panel is SERVER markup that is merely hidden, never a client-side
 *   `{open && …}` mount — Google's mobile-first guidance recommends accordions on the explicit
 *   condition that the content stay equivalent, and a conditional mount would delete 180
 *   `<a href>` from the first response (§B11 11.3 + 11.8, both BLOCKER).
 *
 * Both are invisible to `tsc`, to ESLint and to a screenshot: a page whose rows became buttons,
 * or whose panel mounted on the client, renders identically to this one in every frame the
 * owner reviews. The rendered-HTML check catches it once, at the moment someone runs it; this
 * catches it on every CI run.
 *
 * Structural only (`CONVENTIONS.md` §2 — tests check structure/invariants, never facts): it
 * asserts what the source says, not what any particular book's data contains.
 */

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Comments stripped before every scan — the PR-A CR-S2 lesson: a rule quoted inside a comment
 *  must never satisfy (or trip) a source-text guard. This file's own prose says `<button>` and
 *  `{open &&` in several places, so without this the negative assertions below would fail on
 *  their own documentation. */
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");

const PAGE = stripComments(sourceOf("../../app/[locale]/kitaplar/[slug]/page.tsx"));
const PLAYER = stripComments(sourceOf("./deneme-player.tsx"));

describe("the accordion keeps the index crawlable", () => {
  it("anchors the scan on markup that must exist", () => {
    // Without this every assertion below could pass vacuously after a rename or a file move,
    // which is the one way a source-scan guard fails silently.
    expect(PAGE).toContain("<summary");
    expect(PAGE).toContain("questionFragment(");
  });

  it("keeps every question row a real <a href>", () => {
    expect(PAGE).toMatch(/<a\s+id=\{fragment\}\s+href=\{`#\$\{fragment\}`\}/);
  });

  it("renders the collapsed panel from the server, never behind a client condition", () => {
    // The single highest-value assertion in this file. `{open && <ul` or `{isOpen ? … : null}`
    // around the question list is the edit that empties the raw HTML while every visible frame
    // stays identical.
    expect(PAGE).not.toMatch(/\{\s*\w*[Oo]pen\s*&&/);
    expect(PAGE).not.toMatch(/\{\s*\w*[Oo]pen\s*\?/);
  });

  it("prints no panel open in the server's markup", () => {
    // Default-closed is the whole point; an `open` attribute on the rendered `<details>` would
    // restore the wall this change exists to remove.
    expect(PLAYER).toMatch(/<details\s+ref=\{rootRef\}/);
    expect(PLAYER).not.toMatch(/<details[^>]*\sopen[=\s>]/);
  });
});

describe("the toggle stays a native disclosure control", () => {
  it("uses <summary> and gives it no link or button semantics", () => {
    expect(PAGE).toContain("<summary className={styles.denemeSummary}>");
    // A toggle that is also a link makes one press both navigate and change panel state, which
    // then needs `preventDefault` — and that is precisely the JavaScript navigation §B8 8.2
    // forbids. `role="button"` would be the other way to fake it.
    const summaryTag = /<summary[^>]*>/.exec(PAGE)?.[0] ?? "";
    expect(summaryTag).not.toContain("href");
    expect(summaryTag).not.toContain("role=");
    expect(summaryTag).not.toContain("onClick");
  });

  it("never intercepts the summary press in the island", () => {
    // FENER K15: the delegated handler acts only on the two data hooks, so a press on the row
    // falls through to the browser's own open/close and the accordion never becomes
    // JavaScript-driven. Asserted at the selector, which is the thing that would have to change.
    expect(PLAYER).toContain('closest<HTMLElement>("[data-second], [data-player-open]")');
    expect(PLAYER).not.toContain('closest("summary")');
  });

  it("keeps the deneme heading a real heading inside the summary", () => {
    // Demoting it to a <span> — what both design mockups drew — would delete 30 headings from
    // the document outline (§B3). `<summary>`'s content model permits heading content, so the
    // outline and the disclosure can both be satisfied.
    expect(PAGE).toMatch(/<h3\s+id=\{denemeFragment\(video\.denemeNo\)\}/);
  });
});

describe("the jump strip emits no dead fragment", () => {
  it("links only the deneme numbers the coverage set actually contains", () => {
    // §B8 8.9, BLOCKER. The covered numbers are NOT a contiguous range, so a strip derived from
    // `denemeCount` alone would ship one dead anchor per gap.
    expect(PAGE).toContain("coveredDenemeNumbers.has(no)");
    expect(PAGE).toContain("new Set(book.coverage.denemeNumbers)");
  });

  it("gives the uncovered numbers no href at all", () => {
    // The non-link branch must stay a <span>: an <a> without href is not a link either, but it
    // is the shape someone "fixes" into one.
    expect(PAGE).toMatch(
      /<span className=\{`\$\{styles\.jumpItem\} \$\{styles\.jumpItemEmpty\}`\}>/,
    );
  });
});
