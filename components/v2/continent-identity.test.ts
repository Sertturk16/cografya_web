import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTINENT_TINTS } from "@/lib/theme/continent-palette.test";
import {
  CONTINENT_IDENTITY,
  continentIdentityOf,
  type ContinentSlug,
} from "@/lib/theme/continent-identity";
import { CONTINENT_KEY_TO_SLUG } from "@/lib/geo/continents";
import type { Continent } from "@/lib/api/types";

const SLUGS = Object.keys(CONTINENT_TINTS) as ContinentSlug[];
const CONTINENT_KEYS = Object.keys(CONTINENT_KEY_TO_SLUG) as Continent[];

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
 * The module the continent tables now read.
 *
 * Its job is narrow and checkable: turn a `--continent-*` token into a class, once. What it must
 * NOT do is what the tables it replaced did — hold a hue of its own, or hand one continent
 * another continent's token. Both are asserted, because "no raw hue" alone would be satisfied by
 * a module that bound every continent to `--continent-avrupa`.
 */
describe("one module spells a continent's colour", () => {
  const identitySource = readFileSync(
    fileURLToPath(new URL("../../lib/theme/continent-identity.ts", import.meta.url)),
    "utf8",
  );

  it("holds no raw palette hue of its own", () => {
    expect(identitySource.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("has one entry per continent, and each entry knows its own slug", () => {
    expect(Object.keys(CONTINENT_IDENTITY).sort()).toEqual([...SLUGS].sort());
    for (const slug of SLUGS) expect(CONTINENT_IDENTITY[slug].slug).toBe(slug);
  });

  it.each(SLUGS)("%s names no continent token but its own", (slug) => {
    const named = new Set<string>();
    for (const cls of Object.values(CONTINENT_IDENTITY[slug])) {
      for (const m of cls.matchAll(/--continent-([a-z-]+?)(?:-tint|-text)?\)/g)) named.add(m[1]!);
    }
    // Positive control on the premise: the entry really does reference tokens at all, so an
    // entry that had been emptied could not pass by naming nothing.
    expect(named.size, `${slug} references no --continent-* token`).toBeGreaterThan(0);
    expect([...named]).toEqual([slug]);
  });

  it.each(SLUGS)("%s's badge and banner draw BOTH derived members", (slug) => {
    // The token names alone are not enough — `-tint` without `-text` is a surface with an
    // unspecified label on it, which is the state the badge tables shipped in.
    for (const member of ["badge", "banner"] as const) {
      expect(CONTINENT_IDENTITY[slug][member]).toContain(`--continent-${slug}-tint`);
      expect(CONTINENT_IDENTITY[slug][member]).toContain(`--continent-${slug}-text`);
    }
  });

  it.each(SLUGS)("%s declares both derived members in app/globals.css", (slug) => {
    // The module can only reference what the stylesheet defines. Light mode declares both
    // members; `.dark` re-declares `-text` alone, because the tint is translucent and
    // composites over whichever card it lands on.
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    expect(css).toContain(`--continent-${slug}-tint:`);
    expect(
      css.match(new RegExp(`--continent-${slug}-text:`, "g")) ?? [],
      `--continent-${slug}-text must be declared twice: once in :root and once in .dark`,
    ).toHaveLength(2);
  });

  it("crosses from the API enum to the identity without a second mapping", () => {
    // Positive control on the premise: the enum really does carry seven members, so a shrunken
    // key list could not make this vacuous.
    expect(CONTINENT_KEYS).toHaveLength(7);
    for (const continent of CONTINENT_KEYS) {
      expect(continentIdentityOf(continent).slug).toBe(CONTINENT_KEY_TO_SLUG[continent]);
    }
  });
});

/**
 * Brace-match forward from the `{` at `open`, ignoring braces inside string literals and inside
 * `//` and slash-star comments.
 *
 * Lifted in shape from `components/v2/region-identity.test.ts`, and neither exclusion is
 * decoration. A descriptor value is a class string, and a class string is exactly where a stray
 * brace would otherwise desynchronise the depth counter. A comment is the other place: a `}`
 * inside a `// …` mid-block would end the block early and TRUNCATE it, which is the one shape
 * that could hide a raw hue from the assertions below.
 *
 * An unbalanced or unterminated construct throws rather than returning a short block, so this
 * fails closed — no caller can mistake a truncated block for a complete one.
 */
function matchBraces(source: string, open: number): string {
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
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error("unbalanced {} in the table being read");
}

/** Every `CONTINENT_META` entry, keyed by the API enum name the entry is declared under. */
function locateMetaBlocks(source: string): Map<string, string> {
  const at = source.indexOf("export const CONTINENT_META");
  if (at < 0) throw new Error("CONTINENT_META is gone — this test is about that table");
  // The table's own opener is the first `= {`; the `{` inside the `Record<string, { … }>` type
  // annotation is not preceded by `=`.
  const opener = /=\s*\{/.exec(source.slice(at));
  if (opener === null) throw new Error("CONTINENT_META has no literal");
  const table = matchBraces(source, at + opener.index + opener[0].length - 1);

  const blocks = new Map<string, string>();
  const entry = /([A-Z][A-Z0-9_]*):\s*\{/g;
  let cursor = 0;
  for (let m = entry.exec(table); m !== null; m = entry.exec(table)) {
    if (m.index < cursor) continue; // a nested object inside the block just consumed
    const start = m.index + m[0].length - 1; // the `{` the match ends on
    const block = matchBraces(table, start);
    cursor = start + block.length; // one past the block's closing `}`
    blocks.set(m[1]!, block);
  }
  return blocks;
}

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * How a consumer names one continent's identity in source, e.g. `CONTINENT_IDENTITY.avrupa` or
 * `CONTINENT_IDENTITY["kuzey-amerika"]`. A slug with a hyphen is not a valid property name, so
 * the two spellings are not interchangeable and a single `toContain` would miss three of seven.
 */
function identityReference(slug: ContinentSlug): string {
  return slug.includes("-") ? `CONTINENT_IDENTITY["${slug}"]` : `CONTINENT_IDENTITY.${slug}`;
}

describe("the continent block locator", () => {
  const themeSource = read("../../lib/map/continent-theme.ts");
  const blocks = locateMetaBlocks(themeSource);

  it("finds exactly the seven continents, one block each", () => {
    expect([...blocks.keys()].sort()).toEqual([...CONTINENT_KEYS].sort());
  });

  it("is honest: a hue planted in one block is seen only in that block", () => {
    // The positive control. A locator that returned "", that returned the same text for every
    // key, or that was off by one would pass a `not.toMatch` assertion while the bug was fully
    // present — which is exactly how the region version of this file first failed.
    const fixture = [
      "export const CONTINENT_META: Record<string, { identity: X }> = {",
      '  AVRUPA: { name: "Avrupa", identity: CONTINENT_IDENTITY.avrupa, note: "bg-indigo-500/15" },',
      '  ASYA: { name: "Asya", identity: CONTINENT_IDENTITY.asya },',
      "};",
    ].join("\n");
    const found = locateMetaBlocks(fixture);

    expect([...found.keys()]).toEqual(["AVRUPA", "ASYA"]);
    expect(found.get("AVRUPA")).toMatch(RAW_HUE);
    expect(found.get("ASYA")).not.toMatch(RAW_HUE);
    // And the two blocks are genuinely different text, not one block handed out twice.
    expect(found.get("AVRUPA")).not.toEqual(found.get("ASYA"));
  });
});

/**
 * The tables T-031c Task 5 bound. Between them they were 167 raw palette occurrences — 112 in
 * `CONTINENT_META`, the heaviest definition in the tree, and 55 in `CONTINENTS_DATA`, which spelled
 * the same seven identities a second time at different stops.
 */
describe("a continent wears one colour, not two", () => {
  const themeSource = read("../../lib/map/continent-theme.ts");
  const blocks = locateMetaBlocks(themeSource);

  it.each(CONTINENT_KEYS)("%s's CONTINENT_META entry holds no raw palette hue", (key) => {
    const block = blocks.get(key);
    // Positive control, inline: assert we are holding a real descriptor block before asserting
    // what is absent from it. `not.toMatch` on "" or on undefined is a green run that means
    // nothing.
    expect(block, `no CONTINENT_META entry is declared for ${key}`).toBeDefined();
    expect(block).toContain("identity:");
    expect(block).not.toMatch(RAW_HUE);
  });

  it.each(CONTINENT_KEYS)("%s draws its colour from its own continent's identity", (key) => {
    const block = blocks.get(key)!;
    const slug = CONTINENT_KEY_TO_SLUG[key];
    // Naming the member is not enough on its own — the exclusion below is what kills an entry
    // pointed at another continent entirely, which is the bug `DES133-I1` records.
    expect(block).toContain(`identity: ${identityReference(slug)}`);
    for (const other of SLUGS) {
      if (other === slug) continue;
      expect(
        block.includes(identityReference(other)),
        `the ${key} entry names ${other}'s identity — a continent is wearing another's colour`,
      ).toBe(false);
    }
  });

  /**
   * A ratchet, not a restatement of the budget. `raw-palette-count.test.ts` holds a TOTAL and is
   * satisfied by any distribution that sums under it, so a file taken to zero can drift back to
   * five while the total falls elsewhere. These four are the continent surface, and they stay at
   * zero by name.
   */
  it.each([
    "../../lib/map/continent-theme.ts",
    "./v2-world-continents.tsx",
    "../../app/[locale]/(site)/dunya/kita/page.tsx",
    "../../app/[locale]/(site)/dunya/kita/[slug]/page.tsx",
  ])("%s carries no raw palette hue at all", (rel) => {
    const source = read(rel);
    // Positive control on the premise: the file was really read, so an empty string cannot
    // satisfy the assertion below.
    expect(source.length).toBeGreaterThan(1000);
    expect(source.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("the continent deck holds no colour field of its own any more", () => {
    const deck = read("./v2-world-continents.tsx");
    // `CONTINENTS_DATA` used to carry `color`, `badgeClass` and `borderClass` per entry. They are
    // gone, not merely bound: the card derives its identity from its own `id`, so there is no
    // field left that could name another continent's colour.
    for (const field of ["color:", "badgeClass:", "borderClass:", "headerClass:"]) {
      expect(deck.includes(field), `CONTINENTS_DATA has grown a ${field} field again`).toBe(false);
    }
    expect(deck).toContain("continentIdentityOf(continent.id)");
  });

  it("the world map paints countries from the module, not from a table of its own", () => {
    const explorer = read("./v2-world-map-explorer.tsx");
    expect(explorer).toContain("continentMeta.identity.fillSoft");
    expect(explorer).toContain("continentMeta.identity.stroke");
    // The grouped-view banner used to be a two-stop gradient of an unrelated hue with white text
    // on it. Both halves have to go: the gradient AND the white.
    expect(explorer).toContain("${group.identity.banner} [&_h4]:text-inherit");
  });
});

/**
 * The badge's backdrop is the one `app/globals.css` names, with nothing unnamed on top of it.
 *
 * `--continent-*-text` is measured against a backdrop the stylesheet spells out: the badge's tint
 * over the hero gradient's tint end over `--background`. Both continent heroes also paint a
 * decorative `absolute … size-96 … blur-3xl` overlay in the continent's OWN colour. `size-96` is
 * 384px and `blur-3xl` spreads it further, so unbounded it is wider than a 320px viewport and
 * washes over the badge row — a decoration deciding whether a data label clears 4.5:1, which is
 * the bug `turkiye/bolge/[slug]` shipped and Task 3 fixed.
 *
 * ## What this test can and cannot do
 *
 * It CANNOT check the ratio. A Gaussian blur is not a blend any analytic model expresses, so the
 * numbers come from painted pixels and live in comments beside the code that produced them.
 * Measurement does not run in CI.
 *
 * It CAN check the SHAPE, which is what actually regresses: a fixed-size blurred overlay
 * positioned over hero content with no width bound on it. That is a static property of the
 * markup, so it belongs in a test rather than in a comment asking the next person to remember.
 */
describe("no unbounded blurred overlay sits over a continent badge", () => {
  const HEROES = [
    ["dunya/kita/[slug]", "../../app/[locale]/(site)/dunya/kita/[slug]/page.tsx"],
    ["dunya/[slug]", "../../app/[locale]/(site)/dunya/[slug]/page.tsx"],
  ] as const;

  const overlays = HEROES.flatMap(([name, rel]) =>
    [...read(rel).matchAll(/className=\{`([^`]*)`\}/g)]
      .map((m) => m[1]!)
      .filter((cls) => /\babsolute\b/.test(cls) && /\bblur-(?:xs|sm|md|lg|xl|2xl|3xl)\b/.test(cls))
      .map((cls) => [name, cls] as const),
  );

  it("finds an overlay in BOTH heroes — positive control", () => {
    // Without this, a renamed class or a deleted div would empty the list and make the assertion
    // below vacuously green. If a hero legitimately stops carrying a blurred overlay, delete its
    // entry rather than letting this pass on nothing.
    for (const [name] of HEROES) {
      expect(
        overlays.some(([owner]) => owner === name),
        `no blurred overlay found in ${name} — if it is genuinely gone, retire this entry`,
      ).toBe(true);
    }
  });

  it.each(overlays)(
    "%s's overlay is bounded away from the widths it would wash over",
    (_n, cls) => {
      // `hidden md:block` is what both heroes use. Any equivalent that removes it below `md` is
      // fine; what is not fine is no bound at all, which is the state that shipped.
      expect(
        /\bhidden\b/.test(cls) && /\bmd:(?:block|flex|grid|inline-block)\b/.test(cls),
        `this overlay paints at every width. size-96 + blur-3xl is wider than a 320px viewport, ` +
          `so it lands on the continent badge and falsifies the --continent-*-text figures ` +
          `recorded in app/globals.css. Bound it (hidden md:block) or re-measure every width.`,
      ).toBe(true);
    },
  );

  it("both heroes draw the glow and the wash from the identity, not from a hue", () => {
    for (const [, rel] of HEROES) {
      const source = read(rel);
      expect(source).toMatch(/identity\.glow/);
      expect(source).toMatch(/identity\.heroGradient/);
    }
  });
});
