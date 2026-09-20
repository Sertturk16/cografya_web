import { env } from "@/lib/env";

/**
 * Central site identity.
 *
 * `name` is a PROVISIONAL placeholder brand — the final brand/domain is not
 * decided yet (CONVENTIONS §3; DEC 2026-07-07 K7, working title "Terraloji").
 * It is single-sourced here for all UI chrome (header, footer copyright, og:site_name,
 * the `%s · brand` title template): those update from this one constant. The brand
 * also appears woven into localized PROSE (meta titles/descriptions, About body) in
 * `messages/*.json` — that is crafted per-locale copy, not chrome, and a rebrand must
 * revisit it by hand rather than by token interpolation.
 */
export const siteConfig = {
  name: "Coğrafya Gurmesi",
} as const;

/** Absolute site origin, no trailing slash (for metadataBase + sitemap URLs). */
export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Turns a root-relative path ("/turkiye/istanbul") into an absolute URL. */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path === "/" ? "/" : path}`;
}

/**
 * The inverse of {@link absoluteUrl} for one narrow job: an address the BROWSER will request,
 * collapsed to a path when it points at our own origin (T-069).
 *
 * WHY THIS EXISTS. `NEXT_PUBLIC_*` values are inlined at build time, and the production image
 * was built without one — `docker-compose.prod.yml` passed `NEXT_PUBLIC_SITE_URL` as a RUNTIME
 * environment variable, which no client bundle ever reads. `lib/env.ts`'s
 * `http://localhost:3000` default was therefore baked into the shipped JavaScript, and every
 * book cover on the live site was an `<img src="http://localhost:3000/api/video-cover/…">`. A
 * public HTTPS page reaching into the visitor's own machine is exactly what Chromium's Private
 * Network Access gate is for, so readers were asked to let the site "access other apps and
 * services on this device" — a prompt the site has no legitimate need for.
 *
 * The Dockerfile takes the value as a build ARG now and refuses to build without one. This
 * function is the second layer and it holds even when the first is misconfigured: the address
 * and this comparison come from the SAME constant, so a wrong constant still matches itself,
 * the address still collapses to a path, and the browser resolves a path against the origin it
 * actually loaded the page from. No value of `NEXT_PUBLIC_SITE_URL` can send a cover request
 * off our own origin.
 *
 * ANYTHING NOT OURS IS RETURNED VERBATIM, including a provider CDN address — YouTube's
 * Developer Policies require the thumbnail to be used exactly as the API returned it — and
 * including a string `new URL()` cannot parse, which this refuses to guess at.
 *
 * It is NOT for JSON-LD or metadata: a structured-data `thumbnailUrl` must be absolute, and
 * those paths keep calling {@link absoluteUrl}.
 */
export function ownOriginPath(url: string): string {
  let parsed;
  try {
    // NO BASE, deliberately. Parsing against `getSiteUrl()` would resolve anything at all —
    // `"not a url"` came back as `"/not%20a%20url"`, an address invented out of a string this
    // function was handed and does not understand. Failing to parse means "not an absolute
    // address", which is the answer for a root-relative path (already origin-relative, so
    // nothing to strip) and for a malformed one (nothing to guess at) alike.
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.origin !== new URL(getSiteUrl()).origin) return url;
  return `${parsed.pathname}${parsed.search}`;
}
