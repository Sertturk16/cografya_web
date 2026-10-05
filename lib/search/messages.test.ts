import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { KIND_LABEL_KEY } from "./kind-label";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the header search (the `lib/home/messages.test.ts` pattern).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path
 * in place of the copy. The search control is in the header of EVERY page, so a typo here
 * ships "Search.seeAllCountries" as a visible link label site-wide with CI green.
 *
 * Both locales, always: the header renders identically on `"localized"` and `"trNarrative"`
 * surfaces, so "missing in en" is a defect rather than a translation backlog.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that keys resolve to non-empty strings,
 * never what the copy says.
 */

const SEARCH_KEYS = [
  "label",
  "triggerLabel",
  "placeholder",
  "openLabel",
  "closeLabel",
  "noResults",
  "resultCount",
  // The two list links (owner live-tour finding #4 → the single misleading row is gone).
  // `seeAllProvinces` is load-bearing twice: it is the panel's first link AND the accessible
  // name of the pre-hydration trigger, which is the ONLY control a no-JS reader ever gets.
  "seeAllProvinces",
  "seeAllCountries",
  "province",
  "country",
  "region",
  "continent",
  "sea",
  "tool",
  "page",
  "loadFailed",
  // The homepage hero box (T-164): same index, same matcher, its own frame.
  "heroPlaceholder",
  "clearLabel",
  "enterHint",
  "opening",
  "emptyQuery",
] as const;

/** Placeholders each templated key must carry, so a message can never drop an interpolation. */
const REQUIRED_PLACEHOLDERS: Record<string, readonly string[]> = {
  resultCount: ["count"],
  opening: ["name"],
};

const catalogues = { tr: trMessages.Search, en: enMessages.Search } as const;

describe("Search message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(SEARCH_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });

      it("carries every required placeholder", () => {
        for (const [key, placeholders] of Object.entries(REQUIRED_PLACEHOLDERS)) {
          const value = String((catalogue as Record<string, unknown>)[key]);
          for (const placeholder of placeholders) {
            expect(value).toContain(`{${placeholder}`);
          }
        }
      });
    });
  }

  it("carries the SAME key set in both locales", () => {
    expect(Object.keys(enMessages.Search).sort()).toEqual(Object.keys(trMessages.Search).sort());
  });

  it("no longer carries the retired combined key", () => {
    // `seeAll` said "Tüm il ve ülke listesi" and linked only to the province index. Leaving it
    // in the catalogue would invite a future edit to render it again and restore the exact
    // broken promise the split removed.
    expect(trMessages.Search).not.toHaveProperty("seeAll");
    expect(enMessages.Search).not.toHaveProperty("seeAll");
  });

  it("has a label for every result kind", () => {
    for (const key of Object.values(KIND_LABEL_KEY)) {
      expect(SEARCH_KEYS as readonly string[]).toContain(key);
    }
  });
});

/** Flattens a nested catalogue to its dotted leaf keys. */
const leafKeys = (node: unknown, prefix = ""): string[] =>
  typeof node === "string"
    ? [prefix]
    : Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
        leafKeys(child, prefix ? `${prefix}.${key}` : key),
      );

describe("SearchIndex message catalogue", () => {
  it("carries the SAME leaf keys in both locales, each a non-empty string", () => {
    const tr = leafKeys(trMessages.SearchIndex).sort();
    expect(leafKeys(enMessages.SearchIndex).sort()).toEqual(tr);
    for (const catalogue of [trMessages.SearchIndex, enMessages.SearchIndex]) {
      for (const key of tr) {
        const value = key
          .split(".")
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue);
        expect(String(value).trim().length, key).toBeGreaterThan(0);
      }
    }
  });
});
