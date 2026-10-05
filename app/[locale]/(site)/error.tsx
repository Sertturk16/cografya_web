"use client";

import { V2RouteError } from "@/components/v2/v2-route-error";

/**
 * The `(site)` group's error boundary. It renders inside the group's layout, so the header,
 * footer and `<main>` stay; `V2RouteError` holds the heading, copy and button, the focus move and the reason the
 * `error` argument is neither logged nor rendered.
 */
export default function V2Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5">
      <V2RouteError reset={reset} />
    </div>
  );
}
