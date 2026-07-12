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
  name: "Coğrafya Platformu",
} as const;

/** Absolute site origin, no trailing slash (for metadataBase + sitemap URLs). */
export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Turns a root-relative path ("/turkiye/istanbul") into an absolute URL. */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path === "/" ? "/" : path}`;
}
