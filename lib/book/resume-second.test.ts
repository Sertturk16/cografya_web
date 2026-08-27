import { describe, expect, it } from "vitest";
import { resolveIzleStartSecond } from "./resume-second";

describe("resolveIzleStartSecond — §5.4's resume-second priority", () => {
  it("uses the saved position when it is further along than the explicit (0) target", () => {
    expect(resolveIzleStartSecond(0, 204)).toBe(204);
  });

  it("keeps the explicit fragment-armed target when the saved position is not further along", () => {
    expect(resolveIzleStartSecond(400, 204)).toBe(400);
  });

  it("keeps the explicit target when there is no saved position at all", () => {
    expect(resolveIzleStartSecond(120, undefined)).toBe(120);
  });

  it("stays at 0 when neither an explicit target nor a saved position exists", () => {
    expect(resolveIzleStartSecond(0, undefined)).toBe(0);
  });

  it("does not resume from a saved position of exactly 0", () => {
    expect(resolveIzleStartSecond(0, 0)).toBe(0);
  });

  it("does not resume from a saved position exactly equal to the explicit target", () => {
    // Strictly greater, not greater-or-equal — ties keep the explicit target rather than
    // silently swapping to an equal-valued saved position for no visible reason.
    expect(resolveIzleStartSecond(94, 94)).toBe(94);
  });
});
