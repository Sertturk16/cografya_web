import { describe, expect, it } from "vitest";
import { MODEL_INSTANT_FORMAT, parseModelInstant } from "./model-run";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). No expectation here depends on a live model cycle
 * — a test that asserted "the horizon is 6 August 2026" would be pinning today's shadow run,
 * not this module's contract.
 */

describe("parseModelInstant", () => {
  it("maps an absent künye field to null — never a fabricated date", () => {
    expect(parseModelInstant(null)).toBeNull();
  });

  it("maps an empty string to null", () => {
    expect(parseModelInstant("")).toBeNull();
  });

  it.each(["not-a-date", "2026-13-45T99:99:99Z", "soon"])(
    "maps the unparseable value %s to null rather than an Invalid Date",
    (value) => {
      expect(parseModelInstant(value)).toBeNull();
    },
  );

  it("parses a valid ISO-8601 UTC instant to the exact same moment", () => {
    const parsed = parseModelInstant("2026-01-05T06:00:00.000Z");

    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(Date.UTC(2026, 0, 5, 6, 0, 0, 0));
  });
});

describe("MODEL_INSTANT_FORMAT", () => {
  it("pins the time zone to UTC so the rendered string cannot depend on the runtime", () => {
    expect(MODEL_INSTANT_FORMAT.timeZone).toBe("UTC");
  });

  it("prints the instant's UTC clock reading, not the runtime's local one", () => {
    const instant = parseModelInstant("2026-01-05T06:00:00.000Z");
    if (instant === null) throw new Error("fixture instant failed to parse");

    const hour = new Intl.DateTimeFormat("tr", MODEL_INSTANT_FORMAT)
      .formatToParts(instant)
      .find((part) => part.type === "hour")?.value;

    // Compared numerically so zero-padding is an ICU detail, not a test dependency.
    expect(Number(hour)).toBe(6);
  });

  it("is load-bearing: the same instant reads differently under another zone", () => {
    const instant = parseModelInstant("2026-01-05T06:00:00.000Z");
    if (instant === null) throw new Error("fixture instant failed to parse");

    const utc = new Intl.DateTimeFormat("tr", MODEL_INSTANT_FORMAT).format(instant);
    const tokyo = new Intl.DateTimeFormat("tr", {
      ...MODEL_INSTANT_FORMAT,
      timeZone: "Asia/Tokyo",
    }).format(instant);

    expect(utc).not.toBe(tokyo);
  });
});
