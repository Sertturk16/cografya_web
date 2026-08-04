import { describe, expect, it } from "vitest";
import { bucketByInitial } from "./alphabet";

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

  it.each([
    ["ac", "aç", "ad"],
    ["ag", "ağ", "ah"],
    ["ao", "aö", "ap"],
    ["as", "aş", "at"],
    ["au", "aü", "av"],
  ])("orders %s < %s < %s (the Turkish letter is its own letter)", (before, letter, after) => {
    expect(tr.compare(before, letter)).toBeLessThan(0);
    expect(tr.compare(letter, after)).toBeLessThan(0);
  });

  it("orders dotless ı before dotted i", () => {
    expect(tr.compare("ı", "i")).toBeLessThan(0);
  });

  it("uppercases i to İ and ı to I under Turkish casing rules", () => {
    expect("i".toLocaleUpperCase("tr")).toBe("İ");
    expect("ı".toLocaleUpperCase("tr")).toBe("I");
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
