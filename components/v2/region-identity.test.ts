import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGION_TINTS } from "@/lib/theme/region-palette.test";
import { REGION_IDENTITY, regionIdentityOf, type RegionSlug } from "@/lib/theme/region-identity";
import { REGION_KEYS, regionSlug } from "@/lib/game/region-slug";

/**
 * A region wears ONE colour.
 *
 * `turkiye/bolge/[slug]` gives every region a `mapFill` bound to its `--region-*` token and,
 * in the same object literal, a `badgeClass` / `accentColor` / `gradient` / `borderAccent`
 * set that was written in an unrelated raw Tailwind hue. Marmara was badged amber and
 * painted blue; Ege was badged teal and painted orange. Six of seven disagreed. This file is
 * what keeps the two halves of a region's identity from drifting apart again.
 *
 * ## Four tables, then one
 *
 * T-031c Task 3 fixed two of the four tables that spelled a region's colour; Task 4 fixed the
 * other two — `v2-turkey-map-explorer`'s `REGION_DATA`, whose `color` field was the MAP FILL on
 * `/turkiye` (so the deck painted Marmara amber while `/turkiye/bolge/marmara` painted it blue),
 * and `v2-game-screen`'s `REGION_COLOR_CLASSES`. All four now read `lib/theme/region-identity.ts`,
 * which is the only file that turns a `--region-*` token into a class. Four tables that AGREE are
 * not the same property as one table, so the assertions below check both halves: that the module
 * binds each region to its own tokens and nothing else, and that every consumer reaches for the
 * identity of the region it is describing.
 *
 * ## Why the blocks are parsed and not `split` on
 *
 * The first version of this test located a region's block with
 * `page.split(/mapFill:/)[SLUGS.indexOf(slug)] ?? ""`. That is wrong three times over, and
 * every one of the three failures is SILENT:
 *
 *   1. The page contains NINE `mapFill:` occurrences, not seven — the interface declares one
 *      and the `?? {}` fallback theme carries one — so `split` yields ten parts.
 *   2. `split` returns the text BEFORE the first match as element 0, so index N was never
 *      region N even if the count had been seven.
 *   3. The assertion is `not.toMatch(...)`, which passes on the WRONG block and passes on
 *      the empty string the `?? ""` fallback supplies. A green run proved nothing.
 *
 * So the table is parsed: `locateRegionBlocks` brace-matches each entry of `REGION_THEMES`
 * and keys it by the slug that entry's OWN `mapFill` names. `the locator is honest` below is
 * the positive control — it runs the locator over a fixture where exactly one block carries
 * a planted hue, and fails if the locator returns an empty, merged or misaligned block.
 */

const SLUGS = Object.keys(REGION_TINTS) as RegionSlug[];

/**
 * How a consumer names one region's identity in source, e.g. `REGION_IDENTITY.marmara` or
 * `REGION_IDENTITY["ic-anadolu"]`. A slug with a hyphen is not a valid property name, so the
 * two spellings are not interchangeable and a single `toContain` would miss three of the seven.
 */
function identityReference(slug: RegionSlug): string {
  return slug.includes("-") ? `REGION_IDENTITY["${slug}"]` : `REGION_IDENTITY.${slug}`;
}

const PAGE_PATH = fileURLToPath(
  new URL("../../app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx", import.meta.url),
);
const page = readFileSync(PAGE_PATH, "utf8");

/**
 * The classes this task exists to remove: a palette family with a numeric shade.
 *
 * Deliberately a local copy of `scripts/palette-inventory.mjs`'s `RAW_PALETTE` shape rather
 * than an import of it: that regex carries the `g` flag for the counter, and a shared `g`
 * regex is stateful across `.test()` calls — a per-slug `it.each` is exactly where that bites.
 */
