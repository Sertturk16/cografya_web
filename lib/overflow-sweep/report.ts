/**
 * Formatting for the horizontal-overflow sweep's failures.
 *
 * Separated from the script so it can be unit-tested without a browser, and because the
 * shape of a failure line is the whole point of the check: T-046's `.chartFrame` bug took a
 * human forty minutes to locate from "`/turkiye/istanbul` scrolls sideways at 320". A
 * failure that names only a page sends someone hunting, so every line here has to carry the
 * route, the viewport, the theme, the overflow in pixels AND the offending element.
 */

/**
 * One element whose right edge lies outside the viewport, measured in the page.
 *
 * `hints` carries only the computed properties that were NOT at their initial value — the
 * three recorded defects were a `min-width`, a `flex-shrink: 0` and an unbreakable string,
 * so those are exactly what a reader needs printed next to the selector.
 */
export type OverflowElement = {
  /** `tag.class > tag.class` chain, innermost last. */
  readonly selector: string;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  /** How far past the viewport's right edge this element reaches, in CSS px. */
  readonly overflowPx: number;
  /** True when no other reported element is a descendant of this one — the likely culprit. */
  readonly leaf: boolean;
  readonly hints: Readonly<Record<string, string>>;
  /** First few words of the element's text, when it has any. Names a badge or a notice. */
  readonly text?: string;
};

export type SweepFailure = {
  readonly shapeId: string;
  readonly url: string;
  readonly locale: string;
  readonly viewport: string;
  readonly theme: string;
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly elements: readonly OverflowElement[];
};

/** `scrollWidth - clientWidth`: how far the document scrolls sideways. */
export function documentOverflowPx(failure: Pick<SweepFailure, "clientWidth" | "scrollWidth">) {
  return failure.scrollWidth - failure.clientWidth;
}

function formatHints(hints: Readonly<Record<string, string>>): string {
  const entries = Object.entries(hints);
  if (entries.length === 0) return "";
  return entries.map(([key, value]) => `${key}: ${value}`).join("; ");
}

/**
 * One failure, as several lines of plain text.
 *
 * Leaf elements are printed first and marked, because an overflowing element drags every
 * ancestor of it into the list and the ancestors are never the fix.
 */
export function formatFailure(failure: SweepFailure): string {
  const overflow = documentOverflowPx(failure);
  const lines = [
    // No "px" after the viewport name — one of them is called `desktop`. The exact width is
    // on this same line as `clientWidth`, so nothing is lost.
    `FAIL  ${failure.url}  [${failure.viewport} · ${failure.theme}]  ` +
      `overflow ${overflow}px  (scrollWidth ${failure.scrollWidth} > clientWidth ${failure.clientWidth})`,
  ];
  if (failure.elements.length === 0) {
    lines.push(
      "      no element reaches past the viewport — look for a margin, a transform or a " +
        "negative inset on a clipped ancestor",
    );
    return lines.join("\n");
  }
  // Widest overflow first, deepest element as the tiebreak. NOT leaf-first: the element
  // whose right edge equals `scrollWidth` is the one the document is scrolling for, and it
  // is often an ancestor of a smaller leaf — `.chartFrame` (+21px, `min-width: 300px`) sits
  // above the `<svg>` it squeezes (+16px), and the frame is the fix.
  const ordered = [...failure.elements].sort((a, b) => {
    if (a.overflowPx !== b.overflowPx) return b.overflowPx - a.overflowPx;
    if (a.leaf !== b.leaf) return a.leaf ? -1 : 1;
    return 0;
  });
  for (const element of ordered) {
    const mark = element.leaf ? "→" : " ";
    lines.push(
      `    ${mark} +${element.overflowPx}px  ${element.selector}  ` +
        `(left ${element.left}, right ${element.right}, width ${element.width})`,
    );
    if (element.text) lines.push(`        text: ${JSON.stringify(element.text)}`);
    const hints = formatHints(element.hints);
    if (hints) lines.push(`        ${hints}`);
  }
  return lines.join("\n");
}

/**
 * The closing summary. The line a reader sees last, so it has to be the verdict.
 *
 * `loadFailures` is counted here and not only listed above it. A sweep pointed at a server
 * with no API behind it answers 500 on eight of the twenty-two URLs — including every route
 * the recorded defects live on — and the fourteen that still render are genuinely free of
 * overflow. "PASS, 14 checks across 22 URLs" is a true sentence and a false verdict.
 */
export function formatSummary(counts: {
  urls: number;
  checks: number;
  failures: number;
  retries: number;
  loadFailures?: number;
}): string {
  const unreached = counts.loadFailures ?? 0;
  const scope = `${counts.checks} checks across ${counts.urls} URLs`;
  const retried = counts.retries > 0 ? ` (${counts.retries} navigation retries)` : "";
  if (counts.failures === 0 && unreached === 0) {
    return `PASS  no horizontal overflow — ${scope}${retried}`;
  }
  const parts = [];
  if (counts.failures > 0) {
    parts.push(`${counts.failures} overflowing combination${counts.failures === 1 ? "" : "s"}`);
  }
  if (unreached > 0) {
    parts.push(`${unreached} page${unreached === 1 ? "" : "s"} never loaded`);
  }
  return `FAIL  ${parts.join(", ")} — ${scope}${retried}`;
}
