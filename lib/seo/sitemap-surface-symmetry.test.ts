import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLS_SURFACE } from "@/lib/tools/tool-registry";

/**
 * A PAGE IN THE SITEMAP IS NOT `noindex`, AND IT CARRIES THE SURFACE ITS ROW WAS BUILT WITH.
 *
 * ## The rule
 *
 * `app/sitemap.ts` and each page's `generateMetadata` both take a `ContentSurface`. `lib/seo/
 * sitemap-entries.ts` guarantees the head and the sitemap agree — but only about a surface, and
 * only for the value each is handed. Hand one side a different value and the guarantee is intact
 * while the output is contradictory: a URL advertised in `sitemap.xml` whose page says
 * `noindex`, which SEO-POLICY §B6 6.8 calls a BLOCKER.
 *
 * ## Why it was not caught before
 *
 * Nothing compared the two arguments. T-032 PR3 made that expensive: the V2 pages inlined
 * `surface: "noindex"` — correct while they lived under `/v2`, whose layout de-indexed the whole
 * tree — and PR3 moved them onto the canonical URLs `app/sitemap.ts` had been publishing all
 * along. Twelve routes came out of that move advertised and de-indexed at the same time,
 * including the home page, `/turkiye`, `/dunya`, `/deniz`, `/deprem` and the four tool pages.
 *
 * ## Scope
 *
 * Static rows only — the ones written as `sitemapEntriesFor(() => "/path", …)` literals. The
 * dynamic tiers (provinces, countries, books, continents) build their rows in helper functions
 * from api data, so there is no page-file-per-row to compare against; their surfaces are pinned
 * by the tier tests that already exist (`lib/tools/tool-sitemap.test.ts` for the tool tier).
 *
 * A run against a live server is the complete check — every `<loc>` fetched, status and robots
 * meta read — and PR3 did that once by hand across all 307 URLs. This is the part of it that
 * fits in a unit test and runs on every commit.
 */

const repoRoot = new URL("../../", import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, repoRoot)), "utf8");

const SITEMAP = read("app/sitemap.ts");

/** The surface `app/sitemap.ts` passes for each statically-listed pathname. */
const rows = [
  ...SITEMAP.matchAll(/sitemapEntriesFor\(\(\) => "([^"]+)",\s*now,\s*[\d.]+(?:,\s*"([^"]+)")?\)/g),
].map((match) => ({ pathname: match[1]!, surface: match[2] ?? "localized" }));

/**
 * Where each statically-listed pathname's page file lives. Written out rather than derived,
 * because the route-group directories (`(site)`) are not part of the URL — the mapping is
 * exactly the thing a reader cannot infer from the path.
 */
const PAGE_FOR: Record<string, string> = {
  "/": "app/[locale]/(site)/page.tsx",
  "/turkiye": "app/[locale]/(site)/turkiye/page.tsx",
  "/dunya": "app/[locale]/(site)/dunya/page.tsx",
  "/oyun": "app/[locale]/(site)/oyun/page.tsx",
  "/deniz": "app/[locale]/(site)/deniz/page.tsx",
  "/araclar": "app/[locale]/(site)/araclar/page.tsx",
  "/araclar/mesafe-olcme": "app/[locale]/(site)/araclar/mesafe-olcme/page.tsx",
  "/araclar/koordinat-bulma": "app/[locale]/(site)/araclar/koordinat-bulma/page.tsx",
  "/araclar/alan-hesaplama": "app/[locale]/(site)/araclar/alan-hesaplama/page.tsx",
  "/deprem": "app/[locale]/(site)/deprem/page.tsx",
  "/dunya/kita": "app/[locale]/(site)/dunya/kita/page.tsx",
  "/hakkimizda": "app/[locale]/(site)/hakkimizda/page.tsx",
};

/**
 * The surface a page file declares: the literal in its `buildMetadata` call, the tool tier's
 * shared constant, or — when it passes none — `buildMetadata`'s own default.
 */
const declaredSurface = (source: string): string => {
  const literal = /surface: "([^"]+)"/.exec(source);
  if (literal !== null) return literal[1]!;
  if (/surface: TOOLS_SURFACE/.test(source)) return TOOLS_SURFACE;
  return "localized";
};

describe("the static sitemap rows and the pages they point at", () => {
  it("finds every row and knows where its page lives", () => {
    // Anti-vacuity in both directions: a regex that stopped matching would check nothing, and a
    // row added to the sitemap without an entry here would be skipped silently.
    expect(rows.length, "static sitemapEntriesFor rows").toBeGreaterThan(10);
    for (const row of rows) {
      expect(
        PAGE_FOR[row.pathname],
        `no page mapped for sitemap row ${row.pathname}`,
      ).toBeDefined();
    }
    expect(Object.keys(PAGE_FOR).sort(), "PAGE_FOR has an entry with no sitemap row").toEqual(
      rows.map((row) => row.pathname).sort(),
    );
  });

  it("never advertises a page that de-indexes itself", () => {
    for (const row of rows) {
      expect(row.surface, `${row.pathname} is published as noindex`).not.toBe("noindex");
      expect(
        declaredSurface(read(PAGE_FOR[row.pathname]!)),
        `${row.pathname} is in the sitemap but its page declares noindex`,
      ).not.toBe("noindex");
    }
  });

  it("hands the page and the row the SAME surface", () => {
    for (const row of rows) {
      expect(
        declaredSurface(read(PAGE_FOR[row.pathname]!)),
        `${row.pathname}: page and sitemap row disagree`,
      ).toBe(row.surface);
    }
  });
});
