import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { showsSubregionCard } from "./subregion";

/**
 * The Kıta/Bölge duplicate-card suppression (UX tour B28) and — the part that actually needed
 * a guard — the CROSS-VOCABULARY COUPLING it rests on (→ PR #47 review CR-M1).
 *
 * Structural only (`CONVENTIONS.md` §2): nothing here asserts which continent a country is in.
 */

describe("showsSubregionCard", () => {
  it("hides the card when the subregion repeats the continent", () => {
    expect(showsSubregionCard("Güney Amerika", "Güney Amerika")).toBe(false);
  });

  it("shows the card whenever the two genuinely differ", () => {
    expect(showsSubregionCard("Afrika", "Orta Afrika")).toBe(true);
    expect(showsSubregionCard("Asya", "Doğu Asya")).toBe(true);
  });

  it("hides the card when the api publishes no subregion at all", () => {
    expect(showsSubregionCard("Avrupa", null)).toBe(false);
  });

  it("does NOT fold case, whitespace or diacritics", () => {
    // Deliberate: these pairs are not known to be the same place, and suppressing a card on a
    // fuzzy match would hide a fact. Documented as intent so nobody "fixes" it into a
    // normalizing comparison.
    expect(showsSubregionCard("Güney Amerika", "güney amerika")).toBe(true);
    expect(showsSubregionCard("Güney Amerika", "Güney Amerika ")).toBe(true);
    expect(showsSubregionCard("Güney Amerika", "Guney Amerika")).toBe(true);
  });
});

describe("the catalogue coupling the suppression depends on", () => {
  /**
   * The comparison is `Continents.<KEY>` (message catalogue) against the api's
   * `unSubregionTr` (M49). It can only work while both spell the shared names identically,
   * and NOTHING in the type system sees that: a well-meaning catalogue edit — "Güney Amerika"
   * → "Güney Amerika kıtası" — would silently bring the duplicate card back on every affected
   * country page, with CI green.
   *
   * These are the continent names that ALSO appear as M49 subregion names, i.e. the only ones
   * where the two vocabularies actually meet. Pinning their exact bytes is the cheapest thing
   * that turns that silent regression into a failing test. This is the same reasoning as the
   * licence-notice byte pins (`lib/climate/attribution-notice.test.ts`): the string is pinned
   * because behaviour depends on its exact bytes, not because copy is being frozen.
   *
   * If one of these genuinely has to be renamed, the fix is to rename it in BOTH vocabularies
   * (an api change routed through Atlas) and update this list in the same pass.
   */
  const SHARED_WITH_M49_SUBREGIONS = {
    KUZEY_AMERIKA: "Kuzey Amerika",
    GUNEY_AMERIKA: "Güney Amerika",
  } as const;

  const catalogue = trMessages.Continents as Record<string, string>;

  it.each(Object.entries(SHARED_WITH_M49_SUBREGIONS))(
    "Continents.%s still reads exactly %s",
    (key, expected) => {
      expect(catalogue[key]).toBe(expected);
    },
  );

  it("suppresses the card for each pinned name, which is the behaviour under guard", () => {
    for (const value of Object.values(SHARED_WITH_M49_SUBREGIONS)) {
      expect(showsSubregionCard(value, value)).toBe(false);
    }
  });
});
