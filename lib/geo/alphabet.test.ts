import { describe, expect, it } from "vitest";
import { bucketByInitial, flattenBuckets } from "./alphabet";

/**
 * Structural invariants of the hub index's alphabetical bucketing (CONVENTIONS §2 — no
 * real province/country facts: every fixture name below is an invented nonsense word
 * chosen only to exercise a letter, never an assertion about a real place).
 *
 * The suite has two jobs. The first is the ordinary contract (order, grouping, ids,
 * purity). The second is an **ICU sanity floor**: `Intl.Collator("tr")` silently degrades
 * to a code-unit-ish ordering on a runtime built without full ICU, which would mis-sort
 * the whole list while every page still rendered and every other test still passed. These
 * assertions turn that into a red CI job instead of a wrong page.
 */

interface Row {
  readonly label: string;
}

const row = (label: string): Row => ({ label });
const labelOf = (r: Row) => r.label;

/** One invented word per Turkish letter that can begin one, plus its ASCII neighbour. */
const TR_FIXTURE = [
  "Avlak",
  "Bavlak",
  "Cavlak",
  "Çavlak",
  "Davlak",
  "Gavlak",
  "Ğavlak",
  "Havlak",
  "Ivlak",
  "İvlak",
  "Ovlak",
  "Övlak",
  "Savlak",
  "Şavlak",
  "Tavlak",
  "Uvlak",
  "Üvlak",
  "Vavlak",
].map(row);

/** Turkish alphabet order for the fixture's initials. */
const TR_EXPECTED_LETTERS = [
  "A",
  "B",
  "C",
  "Ç",
  "D",
  "G",
  "Ğ",
  "H",
  "I",
  "İ",
  "O",
  "Ö",
  "S",
  "Ş",
  "T",
  "U",
  "Ü",
  "V",
];

describe("ICU sanity floor — Intl.Collator('tr') must be a real Turkish collator", () => {
  const tr = new Intl.Collator("tr");

  /**
   * Every assertion here must DISCRIMINATE Turkish from a generic/root collator, or it
   * guards nothing (PR #44 review TA-1). The original suite spent five cases on
   * `ac < aç < ad`-shaped orderings, which is exactly the shape that does NOT discriminate:
   * root collation sorts accented letters straight after their base letter too, so all five
   * passed identically under `"und"` and `"en"` while claiming to prove Turkish support.
   * What follows is the subset that genuinely fails on a degraded or wrong collator.
   */
  it("sorts dotless ı before dotted i — and root collation does the OPPOSITE", () => {
    expect(tr.compare("ı", "i")).toBeLessThan(0);
    // The inequality probe is the actual guard: if ICU is missing or the locale silently
    // falls back to root, this second expectation starts matching the first and fails.
    expect(new Intl.Collator("und").compare("ı", "i")).toBeGreaterThan(0);
  });

  it("uppercases i to İ and ı to I under Turkish casing rules", () => {
    expect("i".toLocaleUpperCase("tr")).toBe("İ");
    expect("ı".toLocaleUpperCase("tr")).toBe("I");
    // Same probe on the casing half: English casing must NOT produce the dotted capital.
    expect("i".toLocaleUpperCase("en")).toBe("I");
  });

  /**
   * The exact property `bucketByInitial`'s base-strength merge relies on, pinned rather
   * than left implicit: at PRIMARY strength Turkish keeps each of these as its own letter
   * (so they must stay separate buckets), while English treats them as accent variants of
   * their base letter (so they must merge into one).
   */
  const TR_PRIMARY_LETTERS = ["ç", "ğ", "ı", "ö", "ş", "ü"] as const;
  const baseOf = (letter: string) => letter.normalize("NFD")[0] ?? letter;

  it.each(TR_PRIMARY_LETTERS)("treats %s as its own letter in Turkish", (letter) => {
    const trBase = new Intl.Collator("tr", { sensitivity: "base" });
    // `ı` does not decompose, so its base-letter partner is `i` by definition, not by NFD.
    const partner = letter === "ı" ? "i" : baseOf(letter);
    expect(trBase.compare(partner, letter)).not.toBe(0);
  });

  // `ı` is deliberately ABSENT: unlike the accented five, dotless i is a primary difference
  // in English/root collation too, so it legitimately keeps its own bucket in every locale.
  // Asserting a merge for it would pin a falsehood.
  it.each(["ç", "ğ", "ö", "ş", "ü"])("treats %s as an accent variant in English", (letter) => {
    const enBase = new Intl.Collator("en", { sensitivity: "base" });
    expect(enBase.compare(baseOf(letter), letter)).toBe(0);
  });
});

