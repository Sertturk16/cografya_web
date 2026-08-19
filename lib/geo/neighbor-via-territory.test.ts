import { describe, expect, it } from "vitest";
import { NEIGHBOR_VIA_TERRITORY, neighborViaTerritory } from "./neighbor-via-territory";

/**
 * Structure and invariants only — never the geography facts themselves, which are the seed's
 * and the provenance ledger's job. What is guarded here is that the label mechanism cannot
 * silently widen, narrow, or leak into a locale it was not written for.
 */
describe("neighborViaTerritory — the ruled pairs", () => {
  it("names French Guiana on both of its forward pairs", () => {
    expect(neighborViaTerritory("BR", "FR", "tr")).toEqual({
      key: "neighborVia",
      territory: "Fransız Guyanası",
    });
    expect(neighborViaTerritory("SR", "FR", "tr")?.territory).toBe("Fransız Guyanası");
    expect(neighborViaTerritory("BR", "FR", "en")?.territory).toBe("French Guiana");
  });

  it("names Kaliningrad on both of its forward pairs", () => {
    // The family a continent-mismatch sweep misses: both ends are in Europe.
    expect(neighborViaTerritory("LT", "RU", "tr")?.territory).toBe("Kaliningrad");
    expect(neighborViaTerritory("PL", "RU", "tr")?.territory).toBe("Kaliningrad");
  });

  it("names Nakhchivan on the Türkiye card (the ruling's own third family)", () => {
    // DEC 2026-07-13 enumerates France/French Guiana, Russia/Kaliningrad AND
    // Azerbaijan/Nakhchivan. Deriving the set from the api seed docblock's two "e.g."
    // examples dropped this one; it shipped and was caught in review (SOV72-I1 / CR72-I1).
    // Both ends are in Asia, so a continent-mismatch sweep misses it exactly as it misses
    // Kaliningrad.
    expect(neighborViaTerritory("TR", "AZ", "tr")?.territory).toBe("Nahçıvan");
    expect(neighborViaTerritory("TR", "AZ", "en")?.territory).toBe("Nakhchivan");
    // AM and IR also border mainland Azerbaijan, so they take no entry.
    expect(neighborViaTerritory("AM", "AZ", "tr")).toBeNull();
    expect(neighborViaTerritory("IR", "AZ", "tr")).toBeNull();
  });

  it("names Cabinda on the Congo-Republic card", () => {
    // The whole CG↔AO border is Cabinda's — the Angolan mainland is cut off by the DR Congo
    // corridor. Verified in the base-data source of record (africa.md:458/:526), which is also
    // the fifth family the module's since-deleted "measured count" twice failed to include.
    // Both locales carry the same spelling: the name is not translated, and the TR form is
    // the one the base-data record already prints (→ AK-29a, which corrected an initial
    // `Kabinda` that no project source used).
    expect(neighborViaTerritory("CG", "AO", "tr")?.territory).toBe("Cabinda");
    expect(neighborViaTerritory("CG", "AO", "en")?.territory).toBe("Cabinda");
    // IDENTIFY form by ruling (→ AK-29a): no state claims Cabinda, so the mechanism wording
    // would imply a dispute that does not exist.
    expect(neighborViaTerritory("CG", "AO", "tr")?.key).toBe("neighborVia");
    // Angola's other neighbours reach it across the mainland and take no entry.
    expect(neighborViaTerritory("CD", "AO", "tr")).toBeNull();
    expect(neighborViaTerritory("ZM", "AO", "tr")).toBeNull();
    expect(neighborViaTerritory("NA", "AO", "tr")).toBeNull();
  });

  it("uses the MECHANISM wording for the one contested pair, and only it", () => {
    // → DEC 2026-08-19k (owner-ruled). On Morocco's own page the identifying form
    // "İspanya (Ceuta ve Melilla)" reads as an attribution of two cities Morocco claims;
    // the "through" form states where the border runs and attributes nothing. This is the
    // precedent form for any future contested pair, which is why the wording is pinned per
    // pair here rather than left to the renderer.
    expect(neighborViaTerritory("MA", "ES", "tr")).toEqual({
      key: "neighborViaThrough",
      territory: "Ceuta ve Melilla",
    });
    expect(neighborViaTerritory("MA", "ES", "en")).toEqual({
      key: "neighborViaThrough",
      territory: "Ceuta and Melilla",
    });
    // Every other pair keeps the identifying form — a new entry cannot silently inherit
    // "through", and an existing one cannot silently lose it.
    for (const [host, neighbor] of [
      ["BR", "FR"],
      ["SR", "FR"],
      ["LT", "RU"],
      ["PL", "RU"],
      ["TR", "AZ"],
      ["CG", "AO"],
    ] as const) {
      expect(neighborViaTerritory(host, neighbor, "tr")?.key).toBe("neighborVia");
    }
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
    expect(neighborViaTerritory("AZ", "TR", "tr")).toBeNull();
  });

  it("carries exactly the pairs the ruling's method yields, and no unannounced extra", () => {
    // NO FAMILY COUNT IS ASSERTED HERE, and its absence is the point (→ SOV72R2-I1). The
    // module claimed "three families", then "four", and both were false at the very commit
    // they cited — the first missed Nakhchivan, the second missed Cabinda. A count reads as a
    // verified fact and rots the moment the corpus grows.
    //
    // What is pinned instead is the ENUMERATION, so a new entry is a deliberate edit here
    // rather than something a number can be nudged to cover. This list is the derivation's
    // OUTPUT, last re-run 2026-08-19 against cografya_api dev @ ba4ce94 by the method the
    // module docblock records: a content sweep for exclave-mediated borders — never a
    // continent mismatch (misses Kaliningrad and TR→AZ), never a name the family is merely
    // expected to carry.
    const pairs = Object.entries(NEIGHBOR_VIA_TERRITORY).flatMap(([host, byNeighbor]) =>
      Object.keys(byNeighbor).map((neighbor) => `${host}->${neighbor}`),
    );
    expect(pairs.sort()).toEqual([
      "BR->FR", // French Guiana
      "CG->AO", // Cabinda
      "LT->RU", // Kaliningrad
      "MA->ES", // Ceuta and Melilla
      "PL->RU", // Kaliningrad
      "SR->FR", // French Guiana
      "TR->AZ", // Nakhchivan
    ]);
  });

  it("keys are ISO 3166-1 alpha-2 in shape, derived from the table not restated", () => {
    // → TA72-M2. The exact-set test above catches an UNANNOUNCED entry but not a malformed
    // one: whoever adds `Sr: { FR: … }` updates both sides with the same typo, tsc accepts
    // any string, and the entry simply never fires because `country.isoCode` is upper-case.
    for (const [host, byNeighbor] of Object.entries(NEIGHBOR_VIA_TERRITORY)) {
      expect(host).toMatch(/^[A-Z]{2}$/);
      for (const neighbor of Object.keys(byNeighbor)) {
        expect(neighbor).toMatch(/^[A-Z]{2}$/);
      }
    }
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
    // Inherited Object.prototype keys must not resolve as data. THREE distinct shapes, not
    // one (→ TA72-M1): `constructor` reaches a FUNCTION, `__proto__` reaches
    // `Object.prototype` (a plain object — the shape a mis-seeded ISO string most plausibly
    // carries), and `toString` reaches a function from the inner map. A refactor to
    // `if (hostIso in NEIGHBOR_VIA_TERRITORY)` looks like an equivalent tidy-up and walks
    // the chain identically; covering only `constructor` would not distinguish the two.
    for (const key of ["constructor", "__proto__", "toString", "valueOf"]) {
      expect(neighborViaTerritory(key, "FR", "tr")).toBeNull();
      expect(neighborViaTerritory("BR", key, "tr")).toBeNull();
    }
  });
});
