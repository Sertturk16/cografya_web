import { describe, it, expect } from "vitest";
import {
  getAllContinents,
  getContinentBySlug,
  continentKeyToSlug,
  CONTINENT_KEY_TO_SLUG,
  CONTINENT_SLUG_TO_KEY,
  CONTINENTS_REGISTRY,
} from "./continents";
import type { Continent } from "@/lib/api/types";

describe("Continents Data Module", () => {
  it("registers exactly 7 continents matching the canonical MEB model", () => {
    const continents = getAllContinents();
    expect(continents).toHaveLength(7);

    const ids = continents.map((c) => c.id).sort();
    const expectedIds: Continent[] = (
      [
        "AFRIKA",
        "ANTARKTIKA",
        "ASYA",
        "AVRUPA",
        "GUNEY_AMERIKA",
        "KUZEY_AMERIKA",
        "OKYANUSYA",
      ] as Continent[]
    ).sort();

    expect(ids).toEqual(expectedIds);
  });

  it("resolves continent by Turkish and English slugs", () => {
    const africaTr = getContinentBySlug("afrika");
    const africaEn = getContinentBySlug("africa");
    expect(africaTr).not.toBeNull();
    expect(africaEn).not.toBeNull();
    expect(africaTr?.id).toBe("AFRIKA");
    expect(africaEn?.id).toBe("AFRIKA");

    const saTr = getContinentBySlug("guney-amerika");
    const saEn = getContinentBySlug("south-america");
    expect(saTr).not.toBeNull();
    expect(saEn).not.toBeNull();
    expect(saTr?.id).toBe("GUNEY_AMERIKA");
    expect(saEn?.id).toBe("GUNEY_AMERIKA");

    const antarctica = getContinentBySlug("antarktika");
    expect(antarctica?.id).toBe("ANTARKTIKA");
    expect(antarctica?.countryCount).toBe(0);
  });

  it("returns null for unknown continent slug", () => {
    expect(getContinentBySlug("bilinmeyen-kita")).toBeNull();
    expect(getContinentBySlug("")).toBeNull();
  });

  it("verifies required factual and prose properties on all 7 continents", () => {
    for (const c of Object.values(CONTINENTS_REGISTRY)) {
      expect(c.nameTr.length).toBeGreaterThan(0);
      expect(c.nameEn.length).toBeGreaterThan(0);
      expect(c.slugTr.length).toBeGreaterThan(0);
      expect(c.slugEn.length).toBeGreaterThan(0);
      expect(c.areaKm2).toBeGreaterThan(5000000);
      expect(c.highestPoint.name.length).toBeGreaterThan(0);
      expect(c.highestPoint.elevationM).toBeGreaterThan(2000);
      expect(c.lowestPoint.name.length).toBeGreaterThan(0);
      expect(c.longestRiver.name.length).toBeGreaterThan(0);
      expect(c.keyCharacteristicsTr.length).toBeGreaterThanOrEqual(3);

      // Prose sections must be rich and non-empty
      expect(c.prose.introTr.length).toBeGreaterThan(50);
      expect(c.prose.locationAndBordersTr.length).toBeGreaterThan(50);
      expect(c.prose.landformsAndGeologyTr.length).toBeGreaterThan(50);
      expect(c.prose.climateAndVegetationTr.length).toBeGreaterThan(50);
      expect(c.prose.hydrographyTr.length).toBeGreaterThan(50);
      expect(c.prose.populationAndSettlementTr.length).toBeGreaterThan(50);
      expect(c.prose.economyAndResourcesTr.length).toBeGreaterThan(50);
      expect(c.prose.historicalAndCulturalTr.length).toBeGreaterThan(50);
      expect(c.prose.disasterAndEnvironmentTr.length).toBeGreaterThan(50);

      // FAQs
      expect(c.faqs.length).toBeGreaterThanOrEqual(4);
      for (const faq of c.faqs) {
        expect(faq.question.length).toBeGreaterThan(10);
        expect(faq.answer.length).toBeGreaterThan(20);
      }
    }
  });

  it("correctly maps continent keys to slugs", () => {
    expect(continentKeyToSlug("AFRIKA")).toBe("afrika");
    expect(continentKeyToSlug("AFRIKA", "en")).toBe("africa");
    expect(continentKeyToSlug("ASYA")).toBe("asya");
    expect(continentKeyToSlug("KUZEY_AMERIKA")).toBe("kuzey-amerika");
    expect(continentKeyToSlug("GUNEY_AMERIKA")).toBe("guney-amerika");
    expect(CONTINENT_KEY_TO_SLUG["AVRUPA"]).toBe("avrupa");
    expect(CONTINENT_SLUG_TO_KEY["avrupa"]).toBe("AVRUPA");
    expect(CONTINENTS_REGISTRY.afrika?.nameTr).toBe("Afrika");
  });
});
