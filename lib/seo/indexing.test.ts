import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { EN_CONTENT_READY, indexableLocales, indexableLocalesFor, isIndexable } from "./indexing";

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

  // The branch ORDER, pinned at the only combination that can tell the two orders apart.
  // Every assertion above runs against today's `EN_CONTENT_READY = false`, under which
  // "noindex first" and "noindex last" are indistinguishable — so without this block a
  // reorder plus the documented one-word flip would re-index the whole game surface with
  // the suite green. `indexableLocalesFor` is the real function with the flag injected.
  describe("with EN_CONTENT_READY flipped on", () => {
    it("still indexes the noindex surface in no locale at all", () => {
      expect(indexableLocalesFor("noindex", true)).toEqual([]);
    });

    it("opens the TR-narrative surface to every locale", () => {
      expect([...indexableLocalesFor("trNarrative", true)]).toEqual([...routing.locales]);
    });

    it("leaves the localized surface unchanged", () => {
      expect([...indexableLocalesFor("localized", true)]).toEqual([...routing.locales]);
    });
  });

  it("is exactly the injected form applied to the live switch", () => {
    // Keeps the two entry points from drifting apart: whatever the constant is today, the
    // shipped function must be its injected twin on every surface.
    for (const surface of ["localized", "trNarrative", "noindex"] as const) {
      expect([...indexableLocales(surface)]).toEqual([
        ...indexableLocalesFor(surface, EN_CONTENT_READY),
      ]);
    }
  });

  it("exposes no locale outside the routing table", () => {
    for (const surface of ["localized", "trNarrative"] as const) {
      for (const locale of indexableLocales(surface)) {
        expect(routing.locales).toContain(locale);
      }
    }
  });
});
