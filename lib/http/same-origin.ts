import "server-only";

/**
 * Same-origin check for a state-changing web route handler (roadmap §5's standing security
 * boundary — "State-changing web route handler'larında Origin doğrulaması yapılır").
 *
 * Extracted from `lib/auth/transport.server.ts`'s own private `isValidOrigin`
 * (UYELIK-06 plan §5.7): the new video-progress BFF proxy needs the same four-line check on
 * its own state-changing `PUT`, and a second private copy is exactly the kind of small thing
 * that could silently drift from the first — the same "two copies of the same five lines
 * could answer differently the day one of them learned about a second attribute" reasoning
 * `video-bench.tsx`'s `denemeNoOf` docblock already gives for extracting a duplicate, applied
 * here to a security-relevant check instead of a UI pattern.
 *
 * `Origin` absent is refused too: a same-origin browser `fetch`/form submission on a
 * state-changing request always sends `Origin`, so an absent header means a non-browser
 * caller.
 */
export function isSameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === expectedOrigin;
}