const RAW_HUE =
  /\b(?:text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

/**
 * Brace-match forward from the `{` at `open`, ignoring braces inside string literals and
 * inside `//` and slash-star comments.
 *
 * Neither exclusion is decoration. A descriptor value is a class string, and a class string is
 * exactly where a stray brace would otherwise desynchronise the depth counter. A comment is
 * the other place: a `}` inside a `// …` mid-block would end the block early and TRUNCATE it,
 * which is the one shape that could hide a raw hue from the assertion below.
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
  throw new Error("unbalanced braces in REGION_THEMES");
}

/**
 * Every `REGION_THEMES` entry, keyed by the slug its own `mapFill` names.
 *
 * Keying on the entry's own content rather than on its position is the whole point: the
 * table's declaration order, the number of entries and the number of `mapFill:` occurrences
 * elsewhere in the file are all free to change without this test quietly reading the wrong
 * text.
 */
function tableOf(source: string, declaration: string): string {
  const at = source.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} is gone — this test is about that table`);
  // The table's own opener is the first `= {` after the declaration; the `{` inside a
  // `Record<string, { ... }>` type annotation is not preceded by `=`.
  const opener = /=\s*\{/.exec(source.slice(at));
  if (opener === null) throw new Error(`${declaration} has no object literal`);
  return matchBraces(source, at + opener.index + opener[0].length - 1);
}

export function locateRegionBlocks(source: string): Map<string, string> {
  const table = tableOf(source, "const REGION_THEMES");

  const blocks = new Map<string, string>();
  const entry = /([A-Z][A-Z0-9_]*):\s*\{/g;
  let cursor = 0;
  for (let m = entry.exec(table); m !== null; m = entry.exec(table)) {
    if (m.index < cursor) continue; // a nested object inside the block we just consumed
    const start = m.index + m[0].length - 1; // the `{` the match ends on
    const block = matchBraces(table, start);
    cursor = start + block.length; // one past the block's closing `}`, not `m.index` + length
    const fill = /mapFill:\s*"var\(\s*--region-([a-z-]+)\s*[,)]/.exec(block);
    if (fill !== null) blocks.set(fill[1]!, block);
  }
  return blocks;
}

const blocks = locateRegionBlocks(page);

describe("the region block locator", () => {
  it("finds exactly the seven regions, one block each", () => {
    expect([...blocks.keys()].sort()).toEqual([...SLUGS].sort());
  });

  it("is honest: a hue planted in one block is seen only in that block", () => {
    // The positive control. A locator that returned "", that returned the same text for
    // every slug, or that was off by one would pass a `not.toMatch` assertion while the bug
    // was fully present — that is precisely how the first draft of this file failed.
    const fixture = [
      "const REGION_THEMES: Record<string, { mapFill: string }> = {",
      '  MARMARA: { badgeClass: "bg-amber-500/15", mapFill: "var(--region-marmara, #0072b2)" },',
      '  EGE: { badgeClass: "bg-[var(--region-ege-tint)]", mapFill: "var(--region-ege, #e69f00)" },',
      "};",
    ].join("\n");
    const found = locateRegionBlocks(fixture);

    expect([...found.keys()]).toEqual(["marmara", "ege"]);
    expect(found.get("marmara")).toMatch(RAW_HUE);
    expect(found.get("ege")).not.toMatch(RAW_HUE);
    // And the two blocks are genuinely different text, not one block handed out twice.
    expect(found.get("marmara")).not.toEqual(found.get("ege"));
  });
});

describe("a region wears one colour, not two", () => {
  it.each(SLUGS)("%s does not paint its badge with a raw palette hue", (slug) => {
    const block = blocks.get(slug);
    // Positive control, inline: assert we are holding a real descriptor block before
    // asserting what is absent from it. `not.toMatch` on "" or on undefined is a green run
    // that means nothing.
    expect(block, `no REGION_THEMES block names --region-${slug}`).toBeDefined();
    expect(block).toContain("badgeClass:");
    expect(block).toContain(`--region-${slug},`);

    expect(block).not.toMatch(RAW_HUE);
  });

  it.each(SLUGS)("%s draws its badge from its own region token", (slug) => {
    const block = blocks.get(slug)!;
    // The page no longer spells the token; it names the identity, and the identity is what
    // spells the token. Both halves are asserted, because either one alone is satisfiable
    // while the bug is present: a block could name the WRONG region's identity, and an
    // identity could be bound to the wrong region's tokens.
    expect(block).toContain(identityReference(slug));
    expect(REGION_IDENTITY[slug].badge).toContain(`--region-${slug}-tint`);
    expect(REGION_IDENTITY[slug].badge).toContain(`--region-${slug}-text`);
  });

  it.each(SLUGS)("%s declares both derived members in app/globals.css", (slug) => {
    // The page can only reference what the stylesheet defines. Light mode declares both
    // members; `.dark` re-declares `-text` alone, because the tint is translucent and
    // composites over whichever card it lands on.
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    expect(css).toContain(`--region-${slug}-tint:`);
    expect(
      css.match(new RegExp(`--region-${slug}-text:`, "g")) ?? [],
      `--region-${slug}-text must be declared twice: once in :root and once in .dark`,
    ).toHaveLength(2);
  });
});

/**
 * The badge's backdrop is the one `app/globals.css` names, with nothing unnamed on top of it.
 *
 * `--region-*-text` is measured against a backdrop the stylesheet spells out: the badge's tint
 * over the hero gradient's tint end over `--background`. That table was once true of the model
 * and false of the paint, because the hero also carried an unbounded decorative overlay —
 * `absolute -z-10 top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl`. `size-96` is
 * 384px and `blur-3xl` spreads it further, so below `md` it was wider than the viewport and
 * washed over the badge row, taking all seven regions to 4.22-4.49 at 320px while the recorded
 * figures said 4.59-4.77. A decoration was deciding whether a data label cleared 4.5:1.
 *
 * ## What this test can and cannot do
 *
 * It CANNOT check the ratio. A Gaussian blur is not a blend any analytic model expresses —
 * `app/globals.css` says so where it explains what `HERO` excludes — so the numbers come from
 * painted pixels at every supported width and live in comments beside the code that produced
 * them. That is measurement, and measurement does not run in CI.
 *
 * It CAN check the SHAPE, which is what actually regressed: a fixed-size blurred overlay
 * positioned over hero content with no width bound on it. That is a static property of the
 * markup, so it belongs in a test rather than in a comment asking the next person to remember.
 */
describe("no unbounded blurred overlay sits over the region badge", () => {
  /** Every `className` literal in the page that paints a positioned, blurred overlay. */
  const overlays = [...page.matchAll(/className="([^"]*)"/g)]
    .map((m) => m[1]!)
    .filter((cls) => /\babsolute\b/.test(cls) && /\bblur-(?:xs|sm|md|lg|xl|2xl|3xl)\b/.test(cls));

  it("finds the overlay at all — positive control", () => {
    // Without this, a renamed class or a deleted div would empty the list and make the
    // assertion below vacuously green — the same hollow-pass shape this file was written to
    // kill. If the hero legitimately stops carrying a blurred overlay, delete this describe
    // block rather than letting it pass on nothing.
    expect(
      overlays,
      "no blurred overlay found in the hero — if it is genuinely gone, retire this guard",
    ).not.toHaveLength(0);
  });

  it.each(overlays)("%s is bounded away from the narrow widths it would wash over", (cls) => {
    // `hidden md:block` is what the hero uses. Any equivalent that removes it below `md` is
    // fine; what is not fine is no bound at all, which is the state that shipped.
    expect(
      /\bhidden\b/.test(cls) && /\bmd:(?:block|flex|grid|inline-block)\b/.test(cls),
      `this overlay paints at every width. size-96 + blur-3xl is wider than a 320px viewport, ` +
        `so it lands on the region badge and falsifies the --region-*-text figures recorded in ` +
        `app/globals.css. Bound it (hidden md:block) or re-measure every width and re-record.`,
    ).toBe(true);
  });
});

describe("the region card deck wears the same colour", () => {
  const deck = readFileSync(
    fileURLToPath(new URL("./v2-turkey-regions.tsx", import.meta.url)),
    "utf8",
  );

  it("carries no raw palette hue at all", () => {
    // Narrower than the page: this file's ONLY colour was the seven card headers, so there is
    // nothing left here that a raw hue could legitimately be.
    expect(deck.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it.each(SLUGS)("%s's card header is bound to its own region token", (slug) => {
    expect(deck).toContain(identityReference(slug));
    expect(REGION_IDENTITY[slug].banner).toContain(`--region-${slug}-tint`);
    expect(REGION_IDENTITY[slug].banner).toContain(`--region-${slug}-text`);
  });

  /**
   * The assertion above is necessary and NOT sufficient, and the difference is a bug this file
   * shipped once: both token names were in the source, on the banner `<div>`, while the heading
   * they were meant to colour took a base rule instead. The grep stayed green throughout,
   * because the tokens really were in the file — they just painted nothing.
   *
   * TWO base rules in `app/globals.css` sit between the div and the text, and each beats a
   * merely inherited colour: `h1,h2,h3,h4 { color: var(--foreground) }` and
   * `a { color: var(--link) }`. The first shipped version had neither escape and rendered
   * `--link` terracotta for all seven; adding only the `a` escape rendered `--foreground` for
   * all seven, because the anchor then inherits the h3's own base colour rather than the div's.
   * Both `[&_h3]:text-inherit` and `[&_a]:text-inherit` are required, and Tailwind emits both
   * into the utilities layer, which outranks `@layer base` whatever the specificity.
   *
   * Deleting either one reintroduces the bug, and deleting either one reds this test.
   */
  it("routes that token through to the heading's anchor, which two base rules would win", () => {
    const banner = /<div\s+className=\{`p-4 \$\{region\.identityClass\}([^`]*)`\}/.exec(deck);
    expect(
      banner,
      "the header banner div is no longer recognisable — re-anchor this test",
    ).not.toBeNull();
    expect(banner![1]).toContain("[&_h3]:text-inherit");
    expect(banner![1]).toContain("[&_a]:text-inherit");

    // Positive control on the premise: there really is an anchor inside this banner, and it
    // really does not respell the colour itself. If the markup ever stops rendering a Link
    // here, or starts carrying its own `text-…`, this assertion is measuring the wrong thing
    // and should be revisited rather than left quietly green.
    const bannerBlock = deck.slice(banner!.index, deck.indexOf("</div>", banner!.index));
    expect(bannerBlock).toContain("<Link");
    expect(bannerBlock.match(/<Link[\s\S]*?className="([^"]*)"/)![1]).not.toMatch(/\btext-/);
  });
});

