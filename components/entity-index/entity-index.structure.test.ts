import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `EntityIndex` is a server component, so it cannot be RENDERED under this repo's `node`
 * vitest environment (same constraint `components/air/air-pollution.structure.test.ts`
 * documents). The honest guard at this level is the source itself, scoped to the one
 * invariant this file exists to pin: nothing published (or a transient upstream failure)
 * renders no section at all, rather than a heading over an empty list.
 *
 * This file used to ALSO pin the `/turkiye` map→index bridge paragraph's own empty-state
 * guard (review A11Y109-M1) — removed along with the bridge paragraph itself (owner report,
 * turkiye-editor-notlari md.4: a same-page anchor restating a count the meta description and
 * the index's own heading already carried, immediately above content it pointed at). See
 * `app/[locale]/turkiye/page.tsx`'s own docblock for that removal's reasoning.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * Source with comments removed — the same trap `air-pollution.structure.test.ts` names: an
 * assertion run against the raw source could pass on a comment alone even if the real code
 * regressed. Strip block and line comments (JSX `{/* … *\/}` is a block comment) first.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entityIndexCode = code(read("./entity-index.tsx"));

describe("EntityIndex's own empty-state gate", () => {
  it("renders null when there is nothing to list", () => {
    expect(entityIndexCode).toMatch(/if \(buckets\.length === 0\) return null;/);
  });

  it("POSITIVE CONTROL — the same check reports a gate the component does not have", () => {
    // Without this, the assertion above would keep passing on any unconditional `return null;`
    // even if the real length check were deleted.
    expect(entityIndexCode).not.toMatch(/if \(buckets\.length === 1234\) return null;/);
  });
});
