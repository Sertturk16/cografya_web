import { describe, expect, it } from "vitest";
import { extractEarthquakeTickerData, extractMarineTickerData } from "./v2-live-ticker";

describe("v2-live-ticker telemetry extraction (CODE124-I1, TEST124-I3)", () => {
  describe("extractEarthquakeTickerData", () => {
    it("extracts placeNameTr as the primary location", () => {
      const mockItem = {
        magnitude: 4.2,
        placeNameTr: "Marmara Denizi (Silivri)",
        location: "Wrong Location Field",
        occurredAtUtc: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      };

      const result = extractEarthquakeTickerData(mockItem);
      expect(result).not.toBeNull();
      expect(result?.magnitude).toBe(4.2);
      expect(result?.location).toBe("Marmara Denizi (Silivri)");
      expect(result?.timeAgo).toBe("15 dk önce");
    });

    it("falls back to location or Türkiye when placeNameTr is missing", () => {
      const mockItem = {
        magnitude: 3.5,
        location: "Ege Denizi",
        occurredAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      };

      const result = extractEarthquakeTickerData(mockItem);
      expect(result?.location).toBe("Ege Denizi");
      expect(result?.timeAgo).toBe("2 sa önce");
    });

    it("returns null for invalid or null items", () => {
      expect(extractEarthquakeTickerData(null)).toBeNull();
      expect(extractEarthquakeTickerData(undefined)).toBeNull();
      expect(extractEarthquakeTickerData({ magnitude: undefined } as never)).toBeNull();
    });
  });

  describe("extractMarineTickerData", () => {
    it("correctly identifies Marmara and Mediterranean using seaBasin and basin fields", () => {
      const mockPoints = [
        {
          point: { seaBasin: "black_sea", nameTr: "Samsun" },
          seaSurfaceTemperature: { value: 18.2 },
          waveHeight: { value: 0.5 },
        },
        {
          point: { seaBasin: "marmara", nameTr: "Yalova" },
          seaSurfaceTemperature: { value: 21.5 },
          waveHeight: { value: 0.3 },
        },
        {
          point: { seaBasin: "mediterranean", nameTr: "Antalya" },
          seaSurfaceTemperature: { value: 27.81 },
          waveHeight: { value: 0.8 },
        },
      ];

      const result = extractMarineTickerData(mockPoints);
      expect(result.marmara).toEqual({ sst: 21.5, wave: 0.3 });
      expect(result.akdeniz).toEqual({ sst: 27.8, wave: 0.8 });
    });

    it("supports legacy turkish basin string akdeniz", () => {
      const mockPoints = [
        {
          point: { basin: "akdeniz", nameTr: "Mersin" },
          seaSurfaceTemperature: { value: 26.5 },
          waveHeight: { value: 0.4 },
        },
      ];

      const result = extractMarineTickerData(mockPoints);
      expect(result.akdeniz).toEqual({ sst: 26.5, wave: 0.4 });
    });

    it("returns nulls for empty or invalid points", () => {
      expect(extractMarineTickerData(null)).toEqual({ marmara: null, akdeniz: null });
      expect(extractMarineTickerData([])).toEqual({ marmara: null, akdeniz: null });
    });
  });
});
