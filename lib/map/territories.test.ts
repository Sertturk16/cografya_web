import { describe, expect, it } from "vitest";
import { TERRITORIES, territoryFor } from "./territories";
import { COUNTRY_SHAPES } from "./world-countries.generated";

/**
 * Structural invariants for the `/dunya` territory hover-card data. These assert SHAPE, not
 * facts: whether Grönland's population is 56.542 is a content question settled by the
 * independent fact-check and the owner's approval, not by a test file — hard-coding figures
 * here would only pin today's copy of them in a second place. What a test CAN own is the set
 * of rules a future edit could silently break.
 */
describe("territory card data", () => {
  const shapeIsos = new Set(COUNTRY_SHAPES.map((shape) => shape.iso));

  it("covers the 43 non-country shapes the brief scoped", () => {
    expect(TERRITORIES).toHaveLength(43);
  });

  it("joins to a real map shape for every entry", () => {
    const orphans = TERRITORIES.filter((t) => !shapeIsos.has(t.iso)).map((t) => t.iso);
    expect(orphans).toEqual([]);
  });

  it("has no duplicate shape keys", () => {
    const isos = TERRITORIES.map((t) => t.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it("never claims Türkiye", () => {
    // The TR shape is hand-wired to the `/turkiye` hub and `/dunya/turkiye` must never exist
    // (IA → DEC 2026-07-13 / 2026-07-26 K1). A territory entry for TR would put a card on
    // top of that link.
    expect(territoryFor("TR")).toBeUndefined();
  });

  it("keeps every status sentence within the 90-character card cap", () => {
    // CONTENT-STYLE §22: card description = 1 sentence / 90 characters. The source brief was
    // brought under this cap in its correction round; this pins it against a later edit.
    const overCap = TERRITORIES.filter((t) => t.statusTr.length > 90).map(
      (t) => `${t.iso}:${t.statusTr.length}`,
    );
    expect(overCap).toEqual([]);
  });

  it("has a non-empty name in both locales and a non-empty status", () => {
    for (const territory of TERRITORIES) {
      expect(territory.nameTr.length, territory.iso).toBeGreaterThan(0);
      expect(territory.nameEn.length, territory.iso).toBeGreaterThan(0);
      expect(territory.statusTr.length, territory.iso).toBeGreaterThan(0);
    }
  });

  it("uses uppercase ISO alpha-2 badges only, and only where a code exists", () => {
    for (const territory of TERRITORIES) {
      if (territory.badge === undefined) {
        // The two Natural Earth entities with no ISO at all carry the generator's
        // synthetic key and must NOT be given an invented code.
        expect(territory.iso.startsWith("x-"), territory.iso).toBe(true);
        continue;
      }
      expect(territory.badge, territory.iso).toMatch(/^[A-Z]{2}$/);
      expect(territory.badge, territory.iso).toBe(territory.iso);
    }
  });

  it("orders every range figure low-to-high and keeps figures finite", () => {
    for (const territory of TERRITORIES) {
      for (const figure of [territory.population, territory.areaKm2]) {
        if (figure.kind === "range") {
          expect(figure.min, territory.iso).toBeLessThan(figure.max);
          expect(figure.min, territory.iso).toBeGreaterThan(0);
        }
        if (figure.kind === "exact") {
          expect(Number.isFinite(figure.value), territory.iso).toBe(true);
          expect(figure.value, territory.iso).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never marks an AREA as 'none'", () => {
    // `none` renders as the "no permanent population" wording, which is meaningless for an
    // area. An area that cannot be published is `unknown` (row omitted).
    const wrong = TERRITORIES.filter((t) => t.areaKm2.kind === "none").map((t) => t.iso);
    expect(wrong).toEqual([]);
  });

  it("shows no population row for the six contested entities", () => {
    // Their figures each need a caveat a 258px card cannot carry and none was owner-ruled
    // (→ DEC 2026-08-01 / 2026-08-01b ruled the SENTENCES only).
    const contested = ["EH", "x-somaliland", "x-siachen-glacier", "FK", "GS", "IO"];
    for (const iso of contested) {
      const territory = territoryFor(iso);
      expect(territory, iso).toBeDefined();
      expect(territory?.population.kind, iso).toBe("unknown");
      expect(territory?.centre, iso).toBeUndefined();
    }
  });

  it("resolves a known key and rejects an unknown one", () => {
    expect(territoryFor("GL")?.nameTr).toBe("Grönland");
    expect(territoryFor("ZZ")).toBeUndefined();
  });
});
