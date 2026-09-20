import { describe, expect, it } from "vitest";
import { canonicalizePhone, formatTurkishMobileInput } from "./form-rules";

/**
 * {@link formatTurkishMobileInput}, the live mask behind the two phone fields (T-072).
 *
 * A SEPARATE MODULE from `form-rules.canonicalize-phone.test.ts` for the reason that file
 * already records: these two functions look adjacent and are not. `canonicalizePhone`
 * answers "is this a phone number, and what is its one storable form"; this one answers
 * "what should be in the box after this keystroke", which is a different question with a
 * different failure mode — it runs on EVERY character, and any input it rejects is an input
 * the reader cannot type at all.
 *
 * THE INVARIANT THAT TIES THEM TOGETHER is asserted at the bottom: anything this mask can
 * produce at full length is something `canonicalizePhone` accepts. The mask is the only
 * writer of these two fields now, so a divergence would be a form that refuses its own
 * output on submit.
 */

describe("formatTurkishMobileInput — the 5XX XXX XX XX groups", () => {
  it("groups ten digits as 3-3-2-2", () => {
    expect(formatTurkishMobileInput("5551234567")).toBe("555 123 45 67");
  });

  it("spaces arrive as the reader types, never ahead of the digit that needs them", () => {
    // The trailing separator is the classic mask defect: a box reading "555 " with the
    // caret after a space the reader did not type, which backspace then has to eat twice.
    expect(formatTurkishMobileInput("5")).toBe("5");
    expect(formatTurkishMobileInput("55")).toBe("55");
    expect(formatTurkishMobileInput("555")).toBe("555");
    expect(formatTurkishMobileInput("5551")).toBe("555 1");
    expect(formatTurkishMobileInput("555123")).toBe("555 123");
    expect(formatTurkishMobileInput("5551234")).toBe("555 123 4");
    expect(formatTurkishMobileInput("55512345")).toBe("555 123 45");
    expect(formatTurkishMobileInput("555123456")).toBe("555 123 45 6");
  });

  it("re-formats an already-formatted value idempotently — the field re-enters its own output", () => {
    expect(formatTurkishMobileInput("555 123 45 67")).toBe("555 123 45 67");
    expect(formatTurkishMobileInput(formatTurkishMobileInput("555 123 45 67"))).toBe(
      "555 123 45 67",
    );
  });

  it("the full mask is 13 characters, which is what `maxLength` on the input must say", () => {
    expect(formatTurkishMobileInput("5551234567")).toHaveLength(13);
  });
});

describe("formatTurkishMobileInput — what it swallows before the first digit", () => {
  it("swallows a leading 0, so the reader never has to know whether to type one", () => {
    expect(formatTurkishMobileInput("0")).toBe("");
    expect(formatTurkishMobileInput("05")).toBe("5");
    expect(formatTurkishMobileInput("05551234567")).toBe("555 123 45 67");
  });

  it("swallows a 90 or +90 country code — this is what the SETTINGS field is handed", () => {
    // `profile.phone` arrives from the api as `+905551234567`, and the settings card seeds
    // its state with it. Without this branch the mask would read the `9` as the first digit,
    // reject it for not being a 5, and blank the reader's saved number on first paint.
    expect(formatTurkishMobileInput("+905551234567")).toBe("555 123 45 67");
    expect(formatTurkishMobileInput("905551234567")).toBe("555 123 45 67");
    expect(formatTurkishMobileInput("+90")).toBe("");
  });

  it("strips letters, punctuation and every other non-digit", () => {
    expect(formatTurkishMobileInput("(555) 123-45-67")).toBe("555 123 45 67");
    expect(formatTurkishMobileInput("abc")).toBe("");
    expect(formatTurkishMobileInput("5abc5c5")).toBe("555");
  });

  it("the empty string stays empty — an untouched field is not an error", () => {
    expect(formatTurkishMobileInput("")).toBe("");
  });
});

describe("formatTurkishMobileInput — the mobile prefix is a gate, not a warning", () => {
  /**
   * The ruled behaviour (T-072, owner answer): a first digit that is not 5 is not typed at
   * all, rather than typed and then complained about. Every Turkish mobile number begins
   * with 5, so the alternative is a field that accepts a shape it will refuse on submit.
   */
  it("refuses a first digit that is not 5", () => {
    expect(formatTurkishMobileInput("2")).toBe("");
    expect(formatTurkishMobileInput("212")).toBe("");
    expect(formatTurkishMobileInput("2121234567")).toBe("");
  });

  it("a 0 followed by a non-5 is still refused — the 0 is swallowed, not counted", () => {
    expect(formatTurkishMobileInput("0212")).toBe("");
  });

  it("digits after the first are unconstrained — 5 is the only pinned position", () => {
    expect(formatTurkishMobileInput("5000000000")).toBe("500 000 00 00");
  });
});

describe("formatTurkishMobileInput — the ceiling", () => {
  it("stops at ten digits however many are pasted or typed", () => {
    expect(formatTurkishMobileInput("55512345678901234567890")).toBe("555 123 45 67");
  });

  it("an eleventh digit typed at the end of a full number changes nothing", () => {
    const full = formatTurkishMobileInput("5551234567");
    expect(formatTurkishMobileInput(`${full}8`)).toBe(full);
  });
});

describe("the mask and the canonicaliser agree", () => {
  it("every full-length value the mask can produce is one canonicalizePhone accepts", () => {
    for (const raw of ["5551234567", "05321112233", "+905417654321", "(555) 123-45-67"]) {
      const masked = formatTurkishMobileInput(raw);
      expect(masked).toHaveLength(13);
      expect(canonicalizePhone(masked)).not.toBeNull();
    }
  });

  it("negative control — a partial value is NOT canonicalizable, which is why submit still checks", () => {
    expect(canonicalizePhone(formatTurkishMobileInput("55512"))).toBeNull();
  });
});
