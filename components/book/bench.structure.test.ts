import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOURCE-SCAN TRIPWIRE for the workbench's SEO and no-JavaScript contract.
 *
 * The question index is the page. Three properties of the bench are the only reason the stage is
 * allowed to exist beside it:
 *
 * · every question row is still a REAL `<a href>` — `SEO-POLICY.md` §B8 8.2 rates JavaScript
 *   navigation a BLOCKER, and §B12 12.2.b is what makes this index the page rather than an
 *   afterthought;
 * · the rows are SERVER markup handed to the island as children, never a client-side
 *   `{selected && …}` mount — a conditional mount would delete 180 `<a href>` from the first
 *   response (§B11 11.3 + 11.8, both BLOCKER);
 * · every link the bench ADDS points at a fragment that exists, because it is built from the same
 *   array that renders the ids (§B8 8.9, BLOCKER).
 *
 * All three are invisible to `tsc`, to ESLint and to a screenshot: a page whose rows became
 * buttons, whose index mounted on the client, or whose timeline linked `#deneme-25-soru-1` into
 * a void renders identically to this one in every frame the owner reviews. The rendered-HTML
 * check catches it once, at the moment someone runs it; this catches it on every CI run.
 *
 * This file replaces `deneme-accordion.structure.test.ts`. The accordion's own assertions
 * (`<summary>` semantics, the panel's `open` attribute, the toggle teardown) are not weakened but
 * RETIRED with the element they guarded, and their absence is asserted rather than assumed — a
 * revert that reintroduces `<details>` should fail here rather than pass quietly.
 *
 * Structural only (`CONVENTIONS.md` §2 — tests check structure/invariants, never facts): it
 * asserts what the source says, not what any particular book's data contains.
 */

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Comments stripped before every scan — the PR-A CR-S2 lesson: a rule quoted inside a comment
 *  must never satisfy (or trip) a source-text guard. This file's own prose says `<details>` and
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
const BENCH = stripComments(sourceOf("./video-bench.tsx"));
const STAGE = stripComments(sourceOf("./bench-stage.tsx"));
const TIMELINE = stripComments(sourceOf("./bench-timeline.tsx"));
const IDENTITY = stripComments(sourceOf("../../lib/book/video-identity.ts"));

/** CSS comments use only the C-style form, so the `//`-line filter above would be wrong here —
 *  a `//` inside a `url()` is not a comment. */
const STYLES = sourceOf("./book-video.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");

/**
 * Every value a named property takes inside every rule matching `selector`, in source order.
 *
 * A list rather than a single string, and every caller asserts its length: a selector that
 * stopped matching, or a property that quietly gained a second declaration, both look like a
 * clean pass to `indexOf`. The `(?:^|;)` anchor is what keeps `top` from matching inside
 * `scroll-margin-top`.
 */
const declaredValues = (selector: string, property: string): string[] =>
  [...STYLES.matchAll(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, "g"))].flatMap((rule) =>
    [...(rule[1] ?? "").matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "g"))].map(
      (declaration) => (declaration[1] ?? "").trim(),
    ),
  );

/**
 * Whitespace-collapsed copies, for every assertion that spans more than one token.
 *
 * Prettier decides where these lines break, and it re-decides whenever a class name or an
 * argument changes length — so an assertion written against the current line breaks fails on a
 * reformat that broke nothing (→ PR #66 review `TA66-M6`). The line-preserving copies above stay
 * for the single-token negative regexes, where collapsing would let a match run across what were
 * separate statements.
 */
const flatten = (source: string) => source.replace(/\s+/g, " ");
const FLAT_PAGE = flatten(PAGE);
const FLAT_BENCH = flatten(BENCH);
const FLAT_STAGE = flatten(STAGE);
const FLAT_TIMELINE = flatten(TIMELINE);

