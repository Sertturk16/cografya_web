/**
 * THE FOOTNOTE SCALE every source and licence line on the site is set in.
 *
 * A mandated notice has to be VISIBLE WITHOUT A CLICK (`components/attribution-not-optional.test.ts`
 * enforces the no-off-switch half of that), but it does not have to be loud. So the notices that
 * travel with a value — the map credit, the climate and PM2.5 source lines, the AFAD notice, the
 * marine safety sentence's link — share one quiet footnote style instead of each drawing its own
 * card, panel or indented rule: 11px, snug leading, muted colour, at the end of the section.
 *
 * Links are underlined because the muted text around them sits at ~1.05:1 against the link colour,
 * so the underline is the non-colour cue that makes them links (WCAG 1.4.1); it lifts on hover,
 * this repo's usual direction. `m-0` resets the global `<p>` prose margin; spacing between notes
 * belongs to the wrapper that stacks them.
 *
 * A class constant rather than a component: the consumers are server and client components with
 * different wrappers (`<p>`, `<aside>`, a flex row in `MapAttribution`), and one string composes
 * into all of them through `cn()` without a prop surface to keep in step.
 */
export const SOURCE_NOTE =
  "m-0 text-[11px] leading-snug text-muted-foreground [&_a]:underline [&_a:hover]:no-underline";
