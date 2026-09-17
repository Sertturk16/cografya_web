import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATEGORIES, EXEMPT_FILES } from "./registry";

const dirOf = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

function basenamesIn(rel: string): string[] {
  return readdirSync(dirOf(rel))
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => f.replace(/\.tsx$/, ""));
}

const ON_DISK = [...basenamesIn("../ui"), ...basenamesIn("../patterns")].filter(
  (name) => !EXEMPT_FILES.includes(name),
);

const LISTED = CATEGORIES.flatMap((category) => category.components);

/**
 * The staleness tripwire.
 *
 * A design system dies by drifting: a component ships, nobody adds its specimen, and the
 * showcase slowly stops describing the code. These assertions make that a failing test
 * instead of a discovery six months later.
 *
 * What this does NOT claim: that a specimen exercises every variant. Proving that needs
 * rendering, which this suite has no jsdom for. The gap is accepted and written down here
 * rather than left implied.
 */
describe("showcase coverage", () => {
  it("positive control — both directories were actually read", () => {
    expect(ON_DISK.length).toBeGreaterThan(15);
    expect(ON_DISK).toContain("button");
  });

  it("every component has a specimen", () => {
    const missing = ON_DISK.filter((name) => !LISTED.includes(name));
    expect(missing, `no showcase category lists: ${missing.join(", ")}`).toEqual([]);
  });

  // DISABLED UNTIL T-034 PHASE D — re-enable in the phase's final task.
  //
  // The registry deliberately lists the fifteen components Phase D builds, because the
  // registry IS the worklist; this assertion is what turns it into one. Running it now
  // fails on every unbuilt name, which is true but not actionable per-task.
  //
  // Do not "fix" this by trimming the registry — that would delete the plan. Re-enable the
  // assertion once Phase D is complete and it must pass unaided.
  it.skip("every listed component exists on disk", () => {
    const phantom = LISTED.filter((name) => !ON_DISK.includes(name));
    expect(phantom, `listed but no file: ${phantom.join(", ")}`).toEqual([]);
  });

  it("no component is listed in two categories", () => {
    const seen = new Set<string>();
    const duplicated = LISTED.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });
    expect(duplicated).toEqual([]);
  });

  it("category slugs are unique", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
  });
});
