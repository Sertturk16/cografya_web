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
  // `/tr/apple-icon`. The metadata branch is anchored to a full LEAF SEGMENT
  // (`(?:.*/)?` = start-of-path or preceded by a `/`, then the token, then `$`), so
  // only a final path segment that IS the token bypasses — a free-form slug that
  // merely ends in it (e.g. a future blog post `/blog/designing-an-apple-icon`) is
  // NOT excluded and still gets normal i18n routing. Examples that BYPASS:
  // `/tr/opengraph-image`, `/en/opengraph-image`, `/apple-icon`. Examples that RUN
  // middleware: `/`, `/iller`, `/il/istanbul`, `/blog/my-apple-icon`.
  matcher:
    "/((?!api|_next|_vercel|.*\\..*|(?:.*/)?(?:opengraph-image|twitter-image|apple-icon)$).*)",
};
