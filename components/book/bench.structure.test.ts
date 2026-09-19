import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";

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
const PAGE = stripComments(sourceOf("../../app/[locale]/(site)/kitaplar/[slug]/page.tsx"));
const BENCH = stripComments(sourceOf("./video-bench.tsx"));
const STAGE = stripComments(sourceOf("./bench-stage.tsx"));
const TIMELINE = stripComments(sourceOf("./bench-timeline.tsx"));
const IDENTITY = stripComments(sourceOf("../../lib/book/video-identity.ts"));
const VIDEO = stripComments(sourceOf("./deneme-video.tsx"));
const CONTROLS = stripComments(sourceOf("./video-progress-controls.tsx"));

/**
 * WHERE THIS FILE'S GEOMETRY ASSERTIONS USED TO READ FROM, AND WHY THEY MOVED.
 *
 * Until T-033 task 7 the four cases below parsed `book-video.module.css` directly — a
 * `declaredValues(selector, property)` helper over the raw stylesheet text. That file is gone:
 * its 19 raw Terra-token reads were frozen at light values, so the stage rendered a white
 * timeline card and a parchment cover box on a night page. The declarations those cases pinned
 * are Tailwind class strings in the five consumers now, and
 * `components/css-module-fixed-widths.test.ts` — the census that used to hold the `max-width`
 * and `width` half of them — cannot read a class in JSX. So the pins live here, per
 * `lib/test-support/converted-floor.ts`, whose `classConstant` reads a TOP-LEVEL
 * `const NAME = "…";`: a value left inline on a `className` hands it back `null` and every
 * assertion built on it asserts nothing, with the suite green. Each pin therefore rules the
 * `null` out first, and the last case in the file de-hoists a real constant to prove the
 * reading reds when the hoist goes.
 */
const classOf = (source: string, name: string, file: string): string => {
  const found = classConstant(source, name);
  expect(found, `${file} has no top-level ${name} constant`).not.toBeNull();
  return found!;
};

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
    expect(PAGE).toContain("tagFragment(");
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
    // from the document outline (§B3), and moving the `id` off it would break `#video-12`,
    // which is binding IA (§B4's book row).
    expect(FLAT_PAGE).toMatch(/<h3 id=\{videoFragment\(video\.orderNo\)\}/);
  });
});

