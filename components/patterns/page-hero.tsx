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
 *   `<div className="flex items-center gap-2">` … badges      14 / 14  (+ `flex-wrap`, 3 / 3
 *                                                                      on the detail heroes)
 *   `<h1 …>`                                                  14 / 14
 *   `<V2EnWorkInProgressNotice locale={locale} />`             5 / 14
 *   `<p className="text-muted-foreground …">` … lede          14 / 14
 *   `<div className="pt-2">` … cta                             3 / 14
 *
 * The wrapper itself, `relative z-10 max-w-3xl space-y-4`, appears 14 times with no variant at
 * all.
 *
 * ## What adopting the wrapper CHANGES on the three detail pages
 *
 * Their old wrapper was `<div className="space-y-3">` inside a `flex flex-col lg:flex-row` row,
 * with NO width cap; only the `<p>` lede carried `max-w-3xl`, written by hand. An earlier wording
 * here said they "differ only in the heading treatment and in writing `max-w-3xl` on their lede by
 * hand", which reads as though adopting the wrapper changes nothing for them. It changes three
 * things, and two are visible:
 *
 *   - the `sm:text-6xl` heading and the 4-to-6-badge row are now capped at 768px on desktop, where
 *     both previously ran the full flex width. A long name — "Doğu Anadolu Bölgesi", "Birleşik
 *     Arap Emirlikleri" — wraps a line earlier than it did;
 *   - the rhythm moves `space-y-3` → `space-y-4`, 4px;
 *   - the lede renders identically, because the wrapper supplies the cap the lede wrote itself.
 *
 * Deliberate rather than incidental: the cap is what keeps the measure readable on a 1440px screen
 * and it is the same cap all 14 hub heroes have always had. Recorded because it is a visible change
 * to three live pages that the five-slot measurement above does not otherwise account for.
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
  return (
    <div className="relative z-10 max-w-3xl space-y-4">
      {/* `flex-wrap` is the one token the hub measurement did not see: it was taken over the 14
          hub heroes, and all three DETAIL heroes write `flex items-center gap-2 flex-wrap`
          (`turkiye/[slug]:379`, `turkiye/bolge/[slug]:453`, `dunya/[slug]:326`), carrying 4 to 6
          badges. MEASURED at 320px with the token removed, rather than predicted: the detail rows
          CLIP against the hero section's `overflow-hidden` — `turkiye/bolge/marmara` loses 125px,
          its fifth badge entirely and its fourth mid-word; `dunya/almanya` loses 113px. That is a
          regression the `className` escape hatch this component refuses would have been the only
          other way to avoid.

          On the 14 hub rows the effect is different and smaller, and worth stating accurately: a
          two-badge row does not clip without this token, it COMPRESSES — flex items shrink, so
          each badge's own text wraps to two lines inside a squeezed pill. With `flex-wrap` the two
          badges take a line each at their natural width. A row whose badges already fit on one
          line is untouched at every width (`/turkiye` is the live case: one line at 320 and at
          1440, with and without). */}
      {badges !== undefined ? (
        <div className="flex items-center gap-2 flex-wrap">{badges}</div>
      ) : null}

      {/* WRITTEN AS TWO JSX ELEMENTS, NOT `const Heading = tier === "hub" ? H1 : H1Display`.
          That indirection reads identically to React and is INVISIBLE to the render walk in
          `components/v2/page-composition-headings.test.ts`: `Heading` is neither an import binding nor
          a
          top-level declaration, so the walk resolved it to nothing and every page adopting this
          component reported NO `<h1>` at all (measured — `PAGES_WITHOUT_H1` went 5 → 6 on the
          first page converted). That is SCOPE note 1 of that file arriving on the very component
          this PR shipped to close the counter. Naming both components in JSX is what makes the
          heading countable where it renders; the walk then reaches BOTH tiers and cannot evaluate
          `tier`, which is recorded once as `TIER_SWITCH` there rather than per page. */}
      {tier === "hub" ? <H1>{heading}</H1> : <H1Display>{heading}</H1Display>}

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
