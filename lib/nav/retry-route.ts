import { startTransition } from "react";

/**
 * What "Tekrar dene" does in a route group's error boundary.
 *
 * `reset()` alone only re-renders the boundary's children on the client. When the error came
 * from a Server Component (the API was down, a fetch threw), the client still holds the same
 * failed RSC payload, so the page throws again and the reader stays on the error screen.
 * `router.refresh()` asks the server for a fresh payload; `reset()` then clears the boundary
 * so the children render from it. Inside one transition the error screen stays up until the new
 * payload arrives instead of flashing the broken page.
 *
 * This is what Next 16.2 passes to `error.tsx` as `unstable_retry` (renamed `retry` on canary).
 * Written out here with stable APIs so a Next upgrade does not rename it under us.
 */
export function retryRoute(router: { refresh: () => void }, reset: () => void): void {
  startTransition(() => {
    router.refresh();
    reset();
  });
}
