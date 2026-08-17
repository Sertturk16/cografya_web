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
 *  their own documentation.
 *
 *  A JSX comment comes out as a UNIT first — the shape `attribution-gate.test.ts` already uses —
 *  and that is what makes adjacency assertable at all. Dropping only the C-style body leaves the
 *  braces that wrapped it standing between two elements that ARE adjacent in the tree, so "the
 *  heading has no wrapper around it" could not be written as a regex, and the assertion that
 *  claimed to check it checked nothing (→ PR #66 review `TA66R2-M1` / `CODE66R2-M4`). */
const stripComments = (source: string) =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");

const PAGE = stripComments(sourceOf("../../app/[locale]/kitaplar/[slug]/page.tsx"));
const PLAYER = stripComments(sourceOf("./deneme-player.tsx"));

/**
 * Whitespace-collapsed copies, for every assertion that spans more than one token.
 *
 * Prettier decides where these lines break, and it re-decides whenever a class name or an
 * argument changes length — so an assertion written against the current line breaks fails on a
 * reformat that broke nothing (→ PR #66 review `TA66-M6`). The sibling
 * `deneme-video.src-invariant.test.ts` collapses whitespace for exactly this reason; this file
 * now does the same instead of pinning single-spaced strings.
 *
 * The line-preserving copies above stay for the single-token negative regexes, where collapsing
 * would let a match run across what were separate statements.
 */
const flatten = (source: string) => source.replace(/\s+/g, " ");
const FLAT_PAGE = flatten(PAGE);
const FLAT_PLAYER = flatten(PLAYER);

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
    // The single highest-value assertion in this file, and it was pointed at the wrong file
    // (→ PR #66 review `TA66-I1`). `page.tsx` is an async Server Component with no state, so
    // `{open && …}` cannot occur there in any form anyone would write; the file where it CAN
    // occur is the client island, which renders `{children}` inside the `<details>`. Mutating
    // that to `{open && children}` — the natural edit when someone adds a panel animation or
    // defers 180 rows for INP — drops every question link from the first response while React
    // still SSRs the island and every rendered frame stays pixel-identical.
    for (const source of [PAGE, PLAYER]) {
      expect(source).not.toMatch(/\{\s*\w*[Oo]pen\s*&&/);
      expect(source).not.toMatch(/\{\s*\w*[Oo]pen\s*\?/);
    }
    // The positive half: the panel's children are handed through unconditionally. A negative
    // regex alone cannot see a conditional spelled some other way.
    expect(PLAYER).toMatch(/<details[^>]*>\s*\{children\}\s*<\/details>/);
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
    expect(FLAT_PAGE).toContain("<summary className={styles.denemeSummary}>");
    // A toggle that is also a link makes one press both navigate and change panel state, which
    // then needs `preventDefault` — and that is precisely the JavaScript navigation §B8 8.2
    // forbids. `role="button"` would be the other way to fake it.
    const summaryTag = /<summary[^>]*>/.exec(FLAT_PAGE)?.[0] ?? "";
    expect(summaryTag).not.toContain("href");
    expect(summaryTag).not.toContain("role=");
    expect(summaryTag).not.toContain("onClick");
  });

  it("never intercepts the summary press in the island", () => {
    // FENER K15: the delegated handler acts only on the two data hooks, so a press on the row
    // falls through to the browser's own open/close and the accordion never becomes
    // JavaScript-driven. Asserted at the selector, which is the thing that would have to change.
    expect(PLAYER).toContain('closest<HTMLElement>("[data-second], [data-player-open]")');
    // Structural rather than one hard-coded spelling: the previous form matched only the exact
    // string `closest("summary")`, which this file never uses, so a typed
    // `closest<HTMLElement>("summary")` or a `tagName === "SUMMARY"` test walked straight past it
    // (→ PR #66 review `TA66-M4`). Every `closest(` argument list in the island is checked for a
    // summary token instead.
    const closestArgs = [...FLAT_PLAYER.matchAll(/\.closest(?:<[^>]*>)?\(([^)]*)\)/g)].map(
      (match) => match[1] ?? "",
    );
    // Anchors the scan: zero matches would make the loop below pass without checking anything.
    expect(closestArgs.length).toBeGreaterThan(0);
    for (const args of closestArgs) {
      expect(args.toLowerCase()).not.toContain("summary");
    }
    expect(FLAT_PLAYER).not.toContain('tagName === "SUMMARY"');
  });

  it("keeps the deneme heading a real heading, unwrapped, inside the summary", () => {
    // Demoting it to a <span> — what both design mockups drew — would delete 30 headings from
    // the document outline (§B3). `<summary>`'s content model permits heading content, so the
    // outline and the disclosure can both be satisfied.
    expect(FLAT_PAGE).toMatch(/<h3\s+id=\{denemeFragment\(video\.denemeNo\)\}/);
    // DIRECT CHILD, not wrapped. That permission does not pass through an intervening `<span>`
    // (phrasing-only), and no flow container is legal in `<summary>` either, so a wrapper of any
    // kind is a content-model violation (→ `FENER66-M1`). Asserted by adjacency — really, this
    // time: the previous form ended in an optional group over a possibly-empty run of whitespace,
    // so it reduced to the substring test the `it` above already makes, and the group could never
    // have matched anyway because the stripper had already deleted every JSX comment. A wrapper
    // under any OTHER name than the retired one walked straight past it (→ `TA66R2-M1`).
    expect(FLAT_PAGE).toMatch(
      /<summary className=\{styles\.denemeSummary\}>\s*<h3 id=\{denemeFragment\(video\.denemeNo\)\}/,
    );
    expect(FLAT_PAGE).not.toContain("denemeSummaryText");
  });

  it("tears the player down when its block collapses", () => {
    // New behaviour with a real failure mode and no other guard: dropping ` onToggle={onToggle}`
    // in a tidy-up leaves a loaded iframe alive inside a hidden `<details>`, so the recording
    // keeps playing with every visible control gone — the reason the island's root had to be the
    // `<details>` at all (→ `TA66-M1`). Same shape the sibling teardown already uses.
    expect(FLAT_PLAYER).toContain("onToggle={onToggle}");
    expect(FLAT_PLAYER).toMatch(/if \(!event\.currentTarget\.open\) closeVideo\(denemeNo\);/);
  });

  it("reveals and re-scrolls before it bails out on a non-playable block", () => {
    // ORDER IS THE CONTRACT HERE. `dev` gated this whole effect on `playable`; the reveal and the
    // corrective scroll deliberately sit ABOVE that bail so a non-embeddable block still opens and
    // still lands its row below the sticky summary. A revert-flavoured edit that re-hoists the
    // bail passes every other assertion while deep links into an `external` deneme silently lose
    // the §B4 4.9 offset (→ `TA66-M2`). Asserted by index, the technique
    // `deneme-video.src-invariant.test.ts` already establishes for this class.
    const reveal = FLAT_PLAYER.indexOf("root.open = true;");
    const firstScroll = FLAT_PLAYER.indexOf("target.scrollIntoView()");
    // BOTH occurrences, not just the first. The effect scrolls in two branches — the
    // engine-did-not-reveal path and the measure-and-correct path — and the one that runs on both
    // measured engines is the SECOND. Pinning only `indexOf` left "move just the `else` block
    // below the bail" passing while the correction was lost on the real path (→ `CODE66R2-M5`).
    const lastScroll = FLAT_PLAYER.lastIndexOf("target.scrollIntoView()");
    const bail = FLAT_PLAYER.indexOf("if (!playable) return;");
    expect(reveal).toBeGreaterThan(0);
    expect(firstScroll).toBeGreaterThan(0);
    expect(bail).toBeGreaterThan(0);
    expect(firstScroll).toBeGreaterThan(reveal);
    expect(lastScroll).toBeGreaterThanOrEqual(firstScroll);
    expect(bail).toBeGreaterThan(lastScroll);
  });

  it("keeps the three round-1 fixes that only a source scan can see", () => {
    // Each of these landed as production behaviour with an explanatory comment and no guard, and
    // each has a one-line revert that passes everything else (→ `TA66R2-M5`). None is visible in a
    // rendered frame: two are load-time behaviours and the third only shows on a block whose
    // provider snapshot has aged out, which today is none of them.
    //
    // (a) `CODE66-M4` — the reveal is scoped to targets INSIDE the panel, so `#deneme-N` answers
    //     the same way on a page load as it does from the jump strip.
    expect(FLAT_PLAYER).toMatch(/root\.querySelector\(\s*":scope > summary"/);
    // (b) `CODE66-M5` — the corrective scroll runs only when the row is off its mark; deleting the
    //     comparison restores the post-hydration scroll-jack.
    expect(FLAT_PLAYER).toMatch(/Math\.abs\(top - wanted\) > 1/);
    // (c) `CODE66-I1` — the separator and the künye are rendered together or not at all; without
    //     the condition a non-`rich` row ends in a dangling "·".
    expect(FLAT_PAGE).toContain('{state.kind === "rich" && (');
  });
});

