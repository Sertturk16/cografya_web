import { describe, expect, it } from "vitest";
import { prepareSearchIndex, searchPrepared } from "./match";
import type { SearchIndexRecord } from "./types";

/**
 * Structural invariants of query ranking (CONVENTIONS §2 — synthetic entities only; the
 * names below are invented so nothing here can go stale when real content is revised).
 */
const record = (name: string, path: string, kind: "p" | "c" = "p"): SearchIndexRecord => [
  name,
  path,
  kind,
];

const OPTS = { limit: 8, collationLocale: "tr" } as const;
const search = (records: readonly SearchIndexRecord[], query: string, limit = 8) =>
  searchPrepared(prepareSearchIndex(records), query, { ...OPTS, limit }).map((h) => h.name);

describe("prepareSearchIndex", () => {
  it("derives the folded slug from the path's final segment", () => {
    const [entry] = prepareSearchIndex([record("Şavlak Ova", "/turkiye/savlak-ova")]);
    expect(entry?.foldedName).toBe("savlak ova");
    expect(entry?.foldedSlug).toBe("savlak ova");
  });

  it("keeps a slug that genuinely differs from the name as a second key", () => {
    // The shape of the one real divergence: an editorial slug shorter than the display name.
    const [entry] = prepareSearchIndex([record("Uzun Adlı Yer (Kısa)", "/dunya/kisa", "c")]);
    expect(entry?.foldedName).toBe("uzun adli yer kisa");
    expect(entry?.foldedSlug).toBe("kisa");
  });

  it("preserves every record", () => {
    const records = [record("Avlak", "/turkiye/avlak"), record("Bavlak", "/dunya/bavlak", "c")];
    expect(prepareSearchIndex(records)).toHaveLength(2);
    expect(prepareSearchIndex(records).map((e) => e.kind)).toEqual(["p", "c"]);
  });
});

describe("searchPrepared", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    const records = [record("Avlak", "/turkiye/avlak")];
    expect(search(records, "")).toEqual([]);
    expect(search(records, "   ")).toEqual([]);
    expect(search(records, "()")).toEqual([]);
  });

  it("ranks exact over prefix over word-prefix over substring", () => {
    // One query, four entries that can only be separated by the tier rule — if the tiers
    // were dropped, collation alone would order these Avlak/Bavlak/Kavlak/Zavlak instead.
    const records = [
      record("Zavlak", "/turkiye/zavlak"), // substring: "avlak" inside
      record("Avlak Deresi", "/turkiye/avlak-deresi"), // prefix
      record("Bavlak Avlak", "/turkiye/bavlak-avlak"), // word-prefix
      record("Avlak", "/turkiye/avlak"), // exact
    ];
    expect(search(records, "avlak")).toEqual(["Avlak", "Avlak Deresi", "Bavlak Avlak", "Zavlak"]);
  });

  it("breaks ties inside one tier by Turkish collation, not by input order", () => {
    // All three land in the SAME (word-prefix) tier, so only the collation tie-break can
    // order them — and it must put Ç between A and Z, which a naive sort would not.
    const records = [
      record("Zzz Ova", "/turkiye/zzz-ova"),
      record("Çzz Ova", "/turkiye/czz-ova"),
      record("Azz Ova", "/turkiye/azz-ova"),
    ];
    expect(search(records, "ova")).toEqual(["Azz Ova", "Çzz Ova", "Zzz Ova"]);
  });

  it("finds an entity through a Turkish-folded query in any casing", () => {
    const records = [record("Şavlak", "/turkiye/savlak"), record("İvlak", "/turkiye/ivlak")];
    expect(search(records, "savlak")).toEqual(["Şavlak"]);
    expect(search(records, "ŞAVLAK")).toEqual(["Şavlak"]);
    expect(search(records, "ivlak")).toEqual(["İvlak"]);
    expect(search(records, "İVLAK")).toEqual(["İvlak"]);
    expect(search(records, "ıvlak")).toEqual(["İvlak"]);
  });

  it("finds a parenthesised name by its inner word", () => {
    // The `Çin Cumhuriyeti (Tayvan)` shape: the query matches a word the DISPLAY NAME
    // carries, so it is found through the name key even though the slug is unrelated.
    const records = [record("Uzun Adlı Yer (Kısa)", "/dunya/baska-slug", "c")];
    expect(search(records, "kisa")).toEqual(["Uzun Adlı Yer (Kısa)"]);
    expect(search(records, "KISA")).toEqual(["Uzun Adlı Yer (Kısa)"]);
  });

  it("finds an entity through its slug when the name does not contain the query", () => {
    const records = [record("Uzun Adlı Yer", "/dunya/kisaad", "c")];
    expect(search(records, "kisaad")).toEqual(["Uzun Adlı Yer"]);
  });

  it("matches a mid-word substring, at the weakest tier", () => {
    const records = [record("Şavlakurfa", "/turkiye/savlakurfa"), record("Urfa", "/turkiye/urfa")];
    expect(search(records, "urfa")).toEqual(["Urfa", "Şavlakurfa"]);
  });

  it("never returns more than the limit, keeping the best-ranked hits", () => {
    const records = [
      record("Avlak Zzz", "/turkiye/avlak-zzz"), // prefix tier
      record("Avlak Aaa", "/turkiye/avlak-aaa"), // prefix tier
      record("Zzz Avlak", "/turkiye/zzz-avlak"), // word-prefix tier
    ];
    expect(search(records, "avlak", 2)).toEqual(["Avlak Aaa", "Avlak Zzz"]);
    expect(search(records, "avlak", 0)).toEqual([]);
  });

  it("is deterministic — the same query yields the same order every time", () => {
    const records = [
      record("Bavlak", "/turkiye/bavlak"),
      record("Avlak", "/dunya/avlak", "c"),
      record("Cavlak", "/turkiye/cavlak"),
    ];
    const once = search(records, "avlak");
    for (let i = 0; i < 5; i += 1) expect(search(records, "avlak")).toEqual(once);
  });

  it("carries the path and kind through to the hit", () => {
    const hits = searchPrepared(
      prepareSearchIndex([record("Avlak", "/en/dunya/avlak", "c")]),
      "avlak",
      OPTS,
    );
    expect(hits).toEqual([{ name: "Avlak", path: "/en/dunya/avlak", kind: "c" }]);
  });

  it("does not mutate the prepared index", () => {
    const prepared = prepareSearchIndex([
      record("Zavlak", "/turkiye/zavlak"),
      record("Avlak", "/turkiye/avlak"),
    ]);
    const before = prepared.map((e) => e.name);
    searchPrepared(prepared, "avlak", OPTS);
    expect(prepared.map((e) => e.name)).toEqual(before);
  });
});
