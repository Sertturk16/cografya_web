import { describe, expect, it } from "vitest";
import { buildMarineExplainers, MARINE_EXPLAINER_KEYS, type MarineTranslator } from "./explainers";

/**
 * The explainer BLOCK SET, asserted structurally (`CONVENTIONS.md` §2). Nothing here reads
 * the real Turkish copy: the translator is synthetic and the assertions are about WHICH
 * keys the seven blocks are built from and in WHICH order, never about what those strings
 * say. B11 requires seven blocks in an editorial order, and the module is the only place
 * that set is declared — so the set, the order and the purity of the builder are what a
 * test can meaningfully pin.
 *
 * That the keys actually RESOLVE in the message catalogues is a separate concern, guarded
 * in `messages.test.ts`.
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

  it("is pure — the same translator always yields the same blocks", () => {
    // Every consumer resolves the blocks through this one call, so two calls with the same
    // translator must be indistinguishable: no hidden order, no per-call state, nothing
    // that could make one caller render a different seventh block than another.
    const first = buildMarineExplainers(echo);
    const second = buildMarineExplainers(echo);

    expect(second).toEqual(first);
    for (const [index, entry] of first.entries()) {
      expect(second[index]?.answer).toBe(entry.answer);
      expect(second[index]?.question).toBe(entry.question);
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
