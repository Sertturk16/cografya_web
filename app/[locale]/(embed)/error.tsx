"use client";

import { V2RouteError } from "@/components/v2/v2-route-error";

/**
 * The `(embed)` group's error boundary, sibling of `(site)/error.tsx` and `(play)/error.tsx`.
 *
 * A group without one falls through to `app/global-error.tsx`, the unstyled shell that replaces
 * the whole document, header included. This renders inside the group's layout, so the header
 * and `<main>` stay; the box is a scrolling one because `<main>` is exactly one viewport
 * minus the header tall.
 */
export default function V2EmbedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5">
        <V2RouteError reset={reset} />
      </div>
    </div>
  );
}