describe("bucketByInitial", () => {
  it("returns buckets in Turkish collation order", () => {
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    expect(buckets.map((b) => b.letter)).toEqual(TR_EXPECTED_LETTERS);
  });

  it("keeps consecutive bucket letters strictly ascending under the collator", () => {
    const collator = new Intl.Collator("tr");
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    for (let i = 1; i < buckets.length; i += 1) {
      const previous = buckets[i - 1];
      const current = buckets[i];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(collator.compare(previous?.letter ?? "", current?.letter ?? "")).toBeLessThan(0);
    }
  });

  it("places every item in exactly one bucket and loses none", () => {
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    const flattened = buckets.flatMap((b) => b.items.map(labelOf));
    expect(flattened).toHaveLength(TR_FIXTURE.length);
    expect(new Set(flattened).size).toBe(TR_FIXTURE.length);
    expect([...flattened].sort()).toEqual([...TR_FIXTURE.map(labelOf)].sort());
  });

  it("never emits the same letter in two buckets", () => {
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    const letters = buckets.map((b) => b.letter);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("gives I and İ separate buckets (they are separate Turkish letters)", () => {
    const buckets = bucketByInitial([row("İvlak"), row("Ivlak")], labelOf, "tr", "x");
    expect(buckets.map((b) => b.letter)).toEqual(["I", "İ"]);
    expect(buckets.map((b) => b.items.map(labelOf))).toEqual([["Ivlak"], ["İvlak"]]);
  });

  it("emits unique ids even where the letters fold to the same ASCII character", () => {
    // The I/İ pair is exactly the case a folded-letter id would collide on (§B4 folds
    // both to `i`), which is why ids are positional.
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    const ids = buckets.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("x-"))).toBe(true);
  });

  it("sorts items inside a bucket by the collator too", () => {
    const items = [row("Ağva"), row("Adva"), row("Ahva")];
    const buckets = bucketByInitial(items, labelOf, "tr", "x");
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.items.map(labelOf)).toEqual(["Adva", "Ağva", "Ahva"]);
  });

  it("merges an accent-variant initial into one bucket under English collation", () => {
    // PR #44 review CR-I1, pinned with the reviewer's own shape: `Intl.Collator("en")`
    // sorts "Åland" INTO the A-run, but `toLocaleUpperCase("en")` still yields "Å". Raw
    // `letter === letter` merging therefore produced [A][Å][A…] — one letter split across
    // two non-adjacent buckets, valid DOM and no failing test.
    const items = ["Afghanistan", "Albania", "Åland", "Algeria"].map(row);
    const buckets = bucketByInitial(items, labelOf, "en", "x");
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.items.map(labelOf)).toEqual(["Afghanistan", "Åland", "Albania", "Algeria"]);
  });

  it("never emits the same letter twice under English collation either", () => {
    const items = ["Afghanistan", "Albania", "Åland", "Algeria", "Ćuprija", "Cuba", "Denmark"].map(
      row,
    );
    const buckets = bucketByInitial(items, labelOf, "en", "x");
    const sameLetter = new Intl.Collator("en", { sensitivity: "base" });
    for (let i = 1; i < buckets.length; i += 1) {
      // Stronger than string inequality: no two buckets may be the SAME LETTER for the
      // collator, which is what "duplicate bucket" actually means in a diacritic locale.
      expect(sameLetter.compare(buckets[i - 1]?.letter ?? "", buckets[i]?.letter ?? "")).not.toBe(
        0,
      );
    }
    expect(buckets.map((b) => b.items.length).reduce((a, b) => a + b, 0)).toBe(items.length);
  });

  it("still separates every Turkish letter under the same merge rule", () => {
    // The other half of CR-I1's fix: base strength must NOT collapse Turkish primaries.
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    expect(buckets.map((b) => b.letter)).toEqual(TR_EXPECTED_LETTERS);
  });

  it("honours the collation locale rather than assuming Turkish", () => {
    // The crisp tr-vs-en discriminator: Turkish sorts EVERY C word before EVERY Ç word,
    // while English treats ç as a c variant, so "Çavlak" lands next to "Cavlak" instead.
    const items = [row("Czavlak"), row("Çavlak")];
    expect(bucketByInitial(items, labelOf, "tr", "x").map((b) => b.letter)).toEqual(["C", "Ç"]);
    expect(bucketByInitial(items, labelOf, "tr", "x").flatMap((b) => b.items.map(labelOf))).toEqual(
      ["Czavlak", "Çavlak"],
    );
    expect(bucketByInitial(items, labelOf, "en", "x").flatMap((b) => b.items.map(labelOf))).toEqual(
      ["Çavlak", "Czavlak"],
    );
    // ...and English puts BOTH in ONE bucket where Turkish keeps two. Asserted so the locale
    // difference shows up in the bucket SHAPE, not only in the item order — the gap CR-I1
    // pointed at, where this fixture silently produced the duplicate-letter shape.
    expect(bucketByInitial(items, labelOf, "en", "x")).toHaveLength(1);
  });

  it("excludes a blank name instead of emitting an empty anchor", () => {
    const buckets = bucketByInitial([row("Avlak"), row("   "), row("")], labelOf, "tr", "x");
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.items.map(labelOf)).toEqual(["Avlak"]);
  });

  it("trims surrounding whitespace before deriving the initial", () => {
    const buckets = bucketByInitial([row("  Şavlak  ")], labelOf, "tr", "x");
    expect(buckets[0]?.letter).toBe("Ş");
  });

  it("does not mutate the input array", () => {
    const items = [row("Zavlak"), row("Avlak"), row("Mavlak")];
    const snapshot = items.map(labelOf);
    bucketByInitial(items, labelOf, "tr", "x");
    expect(items.map(labelOf)).toEqual(snapshot);
  });

  it("returns no buckets for an empty input", () => {
    expect(bucketByInitial([], labelOf, "tr", "x")).toEqual([]);
  });
});

describe("flattenBuckets", () => {
  it("reproduces the rendered order exactly, so JSON-LD cannot drift from the page", () => {
    const buckets = bucketByInitial(TR_FIXTURE, labelOf, "tr", "x");
    const rendered = buckets.flatMap((b) => b.items.map(labelOf));
    expect(flattenBuckets(buckets).map(labelOf)).toEqual(rendered);
  });

  it("preserves the entry count, including entries dropped by bucketing", () => {
    const buckets = bucketByInitial([row("Avlak"), row("  "), row("Zavlak")], labelOf, "tr", "x");
    // The blank name is excluded by `bucketByInitial`, so the flattened count is the count
    // the page renders — which is exactly what the meta description interpolates (CR-M1).
    expect(flattenBuckets(buckets)).toHaveLength(2);
  });

  it("returns an empty list for no buckets", () => {
    expect(flattenBuckets([])).toEqual([]);
  });
});
