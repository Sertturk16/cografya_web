import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the `middleware` file convention to `proxy` (createMiddleware
// itself is unchanged). This wires next-intl locale routing + localized `pathnames`.
export default createMiddleware(routing);

export const config = {
  // Run on everything EXCEPT: Next internals (`_next`), Vercel internals
  // (`_vercel`), the `/api` prefix, any path containing a dot (files like
  // `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/icon.svg`), and the
  // EXTENSIONLESS metadata routes (`opengraph-image`, `twitter-image`,
  // `apple-icon`). Those metadata routes MUST bypass locale rewriting: otherwise
  // the default-locale redirect turns `/tr/opengraph-image` into a 307→404 (killing
  // the TR og:image) and `/apple-icon` is rewritten to a non-existent
  // `/tr/apple-icon`. The alternation is end-anchored (`...$`) so only the metadata
  // leaf segments are excluded, never a content slug that merely contains the word.
  matcher: "/((?!api|_next|_vercel|.*\\..*|.*(?:opengraph-image|twitter-image|apple-icon)$).*)",
};
