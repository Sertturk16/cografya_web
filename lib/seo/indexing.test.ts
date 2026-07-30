import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { EN_CONTENT_READY, indexableLocales, isIndexable } from "./indexing";

/**
 * Structural guards for the per-locale indexing policy (never fact assertions about any
 * particular page — CONVENTIONS §2). These pin the two invariants the EN de-index rests on:
 * TR is never de-indexed, and the de-index is driven by exactly one switch.
 */
describe("indexing policy", () => {
  it("never de-indexes the default locale, on any surface", () => {
    for (const surface of ["localized", "trNarrative"] as const) {
      expect(indexableLocales(surface)).toContain(routing.defaultLocale);
    }
  });

  it("keeps every locale indexable on a fully localized surface", () => {
    expect([...indexableLocales("localized")]).toEqual([...routing.locales]);
  });

  it("gates EN on a TR-narrative surface behind the EN_CONTENT_READY switch", () => {
    // The assertion tracks the switch rather than hardcoding today's value, so flipping
    // EN_CONTENT_READY flips the expectation instead of breaking the suite.
    expect(isIndexable("en", "trNarrative")).toBe(EN_CONTENT_READY);
  });

  // The fully de-indexed class (→ DEC 2026-07-30p). Two properties matter: it is empty in
  // every locale, and it stays empty when the EN switch flips — a `noindex` page is
  // `noindex` because of what the PAGE is, not because of how much English content exists.
  it("indexes a noindex surface in no locale at all", () => {
    expect(indexableLocales("noindex")).toEqual([]);
    for (const locale of routing.locales) {
      expect(isIndexable(locale, "noindex")).toBe(false);
    }
  });

  it("keeps the noindex surface out of the EN_CONTENT_READY switch's reach", () => {
    // Asserted through the DEFAULT locale, which the switch never touches: if the noindex
    // branch were placed after the switch, TR would be indexable here whatever the flag.
    expect(isIndexable(routing.defaultLocale, "noindex")).toBe(false);
  });

  it("exposes no locale outside the routing table", () => {
    for (const surface of ["localized", "trNarrative"] as const) {
      for (const locale of indexableLocales(surface)) {
        expect(routing.locales).toContain(locale);
      }
    }
  });
});
