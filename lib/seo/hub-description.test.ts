import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pickHubDescription } from "./hub-description";

/**
 * Structural invariants of the hub meta-description selection (PR #44 review TA-2).
 * Synthetic strings only — the real copy lives in `messages/{tr,en}.json` and is an
 * editorial concern, not a test fixture (CONVENTIONS §2).
 */
const WITH_COUNT = "with-count-variant";
const FALLBACK = "count-less-variant";

describe("pickHubDescription", () => {
  it("publishes the count-bearing variant when the page lists entities", () => {
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 1)).toBe(WITH_COUNT);
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 81)).toBe(WITH_COUNT);
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 196)).toBe(WITH_COUNT);
  });

  it("falls back to the count-less variant when the page lists nothing", () => {
    // The api-outage path: a description promising "81 il" over an empty page is exactly
    // what SEO-POLICY §B2.6 treats as a BLOCKER, so this branch is the guard, not a nicety.
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 0)).toBe(FALLBACK);
  });

  it("never publishes the count-bearing variant for a nonsensical count", () => {
    // Unreachable through the real call path (an array length), pinned so a future caller
    // passing a difference or an index cannot silently produce "…-3 il…" in <head>.
    expect(pickHubDescription(WITH_COUNT, FALLBACK, -1)).toBe(FALLBACK);
  });
});

/**
 * THE BINDING HALF — the assertions above can all pass on hubs that never call this function.
 *
 * They did. Both V2 hub pages wrote their meta description as a fixed string with the count
 * baked in ("Türkiye'nin 81 ili, …", "Dünyanın 199 ülke ve bölgesi, …"), repeated it in their
 * `CollectionPage` structured data, and defaulted the rendered total with `provinces.length || 81`
 * / `countries.length || 199`.
 *
 * `getProvincesResilient` degrading to an empty list is not a hypothetical — tolerating that is
 * its stated job. In that state the page listed nothing while three separate places still
 * promised 81 provinces: SEO-POLICY §B2.6 for the description, §B5 5.7 for the structured data,
 * and a plain untruth in the body. T-032 PR3 restored these pages to an indexable surface, so the
 * promise is live.
 *
 * Source-read, the repo's usual form for files under `app/` that vitest does not collect.
 */
describe("the hub pages take their description from this function", () => {
  const HUBS = [
    { name: "turkiye", path: "../../app/[locale]/(site)/turkiye/page.tsx", count: "81" },
    { name: "dunya", path: "../../app/[locale]/(site)/dunya/page.tsx", count: "199" },
  ] as const;

  describe.each(HUBS)("$name", ({ path, count }) => {
    const raw = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
    /** Comments stripped: each page documents the literal it used to carry. */
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

    it("calls pickHubDescription for the head AND the structured data", () => {
      expect(code).toContain('from "@/lib/seo/hub-description"');
      // Twice: `generateMetadata` and the `CollectionPage` node. One would leave the other free
      // to promise a count the page cannot show.
      expect(code.match(/pickHubDescription\(/g) ?? []).toHaveLength(2);
    });

    it("derives the count from the fetch, with no literal fallback", () => {
      expect(code).not.toMatch(new RegExp(String.raw`\.length \|\| ${count}`));
      expect(code).toMatch(/const total\w+ = \w+\.length;/);
    });

    it("bakes no entity count into a description string", () => {
      // The shape that shipped. A count belongs in the `{count}` slot the catalogue provides,
      // where the fallback variant can take over, never in the sentence itself.
      expect(code, `description still hardcodes ${count}`).not.toMatch(
        new RegExp(String.raw`description:\s*\n?\s*"[^"]*${count}[^"]*"`),
      );
    });
  });
});
