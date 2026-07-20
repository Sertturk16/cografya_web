import type { Locale } from "@/i18n/routing";

/**
 * Deterministic meta-description variant selection for province pages.
 *
 * Three skeleton-distinct description variants (PLAN §2 / SEO-POLICY §B10 — they must
 * differ in STRUCTURE, not just interpolated numbers) are rotated across the corpus by
 * `plateCode % 3`. The choice is **deterministic, never random**: a random pick would
 * change the emitted `<meta>` from build to build for the same URL, which is SEO churn
 * (a stable page must present a stable description). Keying on the immutable plate code
 * makes each province's variant fixed forever.
 */
export type ProvinceDescriptionVariant = 0 | 1 | 2;

/**
 * The variant index for a province, from its plate code. Plate codes are the api's
 * 2-digit zero-padded numeric strings ("01".."81"); a value with no leading digits
 * (e.g. "" or "abc") falls back to variant 0 rather than throwing (the description is
 * best-effort chrome, never a reason to 500 a page). `Number.parseInt` is prefix-parsing,
 * so a well-formed plate code always parses; the fallback only guards a value that yields
 * no finite number at all. The `((n % 3) + 3) % 3` form is defensive against a
 * hypothetical negative input — plate codes are never negative, but the modulo stays
 * correct if that ever changes.
 */
export function provinceDescriptionVariant(plateCode: string): ProvinceDescriptionVariant {
  const n = Number.parseInt(plateCode, 10);
  if (!Number.isFinite(n)) return 0;
  return (((n % 3) + 3) % 3) as ProvinceDescriptionVariant;
}

/** The three climate-tier description message keys, indexed by variant. */
export const CLIMATE_DESCRIPTION_KEY: Record<ProvinceDescriptionVariant, string> = {
  0: "metaDescriptionClimate0",
  1: "metaDescriptionClimate1",
  2: "metaDescriptionClimate2",
};

/**
 * The non-climate fallback description keys. These tiers exist precisely BECAUSE the page
 * shows no climate section, so their strings must never claim climate content (SEO-POLICY
 * §B2.6 — a description must not promise something the page lacks). Single-sourced here so
 * the totality test and the selector reference the same literals.
 */
export const POPULATION_DESCRIPTION_KEY = "metaDescriptionPopulation";
export const AREA_DESCRIPTION_KEY = "metaDescriptionArea";
export const GENERIC_DESCRIPTION_KEY = "metaDescription";

/** Minimal climate shape the selector needs (structurally satisfied by `ClimateDto`). */
interface ClimateFacts {
  derived: { annualMeanTempC: number; annualPrecipitationMm: number };
}

export interface ProvinceDescriptionInput {
  locale: Locale;
  plateCode: string;
  /** The province's climate DTO, or null when it has no publishable series. */
  climate: ClimateFacts | null;
  population: number | null;
  areaKm2: number | null;
  name: string;
  region: string;
}

export interface ProvinceDescriptionSelection {
  key: string;
  params: Record<string, string | number>;
}

/** The generic (always-valid) and climate-targeted meta-title message keys. */
export const GENERIC_TITLE_KEY = "metaTitle";
export const CLIMATE_TITLE_KEY = "metaTitleClimate";

export interface ProvinceTitleInput {
  locale: Locale;
  /** The province's climate DTO, or null when it has no publishable series. */
  climate: ClimateFacts | null;
  name: string;
}

/**
 * Selects the meta-title message key + params for a province page (W3, PLAN §2). The
 * title is expanded to target the "{il} iklim grafiği" query — the exact query the small
 * competitor outranks climate-data.org on — but ONLY when the page actually renders a
 * climate chart. The variant is **climate-gated and TR-only** (mirrors the description's
 * climate tier and the TR-gated visible climate section): an EN province page is noindex
 * and shows no climate, so its title must never claim "İklim Grafiği" content the page
 * lacks (SEO-POLICY §B2.6). Deterministic — no randomness, no plate-code rotation: the
 * title is a single, stable string per URL. Pure/DOM-free so the TR-gate is unit-tested
 * without i18n (the same gate whose EN slip regressed indexing before, → PR #16).
 */
export function selectProvinceMetaTitle(input: ProvinceTitleInput): ProvinceDescriptionSelection {
  const climate = input.locale === "tr" ? input.climate : null;
  const key = climate !== null ? CLIMATE_TITLE_KEY : GENERIC_TITLE_KEY;
  return { key, params: { name: input.name } };
}

/**
 * Selects the meta-description message key + ICU params for a province page, applying the
 * graceful fallback chain: **climate fact → population fact → area fact → region-only
 * generic**. Pure and DOM-free (returns the key/params, not the rendered string) so the
 * routing is unit-testable without i18n or jsdom — the caller does the `t(key, params)`.
 *
 * The climate tier is **TR-gated inside this function** (`locale === "tr"`): it mirrors the
 * TR-gated visible climate section, and EN detail pages are noindex and render no climate,
 * so an EN description must never select the climate tier. The three non-climate tiers are
 * deliberately climate-free strings, so no province — TR or EN — over-promises content the
 * page does not show.
 */
export function selectProvinceMetaDescription(
  input: ProvinceDescriptionInput,
): ProvinceDescriptionSelection {
  const { locale, plateCode, population, areaKm2, name, region } = input;
  const climate = locale === "tr" ? input.climate : null;

  if (climate !== null) {
    const variant = provinceDescriptionVariant(plateCode);
    return {
      key: CLIMATE_DESCRIPTION_KEY[variant],
      params: {
        name,
        region,
        // `annualMeanTempC` is already 1-decimal from the api and ICU bounds fraction
        // digits, so temp needs no explicit rounding. Precipitation is `Math.round`-ed
        // purely because an integer mm reads cleaner in a snippet than a raw 1-decimal
        // figure; the exact value stays on the page (chart + table).
        temp: climate.derived.annualMeanTempC,
        precip: Math.round(climate.derived.annualPrecipitationMm),
      },
    };
  }
  if (population !== null) {
    return { key: POPULATION_DESCRIPTION_KEY, params: { name, region, population } };
  }
  if (areaKm2 !== null) {
    return { key: AREA_DESCRIPTION_KEY, params: { name, region, area: areaKm2 } };
  }
  return { key: GENERIC_DESCRIPTION_KEY, params: { name, region } };
}