describe("the jump strip emits no dead fragment", () => {
  it("derives the linked set from the blocks that actually render", () => {
    // §B8 8.9, BLOCKER. The covered numbers are NOT a contiguous range, so a strip derived from
    // `denemeCount` alone would ship one dead anchor per gap — and one derived from
    // `coverage.denemeNumbers` would hold only while two independent contract fields agree
    // (→ `FENER66-M2`). Deriving from the rendered blocks makes the target guarantee structural.
    expect(FLAT_PAGE).toContain("coveredDenemeNumbers.has(no)");
    expect(FLAT_PAGE).toContain("new Set(videoStates.map(({ video }) => video.denemeNo))");
    expect(FLAT_PAGE).not.toContain("new Set(book.coverage.denemeNumbers)");
  });

  it("puts the href on the covered branch and nothing on the other", () => {
    // The branch is what binds the inputs to the output, and it was unpinned: inverting the
    // condition to `!coveredDenemeNumbers.has(no)` passed every assertion here while the strip
    // linked precisely the ten numbers that have no target (→ `TA66-M3`).
    //
    // The DERIVATION is where that inversion actually lives, and pinning the JSX plus a
    // `toContain` on the membership test did not reach it — the mutated line still contains the
    // substring (→ `TA66R2-M2`). Asserted whole.
    expect(FLAT_PAGE).toMatch(/const covered = coveredDenemeNumbers\.has\(no\);/);
    expect(FLAT_PAGE).toMatch(
      /\{covered \? \(\s*<a className=\{styles\.jumpItem\} href=\{`#\$\{denemeFragment\(no\)\}`\}/,
    );
    // The non-link branch must stay a <span>: an <a> without href is not a link either, but it
    // is the shape someone "fixes" into one.
    expect(FLAT_PAGE).toMatch(
      /<span className=\{`\$\{styles\.jumpItem\} \$\{styles\.jumpItemEmpty\}`\}>/,
    );
  });
});
