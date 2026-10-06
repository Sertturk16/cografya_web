/**
 * The 404 for a URL that matches no route at all (`experimental.globalNotFound` in
 * `next.config.ts`). Next renders it as the whole document, with no layout around it.
 *
 * It is the same page as `app/not-found.tsx`, which stays the boundary for a `notFound()` thrown
 * from a segment with no nearer `not-found.tsx`; that file already renders its own
 * `<html>`/`<body>`, imports the stylesheet and inlines the theme script, so both cases share it.
 */
export { default } from "./not-found";
