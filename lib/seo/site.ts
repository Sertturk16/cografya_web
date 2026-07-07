import { env } from "@/lib/env";

/**
 * Central site identity.
 *
 * `name` is a PROVISIONAL placeholder brand — the final brand/domain is not
 * decided yet (CONVENTIONS §3; DEC 2026-07-07 K7, working title "Terraloji").
 * It is single-sourced here so the eventual rename is a one-line change.
 */
export const siteConfig = {
  name: "Coğrafya Platformu",
} as const;

/** Absolute site origin, no trailing slash (for metadataBase + sitemap URLs). */
export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Turns a root-relative path ("/il/istanbul") into an absolute URL. */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path === "/" ? "/" : path}`;
}
