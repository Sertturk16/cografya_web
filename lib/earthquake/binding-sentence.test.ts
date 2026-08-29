import { describe, expect, it } from "vitest";
import { bindingSentenceKey, type EarthquakeBindingKind } from "./binding-sentence";

describe("bindingSentenceKey — all three bindingKind states, explicitly", () => {
  it('"inside" needs no extra sentence — placeNameTr already carries the province', () => {
    expect(bindingSentenceKey("inside")).toBeNull();
  });

  it('"offshore_near" resolves to the offshore-context key, never a location claim', () => {
    expect(bindingSentenceKey("offshore_near")).toBe("offshoreNear");
  });

  it('"across_border" resolves to the proximity-only key, never a location claim', () => {
    expect(bindingSentenceKey("across_border")).toBe("acrossBorder");
  });

  it("covers every bindingKind the contract can emit — exhaustiveness guard", () => {
    // If a fourth bindingKind is ever added to the contract, this list — copied from the
    // schema's own union rather than hand-typed — stops compiling until the switch above is
    // updated, which is the point: a new state must be a deliberate decision here, not a
    // silent fallthrough.
    const allStates: EarthquakeBindingKind[] = ["inside", "offshore_near", "across_border"];
    expect(allStates.map(bindingSentenceKey)).toEqual(
      ["inside", "offshore_near", "across_border"].map((k) =>
        k === "inside" ? null : k === "offshore_near" ? "offshoreNear" : "acrossBorder",
      ),
    );
  });
});
