"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Base UI accordion, wrapped in the Terra look.
 *
 * ## Why this is not the hand-rolled one any more
 *
 * The previous implementation was a bespoke `"use client"` accordion with its own React context,
 * and it had two defects that only matter once a FAQ is rendered through it:
 *
 *   - `AccordionContent` returned `null` while closed. A closed answer was therefore **not in the
 *     server-rendered HTML at all** — invisible to a crawler, to reader mode, and to the browser's
 *     own find-in-page. `components/patterns/faq-section.tsx` emits `FAQPage` JSON-LD from the same
 *     array it renders, and Google's FAQPage rule is that the answer must be ON the page; an
 *     accordion that drops it is structured data with nothing behind it. `Accordion.Panel` under
 *     `hiddenUntilFound` keeps the panel mounted with `hidden="until-found"` instead, so the text
 *     ships in the document and the browser can expand it to reveal a search hit.
 *   - the trigger was a bare `<button>`, so a screen-reader outline of a page whose FAQ used this
 *     component listed no questions. `Accordion.Header` renders an `<h3>` around the trigger —
 *     verified against the installed 1.7 typings (`accordion/header/AccordionHeader.d.ts`:
 *     "Renders an `<h3>` element"), not assumed.
 *
 * ## API changes, deliberately
 *
 * The old `type="single" collapsible` props were an invented API that mimicked Radix; this repo
 * has no Radix (`CLAUDE.md`). Base UI's real control is the `multiple` boolean — single is the
 * default and a single open item is always collapsible, so both old props simply disappear.
 * `defaultValue` is an ARRAY here (`Value[]`), never a bare string.
 *
 * Open/closed styling is driven by Base UI's own `data-open` / `data-closed` attributes rather
 * than by a JS `isOpen` read out of context, which is what lets the styling survive a state the
 * component never rendered itself (find-in-page expansion, for one).
 */
function Accordion({
  className,
  hiddenUntilFound = true,
  ...props
}: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      // Overrides `keepMounted` by design (Root's own typings say so): the panel stays in the DOM
      // under `hidden="until-found"`, which is the ONE property this rebuild exists to buy.
      hiddenUntilFound={hiddenUntilFound}
      className={cn("space-y-3", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      // `group` so the chevron inside the trigger can read this element's `data-open`. The
      // TRIGGER carries `data-panel-open` rather than `data-open` (see
      // `accordion/trigger/AccordionTriggerDataAttributes.d.ts`), and the item is the nearest
      // ancestor of both halves, so one group here serves the whole item.
      className={cn(
        "group rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200",
        "hover:border-border/80 data-open:border-primary/40 data-open:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

/**
 * `m-0` on the Header is load-bearing, not tidiness. `Accordion.Header` renders an `<h3>`, and
 * `app/globals.css`'s base layer gives every `h1`–`h4` `margin: 0 0 0.5em` — so the moment this
 * component started supplying the heading the document outline needs, every accordion item also
 * gained ~8px of dead space between its trigger and its panel. The hand-rolled trigger this
 * replaced was a bare `<button>` and never met that rule, which is why the margin arrived with
 * the rebuild rather than having always been there.
 */
function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="m-0 font-heading">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "w-full flex items-center justify-between p-4 sm:p-5 text-left font-heading font-bold text-foreground text-sm sm:text-base hover:text-primary transition-colors cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
          className,
        )}
        {...props}
      >
        <span className="pr-4">{children}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-open:rotate-180 group-data-open:text-primary"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

/**
 * THE PADDING IS ON AN INNER `<div>`, NOT ON THE PANEL, and that is a layout fix rather than a
 * stylistic preference.
 *
 * `Accordion.Panel` is the element Base UI hides, and it is hidden two different ways over the
 * life of one page. The server ships `hidden=""` — the boolean, whose UA rule is
 * `display: none`, so the element has no box and its padding costs nothing. A layout effect then
 * upgrades it to `hidden="until-found"`, whose UA rule is `content-visibility: hidden`: that
 * skips the element's CONTENTS but keeps its own box, so padding written on the panel becomes a
 * strip of blank space on every closed item the moment the page hydrates — and a layout shift as
 * it appears. Eight closed items on `/deniz` is eight of them.
 *
 * So the panel carries only what must be on the hidden element (the animated height and its
 * `overflow-hidden`), and everything with a size — padding, type, colour — sits on a wrapper
 * inside it. That is also the shape Base UI's own accordion example uses, and the reason it does.
 *
 * A caller's `className` lands on the INNER element for the same reason: it is the visible box.
 *
 * The transition is Base UI's documented one: `h-[var(--accordion-panel-height)]` with
 * `data-starting-style:h-0` / `data-ending-style:h-0`, which animates between 0 and the measured
 * height without either end being hard-coded. `prefers-reduced-motion: reduce` disables it with
 * every other transition, globally, in `app/globals.css` (`docs/design.md`).
 */
function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      <div
        data-slot="accordion-content-inner"
        className={cn(
          "px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
