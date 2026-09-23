/**
 * Which Turkish provinces have a sea coast: a geographic fact, so a fixed list.
 *
 * Türkiye has 28 coastal provinces. The marine reference points (`/api/marine/points`) cover
 * only 27 of them — Edirne, whose coast runs along Saros Körfezi and the Enez shore of the
 * Aegean, has no point — so deriving "is this province coastal" from the point list silently
 * dropped Edirne and printed "27" as Türkiye's coastal-province count. The marine points
 * still decide everything about MARINE DATA (`lib/marine/coastal.ts`: whether to fetch and
 * show a province's sea conditions); they no longer decide which provinces have a coast.
 *
 * `coastal-provinces.test.ts` pins the size, Edirne's membership, every code against the map's
 * 81 plates, and the union of the four sea pages' province lists.
 */
export const COASTAL_PLATE_CODES: ReadonlySet<string> = new Set([
  "01", // Adana
  "07", // Antalya
  "08", // Artvin
  "09", // Aydın
  "10", // Balıkesir
  "16", // Bursa
  "17", // Çanakkale
  "22", // Edirne
  "28", // Giresun
  "31", // Hatay
  "33", // Mersin
  "34", // İstanbul
  "35", // İzmir
  "37", // Kastamonu
  "39", // Kırklareli
  "41", // Kocaeli
  "48", // Muğla
  "52", // Ordu
  "53", // Rize
  "54", // Sakarya
  "55", // Samsun
  "57", // Sinop
  "59", // Tekirdağ
  "61", // Trabzon
  "67", // Zonguldak
  "74", // Bartın
  "77", // Yalova
  "81", // Düzce
]);

/** Whether the province with this two-digit plate code has a sea coast. */
export function hasSeaCoast(plateCode: string): boolean {
  return COASTAL_PLATE_CODES.has(plateCode);
}
