import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The body of a reading page: width, horizontal padding, and vertical rhythm.
 *
 * It owns NONE of the page skeleton. `app/[locale]/(site)/layout.tsx` already renders
 * `min-h-screen flex flex-col justify-between bg-background text-foreground`, and five pages
 * carried a redundant copy of it — removing those is part of adopting this.
 *
 * `space` is a closed union rather than a `className` passthrough on purpose. The six tails
 * this replaces (`space-y-8` through `space-y-16`, with and without `pb-20`) grew because
 * each page could write its own; a passthrough would reproduce them through the prop and the
 * counter in `components/v2/page-composition.test.ts` would stop meaning anything.
 *
 * Page-level vertical padding (`pt-6 pb-20 sm:pt-10`) lives in the rhythm map, not the base
 * className, because `band` is for callers whose body sits inside a full-bleed
 * `<header className="… py-10 sm:py-14">` band that already owns its own vertical spacing —
 * five of the wrappers this component replaces do exactly that. Putting the padding in the
 * base would double it inside every one of those heroes.
 */
const RHYTHM = {
  /** Inside a full-bleed band that owns its own vertical padding. */
  band: "space-y-6",
  tight: "pt-6 pb-20 sm:pt-10 space-y-8",
  default: "pt-6 pb-20 sm:pt-10 space-y-14",
  loose: "pt-6 pb-20 sm:pt-10 space-y-16",
} as const;

interface PageContainerProps {
  children: ReactNode;
  space?: keyof typeof RHYTHM;
  /** No escape hatch. See the note above. */
  className?: never;
}

export function PageContainer({ children, space = "default" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", RHYTHM[space])}>
      {children}
    </div>
  );
}
