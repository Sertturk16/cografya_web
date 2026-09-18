import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEA_BASINS_DETAIL } from "@/lib/marine/sea-basins-detail";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import {
  NO_CLASSNAME,
  type ScannedElement,
  importBindingsOf,
  innermostElementAt,
  jsxElementsOf,
  label,
  maskLiterals,
  maskedSource,
  readSource,
  repoRoot,
  resolvesTo,
  scanJsx,
  surfaceFiles,
  tagTextAt,
  walk,
  withInjectedSource,
} from "@/lib/test-support/composition-scan";

/* -------------------------------------------------------------------------------------------
 * T-035 PR5 — the FAQ surface. Six counters over the six blocks that render a question and an
 * answer, plus the one pairing that matters: a `faqPageJsonLd(X)` call and whether the page that
 * makes it also renders `X`.
 *
 * Built on `lib/test-support/composition-scan.ts` like its three siblings, and it adds nothing of
 * its own that walks source. What is imported from there: `surfaceFiles` and `walk`, `readSource`
 * and `maskedSource`, the ONE literal extractor behind `jsxElementsOf`, `innermostElementAt` and
 * the element spans it reads, `tagTextAt`, and the binding resolver `importBindingsOf` /
 * `resolvesTo`. What stays here: the FAQ predicate, the six counters, their docblocks, their
 * mutation records and the one delegation exemption.
 *
 * WHAT THIS FILE ADDED TO THE SHARED SCANNER, and why it was not a fourth scanner. Every counter
 * below is a POSITION-TO-ELEMENT question — "which element writes `{faq.question}`", "which
 * `<section>` encloses this `.map(`", "is the element holding this `faqPageJsonLd(` call written
 * under a condition" — and `ScannedElement` carried no source span, so there was no way to ask one
 * without walking the text a second time. `ScannedElement.start` / `.end` and
 * `innermostElementAt()` are that gap closed in the shared module, where the other three counters
 * can use them too. T-045 exists because two scanners with different semantics disagreed silently
 * for months; adding a field to the one scanner is the opposite of that mistake.
 * ---------------------------------------------------------------------------------------- */

/** The module that DECLARES `faqPageJsonLd`, never a caller of it. */
const FAQ_JSONLD_MODULE = join(repoRoot, "lib/seo/json-ld.tsx");

/** Where the delegated-markup exemption's other half lives. See {@link DELEGATED_FAQ_MARKUP}. */
const SEA_BASIN_VIEW = join(repoRoot, "components/v2/v2-sea-basin-detail-view.tsx");

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

/**
 * The names of the attributes written at the TOP LEVEL of one JSX opening tag.
 *
 * Literals are masked and braced values are skipped whole, so `id` is read out of
 * `<section id="sss" tabIndex={-1}>` and nothing is read out of `className={cn("a=b")}` or out of
 * a nested element passed as a prop. The tag's own name is not an attribute: it is not followed
 * by `=`.
 */
function attributeNamesOf(tagText: string): string[] {
  const masked = maskLiterals(tagText);
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i]!;
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 0 || !/[A-Za-z]/.test(ch)) continue;
    if (/[A-Za-z0-9_$:.-]/.test(masked[i - 1] ?? " ")) continue;
    let j = i;
    while (j < masked.length && /[A-Za-z0-9_$:.-]/.test(masked[j]!)) j += 1;
    let k = j;
    while (k < masked.length && /\s/.test(masked[k]!)) k += 1;
    if (masked[k] === "=") names.push(masked.slice(i, j));
    i = j - 1;
  }
  return names;
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

/**
 * ONE FAQ BLOCK — a `.map(` over an array of question/answer pairs whose callback renders JSX.
 *
 * `mapped` is the receiver of the `.map(`, i.e. the array identifier or member path the block
 * renders. `item` is the element the callback opens first; `question` and `answer` are the nearest
 * enclosing elements of the `.question` and `.answer` reads that carry a `className` at all;
 * `shell` is the nearest enclosing `<section>`.
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
 * A `.map(` on the scanned file qualifies when all three hold:
 *
 *   1. its callback reads a `.question` member AND an `.answer` member;
 *   2. at least one JSX element opens inside the callback;
 *   3. the `.question` and `.answer` reads each sit inside some element that carries a `className`.
 *
 * (2) IS THE CLAUSE THAT DOES THE WORK, and it is not defensive programming. Both `turkiye/bolge`
 * pages write a SECOND `.map(` that satisfies (1) exactly — `bolgelerFaqs.map((faq) => ({ question:
 * faq.question, answer: faq.answer }))`, the projection into `faqPageJsonLd` six hundred lines
 * above the markup — and it renders nothing at all. Counting it would report eight blocks, two of
 * them with no item wrapper, no question element and no answer element. The "a FAQ projection is
 * not a FAQ block" control below asserts that both of those maps are still there and still
 * excluded, so clause (2) cannot quietly become inert.
 *
 * CLAUSE (3) REMOVES NOTHING TODAY, stated rather than implied: the surface holds exactly 8 maps
 * satisfying clause (1), clause (2) drops the 2 projections, and all 6 survivors write both reads
 * inside a styled element. It is there because the alternative to a guard is a crash — a question
 * written directly into a fragment has no element to attribute a spelling to — and because a block
 * that trips it would otherwise vanish from all six counters instead of failing the six-block
 * anti-vacuity assertion, which is what it does now.
 */
