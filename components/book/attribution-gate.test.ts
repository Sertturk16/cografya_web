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

/** The linked credit row's anchor, opening tag to closing tag. Everything claimed about what
 *  lives INSIDE that link is asserted against this slice rather than the whole file, because a
 *  `[\s\S]*?` reaching from the opening tag to `t("sourceNewTab")` and on to some later `</a>`
 *  proves nothing about containment: it holds today only because this anchor's `</a>` happens
 *  to be the file's last, and the first `<a>` added below the source statement would silently
 *  turn the claim into a coincidence (→ PR #65 review `TA65-M4`). The non-greedy match stops at
 *  the FIRST `</a>` after the opening tag, and anchors do not nest. */
function sourceAnchor(): string {
  const match = /<a className=\{styles\.sourceLink\}[\s\S]*?<\/a>/.exec(PAGE);
  return match?.[0] ?? "";
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
    // …anchored at the predicate's HEAD, because the pattern above certifies a SUBSTRING. A
    // negation wrapping the untouched inner text — `(row) => !(row.providerId !== "youtube" ||
    // book.videos.length > 0)` — keeps every token and operator, matches, and inverts the gate
    // completely: the partner row disappears and the YouTube row survives only on a video-less
    // book, i.e. both halves of the W2 regression restored at once (→ PR #65 review `TA65-M5` /
    // `CODE65-M1`).
    expect(rowPredicate().trim()).toMatch(/^\(row\)\s*=>\s*row\.providerId\s*!==/);
  });

  it("keys the LINKED row on the provider token, never on the address alone", () => {
    // WHICH PARTY RECEIVES THE YOUTUBE BRAND MARK, and the one line of this page that decides
    // it. The api populates `channelUrl` on the PARTNER row too, so the tempting simplification
    // to `row.channelUrl !== null` wraps the publisher's own untouchable notice in a YouTube
    // logo linking to a YouTube channel — the wrong-party credit `DEC 2026-08-17b` hüküm 2
    // forbids in as many words. Every other case in this file passes with the `providerId` half
    // removed (→ PR #65 review `TA65-M1`).
    expect(PAGE).toContain('row.providerId === "youtube" && row.channelUrl !== null ? (');
  });

  it("backs every new-tab claim ON THIS PAGE with the one target/rel form", () => {
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
    // …and the disclosure is made inside the link that does it, rather than beside it. Asserted
    // against the anchor SLICE: the title's word "every" is scoped to this page on purpose —
    // `deneme-facade.tsx`'s own new-tab link is outside this corpus and outside this range
    // (→ PR #65 review `TA65-M6`, widening handed to Atlas).
    expect(sourceAnchor()).not.toBe("");
    expect(sourceAnchor()).toContain('t("sourceNewTab")');
  });

  it("keeps the branding mark itself — the file, its emptiness of alt, its real pixels", () => {
    // W3's actual deliverable, and until PR #65's review the one element in this range with no
    // assertion anywhere in the repo (→ `TA65-M3`). Each of the three is load-bearing and each
    // fails silently: a cleanup that drops `alt=""` makes a screen reader announce YouTube twice
    // inside one link name; a "tidy" to a rounded 35×30 stretches the mark, which is the single
    // thing the Branding Guidelines forbid absolutely; a changed `src` swaps the licensed `01
    // Red` file for one whose acquisition is not recorded. None of them breaks a type, a lint, a
    // build or a rendered credit sentence — the page keeps reading correct while the obligation
    // goes unmet. Structural, not factual: the file NAME and the file's OWN dimensions, never
    // its bytes or a provider's words.
    expect(sourceAnchor()).toContain('src="/marka/yt_icon_red_digital.png"');
    expect(sourceAnchor()).toContain('alt=""');
    expect(sourceAnchor()).toContain("width={1255}");
    expect(sourceAnchor()).toContain("height={1075}");
  });

  it("prints each notice as received, inside its own language", () => {
    // Printed verbatim from the row — never translated, shortened or retyped — and `lang="tr"`
    // because both notices are Turkish sentences on BOTH locales (WCAG 3.1.2).
    //
    // COUNTED, NOT MATCHED. The page writes the notice out twice on purpose — once in the linked
    // branch, once in the plain one — and a single-match assertion is satisfied by EITHER copy
    // alone, so dropping `lang="tr"` from the linked branch only left all seven cases green, the
    // TR sample byte-identical (the attribute is invisible) and a screen reader on /en reading
    // the Turkish notice with English phonetics. Measured on the real file: the mutation leaves
    // the single-match form passing and takes the count from 2 to 1 (→ PR #65 review `TA65-M2`).
    const notices = PAGE.match(/<span lang="tr">\{row\.requiredNoticeTr\}<\/span>/g) ?? [];
    expect(notices).toHaveLength(2);
  });
});
