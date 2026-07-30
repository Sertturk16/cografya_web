/**
 * The end-of-round "provinces you missed" links (SPEC §5.4).
 *
 * Those links are built on the CLIENT, from ids the player happened to miss, so the
 * island cannot call `getPathname` for each one without pulling routing config into the
 * bundle — and hand-assembling `/turkiye/{slug}` or `/en/turkiye/{slug}` would duplicate
 * localized-URL logic, which `SEO-POLICY.md` §B7 7.4 bars outright.
 *
 * So the SERVER resolves the route ONCE, with the placeholder below standing in for the
 * slug, and the island only substitutes. One `getPathname` call, one source of truth for
 * the localized path, zero routing code on the client.
 *
 * The placeholder is deliberately slug-shaped (lowercase ASCII, no reserved characters):
 * it survives `getPathname` untouched and cannot collide with a real slug, because a real
 * province slug never contains an underscore (`SEO-POLICY.md` §B4 4.3).
 */
export const SLUG_PLACEHOLDER = "__slug__";

/** Substitute a province slug into a server-resolved localized path template. */
export function provinceUrl(template: string, slug: string): string {
  return template.replace(SLUG_PLACEHOLDER, encodeURIComponent(slug));
}
