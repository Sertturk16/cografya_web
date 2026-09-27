import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * No impeccable live-mode residue in shipped source.
 *
 * `/impeccable live` injects a script into `app/[locale]/layout.tsx` and writes variant and
 * carbonize wrappers into the component under edit; its cleanup removes them. A session that
 * dies before cleanup leaves them in a file the dev container serves, one `git add` away from
 * `main`. This fails on any of the markers instead of trusting the cleanup.
 */

const MARKERS = [
  "impeccable-live-start",
  "impeccable-live-root",
  "impeccable-variants-start",
  "impeccable-carbonize-start",
  "data-impeccable-",
];

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|css|mjs|js)$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
  });

/** The markers `source` contains. */
function residue(source: string): string[] {
  return MARKERS.filter((marker) => source.includes(marker));
}

describe("impeccable live residue", () => {
  it("recognises each marker (control)", () => {
    for (const marker of MARKERS) expect(residue(`{/* ${marker}x */}`)).toEqual([marker]);
    expect(residue("export const x = 1;")).toEqual([]);
  });

  it("finds none in app/, components/ or lib/", () => {
    const hits = ["app", "components", "lib"]
      .flatMap((dir) => walk(join(repoRoot, dir)))
      .flatMap((file) =>
        residue(readFileSync(file, "utf8")).map((m) => `${relative(repoRoot, file)}: ${m}`),
      );
    expect(hits).toEqual([]);
  });
});
