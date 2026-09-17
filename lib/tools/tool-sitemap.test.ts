import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOL_HUB_PATHNAME, TOOL_REGISTRY, TOOLS_SURFACE } from "./tool-registry";
import { stripComments } from "@/lib/test-support/strip-comments";

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
  // The sitemap's docblock names `/araclar` in prose; a scan that counted that would report a
  // row nobody ships. The shared scanner knows a `//` inside a URL literal from a comment.
  return stripComments(
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8").replace(
      /\r\n/g,
      "\n",
    ),
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
const TOOLS_DIR = new URL("../../app/[locale]/(site)/araclar/", import.meta.url);
const PAGE_SOURCES = [
  "page.tsx",
  ...readdirSync(fileURLToPath(TOOLS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // `[...rest]` is the tier's 404 BOUNDARY (fix round, İRİS finding A1 —
    // `app/[locale]/(site)/araclar/[...rest]/page.tsx`'s own docblock), never a tool, and carries no
    // `TOOLS_SURFACE` declaration to compare — excluded the same way
    // `tool-registry.test.ts` excludes it, by dynamic-segment name rather than a hand-listed
    // one.
    .filter((entry) => !entry.name.startsWith("["))
    .map((entry) => `${entry.name}/page.tsx`)
    .filter((relative) => existsSync(fileURLToPath(new URL(relative, TOOLS_DIR))))
    .sort(),
].map((relative) => ({
  path: `app/[locale]/(site)/araclar/${relative}`,
  code: codeOnly(`../../app/[locale]/(site)/araclar/${relative}`),
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
    /**
     * V1 declared `const TOOLS_SURFACE: ContentSurface = "…"` in each of the four page files,
     * and this test compared the four against each other and against the sitemap. There is now
     * ONE declaration, exported from `lib/tools/tool-registry.ts`, so the pages cannot disagree
     * by construction — what is left to check is that each page actually reads it (an inlined
     * literal beside the import would satisfy a naive import check) and that the sitemap rows
     * were built from the same value.
     *
     * This is not a loosening. T-032 PR3 is the reason it changed: the V2 rewrite had inlined
     * `surface: "noindex"` in all four pages — correct under `/v2`, whose layout de-indexed the
     * tree — and PR3 moved them onto the canonical URLs `app/sitemap.ts` already publishes. Four
     * `noindex` pages advertised in `sitemap.xml` is a SEO-POLICY §B6 6.8 blocker, and the old
     * assertion could not see it: all four pages agreed with each other, and the surface
     * comparison against the sitemap only ran after a regex that no longer matched anything.
     */
    for (const { path, code } of PAGE_SOURCES) {
      expect(code, `${path} must import TOOLS_SURFACE`).toContain(
        'from "@/lib/tools/tool-registry"',
      );
      expect(code, `${path} must import TOOLS_SURFACE`).toMatch(/\bTOOLS_SURFACE\b/);
      expect(code, `${path} must pass TOOLS_SURFACE, not a literal`).toMatch(
        /surface: TOOLS_SURFACE,/,
      );
      expect(code, `${path} must not also spell a surface out`).not.toMatch(/surface: "/);
    }

    // One value across the whole tier: the constant, and every sitemap row built from it.
    expect(new Set([TOOLS_SURFACE, ...toolEntries.map((entry) => entry.surface)]).size).toBe(1);
    // And it is not `noindex` — the tier is published in the sitemap.
    expect(TOOLS_SURFACE).not.toBe("noindex");
  });
});
