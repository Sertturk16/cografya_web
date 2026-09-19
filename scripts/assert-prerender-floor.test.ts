import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readPrerenderFloors } from "./assert-prerender-floor.mjs";

const scriptPath = fileURLToPath(new URL("./assert-prerender-floor.mjs", import.meta.url));

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

describe("the CLI entrypoint (main)", () => {
  // readPrerenderFloors() throwing on a bad shape is covered above; what that leaves
  // uncovered is main()'s own handling of that throw — it reads a hardcoded file path and
  // calls process.exit(), so the only clean way to exercise it is to actually run the
  // script as a subprocess, same as Step 5/6 of the build-integrity task did by hand. This
  // spawns the guard script itself against a crafted manifest, not a `next build`.
  it("prints a clean diagnostic, not a raw stack trace, when the manifest parses but has no `routes`", () => {
    const dir = mkdtempSync(join(tmpdir(), "prerender-floor-"));
    try {
      mkdirSync(join(dir, ".next"));
      writeFileSync(join(dir, ".next", "prerender-manifest.json"), JSON.stringify({ nope: true }));

      const result = spawnSync(process.execPath, [scriptPath], { cwd: dir, encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/not shaped like a prerender manifest/);
      // A raw Node stack trace has "at <fn> (<file>:<line>:<col>)" frames; String(Error)
      // never does, so this line is the guard against regressing back to dumping one.
      expect(result.stderr).not.toMatch(/\s+at .+:\d+:\d+/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
