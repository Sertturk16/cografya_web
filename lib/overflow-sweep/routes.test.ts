import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import {
  SWEEP_SHAPES,
  SWEEP_THEMES,
  SWEEP_VIEWPORTS,
  buildSweepUrls,
  uncoveredPathnames,
} from "@/lib/overflow-sweep/routes";

/**
 * THE SWEEP'S ROUTE LIST CANNOT ROT SILENTLY.
 *
 * `pnpm sweep:overflow` is a browser check and does not run in vitest. What runs here is the
 * half that decides WHAT it visits — and that half has two ways of quietly becoming useless,
 * both of which have precedent in this repo:
 *
 *  1. A ROUTE IS RENAMED. T-032 corrected `/turkey/...` to `/turkiye/...` in the routing
 *     table. Had the sweep carried hand-written URL strings, it would have gone on visiting
 *     the old ones, and a 404 page has no horizontal overflow — the check would have stayed
 *     green while measuring nothing. So the list names routing KEYS and this suite proves
 *     every one of them still resolves.
 *
 *  2. A NEW CSS MODULE ARRIVES WITH NO ROUTE. Two of the three defects the sweep exists for
 *     were CSS-Module declarations (`climate.module.css`'s `min-width: 300px`,
 *     `marine-attribution`'s licence notice). The nine surviving modules are therefore the
 *     part of the tree that must stay covered, and coverage is only meaningful if adding a
 *     tenth forces someone to say which page renders it. Nine, not ten, since T-042 deleted
 *     `tools.module.css` — 514 lines whose three importers were all unreachable.
 *
 *     WHAT `modules` ACTUALLY CLAIMS is that the route's import graph reaches the stylesheet —
 *     never that a sweep run renders it. `marine.module.css` is the live example: it is claimed
 *     by `home` and `province`, which genuinely import it, but both marine blocks are gated on
 *     `MARINE_ENABLED`, false in production today, so no current run measures those rules. The
 *     map is honest about reachability and silent about rendering; a flag-gated module is
 *     covered on paper and unmeasured in fact.
 *
 * Neither assertion needs a browser, which is the point: the sweep's aim is checkable even on
 * a run where nobody starts a server.
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const walk = (dir: string, match: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full, match);
    return match(entry.name) ? [full] : [];
  });

const stylesheetNames = ["app", "components"]
  .flatMap((root) => walk(join(repoRoot, root), (name) => name.endsWith(".module.css")))
  .map((path) => path.split("/").at(-1) as string);

describe("sweep shapes", () => {
  it("names only live routing keys", () => {
    const keys = new Set(Object.keys(routing.pathnames));
    const missing = SWEEP_SHAPES.filter((shape) => !keys.has(shape.pathname));
    expect(missing.map((shape) => `${shape.id} → ${shape.pathname}`)).toEqual([]);
  });

  it("gives every shape a unique id and a stated reason", () => {
    const ids = SWEEP_SHAPES.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const shape of SWEEP_SHAPES) {
      expect(shape.why.length, `${shape.id} has no stated reason`).toBeGreaterThan(40);
      expect(shape.locales.length, `${shape.id} visits no locale`).toBeGreaterThan(0);
    }
  });

  it("covers every surviving CSS Module with at least one route", () => {
    const covered = new Set(SWEEP_SHAPES.flatMap((shape) => shape.modules));
    const uncoveredModules = stylesheetNames.filter((name) => !covered.has(name));
    expect(uncoveredModules).toEqual([]);
  });

  it("names no CSS Module that no longer exists", () => {
    const existing = new Set(stylesheetNames);
    const stale = SWEEP_SHAPES.flatMap((shape) => shape.modules).filter(
      (name) => !existing.has(name),
    );
    expect(stale).toEqual([]);
  });
});

describe("buildSweepUrls", () => {
  const urls = buildSweepUrls(routing.pathnames);
  const byId = new Map(urls.map((entry) => [entry.id, entry.url]));

  it("leaves the default locale unprefixed and prefixes the other", () => {
    expect(byId.get("home:tr")).toBe("/");
    expect(byId.get("home:en")).toBe("/en");
  });

  it("uses the localized segment for the requested locale", () => {
    // `/turkiye/[slug]` is a SINGLE segment in both locales; `/deniz` is localized. Both
    // conventions live in the same table, and the sweep has to read both correctly.
    expect(byId.get("province:tr")).toBe("/turkiye/istanbul");
    expect(byId.get("province:en")).toBe("/en/turkiye/istanbul");
    expect(byId.get("sea:tr")).toBe("/deniz/karadeniz");
    expect(byId.get("sea:en")).toBe("/en/sea/black-sea");
  });

  it("fills every dynamic segment", () => {
    for (const entry of urls) {
      expect(entry.url, `${entry.id} has an unfilled segment`).not.toContain("[");
      expect(entry.url.startsWith("/"), `${entry.id} is not root-relative`).toBe(true);
    }
  });

  it("throws rather than visiting a route that no longer exists", () => {
    const shape = {
      id: "ghost",
      pathname: "/turkey/[slug]",
      params: { slug: "istanbul" },
      locales: ["tr"],
      modules: [],
      why: "a renamed route, of the kind T-032 corrected",
    } as const;
    expect(() => buildSweepUrls(routing.pathnames, [shape])).toThrow(/not a key of routing/);
  });

  it("throws rather than requesting a URL with a hole in it", () => {
    const shape = {
      id: "holed",
      pathname: "/turkiye/[slug]",
      locales: ["tr"],
      modules: [],
      why: "a dynamic route whose params were forgotten",
    } as const;
    expect(() => buildSweepUrls(routing.pathnames, [shape])).toThrow(
      /no value for the \[slug\] segment/,
    );
  });
});

describe("uncoveredPathnames", () => {
  it("reports the routing entries no shape visits", () => {
    const uncovered = uncoveredPathnames(routing.pathnames);
    // Informational, not a rule: the sweep is a set of shapes on purpose. What is asserted
    // is that the footer is honest — nothing swept appears in it.
    const swept = new Set(SWEEP_SHAPES.map((shape) => shape.pathname));
    expect(uncovered.filter((key) => swept.has(key))).toEqual([]);
    expect(uncovered.length + swept.size).toBe(Object.keys(routing.pathnames).length);
  });
});

describe("sweep matrix", () => {
  it("checks the three phone widths the repo commits to, plus 768 and desktop", () => {
    // 768 is not decoration: without it `md:min-w-[900px] lg:min-w-0` passes all eight
    // checks, inactive below 768 and harmless at 1440. See the docblock on SWEEP_VIEWPORTS
    // for which band it closes and which two remain.
    expect(SWEEP_VIEWPORTS.map((v) => v.width)).toEqual([320, 360, 390, 768, 1440]);
  });

  it("checks both themes", () => {
    expect([...SWEEP_THEMES]).toEqual(["light", "dark"]);
  });
});
