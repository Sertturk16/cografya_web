import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGION_TINTS } from "@/lib/theme/region-palette.test";

/**
 * A region wears ONE colour.
 *
 * `turkiye/bolge/[slug]` gives every region a `mapFill` bound to its `--region-*` token and,
 * in the same object literal, a `badgeClass` / `accentColor` / `gradient` / `borderAccent`
 * set that was written in an unrelated raw Tailwind hue. Marmara was badged amber and
 * painted blue; Ege was badged teal and painted orange. Six of seven disagreed. This file is
 * what keeps the two halves of a region's identity from drifting apart again.
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

const SLUGS = Object.keys(REGION_TINTS);

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
 * Brace-match forward from the `{` at `open`, ignoring braces inside string literals.
 *
 * Quote-awareness is not decoration: a descriptor value is a class string, and a class string
 * is exactly where a stray brace would otherwise desynchronise the depth counter.
 */
function matchBraces(source: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i++) {
    const c = source[i]!;
    if (quote !== null) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
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
export function locateRegionBlocks(source: string): Map<string, string> {
  const declaration = source.indexOf("const REGION_THEMES");
  if (declaration < 0) {
    throw new Error("REGION_THEMES is gone from the page — this test is about that table");
  }
  // The table's own opener is the first `= {` after the declaration; the `{` inside the
  // `Record<string, { ... }>` type annotation is not preceded by `=`.
  const opener = /=\s*\{/.exec(source.slice(declaration));
  if (opener === null) throw new Error("REGION_THEMES has no object literal");
  const table = matchBraces(source, declaration + opener.index + opener[0].length - 1);

  const blocks = new Map<string, string>();
  const entry = /([A-Z][A-Z0-9_]*):\s*\{/g;
  let cursor = 0;
  for (let m = entry.exec(table); m !== null; m = entry.exec(table)) {
    if (m.index < cursor) continue; // a nested object inside the block we just consumed
    const block = matchBraces(table, m.index + m[0].length - 1);
    cursor = m.index + block.length;
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
    expect(block).toContain(`--region-${slug}-tint`);
    expect(block).toContain(`--region-${slug}-text`);
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
    expect(deck).toContain(`--region-${slug}-tint`);
    expect(deck).toContain(`--region-${slug}-text`);
  });
});
