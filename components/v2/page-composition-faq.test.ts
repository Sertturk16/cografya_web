import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEA_BASINS_DETAIL } from "@/lib/marine/sea-basins-detail";
import { getAllContinents, CONTINENT_HUB_FAQS } from "@/lib/geo/continents";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import {
  NO_CLASSNAME,
  type ScannedElement,
  importBindingsOf,
  innermostElementAt,
  jsxElementsOf,
  label,
  maskedSource,
  readSource,
  repoRoot,
  resolvesTo,
  surfaceFiles,
  walk,
  withInjectedSource,
} from "@/lib/test-support/composition-scan";

/* -------------------------------------------------------------------------------------------
 * T-035 PR5 — the FAQ surface, AFTER CONVERGENCE. Six counters over the hand-written blocks that
 * render a question and an answer, plus the one pairing that matters: a `faqPageJsonLd(X)` call
 * and whether the file that makes it also renders `X`.
 *
 * FIVE OF THE SIX NOW READ ZERO, and that is the end state Task 9 drove them to rather than a
 * scanner that stopped working. The six blocks this file was built to count are gone: every FAQ on
 * the surface is `components/patterns/faq-section.tsx` now, and that component lives OUTSIDE
 * `SURFACE_ROOTS`, so its one `.map(` is deliberately not on this scan's surface.
 *
 * A ZERO PIN IS BLIND ON ITS OWN. Five counters reading 0 is equally true of a converged tree and
 * of a tree where the walk broke, the predicate stopped matching, or someone deleted every FAQ on
 * the site. {@link SURFACE_FILES_RENDERING_FAQSECTION} is the derived liveness half that makes the
 * zeros mean something: it counts the surface files that WRITE `<FaqSection` as JSX **and** whose
 * binding for that name resolves to the real module through the shared resolver. The two move
 * together in opposite directions — a page that regresses to hand-written markup raises a spelling
 * counter and lowers the liveness one, and a broken walk lowers BOTH. Neither number is readable
 * without the other, which is the point.
 *
 * Built on `lib/test-support/composition-scan.ts` like its three siblings. What is imported from
 * there: `surfaceFiles` and `walk`, `readSource` and `maskedSource`, the ONE literal extractor
 * behind `jsxElementsOf`, `innermostElementAt` and the element spans and ATTRIBUTES it reads, and
 * the binding resolver `importBindingsOf` / `resolvesTo`. What stays here: the FAQ predicate, the
 * six counters, their docblocks, their mutation records and the one delegation exemption.
 *
 * WHAT THIS FILE ADDED TO THE SHARED SCANNER, and why none of it was a fourth scanner. Every
 * counter below is a POSITION-TO-ELEMENT question — "which element writes `{faq.question}`",
 * "which `<section>` encloses this `.map(`", "is the element holding this `faqPageJsonLd(` call
 * written under a condition" — and `ScannedElement` carried no source span, so there was no way to
 * ask one without walking the text a second time. `ScannedElement.start` / `.end` and
 * `innermostElementAt()` are that gap closed in the shared module, where the other three counters
 * can use them too.
 *
 * `ScannedElement.attributes` is the SAME LESSON, learned once more in review. The shell counter
 * needs a `<section>`'s labelling attributes and the delegation exemption needs the value of a
 * `data={…}` prop, and the first version of this file read both by re-walking the opening tag here
 * — a second attribute parser with its own boundary rules, one module over from `readHeader`,
 * which was already walking every one of those tags to find `className`. That is the T-045 shape:
 * two readers of the same text, each right on its own, drifting silently. `readHeader` now records
 * every top-level attribute in the pass it was already making, `className` among them, and this
 * file reads that map.
 *
 * WHAT STILL WALKS TEXT HERE, and why each is FAQ-specific rather than general:
 *
 *   - {@link matchingParen} — balances a CALL's parentheses over masked text, to find the extent of
 *     a `.map(` callback and of a `faqPageJsonLd(` argument list. The shared scanner balances
 *     braces and tags; nothing in it reads a call, because nothing else here needs to.
 *   - {@link arrayPathOf} and the `mapped` read in {@link faqBlocksIn} — reduce an EXPRESSION to
 *     the array identifier it names (`bolgelerFaqs.map(…)` → `bolgelerFaqs`). That reduction is
 *     the FAQ pairing rule itself, not a fact about JSX.
 *   - {@link memberRead} — locates `.question` / `.answer` reads. Field names are this counter's
 *     subject and no other counter's.
 *
 * None of the three reads a tag, an attribute or an element boundary; all three run over
 * {@link maskedSource}, so a literal or a comment cannot answer for code.
 * ---------------------------------------------------------------------------------------- */

/** The module that DECLARES `faqPageJsonLd`, never a caller of it. */
const FAQ_JSONLD_MODULE = join(repoRoot, "lib/seo/json-ld.tsx");

/**
 * The shared pattern component that renders a FAQ block AND emits its schema, from one `items`
 * array. After Task 9 it is the ONLY `faqPageJsonLd` caller in the repo — and not an exemption: it
 * pairs in its own file by the ordinary same-file rule. See the "one call" test below.
 *
 * It sits in `components/patterns`, which is NOT in `SURFACE_ROOTS`, so its own `.map(` is not a
 * block on this scan's surface. That is what makes the five spelling counters' zero readable as
 * "no hand-written FAQ remains" rather than "no FAQ remains".
 */
const FAQ_SECTION_COMPONENT = join(repoRoot, "components/patterns/faq-section.tsx");

/** The export the surface renders. Resolved through the binding resolver, never grepped for. */
const FAQ_SECTION_EXPORT = "FaqSection";

/** The roots the `faqPageJsonLd` CALLER walk visits — wider than {@link surfaceFiles} on purpose,
 * so a call made from outside the FAQ surface is a failure rather than an omission. */
const JSONLD_CALLER_ROOTS = ["app", "components", "lib"] as const;

/**
 * The `)` that closes the `(` at `open`, over MASKED text.
 *
 * Masked, so a `(` inside a string, a template hole or a regex is already a space by the time this
 * counts it — the same reason {@link maskedSource} exists. Comments are gone one step earlier, in
 * {@link readSource}.
 */
function matchingParen(masked: string, open: number): number {
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    const ch = masked[i]!;
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return masked.length;
}

/** The nearest ancestor of `from` (itself included) satisfying `ok`, or `null`. */
function ancestorWhere(
  elements: readonly ScannedElement[],
  from: number,
  ok: (element: ScannedElement) => boolean,
): ScannedElement | null {
  let cursor: number | null = from;
  while (cursor !== null) {
    const element: ScannedElement = elements[cursor]!;
    if (ok(element)) return element;
    cursor = element.parent;
  }
  return null;
}

/**
 * Is the element at `from` written inside a `{…}` expression, at any level up to the top of its
 * tree? "Might not render", never "does not render" — see {@link ScannedElement.inExpression}.
 *
 * ELEMENTS WITH NO PARENT ARE SKIPPED, and that is a correction rather than a convenience.
 * `jsxElementsOf` scans the WHOLE MODULE, so the top-level walk's brace counter also counts the
 * `{` of every function body and object literal above the JSX — which makes the returned fragment
 * of every page read `inExpression: true`. Measured on `dunya/kita/page.tsx`, whose `<>` is not
 * inside anything at all. A root element is therefore read as unconditional here; a conditional
 * written around a whole module-scope element is invisible (SCOPE note 5).
 */
function writtenUnderCondition(elements: readonly ScannedElement[], from: number): boolean {
  return ancestorWhere(elements, from, (e) => e.parent !== null && e.inExpression) !== null;
}

