import { describe, expect, it } from "vitest";
import { NEIGHBOR_VIA_TERRITORY, neighborViaTerritory } from "./neighbor-via-territory";

/**
 * Structure and invariants only — never the geography facts themselves, which are the seed's
 * and the provenance ledger's job. What is guarded here is that the label mechanism cannot
 * silently widen, narrow, or leak into a locale it was not written for.
 */
describe("neighborViaTerritory — the ruled pairs", () => {
  it("names French Guiana on both of its forward pairs", () => {
    expect(neighborViaTerritory("BR", "FR", "tr")).toBe("Fransız Guyanası");
    expect(neighborViaTerritory("SR", "FR", "tr")).toBe("Fransız Guyanası");
    expect(neighborViaTerritory("BR", "FR", "en")).toBe("French Guiana");
  });

  it("names Kaliningrad on both of its forward pairs", () => {
    // The family a continent-mismatch sweep misses: both ends are in Europe.
    expect(neighborViaTerritory("LT", "RU", "tr")).toBe("Kaliningrad");
    expect(neighborViaTerritory("PL", "RU", "tr")).toBe("Kaliningrad");
  });

  it("names Ceuta and Melilla on the Morocco card", () => {
    expect(neighborViaTerritory("MA", "ES", "tr")).toBe("Ceuta ve Melilla");
    expect(neighborViaTerritory("MA", "ES", "en")).toBe("Ceuta and Melilla");
  });

  it("returns null for an ordinary mainland border", () => {
    // The overwhelming majority of pairs; the card must render untouched.
    expect(neighborViaTerritory("BR", "AR", "tr")).toBeNull();
    expect(neighborViaTerritory("TR", "GR", "tr")).toBeNull();
    expect(neighborViaTerritory("MA", "DZ", "tr")).toBeNull();
  });

  it("is DIRECTIONAL — the reverse pairs carry no entry (recorded non-goal)", () => {
    // "Brezilya (Fransız Guyanası)" on /dunya/fransa would read as though Brazil WERE French
    // Guiana. The reverse direction is a separate item; if one is ever added, this assertion
    // is the place the decision has to be made rather than slipped in.
    expect(neighborViaTerritory("FR", "BR", "tr")).toBeNull();
    expect(neighborViaTerritory("FR", "SR", "tr")).toBeNull();
    expect(neighborViaTerritory("RU", "LT", "tr")).toBeNull();
    expect(neighborViaTerritory("RU", "PL", "tr")).toBeNull();
    expect(neighborViaTerritory("ES", "MA", "tr")).toBeNull();
  });

  it("carries exactly the five forward pairs the api's rule yields", () => {
    // The rule is the seed's own ("fully constitutionally-integrated territory", → DEC
    // 2026-07-13); a sixth entry appearing here without a ruling is what this counts.
    const pairs = Object.entries(NEIGHBOR_VIA_TERRITORY).flatMap(([host, byNeighbor]) =>
      Object.keys(byNeighbor).map((neighbor) => `${host}->${neighbor}`),
    );
    expect(pairs.sort()).toEqual(["BR->FR", "LT->RU", "MA->ES", "PL->RU", "SR->FR"]);
  });

  it("never returns an empty or whitespace-only label", () => {
    // An empty value would render "Fransa ()" — worse than the bare card it replaces.
    for (const byNeighbor of Object.values(NEIGHBOR_VIA_TERRITORY)) {
      for (const territory of Object.values(byNeighbor)) {
        expect(territory.tr.trim()).not.toBe("");
        expect(territory.en.trim()).not.toBe("");
      }
    }
  });

  it("keeps an unknown host or neighbour out of the lookup", () => {
    expect(neighborViaTerritory("XX", "FR", "tr")).toBeNull();
    expect(neighborViaTerritory("BR", "XX", "tr")).toBeNull();
    // Inherited Object.prototype keys must not resolve as data.
    expect(neighborViaTerritory("constructor", "FR", "tr")).toBeNull();
    expect(neighborViaTerritory("BR", "constructor", "tr")).toBeNull();
  });
});
