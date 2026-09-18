import type { Locale } from "@/i18n/routing";
import { isIndexable, type ContentSurface } from "@/lib/seo/indexing";
import { faqPageJsonLd, JsonLd, type FaqEntry } from "@/lib/seo/json-ld";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

/**
 * SERVER COMPONENT. One FAQ block: the visible questions and answers, and — when the surface is
 * indexable in this locale — the `FAQPage` JSON-LD that matches them, from ONE array.
 *
 * ## What was measured
 *
 * Six hand-written FAQ blocks (`components/v2/page-composition-faq.test.ts` pins the numbers):
 * four item spellings, three question spellings, four answer spellings, four shells. One block
 * carried no heading at all, so its questions were invisible to the document outline. Two of the
 * four shells had no accessible name. `turkiye/bolge*` paired `id="sss"` with
 * `scroll-mt-28 tabIndex={-1}`, `dunya/kita*` carried the id with neither, and `/deniz` and the
 * sea basins carried no anchor at all — three behaviours for one affordance.
 *
 * ## The rulings it implements
 *
 * - **Structured data is optional and single-sourced.** `items` feeds the markup and the schema,
 *   so they cannot drift — the failure mode `lib/seo/json-ld.tsx` warns about (marked-up text that
 *   is not on the page) needs two sources to happen, and there is one. `structuredData={false}` is
 *   the default because one of the six blocks legitimately has none.
 * - **The gate is COMPUTED, never passed.** `isIndexable(locale, structuredData)`, the same shape
 *   `components/patterns/breadcrumbs.tsx` carries: a per-page boolean is exactly what produced the
 *   24-file trail/JSON-LD gap that component was built to close, and it would reproduce it the
 *   first time someone added a page and left the prop off.
 * - **Every question gets an `<h3>`, in both mechanisms.** The accordion gets its `<h3>` from
 *   `Accordion.Header` — which is why `components/ui/accordion.tsx` had to be rebuilt on Base UI
 *   first. The same rebuild is what keeps a CLOSED answer in the document, without which the
 *   accordion mechanism could not honestly carry `FAQPage` markup at all.
 * - **The section owns its anchor, its scroll offset and its focus target.** One `id`, one
 *   `scroll-mt-28`, one `tabIndex={-1}`, for every caller.
 * - **The section is always named**, by a heading that always exists and always carries the id
 *   `aria-labelledby` points at.
 *
 * ## `className?: never`, and the runtime half of it
 *
 * The type refuses every honest spelling; a `Record<string, unknown>` spread defeats it silently.
 * What holds is the IMPLEMENTATION: every prop is read by name and NO rest object is ever spread
 * onto an element, so `className`, `class` and anything else smuggled in lands nowhere. That is
 * strictly stronger than stripping a two-name deny-list out of a rest object and spreading the
 * remainder, which is what the brief asked for: a deny-list only removes the names on it.
 * `components/patterns/page-hero.tsx` holds the line the same way, and its test says why.
 * `faq-section.test.tsx` pins the runtime half here, with `class` smuggled alongside `className`.
 *
 * ## Why the items are mapped ONCE, in this file
 *
 * The `.map(` below reads `item.question` and `item.answer` in one place and builds whichever
 * element pair the mechanism calls for. Not a `<FaqItem>` of its own: the FAQ liveness counters
 * are written against a single map over `items` inside this component, and a split would make the
 * questions and the answers two hops apart for a scanner that has to prove they come from the
 * same array.
 */
export interface FaqSectionProps {
  /** The anchor. Defaults to `"sss"`, which is what five of the six blocks already used. */
  readonly id?: string;
  readonly heading: string;
  /**
   * One sentence under the heading, saying what this block covers. Rendered only when given.
   *
   * RULING CI — COPY IS NOT ORNAMENT. Task 9's first pass converged the six blocks and dropped
   * everything around their headings with the same stroke: the badges, the `HelpCircle` icons, the
   * "Merak Edilenler" eyebrows, the `1.` `2.` numbering — and the two `turkiye/bolge` ledes. The
   * first four were the shell variance `page-composition-faq.test.ts` measured and they are
   * correctly gone. A lede is not that: it is editorial copy someone wrote, it carries information
   * the questions do not, and no counter ever asked for it. Restoring it needed a prop rather than
   * a `className` escape hatch, which is the shape this component refuses on purpose.
   *
   * `string`, not `ReactNode`, deliberately — narrower than `PageHero`'s `lede`. A block of
   * questions wants a sentence; widening to `ReactNode` would let a caller pass the badge row back
   * in through the one door this component leaves open.
   */
  readonly lede?: string;
  /** Gates the JSON-LD together with `structuredData`; never a hand-passed boolean. */
  readonly locale: Locale;
  readonly items: readonly FaqEntry[];
  /** `list` is the default; `accordion` is for a long block a reader scans before reading. */
  readonly mechanism?: "list" | "accordion";
  /** `false` emits no schema at all. A `ContentSurface` emits it where that surface indexes. */
  readonly structuredData?: false | ContentSurface;
  /** No escape hatch. See the note above. */
  readonly className?: never;
}

