import type { GeographicRegion } from "@/lib/api/types";
import type { RegionLabels } from "./target";

/**
 * What the region-mode hint says about each of the seven regions: the seas it has a coast
 * on and the regions it borders. Hand-verified geography; the neighbour relation is checked
 * for symmetry in `region-hints.test.ts`. Sea names are Turkish literals because the game
 * screens are `trOnly`.
 */
export const REGION_HINTS: Record<
  GeographicRegion,
  { readonly seas: readonly string[]; readonly neighbours: readonly GeographicRegion[] }
> = {
  MARMARA: {
    seas: ["Karadeniz", "Marmara Denizi", "Ege Denizi"],
    neighbours: ["KARADENIZ", "IC_ANADOLU", "EGE"],
  },
  EGE: { seas: ["Ege Denizi", "Akdeniz"], neighbours: ["MARMARA", "IC_ANADOLU", "AKDENIZ"] },
  AKDENIZ: {
    seas: ["Akdeniz"],
    neighbours: ["EGE", "IC_ANADOLU", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"],
  },
  IC_ANADOLU: {
    seas: [],
    neighbours: ["MARMARA", "KARADENIZ", "EGE", "AKDENIZ", "DOGU_ANADOLU"],
  },
  KARADENIZ: { seas: ["Karadeniz"], neighbours: ["MARMARA", "IC_ANADOLU", "DOGU_ANADOLU"] },
  DOGU_ANADOLU: {
    seas: [],
    neighbours: ["KARADENIZ", "IC_ANADOLU", "AKDENIZ", "GUNEYDOGU_ANADOLU"],
  },
  GUNEYDOGU_ANADOLU: { seas: [], neighbours: ["AKDENIZ", "DOGU_ANADOLU"] },
};

const COUNT_CAPITALISED = ["", "Tek bir", "İki", "Üç"] as const;
const COUNT_POSSESSIVE = ["", "biri", "ikisi", "üçü"] as const;

/** Turkish list joining: "A", "A ve B", "A, B ve C". */
function joinTr(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ve ${items[items.length - 1]}`;
}

/**
 * The hint sentence for a region-mode question, without naming the region.
 *
 * Rule: four regions share a name with a sea (Marmara / Marmara Denizi, Ege / Ege Denizi,
 * Akdeniz, Karadeniz). A sea whose name contains the target's own label is COUNTED but not
 * named, because naming it would be the answer; every other sea is named.
 */
export function regionHint(region: GeographicRegion, regionLabels: RegionLabels): string {
  const { seas, neighbours } = REGION_HINTS[region];
  const label = regionLabels[region];
  const named = seas.filter((sea) => !sea.includes(label));

  let coast: string;
  if (seas.length === 0) {
    coast = "Denize kıyısı yok";
  } else {
    coast = `${COUNT_CAPITALISED[seas.length]} denize kıyısı var`;
    if (named.length === seas.length) coast += `: ${joinTr(named)}`;
    else if (named.length > 0) coast += `, ${COUNT_POSSESSIVE[named.length]} ${joinTr(named)}`;
  }

  const suffix = neighbours.length === 1 ? "bölgesiyle" : "bölgeleriyle";
  return `İpucu: ${coast}; ${joinTr(neighbours.map((n) => regionLabels[n]))} ${suffix} komşu.`;
}
