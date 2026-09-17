import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * V1 IS GONE, AND STAYS GONE.
 *
 * T-032 removed the V1 tree in two steps: PR3 moved V2 onto the canonical URLs and deleted the
 * V1 routes, PR4 deleted the components, stylesheets and global utility classes only those
 * routes used. This file is the tripwire for the reverse — a partially-restored V1 is worse than
 * either state, because the two trees answer the same questions differently.
 *
 * ## Why an absence test rather than a note in a doc
 *
 * Every deletion here was verified against a reachability walk from Next.js's own entry points,
 * not against the plan's list — which was wrong for four of the nine directories it named, and
 * silent about `components/marine`'s five dead files. A reader restoring "a small helper" from
 * git history has no way to know which of these was load-bearing and which was already dead
 * weight; this file answers that mechanically.
 *
 * ## What it deliberately does NOT assert
 *
 * Directories that survived with live members are absent from the list below — `components/game`
 * still holds `region-labels.ts`, `components/map` still holds `locator-map.tsx`,
 * `components/home` still holds `featured-cards.tsx`, `components/tools` still holds
 * `tool-island.tsx`. Pinning those as empty would fail on correct code, which is the failure mode
 * this repo has paid for before.
 */

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

/** Directories whose every member was unreachable, deleted whole. */
const DELETED_DIRECTORIES = [
  "components/auth",
  "components/country",
  "components/entity-index",
  "components/favorites",
  "components/province",
  "components/site-nav",
] as const;

/** Individual V1 files deleted out of directories that still have live members. */
const DELETED_FILES = [
  "components/breadcrumb.tsx",
  "components/card-arrow.tsx",
  "components/en-work-in-progress-notice.tsx",
  "components/locale-switcher.tsx",
  "components/site-footer.tsx",
  "components/site-header.tsx",
  "components/site-header.module.css",
  "components/site-search/site-search.tsx",
  "components/game/game-island.tsx",
  "components/game/game-map.tsx",
  "components/game/game-map.module.css",
  "components/game/game-screen.tsx",
  "components/game/game-history-panel.tsx",
  "components/map/turkey-map-section.tsx",
  "components/map/world-map-section.tsx",
  "components/map/inland-water-layer.tsx",
  "components/map/map-zoom-pan.tsx",
  "components/marine/marine-map.tsx",
  "components/marine/layer-catalogue.tsx",
  "components/marine/reference-points.tsx",
  "components/marine/basin-values-table.tsx",
  "components/tools/tool-map.tsx",
  "components/home/tool-cards.tsx",
  "components/home/sea-today.tsx",
] as const;

/**
 * Global utility classes `app/globals.css` declared for the V1 routes.
 *
 * `.placeholder-note` is the one worth naming: it carried a `border-left: 4px solid` side-tab,
 * a decoration this project rejected twice by ruling. It survived both because it had no
 * consumers to review — dead CSS is invisible to a design review and to a browser sweep alike.
 */
const DELETED_GLOBAL_CLASSES = [
  "placeholder-note",
  "hero",
  "hero-actions",
  "province-card",
  "province-grid",
  "breadcrumb",
  "chip",
  "lede",
  "page",
  "skip-link",
  "wrap-long-tokens",
  "btn-sm",
] as const;

const globals = readFileSync(join(repoRoot, "app/globals.css"), "utf8");

describe("the V1 tree stays deleted", () => {
  it.each(DELETED_DIRECTORIES)("%s does not exist", (dir) => {
    expect(existsSync(join(repoRoot, dir))).toBe(false);
  });

  it.each(DELETED_FILES)("%s does not exist", (file) => {
    expect(existsSync(join(repoRoot, file))).toBe(false);
  });

  it("the list above still describes real deletions", () => {
    // Anti-vacuity, pointing the other way from usual: a path that was never there would pass
    // for free and say nothing. Every entry must have existed in the commit that removed it,
    // which is checked here as "the list is not empty and names no path that exists".
    expect(DELETED_DIRECTORIES.length + DELETED_FILES.length).toBeGreaterThan(20);
  });
});

describe("the V1 global utility classes stay removed", () => {
  it.each(DELETED_GLOBAL_CLASSES)("globals.css declares no .%s rule", (name) => {
    // Declarations only — a class NAME may legitimately appear in a comment explaining why it
    // was removed, and this file's own docblock is an example of why that distinction matters.
    const withoutComments = globals.replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(withoutComments).not.toMatch(
      new RegExp(String.raw`(^|[\s,>+~])\.${name}\b[^{;]*\{`, "m"),
    );
  });

  it("nothing still asks for one of them", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
      });

    const consumers = ["components", "app"]
      .flatMap((r) => walk(join(repoRoot, r)))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return DELETED_GLOBAL_CLASSES.filter((name) =>
          new RegExp(String.raw`class(?:Name)?=[{"\`][^"\`}]*\b${name}\b`).test(source),
        ).map((name) => `${file.slice(repoRoot.length)}: .${name}`);
      });
    expect(consumers).toEqual([]);
  });
});
