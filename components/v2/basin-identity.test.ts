import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASIN_TINTS } from "@/lib/theme/basin-palette.test";
import {
  BASIN_IDENTITY,
  BASIN_KEY_TO_SLUG,
  basinIdentityOf,
  basinIdentityOfSeaName,
  type BasinSlug,
  type SeaBasinKey,
} from "@/lib/theme/basin-identity";

const SLUGS = Object.keys(BASIN_TINTS) as BasinSlug[];
const BASIN_KEYS = Object.keys(BASIN_KEY_TO_SLUG) as SeaBasinKey[];

/**
 * The classes this task exists to remove: a palette family with a numeric shade.
 *
 * Deliberately a local copy of `scripts/palette-inventory.mjs`'s `RAW_PALETTE` shape rather than
 * an import of it: that regex carries the `g` flag for the counter, and a shared `g` regex is
 * stateful across `.test()` calls — a per-slug `it.each` is exactly where that bites.
 */
const RAW_HUE =
  /\b(?:text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

/**
 * The module the four basin tables now read.
 *
 * Its job is narrow and checkable: turn a `--basin-*` token into a class, once. What it must NOT
 * do is what the tables it replaced did — hold a hue of its own, or hand one basin another
 * basin's token. Both are asserted, because "no raw hue" alone would be satisfied by a module
 * that bound every basin to `--basin-karadeniz`.
 */
describe("one module spells a basin's colour", () => {
  const identitySource = readFileSync(
    fileURLToPath(new URL("../../lib/theme/basin-identity.ts", import.meta.url)),
    "utf8",
  );

  it("holds no raw palette hue of its own", () => {
    expect(identitySource.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("has one entry per basin, and each entry knows its own slug", () => {
    expect(Object.keys(BASIN_IDENTITY).sort()).toEqual([...SLUGS].sort());
    for (const slug of SLUGS) expect(BASIN_IDENTITY[slug].slug).toBe(slug);
  });

  it.each(SLUGS)("%s names no basin token but its own", (slug) => {
    const named = new Set<string>();
    for (const cls of Object.values(BASIN_IDENTITY[slug])) {
      for (const m of cls.matchAll(/--basin-([a-z-]+?)(?:-tint|-text)?\)/g)) named.add(m[1]!);
    }
    // Positive control on the premise: the entry really does reference tokens at all, so an
    // entry that had been emptied could not pass by naming nothing.
    expect(named.size, `${slug} references no --basin-* token`).toBeGreaterThan(0);
    expect([...named]).toEqual([slug]);
  });

  it.each(SLUGS)("%s carries every member, and none of them is empty", (slug) => {
    const identity = BASIN_IDENTITY[slug];
    expect(Object.keys(identity).sort()).toEqual([
      "badge",
      "chipSoft",
      "edge",
      "edgeHover",
      "heroGradient",
      "label",
      "linkCard",
      "slug",
      "surface",
    ]);
    for (const [member, value] of Object.entries(identity)) {
      expect(value.length, `${slug}.${member} is empty`).toBeGreaterThan(0);
    }
  });

  it.each(SLUGS)(
    "%s's badge is its surface, its label and its edge — not a fourth spelling",
    (slug) => {
      // The badge is the member with the most call sites, so it is the one most worth deriving
      // from the others rather than eyeballing. Composition is asserted, not string equality, so
      // the member may be reordered without this becoming a formatting test.
      const { badge, surface, label, edge } = BASIN_IDENTITY[slug];
      for (const part of [surface, label, edge]) {
        expect(badge.split(/\s+/), `${slug}.badge is missing ${part}`).toContain(part);
      }
    },
  );
});

/**
 * The crossing from the marine contract's key to a slug.
 *
 * `MarinePointData.seaBasin` and `SeaBasinInfo.id` are the contract's spelling (`black_sea`,
 * `aegean`, `mediterranean`); the tokens are the route's (`karadeniz`, `ege`, `akdeniz`). Two
 * spellings that have to agree is exactly the shape this task exists to collapse, so the one
 * crossing is tested rather than trusted.
 */
describe("the contract's basin key crosses to a slug exactly once", () => {
  it("maps all four keys, onto all four slugs, one to one", () => {
    expect(BASIN_KEYS).toHaveLength(4);
    expect([...Object.values(BASIN_KEY_TO_SLUG)].sort()).toEqual([...SLUGS].sort());
  });

  it.each(BASIN_KEYS)("%s resolves to the identity of its own slug", (key) => {
    const slug = BASIN_KEY_TO_SLUG[key];
    expect(basinIdentityOf(key)).toBe(BASIN_IDENTITY[slug]);
    expect(basinIdentityOf(key).slug).toBe(slug);
  });
});

/**
 * The crossing from a contract DISPLAY NAME to a slug.
 *
 * `GeographicRegionDto.coastalSeas` is free text, so `turkiye/bolge/[slug]` has prose where
 * every other call site has a key. The keyword list is the fragile part and is tested as such.
 */
describe("a sea's display name crosses to its basin", () => {
  it.each([
    ["Karadeniz", "karadeniz"],
    ["Marmara Denizi", "marmara"],
    ["Ege Denizi", "ege"],
    ["Akdeniz", "akdeniz"],
  ] as const)("%s is the %s basin", (name, slug) => {
    expect(basinIdentityOfSeaName(name)?.slug).toBe(slug);
  });

  it("is not defeated by Turkish casing, which is why it folds", () => {
    // `foldForSearch` is the product's own fold; dotted/dotless İ/I is the case that breaks a
    // naive `toLowerCase()` here.
    expect(basinIdentityOfSeaName("EGE DENİZİ")?.slug).toBe("ege");
    expect(basinIdentityOfSeaName("karadeniz")?.slug).toBe("karadeniz");
  });

  it("does not let one sea's keyword swallow another's", () => {
    // "Karadeniz" and "Akdeniz" both END in "deniz", and "Ege Denizi" contains it too. A
    // keyword list where one entry is a substring of another would paint several seas one
    // colour and still render, so the mutual exclusivity is asserted on the real names rather
    // than assumed from reading the list.
    const names = ["Karadeniz", "Marmara Denizi", "Ege Denizi", "Akdeniz"];
    const resolved = names.map((n) => basinIdentityOfSeaName(n)?.slug);
    expect(new Set(resolved).size, `${JSON.stringify(resolved)} is not one slug per sea`).toBe(4);
  });

  it("returns null for a sea it has no identity for, rather than guessing", () => {
    // A wrong colour on a data chip is worse than no colour, so the caller gets `null` and
    // renders a neutral chip. A default basin here would silently mislabel any sea the contract
    // adds later.
    expect(basinIdentityOfSeaName("Hazar Denizi")).toBeNull();
    expect(basinIdentityOfSeaName("")).toBeNull();
  });
});
