import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { TOOL_HUB_PATHNAME, TOOL_REGISTRY } from "./tool-registry";

/**
 * THE TOOL TIER'S THREE SIDES MUST AGREE: the register, the routing table, and the pages on
 * disk.
 *
 * A tool is a page (`app/[locale]/araclar/{segment}/page.tsx`), a route
 * (`i18n/routing.ts`) and a hub card built from `TOOL_REGISTRY`. Nothing in the type system
 * ties them together, and each mismatch has a different, silent failure:
 *
 *  · register entry with no page → the hub links, the sitemap advertises, and the URL 404s.
 *    `SEO-POLICY.md` A4/3 + §B8 8.8 + §B6 6.8 each rate that a BLOCKER;
 *  · page with no register entry → an indexable page reachable from no static internal link
 *    (§B8 8.1, BLOCKER — the orphan case);
 *  · register entry with no route → `getPathname` throws at render time.
 *
 * DERIVED, NOT RESTATED: the expected directory set is read off the filesystem and the
 * expected URLs off the routing table, so this file cannot pass by having been edited in
 * step with a rename. The literal-URL guard is the one deliberate exception, for the reason
 * `lib/seo/book-routes.test.ts` gives: a structural assertion cannot see a broken table.
 *
 * Structural only (`CONVENTIONS.md` §2) — nothing here asserts a fact about the world or a
 * word of copy.
 */

const TOOLS_DIR = new URL("../../app/[locale]/araclar/", import.meta.url);

/** Every subdirectory of the tool hub that actually ships a page. */
const pageSegments = readdirSync(fileURLToPath(TOOLS_DIR), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  // `[...rest]` is the tier's 404 BOUNDARY (fix round, İRİS finding A1 —
  // `app/[locale]/araclar/[...rest]/page.tsx`'s own docblock), never a tool: a real tool
  // segment is always `[a-z0-9-]+` (the transliteration guard below), so any directory name
  // that is itself a Next.js dynamic-segment token (`[…]`) is excluded on sight rather than
  // by a hand-maintained name, which is what keeps this filter correct if a second boundary
  // segment is ever added.
  .filter((name) => !name.startsWith("["))
  .filter((name) => existsSync(fileURLToPath(new URL(`${name}/page.tsx`, TOOLS_DIR))))
  .sort();

/** The TR segment each register entry claims, taken from the routing table. */
function trSegmentOf(pathname: (typeof TOOL_REGISTRY)[number]["pathname"]): string {
  const entry = routing.pathnames[pathname];
  const tr = typeof entry === "string" ? entry : entry.tr;
  return tr.slice(tr.lastIndexOf("/") + 1);
}

describe("tool registry", () => {
  it("registers at least one tool", () => {
    // Anchors every derivation below: an empty register would satisfy the set comparisons
    // vacuously, which is the failure mode `ATLAS-OPERATIONS.md` calls a clean result that
    // is wrong.
    expect(TOOL_REGISTRY.length).toBeGreaterThan(0);
  });

  it("gives every registered tool a route in the routing table", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(Object.keys(routing.pathnames)).toContain(tool.pathname);
    }
  });

  it("declares no tool route the register does not know about", () => {
    // The direction the other three assertions leave open (→ PR #73 review `TEST73-M1`). A
    // `/araclar/…` pathname in the routing table with no register entry and no page passes
    // everything else here — and it is the ENABLING half of the hub-card path: the hub's card
    // list is a hand-written tuple in `app/`, outside vitest's collection, and a card's `href`
    // only has to be a DECLARED `AppPathname` to type-check. Close this direction and a card
    // cannot point at a route that has no page (`SEO-POLICY.md` A4/3, §B8 8.8).
    const declared = Object.keys(routing.pathnames)
      .filter((pathname) => pathname.startsWith(`${TOOL_HUB_PATHNAME}/`))
      // `/araclar/[...rest]` is the tier's 404 boundary, declared in `routing.ts` on purpose
      // (fix round, İRİS finding A1) so the EN alias reverse-maps correctly — it is not a
      // tool route and carries no register entry, page-on-disk, or sitemap row by design.
      .filter((pathname) => !pathname.includes("["))
      .sort();
    expect(declared).toEqual(TOOL_REGISTRY.map((tool) => tool.pathname).sort());
  });

  it("matches the pages on disk exactly, in both directions", () => {
    expect(pageSegments).toEqual(TOOL_REGISTRY.map((tool) => trSegmentOf(tool.pathname)).sort());
  });

  it("nests every tool under the hub in BOTH locales", () => {
    // The hub is the only static internal link into a tool page (§B8 8.1), so a tool whose
    // URL sits outside the hub's path is reachable but not discoverable — and on `/en` the
    // segment is translated, which is exactly where a hand-built path would drift.
    for (const locale of routing.locales) {
      const hub = getPathname({ locale, href: TOOL_HUB_PATHNAME });
      for (const tool of TOOL_REGISTRY) {
        expect(getPathname({ locale, href: tool.pathname })).toMatch(
          new RegExp(`^${hub}/[a-z0-9-]+$`),
        );
      }
    }
  });

  it("resolves the tool tier to these URLs, literally", () => {
    expect(getPathname({ locale: "tr", href: "/araclar" })).toBe("/araclar");
    expect(getPathname({ locale: "en", href: "/araclar" })).toBe("/en/tools");
    expect(getPathname({ locale: "tr", href: "/araclar/mesafe-olcme" })).toBe(
      "/araclar/mesafe-olcme",
    );
    expect(getPathname({ locale: "en", href: "/araclar/mesafe-olcme" })).toBe("/en/tools/distance");
    expect(getPathname({ locale: "tr", href: "/araclar/koordinat-bulma" })).toBe(
      "/araclar/koordinat-bulma",
    );
    expect(getPathname({ locale: "en", href: "/araclar/koordinat-bulma" })).toBe(
      "/en/tools/coordinates",
    );
    expect(getPathname({ locale: "tr", href: "/araclar/alan-hesaplama" })).toBe(
      "/araclar/alan-hesaplama",
    );
    expect(getPathname({ locale: "en", href: "/araclar/alan-hesaplama" })).toBe("/en/tools/area");
  });

  it("keeps every slug inside the transliteration set GLOSSARY §5 allows", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(trSegmentOf(tool.pathname)).toMatch(/^[a-z0-9-]+$/);
    }
    // The HUB's own segment, in both locales (→ review `TEST73-M2`). `trSegmentOf` never ran
    // over it, so `"/araclar": { tr: "/araçlar" }` would have passed every assertion in this
    // file — a non-ASCII segment in an indexable URL is the thing GLOSSARY §5 exists to stop.
    for (const locale of routing.locales) {
      const hub = getPathname({ locale, href: TOOL_HUB_PATHNAME });
      expect(hub.slice(hub.lastIndexOf("/") + 1)).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("names a learningResourceType that is not the marine hub's", () => {
    // `SEO-POLICY.md` §B5, tool-surface mapping: the type names the page's real shape and
    // `/deniz`'s `"Article"` is explicitly not copied onto it.
    for (const tool of TOOL_REGISTRY) {
      expect(tool.learningResourceType.trim().length).toBeGreaterThan(0);
      expect(tool.learningResourceType).not.toBe("Article");
    }
  });
});
