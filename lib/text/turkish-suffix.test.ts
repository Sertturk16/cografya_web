import { describe, expect, it } from "vitest";
import { turkishGenitive, turkishLocative } from "./turkish-suffix";

/**
 * The suffix helper is a PURE grammar function: for a proper noun the correct suffixed
 * form IS its contract, so asserting the known-correct output for representative names is
 * a structure/invariant test (not a fact-check). Cases cover every harmony class, vowel-
 * vs consonant-final stems, voiceless finals (locative t vs d), the dotted/dotless İ-I
 * split, the special letters ğ/ş, and the -eli possessive-compound locative buffer
 * (Kocaeli'nde) — i.e. the axes that would regress silently and corrupt every §19 heading
 * on the corresponding province pages. Representative-per-class by design: every STRUCTURAL
 * class has a case here, which is the actual protection — an 81-row table would add
 * maintenance for no extra coverage.
 */
describe("turkishGenitive", () => {
  it("matches the task's named examples", () => {
    expect(turkishGenitive("Antalya")).toBe("Antalya'nın");
    expect(turkishGenitive("İzmir")).toBe("İzmir'in");
    expect(turkishGenitive("Muş")).toBe("Muş'un");
  });

  it("applies 4-way vowel harmony on the last vowel", () => {
    expect(turkishGenitive("Van")).toBe("Van'ın"); // a → ı
    expect(turkishGenitive("Kilis")).toBe("Kilis'in"); // i → i
    expect(turkishGenitive("Bolu")).toBe("Bolu'nun"); // u → u (vowel-final → buffer)
    expect(turkishGenitive("Bingöl")).toBe("Bingöl'ün"); // ö → ü
  });

  it("inserts the buffer -n- after a vowel-final stem", () => {
    expect(turkishGenitive("Konya")).toBe("Konya'nın");
    expect(turkishGenitive("Rize")).toBe("Rize'nin");
    expect(turkishGenitive("Çankırı")).toBe("Çankırı'nın");
    expect(turkishGenitive("Muğla")).toBe("Muğla'nın");
  });

  it("does NOT mutate a final consonant (proper-noun rule)", () => {
    expect(turkishGenitive("Sinop")).toBe("Sinop'un"); // not Sinob-
    expect(turkishGenitive("Zonguldak")).toBe("Zonguldak'ın"); // not Zonguldağ-
    expect(turkishGenitive("Tekirdağ")).toBe("Tekirdağ'ın");
    expect(turkishGenitive("Erzurum")).toBe("Erzurum'un");
    expect(turkishGenitive("İstanbul")).toBe("İstanbul'un");
  });

  it("handles the dotless-I initial (Iğdır) via last-vowel harmony", () => {
    expect(turkishGenitive("Iğdır")).toBe("Iğdır'ın"); // last vowel ı → ı, consonant-final
  });

  it("suffixes the -eli possessive compounds via the generic vowel-final buffer", () => {
    // Genitive was already correct for these (vowel-final → -n- buffer); pinned as a
    // regression guard alongside the locative -eli fix.
    expect(turkishGenitive("Kocaeli")).toBe("Kocaeli'nin");
    expect(turkishGenitive("Kırklareli")).toBe("Kırklareli'nin");
    expect(turkishGenitive("Tunceli")).toBe("Tunceli'nin");
  });
});

describe("turkishLocative", () => {
  it("picks d/t by final-consonant voicing", () => {
    expect(turkishLocative("Antalya")).toBe("Antalya'da"); // vowel-final → d
    expect(turkishLocative("Van")).toBe("Van'da"); // voiced n → d
    expect(turkishLocative("Muş")).toBe("Muş'ta"); // voiceless ş → t
    expect(turkishLocative("Sinop")).toBe("Sinop'ta"); // voiceless p → t
    expect(turkishLocative("Uşak")).toBe("Uşak'ta"); // voiceless k → t
  });

  it("applies 2-way (back/front) harmony on the last vowel", () => {
    expect(turkishLocative("İzmir")).toBe("İzmir'de"); // front i → e
    expect(turkishLocative("Rize")).toBe("Rize'de"); // front e → e
    expect(turkishLocative("Gaziantep")).toBe("Gaziantep'te"); // front e, voiceless p
    expect(turkishLocative("Konya")).toBe("Konya'da"); // back a → a
    expect(turkishLocative("Erzurum")).toBe("Erzurum'da"); // back u → a
    expect(turkishLocative("Bingöl")).toBe("Bingöl'de"); // front ö → e
  });

  it("handles ğ- and vowel-final stems as voiced (→ d)", () => {
    expect(turkishLocative("Tekirdağ")).toBe("Tekirdağ'da");
    expect(turkishLocative("Elazığ")).toBe("Elazığ'da");
    expect(turkishLocative("Ağrı")).toBe("Ağrı'da");
  });

  it("handles the dotless-I initial (Iğdır) via 2-way harmony", () => {
    expect(turkishLocative("Iğdır")).toBe("Iğdır'da"); // last vowel ı → back a, voiced r → d
  });

  it("inserts the pronominal -n- buffer for the -eli possessive compounds (I1)", () => {
    // TDK: 3rd-person-possessive compounds take the buffer in the locative — "Kocaeli'nde",
    // NOT "Kocaeli'de". The buffer is voiced so the suffix consonant is d, vowel is e
    // (front i). All three of the current 81's -eli provinces:
    expect(turkishLocative("Kocaeli")).toBe("Kocaeli'nde");
    expect(turkishLocative("Kırklareli")).toBe("Kırklareli'nde");
    expect(turkishLocative("Tunceli")).toBe("Tunceli'nde");
  });

  it("does NOT apply the -eli buffer to -li derivationals (Denizli class)", () => {
    // Guards the /eli$/ exception from over-reaching: Denizli is a -li derivational, not a
    // possessive compound, so it keeps the plain locative.
    expect(turkishLocative("Denizli")).toBe("Denizli'de");
  });
});