describe("the bench keeps the index crawlable", () => {
  it("anchors the scan on markup that must exist", () => {
    // Without this every assertion below could pass vacuously after a rename or a file move,
    // which is the one way a source-scan guard fails silently.
    expect(PAGE).toContain("questionFragment(");
    expect(PAGE).toContain("<VideoBench");
    expect(BENCH).toContain("BenchStage");
  });

  it("keeps every question row a real <a href>", () => {
    expect(FLAT_PAGE).toMatch(/<a id=\{fragment\} href=\{`#\$\{fragment\}`\}/);
  });

  it("renders the index from the server, never behind a client condition", () => {
    // The single highest-value assertion in this file. `page.tsx` is an async Server Component
    // with no state, so a conditional mount cannot occur there in any form anyone would write;
    // the file where it CAN occur is the island, which renders `{children}` inside the index
    // wrapper. Mutating that to `{selected && children}` — the natural edit when someone defers
    // 180 rows for INP — drops every question link from the first response while React still
    // SSRs the island and every rendered frame stays pixel-identical.
    for (const source of [PAGE, BENCH]) {
      expect(source).not.toMatch(/\{\s*\w*(?:[Oo]pen|[Ss]elected|[Aa]ctive)\s*&&\s*children/);
      expect(source).not.toMatch(/\{\s*\w*(?:[Oo]pen|[Ss]elected|[Aa]ctive)\s*\?\s*children/);
    }
    // The positive half: the index's children are handed through unconditionally. A negative
    // regex alone cannot see a conditional spelled some other way.
    expect(FLAT_BENCH).toMatch(/<div className=\{indexClassName\}>\{children\}<\/div>/);
  });

  it("has no accordion left to reintroduce", () => {
    // The rows are always open now. A revert to `<details>`/`<summary>` would restore an
    // element whose retired guards no longer exist, so the absence is asserted where those
    // guards used to be.
    for (const source of [PAGE, BENCH, STAGE]) {
      expect(source).not.toContain("<details");
      expect(source).not.toContain("<summary");
    }
  });

  it("keeps the deneme heading a real heading carrying the fragment id", () => {
    // Demoting it to a `<span>` — what all three design mockups drew — would delete 30 headings
    // from the document outline (§B3), and moving the `id` off it would break `#deneme-12`,
    // which is binding IA (§B4's book row).
    expect(FLAT_PAGE).toMatch(/<h3 id=\{denemeFragment\(video\.denemeNo\)\}/);
  });
});

describe("the stage cannot disagree with the index", () => {
  it("derives its default from the videos that actually render", () => {
    // §B8 8.9's discipline applied to the new surface: `coverage.denemeNumbers` and `videos[]`
    // are two independent contract fields describing the same thing, and only one of them is the
    // source of the `data-deneme` the stage has to match. A default taken from the other would
    // put the stage and the index on different videos at first paint on the day they diverge.
    expect(FLAT_PAGE).toMatch(/const defaultDenemeNo = benchVideos\[0\]\?\.denemeNo \?\? null;/);
    expect(FLAT_PAGE).not.toContain("coverage.denemeNumbers[0]");
    // Built from the same iteration the rows are built from.
    expect(FLAT_PAGE).toMatch(/const benchVideos: BenchVideo\[\] = videoStates\.map\(/);
  });

  it("resolves the server's default through the store's null sentinel", () => {
    // `selected === null` means "the server's choice". If the stage ever computed its own
    // default instead, the server's HTML and the client's first frame could disagree about which
    // video is on the stage — a hydration mismatch that renders fine and is wrong.
    expect(FLAT_STAGE).toContain("selected ?? defaultDenemeNo");
  });

  it("emits no VideoObject name that the page does not print", () => {
    // §B5 5.7: the markup's `name` is composed from the `<h1>` and the row's `<h3>`, so both must
    // come from ONE builder. Two call sites composing "the same" string is how they stop being
    // the same string.
    expect(FLAT_PAGE).toContain("videoTitle(t, video)");
    expect(IDENTITY).toContain("export function videoTitle");
  });
});

describe("the timeline adds no dead fragment", () => {
  it("builds its hrefs with the same function that builds the ids", () => {
    // The whole guarantee, in one line: the ticks and the rows both call `questionFragment`, so
    // "every href has a target" is true by construction rather than by two lists agreeing
    // (the `FENER66-M2` discipline).
    expect(FLAT_TIMELINE).toMatch(/href=\{`#\$\{questionFragment\(denemeNo, question\.no\)\}`\}/);
    expect(IDENTITY).toContain("export function questionFragment");
  });

  it("iterates the same questions array the rows do", () => {
    // A timeline fed from anything else — a range, a count, `coverage` — could emit a tick for a
    // question that has no row.
    expect(FLAT_STAGE).toContain("questions={video.questions}");
    expect(FLAT_TIMELINE).toContain("questions.map(");
  });

  it("puts no id on a tick", () => {
    // The ids live on the index rows. A tick carrying one would define `#deneme-12-soru-3` twice
    // in one document, and which one a fragment resolves to is then the engine's choice.
    expect(FLAT_TIMELINE).not.toMatch(/<a[^>]*\bid=/);
  });
});

describe("the delegated listener stays narrow", () => {
  it("acts only on the two data hooks", () => {
    expect(BENCH).toContain('closest<HTMLElement>("[data-second], [data-player-open]")');
  });

  it("resolves the video from the DOM rather than from a parsed fragment", () => {
    // One island covers the stage and all thirty rows, so it has to answer "which video is this
    // press about". Reading `data-deneme` keeps that answer out of the fragment STRING — parsing
    // `#deneme-24-soru-3` would make the id scheme load-bearing for behaviour as well as for the
    // IA, which is the coupling `lib/book/video-identity.ts` exists to keep to one place.
    expect(BENCH).toContain('closest<HTMLElement>("[data-deneme]")');
    expect(FLAT_PAGE).toContain("data-deneme={video.denemeNo}");
    expect(FLAT_STAGE).toContain("data-deneme={video.denemeNo}");
  });

  it("puts the row's data-deneme on the element that CONTAINS its heading", () => {
    // `closest()` walks ANCESTORS. With the attribute on the question `<ul>`, a fragment landing
    // on `#deneme-15` — whose `id` is on the `<h3>`, a SIBLING of that list — resolved to nothing
    // and the stage silently stayed on the book's first video, while the same attribute answered
    // correctly from a question row one level down (→ PR #70 review `FENER70-M2` / `CODE70-M5`).
    // Presence alone cannot tell those two placements apart, so the containment is what is
    // asserted: the attribute is on the `<article>`, and the `<ul>` no longer carries one.
    expect(FLAT_PAGE).toMatch(/<article[^>]*\bdata-deneme=\{video\.denemeNo\}/);
    expect(FLAT_PAGE).not.toMatch(/<ul[^>]*\bdata-deneme=/);
    // And the id that landing resolves to is inside it.
    expect(FLAT_PAGE).toMatch(/<article[^>]*>\s*<div className=\{styles\.denemeHead\}>\s*<h3 id=/);
  });

  it("names each of the thirty index rows", () => {
    // An `<article>` is a region a screen reader lists by name, and a heading INSIDE an element
    // does not name it — so the rows arrived as thirty unnamed "article"s (→ `A11Y70-M1`). The
    // name borrows the fragment id, which already exists and is already unique per video.
    expect(FLAT_PAGE).toMatch(/<article[^>]*aria-labelledby=\{denemeFragment\(video\.denemeNo\)\}/);
  });

  it("never opens a player for a video the provider refuses to embed", () => {
    // `CODE63-I1`'s invariant, restated on the new shape: the island refuses the press, and the
    // swap point refuses the render even if a stale store says otherwise.
    expect(FLAT_BENCH).toMatch(/if \(video === undefined \|\| !video\.playable\) return;/);
  });

  it("clears the store when the bench leaves the page", () => {
    // Without this an open player survives a client-side route change and reappears,
    // autoplaying, with no click and no key press anywhere in between (→ `CODE63-I1`).
    expect(FLAT_BENCH).toContain("useEffect(() => resetBench, [])");
  });

  it("loads no player from a hash alone", () => {
    // Arriving on `#deneme-12-soru-3` selects and arms; it does not start a third-party embed,
    // because a hash is neither a click nor a key press. The hash effect may call `selectVideo`
    // and must not call `openVideo`.
    const hashEffect = FLAT_BENCH.slice(
      FLAT_BENCH.indexOf("window.location.hash"),
      FLAT_BENCH.indexOf("useEffect(() => resetBench"),
    );
    expect(hashEffect.length).toBeGreaterThan(0);
    expect(hashEffect).toContain("selectVideo(denemeNo)");
    expect(hashEffect).not.toContain("openVideo(");
  });
});

describe("the stage reserves its height in every cover state", () => {
  it("renders the timeline card outside the rich gate", () => {
    // 88px of CLS on the aging path, and the path is a shared deep link rather than an edge case:
    // the server renders the book's FIRST video, hydration moves the stage to the linked one, and
    // a card that only exists in the `rich` state disappears under a reader already looking at the
    // rows below it (→ PR #70 review `FENER70-I1`, validated). The gate belongs inside the
    // component, which drops the ticks and keeps the box.
    expect(FLAT_STAGE).toMatch(/<BenchTimeline denemeNo=/);
    expect(FLAT_STAGE).toContain("durationSeconds={rich?.durationSeconds ?? null}");
    expect(FLAT_STAGE).not.toMatch(/\{rich !== null && \(?\s*<BenchTimeline/);
  });

  it("gives the empty card the same box as the full one", () => {
    // The two branches must not merely both exist — they must be the same two elements, or the
    // reserved height is a different number from the occupied one and the shift comes back
    // smaller instead of gone. Both branches build `.timeline` around `.timelineBar`, whose 6px
    // height and 38px label lane are fixed and whose ticks are absolutely positioned.
    expect(TIMELINE).toMatch(
      /return \(\s*<div className=\{styles\.timeline\}>\s*<div className=\{styles\.timelineBar\} \/>/,
    );
    expect(FLAT_TIMELINE).toContain(
      '<div className={styles.timeline} role="group" aria-label={t("timelineLabel")}>',
    );
    expect(FLAT_TIMELINE).not.toContain("return null");
    // The card's height must stay a composition rather than a restated number: a `min-height`
    // here would be a second declaration of one measurement, free to drift from the first.
    expect(declaredValues(".timeline", "min-height")).toEqual([]);
    expect(declaredValues(".timelineBar", "height")).toEqual(["6px"]);
    expect(declaredValues(".timelineBar", "margin-bottom")).toEqual(["38px"]);
  });

  it("keeps the caption's floor and the two-line measurement behind it", () => {
    expect(declaredValues(".stageCaption", "min-height")).toHaveLength(1);
  });

  it("aligns the caption and the strip with the player they describe", () => {
    // `.frame` is capped and centred, so between 564px and 1023px an uncapped caption started
    // 84px to the player's left and the strip placed its questions against nothing
    // (→ PR #70 review `CODE70-M2`). One cap, three elements — asserted as EQUALITY rather than
    // as three separate presence checks, because a cap that drifts on one of them is the defect.
    const caps = [".frame", ".stageCaption", ".timeline"].map((selector) => {
      const values = declaredValues(selector, "max-width");
      expect(values).toHaveLength(1);
      return values[0];
    });
    expect(new Set(caps).size).toBe(1);
  });
});

describe("the two scroll offsets that have to be one number", () => {
  it("pins the sticky stage to the same offset the player's scroll margin reads back", () => {
    // `deneme-video.tsx` compares the player's measured `top` against its own `scroll-margin-top`
    // and scrolls only when the box is above its mark. Above 64rem the stage is stuck at exactly
    // that offset, so the comparison finds it ON the mark and moves nothing. Let the two
    // expressions drift and every İzle press at desktop fires a `scrollIntoView` that yanks a box
    // already in view — invisible in a static frame, and the source calls the pairing
    // load-bearing without anything checking it (→ PR #70 review `TA70-M4`).
    const stickyTop = declaredValues(".stage", "top");
    const playerMargin = declaredValues(".player", "scroll-margin-top");
    expect(stickyTop).toHaveLength(1);
    expect(playerMargin).toHaveLength(1);
    expect(stickyTop[0]).toBe(playerMargin[0]);
  });
});

describe("the guards the accordion's retired test used to carry", () => {
  it("corrects the fragment landing only when it is actually displaced", () => {
    // An unconditional `scrollIntoView` here is a scroll-jack: a reader who started moving between
    // first paint and hydration is pulled back (→ PR #66 review `CODE66-M5`). The condition was
    // pinned by `deneme-accordion.structure.test.ts`; the behaviour moved to the bench and the
    // assertion did not follow it (→ PR #70 review `TA70-M1`).
    expect(FLAT_BENCH).toContain(
      "if (Math.abs(target.getBoundingClientRect().top - wanted) > 1) target.scrollIntoView();",
    );
  });

  it("keeps the row's künye and its separator behind ONE condition", () => {
    // `DenemeMeta` renders nothing outside the `rich` state, so a separator outside this gate
    // leaves a dangling "6 soru çözümü ·" on any row whose provider snapshot has aged out
    // (→ PR #66 review `CODE66-I1`). Invisible on today's 30/30 rich data; the aging path is
    // normal and reaches one row at a time, so it would ship CI-green (→ `TA70-M2`).
    expect(FLAT_PAGE).toContain('{state.kind === "rich" && ( <> <span');
    expect(FLAT_PAGE).toContain("<DenemeMeta state={state} />");
  });
});

describe("the jump strip emits no dead fragment", () => {
  it("derives the linked set from the videos that actually render", () => {
    // §B8 8.9, BLOCKER. The covered numbers are NOT a contiguous range, so a strip derived from
    // `denemeCount` alone would ship one dead anchor per gap — and one derived from
    // `coverage.denemeNumbers` would hold only while two independent contract fields agree
    // (→ `FENER66-M2`).
    expect(FLAT_PAGE).toContain("coveredDenemeNumbers.has(no)");
    expect(FLAT_PAGE).toContain("new Set(videoStates.map(({ video }) => video.denemeNo))");
    expect(FLAT_PAGE).not.toContain("new Set(book.coverage.denemeNumbers)");
  });

  it("puts the href on the covered branch and nothing on the other", () => {
    // The branch is what binds the inputs to the output, and it was unpinned once: inverting the
    // condition to `!coveredDenemeNumbers.has(no)` passed every assertion while the strip linked
    // precisely the ten numbers that have no target (→ `TA66-M3` / `TA66R2-M2`).
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
