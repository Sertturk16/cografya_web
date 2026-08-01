import { describe, expect, it } from "vitest";
import { buildMarineExplainers, MARINE_EXPLAINER_KEYS, type MarineTranslator } from "./explainers";

/**
 * The FAQ PARITY guarantee, asserted structurally (`CONVENTIONS.md` §2). Nothing here reads
 * the real Turkish copy: the translator is synthetic and the assertions are about WHICH
 * strings the visible blocks and the JSON-LD answers are built from, never about what those
 * strings say. Google requires FAQPage content to be visible on the page and
 * `SEO-POLICY.md` §B5 5.7 bans markup that is not — so what must be pinned is that both
 * consumers resolve the same keys through the same call.
 */

/** Echoes the key back, so an entry's provenance is visible in the assertion. */
const echo: MarineTranslator = (key) => `<${key}>`;

describe("MARINE_EXPLAINER_KEYS", () => {
  it("lists seven blocks (SPEC-ADDENDUM §7.12 B11: 5 core + 2 added)", () => {
    expect(MARINE_EXPLAINER_KEYS).toHaveLength(7);
  });

  it("uses a distinct id and a distinct key pair per block", () => {
    const ids = MARINE_EXPLAINER_KEYS.map((entry) => entry.id);
    const questions = MARINE_EXPLAINER_KEYS.map((entry) => entry.question);
    const answers = MARINE_EXPLAINER_KEYS.map((entry) => entry.answer);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(questions).size).toBe(questions.length);
    expect(new Set(answers).size).toBe(answers.length);
  });

  it("never reuses a question key as an answer key", () => {
    const questions = new Set<string>(MARINE_EXPLAINER_KEYS.map((entry) => entry.question));
    for (const entry of MARINE_EXPLAINER_KEYS) {
      expect(questions.has(entry.answer)).toBe(false);
    }
  });
});

describe("buildMarineExplainers", () => {
  it("returns one entry per declared block, in declaration order", () => {
    const built = buildMarineExplainers(echo);

    expect(built).toHaveLength(MARINE_EXPLAINER_KEYS.length);
    expect(built.map((entry) => entry.id)).toEqual(MARINE_EXPLAINER_KEYS.map((entry) => entry.id));
  });

  it("resolves each question and answer from its own declared key", () => {
    const built = buildMarineExplainers(echo);

    for (const [index, entry] of MARINE_EXPLAINER_KEYS.entries()) {
      expect(built[index]?.question).toBe(`<${entry.question}>`);
      expect(built[index]?.answer).toBe(`<${entry.answer}>`);
    }
  });

  it("gives the visible block and the FAQ markup identical strings", () => {
    // The page calls this ONCE and hands the result to both consumers. Two calls with the
    // same translator must therefore be indistinguishable — if they ever were not, the
    // rendered paragraph and the marked-up answer could drift apart.
    const forDisplay = buildMarineExplainers(echo);
    const forJsonLd = buildMarineExplainers(echo);

    expect(forJsonLd).toEqual(forDisplay);
    for (const [index, entry] of forDisplay.entries()) {
      expect(forJsonLd[index]?.answer).toBe(entry.answer);
      expect(forJsonLd[index]?.question).toBe(entry.question);
    }
  });

  it("asks the translator for exactly the declared keys and nothing else", () => {
    const asked: string[] = [];
    buildMarineExplainers((key) => {
      asked.push(key);
      return key;
    });

    expect(new Set(asked)).toEqual(
      new Set(MARINE_EXPLAINER_KEYS.flatMap((entry) => [entry.question, entry.answer])),
    );
    expect(asked).toHaveLength(MARINE_EXPLAINER_KEYS.length * 2);
  });
});
