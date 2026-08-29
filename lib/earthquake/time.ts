/**
 * The web's single UTC→Turkish-time conversion point for `occurredAtUtc` (`GLOSSARY.md` §4's
 * "oluş zamanı" row: "Yerel saate çevirme tek katmanda yapılır" — converting to local time
 * happens in exactly one layer).
 *
 * `occurredAtUtc` arrives `Z`-suffixed UTC, never converted by the api layer
 * (`EarthquakeEventDto`'s own docblock). AFAD's own web page shows the same instant shifted
 * +3 hours, so reading the field as anything other than UTC-then-converted-once publishes
 * every earthquake three hours wrong — the exact trap the contract's own comment names. This
 * is deliberately DIFFERENT from the project-wide `i18n/request.ts` default
 * (`timeZone: "UTC"`, used for the marine model künye, which is genuinely a UTC-labelled
 * technical timestamp): an earthquake's "when did this happen" is a wall-clock fact a reader
 * in Türkiye reasons about in Türkiye time, so this module names an explicit
 * `timeZone: "Europe/Istanbul"` that overrides the project default (`lib/book/published-
 * date.ts`'s own documented precedent: "an explicit option beats this default").
 *
 * Türkiye has observed a single, non-DST UTC+3 offset since 2016 — `Europe/Istanbul` and a
 * fixed `+03:00` are therefore equivalent for every event this contract can ever hold
 * (archive depth back to 1999, `provenance/integrations.md`'s AFAD row), and the IANA zone
 * name is preferred because it says WHY the offset is three hours rather than stating the
 * number twice.
 *
 * A plain constant + a thin formatting function, not a next-intl `getFormatter`/`useFormatter`
 * call: this value is consumed by BOTH the server-rendered default view and the client filter
 * island's re-render (§5.5), and native `Intl.DateTimeFormat` needs no server/client-specific
 * hook to do the same job, so one function serves both without threading a formatter instance
 * through props.
 */

export const EARTHQUAKE_TIME_ZONE = "Europe/Istanbul";

/** `dateStyle`/`timeStyle` shared by every rendering of `occurredAtUtc` on this surface. */
export const EARTHQUAKE_OCCURRED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: EARTHQUAKE_TIME_ZONE,
};

/** Formats an `occurredAtUtc` ISO instant into Türkiye wall-clock time, for the given locale. */
export function formatEarthquakeOccurredAt(occurredAtUtc: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, EARTHQUAKE_OCCURRED_AT_FORMAT).format(
    new Date(occurredAtUtc),
  );
}
