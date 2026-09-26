import { describe, expect, it } from "vitest";
import { AUTO_NEXT_KEY, readAutoNext, writeAutoNext } from "./auto-next-preference";

describe("auto-next preference", () => {
  it("defaults to on", () => {
    expect(readAutoNext({ getItem: () => null })).toBe(true);
    expect(readAutoNext(null)).toBe(true);
  });
  it("reads a stored off", () => {
    expect(readAutoNext({ getItem: (k) => (k === AUTO_NEXT_KEY ? "0" : null) })).toBe(false);
  });
  it("is off when storage throws", () => {
    expect(
      readAutoNext({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
  });
  it("writes 1/0 and swallows a throwing storage", () => {
    const written: string[] = [];
    writeAutoNext({ setItem: (_k, v) => void written.push(v) }, false);
    expect(written).toEqual(["0"]);
    expect(() =>
      writeAutoNext(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        true,
      ),
    ).not.toThrow();
  });
});
