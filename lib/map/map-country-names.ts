/**
 * Turkish names for the countries the Türkiye-centred maps draw around the country
 * (`tr-context.generated.ts`, `tr-context-tall.generated.ts`). One table for `/turkiye`, `/deniz`
 * and `/deprem`, which each carried their own copy until T-085. A country missing here falls back
 * to the artifact's `geoName`.
 */
export const MAP_COUNTRY_NAMES_TR: Readonly<Record<string, string>> = {
  GR: "Yunanistan",
  BG: "Bulgaristan",
  GE: "Gürcistan",
  AM: "Ermenistan",
  AZ: "Azerbaycan",
  IR: "İran",
  IQ: "Irak",
  SY: "Suriye",
  RU: "Rusya",
  CY: "Güney Kıbrıs Rum Yönetimi",
  LB: "Lübnan",
  // T-079: countries only the tall frame shows (north of the Black Sea, south of the Mediterranean).
  UA: "Ukrayna",
  RO: "Romanya",
  MD: "Moldova",
  EG: "Mısır",
  LY: "Libya",
  JO: "Ürdün",
  SA: "Suudi Arabistan",
};

/** Neighbours the maps never label: slivers at the frame's edge, or covered by another label. */
export const UNLABELLED_CONTEXT_ISOS: ReadonlySet<string> = new Set(["MK", "RS", "LB", "QN", "CY"]);
