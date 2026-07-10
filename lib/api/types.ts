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

/** The seven official geographic regions of Türkiye (contract enum values). */
export type GeographicRegion = ProvinceListItem["region"];
