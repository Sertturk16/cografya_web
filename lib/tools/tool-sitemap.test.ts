import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOL_HUB_PATHNAME, TOOL_REGISTRY } from "./tool-registry";

/**
 * THE FOURTH SIDE OF THE TOOL TIER: the sitemap (→ PR #73 review `TEST73-I4` / `FENER73-M3`).
 *
 * `tool-registry.test.ts` derives the register, the routing table and the pages on disk from
 * each other. `app/sitemap.ts` is the side none of them touches, and it is a hand-written pair
 * of string literals — so both halves of `SEO-POLICY.md` §B6 6.8 are reachable with all three
 * CI jobs green:
 *
 *  · a sitemap row lands BEFORE its page (exactly the PR-B/PR-C/PR-D split this tier invented)
 *    and `/sitemap.xml` advertises a URL that 404s — a BLOCKER;
 *  · a page lands with no row and an indexable page is never advertised at all.
 *
 * The second literal is the SURFACE. `"trNarrative"` is declared once per page file and again,
 * independently, in each sitemap call. When the EN prose lands and a page file flips to
 * `"localized"`, a sitemap left behind advertises `hreflang en` in the head while omitting the
 * EN URL from the urlset (`ENGINEERING.md` §4 #4); the inverse flip puts a `noindex` URL in it.
 * So the surface strings are compared across the three files rather than assumed equal.
 *
 * WHY IT READS SOURCE. `vitest.config.ts` collects `lib/**` and `components/**` only — `app/**`
 * is outside collection, so `app/sitemap.ts` cannot be imported and exercised here. Reading it
 * as source from a test under `lib/` is the repo's established answer to exactly that boundary
 * (`components/route-urls.test.ts`, `components/map/locator-attribution.test.ts`).
 *
 * Structural only (`CONVENTIONS.md` §2): what is asserted is agreement between files, never a
 * fact about the world or a word of copy.
 */

function codeOnly(relativePath: string): string {
  return (
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8")
      .replace(/\r\n/g, "\n")
      // Block comments first, so the `//` inside any URL they carry is gone before line comments
      // are stripped. The sitemap's docblock names `/araclar` in prose; a scan that counted that
      // would report a row nobody ships.
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^[ \t]*\/\/.*$/gm, " ")
  );
}

const SITEMAP = codeOnly("../../app/sitemap.ts");

/**
 * Every page file under the tool hub — DISCOVERED, not listed.
 *
 * A hand-written list would let PR-D's page ship without its `TOOLS_SURFACE` ever being
 * compared to its sitemap row, which is the rot direction `TA56-M4` names: the list would
 * still pass while describing yesterday's tier.
 */
const TOOLS_DIR = new URL("../../app/[locale]/araclar/", import.meta.url);
const PAGE_SOURCES = [
  "page.tsx",
  ...readdirSync(fileURLToPath(TOOLS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // `[...rest]` is the tier's 404 BOUNDARY (fix round, İRİS finding A1 —
    // `app/[locale]/araclar/[...rest]/page.tsx`'s own docblock), never a tool, and carries no
    // `TOOLS_SURFACE` declaration to compare — excluded the same way
    // `tool-registry.test.ts` excludes it, by dynamic-segment name rather than a hand-listed
    // one.
    .filter((entry) => !entry.name.startsWith("["))
    .map((entry) => `${entry.name}/page.tsx`)
    .filter((relative) => existsSync(fileURLToPath(new URL(relative, TOOLS_DIR))))
    .sort(),
].map((relative) => ({
  path: `app/[locale]/araclar/${relative}`,
  code: codeOnly(`../../app/[locale]/araclar/${relative}`),
}));

/** Every tool-tier pathname that may appear in an internal surface today. */
const PUBLISHED = [TOOL_HUB_PATHNAME, ...TOOL_REGISTRY.map((tool) => tool.pathname)].sort();

/** `sitemapEntriesFor(() => "/araclar…", now, 0.7, "trNarrative")` → the path and the surface. */
const TOOL_ENTRY =
  /sitemapEntriesFor\(\s*\(\)\s*=>\s*"(\/araclar[^"]*)"\s*,\s*[^,]+,\s*[^,]+,\s*"([^"]+)"\s*\)/g;

const toolEntries = [...SITEMAP.matchAll(TOOL_ENTRY)].map((match) => ({
  path: match[1]!,
  surface: match[2]!,
}));

describe("the tool tier's sitemap rows", () => {
  it("ships one row per published tool pathname, and no other", () => {
    // Both directions in one comparison: a row for an unbuilt tool fails, and a published tool
    // with no row fails. `PUBLISHED` is derived from the register, so this cannot pass by
    // having been edited in step with the sitemap.
    expect(toolEntries.map((entry) => entry.path).sort()).toEqual(PUBLISHED);
  });

  it("mentions no other /araclar URL anywhere in the file", () => {
    // The assertion above only sees rows in the expected CALL SHAPE. This one catches a row
    // added in any other shape — a raw object pushed into the urlset, a second builder — which
    // would otherwise be invisible to both this file and the register test.
    const literals = [...SITEMAP.matchAll(/"(\/araclar[^"]*)"/g)].map((match) => match[1]!);
    expect(literals.length).toBeGreaterThan(0);
    expect([...new Set(literals)].sort()).toEqual(PUBLISHED);
  });

  it("passes the same surface the page files declare", () => {
    expect(toolEntries.length).toBeGreaterThan(0);
    // Anti-vacuity: the discovery above must have found the hub plus one page per published
    // tool, or the surface comparison below is comparing nothing.
    expect(PAGE_SOURCES.length).toBe(PUBLISHED.length);
    const declared = PAGE_SOURCES.map(({ path, code }) => {
      const match = /const TOOLS_SURFACE: ContentSurface = "([^"]+)"/.exec(code);
      if (match === null) throw new Error(`${path} must declare TOOLS_SURFACE`);
      return match[1]!;
    });

    // One value across the whole tier: every page and every sitemap row. The head↔sitemap
    // symmetry `lib/seo/sitemap-entries.ts` guarantees is only as good as the argument it is
    // handed, and that argument is written out once per page and once per row.
    expect(new Set([...declared, ...toolEntries.map((entry) => entry.surface)]).size).toBe(1);
  });
});
