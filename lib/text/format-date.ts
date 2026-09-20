import type { Locale } from "@/i18n/routing";

/**
 * Date formatting for anything a reader sees, pinned to ONE time zone.
 *
 * ## The bug this exists to make impossible (T-064)
 *
 * `Intl` without an explicit `timeZone` uses whatever zone the runtime is in. In a server-rendered
 * app that is two different zones for one render: the container is UTC, the reader's browser is
 * wherever they are. `/hesabim/ayarlar` formatted `createdAt` that way and threw React #418 on
 * every load — the server's HTML said `19 Eylül 2026`, the browser's DOM said `20 Eylül 2026`,
 * and React discarded and re-rendered the tree. It was silent for months because the page still
 * looked right; the only visible trace was a minified error in the console.
 *
 * Four other call sites had the same shape and had simply not been noticed yet: the member hub's
 * saved measurements, the game-history list, the leaderboard's achievement dates and the
 * earthquake feed's clock. They all read this file now.
 *
 * ## Why a fixed zone rather than the reader's
 *
 * Because the alternative cannot be server-rendered at all, and because this is what the product
 * means. "Üyelik başlangıcı" and "bu deprem ne zaman oldu" are facts about Türkiye, stated in
 * Turkish, on a Turkish curriculum site; a reader opening it from Berlin should see the same date
 * their classmate in Ankara sees, not one shifted by their laptop's clock. Showing a reader's
 * local time would mean formatting on the client only, after mount — a flash of nothing, for a
 * worse answer.
 *
 * Türkiye has been on a fixed UTC+3 with no DST since 2016, so this zone has no seasonal edge; it
 * is still written as a zone rather than a `+03:00` offset so the ICU database stays the authority
 * if that ever changes.
 */
export const SITE_TIME_ZONE = "Europe/Istanbul";

/** Turkish is the default; `en-GB` because `en-US` would write "September 19, 2026". */
const localeTag = (locale: Locale) => (locale === "en" ? "en-GB" : "tr-TR");

/** What an unparseable instant renders as, rather than the string "Invalid Date". */
const NO_DATE = "—";

function instant(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The three shapes a day is written in on this site. `dayMonth` drops the year for a column that
 * only ever lists recent rows — the leaderboard's date column, which has never shown one.
 */
export type DayStyle = "long" | "short" | "dayMonth";

/** A calendar day: `19 Eylül 2026`, `19 Eyl 2026`, or `19 Eyl`. */
export function formatDay(value: string | Date, locale: Locale, style: DayStyle = "long"): string {
  const date = instant(value);
  if (date === null) return NO_DATE;

  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: SITE_TIME_ZONE,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    ...(style === "dayMonth" ? {} : { year: "numeric" as const }),
  }).format(date);
}

/**
 * A day and a 24-hour clock: `20 Eyl 00:30`. The earthquake feed's shape, where the zone matters
 * most — an event at 21:30 UTC happened after midnight for everyone who felt it.
 */
export function formatDayTime(value: string | Date, locale: Locale): string {
  const date = instant(value);
  if (date === null) return NO_DATE;

  const day = new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: SITE_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(date);

  const time = new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: SITE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return `${day} ${time}`;
}
