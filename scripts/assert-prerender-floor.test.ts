import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  // The malformed-manifest case above exercises main()'s *diagnostic* branch. What it does
  // NOT touch is main()'s `failed.length > 0 -> process.exit(1)` branch — the one this whole
  // task exists for. Reverting that `exit(1)` to a bare `return` would have left every test
  // green: the guard would print its FAIL rows, `pnpm build` would exit 0, and an API-less
  // build would ship. This spawns the real CLI against a well-formed but SHORT manifest and
  // asserts both halves of the contract: the process status, and that a named family is
  // printed as FAIL rather than the failure being reported only as a total.
  it("exits 1 and prints a FAIL row per short family for a well-formed but collapsed manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "prerender-floor-"));
    try {
      mkdirSync(join(dir, ".next"));
      // Well-formed: `routes` is present and every key is a real route path. It is simply
      // short — this is the shape an API-less build actually wrote on 2026-09-19, with the
      // static hub pages surviving while every data family collapsed to nothing.
      writeFileSync(
        join(dir, ".next", "prerender-manifest.json"),
        JSON.stringify({
          routes: { "/tr": {}, "/en": {}, "/tr/turkiye/bolge": {}, "/en/turkiye/bolge": {} },
        }),
      );

      const result = spawnSync(process.execPath, [scriptPath], { cwd: dir, encoding: "utf8" });

      expect(result.status).toBe(1);
      // Rows go to stdout, the closing summary to stderr. Naming `provinces` specifically is
      // the point: a single total is satisfiable while a whole category is missing.
      expect(result.stdout).toMatch(/^FAIL provinces\s+0 = 162$/m);
      expect(result.stdout).toMatch(/^FAIL total\s+4 >= 980$/m);
      expect(result.stderr).toMatch(/route families short/);
      expect(result.stderr).toMatch(/An API-less build looks exactly like this/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// A guard that is not wired into anything is a guard that does not run, and "quietly absent"
// is the exact class of defect this task closes. Both assertions below exist because the
// wiring they pin is a single line in a file no other test reads: reverting either one was,
// until now, a change that reddened nothing.
describe("the guard's wiring into the build", () => {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));

  it("is chained into package.json's `build` script", () => {
    // `next build` alone exits 0 on an API-less build. The chaining is what makes `pnpm build`
    // — and therefore the Dockerfile's RUN, `docker compose build web` and CI's Build job —
    // fail on one. Reverting this to plain "next build" must red a test.
    const pkg: { scripts: Record<string, string> } = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    );
    expect(pkg.scripts.build).toContain("assert-prerender-floor");
  });

  it("keeps `required=true` on the Dockerfile's internal-token secret mount", () => {
    // Without `required=true` a missing secret is not an error at that RUN: the mount simply
    // does not exist, `cat` fails, and `VAR="$(cat ...)" pnpm build` takes its status from
    // `pnpm build`, so the token silently becomes "" and the build dies two hops downstream
    // on a zod message that names neither the secret nor the compose file. Since
    // docker-compose.prod.yml lives outside every git repo here, that mount is the only thing
    // that fails a compose file missing its `secrets:` entry loudly and by name.
    const dockerfile = readFileSync(join(repoRoot, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/--mount=type=secret,id=internal_request_token,required=true/);
  });
});
