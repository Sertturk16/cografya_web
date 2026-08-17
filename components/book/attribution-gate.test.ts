import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The book page's SOURCE STATEMENT gate, pinned in the shape PR #63 fixed it into.
 *
 * Sibling of `components/country/flag-attribution.test.ts`,
 * `components/map/locator-attribution.test.ts`, `lib/climate/attribution-notice.test.ts` and
 * `lib/marine/attribution-notice.test.ts`, and it exists for the reason the first of those
 * states in as many words: an attribution obligation is the kind of thing a refactor drops
 * silently, because nothing breaks when it goes. Until this file the book page was the one
 * attribution surface in this repo with no guard at all (→ PR #63 review `TA63R2-I1`).
 *
 * WHAT IS BEING HELD. W2 first gated BOTH credit rows on `book.videos.length > 0`, so a book
 * with no video would have shipped the publisher's own material with no credit line — a
 * transparency regression against W1, which printed that row unconditionally (→ `FENER63-M1` /
 * `CODE63-M1`). The fix split the gate: the video condition moved INSIDE the per-row predicate,
 * and the printed block is gated on the filtered array. Collapsing the two back onto one
 * condition is the literal previous line and the first thing a reader "simplifying" this filter
 * reaches for — and it is invisible to typecheck, lint, build, every other test and every
 * screenshot, because every seeded book today has videos.
 *
 * STRUCTURAL, NOT FACTUAL. Nothing here asserts a provider's notice text. Those strings are
 * api-published and `CONTENT-STYLE.md` §22's untouchable class; pinning their words in a test
 * would be the same mistake as retyping them in the page, and the day the ledger rewords one
 * the test would fail for a change that is correct. What is asserted is the SHAPE of the gate:
 * which value it keys on, and where the video condition sits.
 *
 * Source-scan rather than render, for the reason `deneme-video.src-invariant.test.ts` records:
 * `vitest.config.ts` runs a bare `node` environment with no jsdom (tracked FU-WEB-JSDOM).
 */

/** Comments out, whitespace collapsed: the prose around this code says several of the words
 *  asserted below, and Prettier is free to break the lines wherever it likes. */
function flatCode(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const PAGE = flatCode(
  readFileSync(new URL("../../app/[locale]/kitaplar/[slug]/page.tsx", import.meta.url), "utf8"),
);

/** The `.filter(…)` predicate as written. Everything claimed about the PER-ROW gate is
 *  asserted against this slice rather than the whole file, so a condition that moved out of
 *  the predicate cannot satisfy one of those assertions by accident. */
function rowPredicate(): string {
  const match = /book\.attribution\.filter\(([\s\S]*?)\);/.exec(PAGE);
  return match?.[1] ?? "";
}

describe("the book page's source statement", () => {
  it("still derives its rows by filtering the contract's own array", () => {
    // Anchors. Without them every assertion below could pass vacuously after a rename, which
    // is the one way a source-scan guard fails silently.
    expect(PAGE).toContain("const attributionRows = book.attribution.filter(");
    expect(rowPredicate()).not.toBe("");
  });

  it("selects by the contract's provider token, never by the notice text", () => {
    // A credit line identified by its own words is a line that disappears the day the ledger
    // rewords it; `providerId` is machine-constrained by the generated types.
    expect(rowPredicate()).toContain("row.providerId");
    expect(rowPredicate()).not.toContain("requiredNotice");
  });

  it("keeps the video condition INSIDE the per-row predicate", () => {
    expect(rowPredicate()).toContain("book.videos.length");
  });

  it("gates the printed block on the FILTERED rows and on nothing else", () => {
    // The mutation this file exists for. `{book.videos.length > 0 && …` back in front of the
    // block drops the partner's credit for a video-less book while every other check stays
    // green and the rendered sample stays byte-identical.
    expect(PAGE).toContain("{attributionRows.length > 0 && (");
    expect(PAGE).toContain("{attributionRows.map((row, index) => (");
  });

  it("pins the predicate's OPERATOR RELATION and not merely its tokens", () => {
    // The residue `TA63R3-M1` recorded and W3 closes (`FU-BOOK-GUARD-DEBT`). The five cases
    // above all pass against `row.providerId === "youtube" && book.videos.length > 0` — the
    // tokens are identical and only the operators differ — yet that mutant drops the partner's
    // credit entirely and keeps the YouTube row on a video-less book, i.e. it inverts the very
    // fix this file exists to hold. The recorded "better shape" (hoisting the predicate into
    // `lib/book/attribution-rows.ts`) is deliberately NOT taken: it rewrites production code to
    // suit a test, and the same hole closes here with one line.
    expect(rowPredicate()).toMatch(
      /row\.providerId\s*!==\s*"youtube"\s*\|\|\s*book\.videos\.length\s*>\s*0/,
    );
  });

  it("backs every new-tab claim with the one target/rel form", () => {
    // `TA63R3-M3`, and W3 is why it is closed NOW rather than later: this page tells the reader
    // "yeni sekmede açılır" a second time — for the YouTube credit link — and a claim about
    // behaviour with nothing pinning the behaviour is a claim that survives its own deletion.
    // Both halves matter: `target="_blank"` makes the sentence true, and `rel="noopener
    // noreferrer"` is the repo's single form for it (→ PR #62 review `SEC62-M3`), never one
    // link's variant of it.
    const newTabAnchors = PAGE.match(/<a\s[^>]*target="_blank"[^>]*>/g) ?? [];
    expect(newTabAnchors).toHaveLength(2); // the seller link, and W3's YouTube credit link
    for (const anchor of newTabAnchors) {
      expect(anchor).toContain('rel="noopener noreferrer"');
    }
    // …and the disclosure is made inside the link that does it, rather than beside it.
    expect(PAGE).toMatch(
      /<a className=\{styles\.sourceLink\}[\s\S]*?t\("sourceNewTab"\)[\s\S]*?<\/a>/,
    );
  });

  it("prints each notice as received, inside its own language", () => {
    // Printed verbatim from the row — never translated, shortened or retyped — and `lang="tr"`
    // because both notices are Turkish sentences on BOTH locales (WCAG 3.1.2).
    expect(PAGE).toMatch(/<span lang="tr">\{row\.requiredNoticeTr\}<\/span>/);
  });
});
