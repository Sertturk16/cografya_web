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

  /**
   * HONEST FINDING (PR #45 review TA45-I1). The previous version of this block claimed to be
   * "the discriminating case" for the `"tr"` argument in `toLocaleLowerCase`. It was not:
   * brute-forcing every code point 0x0000–0x2000 through the FULL pipeline produces identical
   * output with `"tr"` and with `"en"`, because the explicit `ı→i` remap and the NFD
   * mark-strip converge exactly the two inputs where the casing rules differ. Dropping the
   * locale argument would not have failed a single test.
   *
   * So the claim is retired rather than restated. What IS asserted below is the true, useful
   * pair: the locale genuinely matters at the PRE-FOLD layer, and the fold deliberately
   * erases that difference downstream. Both halves are real invariants; neither pretends to
   * guard something it cannot.
   */
  it("uses Turkish casing at the pre-fold layer, where the rules really do diverge", () => {
    // Exactly two code points behave differently, and these are they.
    expect("I".toLocaleLowerCase("tr")).toBe("ı");
    expect("I".toLocaleLowerCase("en")).toBe("i");
    expect("İ".toLocaleLowerCase("tr")).toBe("i");
    expect("İ".toLocaleLowerCase("en")).toBe("i̇"); // i + combining dot above
  });

  it("converges every dotted/dotless i form on the same output — by design, not by locale", () => {
    // The downstream guarantee. It holds BECAUSE of the ı→i remap and the mark-strip, which
    // is why the pipeline's output is locale-independent even though its first step is not.
    const forms = ["I", "İ", "ı", "i"];
    expect(new Set(forms.map(foldForSearch)).size).toBe(1);
    expect(foldForSearch("I")).toBe("i");
  });
});
