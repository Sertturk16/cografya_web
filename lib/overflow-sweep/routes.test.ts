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
 *  2. A NEW CSS MODULE ARRIVED WITH NO ROUTE. That was the second failure mode, and T-033
 *     removed its subject rather than its symptom: `SweepShape.modules` and the case that
 *     read it are GONE, because at zero surviving stylesheets "every module is covered by a
 *     route" is a claim over an empty set that cannot fail, and a `modules` list nothing
 *     compares is exactly the shape the rest of this file's docblock is about. What replaces
 *     it is one assertion in `components/css-module-dark-safety.test.ts` that no
 *     `*.module.css` exists anywhere under `app/` or `components/` — a guard against the
 *     subject returning, which can still fail.
 *
 *     The claim was never as strong as it read, which is the other half of why it is not being
 *     kept as an `every(…) === 0` formality. `modules` asserted that the route's import graph
 *     REACHED the stylesheet, never that a sweep run rendered it: `marine.module.css` was
 *     claimed by `home` and `province`, which genuinely imported it, while both marine blocks
 *     are gated on `MARINE_ENABLED` — false in production today — so no run ever measured those
 *     rules.
 *
 *     None of that geometry evaporated. Each conversion moved it into hoisted class constants
 *     read by the component's own test (`book-detail-floors.test.ts`, `bench.structure.test.ts`,
 *     `earthquake.structure.test.ts`, `locator-map-floors.test.ts`), and every one of those
 *     routes is still swept.
 *
 * The surviving assertion needs no browser, which is the point: the sweep's aim is checkable
 * even on a run where nobody starts a server.
 */

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
      why: "a renamed route, of the kind T-032 corrected",
    } as const;
    expect(() => buildSweepUrls(routing.pathnames, [shape])).toThrow(/not a key of routing/);
  });

  it("throws rather than requesting a URL with a hole in it", () => {
    const shape = {
      id: "holed",
      pathname: "/turkiye/[slug]",
      locales: ["tr"],
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
  it("checks the three phone widths the repo commits to, every breakpoint floor, and desktop", () => {
    // Each of 640/768/1024/1280 is a Tailwind breakpoint's floor, where a layout it switches
    // on is narrowest. 640 is not decoration: `/dunya`'s `sm:flex-row` toolbar overflowed
    // there and passed every other width. See the docblock on SWEEP_VIEWPORTS.
    expect(SWEEP_VIEWPORTS.map((v) => v.width)).toEqual([
      320, 360, 390, 640, 768, 1024, 1280, 1440,
    ]);
  });

  it("checks both themes", () => {
    expect([...SWEEP_THEMES]).toEqual(["light", "dark"]);
  });
});
