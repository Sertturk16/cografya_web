import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AREA_TOOL, COORDINATE_TOOL, DISTANCE_TOOL, TOOL_REGISTRY } from "./tool-registry";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * Regression guard for the "Diğer araçlar" exit on the three tool detail pages
 * (`SEO-POLICY.md` §B8 8.5, `ENGINEERING.md` §4 #10).
 *
 * ## What survived the V2 rewrite, and what this file used to guard
 *
 * V1 built each tool page out of `{rendersProse && (…)}` blocks over `styles.prose`, and this
 * file walked paren depth to find the LAST such gate so it could prove the related-links section
 * sat OUTSIDE it — because a copy-pasted paragraph could nest the row back inside the Turkish-only
 * gate and silently kill the English page's only exit, with the whole suite still green.
 *
 * V2 replaced that architecture entirely: the prose lives in `V2ToolEducationalContent`, there is
 * no `rendersProse` gate and no `styles.prose`. The assertions that guarded THOSE — the
 * `.proseAfterTool` spacing class, koordinat-bulma's `derecekmHeading` position — have no subject
 * left to guard and are gone with it.
 *
 * The one that still has a subject is the important one, and T-032 PR3 found it violated in the
 * hardest way: the V2 pages had no exit AT ALL, in either locale. Three tool pages published in
 * `app/sitemap.ts`, reachable from the hub, linking onward to nothing. PR3 restored the row as
 * `V2RelatedTools` and this file now guards that.
 *
 * ## Why the shape of the guard changed with it
 *
 * The block is a shared component driven by `TOOL_REGISTRY`, not three hand-written lists, so the
 * failure mode moved: it is no longer "somebody nested this page's copy inside a gate" but "this
 * page does not render it", "it got gated", or "it stopped being register-driven and froze at
 * three tools". Those are what the assertions below test.
 *
 * Structural only (`CONVENTIONS.md` §2) and source-read, for the repo's usual reason: node env,
 * no jsdom, async server components.
 */

/**
 * Comments stripped so a docblock that discusses an identifier BY NAME cannot fake a match — the
 * trap `attribution-separation.test.ts` names for its own file. These pages and the component
 * both carry docblocks that mention the identifiers under test.
 */
function codeOnly(path: string): string {
  return stripComments(readFileSync(new URL(path, import.meta.url), "utf8"));
}

const PAGES = [
  {
    name: "mesafe-olcme",
    path: "../../app/[locale]/(site)/araclar/mesafe-olcme/page.tsx",
    constant: "DISTANCE_TOOL",
  },
  {
    name: "koordinat-bulma",
    path: "../../app/[locale]/(site)/araclar/koordinat-bulma/page.tsx",
    constant: "COORDINATE_TOOL",
  },
  {
    name: "alan-hesaplama",
    path: "../../app/[locale]/(site)/araclar/alan-hesaplama/page.tsx",
    constant: "AREA_TOOL",
  },
] as const;

const relatedComponent = codeOnly("../../components/v2/v2-related-tools.tsx");

/** Register entry → the name it is exported under, so the label-map check can name what it wants. */
const CONSTANT_NAMES = new Map<string, string>([
  [DISTANCE_TOOL.pathname, "DISTANCE_TOOL"],
  [COORDINATE_TOOL.pathname, "COORDINATE_TOOL"],
  [AREA_TOOL.pathname, "AREA_TOOL"],
]);

describe.each(PAGES)("$name — the tier exit", ({ path, constant }) => {
  const source = codeOnly(path);

  it("renders the related-tools row", () => {
    expect(source).toContain("<V2RelatedTools");
    expect(source).toContain('from "@/components/v2/v2-related-tools"');
  });

  it("identifies itself from the register, so it cannot list itself", () => {
    // A page passing a literal, or the wrong constant, would link the reader back to the page
    // they are already on and drop one of the two real exits.
    expect(source).toContain(`current={${constant}.pathname}`);
    expect(source).toContain('from "@/lib/tools/tool-registry"');
  });

  it("does not gate the row on the locale", () => {
    /**
     * The whole point of the row, and the exact regression V1's paren-walking guard existed to
     * catch. Asserted by reading the text immediately before the element rather than by walking
     * a gate that no longer exists: nothing conditional may stand between the last JSX open and
     * the component.
     */
    const idx = source.indexOf("<V2RelatedTools");
    expect(idx).toBeGreaterThan(-1);
    const preceding = source.slice(Math.max(0, idx - 160), idx);
    expect(preceding, "related-tools row is nested inside a conditional").not.toMatch(
      /(?:isTr|locale|rendersProse)[^\n]*&&\s*\(\s*$|\?\s*\(\s*$/,
    );
  });
});

describe("the related-tools row itself", () => {
  it("is driven by the register, not by a frozen list of three", () => {
    // A fourth tool must appear on the other three pages the day it is registered.
    expect(relatedComponent).toContain("TOOL_REGISTRY.filter");
    expect(relatedComponent).toMatch(/tool\.pathname !== current/);
  });

  it("covers every registered tool with a label key", () => {
    // A tool present in the register but missing from the label map would render an empty link.
    // Read from the real constants, so adding a tool without a label fails HERE.
    for (const tool of TOOL_REGISTRY) {
      const constantName = CONSTANT_NAMES.get(tool.pathname);
      expect(constantName, `${tool.pathname} has no exported constant`).toBeDefined();
      expect(relatedComponent, `no label key for ${tool.pathname}`).toContain(
        `[${constantName}.pathname]`,
      );
    }
    expect(TOOL_REGISTRY.length, "register is empty — nothing was checked").toBeGreaterThan(0);
  });

  it("also offers the hub, and takes its own labels from the catalogue", () => {
    expect(relatedComponent).toContain("TOOL_HUB_PATHNAME");
    expect(relatedComponent).toContain('getTranslations("Tools.hub")');
    expect(relatedComponent).toContain('tHub("otherToolsHeading")');
  });
});
