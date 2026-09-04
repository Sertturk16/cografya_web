import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRegionBySlug, getRegions, getRegionsResilient } from "./regions";
import { isProductionBuild } from "./provinces";
import type { RegionDetail, RegionListItem } from "./types";

vi.mock("./provinces", () => ({ isProductionBuild: vi.fn(() => false) }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

const MOCK_REGION_LIST_ITEM: RegionListItem = {
  region: "MARMARA",
  slug: "marmara",
  nameTr: "Marmara Bölgesi",
  headingName: "Marmara",
  provinceCount: 11,
  districtCount: 158,
  population: 26711525,
  populationSharePercent: 31.03,
  areaKm2: 72666,
  areaSharePercent: 9.32,
  populationDensity: 368,
  gdpShareApproxPercent: 43.0,
};

const MOCK_REGION_DETAIL: RegionDetail = {
  ...MOCK_REGION_LIST_ITEM,
  metaTitle: "Marmara Bölgesi: 11 İl, İklim ve Ekonomik Ağırlık",
  metaDescription: "Marmara Bölgesi kapsamlı coğrafya rehberi.",
  h1: "Marmara Bölgesi",
  introTr: "Marmara Bölgesi, adını ortasındaki denizden alır...",
  highestPointName: "Uludağ",
  highestPointElevationM: 2543,
  highestPointProvince: "Bursa",
  coastalSeas: ["Karadeniz", "Marmara Denizi", "Ege Denizi"],
  neighborRegions: ["Ege", "Karadeniz", "İç Anadolu"],
  neighborCountries: ["Bulgaristan", "Yunanistan"],
  subregionCount: 4,
  subregions: ["Yıldız Dağları", "Ergene", "Çatalca-Kocaeli", "Güney Marmara"],
  footnotes: ["Nüfus ve alan il toplamlarıdır."],
  locationAndBordersTr: "Bölge kuzeybatıda yer alır...",
  landformsTr: "Ortalama yükseltisi en az olan bölgedir...",
  climateAndVegetationTr: "Geçiş iklimi özellikleri görülür...",
  hydrographyTr: "Meriç, Ergene ve Susurluk başlıca akarsulardır...",
  settlementAndPopulationTr: "Türkiye nüfusunun en yoğun olduğu bölgedir...",
  economyTr: "Sanayi ve hizmet sektörleri gelişmiştir...",
  subregionsTr: "Dört coğrafi bölüme ayrılır...",
  disasterAndEarthquakeTr: "Kuzey Anadolu Fay Hattı geçer...",
  comparisonTr: "Yedi bölge arasında ilk sıradadır...",
  sourcesNoteTr: "TÜİK ve HGM verileri.",
  createdAt: "2026-09-04T12:00:00.000Z",
  updatedAt: "2026-09-04T12:00:00.000Z",
  provinces: [
    {
      plateCode: "34",
      nameTr: "İstanbul",
      slugTr: "istanbul",
      population: 15750000,
      areaKm2: 5461,
      climateNameTr: "Marmara geçiş iklimi",
      climateKoppen: "Csa",
    },
  ],
  comparisonTable: [
    {
      nameTr: "Marmara",
      slug: "marmara",
      provinceCount: 11,
      population: 26711525,
      populationSharePercent: 31.03,
      areaKm2: 72666,
      populationDensity: 368,
    },
  ],
  faqs: [
    {
      question: "Marmara Bölgesi kaç ilden oluşur?",
      answer: "Marmara Bölgesi 11 ilden oluşur.",
    },
  ],
};

function ok(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function notOk(status: number): Response {
  return new Response("upstream failure", { status });
}

describe("lib/api/regions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getRegions", () => {
    it("returns list of regions from /api/regions", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ok([MOCK_REGION_LIST_ITEM])),
      );
      const regions = await getRegions();
      expect(regions).toHaveLength(1);
      expect(regions[0]!.slug).toBe("marmara");
      expect(regions[0]!.provinceCount).toBe(11);
    });

    it("re-throws upstream errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => notOk(500)),
      );
      await expect(getRegions()).rejects.toThrow();
    });
  });

  describe("getRegionBySlug", () => {
    it("returns region detail for valid slug", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ok(MOCK_REGION_DETAIL)),
      );
      const detail = await getRegionBySlug("marmara");
      expect(detail).not.toBeNull();
      expect(detail?.slug).toBe("marmara");
      expect(detail?.provinces).toHaveLength(1);
      expect(detail?.faqs).toHaveLength(1);
    });

    it("returns null on 404 so caller can invoke notFound()", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => notOk(404)),
      );
      const detail = await getRegionBySlug("bilinmeyen-bolge");
      expect(detail).toBeNull();
    });

    it("re-throws non-404 upstream errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => notOk(502)),
      );
      await expect(getRegionBySlug("marmara")).rejects.toThrow();
    });
  });

  describe("getRegionsResilient", () => {
    it("returns empty array and logs warning when API fails during build", async () => {
      vi.mocked(isProductionBuild).mockReturnValue(true);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => notOk(500)),
      );

      const result = await getRegionsResilient();
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("re-throws at runtime when API fails", async () => {
      vi.mocked(isProductionBuild).mockReturnValue(false);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => notOk(500)),
      );

      await expect(getRegionsResilient()).rejects.toThrow();
    });
  });
});
