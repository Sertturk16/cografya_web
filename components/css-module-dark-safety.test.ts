import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every `*.module.css` reachable from the product tree, found by walking rather than listed. */
function findModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : findModules(path);
    return entry.name.endsWith(".module.css") ? [path] : [];
  });
}

export const SURVIVING_MODULES: readonly string[] = [
  ...findModules("components"),
  ...findModules("app"),
].sort();

/**
 * Steps down as T-033 converts each module. The count is the POSITIVE CONTROL: without it, a
 * walk that found nothing would satisfy the raw-token assertion perfectly.
 */
const EXPECTED_MODULE_COUNT = 7;

/**
 * Raw Terra tokens are frozen at their light values — `.dark` redefines not one of the 13
 * these files use. Measured 2026-09-19 on /tr/turkiye/istanbul in dark: 111 of 181 text
 * elements carrying a module class fell below 3:1, worst 1.14:1 (`--color-ink` #2b2622 on
 * `--card` #121e21). Every read below is one of those failures waiting to render.
 *
 * 179 when pinned; 147 once T-033 deleted `marine.module.css`'s 42 classes with no call
 * site, which took 32 of those reads with them without moving a pixel; 128 once the file's
 * four consumers moved to bridge tokens and the file itself was deleted, taking the last 19.
 */
const TOTAL_RAW_READS = 128;

describe("CSS modules cannot read a colour that dark mode never redefines", () => {
  it("found the modules it claims to check", () => {
    expect(SURVIVING_MODULES).toHaveLength(EXPECTED_MODULE_COUNT);
  });

  it("reads exactly the recorded number of raw Terra tokens", () => {
    const total = SURVIVING_MODULES.reduce(
      (sum, path) => sum + (readFileSync(path, "utf8").match(/var\(--color-/g) ?? []).length,
      0,
    );
    expect(total).toBe(TOTAL_RAW_READS);
  });

  it.each(SURVIVING_MODULES)("%s reads no raw Terra token", (path) => {
    const reads = readFileSync(path, "utf8").match(/var\(--color-[a-z0-9-]+/g) ?? [];
    expect(reads, `${path} reads ${reads.length}: ${[...new Set(reads)].join(", ")}`).toEqual([]);
  });
});
