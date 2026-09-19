import { describe, expect, it } from "vitest";
import { readPrerenderFloors } from "./assert-prerender-floor.mjs";

/** A manifest shaped like the real one, with the route counts a healthy build produces. */
function healthyManifest(): { routes: Record<string, unknown> } {
  const routes: Record<string, unknown> = {};
  const add = (path: string) => {
    routes[path] = {};
  };
  for (const locale of ["tr", "en"]) {
    for (let i = 0; i < 81; i++) add(`/${locale}/turkiye/province-${i}`);
    for (let i = 0; i < 7; i++) add(`/${locale}/turkiye/bolge/region-${i}`);
    for (let i = 0; i < 199; i++) add(`/${locale}/dunya/country-${i}`);
    for (let i = 0; i < 14; i++) add(`/${locale}/dunya/kita/continent-${i}`);
    add(`/${locale}/kitaplar/a-book`);
    for (let i = 0; i < 7; i++) add(`/${locale}/design-system/category-${i}`);
    // The data-driven families above are 309 routes per locale (618 total), but a real
    // build also prerenders the static routes — home, hub pages, quiz and tool screens —
    // that bring the manifest up to its 980 floor. The exact list doesn't matter to the
    // rules under test, only that `total` clears its floor: 181 per locale, 362 total.
    for (let i = 0; i < 181; i++) add(`/${locale}/static-route-${i}`);
  }
  return { routes };
}

describe("readPrerenderFloors", () => {
  it("passes every row for a healthy manifest", () => {
    const rows = readPrerenderFloors(healthyManifest());
    const failures = rows.filter((r) =>
      r.kind === "exact" ? r.actual !== r.expected : r.actual < r.expected,
    );
    expect(failures).toEqual([]);
  });

  it("counts the 81 provinces in both locales", () => {
    const provinces = readPrerenderFloors(healthyManifest()).find((r) => r.label === "provinces");
    expect(provinces).toMatchObject({ kind: "exact", expected: 162, actual: 162 });
  });

  it("fails the province row when the API was unreachable — the case this exists for", () => {
    // What a 127.0.0.1:9 build actually produced on 2026-09-19: turkiye collapses to the one
    // static hub page, books to nothing, while unrelated static routes survive.
    const collapsed = { routes: { "/tr/turkiye/bolge": {}, "/en/turkiye/bolge": {} } };
    const rows = readPrerenderFloors(collapsed);
    const provinces = rows.find((r) => r.label === "provinces");
    expect(provinces).toMatchObject({ expected: 162, actual: 0 });
  });

  it("rejects a manifest that is not shaped like one at all", () => {
    expect(() => readPrerenderFloors({ nope: true })).toThrow(/routes/);
  });
});
