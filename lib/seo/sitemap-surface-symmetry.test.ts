import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLS_SURFACE } from "@/lib/tools/tool-registry";
import { AUTH_SURFACE } from "@/lib/auth/auth-metadata";

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
  "/turkiye/bolge": "app/[locale]/(site)/turkiye/bolge/page.tsx",
  "/deniz/marmara": "app/[locale]/(site)/deniz/marmara/page.tsx",
  "/deniz/ege": "app/[locale]/(site)/deniz/ege/page.tsx",
  "/deniz/akdeniz": "app/[locale]/(site)/deniz/akdeniz/page.tsx",
  "/deniz/karadeniz": "app/[locale]/(site)/deniz/karadeniz/page.tsx",
  "/deniz/kiyi-tipleri": "app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx",
  "/deprem/fay-hatlari": "app/[locale]/(site)/deprem/fay-hatlari/page.tsx",
  "/deprem/hazirlik": "app/[locale]/(site)/deprem/hazirlik/page.tsx",
};

/**
 * The surface a page file declares: the literal in its `buildMetadata` call, the tool tier's
 * shared constant, or — when it passes none — `buildMetadata`'s own default.
 */
const declaredSurface = (source: string): string => {
  const literal = /surface: "([^"]+)"/.exec(source);
  if (literal !== null) return literal[1]!;
  if (/surface: TOOLS_SURFACE/.test(source)) return TOOLS_SURFACE;
  // The seven auth shells never call `buildMetadata` directly — `lib/auth/auth-metadata.ts`
  // gate G1 pins that — so they carry no `surface:` literal of their own and would otherwise
  // read as the default `"localized"`, i.e. as nine indexable pages missing from the sitemap.
  if (/buildAuthMetadata\(/.test(source)) return AUTH_SURFACE;
  return "localized";
};

/**
 * THE OTHER DIRECTION: a page that is indexable and NOT in the sitemap.
 *
 * Everything above walks sitemap-row → page. That direction cannot see a page which is
 * crawlable, in the hreflang set, linked from the nav — and simply never advertised. Nine were:
 * `/turkiye/bolge` and its seven regions, the four sea basins, `/deniz/kiyi-tipleri`,
 * `/deprem/fay-hatlari` and `/deprem/hazirlik`, each declaring `"trOnly"` in its own
 * `generateMetadata` while `app/sitemap.ts` listed none of them.
 *
 * What made it invisible rather than merely wrong: `PAGE_FOR` is the test's whole notion of
 * which pages exist, and it held twelve of the tree's thirty-nine. A page absent from BOTH the
 * sitemap and `PAGE_FOR` was absent from the test. So this half does not consult `PAGE_FOR` at
 * all — it walks the route tree.
 */
const ROUTE_ROOT = fileURLToPath(new URL("app/[locale]/", repoRoot));

const walkPages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });

/** `app/[locale]/(site)/deniz/ege/page.tsx` → `/deniz/ege`; route groups are not URL segments. */
const pathnameOf = (file: string): string => {
  const segments = file
    .slice(ROUTE_ROOT.length)
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment !== "" && !segment.startsWith("("));
  return `/${segments.join("/")}`;
};

const pages = walkPages(ROUTE_ROOT).map((file) => ({
  file: file.slice(fileURLToPath(repoRoot).length),
  pathname: pathnameOf(file),
  surface: declaredSurface(readFileSync(file, "utf8")),
}));

/**
 * Indexable pathnames that legitimately have no STATIC sitemap row, each with the tier that
 * builds its rows instead. Exact in both directions: a new dynamic route must be named here, and
 * a route that stops being dynamic must be removed.
 */
const DYNAMIC_TIERS: Record<string, string> = {
  "/turkiye/[slug]": "provinceEntries()",
  "/dunya/[slug]": "countryEntries()",
  "/kitaplar/[slug]": "bookSitemapEntries()",
  "/dunya/kita/[slug]": "continentEntries()",
  "/turkiye/bolge/[slug]": "regionEntries()",
  "/kitaplar": "bookSitemapEntries() — the hub row ships with its tier",
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

describe("every indexable page is advertised somewhere", () => {
  it("walks the whole route tree, not a hand-kept subset", () => {
    // Anti-vacuity, and the specific failure this half exists for: `PAGE_FOR` held twelve of
    // thirty-nine pages, so a page missing from both it and the sitemap was outside the test.
    expect(pages.length, "page.tsx files under app/[locale]").toBeGreaterThan(35);
    expect(pages.length).toBeGreaterThan(Object.keys(PAGE_FOR).length);
    expect(pages.map((page) => page.pathname)).toContain("/turkiye/bolge");
  });

  it("classifies the surfaces it finds, rather than defaulting everything", () => {
    // If `declaredSurface` silently stopped matching, every page would read `"localized"` and
    // the assertion below would demand a sitemap row for all thirty-nine — loud, but for the
    // wrong reason. Pinning the spread keeps the parser honest.
    const bySurface = new Set(pages.map((page) => page.surface));
    expect([...bySurface].sort()).toEqual(["localized", "noindex", "trNarrative", "trOnly"]);
  });

  it("has a sitemap row, a dynamic tier, or a noindex surface — never nothing", () => {
    const advertised = new Set(rows.map((row) => row.pathname));
    const unadvertised = pages
      .filter((page) => page.surface !== "noindex")
      .filter((page) => !advertised.has(page.pathname))
      .filter((page) => !(page.pathname in DYNAMIC_TIERS))
      .map((page) => `${page.pathname} (${page.surface}) — ${page.file}`);
    expect(unadvertised, "indexable, linked, and in no sitemap").toEqual([]);
  });

  it("names no dynamic tier that has stopped being a route", () => {
    // The ratchet's other direction: a tier entry that no longer matches a real page would let
    // a future route inherit the exemption by sharing its pathname.
    const real = new Set(pages.map((page) => page.pathname));
    const phantom = Object.keys(DYNAMIC_TIERS).filter((pathname) => !real.has(pathname));
    expect(phantom, "DYNAMIC_TIERS names a route that does not exist").toEqual([]);
  });
});
