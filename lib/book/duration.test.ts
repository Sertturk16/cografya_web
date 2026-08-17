import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("renders under a minute with a zero minute field", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(59)).toBe("0:59");
  });

  it("pads the seconds field", () => {
    expect(formatDuration(60)).toBe("1:00");
    // The contract's own trap, from the other side: 368 seconds is "PT6M8S" and 68 is not.
    expect(formatDuration(68)).toBe("1:08");
    expect(formatDuration(368)).toBe("6:08");
  });

  it("grows an hours field only once it is needed", () => {
    expect(formatDuration(3599)).toBe("59:59");
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("clamps values the contract cannot produce rather than printing NaN on a live page", () => {
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
    expect(formatDuration(90.7)).toBe("1:30");
  });
});
