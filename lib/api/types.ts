import type { components } from "./schema";

/**
 * Friendly aliases over the generated OpenAPI schema (`schema.ts`, produced by
 * `pnpm codegen` from the committed `openapi/openapi.json`). Import contract
 * shapes from HERE, never by reaching into `components["schemas"][…]` at call
 * sites — this is the one place the generated names are referenced, so a contract
 * rename is a one-line change here.
 *
 * Contract source of truth: the api repo (`@nestjs/swagger`). To pull a newer
 * contract: copy `cografya_api/openapi/openapi.json` → `openapi/openapi.json`
 * (coordinated through Atlas), then `pnpm codegen`. `pnpm codegen:check` fails if
 * the committed `schema.ts` has drifted from the committed spec.
 */
export type ProvinceListItem = components["schemas"]["ProvinceListItemDto"];
export type ProvinceDetail = components["schemas"]["ProvinceDetailDto"];
/** A single hydrography feature (dam/river/lake) on the detail page. */
export type HydrographyFeature = components["schemas"]["HydrographyFeatureDto"];
/** The one TÜİK-anchored economic-geography statistic on the detail page. */
export type EconomyIndicator = components["schemas"]["EconomyIndicatorDto"];
/** Bulk hover-card summary for the homepage SVG map (identity + the stat-chip
 *  numbers), build-time embedded — the purpose-built `/api/provinces/map-summary`
 *  payload. */
export type ProvinceMapSummary = components["schemas"]["ProvinceMapSummaryDto"];

// ---- Climate (İklim grafiği/tablosu — W1) -----------------------------------
/** Full climate series for a province: MGM k=A monthly normals + source/period +
 *  all-time records + derived (annual/seasonal) figures. `null` on the detail DTO
 *  means "no publishable series" → the web renders no climate section at all. */
export type Climate = components["schemas"]["ClimateDto"];
/** One month's normals row (mean/max/min temp, precipitation, sunshine, rainy days,
 *  monthly record extremes). Every numeric field is nullable; the core pair
 *  (tempMeanC + precipitationMm) is filled for every published province. */
export type ClimateMonthlyNormal = components["schemas"]["ClimateMonthlyNormalDto"];
/** Derived (OURS, never MGM-attributable) annual/seasonal figures — the api computes
 *  these once so the web consumes them as-is (single-sourced rounding). */
export type ClimateDerived = components["schemas"]["ClimateDerivedDto"];
/** Seasonal precipitation shares (%, sum to exactly 100) — derived. */
export type SeasonalPrecipitation = components["schemas"]["SeasonalPrecipitationDto"];
/** All-time records block (daily-max precipitation, fastest wind, max snow depth). */
export type ClimateRecords = components["schemas"]["ClimateRecordsDto"];
/** A single all-time extreme record (value + optional observation date). */
export type ClimateExtremeRecord = components["schemas"]["ClimateExtremeRecordDto"];

/** The seven official geographic regions of Türkiye (contract enum values). */
export type GeographicRegion = ProvinceListItem["region"];

// ---- Country (dünya haritası, Faz-2) ----------------------------------------
export type CountryListItem = components["schemas"]["CountryListItemDto"];
export type CountryDetail = components["schemas"]["CountryDetailDto"];
/** Bulk hover-card summary for the world SVG map (identity + the stat-chip numbers),
 *  build-time embedded — the purpose-built `/api/countries/map-summary` payload. */
export type CountryMapSummary = components["schemas"]["CountryMapSummaryDto"];

/** The six continents (contract enum values, TR keys). */
export type Continent = CountryListItem["continent"];

// ---- Marine (deniz-hava — /deniz hub'ı, W1) ---------------------------------
/** One offshore reference point: identity, the province it is published under
 *  (`plateCode`), its coordinate, its sea basin, and the coastal-traverse
 *  `displayOrder`. Three provinces (İstanbul, Çanakkale, Balıkesir) own two points
 *  each, so 30 points map to 27 provinces. */
export type MarinePointListItem = components["schemas"]["MarinePointListItemDto"];
/** One measurement layer of the catalogue: unit, direction convention, calm threshold,
 *  provider, and the model künye (`horizonEndUtc` / `updateFrequency` /
 *  `catalogueUpdatedAtUtc`). The three künye fields are nullable and move together —
 *  null means no ingested cycle (or one past the 24 h age ceiling), never "unknown". */
export type MarineLayer = components["schemas"]["MarineLayerDto"];
/** One measured quantity at one point: the number (or `null`), its canonical unit, WHY it
 *  is or is not present (`status`), cache freshness, the model künye behind it
 *  (`validAtUtc` / `modelRunAtUtc` / `staleSinceUtc`), the provider, and the grid cell it
 *  was read from. `status` and `freshness` are deliberately separate — `ok + stale` is a
 *  normal, frequent combination, not an error. */
export type MarineValue = components["schemas"]["MarineValueDto"];
/** One reference point's five values on the hub payload (identity + SST, wave height,
 *  wave direction, wind speed, wind direction). No series: the 5-day chart is a province
 *  concern (`MarineConditionsDto`). */
export type MarineOverviewPoint = components["schemas"]["MarineOverviewPointDto"];
/** The `/deniz` value band's whole payload: one block per reference point, the assembly
 *  instant, the `dataAvailable` publish gate, and the attribution rows every displayed
 *  value drags along. */
export type MarineOverview = components["schemas"]["MarineOverviewDto"];
