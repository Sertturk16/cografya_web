import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the `Measurements` namespace (the
 * `lib/favorites/messages.test.ts` / `lib/game-rounds/messages.test.ts` pattern —
 * UYELIK-12 plan §5.8/§11).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key
 * path in place of the copy. `ToolMeasurementSave` and `ToolMeasurementList` sit inside
 * every CBS tool page's controls panel, so a typo here ships "Measurements.saveLabel" as
 * visible button text (or an unreadable aria-label) with CI green.
 *
 * ONE SHARED NAMESPACE, BOTH LOCALES ALWAYS: pure UI chrome with byte-identical meaning
 * in both locales, the same posture `Favorites`/`GameRounds`'s own guards state for
 * their own namespaces.
 *
 * Structural only (`CONVENTIONS.md` §2): every assertion is about whether a key
 * RESOLVES and what shape its value has — never about what any string says.
 */

const MEASUREMENTS_KEYS = [
  "saveLabel",
  "savedLabel",
  "signInRequiredAria",
  "saveError",
  "saveQuotaError",
  "titleLabel",
  "listToggleLabel",
  "listHeading",
  "listEmpty",
  "listError",
  "recallLabel",
  "recallAria",
  "deleteLabel",
  "deleteAria",
  "deleteError",
] as const;

/** Keys that carry a `{label}` interpolation placeholder — parametrized, unlike the rest. */
const PARAMETRIZED_KEYS = new Set(["recallAria", "deleteAria"]);

const catalogues = { tr: trMessages.Measurements, en: enMessages.Measurements } as const;

describe("Measurements message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(MEASUREMENTS_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });

      it.each([...PARAMETRIZED_KEYS])("%s carries the {label} interpolation placeholder", (key) => {
        const value = (catalogue as Record<string, unknown>)[key] as string;
        expect(value).toContain("{label}");
      });
    });
  }

  it("carries the SAME key set in both locales (pure UI chrome, no narrative split)", () => {
    expect(Object.keys(enMessages.Measurements).sort()).toEqual(
      Object.keys(trMessages.Measurements).sort(),
    );
  });

  it("declares exactly the keys this file knows how to judge (no unguarded key slips in)", () => {
    expect(Object.keys(trMessages.Measurements).sort()).toEqual([...MEASUREMENTS_KEYS].sort());
  });
});
