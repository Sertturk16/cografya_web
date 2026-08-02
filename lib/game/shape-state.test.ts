import { describe, expect, it } from "vitest";
import { type ShapeState, deriveShapeState } from "./shape-state";

/**
 * STRUCTURE, NOT FACTS. Nothing here asserts which il belongs to which bölge — that is
 * data, and it is the api's business. What is pinned is the SHAPE of the marking rule.
 *
 * The fixture is a miniature map carrying BOTH target shapes at once: two multi-plate
 * targets (what bölge mode builds), one single-plate target (what il mode builds — a
 * target whose only member is the plate itself), and one unseeded plate with no target.
 * `deriveShapeState` takes no mode argument and never branches on how many plates share a
 * target, so one fixture proves both modes; the single-plate entry is here so that claim is
 * demonstrated rather than inferred.
 */
const PLATE_TO_TARGET: ReadonlyMap<string, string | undefined> = new Map([
  ["34", "region:A"],
  ["59", "region:A"],
  ["41", "region:A"],
  ["35", "region:B"],
  ["45", "region:B"],
  // İl mode's shape: the plate IS the target (`buildProvinceTargetSet` maps it to itself).
  ["06", "06"],
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

  it("holds the same invariant for a single-plate (il mode) target", () => {
    // Same claim, n = 1: the function has no mode parameter, so il mode is the same rule
    // with a one-member target. Spelled out rather than left to be inferred.
    const wrong = markedPlates({ ...NONE, wrongTargetId: "06" }, "wrong");
    const correct = markedPlates({ ...NONE, solvedTargetIds: new Set(["06"]) }, "correct");
    expect(wrong).toEqual(correct);
    expect(wrong).toEqual(["06"]);
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

  it("keeps an ALREADY-SOLVED target green when it is clicked as a wrong answer", () => {
    // THE OTHER REGRESSION THIS FILE EXISTS FOR (→ PR #38 review I1). A pick that is not
    // the open question's target is a wrong answer even when the player solved it earlier,
    // so this state really does occur — but an earned mark may never be repainted as lost.
    // The whole solved region must stay `correct`, not just the plate under the cursor.
    const input = { ...NONE, solvedTargetIds: new Set(["region:A"]), wrongTargetId: "region:A" };
    expect(markedPlates(input, "correct")).toEqual(["34", "59", "41"]);
    expect(markedPlates(input, "wrong")).toEqual([]);
  });

  it("still flashes an UNSOLVED target wrong while another target is solved", () => {
    // The other half of the same rule: fixing I1 must not swallow the ordinary flash.
    const input = {
      ...NONE,
      solvedTargetIds: new Set(["region:A"]),
      wrongTargetId: "region:B",
    };
    expect(markedPlates(input, "wrong")).toEqual(["35", "45"]);
    expect(markedPlates(input, "correct")).toEqual(["34", "59", "41"]);
  });

  it("applies precedence: solved beats wrong, revealed beats solved, wrong beats revealed", () => {
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
        targetId: "region:B",
        solvedTargetIds: solved,
        revealedTargetId: "region:B",
        wrongTargetId: "region:B",
      }),
    ).toBe("wrong");
    expect(
      deriveShapeState({
        targetId: "region:A",
        solvedTargetIds: solved,
        revealedTargetId: null,
        wrongTargetId: "region:A",
      }),
    ).toBe("correct");
  });
});
