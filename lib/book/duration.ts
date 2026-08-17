/**
 * A video length in seconds, rendered as the digital clock a reader expects — `6:08`, and
 * `1:02:03` once it passes an hour.
 *
 * ## Why the seconds and not the ISO string
 *
 * The contract publishes BOTH `durationIso` ("PT6M8S") and `durationSeconds` (368), and it
 * says why: the two are cross-checked on the write path because "a parser that reads PT6M8S
 * as 68 seconds passes every range invariant and is still wrong on the page". So the page
 * reads the integer — no parsing here, nothing to get wrong — while the ISO string travels
 * untouched into `VideoObject.duration`. Neither is derived from the other on this side.
 *
 * `Intl.DurationFormat` is deliberately not used: its output is "6 dk 8 sn", which is not the
 * form this label needs beside a play control, and the value already sits inside a `<time>`
 * whose `dateTime` carries the machine-readable ISO string.
 *
 * Negative and non-finite inputs clamp to zero rather than throwing. The contract's minimum is
 * 1, so this is unreachable through the api; it is here because the alternative is a `NaN:NaN`
 * on a live page.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