/** The leading `a.b.c` member path of an expression, with a trailing `.map` call dropped. */
function arrayPathOf(expression: string): string {
  const path = expression.trim().match(/^[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*/);
  if (path === null) return "(not an identifier)";
  return path[0].endsWith(".map") ? path[0].slice(0, -".map".length) : path[0];
}

/** A `.question` / `.answer` MEMBER READ, never a prefix of a longer name — `item.questionId` is
 * not a question. See SCOPE note 2 for what the member-name rule still cannot see. */
const memberRead = (field: string) => new RegExp(`\\.${field}(?![A-Za-z0-9_$])`, "g");

/**
 * ONE FAQ BLOCK — a `.map(` over an array of question/answer pairs whose callback renders JSX.
 *
 * `mapped` is the receiver of the `.map(`, i.e. the array identifier or member path the block
 * renders. `item` is the element the callback opens first; `question` and `answer` are the
 * elements the block's question and answer spellings are attributed to (see {@link faqBlocksIn}
 * for the rule and why it is order-independent); `shell` is the nearest enclosing `<section>`.
 */
type FaqBlock = {
  readonly file: string;
  readonly mapped: string;
  readonly item: ScannedElement;
  readonly question: ScannedElement;
  readonly answer: ScannedElement;
  readonly shell: ScannedElement | null;
  readonly conditional: boolean;
};

/**
 * WHAT A FAQ BLOCK IS, decided by CONTENT, never by a written file list and never by a line number.
 *
 * A `.map(` on the scanned file qualifies when both hold:
 *
 *   1. its callback reads a `.question` member AND an `.answer` member;
 *   2. at least ONE `.question` read and at least ONE `.answer` read sit inside a JSX element.
 *
 * (2) IS THE CLAUSE THAT DOES THE WORK, and it is not defensive programming. Both `turkiye/bolge`
 * pages write a SECOND `.map(` that satisfies (1) exactly — `bolgelerFaqs.map((faq) => ({ question:
 * faq.question, answer: faq.answer }))`, the projection into `faqPageJsonLd` six hundred lines
 * above the markup — and it renders nothing at all. Counting it would report eight blocks, two of
 * them with no item wrapper, no question element and no answer element. The "a FAQ projection is
 * not a FAQ block" control below asserts that both of those maps are still there and still
 * excluded, so clause (2) cannot quietly become inert.
 *
 * ## "AT LEAST ONE", and why the word matters — Ruling CA
 *
 * The first version of this asked whether the FIRST `.question` read sat inside an element that
 * carries a `className`, which made the predicate depend on the ORDER of the arms of a ternary.
 * `components/patterns/faq-section.tsx` renders two mechanisms from one `.map(`: a `list` arm that
 * writes its own `<h3 className=…>` and an `accordion` arm that delegates every class to
 * `components/ui/accordion.tsx` and writes none. With the accordion arm FIRST, the first read had
 * no styled ancestor, the block was rejected, and the component's own `faqPageJsonLd(items)` read
 * as structured data with no markup — so Task 8's implementer had to order the arms and leave a
 * "do not swap these two arms" comment in a product file. That was a property of this scanner
 * being written back into the component, which is exactly backwards.
 *
 * So qualification is now a question about the WHOLE body: any read inside any element qualifies,
 * in any arm, in any order. The `swapping the arms of a two-mechanism block changes nothing`
 * control pins it with both orders of the real component.
 *
 * ## Where a spelling is attributed, stated because it is a choice
 *
 * A block has ONE question spelling and ONE answer spelling even where it writes several arms. The
 * element credited is **the first read, in source order, that has an ancestor carrying a
 * `className`** — and where NO read has one, the innermost element of the first read itself, whose
 * spelling is then the {@link NO_CLASSNAME} marker rather than nothing at all. Two consequences,
 * both intended:
 *
 *   - a block that styles one arm and delegates the other is counted at the spelling it actually
 *     WRITES, which is the thing a convergence counter is for. The delegating arm is not a
 *     spelling of this surface; it is the primitive's.
 *   - a block that styles NEITHER arm is still a block, and enters
 *     {@link FAQ_ITEM_SPELLINGS}/{@link FAQ_QUESTION_SPELLINGS} as `(no className attribute)` —
 *     the same marker the `/deniz` accordion's item wrapper already carries — instead of
 *     disappearing from all six counters.
 *
 * All six blocks on {@link surfaceFiles}'s surface write exactly one `.question` and one `.answer`
 * read, so the attribution rule is inert there today and the six counters are unchanged by it;
 * it exists for the shape Task 9 is about to introduce at all six.
 */
function faqBlocksIn(file: string): FaqBlock[] {
  const masked = maskedSource(file);
  const elements = jsxElementsOf(file);
  const blocks: FaqBlock[] = [];

  /**
   * The element a `field` spelling is credited to across `[open, close)`: the first read, in
   * source order, that has an ancestor carrying a `className`, else the innermost element of the
   * first read. `null` only when NO read of `field` is inside a JSX element — clause (2) failing.
   */
  const attribute = (field: string, open: number, close: number): ScannedElement | null => {
    const hosts: number[] = [];
    for (const read of masked.slice(open, close).matchAll(memberRead(field))) {
      const host = innermostElementAt(elements, open + read.index);
      if (host !== null) hosts.push(host);
    }
    for (const host of hosts) {
      const styled = ancestorWhere(elements, host, (e) => e.spelling !== null);
      if (styled !== null) return styled;
    }
    const first = hosts[0];
    return first === undefined ? null : elements[first]!;
  };

  for (const match of masked.matchAll(/\.map\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = matchingParen(masked, open);
    const body = masked.slice(open, close);
    if (!memberRead("question").test(body) || !memberRead("answer").test(body)) continue;

    const opened = elements.filter((element) => element.start > open && element.start < close);
    const item = opened[0];
    if (item === undefined) continue;

    const question = attribute("question", open, close);
    const answer = attribute("answer", open, close);
    if (question === null || answer === null) continue;

    const mapHost = innermostElementAt(elements, match.index);
    blocks.push({
      file,
      mapped: (masked.slice(0, match.index).match(/[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*$/) ?? [
        "(not an identifier)",
      ])[0],
      item,
      question,
      answer,
      shell: mapHost === null ? null : ancestorWhere(elements, mapHost, (e) => e.tag === "section"),
      conditional: mapHost !== null && writtenUnderCondition(elements, mapHost),
    });
  }
  return blocks;
}

function faqBlocks(): FaqBlock[] {
  return surfaceFiles().flatMap(faqBlocksIn);
}

/** The spelling a counter files an element under: its class string, or the no-classes marker. */
function spellingOf(element: ScannedElement | null): string {
  if (element === null) return "(no <section> ancestor)";
  return element.spelling ?? NO_CLASSNAME;
}

/**
 * The attributes a `<section>` uses to say WHICH section it is — its label, its landmark role and
 * its in-page anchor. A closed list: everything else a shell wears (`className`, `style`, event
 * handlers) is treatment, not identity.
 */
const SHELL_LABELLING_ATTRIBUTES = ["aria-label", "aria-labelledby", "id", "role", "tabIndex"];

function labellingStrategyOf(block: FaqBlock): string {
  if (block.shell === null) return "(no <section> ancestor)";
  // `ScannedElement.attributes` is the shell's OWN opening tag, read by the one walk in
  // `readHeader`. The `id` on the `<h2>` inside the section belongs to the `<h2>`'s record, so
  // there is nothing to slice carefully around and no second parser to drift from the first.
  const labelling = SHELL_LABELLING_ATTRIBUTES.filter((name) => block.shell!.attributes.has(name));
  return labelling.length === 0 ? "(unlabelled)" : labelling.join("+");
}

/** A shell is its treatment AND its identity strategy — see {@link FAQ_SECTION_SHELLS}. */
function shellSignatureOf(block: FaqBlock): string {
  return `${spellingOf(block.shell)} :: ${labellingStrategyOf(block)}`;
}

function report(rows: ReadonlyArray<readonly [string, string]>): string {
  const grouped = new Map<string, string[]>();
  for (const [key, file] of rows) grouped.set(key, [...(grouped.get(key) ?? []), file]);
  return [...grouped]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(
      ([key, files]) => `  ${files.length}x ${key}\n${files.map((f) => `      ${f}`).join("\n")}`,
    )
    .join("\n");
}

function spellingReport(pick: (block: FaqBlock) => string): string {
  return report(faqBlocks().map((block) => [pick(block), label(block.file)] as const));
}

/* ---------------------------------------------------------------------------------------------
 * THE JSON-LD SIDE
 * ------------------------------------------------------------------------------------------ */

/** One `faqPageJsonLd(X)` call: the file, the array expression `X`, and whether the element
 * holding the call is written under a condition. */
type FaqJsonLdCall = {
  readonly file: string;
  readonly array: string;
  readonly holder: string;
  readonly conditional: boolean;
};

function faqJsonLdCallsIn(file: string): FaqJsonLdCall[] {
  if (file === FAQ_JSONLD_MODULE) return [];
  const masked = maskedSource(file);
  const elements = jsxElementsOf(file);
  const calls: FaqJsonLdCall[] = [];
  for (const match of masked.matchAll(/\bfaqPageJsonLd\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = matchingParen(masked, open);
    const holder = innermostElementAt(elements, match.index);
    calls.push({
      file,
      array: arrayPathOf(readSource(file).slice(open + 1, close)),
      holder: holder === null ? "(outside every element)" : elements[holder]!.tag,
      conditional: holder !== null && writtenUnderCondition(elements, holder),
    });
  }
  return calls;
}

function faqJsonLdCalls(): FaqJsonLdCall[] {
  return JSONLD_CALLER_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .sort()
    .flatMap(faqJsonLdCallsIn);
}

/**
 * THE EXEMPTION IS GONE, AND THAT IS THE FINDING.
 *
 * `DELEGATED_FAQ_MARKUP` used to live here: a four-halved rule exempting the four
 * `deniz/{akdeniz,ege,karadeniz,marmara}` pages, which each emitted `faqPageJsonLd(basinData.faq)`
 * for markup written one file away in `V2SeaBasinDetailView`. It was a careful rule and it worked;
 * it was also a standing tolerance for the exact shape {@link FAQ_JSONLD_WITHOUT_MARKUP} exists to
 * forbid, kept only because that split was real.
 *
 * Task 9 removed the split rather than the rule's teeth. The four pages now build
 * `<FaqSection items={basinData.faq} …/>` themselves and hand it to the view as a `ReactNode`
 * prop, so schema and markup are one array inside one component and pair by the ORDINARY same-file
 * rule. With no page left to exempt, the rule and its four liveness halves describe nothing — and
 * a control with no subject is not kept as documentation, because a reader cannot tell it from one
 * that is still load-bearing. Deleted, with the reason recorded here and the mutation history in
 * the counter docblock below.
 *
 * WHY THE VIEW TAKES A PROP rather than importing `FaqSection`: it is a Client Component, and
 * `FaqSection` reaches `lib/seo/json-ld`, which is `server-only`. That boundary is
 * `components/patterns/rsc-boundary.test.ts`'s subject, not this file's.
 */
function jsonLdWithoutMarkup(): FaqJsonLdCall[] {
  return faqJsonLdCalls().filter(
    (call) => !faqBlocksIn(call.file).some((block) => block.mapped === call.array),
  );
}

/* ---------------------------------------------------------------------------------------------
 * THE LIVENESS HALF — what the five zeros are read against
 * ------------------------------------------------------------------------------------------ */

/**
 * The surface files that really RENDER {@link FAQ_SECTION_EXPORT}: they write it as a JSX tag AND
 * their binding for that name resolves to `components/patterns/faq-section.tsx` through the shared
 * resolver — the same shape `SURFACE_FILES_RENDERING_STATTILE` uses in `page-composition-cards.ts`.
 *
 * BOTH HALVES ARE LOAD-BEARING, and the mutation record below drives each on its own:
 *
 *   - JSX without the import — a local `function FaqSection()` shadowing the name, or a
 *     `<FaqSection>` left behind after the import was dropped — resolves to nothing and is NOT
 *     counted. A substring scan for `<FaqSection` would count it and read a converged surface
 *     where there is a build error.
 *   - the import without JSX — a file that imports the component and renders nothing — is NOT
 *     counted either, which is the dead-reference shape that makes an adoption counter lie.
 */
function surfaceFilesRenderingFaqSection(): string[] {
  return surfaceFiles()
    .filter((file) => {
      const bindings = importBindingsOf(file);
      return jsxElementsOf(file).some((element) => {
        const bound = bindings.get(element.tag);
        return bound !== undefined && resolvesTo(bound, FAQ_SECTION_COMPONENT, FAQ_SECTION_EXPORT);
      });
    })
    .map(label)
    .sort();
}

/**
 * THE HAND-WRITTEN FAQ SURFACE IS EMPTY — measured 2026-09-18 on `feature/t-035-pr5-faq` after
 * Task 9, by the predicate {@link faqBlocksIn} states, not predicted.
 *
 * WHAT WAS HERE BEFORE, kept as the thing the zeros are a delta from (measured at `ea65d42`,
 * `dev` after PR4, and unchanged from the plan's own Measurements section — 4 / 3 / 4 / 4 / 1 / 0):
 *
 * | file                                                | item wrapper            | question   | answer  | shell                          |
 * | --------------------------------------------------- | ----------------------- | ---------- | ------- | ------------------------------ |
 * | `components/v2/v2-marine-faq-accordion.tsx`         | `<AccordionItem>`, none | `<span>` A | `<p>` A | `space-y-6` + `aria-labelledby` |
 * | `components/v2/v2-sea-basin-detail-view.tsx`        | `p-5 rounded-2xl …`  B  | `<h3>` B   | `<p>` B | `space-y-5` + `aria-labelledby` |
 * | `app/[locale]/(site)/turkiye/bolge/page.tsx`        | `p-5 rounded-2xl …`  C  | `<h3>` C   | `<p>` C | `scroll-mt-28` + `id`+`tabIndex` |
 * | `app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx` | `p-5 rounded-2xl …`  C  | `<h3>` C   | `<p>` C | `scroll-mt-28` + `id`+`tabIndex` |
 * | `app/[locale]/(site)/dunya/kita/page.tsx`           | `rounded-2xl border …` D| `<h3>` C   | `<p>` D | `space-y-6` + `id`             |
 * | `app/[locale]/(site)/dunya/kita/[slug]/page.tsx`    | `rounded-2xl border …` D| `<h3>` C   | `<p>` D | `space-y-6` + `id`             |
 *
 * Four item spellings, three question spellings, four answer spellings, four shells, one block
 * whose question was not a heading at all. All six rows are now `<FaqSection>` and every one of
 * those counters is **0**, against {@link SURFACE_FILES_RENDERING_FAQSECTION} = 9.
 *
 * Nine rather than six, and the three extra are not a surprise: the four `deniz` basin pages build
 * the component and pass it INTO `V2SeaBasinDetailView` as a prop (that view is a Client Component
 * and `FaqSection` reaches `server-only`), so the four pages count and the one view does not —
 * four where the old table had one row. Five pages + four basin pages = 9.
 *
 * TWO FIGURES IN THE PLAN ARE WRONG, BY THE SAME MISTAKE, and neither is one of the six.
 *
 *   - the sea-basin data is called "4 basins, 13 questions"; it is **12**, 3 per basin. 13 is the
 *     number of `question:` occurrences in `lib/marine/sea-basins-detail.ts`, one of which is the
 *     `SeaBasinFAQ` interface's own field declaration.
 *   - the continent data is called "7 continents, 29 questions"; it is **28**, 4 per continent. 29
 *     is the `question:` count in `lib/geo/continents.ts`, one of which is that file's own
 *     interface field declaration.
 *
 * That is the grep-counts-the-declaration mistake **three times now** — one door over from the
 * grep-counts-the-docblock one this repo has recorded four times. Both are asserted below, from
 * the DATA rather than from a grep, which is the only reason the second one was found: Ruling BX
 * said re-measure instead of quoting, and the quoted figure was wrong again.
 *
 * ## SCOPE — what these counters cannot see
 *
 * Every claim below is a claim about SOURCE TEXT read by `scanJsx`, never about a rendered DOM, a
 * computed style or a page that was actually requested. Specifically:
 *
 *   1. **A FAQ block that does not `.map()` is not a block here at all.** The population is derived
 *      from `.map(` calls, so seven hand-copied `<div>` pairs, a `for…of` push into an array, or a
 *      `<details>`/`<summary>` list would contribute to none of the spelling counters — including
 *      {@link FAQ_JSONLD_WITHOUT_MARKUP}, where it would read as markup MISSING and fail loudly,
 *      which is the safe direction. There is nothing left to miss on this surface today: the
 *      population is empty, and a regression ARRIVING as a `.map(` is the shape these counters
 *      catch. One that arrives as seven copied `<div>`s is caught by
 *      {@link SURFACE_FILES_RENDERING_FAQSECTION} falling instead, which is precisely why a zero
 *      pin needed a liveness half rather than more scanner.
 *   2. **The question and the answer are located by a MEMBER NAME.** `.question` and `.answer` are
 *      what all six blocks happen to call their fields. A block whose type spells them `soru` and
 *      `cevap`, or which destructures `const { question, answer } = item` and writes a bare
 *      `{question}`, is invisible to every counter here. That is what Task 8 had to respect:
 *      `FaqSection` reads `item.question` inside its own `.map(`, and a version rendering
 *      `<FaqItem {...entry} />` would have dropped out of every counter silently.
 *
 *      The read is matched with a right-hand word boundary ({@link memberRead}), so `.questionId`
 *      and `.answerHtml` are NOT question and answer reads. There is no LEFT boundary and there
 *      cannot usefully be one: `item.question` and `faq.question` must both match, so the rule is
 *      "a `.question` member of anything". A field named `question` on an object that is not a FAQ
 *      entry, mapped beside an `.answer` in the same callback, would qualify. Nothing on this
 *      surface writes one.
 *   3. **"Nearest element with a className" skips an unstyled wrapper.** Five of six blocks write
 *      `<span>{faq.question}</span>` with no classes inside a styled `<h3>`, and the counter files
 *      the spelling under the `<h3>`. That is the intent — a bare span is not a treatment — but it
 *      means moving the classes from the `<h3>` onto that span re-spells the block without changing
 *      a pixel, and {@link FAQ_QUESTION_SPELLINGS} would move. Where a block writes SEVERAL reads
 *      (a two-mechanism `.map(`), only the first styled one is credited — {@link faqBlocksIn}
 *      states that rule and why it is order-independent.
 *   4. **No gate is evaluated, anywhere.** `inExpression` records that an element is written inside
 *      a `{…}`, never what the expression is or whether it is true.
 *
 *      THIS BLIND SPOT IS LARGELY GONE, and not because the scanner got better. The shape it could
 *      not see was **a page whose JSON-LD gate and markup gate are both present but DIFFER** —
 *      `{locale === "tr" && <JsonLd …/>}` beside `{region.faqs?.length > 0 && <section>…</section>}`
 *      reads as "both conditional", agrees, and publishes FAQPage data an `/en` reader cannot see.
 *      Task 9 removed the two-gate shape itself: there is exactly ONE gate now, `FaqSection`'s own
 *      `structuredData !== false && isIndexable(locale, structuredData)`, computed inside the
 *      component from props the caller cannot spell inconsistently, over the same `items` the
 *      markup maps. Two gates cannot disagree when there is one. A counter that cannot decide a
 *      property is weaker than a design where the property cannot fail; this is the second.
 *
 *      What remains unevaluated is the callers' own `{locale === "tr" && <FaqSection …/>}` — the
 *      `/deniz` block, gated at page level because `messages/en.json` has no `Deniz.q*`. That is a
 *      gate on BOTH halves at once (the component emits nothing at all when not rendered), so it
 *      cannot produce the asymmetry this note is about.
 *   5. **A root element reads as unconditional.** `jsxElementsOf` scans the whole module, so the
 *      top-level brace counter also counts the `{` of every function body above the JSX and the
 *      returned `<>` of every page reads `inExpression: true`. {@link writtenUnderCondition}
 *      therefore ignores elements with no parent, which means a conditional wrapped around a whole
 *      module-scope element — `const Block = cond ? <section …/> : null` — is invisible. Nothing on
 *      this surface writes one.
 *   6. **Pairing is same-file, with NO exemption at all any more.** {@link FAQ_JSONLD_WITHOUT_MARKUP}
 *      asks whether the identifier passed to `faqPageJsonLd` is the identifier a FAQ block in the
 *      same file maps, and that is now the whole rule: the `DELEGATED_FAQ_MARKUP` exemption that
 *      used to cross one file boundary for the four `deniz` basin pages is deleted, because those
 *      pages stopped emitting a schema for markup written elsewhere. A delegation arriving again
 *      is a FAILURE, by design — it must be reasoned about and named, not absorbed.
 *   7. **Identifier identity is TEXTUAL.** `faqPageJsonLd(region.faqs)` beside a
 *      `region.faqs.map(…)` pairs; `faqPageJsonLd(faqs)` beside `region.faqs.map(…)` does not, even
 *      where `const faqs = region.faqs` sits between them. The direction is safe — an alias reads
 *      as markup missing and fails. Task 9 kept the two spellings identical rather than introducing
 *      a local alias, which is why the single surviving caller pairs.
 *   8. **No line numbers, anywhere.** {@link readSource} collapses each comment to one space, so an
 *      index into it is not a source line (T-043). Every failure message names FILES.
 *   9. **Outside the walks nothing is seen, and both walks are `.tsx`-only.** Blocks are scanned
 *      over {@link surfaceFiles} (the reading and play page roots plus `components/v2`);
 *      `faqPageJsonLd` CALLS are scanned over the wider `app/`, `components/` and `lib/`, so a call
 *      from a file on neither surface is a failure rather than an omission — the "one call"
 *      control pins the whole population as an exact identity.
 *
 *      `components/patterns` is on the CALLER walk and NOT on the block walk, which is the asymmetry
 *      the whole end state rests on: `FaqSection`'s schema is seen and pinned, its markup `.map(`
 *      is not a block on this surface, and so the five spelling counters read the HAND-WRITTEN
 *      surface exactly. That was true before Task 9 too; it only became load-bearing after.
 *
 *      But `walk()` returns `.tsx` files only (`composition-scan.ts`), so **a `faqPageJsonLd` call
 *      written in a `.ts` module is invisible to this file entirely** — it is not counted, not
 *      paired and not reported as an orphan. That is not hypothetical-only: a helper that builds a
 *      schema array and hands it to a page would naturally be a `.ts` file. It is left as it is
 *      because widening the walk to `.ts` would change what THREE other counter files scan through
 *      a shared walker; the honest statement is that this counter's caller population is the
 *      `.tsx` one.
 *   10. **Markup with NO structured data is not a defect here, and is not counted.** Every counter
 *      runs from the schema side or from the block side separately; nothing asks "does this FAQ
 *      block emit a schema?". `/deniz` is still exactly that shape — eight questions, no `FAQPage`,
 *      now spelled `structuredData={false}` on a `FaqSection` rather than by a component that could
 *      not emit one if it tried — and it is the block the plan says must stay able to decline
 *      structured data, which is why that prop defaults to `false`. So the asymmetry is deliberate:
 *      schema without markup is a violation and is pinned at 0; markup without schema is a choice
 *      and is pinned nowhere.
 *   11. **A JSX tag is counted, an evaluation is not.** {@link SURFACE_FILES_RENDERING_FAQSECTION}
 *      proves a file WRITES `<FaqSection>` with the real import bound — not that the element is
 *      reachable, that its `items` is non-empty, or that a reader ever sees it. `/deniz`'s block
 *      sits behind a `locale === "tr"` gate and counts exactly like an ungated one. The counter is
 *      an adoption floor, not a rendering proof; the visual round is what checked rendering.
 *
 * ## MUTATION RECORD
 *
 * Each counter driven AT THE VALUE IT IS PINNED AT — never at some earlier number — each edit
 * reverted from a copy and the suite re-run green.
 *
 * ### Round 3, 2026-09-18, Task 9 — at the NEW values (0 / 0 / 0 / 0 / 0 / 0 / 9 / 1)
 *
 * A zero cannot be raised by breaking something; it is driven by ADDING the shape it forbids. Each
 * of these re-spells or un-adopts one real block and watches the pair of counters move oppositely:
 *
 *   - `dunya/kita/page.tsx` reverted to its pre-Task-9 hand-written FAQ block (the `<section
 *     id="sss">` with its own item/question/answer spellings, `<FaqSection>` removed) — RED on
 *     FIVE counters at once, each naming the file: `expected 1 to be 0` on item wrappers, on
 *     question elements, on answer elements and on section shells, AND `expected 8 to be 9` on
 *     {@link SURFACE_FILES_RENDERING_FAQSECTION}. That opposite motion is the whole design: a
 *     spelling counter rising while the liveness counter falls is un-adoption, and neither number
 *     says it alone.
 *   - the same revert with the question written as a `<p>` instead of an `<h3>` — RED additionally
 *     on {@link FAQ_BLOCKS_WITHOUT_HEADINGS}, `expected 1 to be 0`, naming the file.
 *   - `<FaqSection>`'s import removed from `deniz/akdeniz/page.tsx` while the JSX stays (the
 *     shadowed/dangling shape) — RED, `expected 8 to be 9`, and the file is absent from the listed
 *     population. A substring scan for `<FaqSection` would have counted it and read 9.
 *   - the JSX removed from `deniz/akdeniz/page.tsx` while the IMPORT stays (the dead-reference
 *     shape) — RED, `expected 8 to be 9`. Both halves of the predicate are therefore live.
 *   - `items.map(` → `items.slice().map(` in `faq-section.tsx` — the caller list is untouched and
 *     RED lands only on the claim it does not entail: `FaqSection's schema and its markup are no
 *     longer one identifier in one file: expected [ '(not an identifier)' ] to include 'items'`.
 *   - `faqPageJsonLd(basinData.faq)` restored to `deniz/akdeniz/page.tsx`'s schema array (the
 *     delegation shape, now that nothing exempts it) — RED on {@link FAQ_JSONLD_WITHOUT_MARKUP},
 *     `expected 1 to be 0`, naming `deniz/akdeniz/page.tsx — faqPageJsonLd(basinData.faq)`, and
 *     RED on the exact-identity assertion below. This is the mutation that proves deleting
 *     `DELEGATED_FAQ_MARKUP` removed a tolerance rather than a guard.
 *   - one `Deniz.q4` edited to duplicate `Deniz.q3` — RED on Ruling CE's uniqueness assertion
 *     (`lib/marine/deniz-faq.test.ts`), which matters because `FaqSection` keys its items and
 *     tracks accordion panel state BY the question string.
 *   - `lib/geo/continents.ts`'s `avrupa.faqs` cut from 4 entries to 3 — RED, `expected 27 to be
 *     28`, with the per-continent breakdown in the message. The same drive on
 *     `SEA_BASINS_DETAIL.ege.faq` — RED, `expected 11 to be 12`.
 *
 * ### Rounds 1–2, 2026-09-18, Task 7 — at the PRE-ADOPTION values (4 / 3 / 4 / 4 / 1 / 0)
 *
 * History. Every subject below is gone from the tree; the record is kept because it is what those
 * counters were shown to catch while they still had one, and a counter's past is how a reader
 * judges the zero that replaced it.
 *
 *   - `dunya/kita/page.tsx`'s item wrapper re-spelled `p-5 space-y-2` → `p-6 space-y-3` — RED,
 *     `expected 5 to be 4`, the message listing all five spellings with their files;
 *   - the same page's question `<h3>` re-spelled `text-sm` → `text-base` — RED, `expected 4 to be
 *     3`, and the `<h3>` ×5 / `<span>` ×1 assertion alongside it;
 *   - the same page's answer `<p>` re-spelled `pl-4` → `pl-6` — RED, `expected 5 to be 4`;
 *   - `tabIndex={-1}` added to that page's `<section id="sss">` — RED, `expected 5 to be 4` on the
 *     shells with NO change of className, which is the (treatment, identity) pair earning its keep;
 *   - `v2-sea-basin-detail-view.tsx`'s question `<h3>` rewritten as a `<div>` — RED, `expected 2 to
 *     be 1`, naming the accordion and the sea-basin view;
 *   - `HUB_FAQS.map(` rewritten `HUB_FAQS.slice().map(` — RED on {@link FAQ_JSONLD_WITHOUT_MARKUP},
 *     `expected 1 to be 0`, naming `dunya/kita/page.tsx — faqPageJsonLd(HUB_FAQS)`;
 *   - the `locale === "tr" &&` gate removed from `turkiye/bolge/page.tsx`'s `<JsonLd>` while its
 *     markup stayed gated — RED on the pair-agreement control, `JSON-LD conditional=false, markup
 *     conditional=true`. That is the plan's finding 2 exactly. **Task 9 dissolved that shape**: one
 *     gate, computed inside the component, over the same array as the markup (SCOPE note 4).
 *   - the exemption, one half at a time: `data={basinData}` on `deniz/akdeniz` → `data={{
 *     ...basinData }}` — RED, the page dropping out of the exempt four and into the counter;
 *     `data.faq.map(` in the delegate → `data.faqs.map(` — RED on all four pages at once
 *     (`expected 4 to be 0`) plus the delegate's own liveness row.
 *   - Ruling CA: the attribution rule reverted to "the FIRST `.question` read" — RED on `swapping
 *     the arms of a two-mechanism block changes nothing`, `expected [] to deeply equal [ { mapped:
 *     'items', …(3) } ]`.
 *   - the zero pin's split: `dunya/kita/[slug]`'s `<JsonLd schema={faqPageJsonLd(continent.faqs)}
 *     />` DELETED — orphans stayed 0 so the pin stayed green, and the split went RED: `calls paired
 *     by the same-file identifier rule: expected [ …(4) ] to have a length of 5 but got 4`.
 *   - Ruling CD: the arms located by balanced parentheses rather than by the literals `<Card
 *     key={index}` / `<AccordionItem key={index}`, and the product change that lock forbade made —
 *     both React keys are `item.question`.
 *
 * WHERE THE PROBES LIVE. Every control that adds markup rather than breaking it injects into
 * `app/[locale]/(site)/hakkimizda/page.tsx`, which renders no FAQ and which neither Task 8 nor
 * Task 9 touched — so no control here depended on markup those tasks were contracted to rewrite,
 * the rule PR3 paid for five times and PR4 three. That rule is why this file's CONTROLS all
 * survived Task 9 untouched while its COUNTERS all moved, which is exactly the intended split.
 *
 * The verbatim RED is in `.superpowers/sdd/2026-09-18-page-composition-pr5-pr6/task-7-report.md`
 * (rounds 1–2) and `task-9-report.md` (round 3).
 */
export const FAQ_ITEM_SPELLINGS = 0;

/** Distinct spellings of the element that carries the question text, across hand-written blocks.
 * Was 3, in two element types (`<h3>` ×5, `<span>` ×1); the `<span>` was the `/deniz` accordion and
 * {@link FAQ_BLOCKS_WITHOUT_HEADINGS}'s whole subject. */
export const FAQ_QUESTION_SPELLINGS = 0;

/**
 * Distinct spellings of the element that carries the answer text, across hand-written blocks.
 *
 * Was 4: the four static grids differed only in their left indent (`pl-4`, `pl-5`, `pl-7`) — the
 * gutter under a question marker each block drew differently — plus the accordion's `pt-2 pl-11`.
 * That was called the cheapest convergence on this surface, and it is the one that landed: there
 * is one indent now because there is one component.
 */
export const FAQ_ANSWER_SPELLINGS = 0;

/** Distinct `(treatment, identity strategy)` pairs across the enclosing `<section>`s. Was 4 across
 * three identity strategies (`aria-labelledby`, `id`, `id`+`tabIndex`) — `FaqSection` writes one
 * `<section id aria-labelledby tabIndex className="scroll-mt-28 …">` for every caller, so all
 * three collapsed together with the treatment. */
export const FAQ_SECTION_SHELLS = 0;

/** Blocks whose question element is not an `<h1>`…`<h6>`. Was 1 — the `/deniz` accordion, whose
 * questions sat in a `<span>` inside a `<button>` and contributed nothing to the document outline.
 * `FaqSection`'s accordion arm takes its `<h3>` from `Accordion.Header`, which is why
 * `components/ui/accordion.tsx` had to be rebuilt on Base UI before Task 9 could run. */
export const FAQ_BLOCKS_WITHOUT_HEADINGS = 0;

/**
 * Surface files that render `<FaqSection>` with the real import bound — the LIVENESS half the five
 * zeros above are read against. Nine: five pages that render it directly
 * (`turkiye/bolge`, `turkiye/bolge/[slug]`, `dunya/kita`, `dunya/kita/[slug]`, `deniz`) plus the
 * four `deniz/*` basin pages, which build it and pass it to `V2SeaBasinDetailView` as a prop
 * because that view is a Client Component and `FaqSection` reaches `server-only`.
 *
 * Expected to RISE. A new reading page with questions on it adds one; nothing legitimately removes
 * one except deleting a page, so a FALL is the signal — un-adoption, a dropped import, or a walk
 * that stopped seeing the surface.
 */
export const SURFACE_FILES_RENDERING_FAQSECTION = 9;

/**
 * `faqPageJsonLd(X)` calls where no FAQ block in the same file maps `X`. **This is the counter that
 * matters, and 0 is the only correct value on a shipped tree**: anything above it is structured
 * data published for questions no reader can see, which is Google's own definition of a violation
 * and what `faqPageJsonLd`'s docblock already required of its callers with nothing enforcing it.
 *
 * It asserts the WEAKER, DECIDABLE property, deliberately. PR3 spent four review rounds learning
 * that a reachability counter cannot evaluate a condition. What is decided is identifier identity
 * in one file — and after Task 9 that is the WHOLE rule, with no exemption beside it: the single
 * surviving call and the markup it describes are the same `items` identifier in the same
 * component. SCOPE notes 4 and 6 state what remains invisible, which is much less than it was.
 */
export const FAQ_JSONLD_WITHOUT_MARKUP = 0;

/* ---------------------------------------------------------------------------------------------
 * THE SCANNER'S OWN CONTROLS
 * ------------------------------------------------------------------------------------------ */

/** A page that renders no FAQ and that neither Task 8 nor Task 9 is contracted to touch. */
const PROBE_HOST = join(repoRoot, "app/[locale]/(site)/hakkimizda/page.tsx");

/** A complete synthetic FAQ block: its own shell, item, question and answer spellings, none of
 * which occurs anywhere on the real surface. Appended at module scope, so `jsxElementsOf` — which
 * scans the whole module, not just the default export — sees it. */
function probeBlock(options: { readonly array: string; readonly questionTag: string }): string {
  return [
    `const ${options.array} = [{ question: "q", answer: "a" }];`,
    `function FaqProbe() {`,
    `  return (`,
    `    <section aria-label="probe" className="probe-shell-spelling">`,
    `      <div className="probe-grid">`,
    `        {${options.array}.map((faq, i) => (`,
    `          <article key={i} className="probe-item-spelling">`,
    `            <${options.questionTag} className="probe-question-spelling">`,
    `              <span>{faq.question}</span>`,
    `            </${options.questionTag}>`,
    `            <p className="probe-answer-spelling">{faq.answer}</p>`,
    `          </article>`,
    `        ))}`,
    `      </div>`,
    `    </section>`,
    `  );`,
    `}`,
  ].join("\n");
}

function withProbe<T>(probe: string, fn: () => T): T {
  return withInjectedSource([[PROBE_HOST, `${readFileSync(PROBE_HOST, "utf8")}\n${probe}\n`]], fn);
}

describe("the FAQ block scanner", () => {
  it("finds no hand-written FAQ block on the surface — and nine files rendering FaqSection", () => {
    // THE ZERO AND ITS LIVENESS HALF, IN ONE TEST, because neither is readable alone. An empty
    // block population is what convergence looks like AND what a broken walk looks like; the
    // second assertion is what tells them apart, and it is derived from the real import graph
    // rather than from a list of paths.
    const blocks = faqBlocks();
    expect(
      blocks.map((block) => label(block.file)).sort(),
      `hand-written FAQ blocks found:\n${blocks
        .map((b) => `  ${label(b.file)} over ${b.mapped}`)
        .join("\n")}`,
    ).toEqual([]);

    const rendering = surfaceFilesRenderingFaqSection();
    expect(rendering, `files rendering <FaqSection>:\n${rendering.join("\n")}`).toEqual([
      "app/[locale]/(site)/deniz/akdeniz/page.tsx",
      "app/[locale]/(site)/deniz/ege/page.tsx",
      "app/[locale]/(site)/deniz/karadeniz/page.tsx",
      "app/[locale]/(site)/deniz/marmara/page.tsx",
      "app/[locale]/(site)/deniz/page.tsx",
      "app/[locale]/(site)/dunya/kita/[slug]/page.tsx",
      "app/[locale]/(site)/dunya/kita/page.tsx",
      "app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx",
      "app/[locale]/(site)/turkiye/bolge/page.tsx",
    ]);
    expect(rendering).toHaveLength(SURFACE_FILES_RENDERING_FAQSECTION);

    // The walk is still wide enough to reach `components/v2`, where two of the six old blocks
    // lived — otherwise the empty population above would be a statement about `app/` only.
    expect(
      surfaceFiles().filter((file) => file.includes("/components/v2/")).length,
    ).toBeGreaterThan(20);
  });

  it("the liveness counter needs BOTH the import and the JSX — negative controls", () => {
    // Driven on the probe host, so nothing here depends on a real page's markup. Each half is
    // removed on its own and the file must NOT be counted either way.
    const real = `import { FaqSection } from "@/components/patterns/faq-section";\n`;
    const jsx = `function FaqProbe2() {\n  return <FaqSection heading="h" locale="tr" items={[]} />;\n}\n`;
    const counted = (probe: string) =>
      withProbe(probe, surfaceFilesRenderingFaqSection).includes(label(PROBE_HOST));

    expect(counted(`${real}${jsx}`), "import + JSX must be counted").toBe(true);
    // JSX with no import — a dangling tag or a local shadow. A substring scan would count this.
    expect(counted(jsx), "JSX with no resolvable import must not be counted").toBe(false);
    // The import with no JSX — the dead-reference shape.
    expect(counted(real), "an unused import must not be counted").toBe(false);
    // An import of the same NAME from somewhere else does not qualify.
    expect(
      counted(`import { FaqSection } from "@/components/ui/card";\n${jsx}`),
      "a FaqSection bound to another module must not be counted",
    ).toBe(false);
  });

  it("a FAQ projection is not a FAQ block — clause (2) is still live", () => {
    // The two `turkiye/bolge` projections are gone with the hand-written markup, so this is driven
    // on the PROBE instead of on a page: a `.map(` that reads `.question` and `.answer` and renders
    // nothing must not be a block, and clause (2) must be what says so.
    const projection = [
      `const PROJECTED_FAQS = [{ question: "q", answer: "a" }];`,
      `const projected = PROJECTED_FAQS.map((faq) => ({`,
      `  question: faq.question,`,
      `  answer: faq.answer,`,
      `}));`,
    ].join("\n");

    const masked = withProbe(projection, () => maskedSource(PROBE_HOST));
    const qualifying = [...masked.matchAll(/\.map\s*\(/g)].filter((match) => {
      const open = match.index + match[0].length - 1;
      const body = masked.slice(open, matchingParen(masked, open));
      return memberRead("question").test(body) && memberRead("answer").test(body);
    });
    expect(qualifying, "the projection map was not injected").toHaveLength(1);
    expect(
      withProbe(projection, () => faqBlocksIn(PROBE_HOST)),
      "a map that renders no JSX is not a FAQ block",
    ).toHaveLength(0);

    // …and the SAME array with a rendering callback IS one, so the discrimination is live rather
    // than a scan that rejects everything.
    expect(
      withProbe(`${projection}\n${probeBlock({ array: "OTHER_FAQS", questionTag: "h3" })}`, () =>
        faqBlocksIn(PROBE_HOST),
      ),
    ).toHaveLength(1);
  });

  /**
   * RULING CA — THE PREDICATE MUST NOT DEPEND ON THE ORDER OF A TERNARY'S ARMS.
   *
   * `components/patterns/faq-section.tsx` renders two mechanisms from one `.map(`: a `list` arm
   * that writes its own `<h3 className=…>` and an `accordion` arm that writes no classes at all
   * (`components/ui/accordion.tsx` owns that look). The first version of {@link faqBlocksIn} asked
   * whether the FIRST `.question` read had a styled ancestor, so with the accordion arm first the
   * block was REJECTED and the component's own `faqPageJsonLd(items)` read as a schema with no
   * markup — and Task 8's implementer had to order the arms and leave a "do not swap these two
   * arms" comment in a product file to keep this suite green. A scanner's internals leaking into a
   * component's source is the defect; this is the fix, pinned.
   *
   * Driven on the REAL component with its two arms swapped, not on a fixture, because the shape
   * that broke is the real one. The swap is textual and mechanical — the two arms of the ternary
   * exchanged — and the assertion is that everything the counters read stays identical.
   */
  it("swapping the arms of a two-mechanism block changes nothing", () => {
    // BOTH ARMS ARE LOCATED STRUCTURALLY — Ruling CD. The first version sliced them by the exact
    // literals `<Card key={index}` and `<AccordionItem key={index}`, which is a PREFIX LOCK on a
    // product file: renaming a prop there would have broken this control, which is the leak Ruling
    // CA closed arriving from the other side. Nothing below names a prop, a component or a class.
    //
    // The shape found is `<test> ? ( <armA> ) : ( <armB> )` inside the FAQ `.map(`'s callback, and
    // the parentheses are balanced with `matchingParen` over masked text — the same reader the
    // block predicate uses, so a `)` inside a string or a template hole cannot end an arm early.
    const source = readSource(FAQ_SECTION_COMPONENT);
    const masked = maskedSource(FAQ_SECTION_COMPONENT);
    const skipSpace = (at: number) => {
      let i = at;
      while (i < masked.length && /\s/.test(masked[i]!)) i += 1;
      return i;
    };

    // The FAQ map itself, by the block predicate's own two clauses rather than by position.
    const map = [...masked.matchAll(/\.map\s*\(/g)].find((match) => {
      const open = match.index + match[0].length - 1;
      const body = masked.slice(open, matchingParen(masked, open));
      return memberRead("question").test(body) && memberRead("answer").test(body);
    });
    expect(map, "FaqSection no longer maps a question/answer array").toBeDefined();
    const mapOpen = map!.index + map![0].length - 1;
    const mapClose = matchingParen(masked, mapOpen);

    // `(item, index) =>` then the ternary. The arrow ends the parameter list, so the first `?`
    // after it is the conditional's.
    const arrow = masked.indexOf("=>", mapOpen);
    const testStart = skipSpace(arrow + 2);
    const question = masked.indexOf("?", testStart);
    const armAOpen = skipSpace(question + 1);
    expect(masked[armAOpen], "the callback is no longer `<test> ? ( … ) : ( … )`").toBe("(");
    const armAClose = matchingParen(masked, armAOpen);
    const colon = skipSpace(armAClose + 1);
    expect(masked[colon], "the conditional has no else arm").toBe(":");
    const armBOpen = skipSpace(colon + 1);
    expect(masked[armBOpen], "the else arm is not a parenthesised expression").toBe("(");
    const armBClose = matchingParen(masked, armBOpen);
    expect(armBClose, "the two arms are not inside the map call").toBeLessThan(mapClose);

    const test = source.slice(testStart, question);
    const armA = source.slice(armAOpen + 1, armAClose);
    const armB = source.slice(armBOpen + 1, armBClose);

    // Anti-vacuity: the two arms were really found, and really differ in the way that matters —
    // one writes a className and the other delegates every class to the primitive it renders.
    expect(armA, "the styled arm was not located").toContain("className=");
    expect(armB, "the delegating arm was not located").not.toContain("className=");

    // Rebuilt by concatenation, so there is no sentinel string to substitute — the shape that put
    // four raw NUL bytes into this file and made it binary to `rg` (`lib/source-hygiene.test.ts`
    // is the check that now catches that). The test is NEGATED rather than rewritten, so the
    // swapped source still selects the same arm for the same mechanism without this control
    // knowing what the test says.
    const swapped =
      source.slice(0, testStart) +
      `!(${test})` +
      source.slice(question, armAOpen + 1) +
      armB +
      source.slice(armAClose, armBOpen + 1) +
      armA +
      source.slice(armBClose);

    // The swap really happened, and in the direction that used to break: the arm whose classes the
    // primitive owns now comes first. Without this the whole control could pass on a no-op.
    const first = (text: string) =>
      text.indexOf("<AccordionItem") < text.indexOf("<Card") ? "accordion" : "list";
    expect(first(source), "the component no longer writes the styled arm first").toBe("list");
    expect(first(swapped), "the swap did not move the delegating arm to the front").toBe(
      "accordion",
    );

    const read = () =>
      faqBlocksIn(FAQ_SECTION_COMPONENT).map((block) => ({
        mapped: block.mapped,
        question: `<${block.question.tag}> ${spellingOf(block.question)}`,
        answer: `<${block.answer.tag}> ${spellingOf(block.answer)}`,
        conditional: block.conditional,
      }));

    const before = read();
    expect(before, "FaqSection is not being read as a FAQ block at all").toHaveLength(1);
    expect(withInjectedSource([[FAQ_SECTION_COMPONENT, swapped]], read)).toEqual(before);
    // And the pairing the whole counter turns on survives the swap, which is what actually broke.
    expect(
      withInjectedSource([[FAQ_SECTION_COMPONENT, swapped]], () =>
        jsonLdWithoutMarkup().map((call) => label(call.file)),
      ),
    ).toEqual([]);
    expect(read()).toEqual(before);
  });

  // THE SPAN, CONTAINMENT AND ATTRIBUTE INVARIANTS ARE NOT TESTED HERE ANY MORE. They belong to
  // the shared module, which has four consumers, and a counter file's tests answer for that
  // counter's USES of an API rather than for the API — so `lib/test-support/composition-scan.test.ts`
  // now owns them, over the wider `walkCardSurface()` population this file's `surfaceFiles()` sits
  // inside. Nothing was dropped: pre-order, nesting, `innermostElementAt`'s deepest-wins rule and
  // the prop-borne case are all asserted there, plus the attribute walk this file no longer
  // duplicates.

  it("a docblock quoting a FAQ block is prose, not markup — comment stripping applied", () => {
    const commented = `/** {faqs.map((faq) => <div className="x"><h3 className="y">{faq.question}</h3><p className="z">{faq.answer}</p></div>)} */\n`;
    expect(withProbe(commented, () => faqBlocksIn(PROBE_HOST))).toHaveLength(0);
  });

  it("a FAQ block inside a string literal is prose, not markup", () => {
    const inString = `const usage = "{faqs.map((faq) => <div className=\\"x\\"><h3 className=\\"y\\">{faq.question}</h3><p>{faq.answer}</p></div>)}";\n`;
    expect(withProbe(inString, () => faqBlocksIn(PROBE_HOST))).toHaveLength(0);
  });

  it("the probe is a real block — the premise every mutation check below rests on", () => {
    // Read INSIDE the injection: a `ScannedElement` span addresses the source the scan was given,
    // so asking for a shell signature after the override is gone would index the file on disk.
    const seen = withProbe(probeBlock({ array: "PROBE_FAQS", questionTag: "h3" }), () => {
      const blocks = faqBlocksIn(PROBE_HOST);
      return blocks.map((block) => ({
        mapped: block.mapped,
        item: block.item.spelling,
        question: block.question.spelling,
        answer: block.answer.spelling,
        shell: shellSignatureOf(block),
        conditional: block.conditional,
      }));
    });
    expect(seen).toEqual([
      {
        mapped: "PROBE_FAQS",
        item: "probe-item-spelling",
        question: "probe-question-spelling",
        answer: "probe-answer-spelling",
        shell: "probe-shell-spelling :: aria-label",
        conditional: false,
      },
    ]);
  });
});

/* ---------------------------------------------------------------------------------------------
 * THE FOUR SPELLING COUNTERS
 * ------------------------------------------------------------------------------------------ */

describe("the hand-written FAQ blocks are counted by what they spell", () => {
  it("the number of distinct item-wrapper spellings is exactly the recorded number", () => {
    const spellings = new Set(faqBlocks().map((block) => spellingOf(block.item)));
    expect(spellings.size, `FAQ item wrappers:\n${spellingReport((b) => spellingOf(b.item))}`).toBe(
      FAQ_ITEM_SPELLINGS,
    );
  });

  it("the number of distinct question-element spellings is exactly the recorded number", () => {
    const spellings = new Set(faqBlocks().map((block) => spellingOf(block.question)));
    expect(
      spellings.size,
      `FAQ question elements:\n${spellingReport((b) => `<${b.question.tag}> ${spellingOf(b.question)}`)}`,
    ).toBe(FAQ_QUESTION_SPELLINGS);
  });

  it("the number of distinct answer-element spellings is exactly the recorded number", () => {
    const spellings = new Set(faqBlocks().map((block) => spellingOf(block.answer)));
    expect(
      spellings.size,
      `FAQ answer elements:\n${spellingReport((b) => `<${b.answer.tag}> ${spellingOf(b.answer)}`)}`,
    ).toBe(FAQ_ANSWER_SPELLINGS);
  });

  it("the number of distinct section shells is exactly the recorded number", () => {
    expect(
      new Set(faqBlocks().map(shellSignatureOf)).size,
      `FAQ section shells:\n${spellingReport(shellSignatureOf)}`,
    ).toBe(FAQ_SECTION_SHELLS);
  });

  it("the number of blocks with no per-question heading is exactly the recorded number", () => {
    const rows = faqBlocks().map(
      (block) => [`<${block.question.tag}>`, label(block.file)] as const,
    );
    const headless = faqBlocks().filter((block) => !/^h[1-6]$/.test(block.question.tag));
    expect(
      headless.length,
      `FAQ question elements by tag:\n${report(rows)}\nheadless: ${headless
        .map((block) => label(block.file))
        .join(", ")}`,
    ).toBe(FAQ_BLOCKS_WITHOUT_HEADINGS);
  });

  it("the shared component still writes the ONE spelling the five zeros replaced", () => {
    // The five counters above say the hand-written surface is empty. They do NOT say anything is
    // rendered — `components/patterns` is off this scan's surface by design (SCOPE note 9). So the
    // component's own block is read HERE, explicitly, by the same predicate: one `.map(` over
    // `items`, its question in an `<h3>`, its answer in a `<p>`, both styled. This is the row the
    // table in the docblock above collapsed to.
    const blocks = faqBlocksIn(FAQ_SECTION_COMPONENT);
    expect(blocks, "FaqSection is no longer read as a FAQ block").toHaveLength(1);
    const block = blocks[0]!;
    expect(block.mapped).toBe("items");
    expect(block.question.tag).toBe("h3");
    expect(block.answer.tag).toBe("p");
    expect(spellingOf(block.question)).not.toBe(NO_CLASSNAME);
    expect(spellingOf(block.answer)).not.toBe(NO_CLASSNAME);

    // THE SHELL IS `null` HERE, AND THAT IS A FACT ABOUT THE SCANNER, NOT A DEFECT IN THE
    // COMPONENT. `FaqSection` hoists its `.map(` into `const entries = items.map(…)` ABOVE the
    // returned JSX, so the map call has no enclosing element at all and `shell` resolves to the
    // null marker — even though the component very much does render one `<section id
    // aria-labelledby tabIndex className="scroll-mt-28 …">` around `{entries}`.
    //
    // Recorded rather than worked around, because it says exactly what {@link FAQ_SECTION_SHELLS}
    // would and would not have seen if `components/patterns` were on this surface: a block whose
    // map is hoisted signs as `(no <section> ancestor)` and would have become its own "shell"
    // spelling. No block on the real surface was ever written that way, which is why the counter
    // was sound for the population it had. It is stated here so the next person to widen
    // `SURFACE_ROOTS` knows what moves.
    expect(spellingOf(block.shell)).toBe("(no <section> ancestor)");

    // The section really is written, with all three identity attributes the four old shells split
    // between them — asserted on the element directly, since the block's `shell` cannot reach it.
    const section = jsxElementsOf(FAQ_SECTION_COMPONENT).find(
      (element) => element.tag === "section",
    );
    expect(section, "FaqSection no longer renders a <section>").toBeDefined();
    for (const attribute of ["id", "aria-labelledby", "tabIndex"]) {
      expect(section!.attributes.has(attribute), `the section dropped ${attribute}`).toBe(true);
    }
    expect(section!.spelling).toContain("scroll-mt-28");
  });

  it("a new spelling raises each counter — the counters, not just the scanner", () => {
    // Relative, and on a host neither Task 8 nor Task 9 touches: the four figures may move as those
    // tasks converge the surface, and this control still proves the whole path from walk to count.
    const probe = probeBlock({ array: "PROBE_FAQS", questionTag: "h3" });
    const before = {
      item: new Set(faqBlocks().map((b) => spellingOf(b.item))).size,
      question: new Set(faqBlocks().map((b) => spellingOf(b.question))).size,
      answer: new Set(faqBlocks().map((b) => spellingOf(b.answer))).size,
      shell: new Set(faqBlocks().map(shellSignatureOf)).size,
    };
    const after = withProbe(probe, () => ({
      item: new Set(faqBlocks().map((b) => spellingOf(b.item))).size,
      question: new Set(faqBlocks().map((b) => spellingOf(b.question))).size,
      answer: new Set(faqBlocks().map((b) => spellingOf(b.answer))).size,
      shell: new Set(faqBlocks().map(shellSignatureOf)).size,
    }));
    expect(after).toEqual({
      item: before.item + 1,
      question: before.question + 1,
      answer: before.answer + 1,
      shell: before.shell + 1,
    });
    expect(new Set(faqBlocks().map((b) => spellingOf(b.item))).size).toBe(before.item);
  });

  it("a probe whose question is a <p> raises the headless count", () => {
    // Relative, like its neighbour: the pinned value may move as Task 9 converges the six blocks,
    // and this control still proves that the tag rule is what drives the number.
    const headless = (): number =>
      faqBlocks().filter((block) => !/^h[1-6]$/.test(block.question.tag)).length;
    const before = headless();
    expect(
      withProbe(probeBlock({ array: "PROBE_FAQS", questionTag: "p" }), headless),
      "a question written in a <p> is a block with no heading",
    ).toBe(before + 1);
    // …and a probe that DOES write a heading must not, or the counter measures blocks and not
    // headings.
    expect(withProbe(probeBlock({ array: "PROBE_FAQS", questionTag: "h3" }), headless)).toBe(
      before,
    );
    expect(headless()).toBe(before);
  });
});

/* ---------------------------------------------------------------------------------------------
 * THE PAIRING
 * ------------------------------------------------------------------------------------------ */

describe("every faqPageJsonLd call has visible markup for the same array", () => {
  it("the number of calls with no same-file markup is exactly the recorded number", () => {
    const orphans = jsonLdWithoutMarkup().map(
      (call) => `${label(call.file)} — faqPageJsonLd(${call.array})`,
    );
    expect(
      orphans.length,
      `structured data published for questions no block on the page renders:\n${orphans
        .map((row) => `  ${row}`)
        .join("\n")}`,
    ).toBe(FAQ_JSONLD_WITHOUT_MARKUP);

    // HOW THE ZERO IS REACHED, stated rather than entailed. Zero orphans is true of a tree with
    // one paired call and equally true of a tree with none, so the split is pinned at its measured
    // value: 1 call pairs in its own file by the identifier rule, and that is the whole caller
    // population. Without this, deleting every `faqPageJsonLd` call in the repo would leave this
    // `it` green. The delegated bucket that used to sit beside this one is gone — there is nothing
    // left for it to hold, which is Task 9's actual result and not a weakening.
    const calls = faqJsonLdCalls();
    const inFile = calls.filter((call) =>
      faqBlocksIn(call.file).some((block) => block.mapped === call.array),
    );
    expect(
      inFile.map((call) => label(call.file)),
      "calls paired by the same-file identifier rule",
    ).toEqual(["components/patterns/faq-section.tsx"]);
    expect(inFile.length + orphans.length).toBe(calls.length);
  });

  /**
   * ONE CALL, AND IT IS THE COMPONENT.
   *
   * This listed eight while every `faqPageJsonLd` caller was a page that also wrote its own FAQ
   * markup, then nine when Task 8 added `components/patterns/faq-section.tsx`. Task 9 took the
   * eight pages away: the FAQPage schema for every FAQ on this site is now emitted from exactly
   * one place, from the same `items` array that renders the questions.
   *
   * THE POPULATION IS ASSERTED AS AN EXACT IDENTITY, not a length. A page that starts calling
   * `faqPageJsonLd` again — the regression this whole file exists to prevent — is a new row here
   * and goes red by name, whether or not it happens to pair in its own file. Pairing is a weaker
   * question than "who is allowed to publish structured data about questions", and after
   * convergence the answer to the second is a single file.
   *
   * It needs no exemption, which is the point. The same-file pairing rule
   * {@link FAQ_JSONLD_WITHOUT_MARKUP} decides reaches it unchanged — `faqPageJsonLd(items)` beside
   * a `.map(` over the same `items` identifier in the same file — so the component is the GENERAL
   * CASE of that rule rather than a hole in it. (`faqPageJsonLd` takes `readonly FaqEntry[]` so the
   * component can hand over the array it renders instead of a `[...items]` copy, which would read
   * as "(not an identifier)" here and pair with nothing.)
   */
  it("the one call is FaqSection's own, and nothing else publishes FAQPage — anti-vacuity", () => {
    const calls = faqJsonLdCalls();
    expect(
      calls.map((call) => `${label(call.file)} ${call.array}`),
      "faqPageJsonLd calls found",
    ).toEqual(["components/patterns/faq-section.tsx items"]);
    // Every call is written inside a `<JsonLd>` element, which is what makes the conditional test
    // below meaningful: it reads the gate on the element that emits the script tag.
    expect(new Set(calls.map((call) => call.holder))).toEqual(new Set(["JsonLd"]));
    // WHY THE COMPONENT NEEDS NO EXEMPTION — the one thing here the exact list above does not
    // already entail. That list says FaqSection emits a schema; it says nothing about whether the
    // schema PAIRS. This does. If `items` ever became `[...items]` or the markup moved into a
    // child component, the list above would still pass and this would not.
    const own = calls.filter((call) => call.file === FAQ_SECTION_COMPONENT);
    expect(own, "FaqSection no longer emits FAQPage at all").toHaveLength(1);
    expect(
      faqBlocksIn(FAQ_SECTION_COMPONENT).map((block) => block.mapped),
      "FaqSection's schema and its markup are no longer one identifier in one file",
    ).toContain(own[0]!.array);
    // The caller walk is wider than the block walk (`app/`, `components/`, `lib/` against
    // `SURFACE_ROOTS`), so the exact list above also says no call hides in `lib/` or on a page —
    // SCOPE note 9, which is now doing all of the work the delegation exemption used to.
    expect(
      calls.filter((call) => call.file !== FAQ_SECTION_COMPONENT),
      "a faqPageJsonLd caller other than FaqSection",
    ).toEqual([]);
  });

  /**
   * ONE DIRECTION IS A DEFECT; THE OTHER IS THE SAFE SHAPE. This used to demand that both sides of
   * a pair carry the same conditionality, which was over-strict — it treated a schema gated TIGHTER
   * than its markup as a failure, and that shape is strictly safer than agreement.
   *
   * The defect is asymmetric, because the harm is:
   *
   *   - schema UNCONDITIONAL, markup CONDITIONAL → the page can publish `FAQPage` for questions the
   *     reader is never shown. That is the thing `lib/seo/json-ld.tsx` forbids in prose and the
   *     shape the plan's finding 2 names. FAILS.
   *   - schema CONDITIONAL, markup UNCONDITIONAL → the questions are always rendered, and the
   *     schema is withheld under some further condition. Nothing is published that is not on the
   *     page. `components/patterns/faq-section.tsx` is exactly this: its `.map(` over `items` is
   *     unconditional, and its `<JsonLd>` is gated on `isIndexable(locale, structuredData)` —
   *     de-indexing a surface must not be a reason to hide the answers from the reader. PASSES.
   *
   * Still NOT an evaluation of the gate (SCOPE note 4): two DIFFERENT conditions on the two sides
   * read as "both conditional" here, which remains the blind spot. What is decided is presence.
   */
  it("no pair publishes a schema unconditionally for markup written behind a gate", () => {
    const unsafe = faqJsonLdCalls().flatMap((call) =>
      faqBlocksIn(call.file)
        .filter((block) => block.mapped === call.array)
        .filter((block) => !call.conditional && block.conditional)
        .map(() => `${label(call.file)}: JSON-LD unconditional, markup conditional`),
    );
    expect(unsafe, "structured data published for markup the reader may not be shown").toEqual([]);

    // THE PREMISE, so the assertion above is a fact and not a tautology. Measured on this tree:
    // ONE call, gated, over markup that is not — `gated/open`, the TOLERATED direction, which is
    // therefore genuinely exercised rather than merely permitted. That is `FaqSection` itself: its
    // `.map(` over `items` is unconditional and its `<JsonLd>` is gated on `isIndexable`.
    //
    // The population shrank from nine pairs to one, so this premise is thinner than it was and
    // says so. What keeps the test from being vacuous is that the one surviving pair sits in the
    // arm the rule TOLERATES: a bug that flipped the predicate's sense would make this `it` red
    // immediately, which is not true of a `forbidden`-arm-only population.
    const calls = faqJsonLdCalls();
    expect(calls.filter((call) => call.conditional)).toHaveLength(1);
    expect(calls.filter((call) => !call.conditional)).toHaveLength(0);
    const pairs = calls.flatMap((call) =>
      faqBlocksIn(call.file)
        .filter((block) => block.mapped === call.array)
        .map(
          (block) =>
            `${call.conditional ? "gated" : "open"}/${block.conditional ? "gated" : "open"}`,
        ),
    );
    expect(pairs).toEqual(["gated/open"]);

    // …and the FORBIDDEN direction still fails, driven on the probe because no real file writes it
    // any more. Without this the assertion above would be a claim about an empty set.
    const unsafeProbe = [
      `const UNSAFE_FAQS = [{ question: "q", answer: "a" }];`,
      `function UnsafeProbe() {`,
      `  return (`,
      `    <>`,
      `      <JsonLd schema={faqPageJsonLd(UNSAFE_FAQS)} />`,
      `      <section>`,
      `        <div className="probe-grid">`,
      `          {show && (`,
      `            <div className="probe-item">`,
      `              {UNSAFE_FAQS.map((faq) => (`,
      `                <article key={faq.question} className="probe-item-spelling">`,
      `                  <h3 className="probe-question-spelling">{faq.question}</h3>`,
      `                  <p className="probe-answer-spelling">{faq.answer}</p>`,
      `                </article>`,
      `              ))}`,
      `            </div>`,
      `          )}`,
      `        </div>`,
      `      </section>`,
      `    </>`,
      `  );`,
      `}`,
    ].join("\n");
    expect(
      withProbe(unsafeProbe, () =>
        faqJsonLdCalls().flatMap((call) =>
          faqBlocksIn(call.file)
            .filter((block) => block.mapped === call.array)
            .filter((block) => !call.conditional && block.conditional)
            .map(() => `${label(call.file)}: JSON-LD unconditional, markup conditional`),
        ),
      ),
      "an unconditional schema over gated markup must still be caught",
    ).toEqual([
      "app/[locale]/(site)/hakkimizda/page.tsx: JSON-LD unconditional, markup conditional",
    ]);
  });

  it("an unpaired call is counted — the counter, not just the scanner", () => {
    const orphan = [
      `const ORPHAN_FAQS = [{ question: "q", answer: "a" }];`,
      `function OrphanProbe() {`,
      `  return <JsonLd schema={faqPageJsonLd(ORPHAN_FAQS)} />;`,
      `}`,
    ].join("\n");
    // Relative — the rows the probe ADDS, so the control proves the predicate rather than
    // re-asserting today's zero.
    const rows = (calls: FaqJsonLdCall[]) =>
      calls.map((call) => `${label(call.file)} — faqPageJsonLd(${call.array})`);
    const before = rows(jsonLdWithoutMarkup());
    const added = (probe: string) =>
      withProbe(probe, () => rows(jsonLdWithoutMarkup())).filter((row) => !before.includes(row));

    expect(added(orphan), "structured data with no markup must be caught").toEqual([
      "app/[locale]/(site)/hakkimizda/page.tsx — faqPageJsonLd(ORPHAN_FAQS)",
    ]);

    // The same call WITH a block over the same array is paired and must not be counted — otherwise
    // the counter measures `faqPageJsonLd` calls rather than unpaired ones.
    expect(added(`${orphan}\n${probeBlock({ array: "ORPHAN_FAQS", questionTag: "h3" })}`)).toEqual(
      [],
    );

    // …and a block over a DIFFERENT array does not pair, which is the whole point of pairing by
    // identifier rather than by "this page has a FAQ somewhere".
    expect(added(`${orphan}\n${probeBlock({ array: "OTHER_FAQS", questionTag: "h3" })}`)).toEqual([
      "app/[locale]/(site)/hakkimizda/page.tsx — faqPageJsonLd(ORPHAN_FAQS)",
    ]);

    expect(rows(jsonLdWithoutMarkup())).toEqual(before);
  });
});

/* ---------------------------------------------------------------------------------------------
 * THE ITEM SOURCES — Rulings BX and CE
 *
 * Everything above this line is a claim about SOURCE TEXT. Nothing above it has ever looked at a
 * question. These read the DATA the six converged blocks actually render, for the two properties
 * source text cannot decide:
 *
 *   - BX, how many questions there are, measured from the arrays rather than from a `grep -c
 *     "question:"`. That grep has now been wrong twice on this surface, both times by exactly one
 *     — the interface's own field declaration — and both times the wrong figure reached a written
 *     plan. Counting the data costs one `.length`.
 *   - CE, that no block repeats a question. `FaqSection` uses `item.question` as the React key AND,
 *     in the accordion mechanism, as the Base UI `value` that tracks which panel is open. Two
 *     identical questions in one array therefore collide twice over: React warns about duplicate
 *     keys, and opening one panel opens the other. The component cannot defend itself — the array
 *     is the caller's — so the guarantee has to live with the data.
 *
 * `buildBolgelerFaqs()` is NOT here. Its fourth entry is derived from a live `regionsList` fetch,
 * so reaching it means either an API call from a unit test or a fixture that would prove only that
 * the fixture is well-formed. `/deniz`'s eight are in `lib/marine/deniz-faq.test.ts` beside the
 * catalogue they read. What is reachable from a pure module is here.
 * ------------------------------------------------------------------------------------------ */

describe("the FAQ item sources", () => {
  it("the four sea basins hold 12 questions, 3 each — not the plan's 13", () => {
    const basins = Object.values(SEA_BASINS_DETAIL);
    expect(basins).toHaveLength(4);
    expect(basins.map((basin) => basin.faq.length)).toEqual([3, 3, 3, 3]);
    expect(basins.reduce((n, basin) => n + basin.faq.length, 0)).toBe(12);
  });

  it("the seven continents hold 28 questions, 4 each — not the plan's 29", () => {
    // Ruling BX, and the reason it was worth re-measuring: the plan says 29, `grep -c "question:"`
    // on `lib/geo/continents.ts` says 29, and the data says 28. The 29th is the `ContinentFaq`
    // interface's own `question: string` field — the SAME mistake as the sea basins' 13-vs-12, in
    // a second file, found only because the ruling said measure instead of quote.
    const continents = getAllContinents();
    expect(continents).toHaveLength(7);
    const perContinent = continents.map((c) => ({ slug: c.slugTr, count: c.faqs.length }));
    expect(
      perContinent.map((row) => row.count),
      `questions per continent:\n${perContinent.map((r) => `  ${r.slug}: ${r.count}`).join("\n")}`,
    ).toEqual([4, 4, 4, 4, 4, 4, 4]);
    expect(continents.reduce((n, c) => n + c.faqs.length, 0)).toBe(28);
  });

  it("no block repeats a question — Ruling CE, over every source reachable from a module", () => {
    const sources: ReadonlyArray<readonly [string, readonly { question: string }[]]> = [
      ...Object.entries(SEA_BASINS_DETAIL).map(
        ([slug, basin]) => [`sea basin ${slug}`, basin.faq] as const,
      ),
      ...getAllContinents().map((c) => [`continent ${c.slugTr}`, c.faqs] as const),
      ["dunya/kita CONTINENT_HUB_FAQS", CONTINENT_HUB_FAQS] as const,
    ];

    // Anti-vacuity: the list really is the whole reachable set, and really has questions in it.
    expect(sources).toHaveLength(12);
    expect(sources.every(([, items]) => items.length > 0)).toBe(true);

    const collisions = sources.flatMap(([name, items]) => {
      const seen = new Map<string, number>();
      for (const item of items) seen.set(item.question, (seen.get(item.question) ?? 0) + 1);
      return [...seen]
        .filter(([, n]) => n > 1)
        .map(([question, n]) => `${name}: ${n}x ${JSON.stringify(question)}`);
    });
    expect(
      collisions,
      "FaqSection keys items — and tracks accordion panel state — by the question string, so a " +
        "repeated question collides on both",
    ).toEqual([]);
  });

  it("the schema text is the item text, at the value level", () => {
    // THE ONE ASSERTION HERE THAT IS A PURE FUNCTION rather than a source shape, and the only
    // check anywhere that the published `FAQPage` really carries the SAME STRINGS the page
    // renders. Everything in the pairing section above decides identifier identity — that the
    // schema and the markup come from one array — which is a structural guarantee and says
    // nothing about what `faqPageJsonLd` does with that array.
    //
    // It used to live in the delegated-markup block, asserting it for the four basins because
    // that exemption needed it. The exemption is gone; this is not, and it is now run over both
    // live sources rather than one, because it never depended on the delegation.
    const sources = [
      ...Object.values(SEA_BASINS_DETAIL).map((basin) => basin.faq),
      ...getAllContinents().map((continent) => continent.faqs),
      CONTINENT_HUB_FAQS,
    ];
    expect(sources).toHaveLength(12);
    for (const items of sources) {
      const schema = faqPageJsonLd(items) as unknown as {
        mainEntity: { name: string; acceptedAnswer: { text: string } }[];
      };
      expect(schema.mainEntity.map((entry) => entry.name)).toEqual(
        items.map((entry) => entry.question),
      );
      expect(schema.mainEntity.map((entry) => entry.acceptedAnswer.text)).toEqual(
        items.map((entry) => entry.answer),
      );
    }
  });

  it("the uniqueness check would catch a duplicate — the control, not just the scan", () => {
    const withDuplicate = [
      { question: "aynı soru", answer: "a" },
      { question: "başka", answer: "b" },
      { question: "aynı soru", answer: "c" },
    ];
    const seen = new Map<string, number>();
    for (const item of withDuplicate) seen.set(item.question, (seen.get(item.question) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([q]) => q)).toEqual(["aynı soru"]);
  });
});
