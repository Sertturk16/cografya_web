# T-035 Page Composition Implementation Plan — PR5 and PR6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the six FAQ blocks one component that carries the visible text, the structured data and the anchor together — and then delete what four PRs have left behind.

**Architecture:** One new `components/patterns/faq-section.tsx` adopted at all six renderers, with structured data **optional** and single-sourced. Then a cleanup PR that removes 3087 lines of unreachable code, fixes the two orphan tests that certified it, and corrects six docblocks that describe a tree which no longer exists.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4 (CSS-first), shadcn `base-nova` on Base UI, next-intl 4, vitest (node env, no jsdom).

**Spec:** `docs/superpowers/specs/2026-09-17-page-composition-design.md`
**Prior plans:** `2026-09-17-page-composition.md` (PR1, PR2) and `2026-09-18-page-composition-pr3-pr4.md` (PR3, PR4) — all landed on `dev`.
**Measurement this plan argues from:** `.superpowers/sdd/pr5-pr6-measurement.md`, taken 2026-09-18 after PR4.

## What has already been taken out of PR6

- **The container convergence shipped as T-046** (#190, `4d6759a`). It was not a tidy-up: five pages were rendering their whole body outside any container on ~96 routes. Do not re-plan it.
- **The scanner split shipped as T-045** (#189, `67771af`). `components/v2/page-composition-{containers,headings,cards}.test.ts` over one `lib/test-support/composition-scan.ts`. **PR5's counters join the shared scanner; they do not add a fourth.**
- **T-042 is absorbed by PR6, not duplicated.** Both currently claim the same deletions. PR6 is the implementation; T-042's board entry becomes a pointer.

## Measurements (2026-09-18, on `dev` after PR4)

Every figure re-measured. The figures in the spec and in T-035's board entry are from 2026-09-17 and several were wrong when written.

|                                | Measured                                                           |
| ------------------------------ | ------------------------------------------------------------------ |
| Files rendering FAQ markup     | **6**                                                              |
| Pages emitting `faqPageJsonLd` | **8** (the 4 `deniz` basins delegate their markup)                 |
| FAQ rendering mechanisms       | **2** — a real `Accordion` (1 file) and a static Q/A card grid (5) |
| Item-wrapper spellings         | **4**                                                              |
| Question-element spellings     | **3**, in **2** different elements (`<h3>` ×5, `<span>` ×1)        |
| Answer-element spellings       | **4**                                                              |
| Question-marker affordances    | **4**                                                              |
| Section-shell spellings        | **4**, with **3** labelling strategies                             |
| Dead lines PR6 removes         | **3087** + 16 orphaned message keys                                |

**The old claim "12 files, 87 occurrences, three mechanisms" was wrong on all three counts**, and its definition is unrecoverable. There is no third mechanism: it was "plain list without JSON-LD", and every static grid now emits `faqPageJsonLd`. No FAQ block anywhere uses `<details>/<summary>`.

### The six renderers

| File                                                | Mechanism        | Items from                                                 | Structured data               | Gate                            |
| --------------------------------------------------- | ---------------- | ---------------------------------------------------------- | ----------------------------- | ------------------------------- |
| `components/v2/v2-marine-faq-accordion.tsx`         | real `Accordion` | 7 items **hardcoded in Turkish** in the file               | **none**                      | none — renders on `/en/sea` too |
| `components/v2/v2-sea-basin-detail-view.tsx`        | static card list | `lib/marine/sea-basins-detail.ts` (4 basins, 13 questions) | emitted by its 4 caller pages | none                            |
| `app/[locale]/(site)/turkiye/bolge/page.tsx`        | static card grid | `buildBolgelerFaqs()` — 3 written + 1 derived              | `faqPageJsonLd`               | `locale === "tr"`, both sides   |
| `app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx` | same             | `region.faqs` (API)                                        | `faqPageJsonLd`               | `region.faqs?.length > 0`       |
| `app/[locale]/(site)/dunya/kita/page.tsx`           | static card grid | `HUB_FAQS` local const                                     | `faqPageJsonLd`               | none                            |
| `app/[locale]/(site)/dunya/kita/[slug]/page.tsx`    | same             | `lib/geo/continents.ts` (7 continents, 29 questions)       | `faqPageJsonLd`               | none                            |

### Three findings that shape the component

**1. The recorded "no FAQPage here" decision describes blocks that are not rendered.** `lib/marine/explainers.ts` has **zero product consumers** — its only importers are two of its own tests. `git log -S buildMarineExplainers -- app` shows its single render site was **V1's** `/deniz`, deleted by T-032. Its eight Q/A pairs still ship as `Deniz.q1…a8` in `messages/tr.json`, rendered by nothing. Meanwhile the block actually on `/deniz` — `V2MarineFaqAccordion` — is the one FAQ in the tree with **no** structured data and carries **no recorded reason of its own**.

So the spec's "FaqSection must not mandate JSON-LD, because `/deniz` deliberately declines it" is right for the wrong reason. The conclusion survives; the citation does not.

**2. The guarantee nothing enforces.** `faqPageJsonLd`'s own docblock requires the schema text and the visible text to come from one source. Nothing checks it. Three blocks are gated (locale, data length, none) and a gate on one side but not the other would publish structured data for questions a reader cannot see — Google's own definition of a violation.

**3. `/deniz`'s FAQ contributes no headings to the document outline.** Five of six blocks emit an `<h3>` per question; the accordion emits a `<span>` inside a button. PR3 ruled the two `h1` tiers and left `h2`/`h3` unruled; this is where that omission shows.

## Global Constraints

From `CLAUDE.md`, `docs/conventions.md`, `docs/design.md`. Every task's requirements implicitly include these.

- Import `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation`, **never** from `next/link` or `next/navigation`.
- Colour from a bridge token. No brand hex, no raw Tailwind palette class, no hand-written `dark:`. `components/ui/token-binding.test.ts` enforces this in `components/ui`, `components/patterns` and `components/showcase/specimens`.
- `Button` has no `asChild`. A link styled as a button is `<Link className={cn(buttonVariants({ variant, size }))}>`.
- `import "server-only"` guards are load-bearing; `components/patterns/rsc-boundary.test.ts` walks every `"use client"` file's import closure.
- Every new `components/patterns` component needs a `/design-system` specimen and a `components/showcase/registry.ts` entry.
- Tests co-located. Vitest globs `lib/**`, `components/**`, `tools/**`; nothing under `app/` runs.
- No jsdom. Render with `renderToStaticMarkup` from `react-dom/server`.
- Source-text greps strip comments via `lib/test-support/strip-comments.ts`. **Never derive a line number from stripped output** — it collapses each comment to one space (T-043).
- **A counter is pinned at its MEASURED value and mutation-checked AT THAT VALUE**, then tightened.
- **A guard's population is derived, not written.** This shape produced findings four times across PR3–T-046.
- **No control may depend on markup a later task in the same plan is contracted to delete**, or on a page whose state the plan changes.
- **Assert rendered output, not source substrings**, wherever the thing under test is a pure function of props. A dead reference satisfies a substring pin — that defect arrived four times.
- Prettier: double quotes, semicolons, trailing commas, width 100.
- Conventional Commits, scope = surface, each commit ending with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Gate: `pnpm typecheck`, `pnpm lint`, `pnpm test` as **separate** commands, each exit code read alone, plus `pnpm build`. Baseline on `dev`: **220 files / 4903 tests**, lint **0 problems**. A random province or country page failing with `ECONNRESET` is the recorded flake and reproduces more readily while a browser holds the API; tell it from a real failure by whether the compile phase printed `✓ Compiled successfully`.

---

# PR5 — `FaqSection`

## Task 7: Pin the FAQ counters

**Files:** Create `components/v2/page-composition-faq.test.ts`; modify `lib/test-support/composition-scan.ts` only if the shared layer genuinely lacks something.

**Interfaces:** Consumes `walkRenderRoots()`, `surfaceFiles()`, `readSource`, the literal extractor and the binding resolver from `lib/test-support/composition-scan.ts`. Produces `FAQ_ITEM_SPELLINGS`, `FAQ_QUESTION_SPELLINGS`, `FAQ_ANSWER_SPELLINGS`, `FAQ_SECTION_SHELLS`, `FAQ_BLOCKS_WITHOUT_HEADINGS`, `FAQ_JSONLD_WITHOUT_MARKUP`.

- [ ] **Step 1: Locate the FAQ blocks by content, never by line**

The region is the `.map(` over the FAQ array in each of the six renderers. Every `file:line` in this plan and in the measurement is from 2026-09-18 and **10 of 14 cited line numbers went stale one commit later** during PR4. Locate by content.

- [ ] **Step 2: Pin the six counters at their measured values**

Measured: item wrappers **4**, question spellings **3**, answer spellings **4**, section shells **4**, blocks with no per-question heading **1**, and `faqPageJsonLd` calls whose array is not also rendered **0**. Measure them yourself first; if a figure has moved, that is the finding, and `FAQ_JSONLD_WITHOUT_MARKUP` is the one that must be 0 on a correct tree.

- [ ] **Step 3: `FAQ_JSONLD_WITHOUT_MARKUP` is the counter that matters and the hardest to write**

It must relate two things that are far apart in the source: a `faqPageJsonLd(X)` call and whether the same page renders `X`. Both are gated in three different ways — `locale === "tr"`, `region.faqs?.length > 0`, and unconditionally. **Do not try to evaluate the gates**; PR3 learned that a reachability counter cannot evaluate a condition and the answer is a named exemption with a liveness assertion, not a cleverer scan. Assert the weaker property you _can_ decide: the identifier passed to `faqPageJsonLd` is also the identifier mapped over in the same file, and where the two sit under different conditions, that pair is a named, reasoned exemption whose guard literals are asserted.

Say in the docblock what this cannot see: a page whose JSON-LD gate and markup gate are both present but _differ_.

- [ ] **Step 4: SCOPE paragraph, mutation checks, gate, commit**

Name concrete blind spots. "This test has limitations" was rejected by a review once and will be again. Mutation-check every counter at its pinned value: break the thing it exists to catch, record RED verbatim including the file list, revert, confirm GREEN.

```bash
pnpm typecheck
pnpm lint
pnpm test
git add components/v2/page-composition-faq.test.ts
git commit -m "test(v2/faq): pin the six FAQ spellings and the JSON-LD/markup pair"
```

## Task 8: Build `FaqSection`

**Files:** Create `components/patterns/faq-section.tsx` + `faq-section.test.tsx`; modify `components/showcase/registry.ts` and a specimen.

**Interfaces:** Produces

```tsx
type FaqSectionProps = {
  readonly id?: string; // defaults to "sss"
  readonly heading: string;
  readonly items: readonly FaqEntry[]; // from lib/seo/json-ld.tsx
  readonly mechanism?: "list" | "accordion"; // defaults to "list"
  readonly structuredData?: false | ContentSurface;
  readonly className?: never;
};
```

- [ ] **Step 1: Write the failing test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaqSection } from "./faq-section";

const ITEMS = [
  { question: "Soru bir?", answer: "Cevap bir." },
  { question: "Soru iki?", answer: "Cevap iki." },
] as const;

describe("FaqSection", () => {
  it("gives every question a heading, in both mechanisms", () => {
    for (const mechanism of ["list", "accordion"] as const) {
      const html = renderToStaticMarkup(
        <FaqSection heading="SSS" items={ITEMS} mechanism={mechanism} />,
      );
      expect(html.match(/<h3/g)).toHaveLength(2);
    }
  });

  it("names the section for assistive technology and owns its anchor", () => {
    const html = renderToStaticMarkup(<FaqSection heading="SSS" items={ITEMS} />);
    expect(html).toContain('id="sss"');
    expect(html).toContain("aria-labelledby");
    expect(html).toContain("scroll-mt-28");
  });

  it("renders no structured data unless asked", () => {
    const html = renderToStaticMarkup(<FaqSection heading="SSS" items={ITEMS} />);
    expect(html).not.toContain("application/ld+json");
  });

  it("renders every item it puts in the structured data", () => {
    const html = renderToStaticMarkup(
      <FaqSection heading="SSS" items={ITEMS} structuredData="localized" />,
    );
    const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1] ?? "";
    for (const item of ITEMS) {
      expect(ld).toContain(item.question);
      expect(html).toContain(item.question);
    }
  });

  it("renders nothing at all for an empty list", () => {
    expect(renderToStaticMarkup(<FaqSection heading="SSS" items={[]} />)).toBe("");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

`pnpm vitest run components/patterns/faq-section.test.tsx` — expect `Cannot find module './faq-section'`.

- [ ] **Step 3: Write the component**

Rulings it implements, each from the measurement rather than from taste:

- **Structured data is optional and single-sourced.** One `items` array feeds both the markup and the schema, so they cannot drift. `structuredData={false}` is the default: one block legitimately has none.
- **Every question gets an `<h3>`, in both mechanisms.** The accordion wraps its trigger in an `<h3>` — that is what Base UI's accordion is designed for and it is how `/deniz` stops being the one FAQ invisible to the document outline.
- **The section owns its anchor, its scroll offset and its focus target.** Today `turkiye/bolge*` pair `id="sss"` with `scroll-mt-28 tabIndex={-1}`, `dunya/kita*` carry the id with neither, and `/deniz` and the basins carry no anchor at all. One component, one behaviour.
- **The section is always named.** Two of the four shells have no accessible name.
- **`className?: never`.** PR4 found this defeated by an index-signature spread with `{...rest}` applied after `className`; strip `className` and `class` out of any rest and put the spread first, and **pin the runtime half**, not only the type.

- [ ] **Step 4: Specimen, registry, gate, commit**

The specimen must render both mechanisms and both structured-data states.

```bash
pnpm vitest run components/showcase/registry.test.ts
pnpm typecheck
pnpm lint
pnpm test
git add components/patterns components/showcase
git commit -m "feat(v2/faq): add FaqSection with optional, single-sourced structured data"
```

## Task 9: Adopt `FaqSection` on all six renderers

**Files:** Modify the six renderers, the four `deniz` basin pages' JSON-LD arrays, and `components/v2/page-composition-faq.test.ts`.

- [ ] **Step 1: The four static grids that already emit JSON-LD**

`turkiye/bolge`, `turkiye/bolge/[slug]`, `dunya/kita`, `dunya/kita/[slug]`. Their gates move onto the component's `structuredData` prop, and **the gate must move as one**: today the markup and the schema are gated separately on the same condition, which is correct and accidental. Passing one `items` array and one switch makes it structural.

- [ ] **Step 2: `v2-sea-basin-detail-view.tsx` and its four caller pages**

The view renders the markup; the four pages emit the schema. That split is what `FAQ_JSONLD_WITHOUT_MARKUP` exists to watch. Decide deliberately: either the view takes `structuredData` and the pages stop emitting it, or the pages keep it and the exemption is named with its reason. **Say which and why in the report** — do not let the split survive by default.

- [ ] **Step 3: `/deniz`'s accordion — and the Turkish it ships to `/en/sea`**

`V2MarineFaqAccordion` hardcodes seven Turkish Q/A pairs in `FAQ_ITEMS` rather than reading `messages/*`, and `deniz/page.tsx` renders it with **no locale gate**, so `/en/sea` shows Turkish. The page is `trNarrative`, so it is `noindex` in EN and this is a content defect rather than an SEO one — but it is the only FAQ block in the tree that is not message-driven, and adopting a component that takes `items` makes it visible.

Move the seven pairs into `messages/{tr,en}.json`. `docs/architecture.md` already forbids adding a hardcoded string to a file that uses `useTranslations`. If the English copy does not exist, **do not invent it** — board it beside T-040 and gate the block to `tr` in the meantime, saying so.

- [ ] **Step 4: Drive the counters, run the gate, visual round**

`FAQ_ITEM_SPELLINGS`, `FAQ_QUESTION_SPELLINGS`, `FAQ_ANSWER_SPELLINGS` and `FAQ_SECTION_SHELLS` to 1 each; `FAQ_BLOCKS_WITHOUT_HEADINGS` to 0. Re-run each mutation check **at the new value** — this rule caught something twice in PR3 and twice in PR4.

Then the visual round: 320/360/390/desktop, both themes, `localStorage.theme` via `addInitScript` **before** navigation, PNGs persisted with their paths. Six blocks change markup; the accordion changes element structure. Check the `#sss` scroll landing from the sticky quicknav on `turkiye/bolge*` specifically — the component now owns `scroll-mt-28`.

---

# PR6 — delete what four PRs left behind

## Task 10: Delete the orphans, and fix the two tests that certified them

**Files:** Delete `components/tools/{tool-island,tool-measurement-list,tool-measurement-save}.tsx`, `tool-png.ts`, `tools.module.css`; delete `components/patterns/{callout,empty-state,map-attribution,map-legend,theme-pair}.tsx`; delete `lib/marine/explainers.ts` and its two tests; remove 16 `Deniz.q*`/`a*` keys from `messages/tr.json`. Modify `components/ui/orphan.test.ts`, `components/orphan-stylesheets.test.ts`, their specimens and the registry.

**3087 lines.** Verify each count before deleting it; T-042's board text is stale in a way that would delete PR4's work.

- [ ] **Step 1: Re-verify every orphan on today's tree before deleting anything**

**PR4 gave `stat-tile.tsx`, `stat-grid.tsx` and `metric-value.tsx` twelve product importers each.** T-042's board entry still lists `stat-tile` and `metric-value` as orphans. Deleting on the strength of that text would delete PR4's work. Re-verify with the binding resolver in `lib/test-support/composition-scan.ts`, not with a grep — `import type` edges are erased at build and must not count as reachability, which is exactly how `components/tools/` stayed alive.

`components/ui/tabs.tsx` stays: it is the one recorded exception, `orphan.test.ts`'s `KNOWN_SHOWCASE_ONLY`, and its four real call sites carry a live a11y defect T-036 recorded and left for later.

- [ ] **Step 2: Fix both orphan tests at once — they are the same bug**

`orphan.test.ts` walks from `PRODUCT_ROOTS`, and that list contains whole directories, so every file inside a root is automatically "reachable"; it genuinely audits only `components/ui`. `orphan-stylesheets.test.ts` asserts that an importer **exists**, not that one is **reachable** — which is why it is green on `tools.module.css`, whose four importers are all dead.

Fixing only the component side leaves the stylesheet certified by four corpses. Narrow `PRODUCT_ROOTS` so a directory is either a root or audited, never both, and make the stylesheet check ask for a reachable importer.

- [ ] **Step 3: `map-attribution` is a move, not a delete**

`patterns/map-attribution.tsx` (66 lines, 0 product consumers, 4 showcase) and `v2-map-attribution.tsx` (102 lines, **10** product consumers) render the same mandatory ODbL credit. `docs/design.md` lists `map-attribution` as the patterns component — it points at the file nobody uses. Move the live one into `patterns/`, delete the orphan, update the doc.

- [ ] **Step 4: Gate and commit**

`pnpm build` included: this deletes files that pages might still reach in a way the resolver missed. A build that still emits 992 pages is the check that matters.

## Task 11: The `surface` duplication, and the docblocks that describe a tree that no longer exists

**Files:** Modify the seven auth pages, `components/patterns/breadcrumbs.tsx`, `components/tools/tool-hub-card.structure.test.ts` (if it survives Task 10), `docs/architecture.md`, `cografya_web/CLAUDE.md`, the workspace `CLAUDE.md`, `components/v2/page-composition-containers.test.ts`.

- [ ] **Step 1: `AUTH_SURFACE`, because it is free**

Seven pages, one import and one token each, zero behaviour change. It removes the largest coherent block of hand-typed `ContentSurface` literals without touching the other 22. `araclar/*`'s `TOOLS_SURFACE` is the pattern.

There are **33** `buildMetadata`/`<Breadcrumbs>` surface pairs, not 37 — 37 is the page count; the three `(play)` screens and `(site)/page.tsx` carry none. All 33 agree today, and **nothing asserts that they do**: `sitemap-surface-symmetry.test.ts` matches `surface: "…"` only, never the `surface="…"` JSX prop. Add the assertion, or say plainly in the docblock that the agreement is unguarded.

- [ ] **Step 2: Six docblocks that are green because they stopped looking**

Each of these is green or unread today, which is why none was caught:

1. `components/tools/tool-hub-card.structure.test.ts` says `tools.module.css` "was deleted with the V1 page in T-032 PR3, so the three CSS pins have no file to read." **The file is 514 lines on disk.** The test is green because it stopped reading the CSS, not because the CSS went away — the exact inversion of the failure this repo keeps naming.
2. `components/patterns/breadcrumbs.tsx` pins "all 37 pairs" — there are 33.
3. `components/orphan-stylesheets.test.ts` asserts an importer exists rather than that one is reachable. Its own docblock explains at length how a substring match once hid `map.module.css`; the successor has the same shape one level up.
4. `docs/architecture.md` and `cografya_web/CLAUDE.md` both say the ten surviving `*.module.css` files each have live consumers. `tools.module.css` has none.
5. The **workspace** `CLAUDE.md` says "The eleven remaining CSS Modules all have live consumers." There are **ten**, and one has none. Wrong twice in one sentence.
6. `PAGE_BODY_SPELLINGS`' SCOPE note cites line numbers derived from stripped text — T-043's trap, already sprung inside a docblock. The count it quotes is still right; the distribution has moved and it omits `turkiye/bolge/[slug]`, which now carries one.

Fix the claims, not just the wording. Where a sentence asserted a guarantee, either make it true or replace it with what is true.

- [ ] **Step 3: Gate, commit**

---

## After PR6

What remains on the board, in the order it should be picked up:

- **T-047** — the `scrollWidth === clientWidth` sweep. Every counter this programme built is a source-text counter, and the three horizontal-overflow defects it found were all invisible to every one of them.
- **T-043** — `stripComments` shifts line numbers after any multi-line comment; a trap that is set, not sprung, except in the one docblock Task 11 fixes.
- **T-040** — `/turkiye/bolge`'s FAQ in English. PR5's `FaqSection` removes its visible-markup half; the locale classification, the number formatting and the `%` side remain.
- **T-031c** — the categorical palette, which now owns two things PR4 deliberately left: `v2-sea-basin-detail-view`'s frozen `text-cyan-600`, and `/deprem`'s KAF/DAF/BAFS legend.
