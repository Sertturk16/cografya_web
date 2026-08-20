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
/** Full climate series for a province: ERA5-Land (C3S/Copernicus) monthly normals +
 *  source/period + derived (annual/seasonal) figures. `null` on the detail DTO means
 *  "no publishable series" → the web renders no climate section at all. */
export type Climate = components["schemas"]["ClimateDto"];
/** One month's normals row — the CORE PAIR only: mean temperature (°C) + total
 *  precipitation (mm). Both are REQUIRED, non-nullable (api #87 / DEC 2026-08-01o):
 *  ERA5-Land publishes no mean-max/mean-min, sunshine, rainy days or record extremes,
 *  and no nullable placeholder is left behind for fields nobody is producing. */
export type ClimateMonthlyNormal = components["schemas"]["ClimateMonthlyNormalDto"];
/** Derived (OURS, never C3S-attributable) annual/seasonal figures — the api computes
 *  these once so the web consumes them as-is (single-sourced rounding). */
export type ClimateDerived = components["schemas"]["ClimateDerivedDto"];
/** Seasonal precipitation shares (%, sum to exactly 100) — derived. */
export type SeasonalPrecipitation = components["schemas"]["SeasonalPrecipitationDto"];

// ---- Uzun dönem hava kirliliği (PM2.5 — ACAG SatPM2.5) ----------------------
/** One province's long-term annual-mean PM2.5 series: the ~1 km grid cell the province
 *  CENTRE falls in, 1998-2024, plus the licence/attribution block that must travel with
 *  every published figure. `null` on the detail DTO means "no publishable series" → the
 *  web renders no air-pollution section at all (the `climate === null` pattern).
 *
 *  TWO CONTRACT FACTS THE ALIAS REPEATS, because both are misreadings waiting to happen:
 *  · `readingPoint` is `province_centre`. The value is NOT a provincial average and the
 *    interface may not imply one (→ DEC 2026-08-19d md.1).
 *  · This is an ANNUAL CONCENTRATION, not the live hourly air-quality index served by
 *    `/api/air-quality/…`. The contract's own field description forbids conflating them. */
export type Pm25Annual = components["schemas"]["Pm25AnnualDto"];
/** One year of the series: the year and its raw µg/m³ number (never a formatted string —
 *  formatting is this repo's job, `lib/air/pm25-display.ts`). */
export type Pm25AnnualValue = components["schemas"]["Pm25AnnualValueDto"];
/** The ACAG licence block: provider, work title, version, dataset/licence/reference URLs,
 *  the provider's own verbatim method caveat, and the i18n KEYS of the editorial notices
 *  this repo writes the texts for. Every string here is `CONTENT-STYLE.md` §22's untouchable
 *  class — printed as received, never translated, shortened or re-punctuated. */
export type Pm25Attribution = components["schemas"]["Pm25AttributionDto"];

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
/** One reference point's full conditions block — the five values PLUS the 5-day series and
 *  the series/instant source-divergence flag. The province surface's payload element (W2b);
 *  aliased now so the committed fixture is type-checked against the contract rather than
 *  against a hand-rolled shape. */
export type MarineConditions = components["schemas"]["MarineConditionsDto"];
/** One province's marine payload: its plaka, one `MarineConditions` entry per reference
 *  point in `displayOrder` (two for the three two-sea provinces, which legitimately
 *  disagree), and the attribution rows. Consumed by the province pages in W2b. */
export type MarineProvinceConditions = components["schemas"]["MarineProvinceConditionsDto"];

// ---- Book (kitap video çözümleri — /kitaplar, W0) ---------------------------
/** One book on the `/kitaplar` hub card: identity, the two localized slugs, and the two
 *  coverage numbers the card shows. `coverImagePath` is a path inside THIS repo's own
 *  `public/` directory (never a remote URL) or `null` when there is no cover to render. */
export type BookListItem = components["schemas"]["BookListItemDto"];
/** The `/api/books` pagination envelope (`items` + `page`/`pageSize`/`total`/`hasMore`).
 *  The endpoint uses the repo's envelope rather than a flat array because the book set is
 *  UNBOUNDED (→ DEC 2026-08-15e reversed the earlier four-row ceiling), so every consumer
 *  must page until `hasMore === false` instead of reading one response — see
 *  `lib/api/books.ts`, which is the only place that loop is written. */
export type BookList = components["schemas"]["BookListDto"];
/** One book's full payload: künye, editorial narrative, hand-written metadata, coverage
 *  numbers, every indexed deneme with its question index, and the attribution rows.
 *
 *  TWO TRAPS THE CONTRACT DOCUMENTS, WORTH REPEATING AT THE ALIAS:
 *  · `videos[].youtube` is `| null`, and null is the NORMAL path (the provider sync is a
 *    later leg) — not an error, and not a reason to withhold the page. It is also the one
 *    switch that decides whether `VideoObject` may be emitted at all (`SEO-POLICY.md` §B5
 *    5.8: a field the api has no value for is never filled in).
 *  · `attribution` is never empty, in any data state. It carries the canonical credit
 *    strings from `provenance/integrations.md` verbatim; they are `CONTENT-STYLE.md` §22's
 *    untouchable class and are printed as received — never translated, shortened or
 *    reworded on the way to the page. */
export type BookDetail = components["schemas"]["BookDetailDto"];
/** One indexed deneme: its number IN THE BOOK, the video id the embed is built from, the
 *  question index, and the nullable provider snapshot. */
export type BookVideo = components["schemas"]["BookVideoDto"];
/** The provider snapshot on one video — thumbnail (address AND dimensions), publication
 *  instant, duration in both forms, and `embeddable`. Reached only through the non-null branch
 *  of `BookVideo["youtube"]`; `lib/book/video-state.ts` is the single place that narrows it. */
export type BookVideoYoutube = components["schemas"]["BookVideoYoutubeDto"];
