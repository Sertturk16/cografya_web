/**
 * Structural probe: which condition governs a JSX render site.
 *
 * ## Why this exists
 *
 * This repo's vitest environment is `node` with no jsdom, and every page under `app/` is an
 * async server component vitest does not collect. The established guard at that level is to read
 * the source text — which works, but tempts a test into pinning a SPELLING when what it means to
 * protect is a PROPERTY.
 *
 * T-032 PR3 made the cost concrete. A dozen guards pinned the V1 shape
 * `{signal && (<Component`, and the V2 pages express the same gates as ternaries with several
 * branches (`{a && b ? (…) : a ? (…) : b ? (…) : null}`). Every one of those guards failed on a
 * page that honours its invariant perfectly. The two easy repairs are both wrong: re-pinning the
 * new spelling breaks again at the next refactor, and loosening to `toContain("signal")` passes a
 * page that has stopped honouring the invariant altogether.
 *
 * So the probe answers the question the guards were always really asking: for each place this
 * component is rendered, what is the condition immediately above it?
 *
 * ## What it is not
 *
 * Not a parser. It reads a window of text backwards from the render site to the nearest opening
 * of a JSX conditional branch, which is sound for the shapes this codebase writes and would not
 * survive a condition spanning more than `WINDOW` characters or a branch opened some other way.
 * `gatesGoverning` therefore THROWS when a render site sits inside no conditional at all, rather
 * than returning an empty list a caller could read as "nothing to check" — a silent pass is the
 * one outcome a guard like this must never produce.
 */

/**
 * Hard cap on how far back from the branch opener to read, for the case where no boundary is
 * found at all. Comfortably longer than the longest condition in this codebase
 * (`{pm25Annual && showMarine `).
 *
 * The cap ALONE is not enough, and the helper's own test proves it: in a chained ternary a
 * fixed-size window reaches back past `) :` into the previous arm, picks up that arm's signal,
 * and then every "is this site gated on X?" check passes for free. So the window is trimmed at
 * the nearest branch boundary below, and the cap is only the fallback.
 */
const WINDOW = 80;

/** Where a condition starts: the `{` opening a JSX expression, or the `) :` closing the arm before. */
const trimToBranch = (window: string): string => {
  const brace = window.lastIndexOf("{");
  const arm = window.lastIndexOf(") :");
  if (arm > brace) return window.slice(arm + ") :".length);
  if (brace !== -1) return window.slice(brace + 1);
  return window;
};

/**
 * Every condition governing a render of `tag` in `source`, one entry per render site.
 *
 * @param source JSX/TSX source text.
 * @param tag The opening of the element, e.g. `"<MarineAttribution"`.
 * @throws If a render site is not inside a conditional branch — see the module docblock.
 */
export function gatesGoverning(source: string, tag: string): string[] {
  const gates: string[] = [];
  for (let idx = source.indexOf(tag); idx !== -1; idx = source.indexOf(tag, idx + 1)) {
    const prefix = source.slice(0, idx);
    // The nearest opening of a JSX conditional branch: `cond ? (` or `cond && (`.
    const opener = Math.max(prefix.lastIndexOf("? ("), prefix.lastIndexOf("&& ("));
    if (opener === -1) {
      throw new Error(`${tag} at offset ${idx} is not inside a conditional branch`);
    }
    gates.push(trimToBranch(prefix.slice(Math.max(0, opener - WINDOW), opener)));
  }
  return gates;
}

/**
 * Convenience over `gatesGoverning`: is every render of `tag` governed by a condition that reads
 * `signal`?
 *
 * Returns the offending gate rather than a boolean, so a failing assertion can print WHICH render
 * site drifted instead of only that one did.
 */
export function ungatedRenderSite(source: string, tag: string, signal: string): string | null {
  return gatesGoverning(source, tag).find((gate) => !gate.includes(signal)) ?? null;
}
