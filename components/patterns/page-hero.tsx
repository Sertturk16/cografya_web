import type { ReactNode } from "react";
import { H1, H1Display } from "./typography";

/**
 * The top of a reading page: the badges, the one `<h1>`, the locale notice, the lede, and
 * whatever the page hangs below them.
 *
 * ## It is one shape, not seventeen
 *
 * The prop list is a measurement, not a design. Counting the direct children of all 14 hub
 * hero wrappers on the live tree gives exactly five slots, always in this order:
 *
 *   `<div className="flex items-center gap-2">` … badges      14 / 14
 *   `<h1 …>`                                                  14 / 14
 *   `<V2EnWorkInProgressNotice locale={locale} />`             5 / 14
 *   `<p className="text-muted-foreground …">` … lede          14 / 14
 *   `<div className="pt-2">` … cta                             3 / 14
 *
 * The wrapper itself, `relative z-10 max-w-3xl space-y-4`, appears 14 times with no variant at
 * all. The three detail pages differ only in the heading treatment and in writing `max-w-3xl`
 * on their lede by hand, because they have no wrapper supplying it.
 *
 * ## Why `notice` is its own slot and not more `children`
 *
 * One open `children` slot would be shorter and would let the next page put the notice under
 * the lede, or between the badges and the heading, with nothing to notice it. Five pages
 * already agree on notice-then-lede; encoding that order is the whole point of lifting this
 * out of the pages.
 *
 * ## No `className`
 *
 * `className?: never` for the reason `PageContainer` carries the same line: the six container
 * tails PR1 spent a task collapsing grew one page at a time through exactly such a passthrough,
 * and a counter over spellings stops meaning anything the moment callers can add to them.
 * `breadcrumbs` is deliberately NOT a prop either — on all 17 sites `<Breadcrumbs>` renders as
 * a sibling at `PageContainer` level, never inside the hero, so a slot for it would be an
 * unused hole on the day it shipped.
 *
 * Server Component by construction: no state, no effects, no client imports. The 17 heroes it
 * is meant to replace all sit at the top of Server Components that fetch, and a hero that
 * dragged them over the boundary would be adopted by nobody.
 */
export interface PageHeroProps {
  /** `hub` for a section landing page, `detail` for one province, country or sea. */
  readonly tier: "hub" | "detail";
  readonly heading: string;
  /** Rendered inside the measured `flex items-center gap-2` row. */
  readonly badges?: ReactNode;
  /** The locale notice, between the heading and the lede — where five pages put it. */
  readonly notice?: ReactNode;
  readonly lede?: ReactNode;
  /** The tail: a CTA row, in the measured `pt-2` wrapper. */
  readonly children?: ReactNode;
  /** No escape hatch. See the note above. */
  readonly className?: never;
}

export function PageHero({ tier, heading, badges, notice, lede, children }: PageHeroProps) {
  const Heading = tier === "hub" ? H1 : H1Display;

  return (
    <div className="relative z-10 max-w-3xl space-y-4">
      {badges !== undefined ? <div className="flex items-center gap-2">{badges}</div> : null}

      <Heading>{heading}</Heading>

      {notice}

      {/* One lede spelling for both tiers. The detail pages write these same tokens plus
          `max-w-3xl`, which the wrapper above already supplies — the difference was never a
          decision, just the absence of a wrapper. */}
      {lede !== undefined ? (
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{lede}</p>
      ) : null}

      {children !== undefined ? <div className="pt-2">{children}</div> : null}
    </div>
  );
}
