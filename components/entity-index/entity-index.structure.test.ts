import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `EntityIndex` is a server component and `/turkiye`'s page is an async server component, so
 * neither can be RENDERED under this repo's `node` vitest environment (same constraint
 * `components/air/air-pollution.structure.test.ts` documents). The honest guard at this level
 * is the source itself, scoped to the one invariant this file exists to pin: the map→index
 * bridge paragraph on `/turkiye` (review A11Y109-M1) must be gated on EXACTLY the same
 * condition that makes `EntityIndex` itself render `null`, never an approximation of it.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * Source with comments removed. Load-bearing here specifically: the bridge paragraph's own
 * docblock (added by the A11Y109-M1 fix) narrates the gate in prose — "gated on
 * `items.length > 0`", "buckets.length === 0" — so an assertion run against the raw source
 * would pass on the comment alone even if the actual JSX gate regressed. Same trap
 * `air-pollution.structure.test.ts` names and the same fix: strip block and line comments
 * (JSX `{/* … *\/}` is a block comment) before asserting.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entityIndexSource = read("./entity-index.tsx");
const turkiyePageSource = read("../../app/[locale]/turkiye/page.tsx");
const entityIndexCode = code(entityIndexSource);
const turkiyePageCode = code(turkiyePageSource);

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

describe("the /turkiye map→index bridge is gated on the same emptiness EntityIndex uses", () => {
  it("wraps the bridge paragraph in an items.length > 0 guard (review A11Y109-M1)", () => {
    // Whitespace-normalised, not line-matched: the assertion is about which expression gates
    // the JSX, not about how Prettier wrapped the conditional.
    const flatPage = turkiyePageCode.replace(/\s+/g, " ");
    expect(flatPage).toContain("{items.length > 0 && ( <p className={styles.indexBridge}>");
  });

  it("POSITIVE CONTROL — the same check reports a bridge that renders unconditionally", () => {
    // Before the A11Y109-M1 fix, the (comment-stripped) paragraph sat directly after the
    // preceding stripped comment with no guard between them — exactly this adjacency. If the
    // guard were ever removed, this shape would reappear and this control would catch it.
    const flatPage = turkiyePageCode.replace(/\s+/g, " ");
    expect(flatPage).not.toContain("{} <p className={styles.indexBridge}>");
  });

  it("derives `items` from the SAME `buckets` EntityIndex is gated on, not a separate count", () => {
    // `loadProvinceIndex` (the page's one derivation of the index) returns
    // `items: flattenBuckets(buckets)`, so `items.length === 0` and `buckets.length === 0`
    // are the exact same condition by construction — not two counts that could drift apart.
    expect(turkiyePageCode).toMatch(/return \{ buckets, items: flattenBuckets\(buckets\) \};/);
  });

  it("still passes the same items.length count to indexBridgeLink when it renders", () => {
    // The fix only ADDS a guard; it must not also change what the link says when it does
    // render — the count backing the link text is untouched by the empty-state fix.
    const flatPage = turkiyePageCode.replace(/\s+/g, " ");
    expect(flatPage).toContain('t("indexBridgeLink", { count: items.length })');
  });
});
