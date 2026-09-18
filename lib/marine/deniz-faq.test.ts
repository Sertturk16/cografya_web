import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * THE EIGHT `/deniz` FAQ PAIRS EXIST, AND THE ENGLISH GAP IS PINNED RATHER THAN ASSUMED.
 *
 * `app/[locale]/(site)/deniz/page.tsx` builds its FAQ items in a loop — `t(`q${i + 1}`)` — because
 * eight hand-written `t("q1")`…`t("q8")` pairs would be sixteen lines of noise. The cost of that
 * loop is stated in `lib/i18n/key-existence.test.ts`'s own docblock: it resolves LITERAL keys only,
 * and a computed key is invisible to it **by design**. So the repo-wide guarantee "every key the
 * code asks for exists in both catalogues" does not cover these sixteen keys, and a typo'd or
 * deleted `a7` would ship as the visible string `Deniz.a7` on the page with the whole suite green —
 * exactly the `Game.mode3PickerMetaDescription` failure that made that scanner exist.
 *
 * This file is that coverage, bought back by reading the catalogue directly.
 *
 * ## The EN assertion is a TRIPWIRE, not a preference
 *
 * The block is gated to `locale === "tr"` on the page, and the gate's whole justification is that
 * `messages/en.json` has no `Deniz.q*`/`Deniz.a*`. That justification is a FACT ABOUT THE
 * CATALOGUE, and facts rot silently. Asserting the absence means the day someone writes the
 * English copy (T-040), this test goes red and names the thing to do — remove the gate — instead
 * of leaving an `/en/sea` reader with no FAQ and a page-level gate nobody remembers the reason for.
 *
 * Read the failure message, not just the diff: red here is "the EN copy landed", which is good
 * news and a two-line change on the page, never a reason to delete this assertion.
 */

const INDEXES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type Catalogue = Record<string, Record<string, unknown>>;

const denizOf = (catalogue: unknown): Record<string, unknown> =>
  ((catalogue as Catalogue).Deniz ?? {}) as Record<string, unknown>;

describe("the /deniz FAQ pairs", () => {
  it("has all eight Turkish question/answer pairs, each a non-empty string", () => {
    const deniz = denizOf(tr);
    for (const i of INDEXES) {
      for (const field of [`q${i}`, `a${i}`]) {
        const value = deniz[field];
        expect(typeof value, `messages/tr.json Deniz.${field} is missing or not a string`).toBe(
          "string",
        );
        expect((value as string).trim().length, `Deniz.${field} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("gives the eight questions eight distinct texts — Ruling CE, at the source", () => {
    // `FaqSection` keys its items and tracks each accordion panel's open state BY THE QUESTION
    // STRING (`value={item.question}`), so two identical questions in one block would collide:
    // React would warn about duplicate keys and Base UI would open both panels together. The
    // component cannot defend against it — the array is the caller's — so the guarantee lives
    // where the strings do.
    const deniz = denizOf(tr);
    const questions = INDEXES.map((i) => deniz[`q${i}`] as string);
    expect(new Set(questions).size, `duplicate question text:\n  ${questions.join("\n  ")}`).toBe(
      questions.length,
    );
  });

  it("has the heading the page renders, in BOTH catalogues", () => {
    // `Deniz.faqHeading` is the one string in this block that is NOT gated to `tr` by its own
    // absence — the page reads it through the same `t` and it is translated. Pinned in both so the
    // gate's removal does not trip over the heading.
    for (const [name, catalogue] of [
      ["tr", tr],
      ["en", en],
    ] as const) {
      const value = denizOf(catalogue).faqHeading;
      expect(typeof value, `messages/${name}.json Deniz.faqHeading is missing`).toBe("string");
    }
  });

  it("still has NO English copy — the reason the block is gated to tr", () => {
    const deniz = denizOf(en);
    const present = INDEXES.flatMap((i) => [`q${i}`, `a${i}`]).filter((key) => key in deniz);
    expect(
      present,
      "English FAQ copy has landed in messages/en.json. That is good news, and it means the " +
        '`locale === "tr"` gate around the FAQ block in app/[locale]/(site)/deniz/page.tsx is ' +
        "now wrong: remove it, and delete this assertion with it.",
    ).toEqual([]);
  });
});
