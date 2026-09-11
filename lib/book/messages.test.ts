import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the `/kitaplar` hub's own namespace (the
 * `lib/home/messages.test.ts` pattern — small static namespace, hand-list only, per PR #134
 * review `TEST134-NEW-I1`'s own Fix note).
 *
 * Lives here, not beside its one consumer under `app/[locale]/kitaplar/`: `vitest.config.ts`'s
 * `test.include` is `lib/**\/*.test.ts` + `components/**\/*.test.{ts,tsx}` +
 * `tools/**\/*.test.ts` — no `app/**` pattern, so a test placed under `app/` never runs.
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path
 * in place of the copy. `metaDescription` feeds BOTH the `<meta name="description">` tag and
 * the `CollectionPage` JSON-LD `description` field of `/kitaplar`, a TR-indexable hub.
 *
 * Structural only (`CONVENTIONS.md` §2): asserts that keys resolve to non-empty strings, never
 * what the copy says.
 */

const KITAPLAR_KEYS = ["heading", "lede", "metaDescription", "metaTitle"] as const;

const catalogues = { tr: trMessages.Kitaplar, en: enMessages.Kitaplar } as const;

describe("Kitaplar message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(KITAPLAR_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it("carries the SAME key set in both locales", () => {
    expect(Object.keys(enMessages.Kitaplar).sort()).toEqual(
      Object.keys(trMessages.Kitaplar).sort(),
    );
  });

  it("has no key the code stopped asking for", () => {
    // Ties the hand list to the one known consumer (app/[locale]/kitaplar/page.tsx) rather than
    // to itself, so a retired key left in both catalogues does not read as live copy.
    expect([...KITAPLAR_KEYS].sort()).toEqual(Object.keys(trMessages.Kitaplar).sort());
  });
});