/**
 * The module the other four tables now read.
 *
 * Its job is narrow and checkable: turn a `--region-*` token into a class, once. What it must
 * NOT do is what the four tables it replaced did — hold a hue of its own, or hand one region
 * another region's token. Both are asserted, because "no raw hue" alone would be satisfied by a
 * module that bound every region to `--region-marmara`.
 */
describe("one module spells a region's colour", () => {
  const identitySource = readFileSync(
    fileURLToPath(new URL("../../lib/theme/region-identity.ts", import.meta.url)),
    "utf8",
  );

  it("holds no raw palette hue of its own", () => {
    expect(identitySource.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("has one entry per region, and each entry knows its own slug", () => {
    expect(Object.keys(REGION_IDENTITY).sort()).toEqual([...SLUGS].sort());
    for (const slug of SLUGS) expect(REGION_IDENTITY[slug].slug).toBe(slug);
  });

  it.each(SLUGS)("%s names no region token but its own", (slug) => {
    const named = new Set<string>();
    for (const cls of Object.values(REGION_IDENTITY[slug])) {
      for (const m of cls.matchAll(/--region-([a-z-]+?)(?:-tint|-text)?\)/g)) named.add(m[1]!);
    }
    // Positive control on the premise: the entry really does reference tokens at all, so an
    // entry that had been emptied could not pass by naming nothing.
    expect(named.size, `${slug} references no --region-* token`).toBeGreaterThan(0);
    expect([...named]).toEqual([slug]);
  });

  it("crosses from the API enum to the identity without a second mapping", () => {
    for (const region of REGION_KEYS) {
      expect(regionIdentityOf(region).slug).toBe(regionSlug(region));
    }
  });
});

/**
 * The two tables T-031c Task 4 bound: the `/turkiye` explorer's map fill and the game screen's
 * region round. Between them they were 91 raw palette occurrences, and the explorer's was the
 * one that mattered most — its `color` field WAS the map fill, so `/turkiye` painted Marmara
 * amber while `/turkiye/bolge/marmara`, one breadcrumb click away, painted it blue.
 */
describe("the /turkiye map and the game map wear the same colour as the pages they link to", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const explorer = read("./v2-turkey-map-explorer.tsx");
  const game = read("./v2-game-screen.tsx");

  it("REGION_DATA names an identity per region and holds no hue of its own", () => {
    const table = tableOf(explorer, "export const REGION_DATA");
    // Positive control: we are holding the table, not an empty string a `not.toMatch` would
    // pass on.
    expect(table).toContain("identity:");
    expect(table).not.toMatch(RAW_HUE);
    for (const slug of SLUGS) expect(table).toContain(identityReference(slug));
  });

  it("the game map paints regions from the module, not from a table of its own", () => {
    expect(
      game.includes("REGION_COLOR_CLASSES"),
      "the game screen has grown its own region colour table again",
    ).toBe(false);
    expect(game).toContain("regionIdentityOf(prov.target.region).fillSoft");
  });
});
