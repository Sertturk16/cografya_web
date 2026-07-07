import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the `middleware` file convention to `proxy` (createMiddleware
// itself is unchanged). This wires next-intl locale routing + localized `pathnames`.
export default createMiddleware(routing);

export const config = {
  // Run on everything EXCEPT: Next internals (`_next`), Vercel internals
  // (`_vercel`), the `/api` prefix, and any path containing a dot (files like
  // `/sitemap.xml`, `/robots.txt`, `/favicon.ico`) — those must bypass locale
  // rewriting and be served as-is.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
