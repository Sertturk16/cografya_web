import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSpecialStatusRow, showsCountryFlag, showsSovereigntyNote } from "./sovereignty";

/**
 * The "Egemenlik ve Tanınma" section's GATE, and the weld between that gate and the flag
 * card (→ DEC 2026-08-08h, DEC 2026-08-08l B2 path (a)).
 *
 * ## What this file pins, and what it must never pin
 *
 * It pins the MECHANISM: that the marker is read from the api field, that the section is
 * TR-only, and that on a special-status row the flag and the note can only appear or
 * disappear together. It pins NO membership and NO content — no test here says which
 * countries are special-status, which recognises whom, or how any note begins
 * (→ DEC 2026-07-12: tests check structure and invariants; facts are a separate process).
 *
 * That restraint is not cosmetic here. The six rows are exactly the rows whose text is
 * owner-verbatim narrative on a contested surface; a test that froze the list would turn a
 * seed-side editorial decision into a CI failure, and a test that quoted a note would make
 * this repo a second, silently diverging home for it.
 *
 * The note strings below are deliberately synthetic placeholders. Any non-null string is
 * equivalent to the gate — that IS the mechanism — so nothing resembling a real note is
 * needed or wanted.
 */

/** Stands in for "the api sent a note"; its content is irrelevant to every gate here. */
const SOME_NOTE = "…";

const LOCALES = ["tr", "en"] as const;
const FIELD_STATES: readonly (string | null)[] = [null, SOME_NOTE];

describe("special-status marker — mechanism, not membership", () => {
  it("is a read of the api field, so any filled value marks the row", () => {
    expect(isSpecialStatusRow(null)).toBe(false);
    expect(isSpecialStatusRow(SOME_NOTE)).toBe(true);
  });
});

describe("sovereignty note gate", () => {
  it("renders on TR when the field is filled", () => {
    expect(showsSovereigntyNote("tr", SOME_NOTE)).toBe(true);
  });

  it("does not render on EN — the field is TR-only and SEO-POLICY §B14 forbids machine EN", () => {
    expect(showsSovereigntyNote("en", SOME_NOTE)).toBe(false);
  });

  it("does not render on TR when the field is null", () => {
    expect(showsSovereigntyNote("tr", null)).toBe(false);
  });

  it("does not render on EN when the field is null", () => {
    expect(showsSovereigntyNote("en", null)).toBe(false);
  });
});

describe("the pair falls together", () => {
  it("ties the flag to the note on every special-status row, in every locale", () => {
    for (const locale of LOCALES) {
      for (const note of FIELD_STATES) {
        if (!isSpecialStatusRow(note)) continue;

        expect(
          showsCountryFlag(locale, note),
          "A special-status row may never show the flag without the note that balances it, " +
            "nor the note without the flag (DEC 2026-08-08h). If this fails, one of the two " +
            "gates grew a condition the other does not have.",
        ).toBe(showsSovereigntyNote(locale, note));
      }
    }
  });

  it("leaves ordinary rows alone — they keep the flag in both locales", () => {
    for (const locale of LOCALES) {
      for (const note of FIELD_STATES) {
        if (isSpecialStatusRow(note)) continue;
        expect(showsCountryFlag(locale, note)).toBe(true);
      }
    }
  });
});

/**
 * The source-read half of the weld.
 *
 * The behavioural test above proves the two FUNCTIONS agree. It cannot prove the PAGE asks
 * them — a call site that gated the flag on `isTr` would keep every assertion above green
 * while shipping the exact imbalance the ruling forbids. Same reason, and same technique, as
 * `components/map/attribution-separation.test.ts`: the call site is an async server component
 * and vitest runs in node with no jsdom.
 *
 * Comments are stripped first, because this page documents the coupling at length and a scan
 * of the raw text would be satisfied by the prose after someone deleted the code.
 */
const countryPage = readFileSync(
  new URL("../../app/[locale]/dunya/[slug]/page.tsx", import.meta.url),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
  .replace(/^[ \t]*\/\/.*$/gm, " ");

describe("country page reads both gates from the single decision module", () => {
  it("derives the note from showsSovereigntyNote over the api field", () => {
    expect(countryPage).toMatch(
      /const sovereigntyNote =\s*showsSovereigntyNote\(locale, country\.sovereigntyNoteTr\)/,
    );
  });

  it("derives the flag gate from showsCountryFlag over the same api field", () => {
    expect(countryPage).toMatch(
      /const showsFlag = showsCountryFlag\(locale, country\.sovereigntyNoteTr\);/,
    );
  });

  it("has exactly one flag call site, and it sits behind that gate", () => {
    expect(countryPage.match(/<CountryFlag\b/g)).toHaveLength(1);
    expect(countryPage).toMatch(/\{showsFlag && \(\s*<CountryFlag\b/);
  });

  it("renders the note section behind the derived note, not behind the raw locale flag", () => {
    expect(countryPage).toMatch(
      /\{sovereigntyNote !== null && \([\s\S]{0,200}?<ProseNote text=\{sovereigntyNote\}/,
    );
  });

  it("takes the heading from the catalogue, never a literal", () => {
    expect(countryPage).toMatch(/<h2>\{t\("sovereigntyHeading"\)\}<\/h2>/);
  });
});
