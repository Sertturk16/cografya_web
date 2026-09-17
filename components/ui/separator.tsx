"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@/lib/utils";

interface SeparatorProps extends SeparatorPrimitive.Props {
  /**
   * A purely visual rule that carries no meaning — the shape 24 V2 files were hand-rolling
   * as `border-t border-border`.
   *
   * Base UI's Separator always renders `role="separator"`, and announcing "separator" once
   * per decorative line is noise: a screen-reader user hears the structure of the page
   * interrupted by rules that only exist to break up whitespace. `role="none"` takes it out
   * of the accessibility tree while leaving the line on screen. Radix ships the same prop for
   * the same reason; Base UI does not, so it is added here.
   *
   * Leave it off when the rule genuinely divides two groups the reader needs to tell apart.
   */
  readonly decorative?: boolean;
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = false,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      role={decorative ? "none" : undefined}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
