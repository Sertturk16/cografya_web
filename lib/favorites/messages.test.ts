import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the favorite control (the `lib/search/messages.test.ts` /
 * `lib/home/messages.test.ts` pattern — UYELIK-08 plan §5.6/§11).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path
 * in place of the copy. `FavoriteButton` sits on every province and country detail page, so a
 * typo here ships "Favorites.label" as visible button text (or an unreadable aria-label) on
 * ~280 indexable pages with CI green.
 *
 * ONE SHARED NAMESPACE, BOTH LOCALES ALWAYS: unlike the narrative tiers (`SEO-POLICY.md`
 * §B14's translation ban), this is pure UI chrome with byte-identical meaning in both
 * locales — no TR-only/both-locale split, unlike `lib/tools/messages.test.ts`'s Prose vs.
 * Chrome classification.
 *
 * Structural only (`CONVENTIONS.md` §2): every assertion is about whether a key RESOLVES and
 * what shape its value has — never about what any string says.
 */

const FAVORITES_KEYS = [
  "label",
  "addAria",
  "removeAria",
  "signInRequiredAria",
  "saveError",
  // uyelik-auth-redesign plan §5.6.1 — the sr-only announcement of a completed resume
  // (favorite saved after a successful modal auth), the same mechanism
  // `GameRoundSaveControl`'s own label-swap announcement already uses.
  "savedStatus",
] as const;

const catalogues = { tr: trMessages.Favorites, en: enMessages.Favorites } as const;

describe("Favorites message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(FAVORITES_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it("carries the SAME key set in both locales (pure UI chrome, no narrative split)", () => {
    expect(Object.keys(enMessages.Favorites).sort()).toEqual(
      Object.keys(trMessages.Favorites).sort(),
    );
  });

  it("declares exactly the keys this file knows how to judge (no unguarded key slips in)", () => {
    expect(Object.keys(trMessages.Favorites).sort()).toEqual([...FAVORITES_KEYS].sort());
  });
});
