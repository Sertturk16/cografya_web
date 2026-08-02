import { describe, expect, it } from "vitest";
import { type ShapeState, deriveShapeState } from "./shape-state";

/**
 * STRUCTURE, NOT FACTS. Nothing here asserts which il belongs to which bölge — that is
 * data, and it is the api's business. What is pinned is the SHAPE of the marking rule.
 *
 * The fixture is a miniature bölge-mode map: five plates, two regions, one unseeded plate
 * with no target at all.
 */
const PLATE_TO_TARGET: ReadonlyMap<string, string | undefined> = new Map([
  ["34", "region:A"],
  ["59", "region:A"],
  ["41", "region:A"],
  ["35", "region:B"],
  ["45", "region:B"],
  // An unseeded plate: it is drawn on the map (the country outline must be whole) but it
  // is never an answer, so no mark may ever land on it.
  ["99", undefined],
]);

function markedPlates(
  input: Omit<Parameters<typeof deriveShapeState>[0], "targetId">,
  state: ShapeState,
): string[] {
  return [...PLATE_TO_TARGET.entries()]
    .filter(([, targetId]) => deriveShapeState({ ...input, targetId }) === state)
    .map(([plate]) => plate);
}

const NONE = {
  solvedTargetIds: new Set<string>(),
  revealedTargetId: null,
  wrongTargetId: null,
};

describe("deriveShapeState", () => {
  it("marks a wrong answer on exactly the shapes a correct answer would have marked", () => {
    // THE REGRESSION THIS FILE EXISTS FOR. In bölge mode a click answers for a whole
    // region, so both marks must cover that whole region — not one il for wrong and the
    // whole region for correct.
    for (const targetId of ["region:A", "region:B"]) {
      const wrong = markedPlates({ ...NONE, wrongTargetId: targetId }, "wrong");
      const correct = markedPlates({ ...NONE, solvedTargetIds: new Set([targetId]) }, "correct");
      expect(wrong).toEqual(correct);
      expect(wrong.length).toBeGreaterThan(1); // the fixture's regions really are multi-plate
    }
  });

  it("marks a revealed target on the same shape set too", () => {
    const revealed = markedPlates({ ...NONE, revealedTargetId: "region:A" }, "reveal");
    const correct = markedPlates({ ...NONE, solvedTargetIds: new Set(["region:A"]) }, "correct");
    expect(revealed).toEqual(correct);
  });

  it("never marks a shape that has no target", () => {
    const everything = {
      solvedTargetIds: new Set(["region:A", "region:B"]),
      revealedTargetId: "region:A",
      wrongTargetId: "region:B",
    };
    expect(deriveShapeState({ ...everything, targetId: undefined })).toBeNull();
  });

  it("leaves an untouched target unmarked", () => {
    expect(
      deriveShapeState({
        ...NONE,
        targetId: "region:A",
        solvedTargetIds: new Set(["region:B"]),
      }),
    ).toBeNull();
  });

  it("applies precedence solved → revealed → wrong", () => {
    const solved = new Set(["region:A"]);
    expect(
      deriveShapeState({
        targetId: "region:A",
        solvedTargetIds: solved,
        revealedTargetId: "region:A",
        wrongTargetId: null,
      }),
    ).toBe("reveal");
    expect(
      deriveShapeState({
        targetId: "region:A",
        solvedTargetIds: solved,
        revealedTargetId: "region:A",
        wrongTargetId: "region:A",
      }),
    ).toBe("wrong");
  });
});
