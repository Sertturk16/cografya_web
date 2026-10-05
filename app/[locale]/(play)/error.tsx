"use client";

import { V2Header } from "@/components/v2/v2-header";
import { V2RouteError } from "@/components/v2/v2-route-error";

/**
 * The play group's error boundary, sibling of `app/[locale]/(site)/error.tsx`.
 *
 * Without it a throw on a game screen (e.g. `getMapSummaryResilient()` failing with no cached
 * copy of the page) fell through to `app/global-error.tsx`: an unstyled last-resort shell that
 * replaces the whole document, header included.
 *
 * The `(play)` layout has no chrome, so the page renders `V2Header` itself and this boundary
 * replaces the page. It therefore draws the header and its own `<main>` again, the way
 * `V2GameScreen` does. The ticker is left out: it fetches live feeds on its own, and the likely
 * reason to be here is that the API is down.
 */
export default function V2PlayError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <V2Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5">
        <V2RouteError reset={reset} />
      </main>
    </>
  );
}
