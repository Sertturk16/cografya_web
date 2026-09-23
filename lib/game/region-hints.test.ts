import { describe, expect, it } from "vitest";
import type { GeographicRegion } from "@/lib/api/types";
import tr from "@/messages/tr.json";
import { REGION_KEYS } from "./region-slug";
import { REGION_HINTS, regionHint } from "./region-hints";

/**
 * The region-mode hint has to help without handing over the answer.
 *
 * The neighbour table cannot be derived from the map here: which province belongs to which
 * region comes from the api, not from `tr-provinces.generated.ts`, so there are no region
 * polygons to intersect in a unit test. The table is hand-verified; these tests guard its
 * shape (total, symmetric, irreflexive) and the one rule that makes a hint a hint.
 */
const LABELS = tr.Regions as Record<GeographicRegion, string>;

/** The label as a standalone name: "Doğu Anadolu" must not match inside "Güneydoğu Anadolu". */
function namesRegion(sentence: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "u").test(sentence);
}

describe("REGION_HINTS", () => {
  it("has exactly the seven region keys", () => {
    expect(Object.keys(REGION_HINTS).sort()).toEqual([...REGION_KEYS].sort());
  });

  it("is symmetric: if A borders B, B borders A", () => {
    for (const region of REGION_KEYS) {
      for (const neighbour of REGION_HINTS[region].neighbours) {
        expect(REGION_HINTS[neighbour].neighbours, `${neighbour} -> ${region}`).toContain(region);
      }
    }
  });

  it("never lists a region as its own neighbour, or a neighbour twice", () => {
    for (const region of REGION_KEYS) {
      const { neighbours } = REGION_HINTS[region];
      expect(neighbours).not.toContain(region);
      expect(new Set(neighbours).size).toBe(neighbours.length);
    }
  });

  it("names only Türkiye's four seas", () => {
    const seas = new Set(["Karadeniz", "Marmara Denizi", "Ege Denizi", "Akdeniz"]);
    for (const region of REGION_KEYS) {
      for (const sea of REGION_HINTS[region].seas) expect(seas).toContain(sea);
    }
  });
});

describe("regionHint", () => {
  it("never names the target region, not even through the sea it is named after", () => {
    for (const region of REGION_KEYS) {
      const hint = regionHint(region, LABELS);
      expect(namesRegion(hint, LABELS[region]), `${region}: ${hint}`).toBe(false);
    }
  });

  it("names every neighbour", () => {
    for (const region of REGION_KEYS) {
      const hint = regionHint(region, LABELS);
      for (const neighbour of REGION_HINTS[region].neighbours) {
        expect(namesRegion(hint, LABELS[neighbour]), `${region} -> ${neighbour}`).toBe(true);
      }
    }
  });

  it("gives a different hint for every region", () => {
    const hints = REGION_KEYS.map((region) => regionHint(region, LABELS));
    expect(new Set(hints).size).toBe(REGION_KEYS.length);
  });

  // The whole table, spelled out: Turkish list joining ("A, B ve C"), the sea count, and
  // the namesake sea counted but not named.
  it("builds these sentences", () => {
    expect(Object.fromEntries(REGION_KEYS.map((r) => [r, regionHint(r, LABELS)]))).toEqual({
      MARMARA:
        "İpucu: Üç denize kıyısı var, ikisi Karadeniz ve Ege Denizi; Karadeniz, İç Anadolu ve Ege bölgeleriyle komşu.",
      EGE: "İpucu: İki denize kıyısı var, biri Akdeniz; Marmara, İç Anadolu ve Akdeniz bölgeleriyle komşu.",
      AKDENIZ:
        "İpucu: Tek bir denize kıyısı var; Ege, İç Anadolu, Doğu Anadolu ve Güneydoğu Anadolu bölgeleriyle komşu.",
      IC_ANADOLU:
        "İpucu: Denize kıyısı yok; Marmara, Karadeniz, Ege, Akdeniz ve Doğu Anadolu bölgeleriyle komşu.",
      KARADENIZ:
        "İpucu: Tek bir denize kıyısı var; Marmara, İç Anadolu ve Doğu Anadolu bölgeleriyle komşu.",
      DOGU_ANADOLU:
        "İpucu: Denize kıyısı yok; Karadeniz, İç Anadolu, Akdeniz ve Güneydoğu Anadolu bölgeleriyle komşu.",
      GUNEYDOGU_ANADOLU: "İpucu: Denize kıyısı yok; Akdeniz ve Doğu Anadolu bölgeleriyle komşu.",
    });
  });
});
