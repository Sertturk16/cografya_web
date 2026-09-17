import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, Lightbulb, TriangleAlert, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * NO BOX, NO FILL. A rule above the note, and colour only in the icon.
 *
 * ## Why this is less decoration than before, not more
 *
 * Two earlier versions both tried to distinguish Callout from Alert by adding something. The
 * first used `border-l-4`, a side-tab — rejected as the most template-looking version of this
 * component, and inconsistent with `alert.tsx`, which already used an even border. The second
 * replaced it with a full hairline and a tint, which landed the two components 2px of radius
 * and 2 percentage points of tint apart. Measured side by side they read as the same
 * component twice, and the only signal actually doing any work was the body-text colour.
 *
 * So the rule is inverted, and made structural instead of cosmetic:
 *
 *   - **Alert** tints the whole box, body text included (`text-*-strong`). It is a STATE
 *     OBJECT: something in the system is true right now, and the box is the thing.
 *   - **Callout** has no box at all. It is TYPESET PROSE — the author's aside, part of the
 *     text it sits in — so it takes the text's own colour and is separated by a rule, the way
 *     a printed sidebar note is.
 *
 * The evidence was already in the old component: its `source` variant was the only one that
 * read instantly as not-an-Alert, and the reason was that its fill was neutral. Removing the
 * fill everywhere generalises the one thing that was working.
 *
 * NOT a thin left rule. That is the side-tab's neighbour and reopens the argument that was
 * already settled once; a rule ABOVE the note is the editorial move, not the dashboard one.
 *
 * The variant is still carried two ways — the icon's glyph and its hue — which is what a
 * quiet aside has earned. It is deliberately not carried by a slab of colour.
 */
const calloutVariants = cva("border-t border-border pt-3.5", {
  variants: {
    variant: {
      note: "",
      tip: "",
      caution: "",
      source: "",
    },
  },
  defaultVariants: { variant: "note" },
});

/**
 * Applied to the icon directly rather than through a `[&>svg]` descendant selector.
 *
 * The previous version wrote `[&>svg]:text-info-strong` on the root while the icon sat three
 * elements deep inside a `<span>`, so the child combinator matched nothing and the colour was
 * never applied at all. A variant carried by a selector that does not match is a variant that
 * does not exist.
 */
const ICON_TONE = {
  note: "text-info-strong",
  tip: "text-success-strong",
  caution: "text-warning-strong",
  source: "text-muted-foreground",
} as const;

const DEFAULT_ICONS = {
  note: <Info className="size-4" />,
  tip: <Lightbulb className="size-4" />,
  caution: <TriangleAlert className="size-4" />,
  source: <BookOpen className="size-4" />,
} as const;

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof calloutVariants> {
  readonly title?: string;
  readonly icon?: React.ReactNode;
}

/**
 * An EDITORIAL ASIDE inside teaching copy: a definition, a caution about a common
 * misconception, a note on where a figure came from.
 *
 * ## Callout is not Alert, and the difference is load-bearing
 *
 * `Alert` reports SYSTEM STATE — a request failed, an email is unverified, a feature flag is
 * off. It resolves a `role` for exactly that reason: `alert` for destructive, `status`
 * otherwise.
 *
 * `Callout` has NO role, deliberately. Typesetting a pedagogical note as an `Alert` gives it
 * `role="alert"` or `role="status"` semantics, so assistive technology interrupts the reader
 * for something that is not an event and nothing has gone wrong — and the visual language of
 * "something broke" gets attached to ordinary teaching material. The failure is silent and
 * one-directional: it looks fine on screen and misbehaves only for the readers who cannot
 * see it.
 *
 * `components/en-work-in-progress-notice.tsx` already reasons its way to the same conclusion
 * for its own note.
 *
 * The heading is a `<p>`, not an `<h*>`: a callout sits inside a section that already has a
 * heading, and injecting a real heading here would put a rung in the document outline that
 * the page structure does not have. `components/ui/alert.tsx` now agrees, having been an
 * `<h5>` until the outline it produced was measured.
 */
export function Callout({
  className,
  variant = "note",
  title,
  icon,
  children,
  ...props
}: CalloutProps) {
  const resolved = variant ?? "note";
  const resolvedIcon = icon !== undefined ? icon : DEFAULT_ICONS[resolved];

  return (
    <div className={cn(calloutVariants({ variant, className }))} {...props}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={cn("mt-0.5 shrink-0", ICON_TONE[resolved])}>
          {resolvedIcon}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {title !== undefined ? (
            <p className="text-sm font-bold text-foreground">{title}</p>
          ) : null}
          {/* The body takes the TEXT's colour, not a tinted one. This is prose that happens to
              be set aside, not a status message, and it is the single signal that was already
              doing the work of telling the two components apart. */}
          <div className="text-sm leading-relaxed text-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

export { calloutVariants };
