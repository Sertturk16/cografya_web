import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_STARS, STAR_THRESHOLDS } from "./config";

/**
 * REGRESSION SHIELD — the `Game` namespace exists in BOTH locales, with the same keys.
 *
 * This class of bug has shipped here once already: `Continents.ANTARKTIKA` was missing from
 * `messages/tr.json`, and next-intl rendered the raw key on a live page — the UX tour found
 * it on screen, not a test (→ B2). Nothing in the type system connects a `t("…")` call to
 * the two JSON files, so a key added to one locale and forgotten in the other is invisible
 * until someone loads that page in that language (→ PR #48 review TA48-M1).
 *
 * SCOPED TO `Game`, deliberately and with the measurement to justify it: the two files are
 * NOT key-identical today (`Deniz` carries 14 TR-only FAQ entries, by design), so a
 * whole-file parity assertion would fail on unrelated, intentional content. Widening this
 * guard is a real improvement — it just needs its own decision about those TR-only keys,
 * and quietly failing CI on someone else's namespace is not how to open that conversation.
 */

type Messages = Record<string, Record<string, unknown>>;

function messagesFor(locale: "tr" | "en"): Messages {
  const path = fileURLToPath(new URL(`../../messages/${locale}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Messages;
}

const TR = messagesFor("tr");
const EN = messagesFor("en");

describe("the Game message namespace", () => {
  it("exists in both locales", () => {
    expect(Object.keys(TR.Game ?? {}).length).toBeGreaterThan(20);
    expect(Object.keys(EN.Game ?? {}).length).toBeGreaterThan(20);
  });

  it("carries exactly the same keys in both locales", () => {
    const tr = Object.keys(TR.Game ?? {}).sort();
    const en = Object.keys(EN.Game ?? {}).sort();
    expect(tr).toEqual(en);
  });

  it("leaves no empty string behind a key", () => {
    // A blank value is worse than a missing one: next-intl renders nothing at all and the
    // UI simply loses a sentence, silently.
    for (const [locale, messages] of [
      ["tr", TR],
      ["en", EN],
    ] as const) {
      for (const [key, value] of Object.entries(messages.Game ?? {})) {
        expect(typeof value === "string" && value.trim().length > 0, `${locale}.Game.${key}`).toBe(
          true,
        );
      }
    }
  });
});

describe("the star-rule sentence", () => {
  /**
   * The sentence names three tiers BY HAND ("… 3 yıldız, … 2 yıldız, … 1 yıldız") and is
   * fed three numbered thresholds. That is fine while there are exactly three, and a lie
   * the moment there are not: a fourth threshold would be scored by `starsForScore` and
   * never mentioned, and a shorter ladder would print `0` for a tier that does not exist
   * (→ PR #48 review CR-M4). Cheaper to pin the assumption than to build a pluralised
   * sentence for a ladder DEC 2026-07-30h fixed at three.
   */
  it("has exactly as many tiers as the sentence spells out", () => {
    expect(MAX_STARS).toBe(3);
    expect(STAR_THRESHOLDS).toHaveLength(3);
  });

  it("is placed in both locales with all three thresholds", () => {
    for (const messages of [TR, EN]) {
      const rule = String(messages.Game?.summaryStarsRule ?? "");
      expect(rule).toContain("{three}");
      expect(rule).toContain("{two}");
      expect(rule).toContain("{one}");
    }
  });
});
