import * as React from "react";
import { cn } from "@/lib/utils";

interface ThemePairProps {
  readonly children: React.ReactNode;
  /**
   * Set for a specimen whose content renders through a portal — Dialog, Sheet, Popover,
   * Tooltip, DropdownMenu, toasts. Their markup lands on `document.body`, outside this
   * wrapper, so it picks up the GLOBAL theme and the two panels show the same thing.
   * Marking it says so on the page instead of letting the reader draw a false conclusion.
   */
  readonly portals?: boolean;
  readonly className?: string;
}

/**
 * Renders one specimen twice: ambient theme on the left, forced dark on the right.
 *
 * BOTH panels force their theme, and both halves are load-bearing. `.dark` alone was not
 * enough: it only ever moves a subtree darker, so with `<html class="dark">` — which is what
 * a visitor whose OS prefers dark gets — the "light" panel inherited dark tokens and the two
 * sides rendered identically. `app/globals.css` therefore declares its light token block as
 * `:root, .light`, so `.light` here re-declares the same values on this subtree.
 *
 * The mechanism is ordinary CSS custom-property cascade, plus Tailwind's
 * `@custom-variant dark (&:is(.dark *))` for the dark half. No second page, no iframe.
 *
 * Each panel paints its own surface and `text-foreground`: those normally come from `body`,
 * which this wrapper is not.
 *
 * ## Why the panels are `bg-card` and not `bg-background`
 *
 * They used to paint `bg-background` — the literal page colour — which meant that whichever
 * panel matched the current theme had no visible boundary at all: its fill equalled the page
 * behind it, and the frame was `--border` at 1.37:1. On a light page the "Aydinlik" panel
 * dissolved; on a dark page the "Karanlik" one did. A comparison instrument whose frames are
 * invisible is showing the reader one specimen, not two.
 *
 * `bg-card` is the more honest backdrop — most V2 surfaces sit on a card rather than directly
 * on the page — but measurement says it is not the fix on its own: light mode's `--card` is
 * #ffffff against a #fbf8f3 page, which is 1.06:1. The fill cannot carry the boundary, so the
 * FRAME does. `--muted-foreground` is solid rather than an alpha, for the reason the `.dark`
 * block records about `--border`: a translucent line picks up whatever sits behind it and so
 * draws differently on the two panels, which is the one thing a comparison instrument must
 * not do. It is the same token, chosen for the same "make this shape visible" reason, as the
 * legend swatch outline.
 *
 * ## Why it lives here and not in `components/patterns`
 *
 * T-042 moved it. `components/showcase/specimen.tsx` wraps EVERY specimen in this component, so
 * it is the machinery the `/design-system` route is built out of — not a pattern waiting for a
 * product call site. In `components/patterns` it read as the second thing to a reachability
 * audit: a pattern nothing outside the showcase imports, which is the shape that gets deleted.
 * `components/ui/orphan.test.ts` now classifies a file under `components/showcase/` that the
 * design-system route reaches as live BY that route, which is the true statement about this one.
 */
export function ThemePair({ children, portals = false, className }: ThemePairProps) {
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
        <figure className="min-w-0 space-y-2">
          <figcaption className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Aydınlık
          </figcaption>
          <div className="light rounded-xl border border-muted-foreground bg-card p-5 text-foreground">
            {children}
          </div>
        </figure>

        <figure className="min-w-0 space-y-2">
          <figcaption className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Karanlık
          </figcaption>
          <div className="dark rounded-xl border border-muted-foreground bg-card p-5 text-foreground">
            {children}
          </div>
        </figure>
      </div>

      {portals ? (
        <p className="text-xs text-muted-foreground">
          Bu bileşen içeriğini <code>document.body</code>&apos;ye taşıyor, yani açıldığında
          sarmalayıcının dışında render oluyor ve sayfanın genel temasını alıyor. İki temayı
          karşılaştırmak için üstteki tema düğmesini kullanın.
        </p>
      ) : null}
    </div>
  );
}