describe("the stage cannot disagree with the index", () => {
  it("derives its default from the videos that actually render", () => {
    // §B8 8.9's discipline applied to the new surface: no book-level count is published any
    // more (`DEC 2026-09-10c` md.1), so `videos[]` is the ONLY source `defaultOrderNo` could
    // ever be derived from — a declared-count fallback is not merely disfavoured, it is
    // structurally unreachable.
    expect(FLAT_PAGE).toMatch(/const defaultOrderNo = benchVideos\[0\]\?\.orderNo \?\? null;/);
    // Built from the same iteration the rows are built from.
    expect(FLAT_PAGE).toMatch(/const benchVideos: BenchVideo\[\] = videoStates\.map\(/);
  });

  it("resolves the server's default through the store's null sentinel", () => {
    // `selected === null` means "the server's choice". If the stage ever computed its own
    // default instead, the server's HTML and the client's first frame could disagree about which
    // video is on the stage — a hydration mismatch that renders fine and is wrong.
    expect(FLAT_STAGE).toContain("selected ?? defaultOrderNo");
  });

  it("emits no VideoObject name that the page does not print", () => {
    // §B5 5.7: the markup's `name` is composed from the `<h1>` and the row's `<h3>`, so both must
    // come from ONE builder. Two call sites composing "the same" string is how they stop being
    // the same string.
    expect(FLAT_PAGE).toContain("videoTitle(t, locale, video)");
    expect(IDENTITY).toContain("export function videoTitle");
  });
});

describe("the timeline adds no dead fragment", () => {
  it("builds its hrefs with the same function that builds the ids", () => {
    // The whole guarantee, in one line: the ticks and the rows both call `tagFragment`, so
    // "every href has a target" is true by construction rather than by two lists agreeing
    // (the `FENER66-M2` discipline).
    expect(FLAT_TIMELINE).toMatch(/href=\{`#\$\{tagFragment\(orderNo, tag, tags\)\}`\}/);
    expect(IDENTITY).toContain("export function tagFragment");
  });

  it("iterates the same tags array the rows do", () => {
    // A timeline fed from anything else — a range, a count, a declared total — could emit a
    // tick for an etiket that has no row.
    expect(FLAT_STAGE).toContain("tags={video.tags}");
    expect(FLAT_TIMELINE).toContain("tags.map(");
  });

  it("puts no id on a tick", () => {
    // The ids live on the index rows. A tick carrying one would define `#video-12-etiket-3`
    // twice in one document, and which one a fragment resolves to is then the engine's choice.
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
    // `#video-24-etiket-3` would make the id scheme load-bearing for behaviour as well as for the
    // IA, which is the coupling `lib/book/video-identity.ts` exists to keep to one place.
    expect(BENCH).toContain('closest<HTMLElement>("[data-deneme]")');
    expect(FLAT_PAGE).toContain("data-deneme={video.orderNo}");
    expect(FLAT_STAGE).toContain("data-deneme={video.orderNo}");
  });

  it("puts the row's data-deneme on the element that CONTAINS its heading", () => {
    // `closest()` walks ANCESTORS. With the attribute on the question `<ul>`, a fragment landing
    // on `#video-15` — whose `id` is on the `<h3>`, a SIBLING of that list — resolved to nothing
    // and the stage silently stayed on the book's first video, while the same attribute answered
    // correctly from a question row one level down (→ PR #70 review `FENER70-M2` / `CODE70-M5`).
    // Presence alone cannot tell those two placements apart, so the containment is what is
    // asserted: the attribute is on the `<article>`, and the `<ul>` no longer carries one.
    expect(FLAT_PAGE).toMatch(/<article[^>]*\bdata-deneme=\{video\.orderNo\}/);
    expect(FLAT_PAGE).not.toMatch(/<ul[^>]*\bdata-deneme=/);
    // And the id that landing resolves to is inside it.
    expect(FLAT_PAGE).toMatch(/<article[^>]*>\s*<div className=\{styles\.denemeHead\}>\s*<h3 id=/);
  });

  it("names each of the thirty index rows", () => {
    // An `<article>` is a region a screen reader lists by name, and a heading INSIDE an element
    // does not name it — so the rows arrived as thirty unnamed "article"s (→ `A11Y70-M1`). The
    // name borrows the fragment id, which already exists and is already unique per video.
    expect(FLAT_PAGE).toMatch(/<article[^>]*aria-labelledby=\{videoFragment\(video\.orderNo\)\}/);
  });

  it("never opens a player for a video the provider refuses to embed", () => {
    // `CODE63-I1`'s invariant, restated on the new shape: the swap point refuses the render
    // even if a stale store says otherwise. The island's OWN gate is asserted below, position-
    // scoped to the non-playable branch — P2 (§10) gave that branch a real action (the external
    // "watch on YouTube" control), so "returns unconditionally" is no longer the right shape to
    // pin; "never reaches openVideo" still is.
    const nonPlayableBranchStart = FLAT_BENCH.indexOf("if (!video.playable) {");
    const nonPlayableBranchEnd = FLAT_BENCH.indexOf("const raw = trigger.dataset.second;");
    expect(nonPlayableBranchStart).toBeGreaterThan(0);
    expect(nonPlayableBranchEnd).toBeGreaterThan(nonPlayableBranchStart);
    const nonPlayableBranch = FLAT_BENCH.slice(nonPlayableBranchStart, nonPlayableBranchEnd);
    expect(nonPlayableBranch).not.toContain("openVideo(");
    // A question row or timeline tick (no data-player-open) on a non-playable video still falls
    // through to the native fragment jump — the one case this branch does nothing for.
    expect(nonPlayableBranch).toContain('if (!trigger.hasAttribute("data-player-open")) return;');
  });

  it("clears the store when the bench leaves the page", () => {
    // Without this an open player survives a client-side route change and reappears,
    // autoplaying, with no click and no key press anywhere in between (→ `CODE63-I1`).
    expect(FLAT_BENCH).toContain("useEffect(() => resetBench, [])");
  });

  it("loads no player from a hash alone", () => {
    // Arriving on `#video-12-etiket-3` selects and arms; it does not start a third-party embed,
    // because a hash is neither a click nor a key press. The hash effect may call `selectVideo`
    // and must not call `openVideo`.
    const hashEffect = FLAT_BENCH.slice(
      FLAT_BENCH.indexOf("window.location.hash"),
      FLAT_BENCH.indexOf("useEffect(() => resetBench"),
    );
    expect(hashEffect.length).toBeGreaterThan(0);
    expect(hashEffect).toContain("selectVideo(orderNo)");
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
    expect(FLAT_STAGE).toMatch(/<BenchTimeline orderNo=/);
    expect(FLAT_STAGE).toContain("durationSeconds={rich?.durationSeconds ?? null}");
    expect(FLAT_STAGE).not.toMatch(/\{rich !== null && \(?\s*<BenchTimeline/);
  });

  it("gives the empty card the same box as the full one", () => {
    // The two branches must not merely both exist — they must be the same two elements, or the
    // reserved height is a different number from the occupied one and the shift comes back
    // smaller instead of gone. Both branches build `.timeline` around `.timelineBar`, whose 6px
    // height and 38px label lane are fixed and whose ticks are absolutely positioned.
    expect(TIMELINE).toMatch(
      /return \(\s*<div className=\{TIMELINE\}>\s*<div className=\{TIMELINE_BAR\} \/>/,
    );
    expect(FLAT_TIMELINE).toContain(
      '<div className={TIMELINE} role="group" aria-label={t("timelineLabel")}>',
    );
    expect(FLAT_TIMELINE).not.toContain("return null");
    // Both branches must wear the SAME two constants, not merely two constants each — that is
    // what makes "the same box" a fact about one string rather than about two that agree today.
    expect(renderSites(TIMELINE, "TIMELINE")).toBe(2);
    expect(renderSites(TIMELINE, "TIMELINE_BAR")).toBe(2);
    // The card's height must stay a composition rather than a restated number: a `min-h-*`
    // here would be a second declaration of one measurement, free to drift from the first.
    expect(classOf(TIMELINE, "TIMELINE", "bench-timeline.tsx")).not.toMatch(/\bmin-h-/);
    const bar = classOf(TIMELINE, "TIMELINE_BAR", "bench-timeline.tsx");
    expect(bar, "TIMELINE_BAR lost the 6px lane").toContain("h-1.5");
    expect(bar, "TIMELINE_BAR lost the 38px label lane").toContain("mb-[38px]");
  });

  it("keeps the caption's floor and the two-line measurement behind it", () => {
    const caption = classOf(STAGE, "STAGE_CAPTION", "bench-stage.tsx");
    expect(caption, "STAGE_CAPTION lost the two-line floor").toContain("min-h-[3.1rem]");
    expect(renderSites(STAGE, "STAGE_CAPTION")).toBe(1);
  });

  it("cancels the base <p> margin on all three paragraphs that used to carry margin: 0", () => {
    // `app/globals.css`'s base rule gives every `<p>` `margin: 0 0 1rem`, and the retired
    // stylesheet cancelled it on three of them with a `margin` shorthand. A Tailwind conversion
    // that writes only `mt-*` lets that 16px straight back in — under the caption it would push
    // the timeline card and the whole 30-row index down, and inside the cover it would break
    // the CLS guarantee the absolutely-positioned CTA holds. Measured before/after in the
    // browser; asserted here so it cannot come back.
    expect(classOf(STAGE, "STAGE_CAPTION", "bench-stage.tsx")).toContain("mb-0");
    expect(classOf(CONTROLS, "RESUME_LINE", "video-progress-controls.tsx")).toContain("m-0");
    expect(classOf(VIDEO, "SIGN_IN_CTA", "deneme-video.tsx")).toContain("m-0");
  });

  it("keeps the two decorative separators on ONE spelling", () => {
    // The retired stylesheet gave the reason for putting them on one token: the question count,
    // the duration and the date sit on ONE line inside one fact strip, so a separator that
    // drifted in either file would split that line into two colours.
    const meta = stripComments(sourceOf("./deneme-meta.tsx"));
    expect(classOf(STAGE, "META_SEPARATOR", "bench-stage.tsx")).toBe(
      classOf(meta, "META_SEPARATOR", "deneme-meta.tsx"),
    );
  });

  it("aligns the caption and the strip with the player they describe", () => {
    // `.frame` is capped and centred, so between 564px and 1023px an uncapped caption started
    // 84px to the player's left and the strip placed its questions against nothing
    // (→ PR #70 review `CODE70-M2`). One cap, three elements — asserted as EQUALITY rather than
    // as three separate presence checks, because a cap that drifts on one of them is the defect.
    //
    // FOUR now, not three. The fourth is `PROGRESS_CONTROLS`, which wore the same cap in the
    // stylesheet for visual alignment rather than as a CLS mechanism; it is in the equality
    // because the drift question is identical and nothing else was watching it.
    const sources: ReadonlyArray<readonly [string, string, string]> = [
      [VIDEO, "FRAME", "deneme-video.tsx"],
      [STAGE, "STAGE_CAPTION", "bench-stage.tsx"],
      [TIMELINE, "TIMELINE", "bench-timeline.tsx"],
      [CONTROLS, "PROGRESS_CONTROLS", "video-progress-controls.tsx"],
    ];
    const caps = sources.map(([source, name, file]) => {
      const declaration = classOf(source, name, file);
      const found = [...declaration.matchAll(/max-w-\[[^\]]+\]/g)].map((m) => m[0]);
      expect(found, `${name} declares ${found.length} caps, not exactly one`).toHaveLength(1);
      return found[0];
    });
    expect(new Set(caps).size, `the four caps disagree: ${caps.join(", ")}`).toBe(1);
    expect(caps[0]).toBe("max-w-[560px]");
  });

  it("keeps the cover box's own floor — the cap, the ratio and the 200px minimum together", () => {
    // `components/css-module-fixed-widths.test.ts` held `max-width: 560px` for this box until
    // T-033 deleted the stylesheet. The three declarations are one mechanism: at a 320px
    // viewport the column is ~280px, so a pure 16:9 box would be 280x157 — under the
    // provenance ledger's 200x200 player minimum — and `min-h-[200px]` is what wins there.
    // Lose the ratio and the box stops being a video box; lose the floor and it drops under the
    // ledger's minimum; lose the cap and it stops agreeing with the three elements above.
    const frame = classOf(VIDEO, "FRAME", "deneme-video.tsx");
    expect(frame).toContain("aspect-video");
    expect(frame).toContain("min-h-[200px]");
    expect(frame).toContain("max-w-[560px]");

    // FRAME is COMPOSED into the two boxes that render, so `renderSites` reports zero for it by
    // design — `lib/test-support/converted-floor.ts` calls that the safe direction and asks for
    // an assertion that the composed result still carries the value. This is that assertion.
    const boxes = ["PLAYER_BOX", "THUMB_BOX"] as const;
    for (const name of boxes) {
      const box = classOf(VIDEO, name, "deneme-video.tsx");
      expect(box, `${name} no longer builds on FRAME`).toContain("${FRAME}");
      // …and adds nothing that would override the three declarations above it.
      expect(box.replace("${FRAME}", " ")).not.toMatch(/\b(max-w-|min-h-|aspect-)/);
    }
    expect(renderSites(VIDEO, "PLAYER_BOX")).toBe(1);
    expect(renderSites(VIDEO, "THUMB_BOX")).toBe(2);
  });

  it("keeps the tick dot at WCAG 2.2 §2.5.8's 24px exactly", () => {
    // `width: 24px` was this module's other census entry, and it is a floor in BOTH directions:
    // §2.5.8 (AA) sets 24px as the minimum, and the dot's POSITION is its meaning, so a 44px dot
    // would overlap its neighbours at the measured spacings and stop reporting where the
    // question is — §2.5.8's own "Essential" exception. The question is never reachable only
    // here: the same six links sit in the index row below at 44px.
    const dot = classOf(TIMELINE, "TICK_DOT", "bench-timeline.tsx");
    expect(dot, "TICK_DOT lost the 24px target").toContain("size-6");
    expect(dot.split("size-6").join(" ")).not.toMatch(/\b(size|w|h)-(?!6\b)[0-9]/);
    expect(renderSites(TIMELINE, "TICK_DOT")).toBe(1);
  });

  it("POSITIVE CONTROL — the same reading reds when the dot's target is removed", () => {
    // Anti-vacuity against a MUTATION of the real declaration rather than an invented string.
    const real = classOf(TIMELINE, "TICK_DOT", "bench-timeline.tsx");
    const poisoned = real.split("size-6").join("size-4");
    expect(poisoned).not.toBe(real);
    expect(poisoned).not.toContain("size-6");
    expect(poisoned.split("size-6").join(" ")).toMatch(/\b(size|w|h)-(?!6\b)[0-9]/);
  });

  it("POSITIVE CONTROL — de-hoisting a floor makes classConstant return null", () => {
    // THE FAILURE THESE PINS ARE SHAPED AROUND. `classConstant` finds only a top-level `const`;
    // a floor written inline on the JSX `className` hands back `null`, and a pin that skipped
    // the `not.toBeNull()` would then pass every `toContain` it never ran. Built by DE-HOISTING
    // this file's real subject, so the control cannot drift from what it is controlling for.
    const real = classConstant(TIMELINE, "TICK_DOT")!;
    const deHoisted = TIMELINE.replace(real, "")
      .split("className={TICK_DOT}")
      .join('className="grid size-6"');
    expect(deHoisted).toContain("size-6");
    expect(classConstant(deHoisted, "TICK_DOT")).toBeNull();
    expect(renderSites(deHoisted, "TICK_DOT")).toBe(0);
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
    const bracketed = (declaration: string, prefix: string): string[] =>
      [...declaration.matchAll(new RegExp(`${prefix}\\[([^\\]]+)\\]`, "g"))].map((m) => m[1]!);
    const stickyTop = bracketed(classOf(STAGE, "STAGE", "bench-stage.tsx"), "lg:top-");
    const playerMargin = bracketed(classOf(VIDEO, "PLAYER", "deneme-video.tsx"), "scroll-mt-");
    expect(stickyTop, "STAGE declares no lg:top-[…]").toHaveLength(1);
    expect(playerMargin, "PLAYER declares no scroll-mt-[…]").toHaveLength(1);
    expect(stickyTop[0]).toBe(playerMargin[0]);
    // And the offset is still the header's height plus a rem, not some other expression that
    // happens to match on both sides.
    expect(stickyTop[0]).toBe("calc(var(--header-height)+1rem)");
    // The sticky itself only applies where there is a second column to stick beside — below
    // `lg` (64rem, the media query the stylesheet wrote) a sticky player would take 200px+ off
    // a 568px viewport.
    expect(classOf(STAGE, "STAGE", "bench-stage.tsx")).toContain("lg:sticky");
    // `min-w-0` is not boilerplate: without it the grid item refuses to shrink below FRAME's
    // intrinsic 355.6px min-content width and the page scrolls sideways at 320 (WCAG 1.4.10).
    expect(classOf(STAGE, "STAGE", "bench-stage.tsx")).toContain("min-w-0");
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
    // §B8 8.9, BLOCKER. The generic-catalogue cut-over (P0, `DEC 2026-09-10c` md.1) dropped the
    // book-level count outright — there is no total left to over-iterate against, so
    // `jumpNumbers` is read off the same `videoStates` the rows are built from and nothing else.
    expect(FLAT_PAGE).toMatch(
      /const jumpNumbers = videoStates\.map\(\(\{ video \}\) => video\.orderNo\);/,
    );
  });

  it("gives every number a real link, with no uncovered branch left to invert", () => {
    // The covered/uncovered split this once needed — and the bug class that came with it
    // (inverting the condition passed every OLD assertion while the strip linked precisely the
    // numbers that had no target, → `TA66-M3` / `TA66R2-M2`) — is gone with the declared total
    // it existed to guard against. Every number this strip can name now has a target by
    // construction, so there is no second branch to get backwards.
    expect(FLAT_PAGE).toMatch(
      /\{jumpNumbers\.map\(\(no\) => \(\s*<li key=\{no\}>\s*<a className=\{styles\.jumpItem\} href=\{`#\$\{videoFragment\(no\)\}`\}/,
    );
    expect(FLAT_PAGE).not.toContain("jumpItemEmpty");
    expect(FLAT_PAGE).not.toContain("coveredDenemeNumbers");
  });
});
