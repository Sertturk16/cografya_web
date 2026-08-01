import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Per-request next-intl config. Resolves the active locale (falling back to the
 * default for unknown values) and loads that locale's message catalogue.
 *
 * Faz-1 policy (CONVENTIONS §5): TR is the content locale; EN carries the
 * translated CHROME/framework strings (nav, footer, page scaffolding) so `/en`
 * renders as a valid English shell. Deep EN geography content is deferred.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    /**
     * PROJECT-WIDE FORMATTING TIME ZONE (→ owner answer S5, W1).
     *
     * Without this, `format.dateTime` inherits the RUNTIME's zone: the same build prints a
     * different hour — and, for a date-only value, sometimes a different DAY — depending on
     * which machine rendered it. The hosting region is still undecided, so that zone is an
     * assumption we do not get to make, and an ISR page can be rendered days apart on
     * different workers.
     *
     * UTC rather than `Europe/Istanbul` because every instant the app formats is published
     * in UTC by the api (the marine model künye: cycle time, forecast horizon, catalogue
     * timestamp) and the `/deniz` hub labels them "UTC" on screen. Converting them to a
     * local zone would silently restate the provider's own stamp.
     *
     * This does NOT change any existing page. The only two `dateTime` call sites already
     * defend themselves: the climate records pass `timeZone: "UTC"` explicitly (an explicit
     * option beats this default), and month names are built from `Date.UTC(2020, m-1, 15)`,
     * a mid-month anchor no real zone offset can push into another month. Verified
     * empirically against `dev` before merge (rendered-HTML diff, W1a closing summary).
     */
    timeZone: "UTC",
  };
});