export function FaqSection(props: FaqSectionProps) {
  // Read by name, deliberately — see the `className?: never` note above. Nothing here is a rest
  // object, so nothing here can reach an element.
  const id = props.id ?? "sss";
  const { heading, lede, locale, items, mechanism = "list", structuredData = false } = props;

  // An empty block is not an empty section with a heading over it: it is no section. The callers
  // that pass a possibly-empty array (`region.faqs`, `continent.faqs`) wrote this guard by hand,
  // each in its own spelling, and one of them wrote it as `?.length > 0` on a non-optional field.
  if (items.length === 0) return null;

  const headingId = `${id}-baslik`;
  const schema = structuredData !== false && isIndexable(locale, structuredData);

  // The default branch first, which is simply the plain reading order — `mechanism` defaults to
  // `"list"`. This used to carry a "do not swap these two arms" warning, because the FAQ block
  // scanner attributed a spelling from the FIRST `.question` read and the accordion arm writes no
  // classes of its own, so the arms' order decided whether this component counted as a FAQ block
  // at all. That was a property of the scanner, not of this component, and T-035 PR5 fixed it
  // there: any read in any arm now qualifies the block. Nothing here depends on the order.
  // The accordion's `value` is the QUESTION, not the index: `value` is what Base UI tracks a
  // panel's open state by, so a reordered or filtered list keeps each panel attached to its own
  // question instead of to the slot it happened to sit in.
  const entries = items.map((item) =>
    mechanism === "list" ? (
      /* THE PRIMITIVE, not a hand-drawn card. All four live item spellings draw their own surface
         — `rounded-2xl border border-border bg-card p-5 space-y-2` and three near-misses — and
         copying any of them into a shared pattern component would ADD a 196th hand-drawn card to
         the surface PR4 spent a branch collapsing (`page-composition-cards.test.ts`). `panel` is
         the nearest closed setting: the card language `docs/design.md` names, the surface both
         `turkiye/bolge` blocks already wrap their whole FAQ in, and — unlike `glass`, whose
         geometry matches these items exactly — a surface that means what it is used for here
         rather than "translucent hero strip over a gradient band".
         `elevation="xs"` is the one departure from `panel`'s default `sm`: the items it replaces
         carried no shadow at all, and the union's floor is `xs`. `as="article"` because a
         question-with-its-answer is self-contained; `space="3"` because `space-y-2` is not in the
         union and 4px would run the question into the answer at these sizes. */
      <Card key={item.question} as="article" variant="panel" elevation="xs" space="3">
        <h3 className="font-heading font-bold text-sm text-foreground">{item.question}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
      </Card>
    ) : (
      /* The accordion carries no classes of its own: `components/ui/accordion.tsx` owns the look,
         its `AccordionTrigger` supplies the `<h3>` through `Accordion.Header`, and its panel keeps
         a closed answer in the document so this branch can honestly carry the same schema. */
      <AccordionItem key={item.question} value={item.question}>
        <AccordionTrigger>{item.question}</AccordionTrigger>
        <AccordionContent>{item.answer}</AccordionContent>
      </AccordionItem>
    ),
  );

  return (
    <section id={id} aria-labelledby={headingId} tabIndex={-1} className="scroll-mt-28 space-y-6">
      {/* `items` ITSELF, not a copy and not a projection. `faqPageJsonLd` takes
          `readonly FaqEntry[]` so that the schema and the markup below can be the SAME identifier
          — which is what makes the pair decidable in one file for
          `components/v2/page-composition-faq.test.ts`, and, more to the point, what makes it
          impossible for the two to drift. A `[...items]` copy read identically to a human and as
          "(not an identifier)" to the scanner. */}
      {schema ? <JsonLd schema={faqPageJsonLd(items)} /> : null}
      <h2
        id={headingId}
        className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight"
      >
        {heading}
      </h2>
      {/* `components/patterns/page-hero.tsx`'s lede treatment, character for character, plus the
          `max-w-3xl` that component gets from its own wrapper and this one has none of — so the
          two render the same measure rather than merely carrying the same class list. Undefined
          renders nothing at all: no empty `<p>`, no stray margin in the `space-y-6` rhythm. */}
      {lede !== undefined ? (
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-3xl">
          {lede}
        </p>
      ) : null}
      {mechanism === "accordion" ? (
        <Accordion>{entries}</Accordion>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{entries}</div>
      )}
    </section>
  );
}
