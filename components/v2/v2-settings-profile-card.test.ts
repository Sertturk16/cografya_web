import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import type { AcceptedPlugin } from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * The role-change notice is a live region (T-109). A `role="status"` element that enters the
 * accessibility tree at the same moment as its text is not announced by most screen readers,
 * so while it is empty it must stay in the tree and take no space: hidden by clipping, never
 * by `display: none` or `visibility: hidden`.
 *
 * The class list is read from source and COMPILED through the project's Tailwind plugin, so
 * the assertion is about the CSS that ships, not about a class name: swapping `empty:sr-only`
 * back to `empty:hidden` (or to `empty:invisible`) turns this red.
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PROFILE = stripComments(
  readFileSync(join(__dirname, "v2-settings-profile-card.tsx"), "utf8"),
);

function statusRegionClasses(): string[] {
  const classList = PROFILE.match(/<p\s+role="status"\s+className="([^"]+)"\s*>/)?.[1];
  if (classList === undefined)
    throw new Error('no <p role="status" className="..."> in the profile card');
  return classList.split(/\s+/);
}

async function compileClasses(classes: readonly string[]): Promise<string> {
  // `source(none)` keeps Tailwind from scanning the repo; `@source inline` feeds it exactly
  // these classes. The cast is the same nested-postcss type boundary `compiled-stylesheet.test.ts`
  // documents.
  const css =
    '@import "tailwindcss" source(none);\n' +
    `@source inline(${JSON.stringify(classes.join(" "))});\n`;
  const plugin = tailwindcss({ base: ROOT }) as AcceptedPlugin;
  const result = await postcss([plugin]).process(css, { from: join(ROOT, "app/globals.css") });
  return result.css;
}

/** Declarations of every rule whose selector names an `empty:` variant. */
function emptyVariantDeclarations(css: string): string[] {
  const declarations: string[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (!rule.selector.includes(":empty")) return;
    rule.walkDecls((decl) => void declarations.push(`${decl.prop}: ${decl.value}`));
  });
  return declarations;
}

describe("role-change notice live region (T-109)", () => {
  it("hides its empty state by clipping, keeping it in the accessibility tree", async () => {
    const classes = statusRegionClasses();
    const emptyClasses = classes.filter((c) => c.startsWith("empty:"));
    expect(emptyClasses.length, "the empty state is no longer hidden at all").toBeGreaterThan(0);

    const declarations = emptyVariantDeclarations(await compileClasses(emptyClasses));
    expect(declarations).not.toContain("display: none");
    expect(declarations).not.toContain("visibility: hidden");
    expect(declarations).toContain("position: absolute");
  });
});
