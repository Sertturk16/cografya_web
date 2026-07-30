import { describe, expect, it } from "vitest";
import { REGION_KEYS, regionFromSlug, regionSlug } from "./region-slug";

/**
 * Structural guards for the region ROUTE identifiers (never geography assertions —
 * `CONVENTIONS.md` §2). What is under test is that the table is total, reversible and
 * URL-legal; which provinces a region contains is the api's business, not this file's.
 */
describe("region slugs", () => {
  it("covers the seven regions with distinct identifiers", () => {
    expect(REGION_KEYS).toHaveLength(7);
    expect(new Set(REGION_KEYS.map(regionSlug)).size).toBe(REGION_KEYS.length);
  });

  it("round-trips every region through its slug", () => {
    for (const region of REGION_KEYS) {
      expect(regionFromSlug(regionSlug(region))).toBe(region);
    }
  });

  // SEO-POLICY §B4 4.3: lowercase ASCII, digits and hyphens only — no diacritics, no
  // underscore, no leading or trailing hyphen. The enum keys these come from contain
  // underscores, so this is the assertion that a raw key can never leak into a URL.
  it("uses only slug-legal characters", () => {
    for (const region of REGION_KEYS) {
      expect(regionSlug(region)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("answers null for an unknown identifier, so the route can 404", () => {
    for (const unknown of ["", "MARMARA", "marmara ", "ic_anadolu", "atlantis", "../oyun"]) {
      expect(regionFromSlug(unknown)).toBeNull();
    }
  });
});
