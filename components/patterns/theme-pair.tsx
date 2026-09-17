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
 * Each panel paints `bg-background`/`text-foreground` itself: those normally come from
 * `body`, which this wrapper is not.
 */
export function ThemePair({ children, portals = false, className }: ThemePairProps) {
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
        <figure className="space-y-2">
          <figcaption className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Aydınlık
          </figcaption>
          <div className="light rounded-xl border border-border bg-background p-5 text-foreground">
            {children}
          </div>
        </figure>

        <figure className="space-y-2">
          <figcaption className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Karanlık
          </figcaption>
          <div className="dark rounded-xl border border-border bg-background p-5 text-foreground">
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
