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
  };
});
