/**
 * The ready-made examples ("Hazır örnekler") of the three CBS tools, one list per tool (T-125).
 *
 * Each tool page shows only its own list, so picking an example never turns the distance page
 * into the area tool. Labels are `ToolWorkbench` message keys; area corners carry none because
 * the tool numbers them ("Köşe 1").
 *
 * Coordinates:
 * - The first two examples of each tool are the original presets, unchanged: their chip labels
 *   print figures measured from these exact points.
 * - Province centres added later are the MGM il-merkez stations the API seeds
 *   (`cografya_api/src/database/seeds/province.seed-data.ts`), the same points the tool's
 *   province dropdown places.
 * - Beyşehir Gölü is its OSM outline (`data/tr-inland-water.geojson`, r207124) reduced to the
 *   northern, eastern, southern and western tips.
 * - The Marmara ring runs through coastal towns: Gelibolu, Tekirdağ, Silivri, Kadıköy, İzmit,
 *   Gemlik, Bandırma, Karabiga. Like the lake rings it is a rough outline, so no chip prints an
 *   area for it.
 * - Ağrı Dağı summit and Anıtkabir are Wikipedia's coordinates for them.
 */

export const TOOL_MODES = ["distance", "coordinates", "area"] as const;
export type ToolMode = (typeof TOOL_MODES)[number];

export interface PresetPoint {
  readonly lat: number;
  readonly lon: number;
  /** `ToolWorkbench` message key; omitted on area corners. */
  readonly labelKey?: string;
}

export interface ToolPreset {
  readonly id: string;
  /** `ToolWorkbench` message key of the chip. */
  readonly labelKey: string;
  readonly points: readonly PresetPoint[];
}

const corners = (ring: readonly (readonly [number, number])[]): PresetPoint[] =>
  ring.map(([lat, lon]) => ({ lat, lon }));

export const TOOL_PRESETS: Readonly<Record<ToolMode, readonly ToolPreset[]>> = {
  distance: [
    {
      id: "ist-ank",
      labelKey: "presetIstanbulAnkara",
      points: [
        { lat: 41.0082, lon: 28.9784, labelKey: "placeIstanbul" },
        { lat: 39.9334, lon: 32.8597, labelKey: "placeAnkara" },
      ],
    },
    {
      id: "izm-van",
      labelKey: "presetIzmirVan",
      points: [
        { lat: 38.4237, lon: 27.1428, labelKey: "placeIzmir" },
        { lat: 38.4891, lon: 43.4089, labelKey: "placeVan" },
      ],
    },
    {
      id: "ist-can-izm",
      labelKey: "presetIstanbulCanakkaleIzmir",
      points: [
        { lat: 40.9819, lon: 28.8208, labelKey: "placeIstanbul" },
        { lat: 40.141, lon: 26.3993, labelKey: "placeCanakkale" },
        { lat: 38.4049, lon: 27.1895, labelKey: "placeIzmir" },
      ],
    },
    {
      id: "black-sea-coast",
      labelKey: "presetBlackSeaCoast",
      points: [
        { lat: 41.3442, lon: 36.2564, labelKey: "placeSamsun" },
        { lat: 40.9838, lon: 37.8858, labelKey: "placeOrdu" },
        { lat: 40.9227, lon: 38.3878, labelKey: "placeGiresun" },
        { lat: 40.9985, lon: 39.7649, labelKey: "placeTrabzon" },
        { lat: 41.04, lon: 40.5013, labelKey: "placeRize" },
      ],
    },
    {
      id: "edirne-igdir",
      labelKey: "presetEdirneIgdir",
      points: [
        { lat: 41.6767, lon: 26.5508, labelKey: "placeEdirne" },
        { lat: 39.9227, lon: 44.0523, labelKey: "placeIgdir" },
      ],
    },
  ],
  area: [
    {
      id: "tuz-golu",
      labelKey: "presetLakeTuz",
      points: corners([
        [39.15, 33.25],
        [39.05, 33.65],
        [38.65, 33.45],
        [38.75, 33.15],
      ]),
    },
    {
      id: "van-golu",
      labelKey: "presetLakeVan",
      points: corners([
        [38.95, 43.35],
        [38.65, 43.65],
        [38.35, 43.15],
        [38.55, 42.65],
        [38.95, 42.95],
      ]),
    },
    {
      id: "beysehir-golu",
      labelKey: "presetLakeBeysehir",
      points: corners([
        [37.974, 31.421],
        [37.681, 31.722],
        [37.583, 31.516],
        [37.929, 31.309],
      ]),
    },
    {
      id: "kapadokya",
      labelKey: "presetCappadocia",
      points: [
        { lat: 38.6163, lon: 34.7025, labelKey: "placeNevsehir" },
        { lat: 38.687, lon: 35.5, labelKey: "placeKayseri" },
        { lat: 37.9587, lon: 34.6795, labelKey: "placeNigde" },
      ],
    },
    {
      id: "marmara",
      labelKey: "presetMarmara",
      points: corners([
        [40.41, 26.67],
        [40.98, 27.51],
        [41.07, 28.25],
        [40.99, 29.03],
        [40.765, 29.94],
        [40.43, 29.16],
        [40.35, 27.97],
        [40.4, 27.31],
      ]),
    },
  ],
  coordinates: [
    {
      id: "merkez",
      labelKey: "presetCentre",
      points: [{ lat: 39.14, lon: 34.16, labelKey: "placeCentre" }],
    },
    {
      id: "agri-dagi",
      labelKey: "presetAraratSummit",
      points: [{ lat: 39.7019, lon: 44.2983, labelKey: "placeAraratSummit" }],
    },
    {
      id: "anitkabir",
      labelKey: "presetAnitkabir",
      points: [{ lat: 39.92556, lon: 32.83778, labelKey: "placeAnitkabir" }],
    },
  ],
};
