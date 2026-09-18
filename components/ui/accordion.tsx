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

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="font-heading">
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

function AccordionContent({ className, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        "px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
