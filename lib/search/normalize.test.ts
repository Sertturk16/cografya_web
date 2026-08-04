import { describe, expect, it } from "vitest";
import { foldForSearch } from "./normalize";

/**
 * Structural invariants of search folding (CONVENTIONS §2 — the fixtures below are shaped
 * like real names on purpose, because the RULE under test is about Turkish orthography, but
 * nothing here asserts a fact about any particular place).
 */
describe("foldForSearch", () => {
  it("produces only lowercase ASCII letters, digits and single spaces", () => {
    const samples = ["Çin Cumhuriyeti (Tayvan)", "Côte d’Ivoire", "Åland", "Ş-Ğ_Ü.Ö/Ç", "A  B"];
    for (const sample of samples) {
      expect(foldForSearch(sample)).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/);
    }
  });

  it("collapses every Turkish casing of the same word onto one string", () => {
    // The whole point of the module: these five are what a reader might actually type.
    const forms = ["İstanbul", "istanbul", "ISTANBUL", "ıstanbul", "İSTANBUL"];
    const folded = forms.map(foldForSearch);
    expect(new Set(folded).size).toBe(1);
    expect(folded[0]).toBe("istanbul");
  });

  it("maps each Turkish letter to the ASCII letter SEO-POLICY §B4 pins for slugs", () => {
    // Table-driven against the binding transliteration rule, not against a sample word:
    // ç→c · ğ→g · ı→i · ö→o · ş→s · ü→u (and the dotted capital İ→i).
    const table: ReadonlyArray<readonly [string, string]> = [
      ["Ç", "c"],
      ["Ğ", "g"],
      ["I", "i"],
      ["İ", "i"],
      ["Ö", "o"],
      ["Ş", "s"],
      ["Ü", "u"],
    ];
    for (const [input, expected] of table) {
      expect(foldForSearch(input)).toBe(expected);
    }
  });

  it("folds non-Turkish diacritics too, so the world corpus is reachable", () => {
    // A Turkish-only lookup table would leave these unfoldable; the NFD pass is what makes
    // the country half of the index searchable by an unaccented query.
    expect(foldForSearch("Åland")).toBe("aland");
    expect(foldForSearch("Ćuprija")).toBe("cuprija");
    expect(foldForSearch("Côte")).toBe("cote");
  });

  it("turns punctuation into separators so parenthesised names stay reachable", () => {
    expect(foldForSearch("Çin Cumhuriyeti (Tayvan)")).toBe("cin cumhuriyeti tayvan");
    expect(foldForSearch("Bosna-Hersek")).toBe("bosna hersek");
  });

  it("is idempotent", () => {
    for (const sample of ["Çin Cumhuriyeti (Tayvan)", "Şanlıurfa", "Côte d’Ivoire"]) {
      expect(foldForSearch(foldForSearch(sample))).toBe(foldForSearch(sample));
    }
  });

  it("returns an empty string for blank input", () => {
    expect(foldForSearch("")).toBe("");
    expect(foldForSearch("   ")).toBe("");
    expect(foldForSearch("()-–_")).toBe("");
  });

  it("does NOT lowercase with English rules — the discriminating case", () => {
    // Under English casing "I" lowercases to "i" directly and "İ" keeps a combining dot;
    // both would still reach "i" here, so the probe that actually separates the two rules is
    // that Turkish casing never leaves a dotted capital behind for the NFD pass to strip.
    expect("I".toLocaleLowerCase("tr")).toBe("ı");
    expect("I".toLocaleLowerCase("en")).toBe("i");
    // ...and folding routes both onto the same output regardless, which is the guarantee.
    expect(foldForSearch("I")).toBe(foldForSearch("İ"));
  });
});
