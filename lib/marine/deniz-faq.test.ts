import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { MARINE_EXPLAINER_KEYS, buildMarineExplainers } from "./explainers";

/**
 * RULING CE — THE EIGHT `/deniz` QUESTIONS RESOLVE TO EIGHT DISTINCT STRINGS.
 *
 * ## What this does NOT assert, and where those guarantees already live
 *
 * Everything else about these keys is already covered, derived from the same declaration:
 *
 *   - `lib/marine/messages.test.ts` asserts every `Deniz.q*`/`a*` pair is a non-empty string in
 *     `tr`, one `it` per entry of {@link MARINE_EXPLAINER_KEYS}; carries the EN-absence tripwire
 *     with the "the render gate has to open in the same commit" note; and — through its
 *     chrome-keys loop, which covers every `Deniz` key that is not an explainer — asserts
 *     `Deniz.faqHeading` is a non-empty string in BOTH catalogues.
 *   - `lib/marine/explainers.test.ts` asserts the set is eight entries, that the ids and the
 *     question/answer KEYS are distinct, and that a question key is never reused as an answer key.
 *
 * The first version of this file re-bought all of that and claimed in its docblock that the gap
 * existed, because the page was reading `q${i}` in a hand-written loop and the author checked
 * `lib/i18n/key-existence.test.ts` (which genuinely cannot see a computed key) without checking
 * whether the marine surface had its own guard. It did. The page now calls
 * `buildMarineExplainers`, so the computed-key problem is gone at the source rather than covered
 * by a second test.
 *
 * ## What is genuinely new
 *
 * `explainers.test.ts` proves the eight KEYS are distinct. Two distinct keys can still hold the
 * same STRING, and that is the failure this file exists for: `FaqSection` uses `item.question` as
 * its React key AND, in the accordion mechanism, as the Base UI `value` that tracks which panel is
 * open. Two identical questions in one block therefore collide twice over — React warns about
 * duplicate keys, and opening one panel opens the other. The component cannot defend itself
 * because the array is the caller's, so the guarantee lives with the resolved copy.
 *
 * Resolved through the real catalogue rather than an echo translator: a duplicate that matters is
 * one an editor introduces in `messages/tr.json`, and an echo translator returns the key names,
 * which are distinct by `explainers.test.ts`'s own assertion and so can never collide.
 */

// `Record<string, unknown>` per level, like `lib/marine/messages.test.ts`: the catalogue nests
// (`Climate.notice` is an object), so a `Record<string, Record<string, string>>` cast does not
// describe it and `tsc` rejects the conversion outright.
const deniz = ((trMessages as Record<string, unknown>).Deniz ?? {}) as Record<string, unknown>;

/** The resolved copy for one key, or a marker the assertion below can recognise. */
const copyOf = (key: string): string => {
  const value = deniz[key];
  return typeof value === "string" ? value : `(missing ${key})`;
};

describe("the /deniz FAQ questions (Ruling CE)", () => {
  it("resolves to as many distinct question texts as there are blocks", () => {
    const built = buildMarineExplainers(copyOf);
    const questions = built.map((entry) => entry.question);

    // Anti-vacuity: the set really was resolved from the catalogue, not from key names or from
    // an empty list. A `(missing …)` here would be `messages.test.ts`'s failure, not this one's.
    expect(questions).toHaveLength(MARINE_EXPLAINER_KEYS.length);
    expect(questions.every((question) => !question.startsWith("(missing "))).toBe(true);

    expect(
      new Set(questions).size,
      `two blocks resolve to the same question text, which collides on FaqSection's React key and on the accordion's open-panel value:\n  ${questions.join("\n  ")}`,
    ).toBe(questions.length);
  });

  it("would catch a duplicate — the control, not just the scan", () => {
    // The same predicate over a translator that returns one string for two different keys, which
    // is exactly what a copy-paste in `messages/tr.json` looks like.
    const collided = buildMarineExplainers(() => "aynı soru");
    const questions = collided.map((entry) => entry.question);
    expect(new Set(questions).size).toBe(1);
    expect(questions.length).toBeGreaterThan(1);
  });
});
