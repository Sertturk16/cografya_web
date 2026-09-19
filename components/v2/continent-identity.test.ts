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
