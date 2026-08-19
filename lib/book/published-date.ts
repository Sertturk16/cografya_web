/**
 * How this surface prints a video's publication date — ONE style, one place.
 *
 * The date is printed twice on the book page: on every index row (`deneme-meta.tsx`) and on the
 * stage caption, which takes the string pre-formatted from `page.tsx` because `i18n/request.ts`
 * pins `timeZone: "UTC"` for the whole project and a browser-side format would make that
 * guarantee depend on the provider inheriting the request config into the client.
 *
 * Two `format.dateTime` calls with the options written out at each site agreed only by
 * convention: change `dateStyle` on one and the same video's row and stage print different
 * dates, which is `SEO-POLICY.md` §B5 5.7's neighbourhood — the page showing two answers to one
 * question — with typecheck, lint and every rendered frame clean (→ PR #70 review `TA70-M7`).
 * A shared constant is what makes the agreement structural instead.
 *
 * It is a constant rather than a wrapper function on purpose: the two call sites hold DIFFERENT
 * formatters (`getFormatter()` on the server, and nothing at all on the client), so what they can
 * share is the options object, not the call.
 */
export const PUBLISHED_DATE_FORMAT = { dateStyle: "long" } as const;