function faqBlocksIn(file: string): FaqBlock[] {
  const masked = maskedSource(file);
  const elements = jsxElementsOf(file);
  const blocks: FaqBlock[] = [];

  for (const match of masked.matchAll(/\.map\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = matchingParen(masked, open);
    const body = masked.slice(open, close);
    const questionAt = body.indexOf(".question");
    const answerAt = body.indexOf(".answer");
    if (questionAt === -1 || answerAt === -1) continue;

    const opened = elements.filter((element) => element.start > open && element.start < close);
    const item = opened[0];
    if (item === undefined) continue;

    const questionHost = innermostElementAt(elements, open + questionAt);
    const answerHost = innermostElementAt(elements, open + answerAt);
    if (questionHost === null || answerHost === null) continue;
    const question = ancestorWhere(elements, questionHost, (e) => e.spelling !== null);
    const answer = ancestorWhere(elements, answerHost, (e) => e.spelling !== null);
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
  // The OPENING TAG only. Slicing the element's whole span would read the `id` off the `<h2>`
  // inside it and report every shell as `aria-labelledby+id`.
  const names = attributeNamesOf(tagTextAt(readSource(block.file), block.shell.start));
  const labelling = SHELL_LABELLING_ATTRIBUTES.filter((name) => names.includes(name));
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
 * THE ONE EXEMPTION — four pages whose FAQ markup is written in a component they render.
 *
 * The four `deniz/{akdeniz,ege,karadeniz,marmara}` pages each emit `faqPageJsonLd(basinData.faq)`
 * and render no FAQ markup of their own: `V2SeaBasinDetailView` does it, over the SAME object,
 * handed to it as `data`. The same-file rule {@link FAQ_JSONLD_WITHOUT_MARKUP} decides cannot see
 * across that hop, so the pair is exempted — but exempted through a rule with four decidable
 * halves rather than a written list of four paths:
 *
 *   - the page renders the `delegate` export, resolved through `importBindingsOf` + `resolvesTo`
 *     (so a barrel, an alias or a local shadow cannot pose as it), and renders it unconditionally;
 *   - the page passes the ROOT of its JSON-LD array (`basinData` out of `basinData.faq`) as the
 *     `prop` named here, read off the real JSX attribute rather than grepped for;
 *   - the tail of the page's array path (`.faq`) equals the tail of the path the delegate maps
 *     (`data.faq` minus the prop name);
 *   - the delegate really has a FAQ block over that path, by the same predicate as everything else
 *     in this file.
 *
 * Break any half and the page falls straight back into the counter, which goes to 1. The EXEMPT
 * PAGES ARE DERIVED, never written: a fifth page adopting this delegation is exempt by arriving,
 * and the "exactly these four" assertion below is what makes that visible instead of silent.
 *
 * WHAT THE EXEMPTION DOES NOT CLAIM: that the two sides are reachable together. Both are
 * unconditional today and that is asserted, but "unconditional" is a shape, not an evaluation —
 * see SCOPE note 4.
 */
const DELEGATED_FAQ_MARKUP = {
  delegate: SEA_BASIN_VIEW,
  export: "V2SeaBasinDetailView",
  prop: "data",
} as const;

/** The value written for `name={…}` or `name="…"` on one opening tag, or `null`. */
function propValueOf(tagText: string, name: string): string | null {
  const masked = maskLiterals(tagText);
  const at = masked.search(new RegExp(`(?<![A-Za-z0-9_$:.-])${name}\\s*=`));
  if (at === -1) return null;
  let i = masked.indexOf("=", at) + 1;
  while (i < masked.length && /\s/.test(masked[i]!)) i += 1;
  if (masked[i] !== "{") return tagText.slice(i, i + 1) === '"' ? "(string literal)" : null;
  let depth = 0;
  let j = i;
  for (; j < masked.length; j += 1) {
    if (masked[j] === "{") depth += 1;
    else if (masked[j] === "}" && (depth -= 1) === 0) break;
  }
  return tagText.slice(i + 1, j).trim();
}

/** Is this call's markup written by {@link DELEGATED_FAQ_MARKUP}'s delegate, in that delegate? */
function isDelegated(call: FaqJsonLdCall): boolean {
  const root = call.array.split(".")[0]!;
  const tail = call.array.slice(root.length);
  const binding = importBindingsOf(call.file).get(DELEGATED_FAQ_MARKUP.export);
  if (binding === undefined) return false;
  if (!resolvesTo(binding, DELEGATED_FAQ_MARKUP.delegate, DELEGATED_FAQ_MARKUP.export))
    return false;

  const elements = jsxElementsOf(call.file);
  const source = readSource(call.file);
  const rendered = elements.filter((element) => element.tag === DELEGATED_FAQ_MARKUP.export);
  const passes = rendered.some((element) => {
    const index = elements.indexOf(element);
    if (writtenUnderCondition(elements, index)) return false;
    return propValueOf(tagTextAt(source, element.start), DELEGATED_FAQ_MARKUP.prop) === root;
  });
  if (!passes) return false;

  return faqBlocksIn(DELEGATED_FAQ_MARKUP.delegate).some(
    (block) => block.mapped === `${DELEGATED_FAQ_MARKUP.prop}${tail}` && !block.conditional,
  );
}

function jsonLdWithoutMarkup(): FaqJsonLdCall[] {
  return faqJsonLdCalls().filter((call) => {
    if (faqBlocksIn(call.file).some((block) => block.mapped === call.array)) return false;
    return !isDelegated(call);
  });
}

/**
 * THE SIX FAQ BLOCKS AND WHAT THEY SPELL — measured 2026-09-18 on `feature/t-035-pr5-faq` at
 * `ea65d42` (`dev` after PR4), by the predicate {@link faqBlocksIn} states, not predicted.
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
 * Reading the table: four item spellings (A–D), three question spellings (the two `turkiye` and the
 * two `dunya` blocks share C, character for character), four answer spellings, four shells. The
 * plan's Measurements section states 4 / 3 / 4 / 4 / 1 / 0 and every one of them reproduced —
 * nothing has moved since the measurement, which is itself the first finding.
 *
 * ONE FIGURE IN THE PLAN IS WRONG, and it is not one of the six. The Measurements section calls
 * the sea-basin data "4 basins, 13 questions"; it is **12**, 3 per basin. 13 is the number of
 * `question:` occurrences in `lib/marine/sea-basins-detail.ts`, one of which is the `SeaBasinFAQ`
 * interface's own field declaration — the grep-counts-the-declaration mistake, one door over from
 * the grep-counts-the-docblock one this repo has recorded four times. Asserted below rather than
 * corrected in prose only.
 *
 * TWO MECHANISMS, NOT THREE, and the second row is where the two questions differ: the accordion
 * puts its question in a `<span>` inside a `<button>` and the five static grids put theirs in an
 * `<h3>`. That is {@link FAQ_BLOCKS_WITHOUT_HEADINGS} = 1, and it is a document-outline defect, not
 * a styling one — `/deniz`'s seven questions contribute nothing between the page's `<h2>` and the
 * next section.
 *
 * ## SCOPE — what these six counters cannot see
 *
 * Every claim below is a claim about SOURCE TEXT read by `scanJsx`, never about a rendered DOM, a
 * computed style or a page that was actually requested. Specifically:
 *
 *   1. **A FAQ block that does not `.map()` is not a block here at all.** The population is derived
 *      from `.map(` calls, so seven hand-copied `<div>` pairs, a `for…of` push into an array, or a
 *      `<details>`/`<summary>` list would contribute to none of the six counters — including
 *      {@link FAQ_JSONLD_WITHOUT_MARKUP}, where it would read as markup MISSING and fail loudly,
 *      which is the safe direction. No such block exists today: the six below are every `.map(` on
 *      {@link surfaceFiles}'s surface that reads both a `.question` and an `.answer`, minus the two
 *      JSON-LD projections named in {@link faqBlocksIn}.
 *   2. **The question and the answer are located by a MEMBER NAME.** `.question` and `.answer` are
 *      what all six blocks happen to call their fields. A block whose type spells them `soru` and
 *      `cevap`, or which destructures `const { question, answer } = item` and writes a bare
 *      `{question}`, is invisible to every counter here. This is the blind spot most likely to open
 *      during Task 8: a `FaqSection` that takes `items` and destructures inside its own `.map(`
 *      would keep the member read, but one that renders `<FaqItem {...entry} />` would not.
 *   3. **"Nearest element with a className" skips an unstyled wrapper.** Five of six blocks write
 *      `<span>{faq.question}</span>` with no classes inside a styled `<h3>`, and the counter files
 *      the spelling under the `<h3>`. That is the intent — a bare span is not a treatment — but it
 *      means moving the classes from the `<h3>` onto that span re-spells the block without changing
 *      a pixel, and {@link FAQ_QUESTION_SPELLINGS} would move.
 *   4. **No gate is evaluated, anywhere.** `inExpression` records that an element is written inside
 *      a `{…}`, never what the expression is or whether it is true. The three gates on this surface
 *      — `locale === "tr"`, `region.faqs?.length > 0`, and none — are the same fact to this file.
 *      So the shape this CANNOT see is exactly: **a page whose JSON-LD gate and markup gate are
 *      both present but DIFFER.** `{locale === "tr" && <JsonLd …/>}` beside
 *      `{region.faqs?.length > 0 && <section>…</section>}` reads as "both conditional", agrees, and
 *      publishes FAQPage data for questions an `/en` reader cannot see. What IS caught is a gate on
 *      one side and not the other, which is the shape the plan's finding 2 describes and which the
 *      "both sides of every pair agree about being conditional" control pins at zero mismatches.
 *   5. **A root element reads as unconditional.** `jsxElementsOf` scans the whole module, so the
 *      top-level brace counter also counts the `{` of every function body above the JSX and the
 *      returned `<>` of every page reads `inExpression: true`. {@link writtenUnderCondition}
 *      therefore ignores elements with no parent, which means a conditional wrapped around a whole
 *      module-scope element — `const Block = cond ? <section …/> : null` — is invisible. Nothing on
 *      this surface writes one.
 *   6. **Pairing is same-file, plus one named delegation.** {@link FAQ_JSONLD_WITHOUT_MARKUP} asks
 *      whether the identifier passed to `faqPageJsonLd` is the identifier a FAQ block in the same
 *      file maps, and {@link DELEGATED_FAQ_MARKUP} is the single rule that crosses a file boundary.
 *      A second delegation to a different component is a failure, by design: it must be reasoned
 *      about and named, not absorbed.
 *   7. **Identifier identity is TEXTUAL.** `faqPageJsonLd(region.faqs)` beside a
 *      `region.faqs.map(…)` pairs; `faqPageJsonLd(faqs)` beside `region.faqs.map(…)` does not, even
 *      where `const faqs = region.faqs` sits between them. The direction is safe — an alias reads
 *      as markup missing and fails — but it is a false alarm waiting for Task 9, which should keep
 *      the two spellings identical rather than introduce a local alias.
 *   8. **No line numbers, anywhere.** {@link readSource} collapses each comment to one space, so an
 *      index into it is not a source line (T-043). Every failure message names FILES.
 *   9. **Outside the walks nothing is seen.** Blocks are scanned over {@link surfaceFiles} (the
 *      reading and play page roots plus `components/v2`); `faqPageJsonLd` CALLS are scanned over
 *      the wider `app/`, `components/` and `lib/`, so a call from outside the block surface is a
 *      failure rather than an omission, and the "every caller is on the block surface" control
 *      pins that the two populations coincide today.
 *
 * MUTATION-CHECKED 2026-09-18, each counter AT THE VALUE IT IS PINNED AT — never at some earlier
 * number — each edit reverted from a copy and the suite re-run green. Seven breakages on the real
 * tree, each RED naming the files:
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
 *   - `HUB_FAQS.map(` rewritten `HUB_FAQS.slice().map(` so the JSON-LD's array is no longer the one
 *     the page maps — RED on {@link FAQ_JSONLD_WITHOUT_MARKUP}, `expected 1 to be 0`, naming
 *     `dunya/kita/page.tsx — faqPageJsonLd(HUB_FAQS)`, with every other counter unmoved;
 *   - the `locale === "tr" &&` gate removed from `turkiye/bolge/page.tsx`'s `<JsonLd>` while its
 *     markup stayed gated — RED on the pair-agreement control, `JSON-LD conditional=false, markup
 *     conditional=true`. That is the plan's finding 2 exactly: FAQPage data on `/en` for questions
 *     the English page does not render.
 *
 * And the exemption, one half at a time: `data={basinData}` on `deniz/akdeniz` changed to
 * `data={{ ...basinData }}` — RED, the page dropping out of the exempt four and into the counter;
 * `data.faq.map(` in the delegate changed to `data.faqs.map(` — RED on all four pages at once
 * (`expected 4 to be 0`) plus the delegate's own liveness row.
 *
 * WHERE THE PROBES LIVE. Every control that adds markup rather than breaking it injects into
 * `app/[locale]/(site)/hakkimizda/page.tsx`, which renders no FAQ and which neither Task 8 nor
 * Task 9 touches — so no control here depends on markup those tasks are contracted to rewrite,
 * the rule PR3 paid for five times and PR4 three. The counters themselves are SUPPOSED to move
 * when Task 9 converges the six blocks; their controls are not.
 *
 * The verbatim RED is in `.superpowers/sdd/2026-09-18-page-composition-pr5-pr6/task-7-report.md`.
 */
export const FAQ_ITEM_SPELLINGS = 4;

/** Distinct spellings of the element that carries the question text. In TWO element types —
 * `<h3>` ×5 and `<span>` ×1 — which is {@link FAQ_BLOCKS_WITHOUT_HEADINGS}'s whole subject. */
export const FAQ_QUESTION_SPELLINGS = 3;

export const FAQ_ANSWER_SPELLINGS = 4;

/** Distinct `(treatment, identity strategy)` pairs across the six enclosing `<section>`s. Both
 * halves are load-bearing: `space-y-6` is written by two shells that are labelled differently
 * (`aria-labelledby` on `/deniz`, an `id` anchor on `/dunya/kita`), so treatment alone reads 3 and
 * hides the fact that the two sections are not the same thing. Three strategies across four
 * shells: `aria-labelledby`, `id`, `id`+`tabIndex`. */
export const FAQ_SECTION_SHELLS = 4;

/** Blocks whose question element is not an `<h1>`…`<h6>`. One: the `/deniz` accordion. */
export const FAQ_BLOCKS_WITHOUT_HEADINGS = 1;

/**
 * `faqPageJsonLd(X)` calls where no FAQ block in the same file maps `X`, after
 * {@link DELEGATED_FAQ_MARKUP}. **This is the counter that matters, and 0 is the only correct
 * value on a shipped tree**: anything above it is structured data published for questions no
 * reader can see, which is Google's own definition of a violation and what `faqPageJsonLd`'s
 * docblock already required of its callers with nothing enforcing it.
 *
 * It asserts the WEAKER, DECIDABLE property, deliberately. PR3 spent four review rounds learning
 * that a reachability counter cannot evaluate a condition; the eight calls on this surface are
 * gated three different ways and none of those gates is read here. What is decided is identifier
 * identity in one file, plus one named delegation with four liveness halves. SCOPE note 4 states
 * precisely what that leaves invisible.
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
  it("found six blocks, one per renderer — anti-vacuity", () => {
    const blocks = faqBlocks();
    expect(
      blocks.map((block) => label(block.file)).sort(),
      `FAQ blocks found:\n${blocks.map((b) => `  ${label(b.file)} over ${b.mapped}`).join("\n")}`,
    ).toEqual([
      "app/[locale]/(site)/dunya/kita/[slug]/page.tsx",
      "app/[locale]/(site)/dunya/kita/page.tsx",
      "app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx",
      "app/[locale]/(site)/turkiye/bolge/page.tsx",
      "components/v2/v2-marine-faq-accordion.tsx",
      "components/v2/v2-sea-basin-detail-view.tsx",
    ]);
    // The walk really is wide enough to reach a `components/v2` renderer as well as a page: two of
    // the six are components, and a `page.tsx`-only walk would see four.
    expect(blocks.filter((block) => block.file.endsWith("page.tsx"))).toHaveLength(4);
  });

  it("a FAQ projection is not a FAQ block — clause (2) is still live", () => {
    // Both `turkiye/bolge` pages write a `.map(` that reads `.question` and `.answer` and renders
    // nothing. If this stops being true the JSX clause is inert and nobody would notice.
    for (const rel of ["turkiye/bolge/page.tsx", "turkiye/bolge/[slug]/page.tsx"]) {
      const file = join(repoRoot, "app/[locale]/(site)", rel);
      const masked = maskedSource(file);
      const qualifying = [...masked.matchAll(/\.map\s*\(/g)].filter((match) => {
        const open = match.index + match[0].length - 1;
        const body = masked.slice(open, matchingParen(masked, open));
        return body.includes(".question") && body.includes(".answer");
      });
      expect(qualifying, `${label(file)}: expected a projection map and a markup map`).toHaveLength(
        2,
      );
      expect(faqBlocksIn(file)).toHaveLength(1);
    }
  });

  it("every element span contains its children and opens after its parent", () => {
    // The premise `innermostElementAt` reads: elements arrive in pre-order, so the containing
    // element that opens LAST is the deepest one. Asserted over the real surface, not a fixture.
    for (const file of surfaceFiles()) {
      const elements = jsxElementsOf(file);
      let previous = -1;
      for (const element of elements) {
        expect(element.start, `${label(file)}: elements are not in source order`).toBeGreaterThan(
          previous,
        );
        previous = element.start;
        expect(
          element.end,
          `${label(file)}: <${element.tag}> ends before it starts`,
        ).toBeGreaterThan(element.start);
        if (element.parent === null) continue;
        const parent = elements[element.parent]!;
        expect(
          element.start >= parent.start && element.end <= parent.end,
          `${label(file)}: <${element.tag}> is not inside its parent <${parent.tag}>`,
        ).toBe(true);
      }
    }
  });

  it("innermostElementAt picks the deepest element, and nothing outside one", () => {
    const source =
      '<section className="a"><div className="b"><p className="c">x</p></div></section>';
    const elements = scanJsx(source);
    const at = (needle: string) => innermostElementAt(elements, source.indexOf(needle));
    expect(elements[at(">x<")!]!.spelling).toBe("c");
    expect(elements[at('className="b"')!]!.spelling).toBe("b");
    expect(innermostElementAt(elements, source.length + 5)).toBeNull();
    // An element passed as a prop lives inside its holder's header; the position inside it must
    // resolve to the prop-borne element, not to the holder.
    const withProp = '<Explorer panel={<aside className="p">x</aside>} className="holder" />';
    const propElements = scanJsx(withProp);
    expect(propElements[innermostElementAt(propElements, withProp.indexOf(">x<"))!]!.spelling).toBe(
      "p",
    );
  });

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

describe("the six FAQ blocks are counted by what they spell", () => {
  it("the number of distinct item-wrapper spellings is exactly the recorded number", () => {
    const spellings = new Set(faqBlocks().map((block) => spellingOf(block.item)));
    expect(spellings.size, `FAQ item wrappers:\n${spellingReport((b) => spellingOf(b.item))}`).toBe(
      FAQ_ITEM_SPELLINGS,
    );
    // The accordion's item wrapper carries NO className at all, and that is its own spelling rather
    // than a merge with a computed one — the two-marker rule the shared extractor states.
    expect(spellings).toContain(NO_CLASSNAME);
  });

  it("the number of distinct question-element spellings is exactly the recorded number", () => {
    const blocks = faqBlocks();
    const spellings = new Set(blocks.map((block) => spellingOf(block.question)));
    expect(
      spellings.size,
      `FAQ question elements:\n${spellingReport((b) => `<${b.question.tag}> ${spellingOf(b.question)}`)}`,
    ).toBe(FAQ_QUESTION_SPELLINGS);
    // Three spellings across TWO element types, which is the fact that makes the next counter
    // worth having: five `<h3>` and one `<span>`.
    const tags = blocks.map((block) => block.question.tag);
    expect(tags.filter((tag) => tag === "h3")).toHaveLength(5);
    expect(tags.filter((tag) => tag === "span")).toHaveLength(1);
  });

  it("the number of distinct answer-element spellings is exactly the recorded number", () => {
    const spellings = new Set(faqBlocks().map((block) => spellingOf(block.answer)));
    expect(
      spellings.size,
      `FAQ answer elements:\n${spellingReport((b) => `<${b.answer.tag}> ${spellingOf(b.answer)}`)}`,
    ).toBe(FAQ_ANSWER_SPELLINGS);
    // Every answer is a `<p>` — the one thing the six blocks already agree on.
    expect(new Set(faqBlocks().map((block) => block.answer.tag))).toEqual(new Set(["p"]));
  });

  it("the number of distinct section shells is exactly the recorded number", () => {
    const blocks = faqBlocks();
    expect(
      new Set(blocks.map(shellSignatureOf)).size,
      `FAQ section shells:\n${spellingReport(shellSignatureOf)}`,
    ).toBe(FAQ_SECTION_SHELLS);
    // Three labelling strategies across those four shells, and the reason the signature is a PAIR:
    // treatment alone reads 3, because `space-y-6` is written by two differently labelled shells.
    expect(new Set(blocks.map(labellingStrategyOf))).toEqual(
      new Set(["aria-labelledby", "id", "id+tabIndex"]),
    );
    expect(new Set(blocks.map((block) => spellingOf(block.shell))).size).toBe(3);
    // Every block is inside a `<section>`; a block that was not would sign as the null marker and
    // quietly become a fifth shell.
    expect(blocks.filter((block) => block.shell === null)).toEqual([]);
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
    expect(headless.map((block) => label(block.file))).toEqual([
      "components/v2/v2-marine-faq-accordion.tsx",
    ]);
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
  });

  it("the eight calls are exactly the pages that emit FAQPage — anti-vacuity", () => {
    const calls = faqJsonLdCalls();
    expect(
      calls.map((call) => `${label(call.file)} ${call.array}`),
      "faqPageJsonLd calls found",
    ).toEqual([
      "app/[locale]/(site)/deniz/akdeniz/page.tsx basinData.faq",
      "app/[locale]/(site)/deniz/ege/page.tsx basinData.faq",
      "app/[locale]/(site)/deniz/karadeniz/page.tsx basinData.faq",
      "app/[locale]/(site)/deniz/marmara/page.tsx basinData.faq",
      "app/[locale]/(site)/dunya/kita/[slug]/page.tsx continent.faqs",
      "app/[locale]/(site)/dunya/kita/page.tsx HUB_FAQS",
      "app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx region.faqs",
      "app/[locale]/(site)/turkiye/bolge/page.tsx bolgelerFaqs",
    ]);
    // Every call is written inside a `<JsonLd>` element, which is what makes the conditional test
    // below meaningful: it reads the gate on the element that emits the script tag.
    expect(new Set(calls.map((call) => call.holder))).toEqual(new Set(["JsonLd"]));
    // The caller walk is wider than the block walk, so this also says no call hides in `lib/` or
    // outside `components/v2` (SCOPE note 9).
    expect(
      calls.filter((call) => !surfaceFiles().includes(call.file)),
      "a faqPageJsonLd caller outside the FAQ block surface",
    ).toEqual([]);
  });

  it("both sides of every pair agree about being written under a condition", () => {
    // NOT an evaluation of the gate — see SCOPE note 4. What this catches is the asymmetric shape
    // the plan's finding 2 names: structured data emitted unconditionally beside markup behind a
    // gate, or the reverse. Two DIFFERENT conditions read as agreement, which is the blind spot.
    const mismatches = faqJsonLdCalls().flatMap((call) => {
      const blocks = faqBlocksIn(call.file).filter((block) => block.mapped === call.array);
      return blocks
        .filter((block) => block.conditional !== call.conditional)
        .map(
          (block) =>
            `${label(call.file)}: JSON-LD conditional=${call.conditional}, markup conditional=${block.conditional}`,
        );
    });
    expect(mismatches, "a FAQ gate on one side of the pair and not the other").toEqual([]);
    // The premise: the shapes really do differ across the surface, so agreement is a fact and not
    // a tautology. Two pages gate both sides, six gate neither.
    expect(faqJsonLdCalls().filter((call) => call.conditional)).toHaveLength(2);
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

describe("the delegated-markup exemption", () => {
  it("exempts exactly the four deniz basin pages, derived and not written", () => {
    const delegated = faqJsonLdCalls().filter(isDelegated);
    expect(
      delegated.map((call) => label(call.file)),
      "pages exempted by DELEGATED_FAQ_MARKUP",
    ).toEqual([
      "app/[locale]/(site)/deniz/akdeniz/page.tsx",
      "app/[locale]/(site)/deniz/ege/page.tsx",
      "app/[locale]/(site)/deniz/karadeniz/page.tsx",
      "app/[locale]/(site)/deniz/marmara/page.tsx",
    ]);
    // Without the exemption these four ARE the counter's whole population — so the exemption is
    // load-bearing rather than decorative, and the number it hides is four.
    expect(faqJsonLdCalls().filter((call) => faqBlocksIn(call.file).length === 0)).toHaveLength(4);
  });

  it("the delegate still writes the FAQ markup the exemption says it does", () => {
    const blocks = faqBlocksIn(DELEGATED_FAQ_MARKUP.delegate);
    expect(
      blocks.map((block) => block.mapped),
      `${label(DELEGATED_FAQ_MARKUP.delegate)} no longer maps data.faq; drop or restate the exemption`,
    ).toEqual(["data.faq"]);
    expect(blocks[0]!.conditional, "the delegate's FAQ markup is now behind a gate").toBe(false);
  });

  it("each exempt page passes the array it publishes to the delegate it names", () => {
    for (const call of faqJsonLdCalls().filter(isDelegated)) {
      const binding = importBindingsOf(call.file).get(DELEGATED_FAQ_MARKUP.export);
      expect(binding, `${label(call.file)} no longer imports the delegate`).toBeDefined();
      expect(
        resolvesTo(binding!, DELEGATED_FAQ_MARKUP.delegate, DELEGATED_FAQ_MARKUP.export),
        `${label(call.file)}'s ${DELEGATED_FAQ_MARKUP.export} is not the one the exemption names`,
      ).toBe(true);
      const elements = jsxElementsOf(call.file);
      const source = readSource(call.file);
      const rendered = elements.filter((e) => e.tag === DELEGATED_FAQ_MARKUP.export);
      expect(rendered, `${label(call.file)} no longer renders the delegate`).toHaveLength(1);
      expect(
        propValueOf(tagTextAt(source, rendered[0]!.start), DELEGATED_FAQ_MARKUP.prop),
        `${label(call.file)} no longer hands the published array to the delegate`,
      ).toBe(call.array.split(".")[0]);
    }
  });

  it("the published questions are the delegate's own, at the value level", () => {
    // The one thing here that is a pure function rather than a source shape: `faqPageJsonLd` is
    // given `basinData.faq` and the delegate renders `data.faq`, so the text the four pages publish
    // is the text the delegate maps — asserted on the OUTPUT of the function, not on a substring of
    // a page that mentions it.
    //
    // 12 QUESTIONS, NOT 13. The plan's Measurements section calls this "4 basins, 13 questions";
    // `lib/marine/sea-basins-detail.ts` holds 13 `question:` occurrences and one of them is the
    // `SeaBasinFAQ` interface's own field declaration. The data is 3 + 3 + 3 + 3.
    const basins = Object.values(SEA_BASINS_DETAIL);
    expect(basins).toHaveLength(4);
    let questions = 0;
    for (const basin of basins) {
      const schema = faqPageJsonLd(basin.faq) as unknown as {
        mainEntity: { name: string; acceptedAnswer: { text: string } }[];
      };
      expect(schema.mainEntity.map((entry) => entry.name)).toEqual(
        basin.faq.map((entry) => entry.question),
      );
      expect(schema.mainEntity.map((entry) => entry.acceptedAnswer.text)).toEqual(
        basin.faq.map((entry) => entry.answer),
      );
      questions += basin.faq.length;
    }
    expect(questions).toBe(12);
    expect(basins.map((basin) => basin.faq.length)).toEqual([3, 3, 3, 3]);
  });

  it("a page that stops delegating falls back into the counter", () => {
    // The exemption cannot outlive its reason, proved one half at a time. The host is
    // `hakkimizda`, not a `deniz` page, so nothing here depends on markup a later task may move.
    const importsDelegate = `import { V2SeaBasinDetailView } from "@/components/v2/v2-sea-basin-detail-view";\n`;
    const emits = (body: string) =>
      [
        importsDelegate,
        `const probeBasin = { faq: [] };`,
        `function DelegateProbe() {`,
        `  return (`,
        `    <>`,
        `      <JsonLd schema={faqPageJsonLd(probeBasin.faq)} />`,
        `      ${body}`,
        `    </>`,
        `  );`,
        `}`,
      ].join("\n");

    // Relative: the rows the probe ADDS to whatever the tree already reads.
    const rows = () => jsonLdWithoutMarkup().map((call) => `${label(call.file)} ${call.array}`);
    const before = rows();
    const orphansFor = (body: string) =>
      withProbe(emits(body), rows).filter((row) => !before.includes(row));

    // Delegating correctly: exempt, nothing counted.
    expect(orphansFor(`<V2SeaBasinDetailView data={probeBasin} />`)).toEqual([]);
    // The delegate rendered, but handed a DIFFERENT object — the array published is not the array
    // the delegate maps, so the exemption does not apply.
    expect(orphansFor(`<V2SeaBasinDetailView data={somethingElse} />`)).toEqual([
      "app/[locale]/(site)/hakkimizda/page.tsx probeBasin.faq",
    ]);
    // The delegate rendered under a condition while the JSON-LD is not — no exemption.
    expect(orphansFor(`{show && <V2SeaBasinDetailView data={probeBasin} />}`)).toEqual([
      "app/[locale]/(site)/hakkimizda/page.tsx probeBasin.faq",
    ]);
    // Not rendered at all, only imported — the dead-reference shape a substring pin would accept.
    expect(orphansFor(`<div />`)).toEqual([
      "app/[locale]/(site)/hakkimizda/page.tsx probeBasin.faq",
    ]);
    expect(rows()).toEqual(before);
  });
});
