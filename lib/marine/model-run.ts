/**
 * Rendering the marine model künye's timestamps HONESTLY on an ISR page.
 *
 * Two rules, both load-bearing (plan §3):
 *
 * 1. **Absolute, never relative.** "2 hours ago" is computed once at render and then
 *    cached: as the ISR window ages the sentence becomes actively WRONG. An absolute
 *    instant only becomes older, never false.
 * 2. **Always UTC, and labelled as such.** The api publishes these instants in UTC and the
 *    hosting region is still undecided, so a locale-default zone would make the same build
 *    print a different hour on a different machine. `MODEL_INSTANT_FORMAT` pins the zone at
 *    the ONE place the page formats them; the visible "UTC" suffix is what stops a reader
 *    from silently assuming local time. (`i18n/request.ts` now also sets a project-wide
 *    `timeZone`, but this explicit option is the guarantee — it does not depend on it.)
 */

/**
 * Formatting options for a model-künye instant. `timeZone: "UTC"` is the invariant
 * (`model-run.test.ts` pins it): the rendered string must not depend on where the renderer
 * happens to run.
 */
export const MODEL_INSTANT_FORMAT = {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
} as const;

/**
 * Parses an ISO-8601 künye instant into a `Date`, or `null` when there is nothing honest to
 * show — the field is absent (`null`), empty, or unparseable.
 *
 * `null` in, `null` out is the whole contract: the caller renders the layer's "next phase"
 * wording, never a fabricated or epoch-fallback date. An unparseable string is treated the
 * same way as an absent one on purpose — `new Date("nonsense")` yields an Invalid Date that
 * `Intl` throws on, which would take the whole page down over one bad field.
 */
export function parseModelInstant(iso: string | null): Date | null {
  if (iso === null || iso === "") return null;

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
