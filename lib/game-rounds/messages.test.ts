import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the `GameRounds` namespace (the
 * `lib/favorites/messages.test.ts` pattern — UYELIK-10 plan §5.8/§11).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key
 * path in place of the copy. `GameRoundSaveControl` sits on the game's end-of-round dialog
 * and `GameHistoryPanel` sits on `/oyun`, so a typo here ships "GameRounds.saveLabel" as
 * visible button text (or an unreadable aria-label) with CI green.
 *
 * ONE SHARED NAMESPACE, BOTH LOCALES ALWAYS: pure UI chrome with byte-identical meaning in
 * both locales, the same posture `Favorites`'s own guard states for its own namespace.
 *
 * Structural only (`CONVENTIONS.md` §2): every assertion is about whether a key RESOLVES and
 * what shape its value has — never about what any string says.
 */

const GAME_ROUNDS_KEYS = [
  "saveLabel",
  "savedLabel",
  "signInRequiredAria",
  "saveError",
  "historyHeading",
  "historyEmpty",
] as const;

const catalogues = { tr: trMessages.GameRounds, en: enMessages.GameRounds } as const;

describe("GameRounds message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(GAME_ROUNDS_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it("carries the SAME key set in both locales (pure UI chrome, no narrative split)", () => {
    expect(Object.keys(enMessages.GameRounds).sort()).toEqual(
      Object.keys(trMessages.GameRounds).sort(),
    );
  });

  it("declares exactly the keys this file knows how to judge (no unguarded key slips in)", () => {
    expect(Object.keys(trMessages.GameRounds).sort()).toEqual([...GAME_ROUNDS_KEYS].sort());
  });
});
