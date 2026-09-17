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
 * The forced panel works because `app/globals.css` declares
 * `@custom-variant dark (&:is(.dark *))` — Tailwind's `dark:` variant matches any
 * descendant of a `.dark` element — and because the custom properties in the `.dark` block
 * cascade to descendants like any other CSS variable. No second page, no iframe.
 *
 * The panel paints `bg-background`/`text-foreground` itself: those normally come from
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
          <div className="rounded-xl border border-border bg-background p-5 text-foreground">
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
