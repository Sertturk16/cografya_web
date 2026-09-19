import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASIN_TINTS } from "@/lib/theme/basin-palette.test";
import { stripComments } from "@/lib/test-support/strip-comments";
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

/**
 * Brace matcher, so an assertion can be scoped to the block that PRODUCES a field rather than
 * run against a whole file. Skips strings and comments, and throws rather than returning a
 * short block, so it fails closed.
 *
 * A local copy for the same reason `region-identity.test.ts` and `continent-identity.test.ts`
 * each carry one: these pins must not be able to break each other.
 */
function matchBraces(source: string, open: number, pair: "{}" | "[]" = "{}"): string {
  const [OPEN, CLOSE] = [pair[0]!, pair[1]!];
  let depth = 0;
  let quote: string | null = null;
  let comment: "line" | "block" | null = null;
  for (let i = open; i < source.length; i++) {
    const c = source[i]!;
    if (comment === "line") {
      if (c === "\n") comment = null;
      continue;
    }
    if (comment === "block") {
      if (c === "*" && source[i + 1] === "/") {
        comment = null;
        i++;
      }
      continue;
    }
    if (quote !== null) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      comment = "line";
      i++;
    } else if (c === "/" && source[i + 1] === "*") {
      comment = "block";
      i++;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === OPEN) depth++;
    else if (c === CLOSE && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error(`unbalanced ${pair} in the table being read`);
}

const read = (rel: string): string =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

/**
 * The offset of a top-level declaration's VALUE, i.e. the bracket after its `=`.
 *
 * Not the first bracket after the name: that one belongs to the TYPE annotation
 * (`Record<string, { ... }>`, `SeaBasinInfo[]`), and every pin below would then be asserting
 * about a type while the table it is meant to guard said anything it liked. Three of these
 * assertions failed exactly that way on first run, which is why this is a named helper rather
 * than an inline `indexOf`.
 */
function valueAt(source: string, name: string, pair: "{}" | "[]"): number {
  const decl = source.indexOf(name);
  if (decl < 0) throw new Error(`${name} is not declared in this file`);
  const assign = source.indexOf(`= ${pair[0]!}`, decl);
  if (assign < 0) throw new Error(`${name} has no ${pair[0]!} value`);
  return assign + 2;
}

/**
 * The call sites, pinned on the FIELD that feeds each surface.
 *
 * Every assertion below runs on source with comments STRIPPED, matches the block that produces
 * the field rather than the whole file, and requires exactly ONE producer. That standard is not
 * theoretical: the first version of the region pin in this repo did a file-wide regex and was
 * defeated by right-looking text planted in a line comment, and a second spelling anywhere is
 * how a measured member quietly grows an unmeasured twin.
 *
 * Without these, every consumer could revert to a hand-written hue — or, worse, to ONE basin's
 * identity for all four — and only the raw-palette budget would notice the first case while
 * nothing at all would notice the second.
 */
describe("every marine surface reads the basin module, and names its own basin", () => {
  it("v2-marine-map-explorer's filter table: four badges, each its own basin", () => {
    const source = read("../../components/v2/v2-marine-map-explorer.tsx");
    const table = matchBraces(source, valueAt(source, "BASIN_FILTER_META", "{}"));
    // Anti-vacuity: the slice really is the table, not an empty or truncated match.
    expect(table, "the BASIN_FILTER_META slice is not the table").toContain("badgeClass");
    // Exactly one producer per basin, file-wide. A second spelling anywhere — decoy,
    // copy-paste, or a real second badge nobody has measured — reds this.
    for (const key of BASIN_KEYS) {
      const producer = `basinIdentityOf("${key}").badge`;
      expect(
        source.split(producer).length - 1,
        `${producer} must appear exactly once in v2-marine-map-explorer.tsx`,
      ).toBe(1);
      expect(
        table,
        `the BASIN_FILTER_META entry for ${key} does not read its own identity`,
      ).toContain(producer);
    }
    // The only other badgeClass in the table is "all", which is brand accent by ruling — so
    // five assignments, four of them basin identities. A sixth would be a basin wearing
    // something nobody measured.
    expect(table.match(/badgeClass:/g)).toHaveLength(5);
  });

  it("v2-marine-basin-cards: each card's identity is derived from its own id", () => {
    const source = read("../../components/v2/v2-marine-basin-cards.tsx");
    const data = matchBraces(source, valueAt(source, "BASIN_DATA", "[]"), "[]");
    expect(data, "the BASIN_DATA slice is not the array").toContain("identity:");
    // Per ENTRY, not per file: the entry that declares `id: "marmara"` must be the entry that
    // reads Marmara's identity. A file-wide check would pass on four cards all painted cyan.
    for (const key of BASIN_KEYS) {
      const idAt = data.indexOf(`id: "${key}"`);
      expect(idAt, `BASIN_DATA has no entry with id ${key}`).toBeGreaterThan(-1);
      const entry = matchBraces(data, data.lastIndexOf("{", idAt));
      expect(entry, `the ${key} card does not read its own identity`).toContain(
        `identity: basinIdentityOf("${key}")`,
      );
    }
    expect(data.match(/identity: basinIdentityOf\(/g)).toHaveLength(4);
    // The card's hover edge comes from the same identity, so the border cannot drift from the
    // badge the way `borderClass` could when it was a second literal field.
    expect(source).toContain("basin.identity.edgeHover");
    expect(source).toContain("basin.identity.badge");
  });

  it("sea-basins-detail: each basin's entry holds its own identity, and the hero reads it", () => {
    const source = read("../../lib/marine/sea-basins-detail.ts");
    // Scoped to the VALUE: `slug: "karadeniz"` also appears in the interface's own union type,
    // and a slice anchored there would read a type rather than the table.
    const table = matchBraces(source, valueAt(source, "SEA_BASINS_DETAIL", "{}"));
    for (const slug of SLUGS) {
      const at = table.indexOf(`slug: "${slug}"`);
      expect(at, `SEA_BASINS_DETAIL has no entry for ${slug}`).toBeGreaterThan(-1);
      const entry = matchBraces(table, table.lastIndexOf("{", at));
      expect(entry, `the ${slug} entry does not hold its own identity`).toContain(
        `identity: BASIN_IDENTITY.${slug}`,
      );
    }
    expect(source.match(/identity: BASIN_IDENTITY\./g)).toHaveLength(4);
    // The dead fields are gone and must stay gone: binding a field nothing renders would keep
    // a second spelling of every basin's hue alive for no surface at all.
    expect(source).not.toContain("themeColor");
    expect(source).not.toContain("borderAccent");
    expect(source).not.toContain("gradientClass");
    // The one field that WAS rendered still is, through the identity.
    const view = read("../../components/v2/v2-sea-basin-detail-view.tsx");
    expect(view).toContain("data.identity.heroGradient");
    expect(view.match(/data\.identity\./g)).toHaveLength(1);
  });

  it("deniz/kiyi-tipleri: each link card wears the basin its own href points at", () => {
    const source = read("../../app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx");
    for (const slug of SLUGS) {
      const at = source.indexOf(`href="/deniz/${slug}"`);
      expect(at, `kiyi-tipleri has no link to /deniz/${slug}`).toBeGreaterThan(-1);
      // Scoped to the element, so a card linking to Ege while painted Akdeniz reds here even
      // though both spellings exist in the file.
      const element = source.slice(at, source.indexOf("</Link>", at));
      expect(element, `the /deniz/${slug} card does not wear ${slug}'s identity`).toContain(
        `BASIN_IDENTITY.${slug}.linkCard`,
      );
      expect(element, `the /deniz/${slug} card's label is not ${slug}'s`).toContain(
        `BASIN_IDENTITY.${slug}.label`,
      );
      expect(source.split(`BASIN_IDENTITY.${slug}.linkCard`).length - 1).toBe(1);
      expect(source.split(`BASIN_IDENTITY.${slug}.label`).length - 1).toBe(1);
    }
  });

  it("turkiye/bolge/[slug]: the coastal-sea chips are coloured per SEA, not per page", () => {
    const source = read("../../app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx");
    const at = source.indexOf("region.coastalSeas.map(");
    expect(at, "the coastalSeas list is gone").toBeGreaterThan(-1);
    const block = matchBraces(source, source.indexOf("{", at));
    // Anti-vacuity: the slice really is the chip-rendering block.
    expect(block, "the coastalSeas slice renders no Badge").toContain("Badge");
    // THE PROPERTY THAT MATTERS. These four chips were one cyan for four different seas while
    // v2-marine-basin-cards painted Marmara amber and Ege teal one click away. Binding them to
    // any FIXED identity would satisfy "no raw hue" and re-create exactly that defect, so the
    // pin is on the per-sea lookup, not on the presence of a basin token.
    expect(block, "the chips no longer resolve a colour per sea").toContain(
      "basinIdentityOfSeaName(sea)",
    );
    // Exactly one producer, file-wide.
    expect(source.split("basinIdentityOfSeaName(").length - 1).toBe(1);
    // And the null branch is still a neutral chip rather than a guessed basin.
    expect(block).toContain("bg-muted");
  });

  it("holds those five files at zero raw palette hues, by name", () => {
    // A ratchet the total budget cannot give: the budget is a ceiling over the whole tree, so
    // it would let a hue come back here as long as one went away elsewhere.
    for (const rel of [
      "../../components/v2/v2-marine-map-explorer.tsx",
      "../../components/v2/v2-marine-basin-cards.tsx",
      "../../lib/marine/sea-basins-detail.ts",
      "../../app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx",
    ]) {
      const source = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
      const found = source.match(new RegExp(RAW_HUE.source, "g"));
      expect(found, `${rel} carries raw palette hues: ${found?.join(", ")}`).toBeNull();
    }
  });
});
