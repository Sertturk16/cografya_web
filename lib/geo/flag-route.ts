import "server-only";
import { FLAG_URL_SUFFIX, flagParamToIso } from "./flag-set";

interface CountryIsoRow {
  readonly isoCode: string;
}

/**
 * The one served-corpus decision used by build-time params and on-demand requests.
 *
 * A URL is public only when the API corpus and the atomic asset catalogue agree. Package-only
 * entries such as EU therefore remain private, while a country added after the web build can
 * be admitted by the runtime API list without a redeploy. Casing/edge whitespace is
 * normalized exactly as the page component does; values that are not alpha-2 after that are
 * ignored.
 */
export function servedFlagIsoCodes(
  countries: readonly CountryIsoRow[],
  available: ReadonlySet<string>,
): ReadonlySet<string> {
  const served = new Set<string>();
  for (const country of countries) {
    const iso = country.isoCode.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso) && available.has(iso)) served.add(iso);
  }
  return served;
}

/** Static params may be empty during an API-offline build; runtime handling remains open. */
export function flagParamsForCountries(
  countries: readonly CountryIsoRow[],
  available: ReadonlySet<string>,
): Array<{ flag: string }> {
  return [...servedFlagIsoCodes(countries, available)].map((iso) => ({
    flag: `${iso}${FLAG_URL_SUFFIX}`,
  }));
}

export interface FlagRequestDependencies {
  /** Atomic local + package asset catalogue. */
  readonly availableIsoCodes: () => ReadonlySet<string>;
  /** Runtime API corpus; failures must reject, never become a memoised empty Set. */
  readonly getCountryIsoCodes: () => Promise<readonly string[]>;
  /** The only filesystem read, reached after every gate. */
  readonly readSvg: (iso: string) => string | null;
  readonly warn?: (message: string, error: unknown) => void;
}

/**
 * Resolve one public flag request without letting URL input choose a filesystem path.
 *
 * Gate order is load-bearing: shape + resolved asset, then the current API corpus, then the
 * read. A transient API outage rejects this call and is handled by Next's normal error/cache
 * path; it is intentionally NOT converted to `[]` or memoised as a false catalogue. That
 * preserves the last good route artifact instead of teaching the process that every country
 * vanished. A read fault after admission degrades to the route's short-lived 404 response.
 */
export async function loadFlagSvgForRequest(
  param: string,
  dependencies: FlagRequestDependencies,
): Promise<string | null> {
  const available = dependencies.availableIsoCodes();
  const iso = flagParamToIso(param, available);
  if (iso === null) return null;

  const countryIsoCodes = await dependencies.getCountryIsoCodes();
  const countries = countryIsoCodes.map((isoCode) => ({ isoCode }));
  if (!servedFlagIsoCodes(countries, available).has(iso)) return null;

  try {
    return dependencies.readSvg(iso);
  } catch (error) {
    dependencies.warn?.(`[flag-route] admitted flag ${iso} could not be read`, error);
    return null;
  }
}
