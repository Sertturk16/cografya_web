import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { NEIGHBOR_VIA_TERRITORY } from "./neighbor-via-territory";

/**
 * REGRESSION SHIELD — the WIRING between the pair table and the rendered card.
 *
 * `neighbor-via-territory.test.ts` proves the table. It cannot prove the page asks the table
 * the right question, and that gap has a one-token failure inside it (→ PR #72 `TA72-I1`):
 *
 *   neighborViaTerritory(country.isoCode, iso, locale)   // host first — correct
 *   neighborViaTerritory(iso, country.isoCode, locale)   // the natural slip: `iso` is the
 *                                                        // loop variable and reads like the
 *                                                        // subject
 *
 * Swapped, `/dunya/brezilya` asks ("FR","BR") → null and loses the fix silently, while
 * `/dunya/fransa` asks ("BR","FR") → a hit and ships "Brezilya (Fransız Guyanası)" on an
 * indexable page — the exact reading `neighbor-via-territory.ts` records as a deliberate
 * non-goal, and the one the unit suite's own "is DIRECTIONAL" test exists to prevent. Both
 * params are `string`, so `tsc` is silent; all unit tests still pass; CI is green.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. Same constraint
 * `components/map/inland-water-layer.contract.test.ts` and `components/route-urls.test.ts`
 * document: one `node` vitest environment, no jsdom, and the consumer is an async Server
 * Component that reaches the api. A source invariant is the honest version of the guard — it
 * runs today, costs nothing, and fails on the exact edit it is meant to stop. It does not
 * claim to prove the DOM; the PR's rendered samples do that.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip block comments and whole-line `//`, so this file's own prose about the swapped-arg
 *  bug — quoted verbatim above — is never mistaken for the code it warns about. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const PAGE = code(sourceOf("../../app/[locale]/dunya/[slug]/page.tsx"));

describe("the country page's neighbour-label wiring", () => {
  it("asks the table HOST first, neighbour second", () => {
    expect(PAGE).toContain("neighborViaTerritory(country.isoCode, iso, locale)");
    // The inverse, stated separately: `toContain` above would still pass if a SECOND,
    // swapped call were added beside the correct one.
    expect(PAGE).not.toMatch(/neighborViaTerritory\(\s*iso\s*,/);
  });

  it("passes the request locale, never a hard-coded one", () => {
    // A literal would make every EN card print the Turkish territory name (or vice versa).
    expect(PAGE).not.toMatch(/neighborViaTerritory\([^)]*["'](?:tr|en)["']\s*\)/);
  });

  it("labels BOTH neighbour branches through the same helper", () => {
    // The seeded branch (a real link) and the unseeded branch (plain text). Dropping the
    // helper on either one ships a bare name on that branch only — invisible in a sample
    // that happens to show the other.
    const calls = PAGE.match(/neighborLabel\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3); // 1 definition + 2 call sites
    expect(PAGE).toContain('kind: "link"');
    expect(PAGE).toContain('kind: "text"');
  });

  it("renders the resolved label, not the raw name", () => {
    // `neighbor.name` was renamed to `neighbor.label` precisely so a missed rename is a
    // compile error rather than a silently bare card.
    expect(PAGE).not.toMatch(/\{neighbor\.name\}/);
    expect(PAGE).toMatch(/\{neighbor\.label\}/);
  });

  it("keeps the künye row behind the null guard", () => {
    // → TA72-M4. The ~26 rows with no note (20 null + 6 absent) and every EN page must not
    // render a labelled-but-empty "Bağımsızlık" card. The guard is a move, not a new
    // condition — it is byte-identical to the one the removed <section> used.
    expect(PAGE).toContain("independenceNote !== null &&");
    expect(PAGE).toContain("isTr ? country.independenceNoteTr : null");
  });
});

/**
 * CATALOGUE GUARD for the keys this feature minted (→ PR #72 `TA72-I2` / `CR72-M1`).
 *
 * next-intl logs `console.error` on a missing or typo'd key and ships the dotted key string
 * into the page — it does NOT fail the build, so `tsc`, `eslint`, `build` and the rest of the
 * suite stay green while 173 pages render the literal "CountryDetail.independence" as a label.
 * The keys this diff REMOVED were guarded, because `COUNTRY_HEADING_KEY`'s totality test
 * enumerated them; removing them narrowed the guarded set at the same moment two unguarded
 * keys shipped. This closes that.
 */
const CATALOGUES = { tr: trMessages, en: enMessages } as const;

describe("CountryDetail keys minted by the künye row and the neighbour parenthetical", () => {
  for (const [locale, messages] of Object.entries(CATALOGUES)) {
    it(`${locale}.json CountryDetail.independence is a plain non-empty label`, () => {
      const value = messages.CountryDetail.independence;
      expect(typeof value).toBe("string");
      expect(value.trim()).not.toBe("");
      // A fact-sheet <dt> takes no interpolation; a stray placeholder would render raw.
      expect(value).not.toContain("{");
    });

    for (const key of ["neighborVia", "neighborViaThrough"] as const) {
      it(`${locale}.json CountryDetail.${key} keeps BOTH placeholders`, () => {
        const value = messages.CountryDetail[key];
        expect(typeof value).toBe("string");
        // Losing {territory} is the quiet half: `t(key, {name, territory})` still resolves,
        // the extra param is ignored, and the card reverts to the bare name this whole PR
        // exists to fix — with nothing failing and nothing logged.
        expect(value).toContain("{name}");
        expect(value).toContain("{territory}");
      });
    }
  }

  it("every wording the table can select has a key in BOTH catalogues", () => {
    // Derived from the table rather than restated, so a future wording cannot be added to
    // the module and left without copy.
    const keys = new Set(
      Object.values(NEIGHBOR_VIA_TERRITORY).flatMap((byNeighbor) =>
        Object.values(byNeighbor).map((territory) =>
          territory.wording === "through" ? "neighborViaThrough" : "neighborVia",
        ),
      ),
    );
    expect(keys.size).toBeGreaterThan(0);
    for (const key of keys) {
      expect(Object.keys(trMessages.CountryDetail)).toContain(key);
      expect(Object.keys(enMessages.CountryDetail)).toContain(key);
    }
  });
});
